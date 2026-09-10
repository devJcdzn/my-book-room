import assert from 'node:assert/strict';
import test from 'node:test';

import {
  coverUrlForId,
  createOpenLibraryClient,
  isValidIsbn,
  mapOpenLibraryDocument,
  mergeUniqueResults,
  normalizeIsbn,
} from '../src/services/open-library';
import { createCoverColorExtractor, decodeBlurhashColor } from '../src/services/cover-color';
import { deriveBookColor, useLibraryStore } from '../src/store/library-store';

const jsonResponse = (value: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(value), { status, headers });

const BASE_83 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~';
const blurhashForColor = (red: number, green: number, blue: number) => {
  let value = (red << 16) + (green << 8) + blue;
  let encoded = '';
  for (let divisor = 83 ** 3; divisor >= 1; divisor /= 83) {
    encoded += BASE_83[Math.floor(value / divisor) % 83];
  }
  return `00${encoded}`;
};

test('normaliza e valida ISBN-10 e ISBN-13', () => {
  assert.equal(normalizeIsbn('978-0-439-55493-0'), '9780439554930');
  assert.equal(isValidIsbn('0-306-40615-2'), true);
  assert.equal(isValidIsbn('978-0-439-55493-0'), true);
  assert.equal(isValidIsbn('978-0-439-55493-1'), false);
});

test('mapeia metadados incompletos sem inventar páginas', () => {
  const result = mapOpenLibraryDocument({ key: '/works/OL1W', title: 'Livro sem dados' });
  assert.deepEqual(result, {
    workKey: '/works/OL1W',
    editionKey: undefined,
    title: 'Livro sem dados',
    author: 'Autor desconhecido',
    totalPages: undefined,
    coverId: undefined,
    coverUrl: undefined,
    isbn: undefined,
    firstPublishYear: undefined,
  });
  assert.equal(coverUrlForId(123), 'https://covers.openlibrary.org/b/id/123-M.jpg?default=false');
});

test('prefere capa da edição exata, depois portuguesa e então a obra', () => {
  const document = {
    key: '/works/OL1W',
    title: 'Livro',
    cover_i: 30,
    editions: { docs: [
      { key: '/books/EN1M', isbn: ['9780439554930'], cover_i: 10, language: ['eng'] },
      { key: '/books/PT1M', cover_i: 20, language: ['por'] },
    ] },
  };
  assert.equal(mapOpenLibraryDocument(document)?.coverId, 20);
  assert.equal(mapOpenLibraryDocument(document, '9780439554930')?.coverId, 10);
  assert.equal(mapOpenLibraryDocument({ key: '/works/OL1W', title: 'Livro', cover_i: 30 })?.coverId, 30);
});

test('decodifica a cor média e limita somente luminosidade extrema', () => {
  assert.equal(decodeBlurhashColor(blurhashForColor(51, 102, 153)), '#336699');
  assert.equal(decodeBlurhashColor(blurhashForColor(0, 0, 0)), '#303030');
  assert.equal(decodeBlurhashColor(blurhashForColor(255, 255, 255)), '#D2D2D2');
  assert.equal(decodeBlurhashColor('inválido'), undefined);
});

test('extração de cor deduplica, usa cache e trata falha e timeout', async () => {
  let calls = 0;
  const extractor = createCoverColorExtractor(async () => {
    calls += 1;
    return blurhashForColor(51, 102, 153);
  });
  assert.deepEqual(await Promise.all([extractor('cover'), extractor('cover')]), ['#336699', '#336699']);
  assert.equal(await extractor('cover'), '#336699');
  assert.equal(calls, 1);

  const invalid = createCoverColorExtractor(async () => 'x');
  assert.equal(await invalid('cover'), undefined);
  const timedOut = createCoverColorExtractor(async () => new Promise<string>(() => undefined), 5);
  assert.equal(await timedOut('cover'), undefined);
});

test('cache de cores mantém no máximo 50 capas', async () => {
  let calls = 0;
  const extractor = createCoverColorExtractor(async () => {
    calls += 1;
    return blurhashForColor(51, 102, 153);
  });
  for (let index = 0; index < 51; index += 1) await extractor(`cover-${index}`);
  await extractor('cover-0');
  assert.equal(calls, 52);
});

test('livro é adicionado antes da cor extraída e atualização tardia não o recria', () => {
  useLibraryStore.setState({ books: [], activeBookId: undefined });
  const result = { workKey: '/works/OL1W', title: 'Livro', author: 'Autora', totalPages: 100 };
  useLibraryStore.getState().addOpenLibraryBook(result);
  assert.equal(useLibraryStore.getState().books[0].coverColor, deriveBookColor(result.workKey));
  useLibraryStore.getState().removeBook(result.workKey);
  useLibraryStore.getState().updateBookCoverColor(result.workKey, '#336699');
  assert.equal(useLibraryStore.getState().books.length, 0);
});

test('deduplica paginação por obra preservando a primeira ocorrência', () => {
  const first = { workKey: '/works/OL1W', title: 'Um', author: 'A' };
  const duplicate = { ...first, title: 'Outro título' };
  const second = { workKey: '/works/OL2W', title: 'Dois', author: 'B' };
  assert.deepEqual(mergeUniqueResults([first], [duplicate, second]), [first, second]);
});

test('deriva a mesma cor para a mesma obra', () => {
  assert.equal(deriveBookColor('/works/OL1W'), deriveBookColor('/works/OL1W'));
  assert.match(deriveBookColor('/works/OL1W'), /^#[0-9A-F]{6}$/);
});

test('usa cache para buscas repetidas', async () => {
  let calls = 0;
  const client = createOpenLibraryClient({
    fetcher: async () => {
      calls += 1;
      return jsonResponse({ docs: [{ key: '/works/OL1W', title: 'Torto Arado' }], numFound: 1 });
    },
    minIntervalMs: 0,
  });
  await client.searchBooks('Torto Arado');
  await client.searchBooks('Torto Arado');
  assert.equal(calls, 1);
});

test('tendências mantêm português preferencial e dados mínimos de edição', async () => {
  let requestedUrl = '';
  const client = createOpenLibraryClient({
    fetcher: async (url) => {
      requestedUrl = url;
      return jsonResponse({ works: [] });
    },
    minIntervalMs: 0,
  });
  await client.trendingBooks();
  assert.match(requestedUrl, /lang=pt/);
  assert.match(requestedUrl, /editions.cover_i/);
  assert.match(requestedUrl, /editions.language/);
});

test('deduplica chamadas simultâneas e limita o cache LRU a 50 respostas', async () => {
  let calls = 0;
  const client = createOpenLibraryClient({
    fetcher: async () => {
      calls += 1;
      return jsonResponse({ docs: [] });
    },
    minIntervalMs: 0,
  });
  await Promise.all([client.searchBooks('igual'), client.searchBooks('igual')]);
  assert.equal(calls, 1);
  for (let index = 0; index < 51; index += 1) await client.searchBooks(`livro ${index}`);
  await client.searchBooks('igual');
  assert.equal(calls, 53);
});

test('ISBN usa edição exata e substitui a mediana quando há páginas', async () => {
  const urls: string[] = [];
  const client = createOpenLibraryClient({
    fetcher: async (url) => {
      urls.push(url);
      if (url.endsWith('/books/OL10M.json')) return jsonResponse({ number_of_pages: 312 });
      return jsonResponse({
        docs: [{
          key: '/works/OL1W',
          title: 'Livro',
          author_name: ['Autora'],
          number_of_pages_median: 280,
          editions: { docs: [{ key: '/books/OL10M', isbn: ['9780439554930'] }] },
        }],
        numFound: 1,
      });
    },
    minIntervalMs: 0,
  });
  const page = await client.searchBooks('978-0-439-55493-0');
  assert.equal(page.results[0].totalPages, 312);
  assert.equal(page.results[0].totalPagesSource, 'open_library');
  assert.match(urls[0], /q=isbn%3A9780439554930/);
  assert.equal(urls.length, 2);
});

test('edição ausente preserva mediana em vez de bloquear a busca', async () => {
  const client = createOpenLibraryClient({
    fetcher: async (url) => url.includes('/books/')
      ? jsonResponse({}, 404)
      : jsonResponse({
        docs: [{
          key: '/works/OL1W', title: 'Livro', number_of_pages_median: 280,
          edition_key: ['OL10M'],
        }],
        numFound: 1,
      }),
    minIntervalMs: 0,
  });
  assert.equal((await client.searchBooks('9780439554930')).results[0].totalPages, 280);
});

test('não repete 403 e repete uma vez 429 e 5xx', async () => {
  for (const status of [429, 500]) {
    let calls = 0;
    const client = createOpenLibraryClient({
      fetcher: async () => {
        calls += 1;
        return calls === 1 ? jsonResponse({}, status, { 'Retry-After': '0' }) : jsonResponse({ docs: [] });
      },
      minIntervalMs: 0,
      retryDelayMs: 0,
    });
    await client.searchBooks('livro');
    assert.equal(calls, 2);
  }

  let forbiddenCalls = 0;
  const forbidden = createOpenLibraryClient({
    fetcher: async () => {
      forbiddenCalls += 1;
      return jsonResponse({}, 403);
    },
    minIntervalMs: 0,
  });
  await assert.rejects(forbidden.searchBooks('livro'));
  assert.equal(forbiddenCalls, 1);

  let networkCalls = 0;
  const networkFailure = createOpenLibraryClient({
    fetcher: async () => {
      networkCalls += 1;
      if (networkCalls === 1) throw new TypeError('network failed');
      return jsonResponse({ docs: [] });
    },
    minIntervalMs: 0,
    retryDelayMs: 0,
  });
  await networkFailure.searchBooks('livro');
  assert.equal(networkCalls, 2);
});

test('trata JSON inválido, timeout e cancelamento', async () => {
  const invalid = createOpenLibraryClient({
    fetcher: async () => new Response('{'),
    minIntervalMs: 0,
  });
  await assert.rejects(invalid.searchBooks('livro'), SyntaxError);

  const neverResponds = (async (_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
  })) as (input: string, init?: RequestInit) => Promise<Response>;
  const timedOut = createOpenLibraryClient({ fetcher: neverResponds, minIntervalMs: 0, timeoutMs: 5 });
  await assert.rejects(timedOut.searchBooks('livro'), (error: Error) => error.name === 'TimeoutError');

  const controller = new AbortController();
  const cancelled = createOpenLibraryClient({ fetcher: neverResponds, minIntervalMs: 0 });
  const pending = cancelled.searchBooks('livro', 1, controller.signal);
  controller.abort();
  await assert.rejects(pending, (error: Error) => error.name === 'AbortError');
});

test('respeita intervalo mínimo entre inícios de chamadas', async () => {
  const starts: number[] = [];
  const client = createOpenLibraryClient({
    fetcher: async () => {
      starts.push(Date.now());
      return jsonResponse({ docs: [] });
    },
    minIntervalMs: 20,
  });
  await Promise.all([client.searchBooks('primeiro'), client.searchBooks('segundo')]);
  assert.ok(starts[1] - starts[0] >= 18);
});
