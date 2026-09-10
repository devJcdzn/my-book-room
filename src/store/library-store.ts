import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Book, BookSearchResult } from '@/src/types/book';
import {
  BOOKCASE_PALETTES,
  CAT_OPTIONS,
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
  FLOOR_PALETTES,
  LeftWallItemType,
  PICTURE_FRAME_STYLES,
  PictureFrameSize,
  POSTER_FRAME_OPTIONS,
  RUG_PALETTES,
  WALL_PALETTES,
  WINDOW_STYLES,
} from '@/src/types/room-customization';

export type AmbienceMode = 'auto' | 'day' | 'sunset' | 'night';

type LibraryState = {
  _hasHydrated: boolean;
  books: Book[];
  activeBookId?: string;
  completingBookId?: string;
  isLampOn: boolean;
  ambienceMode: AmbienceMode;
  wallPaletteId: string;
  floorPaletteId: string;
  rugPaletteId: string;
  bookcasePaletteId: string;
  catId: string;
  leftWallItem: LeftWallItemType;
  leftWallPosterBookId?: string;
  leftWallWindowStyle: string;
  leftWallFrameColor: string;
  pictureFrameSize: PictureFrameSize;
  pictureFrameStyleId: string;
  pictureFramePhotoUri: string | null;
  profile: Profile;
  setAmbienceMode: (mode: AmbienceMode) => void;
  cycleAmbienceMode: () => void;
  toggleLamp: () => void;
  setWallPaletteId: (id: string) => void;
  setFloorPaletteId: (id: string) => void;
  setRugPaletteId: (id: string) => void;
  setBookcasePaletteId: (id: string) => void;
  setCatId: (id: string) => void;
  setLeftWallItem: (item: LeftWallItemType) => void;
  setLeftWallPosterBookId: (bookId?: string) => void;
  setLeftWallWindowStyle: (styleId: string) => void;
  setLeftWallFrameColor: (frameId: string) => void;
  setPictureFrameSize: (size: PictureFrameSize) => void;
  setPictureFrameStyleId: (styleId: string) => void;
  setPictureFramePhotoUri: (uri: string | null) => void;
  updateProfile: (profile: ProfileInput) => void;
  addOpenLibraryBook: (book: BookSearchResult & { totalPages: number }) => void;
  addCustomBook: (book: { title: string; author: string; coverColor: string; totalPages: number }) => void;
  updateBookCoverColor: (bookId: string, color: string) => void;
  removeBook: (bookId: string) => void;
  selectActiveBook: (bookId: string) => void;
  updateProgress: (bookId: string, currentPage: number) => void;
  updateOpinion: (bookId: string, input: { rating?: number; notes?: string }) => void;
  requestCompletion: (bookId: string) => void;
  finalizeCompletion: (bookId: string) => void;
};

export type Profile = {
  name: string;
  bio: string;
  bioAttribution: string;
};

export type ProfileInput = Partial<Profile>;

export const PROFILE_LIMITS = {
  name: 50,
  bio: 280,
  bioAttribution: 80,
} as const;

const DEFAULT_PROFILE: Profile = {
  name: 'Leitor(a)',
  bio: 'Sempre imaginei que o paraíso fosse uma espécie de biblioteca.',
  bioAttribution: 'Jorge Luis Borges',
};

const STORAGE_VERSION = 1;
const STORAGE_KEY = 'bookroom-library-v1';

export type PersistedLibraryState = Pick<
  LibraryState,
  | 'profile'
  | 'books'
  | 'activeBookId'
  | 'isLampOn'
  | 'ambienceMode'
  | 'wallPaletteId'
  | 'floorPaletteId'
  | 'rugPaletteId'
  | 'bookcasePaletteId'
  | 'catId'
  | 'leftWallItem'
  | 'leftWallPosterBookId'
  | 'leftWallWindowStyle'
  | 'leftWallFrameColor'
  | 'pictureFrameSize'
  | 'pictureFrameStyleId'
  | 'pictureFramePhotoUri'
>;

const memoryStorage = new Map<string, string>();

const isNativeRuntime = () => process.env.EXPO_OS === 'ios' || process.env.EXPO_OS === 'android';

const storage = {
  getItem: async (key: string) => {
    if (!isNativeRuntime()) return memoryStorage.get(key) ?? null;
    const { default: sqliteStorage } = await import('expo-sqlite/kv-store');
    return sqliteStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    if (!isNativeRuntime()) {
      memoryStorage.set(key, value);
      return;
    }
    const { default: sqliteStorage } = await import('expo-sqlite/kv-store');
    await sqliteStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    if (!isNativeRuntime()) {
      memoryStorage.delete(key);
      return;
    }
    const { default: sqliteStorage } = await import('expo-sqlite/kv-store');
    await sqliteStorage.removeItem(key);
  },
};

const clampPage = (page: number, total: number) =>
  Math.min(total, Math.max(0, Math.round(page)));

const trimToLimit = (value: unknown, fallback: string, limit: number) =>
  typeof value === 'string' ? value.trim().slice(0, limit) : fallback;

const normalizeProfile = (value: unknown): Profile => {
  const candidate = value && typeof value === 'object' ? value as Partial<Profile> : {};
  return {
    name: trimToLimit(candidate.name, DEFAULT_PROFILE.name, PROFILE_LIMITS.name) || DEFAULT_PROFILE.name,
    bio: trimToLimit(candidate.bio, DEFAULT_PROFILE.bio, PROFILE_LIMITS.bio),
    bioAttribution: trimToLimit(candidate.bioAttribution, DEFAULT_PROFILE.bioAttribution, PROFILE_LIMITS.bioAttribution),
  };
};

const isBookStatus = (value: unknown): value is Book['status'] =>
  value === 'reading' || value === 'completed';

const normalizeBook = (value: unknown): Book | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<Book>;
  const totalPages = candidate.totalPages;
  if (
    typeof candidate.id !== 'string' || !candidate.id.trim()
    || (candidate.source !== 'open-library' && candidate.source !== 'manual')
    || typeof candidate.title !== 'string' || !candidate.title.trim()
    || typeof candidate.author !== 'string'
    || typeof candidate.coverColor !== 'string'
    || !/^#[0-9A-F]{6}$/i.test(candidate.coverColor)
    || typeof totalPages !== 'number' || !Number.isInteger(totalPages) || totalPages < 1
  ) return undefined;

  const status = candidate.status === 'completing' ? 'completed' : isBookStatus(candidate.status) ? candidate.status : 'reading';
  const currentPage = status === 'completed'
    ? totalPages
    : clampPage(typeof candidate.currentPage === 'number' ? candidate.currentPage : 0, totalPages);

  return {
    ...candidate,
    id: candidate.id,
    source: candidate.source,
    title: candidate.title.trim(),
    author: candidate.author.trim() || 'Autor desconhecido',
    coverColor: candidate.coverColor,
    totalPages,
    currentPage,
    status,
    rating: typeof candidate.rating === 'number' ? Math.min(5, Math.max(1, Math.round(candidate.rating))) : undefined,
    notes: typeof candidate.notes === 'string' ? candidate.notes : undefined,
  };
};

export const normalizePersistedState = (value: unknown): PersistedLibraryState => {
  const candidate = value && typeof value === 'object' ? value as Partial<PersistedLibraryState> : {};
  const books = Array.isArray(candidate.books)
    ? candidate.books.map(normalizeBook).filter((book): book is Book => Boolean(book))
    : [];
  const readingBooks = books.filter((book) => book.status === 'reading');
  const requestedActive = typeof candidate.activeBookId === 'string'
    ? readingBooks.find((book) => book.id === candidate.activeBookId)
    : undefined;

  return {
    profile: normalizeProfile(candidate.profile),
    books,
    activeBookId: requestedActive?.id ?? readingBooks.at(-1)?.id,
    isLampOn: typeof candidate.isLampOn === 'boolean' ? candidate.isLampOn : true,
    ambienceMode: candidate.ambienceMode === 'day' || candidate.ambienceMode === 'sunset' || candidate.ambienceMode === 'night'
      ? candidate.ambienceMode
      : 'auto',
    wallPaletteId: WALL_PALETTES.some((palette) => palette.id === candidate.wallPaletteId)
      ? candidate.wallPaletteId!
      : DEFAULT_WALL_PALETTE_ID,
    floorPaletteId: FLOOR_PALETTES.some((palette) => palette.id === candidate.floorPaletteId)
      ? candidate.floorPaletteId!
      : DEFAULT_FLOOR_PALETTE_ID,
    rugPaletteId: RUG_PALETTES.some((palette) => palette.id === candidate.rugPaletteId)
      ? candidate.rugPaletteId!
      : DEFAULT_RUG_PALETTE_ID,
    bookcasePaletteId: BOOKCASE_PALETTES.some((palette) => palette.id === candidate.bookcasePaletteId)
      ? candidate.bookcasePaletteId!
      : DEFAULT_BOOKCASE_PALETTE_ID,
    catId: CAT_OPTIONS.some((cat) => cat.id === candidate.catId)
      ? candidate.catId!
      : DEFAULT_CAT_ID,
    leftWallItem: candidate.leftWallItem === 'window' || candidate.leftWallItem === 'poster'
      ? candidate.leftWallItem
      : DEFAULT_LEFT_WALL_ITEM,
    leftWallPosterBookId: typeof candidate.leftWallPosterBookId === 'string' && books.some((b) => b.id === candidate.leftWallPosterBookId)
      ? candidate.leftWallPosterBookId
      : undefined,
    leftWallWindowStyle: WINDOW_STYLES.some((style) => style.id === candidate.leftWallWindowStyle)
      ? candidate.leftWallWindowStyle!
      : DEFAULT_WINDOW_STYLE_ID,
    leftWallFrameColor: POSTER_FRAME_OPTIONS.some((frame) => frame.id === candidate.leftWallFrameColor)
      ? candidate.leftWallFrameColor!
      : DEFAULT_POSTER_FRAME_ID,
    pictureFrameSize:
      candidate.pictureFrameSize === 'none' ||
      candidate.pictureFrameSize === '1:1' ||
      candidate.pictureFrameSize === '2:1'
        ? candidate.pictureFrameSize
        : candidate.pictureFrameSize === ('1:2' as unknown)
          ? '2:1'
          : DEFAULT_PICTURE_FRAME_SIZE,
    pictureFrameStyleId: PICTURE_FRAME_STYLES.some((style) => style.id === candidate.pictureFrameStyleId)
      ? candidate.pictureFrameStyleId!
      : DEFAULT_PICTURE_FRAME_STYLE_ID,
    pictureFramePhotoUri:
      typeof candidate.pictureFramePhotoUri === 'string' &&
      candidate.pictureFramePhotoUri.length > 0 &&
      !candidate.pictureFramePhotoUri.startsWith('data:')
        ? candidate.pictureFramePhotoUri
        : null,
  };
};

export const createPersistedState = (state: PersistedLibraryState & { completingBookId?: string }): PersistedLibraryState => {
  const stableBooks = state.books.map((book) => book.status === 'completing'
    ? { ...book, currentPage: book.totalPages, status: 'completed' as const }
    : book);
  const readingBooks = stableBooks.filter((book) => book.status === 'reading');
  const activeBookId = readingBooks.some((book) => book.id === state.activeBookId)
    ? state.activeBookId
    : readingBooks.at(-1)?.id;

  return {
    profile: state.profile,
    books: stableBooks,
    activeBookId,
    isLampOn: state.isLampOn,
    ambienceMode: state.ambienceMode,
    wallPaletteId: state.wallPaletteId,
    floorPaletteId: state.floorPaletteId,
    rugPaletteId: state.rugPaletteId,
    bookcasePaletteId: state.bookcasePaletteId,
    catId: state.catId,
    leftWallItem: state.leftWallItem,
    leftWallPosterBookId: state.leftWallPosterBookId,
    leftWallWindowStyle: state.leftWallWindowStyle,
    leftWallFrameColor: state.leftWallFrameColor,
    pictureFrameSize: state.pictureFrameSize,
    pictureFrameStyleId: state.pictureFrameStyleId,
    pictureFramePhotoUri: state.pictureFramePhotoUri,
  };
};

const BOOK_COLORS = ['#B95F3B', '#4F7480', '#6D7657', '#6A4D61', '#C58A3C', '#2E4057'];

export const deriveBookColor = (workKey: string) => {
  let hash = 0;
  for (let index = 0; index < workKey.length; index += 1) {
    hash = ((hash << 5) - hash + workKey.charCodeAt(index)) | 0;
  }
  return BOOK_COLORS[Math.abs(hash) % BOOK_COLORS.length];
};

const NEXT_AMBIENCE: Record<AmbienceMode, AmbienceMode> = {
  auto: 'day',
  day: 'sunset',
  sunset: 'night',
  night: 'auto',
};

type LibraryDataState = Pick<
  LibraryState,
  '_hasHydrated' | 'books' | 'activeBookId' | 'completingBookId' | 'isLampOn'
    | 'ambienceMode' | 'wallPaletteId' | 'floorPaletteId' | 'rugPaletteId' | 'bookcasePaletteId'
    | 'catId' | 'leftWallItem' | 'leftWallPosterBookId' | 'leftWallWindowStyle' | 'leftWallFrameColor'
    | 'pictureFrameSize' | 'pictureFrameStyleId' | 'pictureFramePhotoUri' | 'profile'
>;

const initialState: LibraryDataState = {
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
  profile: DEFAULT_PROFILE,
};

export const useLibraryStore = create<LibraryState>()(persist((set) => ({
  ...initialState,
  setAmbienceMode: (mode) => set({ ambienceMode: mode }),
  cycleAmbienceMode: () => set((state) => ({ ambienceMode: NEXT_AMBIENCE[state.ambienceMode] })),
  toggleLamp: () => set((state) => ({ isLampOn: !state.isLampOn })),
  setWallPaletteId: (id) => set({ wallPaletteId: id }),
  setFloorPaletteId: (id) => set({ floorPaletteId: id }),
  setRugPaletteId: (id) => set({ rugPaletteId: id }),
  setBookcasePaletteId: (id) => set({ bookcasePaletteId: id }),
  setCatId: (id) => set({ catId: id }),
  setLeftWallItem: (item) => set({ leftWallItem: item }),
  setLeftWallPosterBookId: (bookId) => set({ leftWallPosterBookId: bookId }),
  setLeftWallWindowStyle: (styleId) => set({ leftWallWindowStyle: styleId }),
  setLeftWallFrameColor: (frameId) => set({ leftWallFrameColor: frameId }),
  setPictureFrameSize: (size) => set({ pictureFrameSize: size }),
  setPictureFrameStyleId: (styleId) => set({ pictureFrameStyleId: styleId }),
  setPictureFramePhotoUri: (uri) => set({ pictureFramePhotoUri: uri }),
  updateProfile: (input) => set((state) => {
    if (input.name !== undefined && !input.name.trim()) return state;
    const next = normalizeProfile({ ...state.profile, ...input });
    return { profile: next };
  }),
  addOpenLibraryBook: (result) => set((state) => {
    if (state.books.some((book) => book.id === result.workKey)) return state;
    if (!result.title.trim() || !Number.isInteger(result.totalPages) || result.totalPages < 1 || result.totalPages > 99_999) return state;
    const newBook: Book = {
      id: result.workKey,
      source: 'open-library',
      openLibraryWorkKey: result.workKey,
      openLibraryEditionKey: result.editionKey,
      coverId: result.coverId,
      coverUrl: result.coverUrl,
      isbn: result.isbn,
      firstPublishYear: result.firstPublishYear,
      title: result.title.trim(),
      author: result.author.trim() || 'Autor desconhecido',
      coverColor: deriveBookColor(result.workKey),
      totalPages: result.totalPages,
      currentPage: 0,
      status: 'reading',
    };
    return {
      activeBookId: result.workKey,
      books: [...state.books, newBook],
    };
  }),
  addCustomBook: (bookData) => set((state) => {
    if (!bookData.title.trim() || !Number.isInteger(bookData.totalPages)
      || bookData.totalPages < 1 || bookData.totalPages > 99_999) return state;
    const id = `custom-${Date.now()}`;
    const newBook: Book = {
      id,
      source: 'manual',
      title: bookData.title.trim(),
      author: bookData.author.trim() || 'Autor desconhecido',
      coverColor: bookData.coverColor || '#B95F3B',
      totalPages: bookData.totalPages,
      currentPage: 0,
      status: 'reading',
    };
    return {
      activeBookId: id,
      books: [...state.books, newBook],
    };
  }),
  updateBookCoverColor: (bookId, color) => set((state) => {
    if (!/^#[0-9A-F]{6}$/i.test(color)) return state;
    return {
      books: state.books.map((book) => book.id === bookId ? { ...book, coverColor: color } : book),
    };
  }),
  removeBook: (bookId) => set((state) => {
    const nextBooks = state.books.filter((book) => book.id !== bookId);
    const nextActive = state.activeBookId === bookId
      ? nextBooks.find((b) => b.status === 'reading')?.id
      : state.activeBookId;
    return {
      books: nextBooks,
      activeBookId: nextActive,
      completingBookId: state.completingBookId === bookId ? undefined : state.completingBookId,
    };
  }),
  selectActiveBook: (bookId) => set((state) => {
    if (state.completingBookId) return state;
    const book = state.books.find((item) => item.id === bookId);
    return book?.status === 'reading' ? { activeBookId: bookId } : state;
  }),
  updateProgress: (bookId, page) => set((state) => ({
    books: state.books.map((book) =>
      book.id === bookId && book.status === 'reading'
        ? { ...book, currentPage: clampPage(page, book.totalPages) }
        : book),
  })),
  updateOpinion: (bookId, input) => set((state) => ({
    books: state.books.map((book) => book.id === bookId ? {
      ...book,
      rating: input.rating === undefined ? book.rating : Math.min(5, Math.max(1, Math.round(input.rating))),
      notes: input.notes === undefined ? book.notes : input.notes,
    } : book),
  })),
  requestCompletion: (bookId) => set((state) => {
    if (state.completingBookId) return state;
    const book = state.books.find((item) => item.id === bookId);
    if (!book || book.status !== 'reading') return state;
    return {
      activeBookId: bookId,
      completingBookId: bookId,
      books: state.books.map((item) => item.id === bookId
        ? { ...item, currentPage: item.totalPages, status: 'completing' }
        : item),
    };
  }),
  finalizeCompletion: (bookId) => set((state) => {
    if (state.completingBookId !== bookId) return state;
    const book = state.books.find((item) => item.id === bookId);
    if (!book) return state;
    const remainingBooks = state.books.filter((item) => item.id !== bookId);
    const nextActiveBook = [...remainingBooks].reverse().find((item) => item.status === 'reading');
    return {
      activeBookId: nextActiveBook?.id,
      completingBookId: undefined,
      books: [...remainingBooks, { ...book, status: 'completed' }],
    };
  }),
}), {
  name: STORAGE_KEY,
  version: STORAGE_VERSION,
  storage: createJSONStorage(() => storage),
  skipHydration: true,
  partialize: (state): PersistedLibraryState => createPersistedState(state),
  migrate: (persistedState) => normalizePersistedState(persistedState),
  merge: (persistedState, currentState) => ({
    ...currentState,
    ...normalizePersistedState(persistedState),
  }),
  onRehydrateStorage: () => (_state, error) => {
    if (error) console.warn('Não foi possível restaurar os dados locais do Bookroom.', error);
    useLibraryStore.setState({ _hasHydrated: true });
  },
}));
