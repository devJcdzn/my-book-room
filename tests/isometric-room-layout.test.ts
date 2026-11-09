import { useRoomEditor } from '../src/store/room-editor-store';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { captureRoomSnapshot, clearRoomSnapshotCache, registerRoomSnapshotHandler } from '../src/services/room-snapshot-service';
import * as THREE from 'three';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { projectRoomPoint, unprojectScreenDelta, unprojectWallDelta } from '../src/types/isometric-projection';
import {
  PLANT_VARIANTS,
  roomPlantScale,
  roomDeskHeight,
  roomFurnitureScale,
  createDefaultRoomLayout,
  createRestoredRoomLayout,
  isRoomPlacementValid,
  normalizeRoomLayout,
  resizeRoomLayout,
  roomWallHeight,
  nudgeRoomPiece,
  pieceBounds,
  RUG_VARIANTS,
  roomRugSupports,
  snapRoomRotation,
  constrainRoomPieceToWalls,
} from '../src/types/room-layout';

test('version 1 room layouts normalize idempotently into the approved 6-tile collection', () => {
  const legacy = createDefaultRoomLayout({
    leftWallItem: 'poster',
    leftWallPosterBookId: 'book-legacy',
    pictureFramePhotoUri: 'file:///reading-photo.jpg',
  });
  const migrated = normalizeRoomLayout({ ...legacy, version: 1 });
  assert.equal(migrated.version, 2);
  assert.equal(migrated.roomSize, 6);
  assert.equal(migrated.pieces.find(piece => piece.id === 'poster')?.bookId, 'book-legacy');
  assert.equal(migrated.pieces.find(piece => piece.id === 'frame')?.photoUri, 'file:///reading-photo.jpg');
  assert.deepEqual(normalizeRoomLayout(migrated), migrated);
});

test('legacy collection IDs and placement conflicts migrate without dropping furniture', () => {
  const legacy = createDefaultRoomLayout();
  const pieces = legacy.pieces.map(piece => ({
    ...piece,
    modelId: piece.category === 'cat' ? 'cat' : `classic-${piece.category}`,
    ...(piece.id === 'seat' ? { position: legacy.pieces.find(item => item.id === 'desk')!.position } : {}),
  }));
  const migrated = normalizeRoomLayout({ version: 1, pieces });
  assert.ok(migrated.pieces.some(piece => piece.id === 'seat'));
  assert.notDeepEqual(migrated.pieces.find(piece => piece.id === 'seat')?.position, migrated.pieces.find(piece => piece.id === 'desk')?.position);
  assert.ok(migrated.pieces.every(piece => piece.category === 'cat' || piece.modelId.startsWith('isometric-')));
});

test('room expansion keeps floor items and moves wall items while preserving the cat position', () => {
  const room = createDefaultRoomLayout();
  const expanded = resizeRoomLayout(room, 10);
  assert.ok(expanded);
  assert.equal(expanded.roomSize, 10);
  assert.deepEqual(expanded.pieces.find(piece => piece.id === 'desk')?.position, room.pieces.find(piece => piece.id === 'desk')?.position);
  assert.deepEqual(expanded.pieces.find(piece => piece.category === 'cat')?.position, room.pieces.find(piece => piece.category === 'cat')?.position);
  for (const piece of expanded.pieces) assert.equal(isRoomPlacementValid(piece, expanded.pieces, 10), true, piece.id);
});

test('the cat remains reserved and room reduction brings edge furniture inside', () => {
  const room = createDefaultRoomLayout();
  const cat = room.pieces.find(piece => piece.category === 'cat')!;
  const desk = room.pieces.find(piece => piece.category === 'desk')!;
  assert.equal(isRoomPlacementValid({ ...desk, position: cat.position }, room.pieces, room.roomSize), false);
  const expanded = resizeRoomLayout(room, 12)!;
  const edgeFurniture = { ...expanded.pieces.find(piece => piece.id === 'desk')!, position: [5, 0, 0] as [number, number, number] };
  const atEdge = { ...expanded, pieces: expanded.pieces.map(piece => piece.id === 'desk' ? edgeFurniture : piece) };
  const reduced = resizeRoomLayout(atEdge, 6);
  assert.ok(reduced);
  assert.equal(reduced.pieces.length, atEdge.pieces.length);
  assert.ok(reduced.pieces.every(piece => isRoomPlacementValid(piece, reduced.pieces, 6)));
  assert.ok(normalizeRoomLayout(reduced).pieces.every(piece => isRoomPlacementValid(piece, reduced.pieces, 6)));
});

test('the 2:1 projection and inverse recover tile deltas across zoom levels', () => {
  const viewport = { width: 390, height: 844 };
  const camera = { x: 16, y: -9, zoom: 2.5 };
  const tile = 44;
  const origin = projectRoomPoint({ x: 0, y: 0, z: 0 }, viewport, tile, camera);
  assert.equal(projectRoomPoint({ x: 0, y: 0, z: 0 }, { ...viewport, originY: 300 }, tile, { x: 0, y: 0, zoom: 1 }).y, 300);
  const target = projectRoomPoint({ x: 1.5, y: 0, z: -0.5 }, viewport, tile, camera);
  assert.deepEqual(unprojectScreenDelta(target.x - origin.x, target.y - origin.y, tile, camera.zoom), { x: 1.5, z: -0.5 });
});

test('sprites-v2 produces stable runtime assets and a four-second cat loop', async () => {
  const root = join(process.cwd(), 'assets/isometric-room');
  const furniture = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8')) as {
    source: string;
    contract: { tile: number };
    assets: { file: string; key: string; turn: number; width: number; height: number; tilePixels: number; footprint: number[]; pivot: number[]; heightTiles: number; sockets: { photo?: { quad: number[][] } }; runtimeMaskFile: string; lineFile: string; hitMaskFile: string; shadowFile: string; nightFile: string }[];
    cat: { variants: string[]; frames: number; durationSeconds: number; files: { file: string; frame: number; turn: number; width: number; height: number; tilePixels: number; pivot: number[]; nightFile: string; lineFile: string; shadowFile: string; hitMaskFile: string; runtimeMaskFile: string; runtimeMaterials: string[]; sockets: object }[] };
  };
  const cats = JSON.parse(readFileSync(join(root, 'cat-manifest.json'), 'utf8')) as typeof furniture.cat.files;
  const pixelHash = async (file: string) => createHash('sha256')
    .update(await sharp(join(root, file)).ensureAlpha().raw().toBuffer())
    .digest('hex');
  assert.equal(furniture.source, 'output/sprites-v2/manifest.json');
  assert.equal(furniture.contract.tile, 64);
  assert.equal(furniture.assets.length, 36);
  for (const family of ['desk', 'seat', 'bookcase', 'lamp', 'plant', 'rug', 'pillow', 'window', 'frame']) {
    const views = furniture.assets.filter(item => item.key === family);
    assert.deepEqual(views.map(item => item.turn).sort((a, b) => a - b), [0, 90, 180, 270]);
    assert.equal(new Set(await Promise.all(views.map(view => pixelHash(view.file)))).size, 4, `${family} has four source views`);
    for (const view of views) {
      const image = await sharp(join(root, view.file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.equal(image.info.width, view.width, view.file);
      assert.equal(image.info.height, view.height, view.file);
      let left = view.width, top = view.height, right = -1, bottom = -1;
      for (let y = 0; y < view.height; y++) for (let x = 0; x < view.width; x++) {
        if (image.data[(y * view.width + x) * 4 + 3] > 8) {
          left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
        }
      }
      assert.ok(left >= 8 && top >= 8 && view.width - right - 1 >= 8 && view.height - bottom - 1 >= 8, `${view.file} keeps the export margin`);
      for (const file of [view.file, view.nightFile, view.lineFile, view.shadowFile, view.hitMaskFile, view.runtimeMaskFile]) {
        assert.ok(readFileSync(join(root, file)).length > 0, file);
      }
      assert.ok(view.heightTiles > 0);
      assert.ok(view.sockets);
      if (family === 'frame' && view.turn <= 90) {
        const quad = view.sockets.photo?.quad ?? [];
        assert.equal(quad.length, 4, `${view.file} has a projected photo opening`);
        for (const [x, y] of quad) assert.ok(x >= 0 && x <= view.width && y >= 0 && y <= view.height, `${view.file} keeps the photo opening inside its canvas`);
      }
      assert.deepEqual(view.footprint, view.turn % 180 === 0 ? views[0].footprint : [...views[0].footprint].reverse(), family);
      assert.deepEqual(view.pivot, views[0].pivot, family);
      assert.equal(view.width, views[0].width, family);
      assert.equal(view.height, views[0].height, family);
    }
  }
  assert.equal(cats.length, 16);
  assert.ok(cats.every(frame => frame.runtimeMaterials.length === 3));
  assert.ok(cats.every(frame => frame.sockets));
  assert.equal(furniture.cat.frames, 4);
  assert.equal(furniture.cat.durationSeconds, 4);
  assert.deepEqual(furniture.cat.variants, ['orange', 'black', 'gray']);
  assert.deepEqual([...new Set(cats.map(item => item.turn))].sort((a, b) => a - b), [0, 90, 180, 270]);
  for (const turn of [0, 90, 180, 270]) {
    const frames = cats.filter(item => item.turn === turn).sort((a, b) => a.frame - b.frame);
    assert.deepEqual(frames.map(frame => frame.frame), [0, 1, 2, 3]);
    assert.equal(new Set(await Promise.all(frames.map(frame => pixelHash(frame.file)))).size, 4, `cat ${turn}° has four source frames`);
    assert.ok(frames.every(frame => frame.width === frames[0].width && frame.height === frames[0].height));
    assert.ok(frames.every(frame => JSON.stringify(frame.pivot) === JSON.stringify(frames[0].pivot)));
    const bottomRows = await Promise.all(frames.map(async frame => {
      const { data, info } = await sharp(join(root, frame.file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      for (let y = info.height - 1; y >= 0; y--) for (let x = 0; x < info.width; x++) {
        if (data[(y * info.width + x) * 4 + 3] > 8) return y;
      }
      return -1;
    }));
    assert.ok(bottomRows.every(row => row === bottomRows[0]), `cat ${turn}° keeps a stable resting baseline`);
  }
  for (const frame of cats) {
    for (const file of [frame.file, frame.nightFile, frame.lineFile, frame.shadowFile, frame.hitMaskFile, frame.runtimeMaskFile]) {
      assert.ok(readFileSync(join(root, file)).length > 0, file);
    }
  }
  for (const size of [8, 10, 12]) for (const mode of ['day', 'night']) {
    assert.ok(readFileSync(join(root, `seed-${size}-${mode}.png`)).length > 0);
  }
});

test('the new seed has the approved nine pieces and every placement fits 6 by 6', () => {
  const room = createDefaultRoomLayout();
  assert.equal(room.pieces.length, 9);
  assert.equal(room.roomSize, 6);
  assert.deepEqual(room.pieces.map(piece => piece.id).sort(), ['bookcase','cat','desk','desk-plant','frame','lamp','pillow','rug','seat']);
  assert.ok(room.pieces.some(piece => piece.id === 'frame' && piece.aspect === 'square'));
  assert.deepEqual(room.pieces.find(piece => piece.id === 'desk')?.position, [0, 0, -0.25]);
  assert.deepEqual(room.pieces.find(piece => piece.id === 'bookcase')?.position, [1.8, 0, -2.55]);
  assert.deepEqual(room.pieces.find(piece => piece.id === 'lamp')?.position, [-1.9, 0, -1.9]);
  assert.ok(room.pieces.every(piece => isRoomPlacementValid(piece, room.pieces, room.roomSize)), room.pieces.map(piece => piece.id).join(','));
});

test('restoring the seed keeps photo and book links and adds extra photo frames safely', () => {
  const current = createDefaultRoomLayout({ leftWallPosterBookId: 'book-on-wall' });
  current.pieces = current.pieces.map(piece => piece.id === 'frame'
    ? { ...piece, photoUri: 'file:///photo-1.jpg' }
    : piece.id === 'poster' ? { ...piece, bookId: 'book-on-wall' } : piece);
  const baseFrame = current.pieces.find(piece => piece.id === 'frame')!;
  current.pieces.push({ ...baseFrame, id: 'frame-memory', position: [-2.5, 1.5, -3.88], photoUri: 'file:///photo-2.jpg' });
  const restored = createRestoredRoomLayout(current);
  assert.ok(restored);
  assert.equal(restored.pieces.find(piece => piece.id === 'frame')?.photoUri, 'file:///photo-1.jpg');
  assert.equal(restored.pieces.find(piece => piece.id === 'poster')?.bookId, 'book-on-wall');
  assert.equal(restored.pieces.find(piece => piece.id === 'frame-memory')?.photoUri, 'file:///photo-2.jpg');
  assert.ok(restored.pieces.every(piece => isRoomPlacementValid(piece, restored.pieces, restored.roomSize)));
});


test('approved placement coordinates survive saving without half-tile shifts', () => {
  const room = createDefaultRoomLayout();
  const saved = normalizeRoomLayout(room);
  assert.equal(saved.roomSize, 6);
  for (const piece of room.pieces) {
    assert.deepEqual(saved.pieces.find(item => item.id === piece.id)?.position, piece.position, piece.id);
  }
});


test('a moved cat keeps its position after saving and rejects furniture overlap', () => {
  const room = createDefaultRoomLayout();
  const cat = room.pieces.find(piece => piece.category === 'cat')!;
  const moved = { ...cat, position: [-1, 0, 2] as [number, number, number] };
  assert.equal(isRoomPlacementValid(moved, room.pieces, room.roomSize), true);
  room.pieces = room.pieces.map(piece => piece.id === cat.id ? moved : piece);
  assert.deepEqual(normalizeRoomLayout(room).pieces.find(piece => piece.id === cat.id)?.position, moved.position);
  const desk = room.pieces.find(piece => piece.category === 'desk')!;
  assert.equal(isRoomPlacementValid({ ...moved, position: desk.position }, room.pieces, room.roomSize), false);
});


test('desk plants can be removed persistently and added at valid tabletop positions', () => {
  const layout = createDefaultRoomLayout();
  const plant = layout.pieces.find(p => p.id === 'desk-plant')!;
  const remaining = layout.pieces.filter(p => p.id !== plant.id);
  assert.equal(normalizeRoomLayout({ ...layout, pieces: remaining }).pieces.some(p => p.category === 'plant'), false);
  const added = { ...plant, id: 'plant-new', position: [0.5, plant.position[1], -0.2] as [number, number, number] };
  assert.equal(isRoomPlacementValid(added, remaining, 6), true);
  assert.equal(isRoomPlacementValid({ ...added, position: [0.9, plant.position[1], 0] }, remaining, 6), false);
  assert.equal(normalizeRoomLayout({ ...layout, pieces: [...remaining, added] }).pieces.some(p => p.id === added.id), true);
});


test('expanding the room preserves ceiling height at every supported size', () => {
  for (const size of [6, 8, 10, 12]) {
    assert.equal(roomWallHeight(size), roomWallHeight(6));
  }
});


test('horizontal camera orbit projects and unprojects drag coordinates consistently', () => {
  for (const rotation of [-0.6, 0, 0.6]) {
    const camera = { x: 0, y: 0, zoom: 1.5, rotation };
    const viewport = { width: 400, height: 800 };
    const origin = projectRoomPoint({ x: 0, y: 0, z: 0 }, viewport, 64, camera);
    const target = projectRoomPoint({ x: 1.2, y: 0, z: -0.8 }, viewport, 64, camera);
    const delta = unprojectScreenDelta(target.x-origin.x, target.y-origin.y, 64, 1.5, rotation);
    assert.ok(Math.abs(delta.x-1.2) < 1e-10);
    assert.ok(Math.abs(delta.z+0.8) < 1e-10);
  }
});


test('2D cat anchor matches the real orthographic 3D camera throughout its orbit', () => {
  const viewport = { width: 800, height: 900, originY: 580 };
  const tile = 90;
  const ppu = tile / Math.SQRT2;
  for (const rotation of [-0.7, -0.3, 0, 0.3, 0.7]) {
    const camera = new THREE.OrthographicCamera(-viewport.width/ppu/2, viewport.width/ppu/2, viewport.height/ppu/2, -viewport.height/ppu/2, 0.1, 100);
    const azimuth = Math.PI/4 + rotation;
    const target = new THREE.Vector3(-0.5*Math.cos(azimuth), Math.cos(Math.PI/6), -0.5*Math.sin(azimuth)).multiplyScalar((viewport.originY-viewport.height/2)/ppu);
    camera.position.copy(target).add(new THREE.Vector3(24*Math.cos(Math.PI/6)*Math.cos(azimuth), 12, 24*Math.cos(Math.PI/6)*Math.sin(azimuth)));
    camera.lookAt(target);
    camera.updateMatrixWorld();
    for (const point of [{x:0,y:0.09,z:2.5}, {x:1.8,y:0,z:2.1}]) {
      const projected = new THREE.Vector3(point.x,point.y,point.z).project(camera);
      const actual = projectRoomPoint(point,viewport,tile,{x:0,y:0,zoom:1,rotation});
      assert.ok(Math.abs(actual.x-(projected.x+1)*viewport.width/2) < 1e-8);
      assert.ok(Math.abs(actual.y-(1-projected.y)*viewport.height/2) < 1e-8);
    }
  }
});


test('sharing theme captures never overlap and the queue recovers after failure', async () => {
  clearRoomSnapshotCache();
  let active = 0;
  let maximum = 0;
  let calls = 0;
  const unregister = registerRoomSnapshotHandler(async options => {
    calls++;
    active++;
    maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active--;
    if (calls === 1) return null;
    return `file://${options?.ambience}.png`;
  });
  try {
    const result = await Promise.all([captureRoomSnapshot({ambience:'day'}),captureRoomSnapshot({ambience:'night'})]);
    assert.equal(maximum, 1);
    assert.deepEqual(result, [null,'file://night.png']);
    assert.equal(await captureRoomSnapshot({ambience:'day'}), 'file://day.png');
  } finally {
    unregister();
    clearRoomSnapshotCache();
  }
});


test('small plant nudges move precisely and survive saving', () => {
  const layout = createDefaultRoomLayout();
  const plant = layout.pieces.find(piece => piece.category === 'plant')!;
  const moved = nudgeRoomPiece(plant, 'left');
  assert.equal(Math.round((moved.position[0] - plant.position[0]) * 100), -10);
  assert.equal(Math.round((moved.position[2] - plant.position[2]) * 100), 10);
  assert.ok(isRoomPlacementValid(moved, layout.pieces, layout.roomSize));
  const saved = normalizeRoomLayout({ ...layout, pieces: layout.pieces.map(piece => piece.id === plant.id ? moved : piece) });
  assert.deepEqual(saved.pieces.find(piece => piece.id === plant.id)?.position, moved.position);
  assert.deepEqual(nudgeRoomPiece(moved, 'right').position, plant.position);
});

test('Botânica bookcase remains selected after saving and keeps the original footprint', () => {
  const layout = createDefaultRoomLayout();
  const bookcase = layout.pieces.find(piece => piece.category === 'bookcase')!;
  const variant = { ...bookcase, modelId: 'botanic-bookcase' };
  assert.ok(isRoomPlacementValid(variant, layout.pieces, layout.roomSize));
  const saved = normalizeRoomLayout({ ...layout, pieces: layout.pieces.map(piece => piece.id === bookcase.id ? variant : piece) });
  assert.equal(saved.pieces.find(piece => piece.id === bookcase.id)?.modelId, 'botanic-bookcase');
  const bytes = readFileSync(join(process.cwd(), 'output/room-collections/botanic-bookcase.glb'));
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  assert.equal(gltf.nodes.length, 3);
  assert.equal(gltf.meshes.reduce((count: number, mesh: { primitives: unknown[] }) => count + mesh.primitives.length, 0), 3);
  assert.equal(gltf.cameras, undefined);
  assert.equal(gltf.images, undefined);
  assert.ok(bytes.length < 100_000);
});

test('all botanical furniture variants survive saving and export only their own geometry', () => {
  const layout = createDefaultRoomLayout();
  const categories = ['desk', 'seat', 'bookcase', 'lamp', 'rug', 'pillow'];
  const saved = normalizeRoomLayout({ ...layout, pieces: layout.pieces.map(piece => categories.includes(piece.category) ? { ...piece, modelId: `botanic-${piece.category}` } : piece) });
  for (const category of categories) {
    assert.equal(saved.pieces.find(piece => piece.category === category)?.modelId, `botanic-${category}`);
    const bytes = readFileSync(join(process.cwd(), `output/room-collections/botanic-${category}.glb`));
    const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    assert.equal(gltf.nodes.length, 3);
    assert.equal(gltf.images, undefined);
    assert.equal(gltf.cameras, undefined);
    assert.ok(bytes.length < (category === 'seat' ? 160_000 : category === 'desk' ? 140_000 : 100_000));
  }
});

test('frame colors persist while invalid color values are discarded', () => {
  const layout = createDefaultRoomLayout({ pictureFramePhotoUri: 'file:///photo.png' });
  const frame = layout.pieces.find(piece => piece.category === 'frame')!;
  assert.ok(frame);
  const colored = normalizeRoomLayout({ ...layout, pieces: layout.pieces.map(piece => piece.id === frame.id ? { ...piece, color: '#8FAD82' } : piece) });
  assert.equal(colored.pieces.find(piece => piece.id === frame.id)?.color, '#8FAD82');
  const invalid = normalizeRoomLayout({ ...colored, pieces: colored.pieces.map(piece => piece.id === frame.id ? { ...piece, color: 'invalid' } : piece) });
  assert.equal(invalid.pieces.find(piece => piece.id === frame.id)?.color, undefined);
});


test('Library rug shapes persist and use their actual footprints', () => {
  const layout = createDefaultRoomLayout();
  const rug = layout.pieces.find(piece => piece.category === 'rug')!;
  for (const [modelId, width, depth] of [
    ['library-round-rug', 2.4, 2.4], ['library-oval-rug', 3, 2.2], ['library-runner-rug', 3.2, 1.2],
  ] as const) {
    const variant = { ...rug, modelId };
    const saved = normalizeRoomLayout({ ...layout, pieces: layout.pieces.map(piece => piece.id === rug.id ? variant : piece) });
    assert.equal(saved.pieces.find(piece => piece.id === rug.id)?.modelId, modelId);
    const bounds = pieceBounds(variant);
    assert.equal(bounds.max[0] - bounds.min[0], width);
    assert.equal(bounds.max[2] - bounds.min[2], depth);
    assert.ok(roomRugSupports(variant, 0, 0));
    assert.equal(roomRugSupports(variant, width / 2 * .95, depth / 2 * .95), false);
    assert.equal(isRoomPlacementValid({ ...variant, position: [2.4, 0, 0] }, layout.pieces, 6), false);
    const bytes = readFileSync(join(process.cwd(), `output/room-collections/${modelId}.glb`));
    const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    assert.equal(gltf.nodes.length, 2);
    assert.equal(gltf.images, undefined);
    assert.equal(gltf.meshes[0].primitives.length, 3);
    assert.ok(bytes.length < 30_000);
  }
});


test('all collection rug combinations persist without changing their shape footprint', () => {
  const layout = createDefaultRoomLayout();
  const rug = layout.pieces.find(piece => piece.category === 'rug')!;
  assert.equal(RUG_VARIANTS.length, 24);
  assert.equal(new Set(RUG_VARIANTS.map(variant => variant.id)).size, 24);
  for (const variant of RUG_VARIANTS) {
    const piece = { ...rug, modelId: variant.id };
    const saved = normalizeRoomLayout({ ...layout, pieces: layout.pieces.map(other => other.id === rug.id ? piece : other) });
    assert.equal(saved.pieces.find(other => other.id === rug.id)?.modelId, variant.id);
    const bounds = pieceBounds(piece);
    assert.equal(bounds.max[0] - bounds.min[0], variant.size[0]);
    assert.equal(bounds.max[2] - bounds.min[2], variant.size[1]);
    assert.equal(roomRugSupports(piece, variant.size[0] * .48, variant.size[1] * .48), variant.shape === 'rectangle');
  }
});

test('rug theme thumbnails use fixed transparent catalogue dimensions', async () => {
  for (const variant of RUG_VARIANTS) {
    const metadata = await sharp(join(process.cwd(), `output/room-collections/${variant.id}.png`)).metadata();
    assert.equal(metadata.width, 256);
    assert.equal(metadata.height, 256);
    assert.equal(metadata.hasAlpha, true);
  }
});

test('library furniture selections persist with small self-contained GLBs', () => {
  const categories = ['desk', 'seat', 'bookcase', 'lamp', 'pillow', 'window'];
  const layout = createDefaultRoomLayout();
  layout.pieces.push({ ...layout.pieces.find(piece => piece.category === 'frame')!, id: 'window', category: 'window', modelId: 'isometric-window', surface: 'left-wall', position: [-2.94, 1.1, 0.3], rotation: Math.PI / 2 });
  const saved = normalizeRoomLayout({ ...layout, pieces: layout.pieces.map(piece => categories.includes(piece.category) ? { ...piece, modelId: `library-${piece.category}` } : piece) });
  for (const category of categories) {
    assert.equal(saved.pieces.find(piece => piece.category === category)?.modelId, `library-${category}`);
    const bytes = readFileSync(join(process.cwd(), `output/room-collections/library-${category}.glb`));
    const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    assert.equal(gltf.nodes.length, 3);
    assert.equal(gltf.images, undefined);
    assert.equal(gltf.cameras, undefined);
    assert.ok(bytes.length < (category === 'seat' ? 140_000 : category === 'desk' ? 150_000 : 110_000));
  }
  assert.deepEqual(normalizeRoomLayout(saved), saved);
});


test('library armchair occupies its wider footprint when moving and saving', () => {
  const layout = createDefaultRoomLayout();
  const chair = { ...layout.pieces.find(piece => piece.category === 'seat')!, modelId: 'library-seat' };
  assert.ok(isRoomPlacementValid(chair, layout.pieces, layout.roomSize));
  assert.ok(!isRoomPlacementValid({ ...chair, position: [0, 0, 0] }, layout.pieces, layout.roomSize));
  const saved = normalizeRoomLayout({ ...layout, pieces: layout.pieces.map(piece => piece.id === chair.id ? chair : piece) });
  const restored = saved.pieces.find(piece => piece.id === chair.id)!;
  assert.equal(restored.modelId, 'library-seat');
  assert.deepEqual(restored.position, chair.position);
  assert.deepEqual(pieceBounds(restored), { min: [-.46 * .9, 0, -.46 * .9], max: [.46 * .9, 1.45 * .9, .46 * .9] });
});


test('botanical glass window preserves its model, finish and wall footprint', async () => {
  const layout = createDefaultRoomLayout();
  const window = { ...layout.pieces.find(piece => piece.category === 'frame')!, id: 'glass-window', category: 'window' as const, modelId: 'botanic-window', surface: 'left-wall' as const, position: [-2.88, 1.1, .3] as [number, number, number], rotation: Math.PI / 2, color: '#8FAD82' };
  const saved = normalizeRoomLayout({ ...layout, pieces: [...layout.pieces, window] });
  const restored = saved.pieces.find(piece => piece.id === window.id)!;
  assert.equal(restored.modelId, 'botanic-window');
  assert.equal(restored.color, window.color);
  assert.deepEqual(restored.position, window.position);
  assert.deepEqual(pieceBounds(restored), { min: [-.7, 0, -.075], max: [.7, 1.2, .075] });
  const bytes = readFileSync(join(process.cwd(), 'output/room-collections/botanic-window.glb'));
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  assert.equal(gltf.nodes.length, 3);
  assert.equal(gltf.images, undefined);
  assert.ok(gltf.materials.every((material: { alphaMode?: string }) => !material.alphaMode || material.alphaMode === 'OPAQUE'));
  assert.ok(bytes.length < 60_000);
  const preview = await sharp(join(process.cwd(), 'output/room-collections/botanic-window.png')).metadata();
  assert.equal(preview.width, 256);
  assert.equal(preview.height, 256);
});


test('diagonal floor rotations persist and leave clearance from corner walls', () => {
  const layout = createDefaultRoomLayout();
  const seat = layout.pieces.find(piece => piece.category === 'seat')!;
  const diagonal = { ...seat, modelId: 'library-seat', position: [-2.25, 0, -2.25] as [number, number, number], rotation: snapRoomRotation(Math.PI / 4) };
  assert.equal(diagonal.rotation, Math.PI / 4);
  assert.ok(isRoomPlacementValid(diagonal, [diagonal], 6));
  assert.ok(!isRoomPlacementValid({ ...diagonal, position: [-2.55, 0, -2.55] }, [diagonal], 6));
  const saved = normalizeRoomLayout({ ...layout, pieces: layout.pieces.map(piece => piece.id === seat.id ? diagonal : piece.category === 'lamp' ? { ...piece, position: [-1.5, 0, 1.2] as [number, number, number] } : piece) });
  const restored = saved.pieces.find(piece => piece.id === seat.id)!;
  assert.equal(restored.rotation, Math.PI / 4);
  assert.deepEqual(restored.position, diagonal.position);
  assert.equal(snapRoomRotation(-Math.PI / 4), -Math.PI / 4);
  assert.equal(snapRoomRotation(Math.PI / 2), Math.PI / 2);
});


test('oversized movement reaches the actual wall face instead of rejecting the whole step', () => {
  const layout = createDefaultRoomLayout();
  const seat = { ...layout.pieces.find(piece => piece.category === 'seat')!, modelId: 'library-seat' };
  for (const rotation of [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4]) {
    const edge = constrainRoomPieceToWalls({ ...seat, rotation, position: [-9, 0, -9] }, 6);
    assert.ok(isRoomPlacementValid(edge, [edge], 6));
    assert.deepEqual(constrainRoomPieceToWalls(edge, 6), edge);
    assert.ok(!isRoomPlacementValid({ ...edge, position: [edge.position[0] - .005, 0, edge.position[2]] }, [edge], 6));
    const pressed = constrainRoomPieceToWalls(nudgeRoomPiece(edge, 'up'), 6);
    assert.ok(Math.abs(pressed.position[0] - edge.position[0]) < 1e-9);
    assert.ok(Math.abs(pressed.position[2] - edge.position[2]) < 1e-9);
  }
});

test('rotated furniture uses its oriented footprint, allowing separated diagonal pieces', () => {
  const layout = createDefaultRoomLayout();
  const seat = { ...layout.pieces.find(piece => piece.category === 'seat')!, modelId: 'library-seat', rotation: Math.PI / 4, position: [0, 0, 0] as [number, number, number] };
  const second = { ...seat, id: 'second-seat', position: [.75, 0, -.75] as [number, number, number] };
  assert.ok(isRoomPlacementValid(second, [seat, second], 6));
  assert.ok(!isRoomPlacementValid({ ...second, position: [.3, 0, -.3] }, [seat, second], 6));
});


test('the real exported chair and table outlines touch the wall without entering it at every 45 degree angle', async () => {
  const layout = createDefaultRoomLayout();
  for (const [category, modelId] of [['seat', 'library-seat'], ['desk', 'library-desk'], ['seat', 'atelier-seat'], ['desk', 'atelier-desk'], ['seat', 'observatory-seat'], ['desk', 'observatory-desk'], ['bookcase', 'observatory-bookcase'], ['lamp', 'observatory-lamp'], ['bookcase', 'atelier-bookcase'], ['lamp', 'atelier-lamp'], ['desk', 'teahouse-desk'], ['seat', 'teahouse-seat'], ['bookcase', 'teahouse-bookcase'], ['lamp', 'teahouse-lamp'], ...PLANT_VARIANTS.map(plant => ['plant', plant.id] as const)] as const) {
    const bytes = readFileSync(join(process.cwd(), `output/room-collections/${modelId}.glb`));
    const model = (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
    for (let turn = 0; turn < 8; turn++) {
      const piece = constrainRoomPieceToWalls({ ...layout.pieces.find(piece => piece.category === category)!, modelId, surface: "floor", rotation: turn * Math.PI / 4, position: [-9, 0, -9] }, 6);
      model.scale.setScalar(category === "plant" ? roomPlantScale(piece) : roomFurnitureScale(piece));
      model.rotation.y = piece.rotation; model.position.set(...piece.position); model.updateMatrixWorld(true);
      let minX = Infinity, minZ = Infinity;
      model.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const positions = object.geometry.attributes.position;
        for (let index = 0; index < positions.count; index++) {
          const point = new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(object.matrixWorld);
          minX = Math.min(minX, point.x); minZ = Math.min(minZ, point.z);
        }
      });
      for (const minimum of [minX, minZ]) {
        const gap = minimum - (-3 + .055);
        assert.ok(gap > .0015 && gap < .0025, `${modelId}, turn ${turn}, gap ${gap}`);
      }
    }
  }
});

test('atelier furniture selections persist with small self-contained GLBs', () => {
  const categories = ['desk', 'seat', 'bookcase', 'lamp', 'pillow', 'window', 'frame'];
  const layout = createDefaultRoomLayout();
  layout.pieces.push({ ...layout.pieces.find(piece => piece.category === 'frame')!, id: 'window', category: 'window', modelId: 'isometric-window', surface: 'left-wall', position: [-2.94, 1.1, 0.3], rotation: Math.PI / 2 });
  const saved = normalizeRoomLayout({ ...layout, pieces: layout.pieces.map(piece => categories.includes(piece.category) ? { ...piece, modelId: `atelier-${piece.category}` } : piece) });
  for (const category of categories) {
    assert.equal(saved.pieces.find(piece => piece.category === category)?.modelId, `atelier-${category}`);
    const bytes = readFileSync(join(process.cwd(), `output/room-collections/atelier-${category}.glb`));
    const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    assert.equal(gltf.nodes.length, 3);
    assert.equal(gltf.images, undefined);
    assert.equal(gltf.cameras, undefined);
    assert.ok(bytes.length < (category === 'seat' ? 140_000 : category === 'desk' ? 150_000 : 110_000));
  }
  assert.deepEqual(normalizeRoomLayout(saved), saved);
});

test('observatory furniture selections persist with small self-contained GLBs', () => {
  const categories = ['desk', 'seat', 'bookcase', 'lamp', 'pillow', 'window', 'frame'];
  const layout = createDefaultRoomLayout();
  layout.pieces.push({ ...layout.pieces.find(piece => piece.category === 'frame')!, id: 'window', category: 'window', modelId: 'isometric-window', surface: 'left-wall', position: [-2.94, 1.1, 0.3], rotation: Math.PI / 2 });
  const saved = normalizeRoomLayout({ ...layout, pieces: layout.pieces.map(piece => categories.includes(piece.category) ? { ...piece, modelId: `observatory-${piece.category}` } : piece) });
  for (const category of categories) {
    assert.equal(saved.pieces.find(piece => piece.category === category)?.modelId, `observatory-${category}`);
    const bytes = readFileSync(join(process.cwd(), `output/room-collections/observatory-${category}.glb`));
    const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    assert.equal(gltf.nodes.length, 3);
    assert.equal(gltf.images, undefined);
    assert.equal(gltf.cameras, undefined);
    assert.ok(bytes.length < 250_000);
  }
  assert.deepEqual(normalizeRoomLayout(saved), saved);
});


test('plant catalogue models persist on the floor and tabletop with matching scales', async () => {
  for (const plant of PLANT_VARIANTS) {
    for (const surface of ['floor', 'desk'] as const) {
      const layout = createDefaultRoomLayout();
      const source = layout.pieces.find(piece => piece.category === 'plant')!;
      const piece = { ...source, modelId: plant.id, surface, position: (surface === 'desk' ? source.position : [-1.2, 0, 1.5]) as [number, number, number] };
      assert.ok(isRoomPlacementValid(piece, layout.pieces, 6), plant.id + surface);
      const saved = normalizeRoomLayout({ ...layout, pieces: layout.pieces.map(other => other.id === piece.id ? piece : other) });
      const restored = saved.pieces.find(other => other.id === piece.id)!;
      assert.equal(restored.modelId, plant.id);
      assert.equal(restored.surface, surface);
      assert.equal(pieceBounds(restored).max[1], plant.height * roomPlantScale(restored));
      if (surface === 'desk') assert.ok(pieceBounds(restored).max[1] <= .8 + 1e-9);
      assert.deepEqual(normalizeRoomLayout(saved), saved);
    }
    const bytes = readFileSync(join(process.cwd(), `output/room-collections/${plant.id}.glb`));
    const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    assert.equal(gltf.images, undefined);
    assert.ok(bytes.length < 350_000);
    const preview = await sharp(join(process.cwd(), `output/room-collections/${plant.id}.png`)).metadata();
    assert.equal(preview.width, 256);
    assert.equal(preview.hasAlpha, true);
  }
});

test('a missing cat cushion is restored as an editable piece and preserves its model and color', () => {
  const layout = createDefaultRoomLayout();
  const restored = normalizeRoomLayout({ ...layout, pieces: layout.pieces.filter(piece => piece.category !== 'pillow') });
  const cushion = restored.pieces.find(piece => piece.category === 'pillow')!;
  const cat = restored.pieces.find(piece => piece.category === 'cat')!;
  assert.deepEqual(cushion.position, cat.position);
  for (const theme of ['botanic', 'library', 'atelier']) {
    const edited = { ...cushion, modelId: `${theme}-pillow`, color: '#B8735A' };
    assert.ok(isRoomPlacementValid(edited, restored.pieces, 6));
    const saved = normalizeRoomLayout({ ...restored, pieces: restored.pieces.map(piece => piece.id === cushion.id ? edited : piece) });
    const pillow = saved.pieces.find(piece => piece.id === cushion.id)!;
    assert.equal(pillow.modelId, edited.modelId);
    assert.equal(pillow.color, edited.color);
    assert.deepEqual(pillow.position, cat.position);
    assert.deepEqual(normalizeRoomLayout(saved), saved);
  }
});


test('editing and moving the cat cushion updates the real editor piece and supports undo', () => {
  const layout = createDefaultRoomLayout();
  const editor = useRoomEditor.getState();
  editor.begin({ ...layout, pieces: layout.pieces.filter(piece => piece.category !== 'pillow') });
  const pillow = useRoomEditor.getState().draft!.pieces.find(piece => piece.category === 'pillow')!;
  assert.ok(editor.update({ ...pillow, modelId: 'atelier-pillow', color: '#B8735A' }));
  const painted = useRoomEditor.getState().draft!.pieces.find(piece => piece.id === pillow.id)!;
  assert.equal(painted.modelId, 'atelier-pillow');
  assert.ok(editor.update({ ...painted, position: [-1, 0, 1.5] }));
  assert.deepEqual(useRoomEditor.getState().draft!.pieces.find(piece => piece.category === 'cat')!.position, [-1, 0, 1.5]);
  editor.undo();
  assert.deepEqual(useRoomEditor.getState().draft!.pieces.find(piece => piece.category === 'cat')!.position, layout.pieces.find(piece => piece.category === 'cat')!.position);
  assert.equal(useRoomEditor.getState().draft!.pieces.find(piece => piece.id === pillow.id)!.modelId, 'atelier-pillow');
  editor.close();
});


test('plants allow only one per surface in the editor and when restoring older layouts', () => {
  const layout = createDefaultRoomLayout();
  const desk = layout.pieces.find(piece => piece.category === 'plant')!;
  const floor = { ...desk, id: 'floor-plant', surface: 'floor' as const, modelId: 'zz-plant', position: [-1.2, 0, 1.5] as [number, number, number] };
  const secondDesk = { ...desk, id: 'second-desk-plant', position: [-.5, desk.position[1], .2] as [number, number, number] };
  const secondFloor = { ...floor, id: 'second-floor-plant', position: [2, 0, 0] as [number, number, number] };
  assert.ok(!isRoomPlacementValid(secondDesk, layout.pieces, 6));
  assert.ok(isRoomPlacementValid(floor, layout.pieces, 6));
  assert.ok(!isRoomPlacementValid(secondFloor, [...layout.pieces, floor], 6));
  const editor = useRoomEditor.getState();
  editor.begin(layout);
  assert.ok(!editor.add(secondDesk));
  assert.ok(editor.add(floor));
  assert.ok(!editor.add(secondFloor));
  const saved = normalizeRoomLayout({ ...layout, pieces: [...layout.pieces, secondDesk, floor, secondFloor] });
  assert.equal(saved.pieces.filter(piece => piece.category === 'plant' && piece.surface === 'desk').length, 1);
  assert.equal(saved.pieces.filter(piece => piece.category === 'plant' && piece.surface === 'floor').length, 1);
  assert.deepEqual(normalizeRoomLayout(saved), saved);
  editor.close();
});


test('Observatory table retains its finish while the seat remains independently tintable', () => {
  const layout = createDefaultRoomLayout();
  for (const [category, role] of [['desk', 'observatory_top'], ['seat', 'observatory_back']] as const) {
    const source = layout.pieces.find(piece => piece.category === category)!;
    const edited = { ...source, modelId: `observatory-${category}`, color: '#8FAD82' };
    const saved = normalizeRoomLayout({ ...layout, pieces: layout.pieces.map(piece => piece.id === source.id ? edited : piece) });
    assert.equal(saved.pieces.find(piece => piece.id === source.id)?.color, category === 'desk' ? undefined : edited.color);
    const bytes = readFileSync(join(process.cwd(), `output/room-collections/observatory-${category}.glb`));
    const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    assert.ok(gltf.materials.some((material: { name: string }) => material.name.startsWith(role)));
    assert.ok(gltf.materials.some((material: { name: string }) => material.name.startsWith('observatory_wood')));
    const restored = normalizeRoomLayout({ ...saved, pieces: saved.pieces.map(piece => piece.id === source.id ? { ...piece, color: undefined } : piece) });
    assert.equal(restored.pieces.find(piece => piece.id === source.id)?.color, undefined);
  }
});


test('plant pot colors persist independently from plant type and placement', () => {
  const layout = createDefaultRoomLayout();
  const source = layout.pieces.find(piece => piece.category === 'plant')!;
  for (const plant of PLANT_VARIANTS) {
    const edited = { ...source, modelId: plant.id, color: '#34465E' };
    const saved = normalizeRoomLayout({ ...layout, pieces: layout.pieces.map(piece => piece.id === source.id ? edited : piece) });
    const restored = saved.pieces.find(piece => piece.id === source.id)!;
    assert.equal(restored.modelId, plant.id);
    assert.equal(restored.color, edited.color);
    assert.deepEqual(restored.position, edited.position);
    const bytes = readFileSync(join(process.cwd(), `output/room-collections/${plant.id}.glb`));
    const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    assert.ok(gltf.materials.some((material: { name: string }) => /^plant_(pot|clay)/.test(material.name)));
    assert.ok(gltf.materials.some((material: { name: string }) => material.name.startsWith('plant_leaf')));
  }
});


test('tables and bookcases restore collection materials while upholstery stays customizable', () => {
  const layout = createDefaultRoomLayout();
  const saved = normalizeRoomLayout({ ...layout, pieces: layout.pieces.map(piece => ({ ...piece, color: '#EBDDC1' })) });
  for (const category of ['desk', 'bookcase']) assert.equal(saved.pieces.find(piece => piece.category === category)?.color, undefined);
  assert.equal(saved.pieces.find(piece => piece.category === 'seat')?.color, '#EBDDC1');
});

test('teahouse furniture selections persist with small self-contained GLBs', () => {
  const categories = ['desk', 'seat', 'bookcase', 'lamp', 'pillow', 'window', 'frame'];
  const layout = createDefaultRoomLayout();
  layout.pieces.push({ ...layout.pieces.find(piece => piece.category === 'frame')!, id: 'window', category: 'window', modelId: 'isometric-window', surface: 'left-wall', position: [-2.94, 1.1, 0.3], rotation: Math.PI / 2 });
  const saved = normalizeRoomLayout({ ...layout, pieces: layout.pieces.map(piece => categories.includes(piece.category) ? { ...piece, modelId: `teahouse-${piece.category}` } : piece) });
  for (const category of categories) {
    assert.equal(saved.pieces.find(piece => piece.category === category)?.modelId, `teahouse-${category}`);
    const bytes = readFileSync(join(process.cwd(), `output/room-collections/teahouse-${category}.glb`));
    const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    assert.equal(gltf.nodes.length, 3);
    assert.equal(gltf.images, undefined);
    assert.equal(gltf.cameras, undefined);
    assert.ok(bytes.length < 250_000);
  }
  assert.deepEqual(normalizeRoomLayout(saved), saved);
});

test('low tea table keeps its plant supported when switching collections and reloading', () => {
  const layout = createDefaultRoomLayout();
  const desk = layout.pieces.find(piece => piece.category === 'desk')!;
  useRoomEditor.getState().begin(layout);
  assert.ok(useRoomEditor.getState().update({ ...desk, modelId: 'teahouse-desk' }));
  const edited = useRoomEditor.getState().draft!;
  const expected = roomDeskHeight('teahouse-desk') * Math.sqrt(2 / 3);
  assert.equal(edited.pieces.find(piece => piece.surface === 'desk')!.position[1], expected);
  assert.equal(normalizeRoomLayout(edited).pieces.find(piece => piece.surface === 'desk')!.position[1], expected);
  assert.ok(useRoomEditor.getState().update(desk));
  assert.equal(useRoomEditor.getState().draft!.pieces.find(piece => piece.surface === 'desk')!.position[1], roomDeskHeight(desk.modelId) * Math.sqrt(2 / 3));
  useRoomEditor.getState().close();
});


test('book covers migrate from frames to fixed portrait posters while gallery photos stay framed', () => {
  const layout = createDefaultRoomLayout();
  const frame = layout.pieces.find(piece => piece.category === 'frame')!;
  const migrated = normalizeRoomLayout({ ...layout, pieces: layout.pieces.map(piece => piece.id === frame.id ? { ...piece, bookId: 'completed-book', color: '#FF0000' } : piece) });
  const poster = migrated.pieces.find(piece => piece.id === frame.id)!;
  assert.equal(poster.category, 'poster');
  assert.equal(poster.modelId, 'isometric-poster');
  assert.equal(poster.aspect, 'portrait');
  assert.equal(poster.bookId, 'completed-book');
  assert.equal(poster.color, undefined);
  const bounds = pieceBounds(poster);
  assert.equal((bounds.max[0] - bounds.min[0]) / (bounds.max[1] - bounds.min[1]), 0.5);
  assert.deepEqual(normalizeRoomLayout(migrated), migrated);
  const photoLayout = normalizeRoomLayout({ ...layout, pieces: layout.pieces.map(piece => piece.id === frame.id ? { ...piece, photoUri: 'file:///gallery.jpg' } : piece) });
  assert.equal(photoLayout.pieces.find(piece => piece.id === frame.id)?.category, 'frame');
  assert.equal(photoLayout.pieces.find(piece => piece.id === frame.id)?.photoUri, 'file:///gallery.jpg');
  assert.ok(createRestoredRoomLayout(migrated)?.pieces.some(piece => piece.category === 'poster' && piece.bookId === 'completed-book'));
});

test('posters have no quantity cap in editing or persisted layouts', () => {
  const layout = resizeRoomLayout(createDefaultRoomLayout(), 12)!;
  useRoomEditor.getState().begin(layout);
  let count = 0;
  for (const surface of ['back-wall', 'left-wall'] as const) {
    for (const y of [0.2, 1.6]) for (let column = 0; column < 16; column++) {
      const along = -5.5 + column * 0.65;
      const poster = { id: `poster-${count}`, category: 'poster' as const, modelId: 'isometric-poster', finish: 'original' as const,
        aspect: 'portrait' as const, surface, rotation: surface === 'left-wall' ? Math.PI / 2 : 0,
        position: (surface === 'back-wall' ? [along, y, -5.88] : [-5.88, y, along]) as [number, number, number] };
      if (isRoomPlacementValid(poster, useRoomEditor.getState().draft!.pieces, 12)) {
        assert.equal(useRoomEditor.getState().add(poster), true);
        count++;
      }
    }
  }
  assert.ok(count > 40);
  const saved = normalizeRoomLayout(useRoomEditor.getState().draft);
  assert.equal(saved.pieces.filter(piece => piece.category === 'poster').length, count);
  assert.deepEqual(normalizeRoomLayout(saved), saved);
  useRoomEditor.getState().close();
});


test('wall dragging recovers horizontal and height movement at different camera angles', () => {
  for (const surface of ['back-wall', 'left-wall'] as const) {
    for (const rotation of [0, 0.3, 1.2]) {
      const delta = projectRoomPoint({ x: surface === 'back-wall' ? 0.2 : 0, y: 0.1, z: surface === 'left-wall' ? 0.2 : 0 }, { width: 0, height: 0 }, 80, { x: 0, y: 0, zoom: 1.6, rotation });
      const recovered = unprojectWallDelta(delta.x, delta.y, 80, 1.6, rotation, surface);
      assert.ok(Math.abs(recovered.horizontal - 0.2) < 1e-10);
      assert.ok(Math.abs(recovered.height - 0.1) < 1e-10);
    }
  }
});

test('wall subtile nudges preserve height and horizontal placement after saving', () => {
  const layout = createDefaultRoomLayout();
  const frame = layout.pieces.find(item => item.category === 'frame')!;
  const window = { ...frame, id: 'window', category: 'window' as const, modelId: 'isometric-window', surface: 'left-wall' as const, rotation: Math.PI / 2, position: [-2.88, 1, 0.5] as [number, number, number] };
  layout.pieces.push(window);
  for (const piece of [frame, window]) {
    const moved = nudgeRoomPiece(nudgeRoomPiece(piece, 'up'), 'right');
    assert.equal(Math.round((moved.position[1] - piece.position[1]) * 100), 10);
    const axis = piece.surface === 'back-wall' ? 0 : 2;
    assert.equal(Math.round(Math.abs(moved.position[axis] - piece.position[axis]) * 100), 10);
    const saved = normalizeRoomLayout({ ...layout, pieces: layout.pieces.map(item => item.id === piece.id ? moved : item) });
    assert.deepEqual(saved.pieces.find(item => item.id === piece.id)?.position, moved.position);
  }
});
