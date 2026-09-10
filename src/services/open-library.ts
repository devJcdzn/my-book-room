import type { BookSearchResult } from '@/src/types/book';

const API_URL = 'https://openlibrary.org';
const COVER_URL = 'https://covers.openlibrary.org/b/id';
export const OPEN_LIBRARY_PAGE_SIZE = 10;
const PAGE_SIZE = OPEN_LIBRARY_PAGE_SIZE;
const SEARCH_TTL = 15 * 60_000;
const TRENDING_TTL = 30 * 60_000;
const MAX_CACHE_ENTRIES = 50;

const BASE_FIELDS = [
  'key',
  'title',
  'author_name',
  'cover_i',
  'number_of_pages_median',
  'first_publish_year',
  'edition_key',
].join(',');

const EDITION_FIELDS = [
  'editions',
  'editions.key',
  'editions.isbn',
  'editions.cover_i',
  'editions.language',
  'editions.number_of_pages',
].join(',');

type SearchDocument = {
  key?: string;
  title?: string;
  author_name?: string[];
  cover_i?: number;
  number_of_pages_median?: number;
  first_publish_year?: number;
  edition_key?: string[];
  editions?: {
    docs?: {
      key?: string;
      isbn?: string[];
      cover_i?: number;
      language?: string[];
      number_of_pages?: number;
    }[];
  };
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const expoFetch: FetchLike = async (input, init) => {
  const { fetch } = await import('expo/fetch');
  return fetch(input, init as Parameters<typeof fetch>[1]) as unknown as Promise<Response>;
};

type ClientOptions = {
  fetcher?: FetchLike;
  minIntervalMs?: number;
  timeoutMs?: number;
  retryDelayMs?: number;
};

export type BookSearchPage = {
  results: BookSearchResult[];
  page: number;
  hasMore: boolean;
};

export class OpenLibraryError extends Error {
  constructor(message: string, public readonly status?: number, public readonly retryAfterMs?: number) {
    super(message);
    this.name = 'OpenLibraryError';
  }
}

const positivePageCount = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 99_999
    ? value
    : undefined;

const cleanKey = (key: string | undefined, prefix: 'works' | 'books') => {
  if (!key) return undefined;
  const identifier = key.split('/').filter(Boolean).at(-1);
  return identifier ? `/${prefix}/${identifier}` : undefined;
};

export const normalizeIsbn = (value: string) => value.replace(/[\s-]/g, '').toUpperCase();

export const isValidIsbn = (value: string) => {
  const isbn = normalizeIsbn(value);
  if (/^\d{13}$/.test(isbn)) {
    const sum = isbn.slice(0, 12).split('').reduce(
      (total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3),
      0,
    );
    return (10 - (sum % 10)) % 10 === Number(isbn[12]);
  }
  if (/^\d{9}[\dX]$/.test(isbn)) {
    const sum = isbn.split('').reduce(
      (total, digit, index) => total + (digit === 'X' ? 10 : Number(digit)) * (10 - index),
      0,
    );
    return sum % 11 === 0;
  }
  return false;
};

export const coverUrlForId = (coverId?: number) =>
  coverId ? `${COVER_URL}/${coverId}-M.jpg?default=false` : undefined;

export const mergeUniqueResults = (
  current: BookSearchResult[],
  incoming: BookSearchResult[],
) => {
  const byWork = new Map(current.map((book) => [book.workKey, book]));
  incoming.forEach((book) => {
    if (!byWork.has(book.workKey)) byWork.set(book.workKey, book);
  });
  return [...byWork.values()];
};

export const mapOpenLibraryDocument = (
  document: SearchDocument,
  searchedIsbn?: string,
): BookSearchResult | undefined => {
  const workKey = cleanKey(document.key, 'works');
  const title = document.title?.trim();
  if (!workKey || !title) return undefined;

  const editionDocs = document.editions?.docs ?? [];
  const matchingEdition = searchedIsbn
    ? editionDocs.find((edition) => edition.isbn?.some((isbn) => normalizeIsbn(isbn) === searchedIsbn))
    : undefined;
  const portugueseEdition = editionDocs.find((edition) => edition.language?.includes('por'));
  const edition = matchingEdition ?? portugueseEdition ?? editionDocs[0];
  const coverEdition = matchingEdition?.cover_i
    ? matchingEdition
    : editionDocs.find((item) => item.language?.includes('por') && item.cover_i)
      ?? editionDocs.find((item) => item.cover_i);
  const editionKey = cleanKey(edition?.key ?? document.edition_key?.[0], 'books');
  const coverId = positiveCoverId(coverEdition?.cover_i) ?? positiveCoverId(document.cover_i);
  const totalPages = positivePageCount(edition?.number_of_pages)
    ?? positivePageCount(document.number_of_pages_median);

  return {
    workKey,
    editionKey,
    title,
    author: document.author_name?.find((author) => author.trim())?.trim() || 'Autor desconhecido',
    totalPages,
    ...(totalPages ? { totalPagesSource: 'open_library' as const } : {}),
    coverId,
    coverUrl: coverUrlForId(coverId),
    isbn: searchedIsbn,
    firstPublishYear: typeof document.first_publish_year === 'number'
      ? document.first_publish_year
      : undefined,
  };
};

function positiveCoverId(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

const parseRetryAfter = (value: string | null) => {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
};

const delay = (milliseconds: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) {
    reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    return;
  }
  const timer = setTimeout(resolve, milliseconds);
  signal?.addEventListener('abort', () => {
    clearTimeout(timer);
    reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
  }, { once: true });
});

const isAbortError = (error: unknown) => error instanceof Error && error.name === 'AbortError';

export const createOpenLibraryClient = ({
  fetcher = expoFetch,
  minIntervalMs = 1_100,
  timeoutMs = 15_000,
  retryDelayMs = 2_000,
}: ClientOptions = {}) => {
  const cache = new Map<string, { expiresAt: number; value: unknown }>();
  const inFlight = new Map<string, Promise<unknown>>();
  let queue = Promise.resolve();
  let lastRequestStartedAt = 0;

  const schedule = <T>(task: () => Promise<T>, signal?: AbortSignal) => {
    const run = queue.then(async () => {
      if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
      const wait = Math.max(0, minIntervalMs - (Date.now() - lastRequestStartedAt));
      if (wait) await delay(wait, signal);
      lastRequestStartedAt = Date.now();
      return task();
    });
    queue = run.then(() => undefined, () => undefined);
    return run;
  };

  const getCached = <T>(url: string) => {
    const entry = cache.get(url);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      cache.delete(url);
      return undefined;
    }
    cache.delete(url);
    cache.set(url, entry);
    return entry.value as T;
  };

  const setCached = (url: string, value: unknown, ttl: number) => {
    cache.delete(url);
    cache.set(url, { expiresAt: Date.now() + ttl, value });
    while (cache.size > MAX_CACHE_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  };

  const fetchAttempt = async (url: string, signal?: AbortSignal) => {
    const controller = new AbortController();
    const onAbort = () => controller.abort(signal?.reason);
    signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), timeoutMs);
    try {
      return await schedule(() => fetcher(url, { signal: controller.signal }), controller.signal);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  };

  const requestJson = <T>(url: string, ttl: number, signal?: AbortSignal): Promise<T> => {
    const cached = getCached<T>(url);
    if (cached !== undefined) return Promise.resolve(cached);
    const pending = inFlight.get(url) as Promise<T> | undefined;
    if (pending) return pending;

    const request = (async () => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await fetchAttempt(url, signal);
          if (!response.ok) {
            throw new OpenLibraryError(
              `Open Library respondeu com status ${response.status}.`,
              response.status,
              parseRetryAfter(response.headers.get('Retry-After')),
            );
          }
          let value: T;
          try {
            value = await response.json() as T;
          } catch {
            throw new SyntaxError('A Open Library retornou JSON inválido.');
          }
          setCached(url, value, ttl);
          return value;
        } catch (error) {
          if (isAbortError(error) || (error instanceof Error && error.name === 'TimeoutError')) throw error;
          const status = error instanceof OpenLibraryError ? error.status : undefined;
          const retryable = status === 429 || (status !== undefined && status >= 500) || status === undefined;
          if (!retryable || attempt === 1 || error instanceof SyntaxError) throw error;
          const retryAfter = error instanceof OpenLibraryError ? error.retryAfterMs : undefined;
          await delay(retryAfter ?? retryDelayMs, signal);
        }
      }
      throw new OpenLibraryError('Não foi possível consultar a Open Library.');
    })().finally(() => inFlight.delete(url));

    inFlight.set(url, request);
    return request;
  };

  const editionPages = async (editionKey: string, signal?: AbortSignal) => {
    const response = await requestJson<{ number_of_pages?: number }>(
      `${API_URL}${editionKey}.json`,
      SEARCH_TTL,
      signal,
    );
    return positivePageCount(response.number_of_pages);
  };

  const searchBooks = async (query: string, page = 1, signal?: AbortSignal): Promise<BookSearchPage> => {
    const trimmed = query.trim();
    const normalizedIsbn = normalizeIsbn(trimmed);
    const isbn = isValidIsbn(normalizedIsbn) ? normalizedIsbn : undefined;
    const fields = `${BASE_FIELDS},${EDITION_FIELDS}`;
    const params = new URLSearchParams({
      q: isbn ? `isbn:${isbn}` : trimmed,
      lang: 'pt',
      page: String(page),
      limit: String(PAGE_SIZE),
      fields,
    });
    const response = await requestJson<{ docs?: SearchDocument[]; numFound?: number; start?: number }>(
      `${API_URL}/search.json?${params}`,
      SEARCH_TTL,
      signal,
    );
    const documents = response.docs ?? [];
    const results = documents
      .map((document) => mapOpenLibraryDocument(document, isbn))
      .filter((book): book is BookSearchResult => Boolean(book));

    if (isbn && results[0]?.editionKey) {
      try {
        const exactPages = await editionPages(results[0].editionKey, signal);
        if (exactPages) results[0] = {
          ...results[0],
          totalPages: exactPages,
          totalPagesSource: 'open_library',
        };
      } catch (error) {
        if (isAbortError(error)) throw error;
        // A edição é um refinamento opcional; a mediana ou confirmação manual continuam válidas.
      }
    }

    const loaded = (response.start ?? (page - 1) * PAGE_SIZE) + documents.length;
    return {
      results: mergeUniqueResults([], results),
      page,
      hasMore: typeof response.numFound === 'number'
        ? loaded < response.numFound
        : documents.length === PAGE_SIZE,
    };
  };

  const trendingBooks = async (page = 1, signal?: AbortSignal): Promise<BookSearchPage> => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
      lang: 'pt',
      fields: `${BASE_FIELDS},${EDITION_FIELDS}`,
    });
    const response = await requestJson<{ works?: SearchDocument[] }>(
      `${API_URL}/trending/daily.json?${params}`,
      TRENDING_TTL,
      signal,
    );
    const documents = response.works ?? [];
    return {
      results: mergeUniqueResults([], documents
        .map((document) => mapOpenLibraryDocument(document))
        .filter((book): book is BookSearchResult => Boolean(book))),
      page,
      hasMore: documents.length === PAGE_SIZE,
    };
  };

  return { searchBooks, trendingBooks };
};

export const openLibraryClient = createOpenLibraryClient();
