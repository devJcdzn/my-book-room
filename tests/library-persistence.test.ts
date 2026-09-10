import assert from 'node:assert/strict';
import test from 'node:test';
import { createJSONStorage } from 'zustand/middleware';

import type { Book } from '../src/types/book';
import {
  createPersistedState,
  normalizePersistedState,
  useLibraryStore,
} from '../src/store/library-store';
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

const readingBook: Book = {
  id: '/works/OL1W',
  source: 'open-library',
  openLibraryWorkKey: '/works/OL1W',
  title: 'Livro persistido',
  author: 'Autora',
  coverColor: '#336699',
  totalPages: 200,
  currentPage: 84,
  status: 'reading',
  rating: 4,
  notes: 'Retomar no próximo capítulo.',
};

test('snapshot local inclui perfil, livros, progresso e sala sem estado transitório', () => {
  const snapshot = createPersistedState({
    profile: { name: 'Ana', bio: 'Uma frase', bioAttribution: 'Livro' },
    books: [{ ...readingBook, status: 'completing', currentPage: 200 }],
    activeBookId: readingBook.id,
    isLampOn: false,
    ambienceMode: 'night',
    wallPaletteId: 'sage-green',
    floorPaletteId: 'dark-walnut',
    rugPaletteId: 'sage-botanic',
    bookcasePaletteId: 'rustic-mahogany',
    catId: 'black-catnap',
    leftWallItem: 'poster',
    leftWallPosterBookId: readingBook.id,
    leftWallWindowStyle: 'golden-oak',
    leftWallFrameColor: 'antique-gold',
    pictureFrameSize: '2:1',
    pictureFrameStyleId: 'antique-gold',
    pictureFramePhotoUri: 'file:///storage/user-photo.jpg',
    completingBookId: readingBook.id,
  });

  assert.equal(snapshot.profile.name, 'Ana');
  assert.equal(snapshot.books[0]?.currentPage, 200);
  assert.equal(snapshot.books[0]?.status, 'completed');
  assert.equal(snapshot.activeBookId, undefined);
  assert.equal(snapshot.isLampOn, false);
  assert.equal(snapshot.ambienceMode, 'night');
  assert.equal(snapshot.wallPaletteId, 'sage-green');
  assert.equal(snapshot.floorPaletteId, 'dark-walnut');
  assert.equal(snapshot.rugPaletteId, 'sage-botanic');
  assert.equal(snapshot.bookcasePaletteId, 'rustic-mahogany');
  assert.equal(snapshot.catId, 'black-catnap');
  assert.equal(snapshot.leftWallItem, 'poster');
  assert.equal(snapshot.leftWallPosterBookId, readingBook.id);
  assert.equal(snapshot.leftWallWindowStyle, 'golden-oak');
  assert.equal(snapshot.leftWallFrameColor, 'antique-gold');
  assert.equal(snapshot.pictureFrameSize, '2:1');
  assert.equal(snapshot.pictureFrameStyleId, 'antique-gold');
  assert.equal(snapshot.pictureFramePhotoUri, 'file:///storage/user-photo.jpg');
  assert.equal('completingBookId' in snapshot, false);
});

test('normaliza snapshot corrompido com defaults e corrige ids e estados inválidos', () => {
  const normalized = normalizePersistedState({
    profile: { name: '   ', bio: 42, bioAttribution: '' },
    books: [
      { ...readingBook, status: 'completing', currentPage: 20 },
      { id: 'invalido' },
    ],
    activeBookId: 'inexistente',
    isLampOn: 'nao-booleano',
    ambienceMode: 'inexistente',
    wallPaletteId: 'inexistente',
    floorPaletteId: 'inexistente',
    rugPaletteId: 'inexistente',
    bookcasePaletteId: 'inexistente',
    catId: 'inexistente',
    leftWallItem: 'inexistente',
    leftWallPosterBookId: 'livro-inexistente',
    leftWallWindowStyle: 'inexistente',
    leftWallFrameColor: 'inexistente',
    pictureFrameSize: 'unknown',
    pictureFrameStyleId: 'unknown',
    pictureFramePhotoUri: 'data:image/jpeg;base64,corruptedCrashData',
  });

  assert.equal(normalized.profile.name, 'Leitor(a)');
  assert.equal(normalized.profile.bio, 'Sempre imaginei que o paraíso fosse uma espécie de biblioteca.');
  assert.equal(normalized.profile.bioAttribution, '');
  assert.equal(normalized.books.length, 1);
  assert.equal(normalized.books[0]?.status, 'completed');
  assert.equal(normalized.books[0]?.currentPage, 200);
  assert.equal(normalized.activeBookId, undefined);
  assert.equal(normalized.isLampOn, true);
  assert.equal(normalized.ambienceMode, 'auto');
  assert.equal(normalized.wallPaletteId, DEFAULT_WALL_PALETTE_ID);
  assert.equal(normalized.floorPaletteId, DEFAULT_FLOOR_PALETTE_ID);
  assert.equal(normalized.rugPaletteId, DEFAULT_RUG_PALETTE_ID);
  assert.equal(normalized.bookcasePaletteId, DEFAULT_BOOKCASE_PALETTE_ID);
  assert.equal(normalized.catId, DEFAULT_CAT_ID);
  assert.equal(normalized.leftWallItem, DEFAULT_LEFT_WALL_ITEM);
  assert.equal(normalized.leftWallPosterBookId, undefined);
  assert.equal(normalized.leftWallWindowStyle, DEFAULT_WINDOW_STYLE_ID);
  assert.equal(normalized.leftWallFrameColor, DEFAULT_POSTER_FRAME_ID);
  assert.equal(normalized.pictureFrameSize, DEFAULT_PICTURE_FRAME_SIZE);
  assert.equal(normalized.pictureFrameStyleId, DEFAULT_PICTURE_FRAME_STYLE_ID);
  assert.equal(normalized.pictureFramePhotoUri, null);
});

test('rehidrata do storage assíncrono e restaura perfil, progresso e personalização', async () => {
  let storedValue = JSON.stringify({
    state: {
      profile: { name: 'Bia', bio: 'Lendo o mundo', bioAttribution: 'Autora' },
      books: [{ ...readingBook, currentPage: 84 }],
      activeBookId: readingBook.id,
      isLampOn: false,
      ambienceMode: 'sunset',
      wallPaletteId: 'warm-terracotta',
      floorPaletteId: 'warm-cherry',
      rugPaletteId: 'velvet-burgundy',
      bookcasePaletteId: 'rustic-mahogany',
      catId: 'black-catnap',
      leftWallItem: 'window',
      leftWallPosterBookId: undefined,
      leftWallWindowStyle: 'golden-oak',
      leftWallFrameColor: 'antique-gold',
      pictureFrameSize: '1:2',
      pictureFrameStyleId: 'antique-gold',
      pictureFramePhotoUri: 'file:///storage/rehydrated-photo.jpg',
    },
    version: 1,
  });
  const fakeStorage = {
    getItem: async () => storedValue,
    setItem: async (_key: string, value: string) => { storedValue = value; },
    removeItem: async () => { storedValue = ''; },
  };
  const originalStorage = useLibraryStore.persist.getOptions().storage;

  useLibraryStore.persist.setOptions({ storage: createJSONStorage(() => fakeStorage) });
  await useLibraryStore.persist.rehydrate();

  const state = useLibraryStore.getState();
  assert.equal(state.profile.name, 'Bia');
  assert.equal(state.books[0]?.currentPage, 84);
  assert.equal(state.activeBookId, readingBook.id);
  assert.equal(state.isLampOn, false);
  assert.equal(state.ambienceMode, 'sunset');
  assert.equal(state.wallPaletteId, 'warm-terracotta');
  assert.equal(state.floorPaletteId, 'warm-cherry');
  assert.equal(state.rugPaletteId, 'velvet-burgundy');
  assert.equal(state.bookcasePaletteId, 'rustic-mahogany');
  assert.equal(state.catId, 'black-catnap');
  assert.equal(state.leftWallItem, 'window');
  assert.equal(state.leftWallWindowStyle, 'golden-oak');
  assert.equal(state.leftWallFrameColor, 'antique-gold');
  assert.equal(state.pictureFrameSize, '2:1');
  assert.equal(state.pictureFrameStyleId, 'antique-gold');
  assert.equal(state.pictureFramePhotoUri, 'file:///storage/rehydrated-photo.jpg');
  assert.equal(state._hasHydrated, true);

  useLibraryStore.persist.setOptions({ storage: originalStorage });
  useLibraryStore.setState({
    _hasHydrated: false,
    books: [],
    activeBookId: undefined,
    completingBookId: undefined,
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
    pictureFramePhotoUri: null,
    profile: { name: 'Leitor(a)', bio: 'Sempre imaginei que o paraíso fosse uma espécie de biblioteca.', bioAttribution: 'Jorge Luis Borges' },
  });
});

test('updateProfile aplica trim e rejeita nome vazio', () => {
  const store = useLibraryStore.getState();
  store.updateProfile({ name: '  Clara  ', bio: '  Uma bio  ', bioAttribution: '  Fonte  ' });
  assert.deepEqual(useLibraryStore.getState().profile, {
    name: 'Clara',
    bio: 'Uma bio',
    bioAttribution: 'Fonte',
  });

  store.updateProfile({ name: '   ' });
  assert.equal(useLibraryStore.getState().profile.name, 'Clara');

  store.updateProfile({ name: 'Leitor(a)', bio: 'Sempre imaginei que o paraíso fosse uma espécie de biblioteca.', bioAttribution: 'Jorge Luis Borges' });
});
