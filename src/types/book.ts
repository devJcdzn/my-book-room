export type BookStatus = 'reading' | 'completing' | 'completed';

export type Book = {
  id: string;
  title: string;
  author: string;
  coverColor: string;
  totalPages: number;
  currentPage: number;
  status: BookStatus;
  rating?: number;
  notes?: string;
};

export type CatalogBook = Omit<Book, 'currentPage' | 'status' | 'rating' | 'notes'>;
