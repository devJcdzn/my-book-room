import assert from 'node:assert/strict';
import test from 'node:test';

import type { Book } from '../src/types/book';
import { createPersistedState, normalizePersistedState, useLibraryStore } from '../src/store/library-store';
import { localDateKey } from '../src/utils/reading-days';

const book: Book = {
  id: 'timer-book',
  source: 'manual',
  title: 'Livro do timer',
  author: 'Autora',
  coverColor: '#486A55',
  totalPages: 240,
  currentPage: 84,
  status: 'reading',
};

test('snapshots antigos ganham coleções de sessão vazias e preservam os timers válidos', () => {
  const legacy = normalizePersistedState({ books: [book] });
  assert.deepEqual(legacy.readingSessions, []);
  assert.equal(legacy.activeReadingTimer, undefined);

  const original = useLibraryStore.getState();
  try {
    useLibraryStore.setState({
      ...original,
      books: [book],
      deskBookIds: [book.id],
      activeBookId: book.id,
      activeReadingTimer: undefined,
      readingSessions: [],
    });
    assert.equal(useLibraryStore.getState().startReadingTimer(book.id), true);
    assert.equal(useLibraryStore.getState().startReadingTimer(book.id), false);
    const snapshot = createPersistedState(useLibraryStore.getState());
    assert.equal(snapshot.activeReadingTimer?.bookTitle, book.title);
    assert.equal(snapshot.activeReadingTimer?.startingPage, book.currentPage);
  } finally {
    useLibraryStore.setState(original);
  }
});

test('pausa, retomada e salvamento congelam o tempo e atualizam páginas e calendário', () => {
  const original = useLibraryStore.getState();
  try {
    useLibraryStore.setState({
      ...original,
      books: [book],
      deskBookIds: [book.id],
      activeBookId: book.id,
      activeReadingTimer: undefined,
      readingSessions: [],
      readingDays: [],
    });
    const state = useLibraryStore.getState();
    assert.equal(state.startReadingTimer(book.id), true);

    const started = useLibraryStore.getState().activeReadingTimer!;
    useLibraryStore.setState({ activeReadingTimer: {
      ...started,
      elapsedMs: 8_000,
      segmentStartedAt: new Date(Date.now() - 12_000).toISOString(),
    } });
    useLibraryStore.getState().pauseReadingTimer();
    const paused = useLibraryStore.getState().activeReadingTimer!;
    assert.equal(paused.phase, 'paused');
    assert.ok(paused.elapsedMs >= 19_000);

    useLibraryStore.getState().resumeReadingTimer();
    useLibraryStore.getState().finishReadingTimer();
    const review = useLibraryStore.getState().activeReadingTimer!;
    assert.equal(review.phase, 'review');
    assert.equal(normalizePersistedState({ books: [book], activeReadingTimer: review }).activeReadingTimer?.phase, 'review');
    assert.equal(useLibraryStore.getState().saveReadingSession({ name: 'Inválida', endingPage: 83 }), undefined);
    assert.ok(useLibraryStore.getState().activeReadingTimer);

    const session = useLibraryStore.getState().saveReadingSession({
      name: 'Capítulo da manhã',
      description: 'Uma boa leitura.',
      endingPage: 100,
    });
    assert.ok(session);
    assert.equal(session.pagesRead, 16);
    assert.equal(session.startingPage, 84);
    assert.equal(session.endingPage, 100);
    assert.ok(session.durationSeconds >= 19);

    const savedState = useLibraryStore.getState();
    assert.equal(savedState.activeReadingTimer, undefined);
    assert.equal(savedState.books[0]?.currentPage, 100);
    assert.ok(savedState.readingDays.includes(localDateKey(new Date(session.endedAt))));
    assert.equal(createPersistedState(savedState).readingSessions[0]?.id, session.id);
  } finally {
    useLibraryStore.setState(original);
  }
});

test('nota rápida entra no diário com título e página vinculados ao livro', () => {
  const original = useLibraryStore.getState();
  try {
    useLibraryStore.setState({ ...original, books: [book] });
    useLibraryStore.getState().addReadingEntry(book.id, {
      title: 'Nota de leitura',
      text: 'Guardar esta passagem.',
      page: book.currentPage,
    });
    const entry = useLibraryStore.getState().books[0]?.readingEntries?.[0];
    assert.equal(entry?.title, 'Nota de leitura');
    assert.equal(entry?.text, 'Guardar esta passagem.');
    assert.equal(entry?.page, 84);
  } finally {
    useLibraryStore.setState(original);
  }
});
