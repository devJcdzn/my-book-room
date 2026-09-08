import { create } from 'zustand';

import { mockBooks } from '@/src/data/mock-books';
import type { Book } from '@/src/types/book';

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
  addBook: (bookId: string) => void;
  addCustomBook: (book: { title: string; author: string; coverColor: string; totalPages: number }) => void;
  removeBook: (bookId: string) => void;
  selectActiveBook: (bookId: string) => void;
  updateProgress: (bookId: string, currentPage: number) => void;
  updateOpinion: (bookId: string, input: { rating?: number; notes?: string }) => void;
  requestCompletion: (bookId: string) => void;
  finalizeCompletion: (bookId: string) => void;
};

const clampPage = (page: number, total: number) =>
  Math.min(total, Math.max(0, Math.round(page)));

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
  addBook: (bookId) => set((state) => {
    if (state.books.some((book) => book.id === bookId)) return state;
    const catalogBook = mockBooks.find((book) => book.id === bookId);
    if (!catalogBook) return state;
    return {
      activeBookId: bookId,
      books: [...state.books, { ...catalogBook, currentPage: 0, status: 'reading' }],
    };
  }),
  addCustomBook: (bookData) => set((state) => {
    const id = `custom-${Date.now()}`;
    const newBook: Book = {
      id,
      title: bookData.title.trim(),
      author: bookData.author.trim() || 'Autor desconhecido',
      coverColor: bookData.coverColor || '#B95F3B',
      totalPages: Math.max(1, Math.round(bookData.totalPages)),
      currentPage: 0,
      status: 'reading',
    };
    return {
      activeBookId: id,
      books: [...state.books, newBook],
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
