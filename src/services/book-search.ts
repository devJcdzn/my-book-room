import {
  bookCatalogClient,
  type BookCatalogClient,
} from '@/src/services/book-catalog';
import {
  mergeUniqueResults,
  OPEN_LIBRARY_PAGE_SIZE,
  openLibraryClient,
  type BookSearchPage,
} from '@/src/services/open-library';

type SearchProvider = Pick<typeof openLibraryClient, 'searchBooks' | 'trendingBooks'>;

export type SearchSources = {
  catalog: BookCatalogClient;
  openLibrary: SearchProvider;
};

const emptyPage = (page: number): BookSearchPage => ({ results: [], page, hasMore: false });

export const searchBookSources = async (
  query: string,
  page: number,
  signal: AbortSignal | undefined,
  sources: SearchSources = { catalog: bookCatalogClient, openLibrary: openLibraryClient },
): Promise<BookSearchPage> => {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) return sources.openLibrary.trendingBooks(page, signal);

  let catalogPage = emptyPage(page);
  try {
    catalogPage = await sources.catalog.searchBooks(normalizedQuery, page, signal);
  } catch {
    // O catálogo remoto é uma aceleração opcional; a Open Library continua sendo o fallback.
  }

  if (catalogPage.results.length >= OPEN_LIBRARY_PAGE_SIZE) return catalogPage;

  try {
    const openLibraryPage = await sources.openLibrary.searchBooks(normalizedQuery, page, signal);
    return {
      results: mergeUniqueResults(catalogPage.results, openLibraryPage.results),
      page,
      hasMore: catalogPage.hasMore || openLibraryPage.hasMore,
    };
  } catch (error) {
    if (catalogPage.results.length) return catalogPage;
    throw error;
  }
};
