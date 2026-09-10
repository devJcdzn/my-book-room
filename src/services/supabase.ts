/* eslint-disable @typescript-eslint/no-require-imports */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const isNativeRuntime = process.env.EXPO_OS === 'ios' || process.env.EXPO_OS === 'android';

if (isNativeRuntime) require('react-native-url-polyfill/auto');

const createSupabaseClient = (): SupabaseClient | undefined => {
  if (!supabaseUrl || !supabasePublishableKey) return undefined;

  try {
    return createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
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
