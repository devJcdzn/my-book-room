import { create } from 'zustand';

import type { Book, BookSearchResult } from '@/src/types/book';

export type AmbienceMode = 'auto' | 'day' | 'sunset' | 'night';

type LibraryState = {
  books: Book[];
  activeBookId?: string;
  completingBookId?: string;
  isLampOn: boolean;
  ambienceMode: AmbienceMode;
  setAmbienceMode: (mode: AmbienceMode) => void;
  cycleAmbienceMode: () => void;
  toggleLamp: () => void;
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

const clampPage = (page: number, total: number) =>
  Math.min(total, Math.max(0, Math.round(page)));

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

export const useLibraryStore = create<LibraryState>((set) => ({
  books: [],
  activeBookId: undefined,
  completingBookId: undefined,
  isLampOn: true,
  ambienceMode: 'auto',
  setAmbienceMode: (mode) => set({ ambienceMode: mode }),
  cycleAmbienceMode: () => set((state) => ({ ambienceMode: NEXT_AMBIENCE[state.ambienceMode] })),
  toggleLamp: () => set((state) => ({ isLampOn: !state.isLampOn })),
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
}));
