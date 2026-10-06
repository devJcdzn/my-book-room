import assert from 'node:assert/strict';
import test from 'node:test';
import { connectAnalytics, flushAnalytics, identifyAnalytics, retryAnalyticsIdentity, trackAnalyticsScreen, trackEvent } from '../src/services/analytics';

test('analytics: disabled, privacy allowlist, stable routes and account isolation', async () => {
  trackEvent('book_added', { title: 'private' }); // Disabled is a no-op.
  const calls: { kind: string; value?: unknown }[] = [];
  const client = {
    track: (event: string, properties?: Record<string, unknown>) => { calls.push({ kind: event, value: properties }); },
    trackScreen: (name: string, path?: string) => { calls.push({ kind: 'screen', value: { name, path } }); },
    identify: async (data: unknown) => { calls.push({ kind: 'identify', value: data }); },
    reset: async () => { calls.push({ kind: 'reset' }); },
    flush: async () => {},
  };
  const disconnect = connectAnalytics(client, { platform: 'ios', app_version: '1.1.2' }, Promise.resolve(null), async () => {});
  try {
    trackAnalyticsScreen(['(tabs)', 'books', '[id]']);
    trackAnalyticsScreen(['(tabs)', 'books', '[id]']);
    trackEvent('book_added', { source: 'manual', status: 'reading', title: 'private', token: 'secret' });
    await flushAnalytics();
    assert.equal(calls.filter((call) => call.kind === 'screen').length, 1);
    assert.deepEqual(calls[0].value, { name: 'books_:id', path: '/books/:id' });
    assert.deepEqual(calls[1].value, { platform: 'ios', app_version: '1.1.2', user_type: 'guest', source: 'manual', status: 'reading' });

    const a = { userId: 'A', name: 'Ana', email: 'ana@example.com', metadata: { provider: 'apple', created_at: '2026-10-03' } };
    void identifyAnalytics(a);
    trackEvent('login_succeeded', { provider: 'apple' });
    await flushAnalytics();
    assert.equal(calls.some((call) => call.kind === 'reset'), false); // Guest funnel stays attached to first login.
    assert.equal((calls.find((call) => call.kind === 'login_succeeded')?.value as Record<string, unknown>).user_type, 'connected');
    await retryAnalyticsIdentity();
    assert.equal(calls.filter((call) => call.kind === 'identify').length, 2); // Restored/foreground identification is not a login event.

    void identifyAnalytics(null);
    void identifyAnalytics({ userId: 'B', metadata: {} });
    trackEvent('reading_note_created', { text: 'private' });
    await flushAnalytics();
    const resetAt = calls.findIndex((call) => call.kind === 'reset');
    const bAt = calls.findIndex((call) => call.kind === 'identify' && (call.value as { userId: string }).userId === 'B');
    assert.ok(resetAt >= 0 && bAt > resetAt);
    assert.equal(calls.filter((call) => call.kind === 'login_succeeded').length, 1);
    assert.equal(JSON.stringify(calls).includes('private'), false);
  } finally { disconnect(); }
});

test('analytics: stale connections and failed resets never attribute events to another account', async () => {
  let release!: (id: string | null) => void;
  const ready = new Promise<string | null>((resolve) => { release = resolve; });
  const events: string[] = [];
  const client = { track: (event: string) => { events.push(event); }, trackScreen: () => {}, identify: async () => {}, reset: async () => { throw new Error('storage unavailable'); }, flush: async () => {} };
  const disconnect = connectAnalytics(client, { platform: 'ios', app_version: 'test' }, ready, async () => {});
  trackEvent('book_completed');
  disconnect();
  release('A');
  await flushAnalytics();
  const disconnectNew = connectAnalytics(client, { platform: 'ios', app_version: 'test' }, Promise.resolve('A'), async () => {});
  try {
    void identifyAnalytics({ userId: 'B', metadata: {} });
    trackEvent('book_completed');
    await flushAnalytics();
    assert.deepEqual(events, []);
  } finally { disconnectNew(); }
});


test('analytics: an old identify response finishes before resetting and identifying the next account', async () => {
  const calls: string[] = [];
  let release!: () => void;
  const response = new Promise<void>((resolve) => { release = resolve; });
  const disconnect = connectAnalytics({
    track: () => {}, trackScreen: () => {}, flush: async () => {},
    reset: async () => { calls.push('reset'); },
    identify: async ({ userId }) => {
      calls.push(`start:${userId}`);
      if (userId === 'A') await response;
      calls.push(`end:${userId}`);
    },
  }, { platform: 'ios', app_version: 'test' }, Promise.resolve(null), async () => {});
  try {
    const first = identifyAnalytics({ userId: 'A', metadata: {} });
    void identifyAnalytics(null);
    const second = identifyAnalytics({ userId: 'B', metadata: {} });
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(calls, ['start:A']);
    release();
    await first;
    await second;
    assert.deepEqual(calls, ['start:A', 'end:A', 'reset', 'start:B', 'end:B']);
  } finally { release(); disconnect(); }
});
