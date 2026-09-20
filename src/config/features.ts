/**
 * Account sync is deliberately opt-in until the first public app version is ready.
 * Keep this value explicit in EAS/local environments when testing the auth flow.
 */
export const ACCOUNT_SYNC_ENABLED = process.env.EXPO_PUBLIC_ENABLE_ACCOUNT_SYNC === 'true';
