import assert from 'node:assert/strict';
import test from 'node:test';

import {
  captureRoomSnapshot,
  clearRoomSnapshotCache,
  getLastCapturedRoomUri,
  registerRoomSnapshotHandler,
  setLastCapturedRoomUri,
} from '../src/services/room-snapshot-service';
import {
  computeReadingStats,
  formatReadingStatsSummary,
} from '../src/services/share-room';
import type { Book } from '../src/types/book';

const mockBook = (overrides: Partial<Book> = {}): Book => ({
  id: 'b-1',
  source: 'manual',
  title: 'Dom Casmurro',
  author: 'Machado de Assis',
  totalPages: 256,
  currentPage: 128,
  status: 'reading',
  coverColor: '#4A6B82',
  notes: '',
  rating: 0,
  ...overrides,
});

test('computeReadingStats lida com lista vazia com valores padrão e sem divisão por zero', () => {
  const stats = computeReadingStats([], '');
  assert.equal(stats.readerName, 'Leitor(a)');
  assert.equal(stats.totalPagesRead, 0);
  assert.equal(stats.completedCount, 0);
  assert.equal(stats.readingCount, 0);
  assert.equal(stats.totalBooks, 0);
  assert.equal(stats.activeBook, null);
  assert.equal(stats.activeBookProgress, 0);
});

test('computeReadingStats soma corretamente páginas de livros concluídos e em leitura', () => {
  const books: Book[] = [
    mockBook({ id: '1', status: 'completed', totalPages: 300, currentPage: 150 }), // soma 300
    mockBook({ id: '2', status: 'reading', totalPages: 200, currentPage: 50 }),     // soma 50
    mockBook({ id: '3', status: 'completing', totalPages: 400, currentPage: 10 }), // soma 10
  ];

  const stats = computeReadingStats(books, 'Clarice');
  assert.equal(stats.readerName, 'Clarice');
  assert.equal(stats.completedCount, 1);
  assert.equal(stats.readingCount, 1);
  assert.equal(stats.totalBooks, 3);
  assert.equal(stats.totalPagesRead, 300 + 50 + 10);
});

test('computeReadingStats seleciona o livro ativo e calcula porcentagem de progresso', () => {
  const b1 = mockBook({ id: '1', title: 'Livro A', status: 'reading', totalPages: 200, currentPage: 100 });
  const b2 = mockBook({ id: '2', title: 'Livro B', status: 'reading', totalPages: 300, currentPage: 75 });
  const books = [b1, b2];

  // Especificando activeBookId
  const statsA = computeReadingStats(books, 'Jean', '1');
  assert.equal(statsA.activeBook?.id, '1');
  assert.equal(statsA.activeBookProgress, 50);
  assert.equal(statsA.readingBooks.length, 2);
  assert.equal(statsA.readingBooks[0].id, '1');
  assert.equal(statsA.readingBooks[1].id, '2');

  // Sem especificar id, seleciona o último em leitura
  const statsDefault = computeReadingStats(books, 'Jean');
  assert.equal(statsDefault.activeBook?.id, '2');
  assert.equal(statsDefault.activeBookProgress, 25);
  assert.equal(statsDefault.readingBooks.length, 2);
});

test('formatReadingStatsSummary gera texto descritivo elegante em português', () => {
  const book = mockBook({ title: 'Memórias Póstumas', author: 'Machado de Assis', totalPages: 200, currentPage: 100, status: 'reading' });
  const stats = computeReadingStats([book], 'Jean', 'b-1');
  const summary = formatReadingStatsSummary(stats);

  assert.ok(summary.includes('📚 Meu Refúgio de Leitura no Bookroom'));
  assert.ok(summary.includes('Jean'));
  assert.ok(summary.includes('Memórias Póstumas'));
  assert.ok(summary.includes('50% concluído'));
  assert.ok(summary.includes('Bookroom ☕✨'));
});

test('room-snapshot-service registra handler e gerencia snapshots', async () => {
  clearRoomSnapshotCache();
  assert.equal(getLastCapturedRoomUri(), null);
  assert.equal(getLastCapturedRoomUri('day'), null);
  assert.equal(getLastCapturedRoomUri('night'), null);

  registerRoomSnapshotHandler(async (options) => {
    if (options?.ambience === 'night') return 'file:///tmp/room-night.png';
    return 'file:///tmp/room-day.png';
  });

  const dayUri = await captureRoomSnapshot({ ambience: 'day' });
  assert.equal(dayUri, 'file:///tmp/room-day.png');
  assert.equal(getLastCapturedRoomUri('day'), 'file:///tmp/room-day.png');
  assert.equal(getLastCapturedRoomUri('night'), null); // Não vaza o snapshot do dia para a noite!

  const nightUri = await captureRoomSnapshot({ ambience: 'night' });
  assert.equal(nightUri, 'file:///tmp/room-night.png');
  assert.equal(getLastCapturedRoomUri('night'), 'file:///tmp/room-night.png');

  // Limpa o handler e testa uso do cache por ambiente
  registerRoomSnapshotHandler(null);
  const cachedDayUri = await captureRoomSnapshot({ ambience: 'day' });
  assert.equal(cachedDayUri, 'file:///tmp/room-day.png');

  clearRoomSnapshotCache();
  assert.equal(getLastCapturedRoomUri('day'), null);
  assert.equal(getLastCapturedRoomUri('night'), null);
});
