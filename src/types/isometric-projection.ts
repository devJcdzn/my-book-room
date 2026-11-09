export type IsometricCamera = { x: number; y: number; zoom: number; rotation?: number };

export function projectRoomPoint(
  point: { x: number; y: number; z: number },
  viewport: { width: number; height: number; originY?: number },
  tile: number,
  camera: IsometricCamera,
) {
  // Match the camera orbit: screen-right is (sin azimuth, 0, -cos azimuth).
  const angle = -(camera.rotation ?? 0);
  const x = point.x * Math.cos(angle) - point.z * Math.sin(angle);
  const z = point.x * Math.sin(angle) + point.z * Math.cos(angle);
  return {
    x: viewport.width / 2 + camera.x + (x - z) * tile * camera.zoom / 2,
    y: (viewport.originY ?? viewport.height / 2) + camera.y + (x + z) * tile * camera.zoom / 4 - point.y * tile * Math.sqrt(3 / 8) * camera.zoom,
  };
}

export function unprojectScreenDelta(dx: number, dy: number, tile: number, zoom: number, rotation = 0) {
  const scale = tile * zoom;
  const x = (dx + 2 * dy) / scale;
  const z = (2 * dy - dx) / scale;
  return { x: x * Math.cos(rotation) - z * Math.sin(rotation), z: x * Math.sin(rotation) + z * Math.cos(rotation) };
}

// Solve movement on the wall plane, including height, using the current camera.
export function unprojectWallDelta(dx: number, dy: number, tile: number, zoom: number, rotation: number, surface: 'back-wall' | 'left-wall') {
  const axis = surface === 'back-wall' ? { x: 1, y: 0, z: 0 } : { x: 0, y: 0, z: 1 };
  const basis = projectRoomPoint(axis, { width: 0, height: 0 }, tile, { x: 0, y: 0, zoom, rotation });
  // A wall viewed edge-on has no usable horizontal drag axis.
  const horizontal = Math.abs(basis.x) > tile * zoom * 0.05 ? dx / basis.x : 0;
  const height = (basis.y * horizontal - dy) / (tile * zoom * Math.sqrt(3 / 8));
  return { horizontal, height };
}
