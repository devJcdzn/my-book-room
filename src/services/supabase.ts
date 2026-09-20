/* eslint-disable @typescript-eslint/no-require-imports */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const isNativeRuntime = process.env.EXPO_OS === 'ios' || process.env.EXPO_OS === 'android';

if (isNativeRuntime) require('react-native-url-polyfill/auto');

const memoryStorage = new Map<string, string>();
const getSecureStore = () => require('expo-secure-store') as typeof import('expo-secure-store');

const authStorage = {
  getItem: (key: string) => isNativeRuntime
    ? getSecureStore().getItemAsync(key)
    : Promise.resolve(memoryStorage.get(key) ?? null),
  setItem: async (key: string, value: string) => {
    if (isNativeRuntime) await getSecureStore().setItemAsync(key, value);
    else memoryStorage.set(key, value);
  },
  removeItem: async (key: string) => {
    if (isNativeRuntime) await getSecureStore().deleteItemAsync(key);
    else memoryStorage.delete(key);
  },
};

const createSupabaseClient = (): SupabaseClient | undefined => {
  if (!supabaseUrl || !supabasePublishableKey) return undefined;

  try {
    return createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        storage: authStorage,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
        flowType: 'pkce',
      },
    });
  } catch (error) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('Configuração do catálogo Supabase inválida.', error);
    }
    return undefined;
  }
};

export const supabase = createSupabaseClient();
export const isSupabaseConfigured = Boolean(supabase);
