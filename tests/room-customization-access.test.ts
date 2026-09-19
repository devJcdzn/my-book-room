import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FREE_ROOM_CUSTOMIZATION_IDS,
  isFreeRoomOption,
  resolveRoomCustomization,
  resolveRoomOptionId,
} from '../src/services/room-customization-access';
import {
  DEFAULT_BOOKCASE_PALETTE_ID,
  DEFAULT_CAT_ID,
  DEFAULT_FLOOR_PALETTE_ID,
  DEFAULT_PICTURE_FRAME_STYLE_ID,
  DEFAULT_POSTER_FRAME_ID,
  DEFAULT_RUG_PALETTE_ID,
  DEFAULT_WALL_PALETTE_ID,
  DEFAULT_WINDOW_STYLE_ID,
} from '../src/types/room-customization';
import { PICTURE_FRAME_STYLES, POSTER_FRAME_OPTIONS } from '../src/types/room-customization';

const snapshot = {
  wallPaletteId: 'sage-green',
  floorPaletteId: 'dark-walnut',
  rugPaletteId: 'sage-botanic',
  bookcasePaletteId: 'golden-oak',
  catId: 'black-catnap',
  leftWallWindowStyle: 'golden-oak',
  leftWallFrameColor: 'antique-gold',
  pictureFrameStyleId: 'natural-oak',
  pictureFramePhotoUri: 'file:///private/photo.jpg',
};

test('allowlist Free mantém exatamente o pacote inicial aprovado', () => {
  assert.deepEqual(FREE_ROOM_CUSTOMIZATION_IDS.walls, ['antique-parchment', 'warm-sand', 'nocturne-slate']);
  assert.deepEqual(FREE_ROOM_CUSTOMIZATION_IDS.flooring, ['nordic-birch', 'golden-oak', 'smoked-ebony']);
  assert.deepEqual(FREE_ROOM_CUSTOMIZATION_IDS.rug, ['natural-linen', 'terracotta-classic', 'soft-slate']);
  assert.deepEqual(FREE_ROOM_CUSTOMIZATION_IDS.bookcase, ['provencal-white', 'rustic-mahogany', 'nocturne-ebony']);
  assert.deepEqual(FREE_ROOM_CUSTOMIZATION_IDS.window, ['provencal-white', 'rustic-mahogany', 'nocturne-ebony']);
  assert.deepEqual(FREE_ROOM_CUSTOMIZATION_IDS.cat, ['catnap-orange']);
  assert.deepEqual(FREE_ROOM_CUSTOMIZATION_IDS.frame, ['studio-white', 'classic-walnut', 'gallery-black']);
  for (const frameId of FREE_ROOM_CUSTOMIZATION_IDS.frame) {
    assert.ok(POSTER_FRAME_OPTIONS.some((frame) => frame.id === frameId));
    assert.ok(PICTURE_FRAME_STYLES.some((frame) => frame.id === frameId));
  }
});

test('padrões atuais são Free e IDs novos ou não permitidos são Pro', () => {
  assert.equal(resolveRoomOptionId('walls', DEFAULT_WALL_PALETTE_ID, false), DEFAULT_WALL_PALETTE_ID);
  assert.equal(resolveRoomOptionId('flooring', DEFAULT_FLOOR_PALETTE_ID, false), DEFAULT_FLOOR_PALETTE_ID);
  assert.equal(resolveRoomOptionId('rug', DEFAULT_RUG_PALETTE_ID, false), DEFAULT_RUG_PALETTE_ID);
  assert.equal(resolveRoomOptionId('bookcase', DEFAULT_BOOKCASE_PALETTE_ID, false), DEFAULT_BOOKCASE_PALETTE_ID);
  assert.equal(resolveRoomOptionId('window', DEFAULT_WINDOW_STYLE_ID, false), DEFAULT_WINDOW_STYLE_ID);
  assert.equal(resolveRoomOptionId('cat', DEFAULT_CAT_ID, false), DEFAULT_CAT_ID);
  assert.equal(resolveRoomOptionId('frame', DEFAULT_POSTER_FRAME_ID, false), DEFAULT_POSTER_FRAME_ID);
  assert.equal(resolveRoomOptionId('frame', DEFAULT_PICTURE_FRAME_STYLE_ID, false), DEFAULT_PICTURE_FRAME_STYLE_ID);
  assert.equal(isFreeRoomOption('frame', 'studio-white'), true);
  assert.equal(isFreeRoomOption('frame', 'natural-oak'), false);
  assert.equal(isFreeRoomOption('walls', 'future-wall'), false);
});

test('resolver mascara valores premium no render Free sem alterar o snapshot bruto', () => {
  const free = resolveRoomCustomization(snapshot, false);

  assert.equal(free.wallPaletteId, DEFAULT_WALL_PALETTE_ID);
  assert.equal(free.floorPaletteId, DEFAULT_FLOOR_PALETTE_ID);
  assert.equal(free.rugPaletteId, DEFAULT_RUG_PALETTE_ID);
  assert.equal(free.bookcasePaletteId, DEFAULT_BOOKCASE_PALETTE_ID);
  assert.equal(free.catId, DEFAULT_CAT_ID);
  assert.equal(free.leftWallWindowStyle, DEFAULT_WINDOW_STYLE_ID);
  assert.equal(free.leftWallFrameColor, DEFAULT_POSTER_FRAME_ID);
  assert.equal(free.pictureFrameStyleId, DEFAULT_PICTURE_FRAME_STYLE_ID);
  assert.equal(free.pictureFramePhotoUri, null);
  assert.equal(snapshot.wallPaletteId, 'sage-green');
  assert.equal(snapshot.pictureFramePhotoUri, 'file:///private/photo.jpg');
});

test('resolver Pro preserva todas as escolhas, inclusive a foto local', () => {
  assert.deepEqual(resolveRoomCustomization(snapshot, true), snapshot);
});
