import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createBookCatalogClient,
  mapCatalogRow,
  type BookCatalogClient,
} from '../src/services/book-catalog';
import { searchBookSources } from '../src/services/book-search';
import type { BookSearchResult } from '../src/types/book';

type QueryResponse = { data: unknown; error: Error | null };

const queryBuilder = (response: QueryResponse) => {
  let abortSignal: AbortSignal | undefined;
  const query = {
    select: () => query,
    textSearch: () => query,
    order: () => query,
    range: () => query,
    abortSignal: (signal: AbortSignal) => {
      abortSignal = signal;
      return query;
    },
    then: (resolve: (value: QueryResponse) => unknown, reject: (reason: unknown) => unknown) => {
      if (abortSignal?.aborted) return Promise.resolve(resolve({ data: [], error: new Error('Aborted') }));
      return Promise.resolve(response).then(resolve, reject);
    },
  };
  return query;
};

const fakeSupabase = ({
  rows = [],
  rpcResponse = { data: null, error: null },
  onRpc,
}: {
  rows?: unknown[];
  rpcResponse?: QueryResponse;
  onRpc?: (name: string, args: Record<string, unknown>) => void;
} = {}) => {
  const client = {
    from: () => queryBuilder({ data: rows, error: null }),
    rpc: (name: string, args: Record<string, unknown>) => {
      onRpc?.(name, args);
      return queryBuilder(rpcResponse);
    },
  };
  return client as never;
};

const catalogResult: BookSearchResult = {
  workKey: '/works/OL1W',
  editionKey: '/books/OL1M',
  title: 'Livro do catálogo',
  author: 'Autora',
  totalPages: 240,
  totalPagesSource: 'user',
  coverId: 123,
  coverUrl: 'https://covers.openlibrary.org/b/id/123-M.jpg?default=false',
  isbn: '9780439554930',
  firstPublishYear: 2020,
};

test('mapeia uma linha do catálogo sem armazenar a imagem', () => {
  assert.deepEqual(mapCatalogRow({
    work_key: '/works/OL1W',
    edition_key: '/books/OL1M',
    title: 'Livro do catálogo',
    author: 'Autora',
    isbn: '9780439554930',
    first_publish_year: 2020,
    total_pages: 240,
    pages_source: 'user',
    cover_id: 123,
  }), catalogResult);
  assert.equal(mapCatalogRow({ work_key: '/invalid', title: 'Livro', author: 'Autora' }), undefined);
});

test('consulta o catálogo com busca textual e paginação', async () => {
  const client = createBookCatalogClient({
    client: fakeSupabase({ rows: [{
      work_key: '/works/OL1W',
      edition_key: null,
      title: 'Livro do catálogo',
      author: 'Autora',
      isbn: null,
      first_publish_year: null,
      total_pages: null,
      pages_source: 'open_library',
      cover_id: null,
    }] }),
    timeoutMs: 50,
    retryDelayMs: 0,
  });

  const result = await client.searchBooks('livro', 2);
  assert.equal(result.page, 2);
  assert.equal(result.results[0]?.workKey, '/works/OL1W');
  assert.equal(result.hasMore, false);
});

test('deduplica RPCs simultâneas e preserva a origem das páginas', async () => {
  let calls = 0;
  let receivedArgs: Record<string, unknown> | undefined;
  const client = createBookCatalogClient({
    client: fakeSupabase({
      onRpc: (_name, args) => {
        calls += 1;
        receivedArgs = args;
      },
    }),
    timeoutMs: 50,
    retryDelayMs: 0,
  });

  await Promise.all([
    client.upsertBook({ result: catalogResult, totalPagesSource: 'user' }),
    client.upsertBook({ result: catalogResult, totalPagesSource: 'user' }),
  ]);

  assert.equal(calls, 1);
  assert.equal(receivedArgs?.p_work_key, '/works/OL1W');
  assert.equal(receivedArgs?.p_pages_source, 'user');
  assert.equal(receivedArgs?.p_total_pages, 240);

  const withoutPages = { ...catalogResult, totalPages: undefined, totalPagesSource: undefined };
  await client.upsertBook({ result: withoutPages });
  assert.equal(calls, 2);
  assert.equal(receivedArgs?.p_pages_source, 'open_library');
  assert.equal(receivedArgs?.p_total_pages, null);
});

test('interrompe uma consulta do catálogo no timeout', async () => {
  let calls = 0;
  const client = createBookCatalogClient({
    client: {
      from: () => {
        calls += 1;
        let signal: AbortSignal | undefined;
        const query = {
          select: () => query,
          textSearch: () => query,
          order: () => query,
          range: () => query,
          abortSignal: (nextSignal: AbortSignal) => {
            signal = nextSignal;
            return query;
          },
          then: (_resolve: (value: QueryResponse) => unknown, reject: (reason: unknown) => unknown) =>
            new Promise((_resolvePromise, rejectPromise) => {
              signal?.addEventListener('abort', () => rejectPromise(signal?.reason), { once: true });
            }).then(() => undefined, reject),
        };
        return query;
      },
      rpc: () => queryBuilder({ data: null, error: null }),
    } as never,
    timeoutMs: 5,
    retryDelayMs: 0,
  });

  await assert.rejects(client.searchBooks('livro'), (error: Error) => error.name === 'TimeoutError');
  assert.equal(calls, 2);
});

test('busca no Supabase primeiro e mescla a Open Library sem duplicar obras', async () => {
  let openLibraryCalls = 0;
  const duplicate = { ...catalogResult, title: 'Título atualizado' };
  const extra = { ...catalogResult, workKey: '/works/OL2W', title: 'Outro livro' };
  const catalog: BookCatalogClient = {
    available: true,
    searchBooks: async () => ({ results: [catalogResult], page: 1, hasMore: false }),
    upsertBook: async () => undefined,
  };
  const openLibrary = {
    searchBooks: async () => {
      openLibraryCalls += 1;
      return { results: [duplicate, extra], page: 1, hasMore: false };
    },
    trendingBooks: async () => ({ results: [], page: 1, hasMore: false }),
  };

  const result = await searchBookSources('livro', 1, undefined, { catalog, openLibrary });
  assert.equal(openLibraryCalls, 1);
  assert.deepEqual(result.results.map((book) => book.workKey), ['/works/OL1W', '/works/OL2W']);
  assert.equal(result.results[0]?.title, 'Livro do catálogo');
});

test('continua pela Open Library quando o catálogo remoto falha', async () => {
  const catalog: BookCatalogClient = {
    available: true,
    searchBooks: async () => { throw new Error('Supabase offline'); },
    upsertBook: async () => undefined,
  };
  const openLibraryBook: BookSearchResult = {
    workKey: '/works/OL3W',
    title: 'Fallback',
    author: 'Autora',
  };
  const openLibrary = {
    searchBooks: async () => ({ results: [openLibraryBook], page: 1, hasMore: false }),
    trendingBooks: async () => ({ results: [], page: 1, hasMore: false }),
  };

  const result = await searchBookSources('fallback', 1, undefined, { catalog, openLibrary });
  assert.deepEqual(result.results, [openLibraryBook]);
});
