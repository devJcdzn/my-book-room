import type { SupabaseClient } from '@supabase/supabase-js';

import { coverUrlForId, OPEN_LIBRARY_PAGE_SIZE } from '@/src/services/open-library';
import { supabase } from '@/src/services/supabase';
import type { BookSearchResult } from '@/src/types/book';

export type CatalogPagesSource = 'open_library' | 'user';

export type CatalogBookRow = {
  work_key: string;
  edition_key: string | null;
  title: string;
  author: string;
  isbn: string | null;
  first_publish_year: number | null;
  total_pages: number | null;
  pages_source: CatalogPagesSource;
  cover_id: number | null;
  last_seen_at?: string;
};

export type CatalogSearchPage = {
  results: BookSearchResult[];
  page: number;
  hasMore: boolean;
};

export type CatalogUpsertInput = {
  result: BookSearchResult;
  totalPages?: number;
  totalPagesSource?: CatalogPagesSource;
};

export type BookCatalogClient = {
  available: boolean;
  searchBooks: (query: string, page?: number, signal?: AbortSignal) => Promise<CatalogSearchPage>;
  upsertBook: (input: CatalogUpsertInput) => Promise<void>;
};

type CatalogClientOptions = {
  client?: SupabaseClient;
  timeoutMs?: number;
  retryDelayMs?: number;
  pageSize?: number;
};

const TABLE = 'open_library_books';
const SELECT_COLUMNS = [
  'work_key',
  'edition_key',
  'title',
  'author',
  'isbn',
  'first_publish_year',
  'total_pages',
  'pages_source',
  'cover_id',
  'last_seen_at',
].join(',');
const MAX_TITLE_LENGTH = 300;
const MAX_AUTHOR_LENGTH = 300;
const MAX_ISBN_LENGTH = 32;
const MAX_EDITION_KEY_LENGTH = 200;
const MAX_WORK_KEY_LENGTH = 200;
const MAX_PAGE_COUNT = 99_999;
const DEFAULT_TIMEOUT_MS = 3_500;
const DEFAULT_RETRY_DELAY_MS = 250;

const positiveInteger = (value: unknown, maximum = MAX_PAGE_COUNT) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= maximum
    ? value
    : undefined;

const optionalText = (value: unknown, maximum: number) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= maximum ? trimmed : undefined;
};

const isWorkKey = (value: string) => /^\/works\/[A-Za-z0-9_-]+$/.test(value) && value.length <= MAX_WORK_KEY_LENGTH;

const isEditionKey = (value: string) => /^\/books\/[A-Za-z0-9_-]+$/.test(value) && value.length <= MAX_EDITION_KEY_LENGTH;

export const mapCatalogRow = (value: unknown): BookSearchResult | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Partial<CatalogBookRow>;
  const workKey = optionalText(row.work_key, MAX_WORK_KEY_LENGTH);
  const title = optionalText(row.title, MAX_TITLE_LENGTH);
  const author = optionalText(row.author, MAX_AUTHOR_LENGTH);
  if (!workKey || !isWorkKey(workKey) || !title || !author) return undefined;

  const editionKey = typeof row.edition_key === 'string' && isEditionKey(row.edition_key)
    ? row.edition_key
    : undefined;
  const totalPages = positiveInteger(row.total_pages);
  const coverId = positiveInteger(row.cover_id, Number.MAX_SAFE_INTEGER);
  const firstPublishYear = typeof row.first_publish_year === 'number'
    && Number.isInteger(row.first_publish_year)
    && row.first_publish_year >= 0
    && row.first_publish_year <= 3_000
    ? row.first_publish_year
    : undefined;
  const isbn = optionalText(row.isbn, MAX_ISBN_LENGTH);
  if (isbn && !/^[0-9Xx-]+$/.test(isbn)) return undefined;
  if (row.pages_source !== 'open_library' && row.pages_source !== 'user') return undefined;
  const pagesSource = row.pages_source;

  return {
    workKey,
    editionKey,
    title,
    author,
    totalPages,
    totalPagesSource: totalPages ? pagesSource : undefined,
    coverId,
    coverUrl: coverUrlForId(coverId),
    isbn,
    firstPublishYear,
  };
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

const withTimeout = async <T>(
  task: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  externalSignal?: AbortSignal,
) => {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(externalSignal?.reason);
  externalSignal?.addEventListener('abort', abortFromCaller, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const reason = new DOMException('Supabase catalog timeout', 'TimeoutError');
      controller.abort(reason);
      reject(reason);
    }, timeoutMs);
  });

  try {
    return await Promise.race([task(controller.signal), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
    externalSignal?.removeEventListener('abort', abortFromCaller);
  }
};

const isRetryableCatalogError = (error: unknown) => {
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) return true;
  if (!error || typeof error !== 'object') return true;

  const responseError = error as { code?: unknown; status?: unknown };
  const status = typeof responseError.status === 'number' ? responseError.status : undefined;
  if (status !== undefined) return status === 408 || status === 429 || status >= 500;

  const code = typeof responseError.code === 'string' ? responseError.code : undefined;
  if (!code) return true;
  return code.startsWith('08') || code === 'PGRST301';
};

const runWithRetry = async <T>(
  task: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  retryDelayMs: number,
  externalSignal?: AbortSignal,
) => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (externalSignal?.aborted) {
      throw externalSignal.reason ?? new DOMException('Aborted', 'AbortError');
    }
    try {
      return await withTimeout(task, timeoutMs, externalSignal);
    } catch (error) {
      if (externalSignal?.aborted || attempt === 1 || !isRetryableCatalogError(error)) throw error;
      await delay(retryDelayMs, externalSignal);
    }
  }
  throw new Error('O catálogo Supabase não respondeu.');
};

export const createBookCatalogClient = ({
  client = supabase,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  pageSize = OPEN_LIBRARY_PAGE_SIZE,
}: CatalogClientOptions = {}): BookCatalogClient => {
  const inFlight = new Map<string, Promise<void>>();

  const searchBooks = async (query: string, page = 1, signal?: AbortSignal): Promise<CatalogSearchPage> => {
    const trimmed = query.trim();
    if (!client || !trimmed) return { results: [], page, hasMore: false };

    const rows = await runWithRetry(async (requestSignal) => {
      const request = client
        .from(TABLE)
        .select(SELECT_COLUMNS)
        .textSearch('search_document', trimmed, { type: 'websearch', config: 'simple' })
        .order('last_seen_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      request.abortSignal(requestSignal);
      const response = await request;
      if (response.error) throw response.error;
      return response.data ?? [];
    }, timeoutMs, retryDelayMs, signal);

    const results = rows
      .map(mapCatalogRow)
      .filter((book): book is BookSearchResult => Boolean(book));

    return {
      results,
      page,
      hasMore: rows.length === pageSize,
    };
  };

  const upsertBook = (input: CatalogUpsertInput) => {
    if (!client) return Promise.resolve();

    const existing = inFlight.get(input.result.workKey);
    if (existing) return existing;

    const totalPages = input.totalPages ?? input.result.totalPages;
    if (totalPages !== undefined && !positiveInteger(totalPages)) {
      return Promise.reject(new Error('A quantidade de páginas do catálogo é inválida.'));
    }

    const title = optionalText(input.result.title, MAX_TITLE_LENGTH);
    const author = optionalText(input.result.author, MAX_AUTHOR_LENGTH);
    if (!title || !author || !isWorkKey(input.result.workKey)) {
      return Promise.reject(new Error('Os metadados do livro não são válidos para o catálogo.'));
    }

    const pagesSource = input.totalPagesSource
      ?? input.result.totalPagesSource
      ?? 'open_library';
    if (pagesSource !== 'open_library' && pagesSource !== 'user') {
      return Promise.reject(new Error('A origem das páginas do catálogo é inválida.'));
    }
    if (pagesSource === 'user' && totalPages === undefined) {
      return Promise.reject(new Error('A correção local precisa informar páginas.'));
    }
    if (input.result.editionKey && !isEditionKey(input.result.editionKey)) {
      return Promise.reject(new Error('A edição do livro não é válida para o catálogo.'));
    }
    const promise = runWithRetry(async (requestSignal) => {
      const request = client.rpc('upsert_open_library_book', {
        p_author: author,
        p_cover_id: input.result.coverId ?? null,
        p_edition_key: input.result.editionKey ?? null,
        p_first_publish_year: input.result.firstPublishYear ?? null,
        p_isbn: input.result.isbn ?? null,
        p_pages_source: pagesSource,
        p_title: title,
        p_total_pages: totalPages ?? null,
        p_work_key: input.result.workKey,
      });
      request.abortSignal(requestSignal);
      const response = await request;
      if (response.error) throw response.error;
    }, timeoutMs, retryDelayMs).finally(() => {
      inFlight.delete(input.result.workKey);
    });

    inFlight.set(input.result.workKey, promise);
    return promise;
  };

  return {
    available: Boolean(client),
    searchBooks,
    upsertBook,
  };
};

export const bookCatalogClient = createBookCatalogClient();
