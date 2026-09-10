import assert from 'node:assert/strict';
import test from 'node:test';
import { createJSONStorage } from 'zustand/middleware';

import type { Book } from '../src/types/book';
import {
  createPersistedState,
  normalizePersistedState,
  useLibraryStore,
} from '../src/store/library-store';
import { DEFAULT_FLOOR_PALETTE_ID, DEFAULT_WALL_PALETTE_ID } from '../src/types/room-customization';

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
  assert.equal('completingBookId' in snapshot, false);
});

test('normaliza snapshot corrompido com defaults e corrige ids e estados inválidos', () => {
  const normalized = normalizePersistedState({
    profile: { name: '   ', bio: 42, bioAttribution: '' },
    books: [
      { ...readingBook, status: 'completing', currentPage: 20 },
      { id: 'inválido', title: '', totalPages: 0 },
    ],
    activeBookId: 'id-inexistente',
    isLampOn: 'sim',
    ambienceMode: 'unknown',
    wallPaletteId: 'unknown',
    floorPaletteId: 'unknown',
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
});

test('rehidrata do storage assíncrono e restaura perfil, progresso e personalização', async () => {
  let storedValue = JSON.stringify({
    state: {
      profile: { name: 'Bia', bio: 'Ler é voltar para casa.', bioAttribution: 'Fonte pessoal' },
      books: [readingBook],
      activeBookId: readingBook.id,
      isLampOn: false,
      ambienceMode: 'sunset',
      wallPaletteId: 'warm-terracotta',
      floorPaletteId: 'warm-cherry',
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
