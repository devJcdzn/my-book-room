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

test('snapshot de nuvem sincroniza entradas do diário junto com os livros', () => {
  const withDiary = createPersistedState({
    profile: snapshot.profile,
    books: [{
      id: 'manual-1', source: 'manual', title: 'Livro', author: 'Autora', coverColor: '#336699',
      totalPages: 100, currentPage: 20, status: 'reading',
      readingEntries: [{ id: 'entry-1', text: 'Uma ideia.', createdAt: '2026-09-28T10:00:00.000Z', page: 20, isFavorite: true }],
    }, {
      id: 'manual-2', source: 'manual', title: 'Para ler', author: 'Outra autora', coverColor: '#996633',
      totalPages: 120, currentPage: 0, status: 'want-to-read', shelfId: 'want-to-read-weekend',
    }],
    activeBookId: 'manual-1',
    isLampOn: snapshot.isLampOn,
    ambienceMode: snapshot.ambienceMode,
    wallPaletteId: snapshot.wallPaletteId,
    floorPaletteId: snapshot.floorPaletteId,
    rugPaletteId: snapshot.rugPaletteId,
    bookcasePaletteId: snapshot.bookcasePaletteId,
    catId: snapshot.catId,
    leftWallItem: snapshot.leftWallItem,
    leftWallWindowStyle: snapshot.leftWallWindowStyle,
    leftWallFrameColor: snapshot.leftWallFrameColor,
    pictureFrameSize: snapshot.pictureFrameSize,
    pictureFrameStyleId: snapshot.pictureFrameStyleId,
    pictureFramePhotoUri: snapshot.pictureFramePhotoUri,
    readingDays: ['2026-09-29'],
    wantToReadShelves: ['want-to-read-default', 'want-to-read-weekend'],
    readingShelves: ['reading-default', 'reading-window'],
    completedShelves: ['completed-default'],
    shelfNames: { 'reading-window': 'Janela de leitura' },
    libraryBackgroundId: 'sage',
  });
  const cloud = createCloudLibrarySnapshot(withDiary);
  const restored = normalizeCloudLibrarySnapshot(cloud, null);
  assert.deepEqual(restored.books[0]?.readingEntries, withDiary.books[0]?.readingEntries);
  assert.deepEqual(restored.readingDays, ['2026-09-29']);
  assert.deepEqual(restored.wantToReadShelves, ['want-to-read-default', 'want-to-read-weekend']);
  assert.equal(restored.books[1]?.status, 'want-to-read');
  assert.equal(restored.books[1]?.shelfId, 'want-to-read-weekend');
  assert.deepEqual(restored.readingShelves, ['reading-default', 'reading-window']);
  assert.deepEqual(restored.completedShelves, ['completed-default']);
  assert.deepEqual(restored.shelfNames, { 'reading-window': 'Janela de leitura' });
  assert.equal(restored.libraryBackgroundId, 'sage');
});

test('biblioteca com foto local não é considerada vazia', () => {
  assert.equal(isDefaultLibrarySnapshot(snapshot), false);
  assert.equal(isDefaultLibrarySnapshot({ ...snapshot, pictureFramePhotoUri: null, roomLayout: undefined }), true);
});
