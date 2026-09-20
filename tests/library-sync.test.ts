import assert from 'node:assert/strict';
import test from 'node:test';

import { createCloudLibrarySnapshot, normalizeCloudLibrarySnapshot } from '../src/services/library-sync';
import { createPersistedState, isDefaultLibrarySnapshot } from '../src/store/library-store';
import {
  DEFAULT_BOOKCASE_PALETTE_ID,
  DEFAULT_CAT_ID,
  DEFAULT_FLOOR_PALETTE_ID,
  DEFAULT_LEFT_WALL_ITEM,
  DEFAULT_PICTURE_FRAME_SIZE,
  DEFAULT_PICTURE_FRAME_STYLE_ID,
  DEFAULT_POSTER_FRAME_ID,
  DEFAULT_RUG_PALETTE_ID,
  DEFAULT_WALL_PALETTE_ID,
  DEFAULT_WINDOW_STYLE_ID,
} from '../src/types/room-customization';

const snapshot = createPersistedState({
  profile: { name: 'Leitor(a)', bio: 'Sempre imaginei que o paraíso fosse uma espécie de biblioteca.', bioAttribution: 'Jorge Luis Borges' },
  books: [],
  activeBookId: undefined,
  isLampOn: true,
  ambienceMode: 'auto',
  wallPaletteId: DEFAULT_WALL_PALETTE_ID,
  floorPaletteId: DEFAULT_FLOOR_PALETTE_ID,
  rugPaletteId: DEFAULT_RUG_PALETTE_ID,
  bookcasePaletteId: DEFAULT_BOOKCASE_PALETTE_ID,
  catId: DEFAULT_CAT_ID,
  leftWallItem: DEFAULT_LEFT_WALL_ITEM,
  leftWallPosterBookId: undefined,
  leftWallWindowStyle: DEFAULT_WINDOW_STYLE_ID,
  leftWallFrameColor: DEFAULT_POSTER_FRAME_ID,
  pictureFrameSize: DEFAULT_PICTURE_FRAME_SIZE,
  pictureFrameStyleId: DEFAULT_PICTURE_FRAME_STYLE_ID,
  pictureFramePhotoUri: 'file:///private/photo.jpg',
});

test('snapshot de nuvem nunca inclui o URI local da galeria', () => {
  const cloud = createCloudLibrarySnapshot(snapshot);
  assert.equal('pictureFramePhotoUri' in cloud, false);
});

test('restauração da nuvem preserva a foto deste aparelho', () => {
  const cloud = createCloudLibrarySnapshot(snapshot);
  const restored = normalizeCloudLibrarySnapshot(cloud, 'file:///device/current.jpg');
  assert.equal(restored.pictureFramePhotoUri, 'file:///device/current.jpg');
});

test('biblioteca com foto local não é considerada vazia', () => {
  assert.equal(isDefaultLibrarySnapshot(snapshot), false);
  assert.equal(isDefaultLibrarySnapshot({ ...snapshot, pictureFramePhotoUri: null }), true);
});
