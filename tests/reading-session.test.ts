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

const manualInput = (id: string, overrides = {}) => ({
  id, name: '', startingPage: 84, endingPage: 90, readingDate: '2026-09-20', ...overrides,
});

function withHistory(run: () => void) {
  const original = useLibraryStore.getState();
  useLibraryStore.setState({ books: [book], readingSessions: [], readingDays: ['2026-09-01'],
    legacyReadingDays: ['2026-09-01'], readingHistoryVersion: 1, activeReadingTimer: undefined,
    completingBookId: undefined, coverRewardBookId: undefined, deskBookIds: [book.id], activeBookId: book.id });
  try { run(); } finally { useLibraryStore.setState(original); }
}

test('manual retroativo preserva tempo desconhecido, marcador e dias legados ao editar e excluir', () => withHistory(() => {
  const state = useLibraryStore.getState();
  const saved = state.addManualReading(book.id, manualInput('manual-1'))!;
  assert.equal(saved.source, 'manual');
  assert.equal(saved.name, 'Leitura');
  assert.equal(saved.durationSeconds, undefined);
  assert.equal(saved.startedAt, undefined);
  assert.equal(saved.endedAt, undefined);
  assert.equal(useLibraryStore.getState().books[0].currentPage, 90);
  assert.equal(state.addManualReading(book.id, manualInput('manual-1')), undefined);
  assert.equal(useLibraryStore.getState().readingSessions.length, 1);
  state.updateReadingSession(saved.id, { name: 'Ontem', startingPage: 10, endingPage: 20, readingDate: '2026-09-21' });
  assert.equal(useLibraryStore.getState().books[0].currentPage, 90);
  assert.deepEqual(useLibraryStore.getState().readingDays, ['2026-09-01', '2026-09-21']);
  const restored = normalizePersistedState(JSON.parse(JSON.stringify(createPersistedState(useLibraryStore.getState()))));
  assert.deepEqual(restored.readingDays, ['2026-09-01', '2026-09-21']);
  assert.equal(restored.readingSessions[0].durationSeconds, undefined);
  useLibraryStore.setState(restored);
  state.removeReadingSession(saved.id);
  assert.deepEqual(useLibraryStore.getState().readingDays, ['2026-09-01']);
  assert.equal(useLibraryStore.getState().books[0].currentPage, 90);
}));

test('valida data, limites, tempo positivo e conflito com timer no próprio livro', () => withHistory(() => {
  const state = useLibraryStore.getState();
  for (const overrides of [{ readingDate: '2099-01-01' }, { readingDate: '2026-02-30' },
    { startingPage: -1 }, { endingPage: 241 }, { endingPage: 83 }, { startingPage: 84.5 },
    { endingPage: 84 }, { durationSeconds: -1 }, { durationSeconds: NaN }]) {
    assert.equal(state.addManualReading(book.id, manualInput('invalid', overrides)), undefined);
  }
  assert.ok(state.addManualReading(book.id, manualInput('time-only', { endingPage: 84, durationSeconds: 600 })));
  assert.equal(useLibraryStore.getState().books[0].currentPage, 84);
  assert.equal(state.startReadingTimer(book.id), true);
  assert.equal(state.addManualReading(book.id, manualInput('timer-blocked')), undefined);
  state.discardReadingTimer();
  assert.ok(state.addManualReading(book.id, manualInput('after-timer')));
}));

test('correção não registra leitura nem conclui; conclusão, reabertura e reconclusão preservam histórico', () => withHistory(() => {
  const state = useLibraryStore.getState();
  state.addManualReading(book.id, manualInput('preserved'));
  state.updateProgress(book.id, book.totalPages);
  assert.equal(useLibraryStore.getState().books[0].status, 'reading');
  assert.equal(useLibraryStore.getState().books[0].completedOn, undefined);
  assert.deepEqual(useLibraryStore.getState().readingDays, ['2026-09-01', '2026-09-20']);
  state.completeBook(book.id);
  assert.equal(useLibraryStore.getState().books[0].completedOn, localDateKey(new Date()));
  state.updateCompletedOn(book.id, '2026-09-22');
  assert.equal(useLibraryStore.getState().books[0].completedOn, '2026-09-22');
  state.updateCompletedOn(book.id, '2099-01-01');
  assert.equal(useLibraryStore.getState().books[0].completedOn, '2026-09-22');
  state.reopenBook(book.id);
  assert.equal(useLibraryStore.getState().books[0].completedOn, undefined);
  assert.equal(useLibraryStore.getState().readingSessions.length, 1);
  state.requestCompletion(book.id);
  state.finalizeCompletion(book.id);
  assert.equal(useLibraryStore.getState().books[0].completedOn, localDateKey(new Date()));
}));

test('migração preserva sessões e dias anteriores sem inventar conclusão ou atividades', () => {
  const oldSession = { id: 'old', bookId: book.id, bookTitle: book.title, bookAuthor: book.author,
    coverColor: book.coverColor, totalPages: 240, name: 'Antes', startingPage: 10, endingPage: 20,
    pagesRead: 10, startedAt: '2026-09-20T11:00:00Z', endedAt: '2026-09-20T11:20:00Z', durationSeconds: 1200 };
  const migrated = normalizePersistedState({ books: [book, { ...book, id: 'old-done', status: 'completed' }],
    readingDays: ['2026-09-01', '2026-09-20'], readingSessions: [oldSession] });
  assert.equal(migrated.readingHistoryVersion, 1);
  assert.deepEqual(migrated.legacyReadingDays, ['2026-09-01', '2026-09-20']);
  assert.equal(migrated.readingSessions.length, 1);
  assert.equal(migrated.readingSessions[0].source, 'timer');
  assert.equal(migrated.readingSessions[0].id, oldSession.id);
  assert.equal(migrated.readingSessions[0].endedAt, oldSession.endedAt);
  assert.equal(migrated.books[1].completedOn, undefined);
  withHistory(() => {
    useLibraryStore.setState(migrated);
    useLibraryStore.getState().removeReadingSession('old');
    assert.deepEqual(useLibraryStore.getState().readingDays, ['2026-09-01', '2026-09-20']);
  });
});
