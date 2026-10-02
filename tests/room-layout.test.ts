import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { createDefaultRoomLayout, isRoomPlacementValid, normalizeRoomLayout, transformRoomPoint, DESK_ORIGIN, BOOKCASE_ORIGIN } from '../src/types/room-layout';
import { useRoomEditor } from '../src/store/room-editor-store';
import { createCloudLibrarySnapshot } from '../src/services/library-sync';
import { getCurrentLibrarySnapshot, normalizePersistedState, useLibraryStore } from '../src/store/library-store';

test('legacy room migrates models and preserves photos and poster independently',()=>{
  const layout=normalizeRoomLayout(undefined,{leftWallItem:'poster',leftWallPosterBookId:'book-1',pictureFramePhotoUri:'file:///photo.jpg'});
  assert.equal(layout.pieces.length,9);
  assert.equal(layout.pieces.find(p=>p.id==='frame')?.photoUri,'file:///photo.jpg');
  assert.equal(layout.pieces.find(p=>p.id==='poster')?.bookId,'book-1');
  assert.deepEqual(normalizeRoomLayout(layout),layout);
  for(const piece of layout.pieces) assert.equal(isRoomPlacementValid(piece,layout.pieces),true,piece.id);
});
test('placement rejects collisions and walls but allows the rug under furniture',()=>{
  const {pieces}=createDefaultRoomLayout();
  const desk=pieces.find(p=>p.id==='desk')!;
  assert.equal(isRoomPlacementValid({...desk,position:[3,0,3]},pieces),false);
  assert.equal(isRoomPlacementValid({...desk,position:[-2.3,0,-1.1]},pieces),false);
  assert.equal(isRoomPlacementValid(desk,pieces),true);
  const frame=pieces.find(p=>p.id==='frame')!;
  assert.equal(isRoomPlacementValid({...frame,position:[0,3.4,-3.53]},pieces),false);
  assert.equal(isRoomPlacementValid({...frame,id:'duplicate'},pieces),false);
});
test('editor cancels without persisting and keeps the last valid position',()=>{
  const saved=createDefaultRoomLayout();
  useRoomEditor.getState().begin(saved);
  const desk=saved.pieces.find(p=>p.id==='desk')!;
  assert.equal(useRoomEditor.getState().update({...desk,position:[0,0,0]}),true);
  assert.equal(useRoomEditor.getState().update({...desk,position:[9,0,0]}),false);
  assert.deepEqual(useRoomEditor.getState().draft?.pieces.find(p=>p.id==='desk')?.position,[0,0,0]);
  assert.notDeepEqual(saved.pieces.find(p=>p.id==='desk')?.position,[0,0,0]);
  useRoomEditor.getState().close();
  assert.equal(useRoomEditor.getState().draft,null);
});
test('books follow rotated desk and shelf anchors',()=>{
  const layout=createDefaultRoomLayout();
  const desk={...layout.pieces.find(p=>p.id==='desk')!,position:[1,0,1] as [number,number,number],rotation:Math.PI/2};
  const result=transformRoomPoint([DESK_ORIGIN[0]+1,1.2,DESK_ORIGIN[2]],desk,DESK_ORIGIN);
  assert.ok(Math.abs(result[0]-1)<1e-9);
  assert.ok(Math.abs(result[2])<1e-9);
  const shelf=layout.pieces.find(p=>p.id==='bookcase')!;
  assert.equal(transformRoomPoint([1.45,.48,-2.61],shelf,BOOKCASE_ORIGIN)[1],.48);
});
test('snapshot stores layout; cloud strips all local frame photos',()=>{
  const state=normalizePersistedState({roomLayout:createDefaultRoomLayout({pictureFramePhotoUri:'file:///private/photo.jpg'})});
  useLibraryStore.setState(state);
  const snapshot=getCurrentLibrarySnapshot();
  assert.equal(snapshot.roomLayout?.pieces.find(p=>p.id==='frame')?.photoUri,'file:///private/photo.jpg');
  assert.equal(JSON.stringify(createCloudLibrarySnapshot(snapshot)).includes('file:///'),false);
  assert.deepEqual(normalizePersistedState(snapshot).roomLayout,snapshot.roomLayout);
});
test('invalid saved pieces recover required furniture',()=>{
  const layout=normalizeRoomLayout({pieces:[{id:'broken',category:'desk',modelId:'natural-desk',surface:'floor',finish:'original',position:[NaN,0,0],rotation:0}]});
  assert.ok(layout.pieces.some(p=>p.id==='desk'));
  assert.ok(layout.pieces.every(p=>p.position.every(Number.isFinite)));
});
test('24 original GLBs have embedded geometry, fit budgets and omit the startup cube',()=>{
  const root=new URL('../assets/room-collection/',import.meta.url);
  const models=readdirSync(root).filter(name=>name.endsWith('.glb'));
  assert.equal(models.length,24);
  for(const name of models){
    const data=readFileSync(new URL(name,root));
    assert.equal(data.readUInt32LE(0),0x46546c67);
    assert.ok(data.length<=1_000_000,name);
    const gltf=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());
    assert.ok(!gltf.nodes.some((n:{name:string})=>n.name==='Cube'),name);
    assert.ok(gltf.buffers.every((b:{uri?:string})=>!b.uri),name);
    const triangles=gltf.meshes.flatMap((m:{primitives:{indices:number}[]})=>m.primitives).reduce((sum:number,p:{indices:number})=>sum+gltf.accessors[p.indices].count/3,0);
    assert.ok(triangles<=15_000,`${name}: ${triangles}`);
    assert.ok(readFileSync(new URL(name.replace('.glb','.png'),root)).length>0);
  }
});

test('editor limits additional decoration and protects functional furniture',()=>{
  const layout=createDefaultRoomLayout();
  useRoomEditor.getState().begin(layout);
  useRoomEditor.getState().remove('desk');
  assert.ok(useRoomEditor.getState().draft?.pieces.some(p=>p.id==='desk'));
  const frame=layout.pieces.find(p=>p.id==='frame')!;
  const extras=Array.from({length:8},(_,i)=>({...frame,id:`extra-${i}`,position:[-2.5+i*.7,2,-3.53] as [number,number,number]}));
  useRoomEditor.setState({draft:{version:1,pieces:[...layout.pieces,...extras]}});
  assert.equal(useRoomEditor.getState().add({...frame,id:'extra-9',position:[0,.8,-3.53]}),false);
  useRoomEditor.getState().restore();
  assert.deepEqual(useRoomEditor.getState().draft,createDefaultRoomLayout());
  useRoomEditor.getState().close();
});
test('missing furniture never leaves an incomplete room after recovery',()=>{
  const layout=createDefaultRoomLayout();
  const saved={version:1,pieces:layout.pieces.filter(p=>p.category!=='bookcase').map(p=>p.category==='desk'?{...p,position:[1.5,0,-2.5]}:p)};
  const recovered=normalizeRoomLayout(saved);
  for(const category of ['desk','seat','bookcase','lamp','rug']) assert.ok(recovered.pieces.some(p=>p.category===category),category);
});

test('undo and redo preserve layouts and keep the saved room untouched', () => {
  const saved = createDefaultRoomLayout();
  const editor = useRoomEditor.getState();
  editor.begin(saved);
  const desk = saved.pieces.find(p => p.id === 'desk')!;
  editor.update({ ...desk, finish: 'walnut' });
  editor.update({ ...desk, finish: 'sage' });
  editor.undo();
  assert.equal(useRoomEditor.getState().draft?.pieces.find(p => p.id === 'desk')?.finish, 'walnut');
  editor.undo();
  assert.deepEqual(useRoomEditor.getState().draft, saved);
  editor.redo();
  assert.equal(useRoomEditor.getState().draft?.pieces.find(p => p.id === 'desk')?.finish, 'walnut');
  assert.equal(saved.pieces.find(p => p.id === 'desk')?.finish, 'original');
  editor.update({ ...desk, finish: 'oak' });
  assert.equal(useRoomEditor.getState().future.length, 0);
  editor.close();
  assert.equal(useRoomEditor.getState().past.length, 0);
});

test('a continuous gesture creates one undo step and excludes invalid movement', () => {
  const saved = createDefaultRoomLayout();
  const editor = useRoomEditor.getState();
  editor.begin(saved);
  const desk = saved.pieces.find(p => p.id === 'desk')!;
  editor.beginMove();
  editor.update({ ...desk, position: [0.3, 0, 0.5] });
  editor.update({ ...desk, position: [0.2, 0, 0.4] });
  assert.equal(editor.update({ ...desk, position: [99, 0, 99] }), false);
  editor.endMove();
  assert.equal(useRoomEditor.getState().past.length, 1);
  editor.undo();
  assert.deepEqual(useRoomEditor.getState().draft, saved);
  editor.redo();
  assert.deepEqual(useRoomEditor.getState().draft?.pieces.find(p => p.id === 'desk')?.position, [0.2, 0, 0.4]);
  editor.close();
});

test('removal and restore are undoable and selection stays valid', () => {
  const saved = createDefaultRoomLayout();
  const editor = useRoomEditor.getState();
  editor.begin(saved);
  editor.select('frame');
  editor.remove('frame');
  assert.ok(!useRoomEditor.getState().draft?.pieces.some(p => p.id === 'frame'));
  editor.undo();
  assert.ok(useRoomEditor.getState().draft?.pieces.some(p => p.id === 'frame'));
  const desk = saved.pieces.find(p => p.id === 'desk')!;
  editor.update({ ...desk, finish: 'walnut' });
  editor.restore();
  editor.undo();
  assert.equal(useRoomEditor.getState().draft?.pieces.find(p => p.id === 'desk')?.finish, 'walnut');
  editor.close();
});

test('precise movement follows the fixed camera and keeps each surface anchored', async () => {
  const { nudgeRoomPiece } = await import('../src/types/room-layout');
  const saved = createDefaultRoomLayout();
  const desk = saved.pieces.find(p => p.id === 'desk')!;
  assert.deepEqual(nudgeRoomPiece(desk, 'left').position, [0.3, 0, 0.7]);
  assert.deepEqual(nudgeRoomPiece(nudgeRoomPiece(desk, 'left'), 'right').position, desk.position);
  const frame = saved.pieces.find(p => p.id === 'frame')!;
  assert.deepEqual(nudgeRoomPiece(frame, 'up').position, [-1, 2.2, -3.53]);
  const leftFrame = { ...frame, surface: 'left-wall' as const, position: [-3.43, 2, 0.5] as [number, number, number] };
  assert.deepEqual(nudgeRoomPiece(leftFrame, 'left', 0.5).position, [-3.43, 2, 1]);
  const plant = saved.pieces.find(p => p.id === 'desk-plant')!;
  assert.deepEqual(nudgeRoomPiece(plant, 'up'), plant);
});

test('existing rooms gain a movable cat without losing wall images or furniture', () => {
  const saved = createDefaultRoomLayout({ leftWallItem: 'poster', leftWallPosterBookId: 'book-cover', pictureFramePhotoUri: 'file:///photo.jpg' });
  const old = { ...saved, pieces: saved.pieces.filter(p => p.category !== 'cat') };
  const migrated = normalizeRoomLayout(old);
  for (const piece of old.pieces) assert.deepEqual(migrated.pieces.find(p => p.id === piece.id), piece);
  const cat = migrated.pieces.find(p => p.category === 'cat')!;
  assert.ok(isRoomPlacementValid(cat, migrated.pieces));
  const editor = useRoomEditor.getState();
  editor.begin(migrated);
  assert.equal(editor.update({ ...cat, position: [2.5, 0, 1.8] }), true);
  const moved = useRoomEditor.getState().draft!;
  assert.deepEqual(normalizeRoomLayout(moved).pieces.find(p => p.category === 'cat')?.position, [2.5, 0, 1.8]);
  editor.undo();
  assert.deepEqual(useRoomEditor.getState().draft?.pieces.find(p => p.category === 'cat'), cat);
  editor.remove(cat.id);
  assert.ok(useRoomEditor.getState().draft?.pieces.some(p => p.category === 'cat'));
  editor.close();
});

test('legacy cat placement finds a free spot without resetting rearranged furniture', () => {
  const saved = createDefaultRoomLayout();
  const pieces = saved.pieces.filter(p => p.category !== 'cat').map(p => p.category === 'desk' ? { ...p, position: [2.1, 0, 0.8] as [number, number, number] } : p);
  const migrated = normalizeRoomLayout({ version: 1, pieces });
  assert.deepEqual(migrated.pieces.find(p => p.id === 'desk')?.position, [2.1, 0, 0.8]);
  assert.ok(isRoomPlacementValid(migrated.pieces.find(p => p.category === 'cat')!, migrated.pieces));
});

test('camera gestures allow normal rotation and pinch while isolating piece dragging', async () => {
  const { shouldHandleRoomCameraGesture } = await import('../src/store/room-editor-store');
  assert.equal(shouldHandleRoomCameraGesture(false, false, 1, 20, 2), true);
  assert.equal(shouldHandleRoomCameraGesture(false, false, 2, 0, 0), true);
  assert.equal(shouldHandleRoomCameraGesture(false, false, 1, 2, 20), false);
  assert.equal(shouldHandleRoomCameraGesture(true, false, 1, 20, 2), false);
  assert.equal(shouldHandleRoomCameraGesture(true, false, 2, 0, 0), true);
  assert.equal(shouldHandleRoomCameraGesture(true, true, 1, 20, 2), true);
  const editor = useRoomEditor.getState();
  editor.begin(createDefaultRoomLayout());
  editor.setCameraMode(true);
  editor.select('cat');
  assert.equal(useRoomEditor.getState().cameraMode, false);
  editor.close();
});


test('appearance preview stays in the editor until saving and is discarded on cancel', () => {
  const editor = useRoomEditor.getState();
  const saved = useLibraryStore.getState();
  const appearance = {
    wallPaletteId: saved.wallPaletteId,
    floorPaletteId: saved.floorPaletteId,
    rugPaletteId: saved.rugPaletteId,
    catId: saved.catId,
  };
  editor.begin(saved.roomLayout, appearance);
  editor.setAppearance({ wallPaletteId: 'preview-wall', catId: 'gray-catnap' });
  assert.equal(useRoomEditor.getState().appearance?.wallPaletteId, 'preview-wall');
  assert.equal(useLibraryStore.getState().wallPaletteId, appearance.wallPaletteId);
  assert.equal(useLibraryStore.getState().catId, appearance.catId);
  assert.equal(appearance.wallPaletteId, saved.wallPaletteId);
  editor.close();
  assert.equal(useRoomEditor.getState().appearance, null);
  editor.begin(saved.roomLayout, appearance);
  assert.deepEqual(useRoomEditor.getState().appearance, appearance);
  editor.close();
});
