import {
  Scene, Color, PerspectiveCamera, WebGLRenderer, ACESFilmicToneMapping,
  PCFShadowMap, PMREMGenerator, Mesh, MeshPhysicalMaterial, MeshStandardMaterial,
  PlaneGeometry, ExtrudeGeometry, DirectionalLight, HemisphereLight, Vector3
} from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import logoSvg from '../assets/logo.svg';
import { portalGeometry, placeCamera } from './geometry.js';
import { connectMotion } from './motion.js';

const stage = document.querySelector('#stage');
const canvas = document.querySelector('#space');
const fallback = document.querySelector('#fallback');
const activation = document.querySelector('#sensor-activation');
const status = document.querySelector('#status');
let renderer, motion, environmentTarget, scene, pmrem;
const dispose = () => {
  motion?.destroy();
  const geometries = new Set(), materials = new Set();
  scene?.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) for (const material of [object.material].flat()) materials.add(material);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  environmentTarget?.dispose();
  pmrem?.dispose();
  renderer?.dispose();
};

try {
  renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'default' });
  renderer.setClearColor(0xf3f4f3, 1);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  scene = new Scene();
  scene.background = new Color(0xf3f4f3);
  const environment = new RoomEnvironment();
  pmrem = new PMREMGenerator(renderer);
  environmentTarget = pmrem.fromScene(environment, .04);
  scene.environment = environmentTarget.texture;
  scene.environmentIntensity = 1;
  environment.dispose();
  const camera = new PerspectiveCamera(40, 1, .1, 100);
  let aspect = 1, poseX = 0, poseY = 0;

  const light = new DirectionalLight(0xfff9ee, 2.8);
  light.position.set(-4, 7, 15);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  Object.assign(light.shadow.camera, { left: -12, right: 12, top: 14, bottom: -14, near: .5, far: 55 });
  light.shadow.bias = -.00035;
  light.shadow.normalBias = .025;
  light.shadow.radius = 3;
  scene.add(light, new HemisphereLight(0xe6efff, 0xd1d3d6, .85));
  const fill = new DirectionalLight(0xd4e7ff, 1);
  fill.position.set(5, -2, 6);
  scene.add(fill);

  const ivory = new MeshPhysicalMaterial({ color: 0xe3e7e9, roughness: .3, metalness: .12, clearcoat: .25 });
  const pearl = new MeshPhysicalMaterial({ color: 0xa6b6c6, roughness: .24, metalness: .35, clearcoat: .3 });
  const portalSpecs = [
    { w: 7.7, h: 12.5, z: -8, x: .15, y: -.25, rotation: -.10, material: pearl },
    { w: 6.4, h: 10.7, z: -2.5, x: -.18, y: .15, rotation: .055, material: ivory },
    { w: 5.5, h: 9.6, z: 8, x: 0, y: 0, rotation: -.025, material: ivory }
  ];
  for (const spec of portalSpecs) {
    const portal = new Mesh(portalGeometry(spec.w, spec.h, .32, .52), spec.material);
    portal.position.set(spec.x, spec.y, spec.z);
    portal.rotation.z = spec.rotation;
    portal.castShadow = portal.receiveShadow = true;
    scene.add(portal);
  }
  const backWall = new Mesh(new PlaneGeometry(70, 70),
    new MeshStandardMaterial({ color: 0xdfe5e9, roughness: .95 }));
  backWall.position.z = -14;
  backWall.receiveShadow = true;
  scene.add(backWall);

  const paths = new SVGLoader().parse(logoSvg).paths;
  const shapes = paths.flatMap(path => path.toShapes());
  if (!shapes.length) throw new Error('No logo contours');
  const flat = new ExtrudeGeometry(shapes, { depth: 1, bevelEnabled: false, curveSegments: 12 });
  flat.computeBoundingBox();
  const scale = 4.8 / (flat.boundingBox.max.x - flat.boundingBox.min.x);
  flat.dispose();
  const geometry = new ExtrudeGeometry(shapes, {
    depth: .38 / scale, steps: 1, curveSegments: 12,
    bevelEnabled: true, bevelSize: .018 / scale, bevelThickness: .018 / scale, bevelSegments: 3
  });
  geometry.computeBoundingBox();
  const center = geometry.boundingBox.getCenter(new Vector3());
  geometry.translate(-center.x, -center.y, -center.z);
  const face = new MeshPhysicalMaterial({
    color: 0x303b48, metalness: .94, roughness: .21,
    clearcoat: .4, clearcoatRoughness: .12, envMapIntensity: 1.4
  });
  const edge = new MeshPhysicalMaterial({ color: 0xbfcad4, metalness: 1, roughness: .15, envMapIntensity: 1.6 });
  const logo = new Mesh(geometry, [face, edge]);
  logo.scale.set(scale, -scale, scale);
  logo.position.set(0, .1, .8);
  logo.rotation.set(.10, -.23, -.025);
  logo.castShadow = true;
  scene.add(logo);

  function render() {
    placeCamera(camera, poseX, poseY, aspect);
    renderer.render(scene, camera);
    canvas.dataset.pose = `${poseX.toFixed(3)},${poseY.toFixed(3)}`;
  }
  const observer = new ResizeObserver(entries => {
    const { width, height } = entries[0].contentRect;
    if (!width || !height) return;
    aspect = width / height;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, width < 700 ? 1.65 : 2));
    renderer.setSize(width, height, false);
    render();
  });
  observer.observe(stage);
  motion = connectMotion({ stage, activation, status, onPose(x, y) {
    poseX = x; poseY = y;
    render();
  } });
  fallback.hidden = true;
  canvas.hidden = false;
  stage.dataset.state = 'ready';
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    motion.destroy();
    canvas.hidden = true;
    fallback.hidden = false;
    activation.hidden = true;
    stage.dataset.state = 'fallback';
  });
  window.addEventListener('pagehide', event => {
    if (!event.persisted) { observer.disconnect(); dispose(); }
  });
} catch (error) {
  dispose();
  fallback.hidden = false;
  canvas.hidden = true;
  activation.hidden = true;
  stage.dataset.state = 'fallback';
  console.warn('3D view unavailable:', error.message);
}
