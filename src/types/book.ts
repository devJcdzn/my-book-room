export type BookStatus = 'reading' | 'completing' | 'completed';

export type BookSource = 'open-library' | 'manual';

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
  rating?: number;
  notes?: string;
};
