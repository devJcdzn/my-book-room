import { bookCatalogClient } from '@/src/services/book-catalog';
import { extractCoverColor } from '@/src/services/cover-color';
import { useLibraryStore } from '@/src/store/library-store';
import type { BookSearchResult } from '@/src/types/book';

export const addCatalogBook = (book: BookSearchResult, shelfId?: string) => {
  if (!book.totalPages) return false;

  const catalogBook = { ...book, totalPages: book.totalPages };
  const store = useLibraryStore.getState();
  store.addOpenLibraryBook(catalogBook, { shelfId });

  void bookCatalogClient
    .upsertBook({ result: catalogBook, totalPagesSource: book.totalPagesSource ?? 'open_library' })
    .catch(() => undefined);

  if (book.coverUrl) {
    void extractCoverColor(book.coverUrl).then((color) => {
      if (color) useLibraryStore.getState().updateBookCoverColor(book.workKey, color);
    });
  }

  return true;
};
