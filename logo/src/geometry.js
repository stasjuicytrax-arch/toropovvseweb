import { Shape, Path, ExtrudeGeometry, MathUtils, Vector3 } from 'three';

function roundedPath(path, width, height, radius) {
  const x = -width / 2, y = -height / 2, r = radius;
  path.moveTo(x + r, y);
  path.lineTo(x + width - r, y);
  path.quadraticCurveTo(x + width, y, x + width, y + r);
  path.lineTo(x + width, y + height - r);
  path.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  path.lineTo(x + r, y + height);
  path.quadraticCurveTo(x, y + height, x, y + height - r);
  path.lineTo(x, y + r);
  path.quadraticCurveTo(x, y, x + r, y);
  return path;
}

export function portalGeometry(width, height, rim = .32, depth = .48) {
  const shape = roundedPath(new Shape(), width, height, Math.min(width, height) * .3);
  const opening = roundedPath(new Path(), width - rim * 2, height - rim * 2,
    Math.min(width, height) * .3 - rim);
  shape.holes.push(opening);
  const geometry = new ExtrudeGeometry(shape, {
    depth, steps: 1, bevelEnabled: true, bevelSize: .065,
    bevelThickness: .065, bevelSegments: 3, curveSegments: 20
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

export function cameraDistance(aspect, fov = 40) {
  return Math.max(12, 7 / (2 * Math.tan(MathUtils.degToRad(fov / 2)) * aspect));
}

export function placeCamera(camera, x, y, aspect) {
  const distance = cameraDistance(aspect, camera.fov);
  const travel = aspect < .8 ? 1.45 : 1.1;
  camera.position.set(x * travel + .28, y * .95 + .22, distance);
  camera.lookAt(new Vector3(0, 0, .2));
  camera.updateMatrixWorld();
}
