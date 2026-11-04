const test = require('node:test');
const assert = require('node:assert/strict');

test('portal openings are genuine holes and the rim is solid 3D geometry', async () => {
  const { portalGeometry } = await import('../logo/src/geometry.js');
  const { Mesh, MeshBasicMaterial, DoubleSide, Raycaster, Vector3 } = await import('three');
  const geometry = portalGeometry(4.9, 9.6);
  const material = new MeshBasicMaterial({ side: DoubleSide });
  const portal = new Mesh(geometry, material);
  portal.updateMatrixWorld();
  const center = new Raycaster(new Vector3(0, 0, 4), new Vector3(0, 0, -1));
  const rim = new Raycaster(new Vector3(2.3, 0, 4), new Vector3(0, 0, -1));
  assert.equal(center.intersectObject(portal).length, 0);
  assert(rim.intersectObject(portal).length > 0);
  for (const value of geometry.attributes.position.array) assert(Number.isFinite(value));
  geometry.dispose();
  material.dispose();
});

test('the complete logo fits mobile and desktop cameras at all tilt extremes', async () => {
  const { placeCamera } = await import('../logo/src/geometry.js');
  const { PerspectiveCamera, Vector3, Matrix4, Quaternion, Euler } = await import('three');
  const model = new Matrix4().compose(new Vector3(0, .1, .8),
    new Quaternion().setFromEuler(new Euler(.1, -.23, -.025)), new Vector3(1, 1, 1));
  for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1440, 900]]) {
    const aspect = width / height;
    const camera = new PerspectiveCamera(40, aspect, .1, 100);
    for (const px of [-1, 0, 1]) for (const py of [-1, 0, 1]) {
      placeCamera(camera, px, py, aspect);
      for (const x of [-2.42, 2.42]) for (const y of [-.57, .57]) for (const z of [-.21, .21]) {
        const point = new Vector3(x, y, z).applyMatrix4(model).project(camera);
        assert(Math.abs(point.x) < .9, `${width}x${height} at ${px},${py}: clipped width`);
        assert(Math.abs(point.y) < .9, `${width}x${height} at ${px},${py}: clipped height`);
      }
    }
  }
});

test('a small tilt changes perspective and landscape orientation maps correctly', async () => {
  const { orientationPose } = await import('../logo/src/motion.js');
  const base = { beta: 40, gamma: 0 };
  assert.deepEqual(orientationPose(43, 3, base), { x: .375, y: .375 });
  const rotated = orientationPose(44, 8, base, 90);
  assert(Math.abs(rotated.x - .5) < 1e-10);
  assert.equal(rotated.y, -1);
  const wrapped = orientationPose(-179, 0, { beta: 179, gamma: 0 });
  assert.equal(wrapped.y, .25);
});

test('the nearest portal never obscures the logo at extreme phone tilts', async () => {
  const { placeCamera, portalGeometry } = await import('../logo/src/geometry.js');
  const { PerspectiveCamera, Vector3, Matrix4, Quaternion, Euler, Mesh, MeshBasicMaterial, DoubleSide, Raycaster } = await import('three');
  const portal = new Mesh(portalGeometry(5.5, 9.6, .32, .52), new MeshBasicMaterial({ side: DoubleSide }));
  portal.position.z = 8;
  portal.rotation.z = -.025;
  portal.updateMatrixWorld();
  const model = new Matrix4().compose(new Vector3(0, .1, .8),
    new Quaternion().setFromEuler(new Euler(.1, -.23, -.025)), new Vector3(1, 1, 1));
  for (const aspect of [390 / 844, 320 / 568]) {
    const camera = new PerspectiveCamera(40, aspect, .1, 100);
    for (const px of [-1, 0, 1]) for (const py of [-1, 0, 1]) {
      placeCamera(camera, px, py, aspect);
      for (const x of [-2.42, 2.42]) for (const y of [-.57, .57]) {
        const point = new Vector3(x, y, .21).applyMatrix4(model);
        const direction = point.clone().sub(camera.position);
        const ray = new Raycaster(camera.position, direction.clone().normalize(), 0, direction.length());
        assert.equal(ray.intersectObject(portal).length, 0, `portal clips ${x},${y} at tilt ${px},${py}`);
      }
    }
  }
  portal.geometry.dispose();
  portal.material.dispose();
});
