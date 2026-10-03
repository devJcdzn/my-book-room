import assert from 'node:assert/strict';
import test from 'node:test';
import { createJSONStorage } from 'zustand/middleware';

import type { Book } from '../src/types/book';
import { getReadingWeek, normalizeReadingDays } from '../src/utils/reading-days';
import {
  createPersistedState,
  normalizePersistedState,
  getCurrentLibrarySnapshot,
  overwriteLibraryStorageScope,
  readLibraryStorageScope,
  replaceLibrarySnapshot,
  switchLibraryStorageScope,
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

test('troca de conta preserva os dados salvos e mantém a interface pronta', async () => {
  const originalState = useLibraryStore.getState();
  const originalName = useLibraryStore.persist.getOptions().name;
  const guest = normalizePersistedState({ profile: { name: 'Convidada' }, books: [readingBook] });
  const account = normalizePersistedState({ profile: { name: 'Conta Apple' }, books: [{ ...readingBook, currentPage: 120 }] });
  const hydrationStates: boolean[] = [];
  const unsubscribe = useLibraryStore.subscribe((state) => hydrationStates.push(state._hasHydrated));

  try {
    await overwriteLibraryStorageScope('user:login-regression', account);
    await switchLibraryStorageScope('user:guest-regression', guest);
    await switchLibraryStorageScope('user:login-regression', guest);

    assert.equal(useLibraryStore.getState().profile.name, 'Conta Apple');
    assert.equal(useLibraryStore.getState().books[0]?.currentPage, 120);
    assert.deepEqual(await readLibraryStorageScope('user:login-regression'), normalizePersistedState(account));
    assert.equal(hydrationStates.includes(false), false);

    useLibraryStore.getState().updateProfile({ name: 'Conta atualizada' });
    await switchLibraryStorageScope('user:guest-regression');
    assert.deepEqual(getCurrentLibrarySnapshot(), normalizePersistedState(guest));
    await switchLibraryStorageScope('user:login-regression');
    assert.equal(useLibraryStore.getState().profile.name, 'Conta atualizada');
    assert.equal(hydrationStates.includes(false), false);
  } finally {
    unsubscribe();
    useLibraryStore.persist.setOptions({ name: originalName });
    useLibraryStore.setState(originalState);
  }
});

test('restaurar conta antiga não reabre onboarding concluído neste aparelho', async () => {
  const originalState = useLibraryStore.getState();
  const originalName = useLibraryStore.persist.getOptions().name;
  try {
    useLibraryStore.setState({ onboardingStatus: 'completed', onboardingStep: 4 });
    replaceLibrarySnapshot(normalizePersistedState({ profile: { name: 'Backup antigo' } }));
    assert.equal(useLibraryStore.getState().profile.name, 'Backup antigo');
    assert.equal(useLibraryStore.getState().onboardingStatus, 'completed');
    assert.equal(useLibraryStore.getState().onboardingStep, 4);
    await switchLibraryStorageScope('user:onboarding-regression');
    assert.equal(useLibraryStore.getState().onboardingStatus, 'completed');
    await useLibraryStore.persist.rehydrate();
    assert.equal(useLibraryStore.getState().onboardingStatus, 'completed');
  } finally {
    useLibraryStore.persist.setOptions({ name: originalName });
    useLibraryStore.setState(originalState);
  }
});

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
    readingDays: ['2026-09-29'],
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
  assert.deepEqual(snapshot.readingDays, ['2026-09-29']);
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
  assert.deepEqual(normalized.readingDays, []);
  assert.deepEqual(normalized.readingShelves, ['reading-default']);
  assert.deepEqual(normalized.completedShelves, ['completed-default']);
  assert.equal(normalized.books[0]?.shelfId, 'completed-default');
  assert.equal(normalized.libraryBackgroundId, 'paper');
});

test('normaliza prateleiras e aparência e mantém cada livro no status correspondente', () => {
  const normalized = normalizePersistedState({
    readingShelves: ['reading-a', 'reading-b'],
    completedShelves: ['done-a'],
    libraryBackgroundId: 'sage',
    books: [
      { ...readingBook, shelfId: 'reading-b' },
      { ...readingBook, id: 'done', status: 'completed', shelfId: 'removed' },
    ],
  });
  assert.deepEqual(normalized.readingShelves, ['reading-a', 'reading-b']);
  assert.deepEqual(normalized.completedShelves, ['done-a']);
  assert.equal(normalized.books.find((book) => book.id === readingBook.id)?.shelfId, 'reading-b');
  assert.equal(normalized.books.find((book) => book.id === 'done')?.shelfId, 'done-a');
  assert.equal(normalized.libraryBackgroundId, 'sage');
});

test('snapshot antigo preserva status e cria a estante Quero ler vazia', () => {
  const normalized = normalizePersistedState({
    books: [
      { ...readingBook, shelfId: 'reading-default' },
      { ...readingBook, id: 'done', status: 'completed', shelfId: 'completed-default' },
    ],
    readingShelves: ['reading-default'],
    completedShelves: ['completed-default'],
  });
  assert.deepEqual(normalized.wantToReadShelves, ['want-to-read-default']);
  assert.equal(normalized.books.find((book) => book.id === readingBook.id)?.status, 'reading');
  assert.equal(normalized.books.find((book) => book.id === 'done')?.status, 'completed');
});

test('restauração não coloca automaticamente um livro em leitura na mesa', () => {
  const normalized = normalizePersistedState({ books: [{ ...readingBook }], activeBookId: undefined });
  assert.equal(normalized.books[0]?.status, 'reading');
  assert.equal(normalized.activeBookId, undefined);
});

test('cria prateleiras, move livros apenas para o status correspondente e conclui na primeira concluída', () => {
  const original = useLibraryStore.getState();
  useLibraryStore.setState({
    books: [{ ...readingBook, shelfId: 'reading-default' }],
    readingShelves: ['reading-default'],
    completedShelves: ['completed-default'],
    completingBookId: undefined,
  });
  try {
    const readingShelf = useLibraryStore.getState().addLibraryShelf('reading');
    const completedShelf = useLibraryStore.getState().addLibraryShelf('completed');
    useLibraryStore.getState().moveBookToShelf(readingBook.id, readingShelf);
    assert.equal(useLibraryStore.getState().books[0]?.shelfId, readingShelf);
    useLibraryStore.getState().moveBookToShelf(readingBook.id, completedShelf);
    assert.equal(useLibraryStore.getState().books[0]?.shelfId, readingShelf);
    useLibraryStore.getState().requestCompletion(readingBook.id);
    useLibraryStore.getState().finalizeCompletion(readingBook.id);
    const completed = useLibraryStore.getState().books.find((book) => book.id === readingBook.id);
    assert.equal(completed?.status, 'completed');
    assert.equal(completed?.shelfId, 'completed-default');
  } finally {
    useLibraryStore.setState(original);
  }
});

test('adiciona livro novo na prateleira escolhida e usa a primeira como padrão', () => {
  const original = useLibraryStore.getState();
  useLibraryStore.setState({ books: [], readingShelves: ['reading-first', 'reading-second'], activeBookId: undefined });
  try {
    useLibraryStore.getState().addOpenLibraryBook({
      workKey: '/works/shelf-target', title: 'Com destino', author: 'Autora', totalPages: 100,
    }, { shelfId: 'reading-second' });
    useLibraryStore.getState().addOpenLibraryBook({
      workKey: '/works/shelf-default', title: 'Padrão', author: 'Autor', totalPages: 100,
    });
    assert.equal(useLibraryStore.getState().books.find((book) => book.id === '/works/shelf-target')?.shelfId, 'reading-second');
    assert.equal(useLibraryStore.getState().books.find((book) => book.id === '/works/shelf-default')?.shelfId, 'reading-first');
    assert.equal(useLibraryStore.getState().activeBookId, undefined);
  } finally {
    useLibraryStore.setState(original);
  }
});

test('Quero ler permanece fora da mesa até começar e pode ir direto para concluídos', () => {
  const original = useLibraryStore.getState();
  useLibraryStore.setState({
    books: [],
    activeBookId: undefined,
    wantToReadShelves: ['want-to-read-default'],
    readingShelves: ['reading-default'],
    completedShelves: ['completed-default'],
  });
  try {
    useLibraryStore.getState().addOpenLibraryBook({
      workKey: '/works/wishlist', title: 'Para depois', author: 'Autora', totalPages: 180,
    }, { status: 'want-to-read' });
    let book = useLibraryStore.getState().books[0];
    assert.equal(book?.status, 'want-to-read');
    assert.equal(book?.shelfId, 'want-to-read-default');
    assert.equal(useLibraryStore.getState().activeBookId, undefined);

    useLibraryStore.getState().selectActiveBook('/works/wishlist');
    book = useLibraryStore.getState().books[0];
    assert.equal(book?.status, 'reading');
    assert.equal(book?.shelfId, 'reading-default');
    assert.equal(useLibraryStore.getState().activeBookId, '/works/wishlist');

    useLibraryStore.getState().completeBook('/works/wishlist', { notes: 'Lido antes do app.', rating: 5 });
    book = useLibraryStore.getState().books[0];
    assert.equal(book?.status, 'completed');
    assert.equal(book?.currentPage, 180);
    assert.equal(book?.shelfId, 'completed-default');
    assert.equal(book?.notes, 'Lido antes do app.');
    assert.equal(book?.rating, 5);
    assert.equal(useLibraryStore.getState().activeBookId, undefined);
  } finally {
    useLibraryStore.setState(original);
  }
});

test('renomeia prateleiras e protege a primeira e as que ainda têm livros', () => {
  const original = useLibraryStore.getState();
  useLibraryStore.setState({
    books: [{ ...readingBook, shelfId: 'reading-default' }],
    readingShelves: ['reading-default'],
    completedShelves: ['completed-default'],
    shelfNames: {},
  });
  try {
    const occupiedShelf = useLibraryStore.getState().addLibraryShelf('reading');
    const emptyShelf = useLibraryStore.getState().addLibraryShelf('reading');
    useLibraryStore.getState().moveBookToShelf(readingBook.id, occupiedShelf);
    useLibraryStore.getState().renameLibraryShelf(emptyShelf, 'Favoritos');
    assert.equal(useLibraryStore.getState().shelfNames[emptyShelf], 'Favoritos');
    assert.equal(useLibraryStore.getState().removeLibraryShelf('reading', 'reading-default'), false);
    assert.equal(useLibraryStore.getState().removeLibraryShelf('reading', occupiedShelf), false);
    assert.equal(useLibraryStore.getState().removeLibraryShelf('reading', emptyShelf), true);
    assert.deepEqual(useLibraryStore.getState().readingShelves, ['reading-default', occupiedShelf]);
    assert.equal(emptyShelf in useLibraryStore.getState().shelfNames, false);
  } finally {
    useLibraryStore.setState(original);
  }
});

test('normaliza dias locais e monta semana de segunda a domingo entre meses', () => {
  assert.deepEqual(normalizeReadingDays(['2026-08-31', '2026-09-01', '2026-09-01', '2026-13-01', 'invalida']), ['2026-08-31', '2026-09-01']);
  const week = getReadingWeek(new Date(2026, 8, 2, 8), ['2026-08-31']);
  assert.deepEqual(week.map((day) => day.key), ['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06']);
  assert.equal(week[0]?.isRead, true);
  assert.equal(week[2]?.isToday, true);
});

test('progresso marca leitura uma vez por dia e conclusão registra avanço final', () => {
  const original = useLibraryStore.getState();
  const secondBook = { ...readingBook, id: 'book-2', currentPage: 2 };
  useLibraryStore.setState({ books: [{ ...readingBook, currentPage: 10 }, secondBook], readingDays: [] });
  try {
    useLibraryStore.getState().updateProgress(readingBook.id, 11);
    const markedDay = useLibraryStore.getState().readingDays;
    assert.equal(markedDay.length, 1);
    useLibraryStore.getState().updateProgress(secondBook.id, 3);
    assert.deepEqual(useLibraryStore.getState().readingDays, markedDay);
    useLibraryStore.getState().updateProgress(secondBook.id, 1);
    assert.deepEqual(useLibraryStore.getState().readingDays, markedDay);
    useLibraryStore.setState({ readingDays: [] });
    useLibraryStore.getState().requestCompletion(secondBook.id);
    assert.equal(useLibraryStore.getState().readingDays.length, 1);
  } finally {
    useLibraryStore.setState(original);
  }
});

test('alterar total de páginas limita progresso e desvincula páginas de notas fora do novo total', () => {
  const original = useLibraryStore.getState();
  const readingEntry = {
    id: 'entry-page-90',
    text: 'Manter o texto da nota.',
    createdAt: '2026-09-28T10:00:00.000Z',
    page: 90,
    isFavorite: true,
  };
  useLibraryStore.setState({
    books: [{ ...readingBook, currentPage: 84, readingEntries: [readingEntry] }],
    completingBookId: undefined,
  });
  try {
    useLibraryStore.getState().updateTotalPages(readingBook.id, 70);
    const updated = useLibraryStore.getState().books[0];
    assert.equal(updated?.totalPages, 70);
    assert.equal(updated?.currentPage, 70);
    assert.equal(updated?.status, 'reading');
    assert.equal(updated?.readingEntries?.[0]?.text, readingEntry.text);
    assert.equal(updated?.readingEntries?.[0]?.page, undefined);
    assert.equal(updated?.readingEntries?.[0]?.isFavorite, true);

    useLibraryStore.getState().updateTotalPages(readingBook.id, 0);
    useLibraryStore.getState().updateTotalPages(readingBook.id, 100_000);
    assert.equal(useLibraryStore.getState().books[0]?.totalPages, 70);
  } finally {
    useLibraryStore.setState(original);
  }
});

test('restaura entradas do diário e preserva resenha antiga, ignorando entradas inválidas', () => {
  const entry = { id: 'entry-1', text: 'Uma ideia marcante.', createdAt: '2026-09-28T10:00:00.000Z', page: 42, isFavorite: true };
  const normalized = normalizePersistedState({ books: [{
    ...readingBook,
    notes: 'Minha resenha final.',
    readingEntries: [entry, { ...entry, id: '', text: ' ' }, { ...entry, id: 'entry-2', page: 999 }],
  }] });

  assert.equal(normalized.books[0]?.notes, 'Minha resenha final.');
  assert.deepEqual(normalized.books[0]?.readingEntries, [entry, {
    ...entry,
    id: 'entry-2',
    page: undefined,
  }]);
});

test('store cria, edita, favorita e remove entradas junto com o livro', () => {
  const originalBooks = useLibraryStore.getState().books;
  useLibraryStore.setState({ books: [{ ...readingBook, readingEntries: [] }] });
  try {
    useLibraryStore.getState().addReadingEntry(readingBook.id, { text: '  Anotação da sessão  ', page: 84 });
    let savedBook = useLibraryStore.getState().books[0]!;
    const entry = savedBook.readingEntries?.[0];
    assert.ok(entry);
    assert.equal(entry.text, 'Anotação da sessão');
    assert.equal(entry.page, 84);

    useLibraryStore.getState().updateReadingEntry(readingBook.id, entry.id, { text: 'Texto revisado', page: undefined });
    useLibraryStore.getState().toggleReadingEntryFavorite(readingBook.id, entry.id);
    savedBook = useLibraryStore.getState().books[0]!;
    assert.equal(savedBook.readingEntries?.[0]?.text, 'Texto revisado');
    assert.equal(savedBook.readingEntries?.[0]?.page, undefined);
    assert.equal(savedBook.readingEntries?.[0]?.isFavorite, true);

    useLibraryStore.getState().removeBook(readingBook.id);
    assert.equal(useLibraryStore.getState().books.length, 0);
  } finally {
    useLibraryStore.setState({ books: originalBooks });
  }
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
      readingDays: ['2026-09-29'],
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
  assert.deepEqual(state.readingDays, ['2026-09-29']);
  assert.equal(state._hasHydrated, true);

  useLibraryStore.persist.setOptions({ storage: originalStorage });
  useLibraryStore.setState({
    _hasHydrated: false,
    books: [],
    readingDays: [],
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
