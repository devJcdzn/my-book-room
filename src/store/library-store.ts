import { trackEvent } from '../services/analytics';
import { ONBOARDING_STEPS, ONBOARDING_VERSION, normalizeOnboardingAnswers, normalizeOnboardingStep, type OnboardingAnswers } from '@/src/utils/onboarding';
import { normalizeAvatar, type ProfileAvatar } from '@/src/types/profile-avatar';
import { createDefaultRoomLayout, isRoomPlacementValid, normalizeRoomLayout, type RoomLayout } from '@/src/types/room-layout';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Book, BookSearchResult, ReadingEntry, ReadingFolder, ReadingSession, ReadingTimer } from '@/src/types/book';
import { READING_FOLDER_COLORS, READING_NOTE_COLORS } from '@/src/utils/reading-note';
import { DEFAULT_LIBRARY_PALETTE_ID, LIBRARY_PALETTES } from '@/src/library-palette';
import { localDateKey, normalizeReadingDays } from '@/src/utils/reading-days';
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

export type AmbienceMode = 'auto' | 'day' | 'night';
export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';

export { ONBOARDING_VERSION } from '@/src/utils/onboarding';
export const READING_DESK_CAPACITY = 3;

type LibraryState = {
  _hasHydrated: boolean;
  roomLayout: RoomLayout;
  setRoomLayout: (layout: RoomLayout) => void;
  books: Book[];
  readingFolders: ReadingFolder[];
  readingSessions: ReadingSession[];
  activeReadingTimer?: ReadingTimer;
  readingDays: string[];
  wantToReadShelves: string[];
  readingShelves: string[];
  completedShelves: string[];
  shelfNames: Record<string, string>;
  libraryBackgroundId: string;
  deskBookIds: string[];
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
  onboardingVersion: number;
  onboardingStatus: OnboardingStatus;
  onboardingStep: number;
  onboardingAnswers: OnboardingAnswers;
  setOnboardingAnswers: (answers: Partial<OnboardingAnswers>) => void;
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
  setLibraryBackgroundId: (id: string) => void;
  addLibraryShelf: (status: 'want-to-read' | 'reading' | 'completed') => string;
  renameLibraryShelf: (shelfId: string, name: string) => void;
  removeLibraryShelf: (status: 'want-to-read' | 'reading' | 'completed', shelfId: string) => boolean;
  moveBookToShelf: (bookId: string, shelfId: string) => void;
  updateProfile: (profile: ProfileInput) => void;
  setOnboardingStep: (step: number) => void;
  completeOnboarding: () => void;
  skipOnboarding: () => void;
  restartOnboarding: () => void;
  addOpenLibraryBook: (book: BookSearchResult & { totalPages: number }, options?: { status?: 'want-to-read' | 'reading' | 'completed'; shelfId?: string; rating?: number; notes?: string }) => void;
  addCustomBook: (book: { title: string; author: string; coverColor: string; totalPages: number; isbn?: string }, shelfId?: string, status?: 'want-to-read' | 'reading') => void;
  updateBookCoverColor: (bookId: string, color: string) => void;
  removeBook: (bookId: string) => void;
  removeFromDesk: (bookId: string) => void;
  selectActiveBook: (bookId: string) => boolean;
  startReadingTimer: (bookId: string) => boolean;
  pauseReadingTimer: () => void;
  resumeReadingTimer: () => void;
  finishReadingTimer: () => void;
  discardReadingTimer: () => void;
  saveReadingSession: (input: { name: string; description?: string; endingPage: number }) => ReadingSession | undefined;
  updateReadingSession: (sessionId: string, input: { name: string; description?: string; endingPage: number }) => void;
  removeReadingSession: (sessionId: string) => void;
  updateProgress: (bookId: string, currentPage: number) => void;
  updateTotalPages: (bookId: string, totalPages: number) => void;
  updateOpinion: (bookId: string, input: { rating?: number | null; notes?: string }) => void;
  completeBook: (bookId: string, input?: { rating?: number | null; notes?: string }) => void;
  addReadingEntry: (bookId: string, input: { title?: string; text: string; page?: number; isFavorite?: boolean; color?: string; folderId?: string }) => void;
  updateReadingEntry: (bookId: string, entryId: string, input: { title?: string; text: string; page?: number; isFavorite?: boolean; color?: string; folderId?: string }) => void;
  removeReadingEntry: (bookId: string, entryId: string) => void;
  toggleReadingEntryFavorite: (bookId: string, entryId: string) => void;
  addReadingFolder: (input: { name: string; colorId: string }) => string | undefined;
  requestCompletion: (bookId: string) => void;
  finalizeCompletion: (bookId: string) => void;
};

export type Profile = {
  avatar?: ProfileAvatar;
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
const GUEST_STORAGE_KEY = 'bookroom-library-v1';

export type LibraryStorageScope = 'guest' | `user:${string}`;

const storageKeyForScope = (scope: LibraryStorageScope) =>
  scope === 'guest' ? GUEST_STORAGE_KEY : `bookroom-library-v1:${scope}`;

type PersistedLibraryFields = Pick<
  LibraryState,
  | 'roomLayout'
  | 'profile'
  | 'books'
  | 'readingFolders'
  | 'readingSessions'
  | 'activeReadingTimer'
  | 'readingDays'
  | 'wantToReadShelves'
  | 'readingShelves'
  | 'completedShelves'
  | 'shelfNames'
  | 'libraryBackgroundId'
  | 'deskBookIds'
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
  | 'onboardingVersion'
  | 'onboardingStatus'
  | 'onboardingStep'
  | 'onboardingAnswers'
>;

export type PersistedLibraryState = Omit<
  PersistedLibraryFields,
  'roomLayout' | 'onboardingVersion' | 'onboardingStatus' | 'onboardingStep' | 'onboardingAnswers' | 'wantToReadShelves' | 'readingShelves' | 'completedShelves' | 'shelfNames' | 'libraryBackgroundId' | 'readingFolders'
> & Partial<Pick<PersistedLibraryFields, 'roomLayout' | 'onboardingVersion' | 'onboardingStatus' | 'onboardingStep' | 'onboardingAnswers' | 'readingDays' | 'wantToReadShelves' | 'readingShelves' | 'completedShelves' | 'shelfNames' | 'libraryBackgroundId' | 'deskBookIds' | 'readingFolders' | 'readingSessions' | 'activeReadingTimer'>>;

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
  const avatar = normalizeAvatar(candidate.avatar);
  return {
    ...(avatar ? { avatar } : {}),
    name: trimToLimit(candidate.name, DEFAULT_PROFILE.name, PROFILE_LIMITS.name) || DEFAULT_PROFILE.name,
    bio: trimToLimit(candidate.bio, DEFAULT_PROFILE.bio, PROFILE_LIMITS.bio),
    bioAttribution: trimToLimit(candidate.bioAttribution, DEFAULT_PROFILE.bioAttribution, PROFILE_LIMITS.bioAttribution),
  };
};

const isBookStatus = (value: unknown): value is Book['status'] =>
  value === 'want-to-read' || value === 'reading' || value === 'completed';

const shelvesForStatus = (status: Book['status'], shelves: {
  wantToReadShelves: string[];
  readingShelves: string[];
  completedShelves: string[];
}) => status === 'completed'
  ? shelves.completedShelves
  : status === 'want-to-read'
    ? shelves.wantToReadShelves
    : shelves.readingShelves;

const MAX_BOOKS_PER_SHELF = 10;
type LibraryShelfStatus = 'want-to-read' | 'reading' | 'completed';

const createShelfId = (status: LibraryShelfStatus) =>
  `${status}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const allocateBookShelf = (
  state: Pick<LibraryState, 'books' | 'wantToReadShelves' | 'readingShelves' | 'completedShelves'>,
  status: LibraryShelfStatus,
  requestedShelfId?: string,
  excludedBookId?: string,
) => {
  const wantToReadShelves = [...state.wantToReadShelves];
  let readingShelves = [...state.readingShelves];
  let completedShelves = [...state.completedShelves];
  const statusShelves = status === 'want-to-read' ? wantToReadShelves
    : status === 'completed' ? completedShelves : readingShelves;
  const targetShelfId = statusShelves.includes(requestedShelfId ?? '') ? requestedShelfId! : statusShelves[0];

  if (status === 'want-to-read') {
    const shelfBookCount = state.books.filter((book) => book.id !== excludedBookId
      && book.status === 'want-to-read' && book.shelfId === targetShelfId).length;
    if (shelfBookCount >= MAX_BOOKS_PER_SHELF) {
      const targetIndex = wantToReadShelves.indexOf(targetShelfId);
      const newShelfId = createShelfId(status);
      wantToReadShelves.splice(targetIndex + 1, 0, newShelfId);
      return { shelfId: newShelfId, wantToReadShelves };
    }
    return { shelfId: targetShelfId, wantToReadShelves };
  }

  const targetIndex = statusShelves.indexOf(targetShelfId);
  const shelfGroupIds = [readingShelves[targetIndex], completedShelves[targetIndex]].filter(Boolean);
  const shelfBookCount = state.books.filter((book) => book.id !== excludedBookId
    && book.status !== 'want-to-read' && shelfGroupIds.includes(book.shelfId ?? '')).length;
  if (shelfBookCount < MAX_BOOKS_PER_SHELF) {
    return { shelfId: targetShelfId, readingShelves, completedShelves };
  }

  const shelfCount = Math.max(readingShelves.length, completedShelves.length);
  while (readingShelves.length < shelfCount) readingShelves.push(createShelfId('reading'));
  while (completedShelves.length < shelfCount) completedShelves.push(createShelfId('completed'));
  const newReadingShelfId = createShelfId('reading');
  const newCompletedShelfId = createShelfId('completed');
  readingShelves.splice(targetIndex + 1, 0, newReadingShelfId);
  completedShelves.splice(targetIndex + 1, 0, newCompletedShelfId);
  return {
    shelfId: status === 'completed' ? newCompletedShelfId : newReadingShelfId,
    readingShelves,
    completedShelves,
  };
};

const normalizeReadingEntry = (value: unknown, totalPages: number): ReadingEntry | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<ReadingEntry>;
  const title = typeof candidate.title === 'string' ? candidate.title.trim() : '';
  const text = typeof candidate.text === 'string' ? candidate.text.trim() : '';
  if (typeof candidate.id !== 'string' || !candidate.id.trim()
    || (!title && !text)
    || typeof candidate.createdAt !== 'string' || !Number.isFinite(Date.parse(candidate.createdAt))) return undefined;
  return {
    id: candidate.id,
    title: title || undefined,
    text,
    createdAt: candidate.createdAt,
    page: typeof candidate.page === 'number' && Number.isInteger(candidate.page)
      && candidate.page >= 1 && candidate.page <= totalPages ? candidate.page : undefined,
    isFavorite: candidate.isFavorite === true,
    color: typeof candidate.color === 'string' && READING_NOTE_COLORS.includes(candidate.color as typeof READING_NOTE_COLORS[number])
      ? candidate.color : undefined,
    folderId: typeof candidate.folderId === 'string' && candidate.folderId.trim() ? candidate.folderId : undefined,
  };
};

const normalizeReadingFolders = (value: unknown): ReadingFolder[] => {
  if (!Array.isArray(value)) return [];
  const colorIds = new Set(READING_FOLDER_COLORS.map((color) => color.id));
  const seen = new Set<string>();
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Partial<ReadingFolder>;
    const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
    const name = typeof candidate.name === 'string' ? candidate.name.trim().slice(0, 32) : '';
    if (!id || !name || seen.has(id) || typeof candidate.colorId !== 'string' || !colorIds.has(candidate.colorId as typeof READING_FOLDER_COLORS[number]['id'])) return [];
    seen.add(id);
    return [{ id, name, colorId: candidate.colorId }];
  });
};

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
    readingEntries: Array.isArray(candidate.readingEntries)
      ? candidate.readingEntries.map((entry) => normalizeReadingEntry(entry, totalPages))
        .filter((entry): entry is ReadingEntry => Boolean(entry))
      : [],
  };
};

const isValidDate = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));

const normalizeReadingTimer = (value: unknown): ReadingTimer | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const timer = value as Partial<ReadingTimer>;
  if (typeof timer.id !== 'string' || !timer.id.trim()
    || typeof timer.bookId !== 'string' || !timer.bookId.trim()
    || typeof timer.bookTitle !== 'string' || !timer.bookTitle.trim()
    || typeof timer.bookAuthor !== 'string'
    || typeof timer.coverColor !== 'string' || !/^#[0-9A-F]{6}$/i.test(timer.coverColor)
    || !Number.isInteger(timer.totalPages) || (timer.totalPages ?? 0) < 1
    || !Number.isInteger(timer.startingPage) || (timer.startingPage ?? -1) < 0
    || (timer.startingPage ?? 0) > (timer.totalPages ?? 0)
    || !isValidDate(timer.startedAt)
    || !['running', 'paused', 'review'].includes(timer.phase ?? '')
    || typeof timer.elapsedMs !== 'number' || !Number.isFinite(timer.elapsedMs) || timer.elapsedMs < 0) return undefined;
  if (timer.phase === 'running' && !isValidDate(timer.segmentStartedAt)) return undefined;
  if (timer.phase === 'review' && !isValidDate(timer.endedAt)) return undefined;
  return {
    id: timer.id,
    bookId: timer.bookId,
    bookTitle: timer.bookTitle.trim(),
    bookAuthor: timer.bookAuthor.trim() || 'Autor desconhecido',
    coverUrl: typeof timer.coverUrl === 'string' ? timer.coverUrl : undefined,
    coverColor: timer.coverColor,
    totalPages: timer.totalPages!,
    startingPage: timer.startingPage!,
    startedAt: timer.startedAt,
    phase: timer.phase as ReadingTimer['phase'],
    elapsedMs: Math.round(timer.elapsedMs),
    segmentStartedAt: isValidDate(timer.segmentStartedAt) ? timer.segmentStartedAt : undefined,
    endedAt: isValidDate(timer.endedAt) ? timer.endedAt : undefined,
  };
};

const normalizeReadingSession = (value: unknown): ReadingSession | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const session = value as Partial<ReadingSession>;
  const name = typeof session.name === 'string' ? session.name.trim().slice(0, 80) : '';
  if (typeof session.id !== 'string' || !session.id.trim()
    || typeof session.bookId !== 'string' || !session.bookId.trim()
    || typeof session.bookTitle !== 'string' || !session.bookTitle.trim()
    || typeof session.bookAuthor !== 'string'
    || typeof session.coverColor !== 'string' || !/^#[0-9A-F]{6}$/i.test(session.coverColor)
    || !Number.isInteger(session.totalPages) || (session.totalPages ?? 0) < 1
    || !name || !Number.isInteger(session.startingPage) || (session.startingPage ?? -1) < 0
    || !Number.isInteger(session.endingPage) || (session.endingPage ?? -1) < (session.startingPage ?? 0)
    || (session.endingPage ?? 0) > (session.totalPages ?? 0)
    || session.pagesRead !== (session.endingPage ?? 0) - (session.startingPage ?? 0)
    || !isValidDate(session.startedAt) || !isValidDate(session.endedAt)
    || typeof session.durationSeconds !== 'number' || !Number.isInteger(session.durationSeconds) || session.durationSeconds < 0) return undefined;
  return {
    id: session.id,
    bookId: session.bookId,
    bookTitle: session.bookTitle.trim(),
    bookAuthor: session.bookAuthor.trim() || 'Autor desconhecido',
    coverUrl: typeof session.coverUrl === 'string' ? session.coverUrl : undefined,
    coverColor: session.coverColor,
    totalPages: session.totalPages!,
    name,
    description: typeof session.description === 'string' ? session.description.trim().slice(0, 500) || undefined : undefined,
    startingPage: session.startingPage!,
    endingPage: session.endingPage!,
    pagesRead: session.pagesRead!,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationSeconds: session.durationSeconds,
  };
};

export const getReadingTimerElapsedMs = (timer: ReadingTimer, now = Date.now()) => {
  const segmentStartedAt = timer.phase === 'running' && timer.segmentStartedAt
    ? Date.parse(timer.segmentStartedAt)
    : now;
  return timer.elapsedMs + (timer.phase === 'running' ? Math.max(0, now - segmentStartedAt) : 0);
};

export const normalizePersistedState = (value: unknown): PersistedLibraryState => {
  const candidate = value && typeof value === 'object' ? value as Partial<PersistedLibraryState> : {};
  const requestedAmbience = (candidate as { ambienceMode?: unknown }).ambienceMode;
  const books = Array.isArray(candidate.books)
    ? candidate.books.map(normalizeBook).filter((book): book is Book => Boolean(book))
    : [];
  const readingShelves = normalizeShelfIds(candidate.readingShelves, 'reading-default');
  const completedShelves = normalizeShelfIds(candidate.completedShelves, 'completed-default');
  const wantToReadShelves = normalizeShelfIds(candidate.wantToReadShelves, 'want-to-read-default');
  const readingFolders = normalizeReadingFolders(candidate.readingFolders);
  const readingFolderIds = new Set(readingFolders.map((folder) => folder.id));
  const booksWithFolders = books.map((book) => ({
    ...book,
    readingEntries: (book.readingEntries ?? []).map((entry) => ({
      ...entry,
      folderId: entry.folderId && readingFolderIds.has(entry.folderId) ? entry.folderId : undefined,
    })),
  }));
  const shelfIds = new Set([...wantToReadShelves, ...readingShelves, ...completedShelves]);
  const shelfNames = normalizeShelfNames(candidate.shelfNames, shelfIds);
  const normalizedBooks = booksWithFolders.map((book) => {
    const shelves = shelvesForStatus(book.status, { wantToReadShelves, readingShelves, completedShelves });
    return { ...book, shelfId: shelves.includes(book.shelfId ?? '') ? book.shelfId : shelves[0] };
  });
  const readingBooks = normalizedBooks.filter((book) => book.status === 'reading');
  const requestedActive = typeof candidate.activeBookId === 'string'
    ? readingBooks.find((book) => book.id === candidate.activeBookId)
    : undefined;
  const readingBookIds = new Set(readingBooks.map((book) => book.id));
  const requestedDeskIds = Array.isArray(candidate.deskBookIds)
    ? candidate.deskBookIds.filter((id): id is string => typeof id === 'string' && readingBookIds.has(id))
    : readingBooks.filter((book) => book.currentPage > 0).map((book) => book.id);
  const deskBookIds = [...new Set(requestedDeskIds)].slice(-READING_DESK_CAPACITY);
  if (requestedActive && (Array.isArray(candidate.deskBookIds) || requestedActive.currentPage > 0)
    && !deskBookIds.includes(requestedActive.id)) {
    deskBookIds.splice(0, Math.max(0, deskBookIds.length - 2), requestedActive.id);
  }
  const activeBookId = requestedActive && deskBookIds.includes(requestedActive.id)
    ? requestedActive.id
    : undefined;

  return {
    roomLayout: normalizeRoomLayout(candidate.roomLayout, candidate),
    profile: normalizeProfile(candidate.profile),
    books: normalizedBooks,
    readingFolders,
    readingSessions: Array.isArray(candidate.readingSessions)
      ? candidate.readingSessions.map(normalizeReadingSession).filter((session): session is ReadingSession => Boolean(session))
      : [],
    activeReadingTimer: normalizeReadingTimer(candidate.activeReadingTimer),
    readingDays: normalizeReadingDays(candidate.readingDays),
    wantToReadShelves,
    readingShelves,
    completedShelves,
    shelfNames,
    libraryBackgroundId: LIBRARY_PALETTES.some((palette) => palette.id === candidate.libraryBackgroundId)
      ? candidate.libraryBackgroundId!
      : DEFAULT_LIBRARY_PALETTE_ID,
    deskBookIds,
    activeBookId,
    isLampOn: typeof candidate.isLampOn === 'boolean' ? candidate.isLampOn : true,
    ambienceMode: requestedAmbience === 'sunset'
      ? 'day'
      : requestedAmbience === 'day' || requestedAmbience === 'night'
        ? requestedAmbience
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
    onboardingVersion: ONBOARDING_VERSION,
    onboardingStatus: candidate.onboardingStatus === 'in_progress'
      || candidate.onboardingStatus === 'completed'
      || candidate.onboardingStatus === 'skipped'
      ? candidate.onboardingStatus
      : 'not_started',
    onboardingStep: normalizeOnboardingStep(candidate.onboardingStep, candidate.onboardingVersion, candidate.onboardingStatus),
    onboardingAnswers: normalizeOnboardingAnswers(candidate.onboardingAnswers),
  };
};

export const createPersistedState = (state: Omit<PersistedLibraryState, 'readingDays' | 'deskBookIds' | 'readingSessions' | 'activeReadingTimer'> & Partial<Pick<PersistedLibraryState, 'readingSessions' | 'activeReadingTimer'>> & { readingDays?: string[]; deskBookIds?: string[]; completingBookId?: string }): PersistedLibraryState => {
  const readingFolders = normalizeReadingFolders(state.readingFolders);
  const readingFolderIds = new Set(readingFolders.map((folder) => folder.id));
  const stableBooks = state.books.map((book) => book.status === 'completing'
    ? { ...book, currentPage: book.totalPages, status: 'completed' as const }
    : book);
  const readingBooks = stableBooks.filter((book) => book.status === 'reading');
  const readingBookIds = new Set(readingBooks.map((book) => book.id));
  const deskBookIds = [...new Set((state.deskBookIds ?? []).filter((id) => readingBookIds.has(id)))].slice(-READING_DESK_CAPACITY);
  const activeBookId = readingBooks.some((book) => book.id === state.activeBookId)
    && deskBookIds.includes(state.activeBookId!) ? state.activeBookId : undefined;

  const readingShelves = normalizeShelfIds(state.readingShelves, 'reading-default');
  const completedShelves = normalizeShelfIds(state.completedShelves, 'completed-default');
  const wantToReadShelves = normalizeShelfIds(state.wantToReadShelves, 'want-to-read-default');
  const shelfIds = new Set([...wantToReadShelves, ...readingShelves, ...completedShelves]);
  return {
    profile: state.profile,
    readingFolders,
    readingSessions: (state.readingSessions ?? []).map(normalizeReadingSession)
      .filter((session): session is ReadingSession => Boolean(session)),
    activeReadingTimer: normalizeReadingTimer(state.activeReadingTimer),
    books: stableBooks.map((book) => {
      const shelves = shelvesForStatus(book.status, { wantToReadShelves, readingShelves, completedShelves });
      return {
        ...book,
        shelfId: shelves.includes(book.shelfId ?? '') ? book.shelfId : shelves[0],
        readingEntries: (book.readingEntries ?? []).map((entry) => ({
          ...entry,
          folderId: entry.folderId && readingFolderIds.has(entry.folderId) ? entry.folderId : undefined,
        })),
      };
    }),
    readingDays: state.readingDays ?? [],
    wantToReadShelves,
    readingShelves,
    completedShelves,
    shelfNames: normalizeShelfNames(state.shelfNames, shelfIds),
    libraryBackgroundId: state.libraryBackgroundId ?? DEFAULT_LIBRARY_PALETTE_ID,
    deskBookIds,
    activeBookId,
    roomLayout: state.roomLayout ?? createDefaultRoomLayout(state),
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
    onboardingVersion: state.onboardingVersion ?? ONBOARDING_VERSION,
    onboardingStatus: state.onboardingStatus ?? 'not_started',
    onboardingStep: state.onboardingStep ?? 0,
    onboardingAnswers: normalizeOnboardingAnswers(state.onboardingAnswers),
  };
};

const BOOK_COLORS = ['#B95F3B', '#4F7480', '#6D7657', '#6A4D61', '#C58A3C', '#2E4057'];

const normalizeShelfIds = (value: unknown, fallback: string): string[] => {
  const ids = Array.isArray(value)
    ? [...new Set(value.filter((id): id is string => typeof id === 'string' && id.trim().length > 0))]
    : [];
  return ids.length ? ids : [fallback];
};

const normalizeShelfNames = (value: unknown, shelfIds: Set<string>): Record<string, string> => {
  const candidate = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.fromEntries([...shelfIds].map((id) => {
    const name = candidate[id];
    return [id, typeof name === 'string' && name.trim() ? name.trim().slice(0, 40) : ''];
  }).filter(([, name]) => name));
};

export const deriveBookColor = (workKey: string) => {
  let hash = 0;
  for (let index = 0; index < workKey.length; index += 1) {
    hash = ((hash << 5) - hash + workKey.charCodeAt(index)) | 0;
  }
  return BOOK_COLORS[Math.abs(hash) % BOOK_COLORS.length];
};

const NEXT_AMBIENCE: Record<AmbienceMode, AmbienceMode> = {
  auto: 'day',
  day: 'night',
  night: 'auto',
};

type LibraryDataState = Pick<
  LibraryState,
  'roomLayout' | '_hasHydrated' | 'books' | 'deskBookIds' | 'activeBookId' | 'completingBookId' | 'isLampOn'
    | 'readingSessions' | 'activeReadingTimer'
    | 'ambienceMode' | 'wallPaletteId' | 'floorPaletteId' | 'rugPaletteId' | 'bookcasePaletteId'
    | 'catId' | 'leftWallItem' | 'leftWallPosterBookId' | 'leftWallWindowStyle' | 'leftWallFrameColor'
    | 'pictureFrameSize' | 'pictureFrameStyleId' | 'pictureFramePhotoUri' | 'profile'
    | 'onboardingVersion' | 'onboardingStatus' | 'onboardingStep' | 'onboardingAnswers' | 'readingDays'
    | 'wantToReadShelves' | 'readingShelves' | 'completedShelves' | 'shelfNames' | 'libraryBackgroundId' | 'readingFolders'
>;

const initialState: LibraryDataState = {
  _hasHydrated: false,
  roomLayout: createDefaultRoomLayout(),
  books: [],
  readingFolders: [],
  readingSessions: [],
  activeReadingTimer: undefined,
  readingDays: [],
  wantToReadShelves: ['want-to-read-default'],
  readingShelves: ['reading-default'],
  completedShelves: ['completed-default'],
  shelfNames: {},
  libraryBackgroundId: DEFAULT_LIBRARY_PALETTE_ID,
  deskBookIds: [],
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
  onboardingVersion: ONBOARDING_VERSION,
  onboardingStatus: 'not_started',
  onboardingStep: 0,
  onboardingAnswers: {},
};

export const isDefaultLibrarySnapshot = (snapshot: PersistedLibraryState) => (
  JSON.stringify(snapshot.roomLayout ?? createDefaultRoomLayout()) === JSON.stringify(createDefaultRoomLayout())
  && snapshot.books.length === 0
  && (snapshot.readingFolders?.length ?? 0) === 0
  && (snapshot.readingSessions?.length ?? 0) === 0
  && !snapshot.activeReadingTimer
  && snapshot.readingDays.length === 0
  && (snapshot.readingShelves?.length ?? 1) === 1
  && (snapshot.wantToReadShelves?.length ?? 1) === 1
  && (snapshot.completedShelves?.length ?? 1) === 1
  && Object.keys(snapshot.shelfNames ?? {}).length === 0
  && (snapshot.libraryBackgroundId ?? DEFAULT_LIBRARY_PALETTE_ID) === DEFAULT_LIBRARY_PALETTE_ID
  && !snapshot.profile.avatar
  && snapshot.profile.name === DEFAULT_PROFILE.name
  && snapshot.profile.bio === DEFAULT_PROFILE.bio
  && snapshot.profile.bioAttribution === DEFAULT_PROFILE.bioAttribution
  && snapshot.wallPaletteId === DEFAULT_WALL_PALETTE_ID
  && snapshot.floorPaletteId === DEFAULT_FLOOR_PALETTE_ID
  && snapshot.rugPaletteId === DEFAULT_RUG_PALETTE_ID
  && snapshot.bookcasePaletteId === DEFAULT_BOOKCASE_PALETTE_ID
  && snapshot.catId === DEFAULT_CAT_ID
  && snapshot.leftWallItem === DEFAULT_LEFT_WALL_ITEM
  && snapshot.pictureFramePhotoUri === null
  && snapshot.onboardingStatus === 'not_started'
  && snapshot.onboardingStep === 0
  && Object.keys(snapshot.onboardingAnswers ?? {}).length === 0
);

export const useLibraryStore = create<LibraryState>()(persist((set) => ({
  ...initialState,
  setAmbienceMode: (mode) => set({ ambienceMode: mode }),
  cycleAmbienceMode: () => set((state) => ({ ambienceMode: NEXT_AMBIENCE[state.ambienceMode] })),
  toggleLamp: () => set((state) => ({ isLampOn: !state.isLampOn })),
  setRoomLayout: (layout) => set({ roomLayout: normalizeRoomLayout(layout) }),
  setWallPaletteId: (id) => set({ wallPaletteId: id }),
  setFloorPaletteId: (id) => set({ floorPaletteId: id }),
  setRugPaletteId: (id) => set({ rugPaletteId: id }),
  setBookcasePaletteId: (id) => set({ bookcasePaletteId: id }),
  setCatId: (id) => set({ catId: id }),
  setLeftWallItem: (item) => set(state=>{
    const layout=state.roomLayout;
    const additions=createDefaultRoomLayout({leftWallItem:item,pictureFrameSize:'none',leftWallPosterBookId:state.leftWallPosterBookId}).pieces.filter(p=>p.category==='window'||p.id==='poster');
    const pieces=layout.pieces.filter(p=>item==='none'?p.id!=='window'&&p.id!=='poster':p.id!==(item==='window'?'window':'poster'));
    for(const p of additions) {
      // Legacy toggle uses the same wall slot, while the editor supports both items independently.
      const free=pieces.filter(other=>isRoomPlacementValid(p,[other]));
      pieces.splice(0,pieces.length,...free,p);
    }
    return {leftWallItem:item,roomLayout:normalizeRoomLayout({...layout,pieces})};
  }),
  setLeftWallPosterBookId: (bookId) => set(state=>({ leftWallPosterBookId:bookId,roomLayout:{...state.roomLayout,pieces:state.roomLayout.pieces.map(p=>p.id==='poster'?{...p,bookId:bookId??'first-book'}:p)} })),
  setLeftWallWindowStyle: (styleId) => set({ leftWallWindowStyle: styleId }),
  setLeftWallFrameColor: (frameId) => set({ leftWallFrameColor: frameId }),
  setPictureFrameSize: (size) => set(state=>({ pictureFrameSize:size,roomLayout:{...state.roomLayout,legacyPhoto:state.roomLayout.pieces.find(p=>p.id==='frame')?.photo??state.roomLayout.legacyPhoto,pieces:size==='none'?state.roomLayout.pieces.filter(p=>p.id!=='frame'):state.roomLayout.pieces.some(p=>p.id==='frame')?state.roomLayout.pieces.map(p=>p.id==='frame'?{...p,aspect:size==='2:1'?'portrait' as const:'square' as const}:p):[...state.roomLayout.pieces,{...createDefaultRoomLayout({pictureFramePhotoUri:state.pictureFramePhotoUri}).pieces.find(p=>p.id==='frame')!,photo:state.roomLayout.legacyPhoto}]}})),
  setPictureFrameStyleId: (styleId) => set({ pictureFrameStyleId: styleId }),
  setPictureFramePhotoUri: (uri) => set(state=>({pictureFramePhotoUri:uri,roomLayout:{...state.roomLayout,pieces:state.roomLayout.pieces.map(p=>p.id==='frame'?{...p,photoUri:uri??undefined,photo:uri?undefined:{source:'none' as const,version:`${Date.now()}`,pending:true,previousPath:p.photo?.storagePath??p.photo?.previousPath},bookId:undefined}:p)}})),
  setLibraryBackgroundId: (id) => {
    if (LIBRARY_PALETTES.some((palette) => palette.id === id)) set({ libraryBackgroundId: id });
  },
  addLibraryShelf: (status) => {
    const id = createShelfId(status);
    set((state) => status === 'reading'
      ? { readingShelves: [...state.readingShelves, id] }
      : status === 'completed'
        ? { completedShelves: [...state.completedShelves, id] }
        : { wantToReadShelves: [...state.wantToReadShelves, id] });
    return id;
  },
  renameLibraryShelf: (shelfId, name) => set((state) => {
    const trimmedName = name.trim().slice(0, 40);
    if (!trimmedName || !state.readingShelves.includes(shelfId)
      && !state.completedShelves.includes(shelfId) && !state.wantToReadShelves.includes(shelfId)) return state;
    return { shelfNames: { ...state.shelfNames, [shelfId]: trimmedName } };
  }),
  removeLibraryShelf: (status, shelfId) => {
    let removed = false;
    set((state) => {
      const shelves = status === 'reading' ? state.readingShelves
        : status === 'completed' ? state.completedShelves : state.wantToReadShelves;
      if (shelves[0] === shelfId || !shelves.includes(shelfId) || state.books.some((book) => book.shelfId === shelfId)) return state;
      const shelfNames = { ...state.shelfNames };
      delete shelfNames[shelfId];
      removed = true;
      return status === 'reading'
        ? { readingShelves: shelves.filter((id) => id !== shelfId), shelfNames }
        : status === 'completed'
          ? { completedShelves: shelves.filter((id) => id !== shelfId), shelfNames }
          : { wantToReadShelves: shelves.filter((id) => id !== shelfId), shelfNames };
    });
    return removed;
  },
  moveBookToShelf: (bookId, shelfId) => set((state) => {
    const book = state.books.find((item) => item.id === bookId);
    if (!book) return state;
    const shelves = shelvesForStatus(book.status, state);
    if (!shelves.includes(shelfId)) return state;
    if (book.shelfId === shelfId) return state;
    const allocation = allocateBookShelf(state, book.status === 'completing' ? 'reading' : book.status, shelfId, bookId);
    return {
      ...allocation,
      books: state.books.map((item) => item.id === bookId ? { ...item, shelfId: allocation.shelfId } : item),
    };
  }),
  updateProfile: (input) => set((state) => {
    if (input.name !== undefined && !input.name.trim()) return state;
    const next = normalizeProfile({ ...state.profile, ...input });
    return { profile: next };
  }),
  setOnboardingAnswers: (answers) => set((state) => ({
    onboardingAnswers: normalizeOnboardingAnswers({ ...state.onboardingAnswers, ...answers }),
  })),
  setOnboardingStep: (step) => set((state) => {
    if (state.onboardingStatus === 'not_started') trackEvent('onboarding_started', { version: ONBOARDING_VERSION });
    return {
      onboardingVersion: ONBOARDING_VERSION,
      onboardingStatus: 'in_progress',
      onboardingStep: normalizeOnboardingStep(step, ONBOARDING_VERSION, 'in_progress'),
    };
  }),
  completeOnboarding: () => set((state) => {
    if (state.onboardingStatus === 'completed') return state;
    trackEvent('onboarding_completed', { final_step: state.onboardingStep });
    return {
      onboardingVersion: ONBOARDING_VERSION,
      onboardingStatus: 'completed',
      onboardingStep: ONBOARDING_STEPS - 1,
    };
  }),
  skipOnboarding: () => set((state) => {
    if (state.onboardingStatus === 'skipped') return state;
    trackEvent('onboarding_skipped', { final_step: state.onboardingStep });
    return {
      onboardingVersion: ONBOARDING_VERSION,
      onboardingStatus: 'skipped',
    };
  }),
  restartOnboarding: () => {
    trackEvent('onboarding_started', { version: ONBOARDING_VERSION });
    set({
      onboardingVersion: ONBOARDING_VERSION,
      onboardingStatus: 'in_progress',
      onboardingStep: 0,
    });
  },
  addOpenLibraryBook: (result, options = {}) => set((state) => {
    if (state.books.some((book) => book.id === result.workKey)) return state;
    if (!result.title.trim() || !Number.isInteger(result.totalPages) || result.totalPages < 1 || result.totalPages > 99_999) return state;
    const status = options.status ?? 'reading';
    const allocation = allocateBookShelf(state, status, options.shelfId);
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
      currentPage: status === 'completed' ? result.totalPages : 0,
      status,
      shelfId: allocation.shelfId,
      rating: options.rating,
      notes: options.notes?.trim() || undefined,
    };
    trackEvent('book_added', { source: 'catalog', status });
    return { ...allocation, books: [...state.books, newBook] };
  }),
  addCustomBook: (bookData, requestedShelfId, status = 'reading') => set((state) => {
    if (!bookData.title.trim() || !Number.isInteger(bookData.totalPages)
      || bookData.totalPages < 1 || bookData.totalPages > 99_999) return state;
    const id = `custom-${Date.now()}`;
    const allocation = allocateBookShelf(state, status, requestedShelfId);
    const newBook: Book = {
      id,
      source: 'manual',
      isbn: bookData.isbn?.trim() || undefined,
      title: bookData.title.trim(),
      author: bookData.author.trim() || 'Autor desconhecido',
      coverColor: bookData.coverColor || '#B95F3B',
      totalPages: bookData.totalPages,
      currentPage: 0,
      status,
      shelfId: allocation.shelfId,
    };
    trackEvent('book_added', { source: 'manual', status });
    return { ...allocation, books: [...state.books, newBook] };
  }),
  updateBookCoverColor: (bookId, color) => set((state) => {
    if (!/^#[0-9A-F]{6}$/i.test(color)) return state;
    return {
      books: state.books.map((book) => book.id === bookId ? { ...book, coverColor: color } : book),
    };
  }),
  removeBook: (bookId) => set((state) => {
    const nextBooks = state.books.filter((book) => book.id !== bookId);
    const nextActive = state.activeBookId === bookId ? undefined : state.activeBookId;
    return {
      books: nextBooks,
      deskBookIds: state.deskBookIds.filter((id) => id !== bookId),
      activeBookId: nextActive,
      completingBookId: state.completingBookId === bookId ? undefined : state.completingBookId,
    };
  }),
  removeFromDesk: (bookId) => set((state) => ({
    deskBookIds: state.deskBookIds.filter((id) => id !== bookId),
    activeBookId: state.activeBookId === bookId ? undefined : state.activeBookId,
  })),
  selectActiveBook: (bookId) => {
    let selected = false;
    set((state) => {
      if (state.completingBookId) return state;
      const book = state.books.find((item) => item.id === bookId);
      if (!book || book.status === 'completed' || book.status === 'completing') return state;
      if (!state.deskBookIds.includes(bookId) && state.deskBookIds.length >= READING_DESK_CAPACITY) return state;

      const deskBookIds = state.deskBookIds.includes(bookId)
        ? state.deskBookIds
        : [...state.deskBookIds, bookId];
      selected = true;
      if (book.status === 'want-to-read') {
        const allocation = allocateBookShelf(state, 'reading', state.readingShelves[0], bookId);
        return {
          activeBookId: bookId,
          deskBookIds,
          ...allocation,
          books: state.books.map((item) => item.id === bookId
            ? { ...item, status: 'reading', shelfId: allocation.shelfId }
            : item),
        };
      }
      return book.status === 'reading' ? { activeBookId: bookId, deskBookIds } : state;
    });
    return selected;
  },
  startReadingTimer: (bookId) => {
    let started = false;
    set((state) => {
      const book = state.books.find((item) => item.id === bookId);
      if (state.activeReadingTimer || !book || book.status !== 'reading' || !state.deskBookIds.includes(bookId)) return state;
      const now = new Date().toISOString();
      started = true;
      return {
        activeReadingTimer: {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          bookId: book.id,
          bookTitle: book.title,
          bookAuthor: book.author,
          coverUrl: book.coverUrl,
          coverColor: book.coverColor,
          totalPages: book.totalPages,
          startingPage: book.currentPage,
          startedAt: now,
          phase: 'running',
          elapsedMs: 0,
          segmentStartedAt: now,
        },
      };
    });
    return started;
  },
  pauseReadingTimer: () => set((state) => {
    const timer = state.activeReadingTimer;
    if (!timer || timer.phase === 'paused') return state;
    return {
      activeReadingTimer: {
        ...timer,
        phase: 'paused',
        elapsedMs: timer.phase === 'running' ? getReadingTimerElapsedMs(timer) : timer.elapsedMs,
        segmentStartedAt: undefined,
        endedAt: undefined,
      },
    };
  }),
  resumeReadingTimer: () => set((state) => {
    const timer = state.activeReadingTimer;
    if (!timer || timer.phase === 'running') return state;
    return {
      activeReadingTimer: {
        ...timer,
        phase: 'running',
        segmentStartedAt: new Date().toISOString(),
        endedAt: undefined,
      },
    };
  }),
  finishReadingTimer: () => set((state) => {
    const timer = state.activeReadingTimer;
    if (!timer || timer.phase === 'review') return state;
    return {
      activeReadingTimer: {
        ...timer,
        phase: 'review',
        elapsedMs: getReadingTimerElapsedMs(timer),
        segmentStartedAt: undefined,
        endedAt: new Date().toISOString(),
      },
    };
  }),
  discardReadingTimer: () => set((state) => state.activeReadingTimer
    ? { activeReadingTimer: undefined }
    : state),
  saveReadingSession: (input) => {
    let saved: ReadingSession | undefined;
    set((state) => {
      const timer = state.activeReadingTimer;
      const name = input.name.trim().slice(0, 80);
      const book = timer ? state.books.find((item) => item.id === timer.bookId) : undefined;
      if (!timer || timer.phase !== 'review' || !name
        || !Number.isInteger(input.endingPage)
        || input.endingPage < timer.startingPage || input.endingPage > timer.totalPages
        || !timer.endedAt) return state;

      const description = input.description?.trim().slice(0, 500) || undefined;
      const pagesRead = input.endingPage - timer.startingPage;
      saved = {
        id: timer.id,
        bookId: timer.bookId,
        bookTitle: timer.bookTitle,
        bookAuthor: timer.bookAuthor,
        coverUrl: timer.coverUrl,
        coverColor: timer.coverColor,
        totalPages: timer.totalPages,
        name,
        description,
        startingPage: timer.startingPage,
        endingPage: input.endingPage,
        pagesRead,
        startedAt: timer.startedAt,
        endedAt: timer.endedAt,
        durationSeconds: Math.floor(timer.elapsedMs / 1000),
      };

      const books = book && book.status === 'reading'
        ? state.books.map((item) => item.id === book.id ? { ...item, currentPage: input.endingPage } : item)
        : state.books;
      const readingDays = book && book.status === 'reading' && input.endingPage > book.currentPage
        ? [...new Set([...state.readingDays, localDateKey(new Date(timer.endedAt))])].sort()
        : state.readingDays;
      return {
        activeReadingTimer: undefined,
        readingSessions: [saved, ...state.readingSessions],
        books,
        readingDays,
      };
    });
    if (saved) trackEvent('reading_session_saved', { duration_seconds: saved.durationSeconds, pages_read: saved.pagesRead });
    return saved;
  },
  updateReadingSession: (sessionId, input) => set((state) => {
    const name = input.name.trim().slice(0, 80);
    const existing = state.readingSessions.find((session) => session.id === sessionId);
    if (!name || !existing || !Number.isInteger(input.endingPage)
      || input.endingPage < existing.startingPage || input.endingPage > existing.totalPages) return state;
    const description = input.description?.trim().slice(0, 500) || undefined;
    const updated = { ...existing, name, description, endingPage: input.endingPage, pagesRead: input.endingPage - existing.startingPage };
    const book = state.books.find((item) => item.id === existing.bookId);
    return {
      readingSessions: state.readingSessions.map((session) => session.id === sessionId
        ? updated
        : session),
      ...(book?.status === 'reading' && book.currentPage === existing.endingPage
        ? { books: state.books.map((item) => item.id === book.id ? { ...item, currentPage: input.endingPage } : item) }
        : {}),
    };
  }),
  removeReadingSession: (sessionId) => set((state) => state.readingSessions.some((session) => session.id === sessionId)
    ? { readingSessions: state.readingSessions.filter((session) => session.id !== sessionId) }
    : state),
  updateProgress: (bookId, page) => set((state) => {
    const books = state.books.map((book) => book.id === bookId && book.status === 'reading'
      ? { ...book, currentPage: clampPage(page, book.totalPages) }
      : book);
    const previous = state.books.find((book) => book.id === bookId);
    const updated = books.find((book) => book.id === bookId);
    const advanced = previous && updated && updated.currentPage > previous.currentPage;
    const todayKey = localDateKey(new Date());
    return { books, readingDays: advanced && !state.readingDays.includes(todayKey)
      ? [...state.readingDays, todayKey].sort() : state.readingDays };
  }),
  updateTotalPages: (bookId, totalPages) => set((state) => {
    if (!Number.isInteger(totalPages) || totalPages < 1 || totalPages > 99_999
      || state.completingBookId === bookId) return state;
    const currentBook = state.books.find((book) => book.id === bookId);
    if (!currentBook || currentBook.totalPages === totalPages) return state;
    return { books: state.books.map((book) => book.id === bookId ? {
      ...book,
      totalPages,
      currentPage: clampPage(book.currentPage, totalPages),
      readingEntries: (book.readingEntries ?? []).map((entry) => entry.page && entry.page > totalPages
        ? { ...entry, page: undefined }
        : entry),
    } : book) };
  }),
  updateOpinion: (bookId, input) => set((state) => ({
    books: state.books.map((book) => book.id === bookId ? {
      ...book,
      rating: input.rating === undefined ? book.rating
        : input.rating === null ? undefined
          : Math.min(5, Math.max(1, Math.round(input.rating))),
      notes: input.notes === undefined ? book.notes : input.notes,
  } : book),
  })),
  completeBook: (bookId, input = {}) => set((state) => {
    const book = state.books.find((item) => item.id === bookId);
    if (!book || book.status === 'completed' || state.completingBookId === bookId) return state;
    trackEvent('book_completed');
    const allocation = allocateBookShelf(state, 'completed', state.completedShelves[0], bookId);
    return {
      activeBookId: state.activeBookId === bookId ? undefined : state.activeBookId,
      deskBookIds: state.deskBookIds.filter((id) => id !== bookId),
      ...allocation,
      books: state.books.map((item) => item.id === bookId ? {
        ...item,
        status: 'completed',
        currentPage: item.totalPages,
        shelfId: allocation.shelfId,
        rating: input.rating === undefined ? item.rating
          : input.rating === null ? undefined : Math.min(5, Math.max(1, Math.round(input.rating))),
        notes: input.notes === undefined ? item.notes : input.notes.trim() || undefined,
      } : item),
    };
  }),
  addReadingEntry: (bookId, input) => set((state) => {
    const book = state.books.find((item) => item.id === bookId);
    const title = input.title?.trim() ?? '';
    const text = input.text.trim();
    if (!book || (!title && !text) || (input.page !== undefined
      && (!Number.isInteger(input.page) || input.page < 1 || input.page > book.totalPages))) return state;
  const entry: ReadingEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: title || undefined,
      text,
      createdAt: new Date().toISOString(),
      page: input.page,
      isFavorite: input.isFavorite === true,
      color: READING_NOTE_COLORS.includes(input.color as typeof READING_NOTE_COLORS[number]) ? input.color : undefined,
      folderId: state.readingFolders.some((folder) => folder.id === input.folderId) ? input.folderId : undefined,
    };
    trackEvent('reading_note_created');
    return { books: state.books.map((item) => item.id === bookId
      ? { ...item, readingEntries: [entry, ...(item.readingEntries ?? [])] }
      : item) };
  }),
  updateReadingEntry: (bookId, entryId, input) => set((state) => {
    const book = state.books.find((item) => item.id === bookId);
    const title = input.title?.trim() ?? '';
    const text = input.text.trim();
    if (!book || (!title && !text) || (input.page !== undefined
      && (!Number.isInteger(input.page) || input.page < 1 || input.page > book.totalPages))) return state;
    return { books: state.books.map((item) => item.id === bookId ? {
      ...item,
      readingEntries: (item.readingEntries ?? []).map((entry) => entry.id === entryId
        ? {
          ...entry,
          title: input.title === undefined ? entry.title : title || undefined,
          text,
          page: input.page,
          isFavorite: input.isFavorite ?? entry.isFavorite,
          color: READING_NOTE_COLORS.includes(input.color as typeof READING_NOTE_COLORS[number]) ? input.color : entry.color,
          folderId: Object.prototype.hasOwnProperty.call(input, 'folderId')
            ? state.readingFolders.some((folder) => folder.id === input.folderId) ? input.folderId : undefined
            : entry.folderId,
        }
        : entry),
    } : item) };
  }),
  removeReadingEntry: (bookId, entryId) => set((state) => ({
    books: state.books.map((item) => item.id === bookId ? {
      ...item,
      readingEntries: (item.readingEntries ?? []).filter((entry) => entry.id !== entryId),
    } : item),
  })),
  toggleReadingEntryFavorite: (bookId, entryId) => set((state) => ({
    books: state.books.map((item) => item.id === bookId ? {
      ...item,
      readingEntries: (item.readingEntries ?? []).map((entry) => entry.id === entryId
        ? { ...entry, isFavorite: !entry.isFavorite }
        : entry),
  } : item),
  })),
  addReadingFolder: ({ name, colorId }) => {
    const normalizedName = name.trim().slice(0, 32);
    if (!normalizedName || !READING_FOLDER_COLORS.some((color) => color.id === colorId)) return undefined;
    const id = `reading-folder-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((state) => ({ readingFolders: [...state.readingFolders, { id, name: normalizedName, colorId }] }));
    return id;
  },
  requestCompletion: (bookId) => set((state) => {
    if (state.completingBookId) return state;
    const book = state.books.find((item) => item.id === bookId);
    if (!book || book.status !== 'reading') return state;
    const todayKey = localDateKey(new Date());
    return {
      activeBookId: bookId,
      completingBookId: bookId,
      readingDays: book.currentPage < book.totalPages && !state.readingDays.includes(todayKey)
        ? [...state.readingDays, todayKey].sort() : state.readingDays,
      books: state.books.map((item) => item.id === bookId
        ? { ...item, currentPage: item.totalPages, status: 'completing' }
        : item),
    };
  }),
  finalizeCompletion: (bookId) => set((state) => {
    if (state.completingBookId !== bookId) return state;
    const book = state.books.find((item) => item.id === bookId);
    if (!book) return state;
    trackEvent('book_completed');
    const remainingBooks = state.books.filter((item) => item.id !== bookId);
    const allocation = allocateBookShelf(state, 'completed', state.completedShelves[0], bookId);
    return {
      ...allocation,
      activeBookId: undefined,
      deskBookIds: state.deskBookIds.filter((id) => id !== bookId),
      completingBookId: undefined,
      books: [...remainingBooks, { ...book, status: 'completed', shelfId: allocation.shelfId }],
    };
  }),
}), {
  name: GUEST_STORAGE_KEY,
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

export const getCurrentLibrarySnapshot = () => createPersistedState(useLibraryStore.getState());

export const readLibraryStorageScope = async (scope: LibraryStorageScope) => {
  const stored = await storage.getItem(storageKeyForScope(scope));
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as { state?: unknown };
    return normalizePersistedState(parsed.state);
  } catch {
    return null;
  }
};

export const overwriteLibraryStorageScope = async (
  scope: LibraryStorageScope,
  snapshot: PersistedLibraryState,
) => {
  await storage.setItem(storageKeyForScope(scope), JSON.stringify({
    state: normalizePersistedState(snapshot),
    version: STORAGE_VERSION,
  }));
};

export const replaceLibrarySnapshot = (snapshot: unknown, preservePhoto = false) => {
  const current = useLibraryStore.getState();
  const currentPhoto = useLibraryStore.getState().pictureFramePhotoUri;
  const localPieces = useLibraryStore.getState().roomLayout.pieces;
  const normalized = normalizePersistedState(snapshot);
  // Completing onboarding belongs to this installation, even when an older backup is restored.
  if ((current.onboardingStatus === 'completed' || current.onboardingStatus === 'skipped')
    && (normalized.onboardingStatus === 'not_started' || normalized.onboardingStatus === 'in_progress')) {
    normalized.onboardingStatus = current.onboardingStatus;
    normalized.onboardingStep = current.onboardingStep;
    normalized.onboardingVersion = current.onboardingVersion;
  }
  useLibraryStore.setState({
    ...normalized,
    pictureFramePhotoUri: preservePhoto ? currentPhoto : normalized.pictureFramePhotoUri,
    roomLayout: preservePhoto ? { ...normalized.roomLayout!, pieces:normalized.roomLayout!.pieces.map(piece=>({...piece,photoUri:localPieces.find(local=>local.id===piece.id)?.photoUri})) } : normalized.roomLayout!,
    completingBookId: undefined,
    _hasHydrated: true,
  });
};

export const switchLibraryStorageScope = async (
  scope: LibraryStorageScope,
  fallback?: PersistedLibraryState,
) => {
  const name = storageKeyForScope(scope);
  const snapshot = await readLibraryStorageScope(scope);
  useLibraryStore.persist.setOptions({ name });
  // Read before changing scope: resetting the store would overwrite the saved account.
  // Account switches must also keep the root navigator and AuthProvider mounted.
  replaceLibrarySnapshot(snapshot ?? fallback ?? initialState);
};
