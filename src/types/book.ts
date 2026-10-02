export type BookStatus = 'want-to-read' | 'reading' | 'completing' | 'completed';

export type BookSource = 'open-library' | 'manual';

export type ReadingEntry = {
  id: string;
  title?: string;
  text: string;
  createdAt: string;
  page?: number;
  isFavorite: boolean;
  color?: string;
  folderId?: string;
};

export type ReadingFolder = {
  id: string;
  name: string;
  colorId: string;
};

export type ReadingTimerPhase = 'running' | 'paused' | 'review';

export type ReadingTimer = {
  id: string;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  coverUrl?: string;
  coverColor: string;
  totalPages: number;
  startingPage: number;
  startedAt: string;
  phase: ReadingTimerPhase;
  elapsedMs: number;
  segmentStartedAt?: string;
  endedAt?: string;
};

export type ReadingSession = {
  id: string;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  coverUrl?: string;
  coverColor: string;
  totalPages: number;
  name: string;
  description?: string;
  startingPage: number;
  endingPage: number;
  pagesRead: number;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
};

export type BookSearchResult = {
  workKey: string;
  editionKey?: string;
  title: string;
  author: string;
  totalPages?: number;
  totalPagesSource?: 'open_library' | 'user';
  coverId?: number;
  coverUrl?: string;
  isbn?: string;
  firstPublishYear?: number;
};

export type Book = {
  id: string;
  source: BookSource;
  openLibraryWorkKey?: string;
  openLibraryEditionKey?: string;
  coverId?: number;
  coverUrl?: string;
  isbn?: string;
  firstPublishYear?: number;
  title: string;
  author: string;
  coverColor: string;
  totalPages: number;
  currentPage: number;
  status: BookStatus;
  shelfId?: string;
  rating?: number;
  notes?: string;
  readingEntries?: ReadingEntry[];
};
