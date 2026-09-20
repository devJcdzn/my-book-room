import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import type { Session, User } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useProAccess } from '@/src/providers/revenuecat-provider';
import {
  fetchLibraryBackup,
  saveLibraryBackup,
  type RemoteLibraryBackup,
} from '@/src/services/library-sync';
import {
  identifyRevenueCatCustomer,
  resetRevenueCatCustomer,
} from '@/src/services/revenuecat';
import { supabase } from '@/src/services/supabase';
import {
  createPersistedState,
  getCurrentLibrarySnapshot,
  isDefaultLibrarySnapshot,
  normalizePersistedState,
  overwriteLibraryStorageScope,
  readLibraryStorageScope,
  replaceLibrarySnapshot,
  switchLibraryStorageScope,
  useLibraryStore,
  type PersistedLibraryState,
} from '@/src/store/library-store';

WebBrowser.maybeCompleteAuthSession();

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'conflict' | 'error';
export type ConflictChoice = 'cloud' | 'device';

type PendingConflict = {
  local: PersistedLibraryState;
  remote: RemoteLibraryBackup;
};

type AuthContextValue = {
  user: User | null;
  provider: 'apple' | 'google' | null;
  isLoading: boolean;
  isAuthenticating: boolean;
  errorMessage: string | null;
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  hasConflict: boolean;
  purchasesLinked: boolean;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resolveConflict: (choice: ConflictChoice) => Promise<void>;
  retrySync: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

type SyncMetadata = { revision: number; hash: string; updatedAt: string };

const AuthContext = createContext<AuthContextValue | null>(null);
const REDIRECT_URL = Linking.createURL('auth/callback', { scheme: 'mybookroom' });
const SYNC_DEBOUNCE_MS = 900;

const metadataKey = (userId: string) => `bookroom-sync:${userId}`;

const hashSnapshot = (snapshot: PersistedLibraryState) => {
  const serialized = JSON.stringify({ ...snapshot, pictureFramePhotoUri: null });
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
};

const readMetadata = async (userId: string): Promise<SyncMetadata | null> => {
  try {
    const value = await SecureStore.getItemAsync(metadataKey(userId));
    return value ? JSON.parse(value) as SyncMetadata : null;
  } catch {
    return null;
  }
};

const saveMetadata = async (userId: string, backup: RemoteLibraryBackup, snapshot: PersistedLibraryState) => {
  const metadata: SyncMetadata = {
    revision: backup.revision,
    updatedAt: backup.updatedAt,
    hash: hashSnapshot(snapshot),
  };
  await SecureStore.setItemAsync(metadataKey(userId), JSON.stringify(metadata));
  return metadata;
};

const getProvider = (user: User | null): 'apple' | 'google' | null => {
  const provider = user?.app_metadata?.provider;
  return provider === 'apple' || provider === 'google' ? provider : null;
};

const isCancelledError = (error: unknown) => (
  error instanceof Error
  && (error.message.includes('ERR_REQUEST_CANCELED') || error.message.toLowerCase().includes('cancel'))
);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { refreshProAccess } = useProAccess();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(supabase));
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [pendingConflict, setPendingConflict] = useState<PendingConflict | null>(null);
  const [purchasesLinked, setPurchasesLinked] = useState(false);
  const sessionRef = useRef<Session | null>(null);
  const metadataRef = useRef<SyncMetadata | null>(null);
  const syncReadyRef = useRef(false);
  const switchingRef = useRef(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recordBackup = useCallback(async (
    userId: string,
    backup: RemoteLibraryBackup,
    snapshot: PersistedLibraryState,
  ) => {
    metadataRef.current = await saveMetadata(userId, backup, snapshot);
    setLastSyncedAt(backup.updatedAt);
    setSyncStatus('synced');
  }, []);

  const pushCurrentSnapshot = useCallback(async () => {
    const currentSession = sessionRef.current;
    if (!supabase || !currentSession || !syncReadyRef.current || pendingConflict) return;

    setSyncStatus('syncing');
    const snapshot = getCurrentLibrarySnapshot();
    try {
      const backup = await saveLibraryBackup(
        supabase,
        currentSession.user.id,
        snapshot,
        metadataRef.current?.revision ?? null,
      );
      await recordBackup(currentSession.user.id, backup, snapshot);
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      if (message.includes('outro aparelho') || message.includes('40001')) {
        try {
          const remote = await fetchLibraryBackup(supabase, currentSession.user.id);
          if (remote) {
            setPendingConflict({ local: snapshot, remote });
            setSyncStatus('conflict');
            return;
          }
        } catch { /* handled as a network failure below */ }
      }
      setSyncStatus(message.includes('network') || message.includes('fetch') ? 'offline' : 'error');
    }
  }, [pendingConflict, recordBackup]);

  const activateSession = useCallback(async (nextSession: Session) => {
    if (!supabase || switchingRef.current) return;
    switchingRef.current = true;
    syncReadyRef.current = false;
    setSession(nextSession);
    sessionRef.current = nextSession;
    setErrorMessage(null);

    try {
      const userId = nextSession.user.id;
      const accountScope = `user:${userId}` as const;
      const guestSnapshot = getCurrentLibrarySnapshot();
      const cachedSnapshot = await readLibraryStorageScope(accountScope);
      const localSnapshot = cachedSnapshot ?? guestSnapshot;
      const [remote, metadata] = await Promise.all([
        fetchLibraryBackup(supabase, userId),
        readMetadata(userId),
      ]);
      metadataRef.current = metadata;

      if (!remote) {
        await switchLibraryStorageScope(accountScope, localSnapshot);
        syncReadyRef.current = true;
        const created = await saveLibraryBackup(supabase, userId, getCurrentLibrarySnapshot(), null);
        await recordBackup(userId, created, getCurrentLibrarySnapshot());
      } else {
        const localChanged = metadata ? hashSnapshot(localSnapshot) !== metadata.hash : !isDefaultLibrarySnapshot(localSnapshot);
        const remoteChanged = metadata ? remote.revision !== metadata.revision : true;

        if (localChanged && remoteChanged) {
          setPendingConflict({ local: localSnapshot, remote });
          setSyncStatus('conflict');
        } else if (localChanged) {
          await switchLibraryStorageScope(accountScope, localSnapshot);
          syncReadyRef.current = true;
          const saved = await saveLibraryBackup(supabase, userId, getCurrentLibrarySnapshot(), remote.revision);
          await recordBackup(userId, saved, getCurrentLibrarySnapshot());
        } else {
          await switchLibraryStorageScope(accountScope, localSnapshot);
          replaceLibrarySnapshot({ ...remote.snapshot, pictureFramePhotoUri: localSnapshot.pictureFramePhotoUri });
          syncReadyRef.current = true;
          await recordBackup(userId, remote, getCurrentLibrarySnapshot());
        }
      }

    } catch {
      setSyncStatus('error');
      setErrorMessage('Sua conta foi conectada, mas a sincronização não pôde ser concluída agora.');
    }

    const linked = await identifyRevenueCatCustomer(nextSession.user.id);
    setPurchasesLinked(linked);
    if (linked) await refreshProAccess();
    switchingRef.current = false;
    setIsLoading(false);
  }, [recordBackup, refreshProAccess]);

  useEffect(() => {
    if (!supabase) return;

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void activateSession(data.session);
      else setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (nextSession && nextSession.user.id !== sessionRef.current?.user.id) {
        void activateSession(nextSession);
      } else if (!nextSession && sessionRef.current) {
        sessionRef.current = null;
        syncReadyRef.current = false;
        setSession(null);
        setSyncStatus('idle');
        setLastSyncedAt(null);
        setPurchasesLinked(false);
        void resetRevenueCatCustomer();
        void switchLibraryStorageScope('guest');
      }
    });
    return () => subscription.unsubscribe();
  }, [activateSession]);

  useEffect(() => useLibraryStore.subscribe(() => {
    if (!syncReadyRef.current || switchingRef.current || !sessionRef.current || pendingConflict) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => { void pushCurrentSnapshot(); }, SYNC_DEBOUNCE_MS);
  }), [pendingConflict, pushCurrentSnapshot]);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        client.auth.startAutoRefresh();
        if (sessionRef.current && syncReadyRef.current) void pushCurrentSnapshot();
      } else {
        client.auth.stopAutoRefresh();
      }
    });
    return () => subscription.remove();
  }, [pushCurrentSnapshot]);

  const signInWithOAuth = useCallback(async (provider: 'apple' | 'google') => {
    if (!supabase) throw new Error('A sincronização ainda não está configurada.');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: REDIRECT_URL, skipBrowserRedirect: true },
    });
    if (error || !data.url) throw error ?? new Error('Não foi possível abrir o login.');

    const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URL);
    if (result.type !== 'success') return;
    const code = new URL(result.url).searchParams.get('code');
    if (!code) throw new Error('O provedor não retornou um código de acesso.');
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
  }, []);

  const runAuthentication = useCallback(async (operation: () => Promise<void>) => {
    setIsAuthenticating(true);
    setErrorMessage(null);
    try {
      await operation();
    } catch (error) {
      if (!isCancelledError(error)) setErrorMessage('Não foi possível entrar. Verifique sua conexão e tente novamente.');
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const signInWithApple = useCallback(() => runAuthentication(async () => {
    if (process.env.EXPO_OS !== 'ios') return signInWithOAuth('apple');
    if (!supabase) throw new Error('A sincronização ainda não está configurada.');
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) throw new Error('A Apple não retornou uma identidade válida.');
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      access_token: credential.authorizationCode ?? undefined,
    });
    if (error) throw error;
  }), [runAuthentication, signInWithOAuth]);

  const signInWithGoogle = useCallback(
    () => runAuthentication(() => signInWithOAuth('google')),
    [runAuthentication, signInWithOAuth],
  );

  const resolveConflict = useCallback(async (choice: ConflictChoice) => {
    const currentSession = sessionRef.current;
    if (!supabase || !currentSession || !pendingConflict) return;
    setSyncStatus('syncing');
    const scope = `user:${currentSession.user.id}` as const;
    const selected = choice === 'cloud'
      ? normalizePersistedState({
        ...pendingConflict.remote.snapshot,
        pictureFramePhotoUri: pendingConflict.local.pictureFramePhotoUri,
      })
      : pendingConflict.local;
    await switchLibraryStorageScope(scope, selected);
    replaceLibrarySnapshot(selected);
    syncReadyRef.current = true;
    setPendingConflict(null);

    if (choice === 'device') {
      const saved = await saveLibraryBackup(
        supabase,
        currentSession.user.id,
        selected,
        pendingConflict.remote.revision,
      );
      await recordBackup(currentSession.user.id, saved, selected);
    } else {
      await recordBackup(currentSession.user.id, pendingConflict.remote, selected);
    }
  }, [pendingConflict, recordBackup]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    await pushCurrentSnapshot();
    syncReadyRef.current = false;
    await resetRevenueCatCustomer();
    await supabase.auth.signOut();
    sessionRef.current = null;
    metadataRef.current = null;
    setSession(null);
    setPendingConflict(null);
    setPurchasesLinked(false);
    setSyncStatus('idle');
    setLastSyncedAt(null);
    await switchLibraryStorageScope('guest');
    await refreshProAccess();
  }, [pushCurrentSnapshot, refreshProAccess]);

  const deleteAccount = useCallback(async () => {
    if (!supabase || !sessionRef.current) return;
    const snapshot = createPersistedState(useLibraryStore.getState());
    await overwriteLibraryStorageScope('guest', snapshot);
    const { error } = await supabase.functions.invoke('delete-account', { body: {} });
    if (error) throw error;
    await SecureStore.deleteItemAsync(metadataKey(sessionRef.current.user.id));
    syncReadyRef.current = false;
    await resetRevenueCatCustomer();
    await supabase.auth.signOut({ scope: 'local' });
    sessionRef.current = null;
    setSession(null);
    setPendingConflict(null);
    setPurchasesLinked(false);
    setSyncStatus('idle');
    setLastSyncedAt(null);
    await switchLibraryStorageScope('guest', snapshot);
    replaceLibrarySnapshot(snapshot);
    await refreshProAccess();
  }, [refreshProAccess]);

  const retrySync = useCallback(async () => {
    if (!sessionRef.current) return;
    if (!syncReadyRef.current) await activateSession(sessionRef.current);
    else await pushCurrentSnapshot();
    if (!purchasesLinked) {
      const linked = await identifyRevenueCatCustomer(sessionRef.current.user.id);
      setPurchasesLinked(linked);
      if (linked) await refreshProAccess();
    }
  }, [activateSession, purchasesLinked, pushCurrentSnapshot, refreshProAccess]);

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    provider: getProvider(session?.user ?? null),
    isLoading,
    isAuthenticating,
    errorMessage,
    syncStatus,
    lastSyncedAt,
    hasConflict: Boolean(pendingConflict),
    purchasesLinked,
    signInWithApple,
    signInWithGoogle,
    resolveConflict,
    retrySync,
    signOut,
    deleteAccount,
  }), [
    deleteAccount, errorMessage, isAuthenticating, isLoading, lastSyncedAt, pendingConflict,
    purchasesLinked, resolveConflict, retrySync, session, signInWithApple, signInWithGoogle,
    signOut, syncStatus,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
