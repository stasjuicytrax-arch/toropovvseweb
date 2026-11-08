import { Mesh, PlaneGeometry, ShaderMaterial, SRGBColorSpace, Texture } from 'three';

const vertex = /* glsl */ `
  varying vec2 photoUV;

  void main() {
    photoUV = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const landscape = /* glsl */ `
  varying vec2 photoUV;
  uniform sampler2D photo;
  uniform float time;
  uniform bool wide;

  float ridge(float x) {
    if (wide) {
      float left = mix(0.10, 0.24, smoothstep(0.0, 0.18, x));
      left -= 0.08 * smoothstep(0.18, 0.36, x);
      left += 0.12 * smoothstep(0.36, 0.48, x);
      return mix(left, 0.02, smoothstep(0.54, 1.0, x));
    }
    float left = mix(0.30, 0.39, smoothstep(0.0, 0.36, x));
    return mix(left, 0.25, smoothstep(0.57, 1.0, x));
  }

  float softBand(float distance, float width) {
    float d = distance / width;
    return exp(-d * d);
  }
`;

const sunset = /* glsl */ `
  ${landscape}

  void main() {
    float x = photoUV.x;
    float y = 1.0 - photoUV.y;
    float horizon = wide ? 0.16 : 0.30;
    float progress = smoothstep(0.12, 2.25, time);
    float ground = smoothstep(ridge(x) - 0.01, ridge(x) + 0.11, y);
    float distance = y + 0.12 * (x - 0.5) + 0.08 * abs(x - 0.58);
    float sweep = softBand(distance - mix(horizon - 0.12, 1.25, progress), 0.18);
    float strength = sweep * smoothstep(0.05, 0.45, time);
    float glow = softBand(y - horizon, 0.15) * softBand(x - 0.62, 0.46);
    vec3 original = texture2D(photo, photoUV).rgb;
    vec3 lit = original * (1.0 + vec3(1.15, 0.62, 0.08) * strength * ground);
    lit += vec3(0.19, 0.069, 0.026) * (1.0 - original)
      * glow * (0.9 * strength + 0.50 * smoothstep(0.4, 2.6, time));
    gl_FragColor = vec4(lit, 1.0);
    #include <colorspace_fragment>
  }
`;

const wind = /* glsl */ `
  ${landscape}

  float petal(vec2 point, float delay, float origin, float size, float phase) {
    float age = (time - delay) / 1.25;
    if (age <= 0.0 || age >= 1.0) return 0.0;
    vec2 center = vec2(origin + 0.18 * age, 0.47 + phase * 0.25 - 0.20 * age);
    vec2 p = (point - center) * vec2(wide ? 1.78 : 0.56, 1.0) / size;
    if (dot(p, p) > 1.8) return 0.0;
    float opacity = smoothstep(0.0, 0.18, age) * (1.0 - smoothstep(0.65, 1.0, age));
    float angle = 5.0 * age + phase * 7.0;
    p = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * p;
    p.x /= 0.36 + 0.64 * abs(cos(age * 6.0 + phase));
    return opacity * (1.0 - smoothstep(0.65, 1.0, length(p * vec2(0.75, 1.5))));
  }

  void main() {
    float x = photoUV.x;
    float y = 1.0 - photoUV.y;
    float edge = ridge(x);
    float depth = clamp((y - edge) / (1.0 - edge), 0.0, 1.0);
    float arrival = 0.18 + 1.23 * depth + 0.26 * x;
    float age = time - arrival;
    float gust = smoothstep(0.0, 0.27, age) * (1.0 - smoothstep(0.51, 1.34, age));
    float plants = smoothstep(edge + 0.015, edge + 0.09, y);
    float stems = 0.65 + 0.35 * sin(115.0 * x + sin(y * 83.0) * 1.4);
    float border = min(min(x, 1.0 - x), 1.0 - y);
    float bend = gust * plants * stems * mix(0.55, 1.0, depth)
      * smoothstep(0.0, 0.036, border);
    vec2 shift = vec2(
      (wide ? 0.014 : 0.027) * (0.60 + 0.40 * sin(age * 10.0 - y * 28.0 + x * 8.0)),
      0.004 * sin(age * 9.0 + x * 25.0)
    ) * bend;
    vec3 color = texture2D(photo, photoUV - shift).rgb;
    vec2 point = vec2(x, y);
    float petals = petal(point, 0.38, 0.17, 0.0038, 0.14)
      + petal(point, 0.64, 0.27, 0.0042, 0.01)
      + petal(point, 0.93, 0.69, 0.0051, 0.38)
      + petal(point, 1.20, 0.08, 0.0068, 0.82)
      + petal(point, 1.38, 0.70, 0.0058, 0.73)
      + petal(point, 1.65, 0.14, 0.0062, 0.67);
    color = mix(color, vec3(0.94, 0.56, 0.58), clamp(petals * 0.80, 0.0, 1.0));
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

function makeLandscape(width, height, desktop, portrait, fragmentShader, duration) {
  const photo = new Texture(portrait);
  photo.colorSpace = SRGBColorSpace;
  photo.needsUpdate = true;
  const material = new ShaderMaterial({
    uniforms: { photo: { value: photo }, wide: { value: desktop }, time: { value: 0 } },
    vertexShader: vertex,
    fragmentShader,
  });
  const object = new Mesh(new PlaneGeometry(width, height), material);
  object.position.set(width / 2, -height / 2, 0);

  return {
    object,
    duration,
    render(time) {
      material.uniforms.time.value = time;
      object.visible = time > 0 && (fragmentShader === sunset || time < duration);
    },
    dispose() {
      photo.dispose();
    },
  };
}

export function makeSunset(width, height, desktop, portrait) {
  return makeLandscape(width, height, desktop, portrait, sunset, 2.65);
}

export function makeWind(width, height, desktop, portrait) {
  return makeLandscape(width, height, desktop, portrait, wind, 3.05);
}
