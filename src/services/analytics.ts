import type { HimetricaClient } from '@himetrica/tracker-react-native';

type AnalyticsClient = Pick<HimetricaClient, 'track' | 'trackScreen' | 'identify' | 'reset' | 'flush'>;
type Identity = { userId: string; name?: string; email?: string; metadata: { provider?: string; created_at?: string } };
const eventProperties = {
  onboarding_started: ['version'], onboarding_completed: ['final_step'], onboarding_skipped: ['final_step'],
  login_started: ['provider'], login_succeeded: ['provider'], login_cancelled: ['provider'], login_failed: ['provider', 'failure_category'],
  book_added: ['source', 'status'], book_completed: [], reading_session_saved: ['duration_seconds', 'pages_read'],
  reading_note_created: [], room_customization_saved: ['piece_count'], profile_updated: ['photo_changed'],
  account_signed_out: [], account_deleted: [],
} as const;

let client: AnalyticsClient | undefined;
let sequence = Promise.resolve();
let generation = 0;
let accountId: string | null = null;
let identity: Identity | null = null;
let context: { platform: string; app_version: string };
let lastScreen: { name: string; path: string } | undefined;
let saveAccount: (id: string | null) => Promise<void>;

function enqueue(operation: () => void | Promise<void>) {
  const active = generation;
  sequence = sequence.then(() => active === generation ? operation() : undefined).catch(() => undefined);
  return sequence;
}

export function initializeAnalytics(sdk: Pick<HimetricaClient, 'init'>) {
  // Share the SDK's initialization between its provider and our child bridge.
  const initialize = sdk.init.bind(sdk);
  let ready: Promise<void> | undefined;
  sdk.init = () => ready ??= initialize().catch(() => undefined);
  return sdk.init();
}

export function connectAnalytics(sdk: AnalyticsClient, properties: typeof context, ready: Promise<string | null>, persistAccount: typeof saveAccount) {
  generation++;
  const active = generation;
  lastScreen = undefined;
  client = sdk;
  context = properties;
  saveAccount = persistAccount;
  sequence = ready.then((previousAccount) => { if (active === generation) accountId = previousAccount; }).catch(() => undefined);
  return () => { if (active === generation) { generation++; client = undefined; identity = null; accountId = null; lastScreen = undefined; } };
}

export function identifyAnalytics(next: Identity | null) {
  if (!client) return;
  identity = next;
  const sdk = client;
  return enqueue(async () => {
    const nextId = next?.userId ?? null;
    if (accountId !== nextId) {
      // Flush the previous visitor before reset clears the SDK's pending events.
      if (accountId !== null) {
        await sdk.flush();
        await sdk.reset();
        if (lastScreen) sdk.trackScreen(lastScreen.name, lastScreen.path);
      }
      accountId = nextId;
      await saveAccount(nextId);
    }
    if (next) await sdk.identify(next);
  });
}

export function retryAnalyticsIdentity() {
  return identifyAnalytics(identity);
}

export function trackEvent(event: keyof typeof eventProperties, properties: Record<string, string | number | boolean> = {}) {
  if (!client) return;
  const sdk = client;
  const expectedAccount = identity?.userId ?? null;
  const payload: Record<string, unknown> = { ...context, user_type: identity ? 'connected' : 'guest' };
  for (const key of eventProperties[event]) if (properties[key] !== undefined) payload[key] = properties[key];
  void enqueue(() => { if (accountId === expectedAccount) sdk.track(event, payload); });
}

export function trackAnalyticsScreen(segments: string[]) {
  if (!client) return;
  const sdk = client;
  const path = '/' + segments.filter((segment) => !segment.startsWith('(')).map((segment) => segment.startsWith('[') ? ':id' : segment).join('/');
  if (lastScreen?.path === path) return;
  lastScreen = { name: path === '/' ? 'room' : path.slice(1).replaceAll('/', '_'), path };
  const screen = lastScreen;
  void enqueue(() => sdk.trackScreen(screen.name, screen.path));
}

export function flushAnalytics() {
  if (!client) return Promise.resolve();
  const sdk = client;
  return enqueue(() => sdk.flush());
}
