import {
  BufferGeometry, CatmullRomCurve3, Color, DoubleSide, ExtrudeGeometry,
  Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, PlaneGeometry,
  ShaderMaterial, Shape, Vector3,
} from 'three';

const smooth = value => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  }
`;

export function makeRibbon(width, height, desktop) {
  const points = desktop
    ? [[.10,.41,-45],[.27,.31,10],[.43,.23,56],[.56,.25,14],[.70,.16,-35],[.84,.20,32],[.96,.32,66]]
    : [[.02,.39,-40],[.19,.345,12],[.36,.282,48],[.53,.305,12],[.70,.276,-36],[.85,.273,17],[.99,.32,44]];
  const curve = new CatmullRomCurve3(points.map(([x,y,z]) => new Vector3(x * width, -y * height, z)));
  const positions = [];
  const uvs = [];
  const indices = [];
  const lengthSteps = 88;
  const crossSteps = 6;
  const radius = height * (desktop ? .037 : .024);

  for (let along = 0; along <= lengthSteps; along += 1) {
    const u = along / lengthSteps;
    const centre = curve.getPointAt(u);
    const tangent = curve.getTangentAt(u);
    const side = new Vector3(-tangent.y, tangent.x, 0).normalize();
    const twist = .65 * Math.sin(u * Math.PI * 3 - .85);
    side.multiplyScalar(Math.cos(twist));
    side.z = Math.sin(twist);
    const breadth = radius * (.40 + .60 * Math.sin(Math.PI * u) ** .55);

    for (let across = 0; across <= crossSteps; across += 1) {
      const v = across / crossSteps;
      const p = centre.clone().addScaledVector(side, (v * 2 - 1) * breadth);
      p.z += Math.sin(Math.PI * v) * breadth * .23;
      positions.push(p.x, p.y, p.z);
      uvs.push(u, v);
      if (along < lengthSteps && across < crossSteps) {
        const a = along * (crossSteps + 1) + across;
        const b = a + crossSteps + 1;
        indices.push(a,b,a+1,b,b+1,a+1);
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  const material = new ShaderMaterial({
    transparent: true, depthWrite: false, side: DoubleSide,
    uniforms: {
      progress: { value: 0 },
      glint: { value: 0 },
      gold: { value: new Color('#ffd0a7') },
      pink: { value: new Color('#f8a9c4') },
      violet: { value: new Color('#a6b9ff') },
    },
    vertexShader,
    fragmentShader: `
      varying vec2 vUv;
      uniform float progress, glint;
      uniform vec3 gold, pink, violet;
      void main() {
        float u = vUv.x, v = vUv.y;
        float edge = pow(abs(v - .5) * 2., 6.);
        float crease = pow(max(0., sin(v * 3.14159 + u * 8.)), 10.);
        float flash = exp(-pow((u - glint) * 11., 2.)) * .45;
        vec3 color = mix(pink, gold, .5 + .5 * sin(u * 6.6 + v * 1.9));
        color = mix(color, violet, .6 * smoothstep(.47, .96, u));
        color = mix(color, vec3(1., .9, .83), min(.95, edge * .65 + crease * .30 + flash));
        float reveal = 1. - smoothstep(progress - .075, progress, u);
        float ends = smoothstep(0., .06, u) * (1. - smoothstep(.94, 1., u));
        float opacity = (.26 + .45 * edge + .16 * crease + .13 * flash) * reveal * ends;
        gl_FragColor = vec4(color, opacity);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new Mesh(geometry, material);

  return {
    object: mesh,
    duration: 2.45,
    render(time) {
      material.uniforms.progress.value = 1.09 * smooth(time / 1.60);
      material.uniforms.glint.value = -0.18 + 1.42 * smooth(time / 2.45);
      mesh.position.y = -height * .036 * (1 - smooth(time / 1.9));
    },
  };
}

export function makeLights(width, height, desktop) {
  const object = new Group();
  const beams = [
    { x: desktop ? .37 : .33, color: '#ffe0af', direction: 1 },
    { x: desktop ? .65 : .73, color: '#b5d9ff', direction: -1 },
  ].map(({ x, color, direction }) => {
    const length = height * (desktop ? .58 : .48);
    const geometry = new PlaneGeometry(height * (desktop ? .38 : .235), length);
    geometry.translate(0, length / 2, 0);
    const material = new ShaderMaterial({
      transparent: true, depthWrite: false, side: DoubleSide,
      uniforms: { color: { value: new Color(color) }, intensity: { value: 0 } },
      vertexShader,
      fragmentShader: `
        varying vec2 vUv;
        uniform vec3 color;
        uniform float intensity;
        void main() {
          float height = vUv.y;
          float distance = abs(vUv.x - .5);
          float spread = mix(.028, .49, height);
          float edge = 1. - smoothstep(spread * .10, spread, distance);
          float core = 1. - smoothstep(spread * .018, spread * .27, distance);
          float falloff = smoothstep(.015, .17, height) * (1. - smoothstep(.61, 1., height));
          vec3 beamColor = mix(color, vec3(1., .97, .9), core * .32);
          gl_FragColor = vec4(beamColor, falloff * intensity * (.62 * edge + .38 * core));
          #include <colorspace_fragment>
        }
      `,
    });
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x * width, -(desktop ? .425 : .475) * height, -20);
    object.add(mesh);
    return { mesh, direction };
  });

  return {
    object,
    duration: 3.1,
    render(time) {
      beams.forEach(({ mesh, direction }, index) => {
        const elapsed = Math.max(0, time - index * .17);
        const sweep = smooth(elapsed / 1.65);
        mesh.rotation.z = direction * (-.24 + (desktop ? .67 : .49) * sweep);
        mesh.material.uniforms.intensity.value =
          .78 * smooth(elapsed / .59) - .24 * smooth((elapsed - 1.95) / .85);
      });
    },
  };
}

function letterS() {
  const s = new Shape();
  s.moveTo(5, 16);
  s.lineTo(17, 32);
  s.bezierCurveTo(27, 22, 47, 18, 53, 27);
  s.bezierCurveTo(58, 35, 46, 39, 33, 43);
  s.bezierCurveTo(15, 48, 6, 57, 6, 72);
  s.bezierCurveTo(6, 90, 20, 100, 42, 100);
  s.bezierCurveTo(56, 100, 67, 96, 77, 88);
  s.lineTo(66, 72);
  s.bezierCurveTo(55, 80, 34, 84, 31, 73);
  s.bezierCurveTo(28, 66, 37, 63, 50, 59);
  s.bezierCurveTo(71, 53, 80, 44, 80, 28);
  s.bezierCurveTo(80, 10, 63, 0, 42, 0);
  s.bezierCurveTo(26, 0, 14, 6, 5, 16);
  return s;
}

function letterT() {
  const t = new Shape();
  t.moveTo(0, 100);
  t.lineTo(82, 100);
  t.lineTo(82, 79);
  t.lineTo(54, 79);
  t.lineTo(54, 0);
  t.lineTo(28, 0);
  t.lineTo(28, 79);
  t.lineTo(0, 79);
  t.closePath();
  return t;
}

export function makeLetters(width, height, desktop) {
  const object = new Group();
  const material = new MeshStandardMaterial({ color: '#eac7a1', roughness: .31, metalness: .32 });
  const letters = [letterS(), letterT()].map((shape, index) => {
    const geometry = new ExtrudeGeometry(shape, {
      depth: 16, bevelEnabled: true, bevelSize: 2.1, bevelThickness: 2.2,
      bevelSegments: 3, curveSegments: 10,
    });
    geometry.translate(-41, 0, -8);
    const mesh = new Mesh(geometry, material);
    const size = height * (desktop ? .187 : .091);
    const x = desktop ? [.324, .420][index] : [.218, .375][index];
    const base = height * (desktop ? [.365, .354][index] : [.434, .426][index]);
    mesh.scale.setScalar(size / 100);
    object.add(mesh);
    return { mesh, x: x * width, base, size };
  });

  return {
    object,
    duration: 2.5,
    render(time) {
      letters.forEach(({ mesh, x, base, size }, index) => {
        const amount = smooth((time - index * .23) / 1.7);
        mesh.position.set(x + (index === 0 ? -22 : 28) * (1 - amount), -base - size * .82 * (1 - amount), 0);
        mesh.rotation.set(-.075, (index === 0 ? -.32 : .26) + (1 - amount) * (index === 0 ? -.68 : .48), -.055 + index * .08);
      });
    },
  };
}
