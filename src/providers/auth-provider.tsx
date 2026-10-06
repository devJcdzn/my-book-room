import { identifyAnalytics, trackEvent } from '../services/analytics';
import { prepareRoomPhotos, uploadRoomPhotos, preserveGuestRoomPhotos, roomPhotoPaths, ROOM_PHOTOS_BUCKET } from '@/src/services/room-photos';
import { adoptAvatar, uploadAvatar, guestAvatar, AVATAR_BUCKET } from '@/src/services/profile-avatar';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import type { Session, User } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { ACCOUNT_SYNC_ENABLED } from '@/src/config/features';
import {
  createCloudLibrarySnapshot,
  fetchLibraryBackup,
  saveLibraryBackup,
  type RemoteLibraryBackup,
} from '@/src/services/library-sync';
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
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  completeOAuth: (code: string) => Promise<void>;
  resolveConflict: (choice: ConflictChoice) => Promise<void>;
  retrySync: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

type SyncMetadata = { revision: number; hash: string; updatedAt: string; roomPhotoPaths?: string[]; roomPhotoCleanup?: string[] };

const AuthContext = createContext<AuthContextValue | null>(null);
const REDIRECT_URL = Linking.createURL('auth/callback', { scheme: 'mybookroom' });
const SYNC_DEBOUNCE_MS = 900;

const metadataKey = (userId: string) => `bookroom-sync.${userId}`;

const hashSnapshot = (snapshot: PersistedLibraryState) => {
  const serialized = JSON.stringify(createCloudLibrarySnapshot(snapshot, false));
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

const saveMetadata = async (userId: string, backup: RemoteLibraryBackup, snapshot: PersistedLibraryState, previous: SyncMetadata | null) => {
  const paths = roomPhotoPaths(snapshot);
  const metadata: SyncMetadata = {
    revision: backup.revision,
    updatedAt: backup.updatedAt,
    hash: hashSnapshot(snapshot),
    roomPhotoPaths: paths,
    roomPhotoCleanup: [...new Set([...(previous?.roomPhotoCleanup ?? []), ...(previous?.roomPhotoPaths ?? []), ...(snapshot.roomLayout?.legacyPhoto?.previousPath ? [snapshot.roomLayout.legacyPhoto.previousPath] : []), ...(snapshot.roomLayout?.pieces.flatMap(p => p.photo?.previousPath ? [p.photo.previousPath] : []) ?? [])])].filter(path => !paths.includes(path) && path.startsWith(`${userId}/`)),
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
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(ACCOUNT_SYNC_ENABLED && Boolean(supabase));
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [pendingConflict, setPendingConflict] = useState<PendingConflict | null>(null);
  const conflictRef = useRef<PendingConflict | null>(null);
  const updateConflict = useCallback((value: PendingConflict | null) => {
    conflictRef.current = value;
    setPendingConflict(value);
  }, []);
  const sessionRef = useRef<Session | null>(null);
  const metadataRef = useRef<SyncMetadata | null>(null);
  const syncReadyRef = useRef(false);
  const switchingRef = useRef(false);
  const syncRequestRef = useRef<() => Promise<void>>(async () => {});
  const syncOperationRef = useRef<Promise<void> | null>(null);
  const oauthExchangeRef = useRef<{ code: string; promise: Promise<void> } | null>(null);
  const authenticationRef = useRef(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recordBackup = useCallback(async (
    userId: string,
    backup: RemoteLibraryBackup,
    snapshot: PersistedLibraryState,
  ) => {
    const metadata = await saveMetadata(userId, backup, snapshot, metadataRef.current);
    if (sessionRef.current?.user.id !== userId) return;
    metadataRef.current = metadata;
    setLastSyncedAt(backup.updatedAt);
    setSyncStatus('synced');
  }, []);

  const pushCurrentSnapshot: () => Promise<void> = useCallback(async () => {
    if (syncOperationRef.current) {
      await syncOperationRef.current;
      return syncRequestRef.current();
    }
    const currentSession = sessionRef.current;
    if (!supabase || !currentSession || !syncReadyRef.current || conflictRef.current || switchingRef.current) return;
    const client = supabase;
    const userId = currentSession.user.id;
    const isCurrent = () => sessionRef.current === currentSession && syncReadyRef.current;
    let initialSnapshot = getCurrentLibrarySnapshot();
    let synchronizedHash = hashSnapshot(initialSnapshot);
    let confirmed = false;
    if (initialSnapshot.activeReadingTimer?.phase !== 'running' && metadataRef.current?.hash === synchronizedHash && !metadataRef.current.roomPhotoCleanup?.length && !initialSnapshot.profile.avatar?.pending && !initialSnapshot.roomLayout?.legacyPhoto?.pending && !initialSnapshot.roomLayout?.pieces.some(piece => piece.photo?.pending || (piece.photoUri && !piece.photo))) {
      setSyncStatus('synced');
      return;
    }
    const operation = (async () => {
      setSyncStatus('syncing');
      setErrorMessage(null);
      let snapshot = initialSnapshot;
      let stage = 'preparar fotos locais';
      try {
        const prepared = await prepareRoomPhotos(snapshot, userId);
        if (!isCurrent() || hashSnapshot(getCurrentLibrarySnapshot()) !== hashSnapshot(initialSnapshot)) return;
        if (JSON.stringify(prepared.roomLayout) !== JSON.stringify(initialSnapshot.roomLayout) || initialSnapshot.pictureFramePhotoUri) useLibraryStore.setState({ roomLayout: prepared.roomLayout!, pictureFramePhotoUri: null });
        snapshot = initialSnapshot = prepared;
        stage = 'enviar fotos da sala';
        snapshot = await uploadRoomPhotos(client, userId, snapshot, isCurrent);
        if (!isCurrent()) return;
        const roomVersions = (value: PersistedLibraryState) => JSON.stringify([value.roomLayout?.legacyPhoto?.version, value.roomLayout?.pieces.map(p => [p.id, p.photo?.version, p.photoUri])]);
        const discardStaleUploads = async () => {
          const paths = snapshot.roomLayout?.pieces.flatMap(piece => initialSnapshot.roomLayout?.pieces.find(p => p.id === piece.id)?.photo?.pending && piece.photo?.storagePath ? [piece.photo.storagePath] : []) ?? [];
          if (initialSnapshot.roomLayout?.legacyPhoto?.pending && snapshot.roomLayout?.legacyPhoto?.storagePath) paths.push(snapshot.roomLayout.legacyPhoto.storagePath);
          if (paths.length) await client.storage.from(ROOM_PHOTOS_BUCKET).remove(paths);
        };
        if (roomVersions(getCurrentLibrarySnapshot()) !== roomVersions(initialSnapshot)) { await discardStaleUploads(); return; }

        stage = 'enviar foto de perfil';
        const avatar = await uploadAvatar(client, userId, snapshot.profile.avatar);
        if (!isCurrent()) return;
        // A newer local choice must not be replaced by an older upload.
        if (useLibraryStore.getState().profile.avatar?.version !== avatar?.version) {
          if (initialSnapshot.profile.avatar?.pending && avatar?.storagePath) await client.storage.from(AVATAR_BUCKET).remove([avatar.storagePath]);
          await discardStaleUploads();
          return;
        }
        if (roomVersions(getCurrentLibrarySnapshot()) !== roomVersions(initialSnapshot)) { await discardStaleUploads(); return; }
        snapshot = { ...snapshot, profile: { ...snapshot.profile, avatar } };
        stage = 'salvar biblioteca';
        const backup = await saveLibraryBackup(client, userId, snapshot, metadataRef.current?.revision ?? null);
        if (!isCurrent()) return;
        synchronizedHash = hashSnapshot(snapshot);
        confirmed = true;
        stage = 'registrar confirmação local';
        await recordBackup(userId, backup, snapshot);
        if (!isCurrent()) return;
        const cleanup = metadataRef.current?.roomPhotoCleanup ?? [];
        stage = 'remover fotos substituídas';
        if (cleanup.length) {
          const { error } = await client.storage.from(ROOM_PHOTOS_BUCKET).remove(cleanup);
          if (error) throw error;
          if (!isCurrent()) return;
          metadataRef.current!.roomPhotoCleanup = [];
          await SecureStore.setItemAsync(metadataKey(userId), JSON.stringify(metadataRef.current));
        }
        const latestLayout = useLibraryStore.getState().roomLayout;
        const legacyPhoto = snapshot.roomLayout?.legacyPhoto;
        const committedLayout = { ...latestLayout, legacyPhoto: latestLayout.legacyPhoto?.version === legacyPhoto?.version && legacyPhoto ? { ...legacyPhoto, pending: false, previousPath: undefined } : latestLayout.legacyPhoto, pieces: latestLayout.pieces.map(piece => {
          const uploaded = snapshot.roomLayout?.pieces.find(p => p.id === piece.id)?.photo;
          if (!uploaded || !piece.photo) return piece;
          if (piece.photo.version !== uploaded.version) return { ...piece, photo: { ...piece.photo, previousPath: uploaded.storagePath ?? piece.photo.previousPath } };
          return { ...piece, photo: { ...uploaded, pending: false, previousPath: undefined } };
        }) };
        if (JSON.stringify(committedLayout) !== JSON.stringify(latestLayout)) useLibraryStore.setState({ roomLayout: committedLayout });
        if (avatar?.previousPath && avatar.previousPath !== avatar.storagePath && avatar.previousPath.startsWith(`${userId}/`)) {
          const { error } = await client.storage.from(AVATAR_BUCKET).remove([avatar.previousPath]);
          if (error) throw error;
        }
        if (isCurrent() && useLibraryStore.getState().profile.avatar?.version === avatar?.version && initialSnapshot.profile.avatar?.pending && avatar) {
          useLibraryStore.getState().updateProfile({ avatar: { ...avatar, pending: false, previousPath: undefined } });
        } else if (isCurrent() && avatar?.storagePath) {
          const latest = useLibraryStore.getState().profile.avatar;
          if (latest?.pending && latest.version !== avatar.version) useLibraryStore.getState().updateProfile({ avatar: { ...latest, previousPath: avatar.storagePath } });
        }
      } catch (error) {
        if (!isCurrent()) return;
        const details = error as { message?: string; code?: string; status?: number; statusCode?: string };
        console.warn(`Falha na sincronização: ${stage}.`, {
          message: details?.message, code: details?.code, status: details?.status ?? details?.statusCode,
        });
        const message = String((error as { message?: string; code?: string })?.message ?? '').toLowerCase();
        const code = (error as { code?: string })?.code;
        if (message.includes('outro aparelho') || message.includes('40001') || code === '40001' || code === 'PT409') {
          try {
            const remote = await fetchLibraryBackup(client, userId);
            if (!isCurrent()) return;
            if (remote) {
              updateConflict({ local: getCurrentLibrarySnapshot(), remote });
              setSyncStatus('conflict');
              return;
            }
          } catch { /* Keep local edits until the next successful sync. */ }
        }
        setSyncStatus(message.includes('network') || message.includes('fetch') ? 'offline' : 'error');
        if (message.includes('a foto local não está disponível')) {
          setErrorMessage(stage === 'enviar foto de perfil'
            ? 'Escolha novamente sua foto de perfil para concluir o envio.'
            : 'Uma foto da sala não foi encontrada neste aparelho. Escolha essa foto novamente para concluir o envio.');
        } else {
          setErrorMessage(stage === 'enviar foto de perfil'
            ? 'Não foi possível enviar sua foto. Ela continua salva neste aparelho.'
            : 'Não foi possível concluir o envio. Seus dados continuam salvos neste aparelho.');
        }
      }
    })();
    syncOperationRef.current = operation;
    try { await operation; } finally {
      syncOperationRef.current = null;
      if (isCurrent() && !conflictRef.current && hashSnapshot(getCurrentLibrarySnapshot()) !== synchronizedHash) {
        if (confirmed) setSyncStatus('syncing');
        if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
        syncTimerRef.current = setTimeout(() => { void syncRequestRef.current(); }, SYNC_DEBOUNCE_MS);
      }
    }
  }, [recordBackup, updateConflict]);

  useEffect(() => { syncRequestRef.current = pushCurrentSnapshot; }, [pushCurrentSnapshot]);

  const activateSession = useCallback(async (nextSession: Session) => {
    if (!supabase || switchingRef.current) return;
    switchingRef.current = true;
    setIsLoading(true);
    syncReadyRef.current = false;
    setSession(nextSession);
    sessionRef.current = nextSession;
    setErrorMessage(null);

    try {
      const userId = nextSession.user.id;
      const accountScope = `user:${userId}` as const;
      const guestSnapshot = getCurrentLibrarySnapshot();
      // Signing in should not replace the onboarding currently being completed.
      const onboarding = guestSnapshot.onboardingStatus === 'in_progress' ? {
        onboardingStatus: guestSnapshot.onboardingStatus,
        onboardingStep: guestSnapshot.onboardingStep,
        onboardingVersion: guestSnapshot.onboardingVersion,
        onboardingAnswers: guestSnapshot.onboardingAnswers,
      } : {};
      const [cachedSnapshot, metadata] = await Promise.all([
        readLibraryStorageScope(accountScope),
        readMetadata(userId),
      ]);
      // Recover guest data if an earlier login reset the cache before its first backup.
      const restoreGuest = !metadata && cachedSnapshot && isDefaultLibrarySnapshot(cachedSnapshot)
        && !isDefaultLibrarySnapshot(guestSnapshot);
      let localSnapshot = await prepareRoomPhotos(restoreGuest ? guestSnapshot : cachedSnapshot ?? guestSnapshot, userId);
      if (localSnapshot.profile.avatar) {
        localSnapshot = { ...localSnapshot, profile: { ...localSnapshot.profile, avatar: adoptAvatar(localSnapshot.profile.avatar, userId) } };
      }
      localSnapshot = { ...localSnapshot, ...onboarding };
      await switchLibraryStorageScope(accountScope, localSnapshot);
      replaceLibrarySnapshot(localSnapshot);
      const { error: sessionError } = await supabase.auth.getUser(nextSession.access_token);
      if (sessionError?.status === 401 || sessionError?.status === 403) {
        // A previously deleted account may still have a session saved on this device.
        sessionRef.current = null;
        metadataRef.current = null;
        setSession(null);
        updateConflict(null);
        setSyncStatus('idle');
        setLastSyncedAt(null);
        await switchLibraryStorageScope('guest');
        await supabase.auth.signOut({ scope: 'local' });
        switchingRef.current = false;
        setIsLoading(false);
        return;
      }
      if (sessionError) throw sessionError;
      const remote = await fetchLibraryBackup(supabase, userId);
      metadataRef.current = metadata;

      if (!remote) {
        await switchLibraryStorageScope(accountScope, localSnapshot);
        syncReadyRef.current = true;

      } else {
        const localChanged = metadata ? hashSnapshot(localSnapshot) !== metadata.hash : !isDefaultLibrarySnapshot(localSnapshot);
        const remoteChanged = metadata ? remote.revision !== metadata.revision : true;

        if (localChanged && remoteChanged) {
          updateConflict({ local: localSnapshot, remote });
          setSyncStatus('conflict');
        } else if (localChanged) {
          metadataRef.current = { revision: remote.revision, updatedAt: remote.updatedAt, hash: metadata?.hash ?? '' };
          await switchLibraryStorageScope(accountScope, localSnapshot);
          syncReadyRef.current = true;

        } else {
          await switchLibraryStorageScope(accountScope, localSnapshot);
          replaceLibrarySnapshot({ ...remote.snapshot, ...onboarding, activeReadingTimer: remoteChanged ? remote.snapshot.activeReadingTimer : localSnapshot.activeReadingTimer });
          syncReadyRef.current = true;
          await recordBackup(userId, remote, getCurrentLibrarySnapshot());
        }
      }

    } catch (error) {
      console.warn('Não foi possível preparar a sincronização da conta.', error);
      const message = String((error as { message?: string })?.message ?? '').toLowerCase();
      setSyncStatus(message.includes('network') || message.includes('fetch') ? 'offline' : 'error');
      setErrorMessage('Sua conta foi conectada, mas a sincronização não pôde ser concluída agora.');
    }

    const profile = useLibraryStore.getState().profile;
    if (syncReadyRef.current && !profile.avatar) {
      const providerUrl = nextSession.user.user_metadata?.avatar_url ?? nextSession.user.user_metadata?.picture;
      if (typeof providerUrl === 'string' && providerUrl.startsWith('https://')) {
        useLibraryStore.getState().updateProfile({ avatar: { source: 'provider', version: `provider-${nextSession.user.id}`, providerUrl } });
      }
    }
    switchingRef.current = false;
    setIsLoading(false);
    if (syncReadyRef.current) void pushCurrentSnapshot();
  }, [pushCurrentSnapshot, recordBackup, updateConflict]);

  useEffect(() => {
    if (!ACCOUNT_SYNC_ENABLED || !supabase) return;

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
        void switchLibraryStorageScope('guest');
      }
    });
    return () => subscription.unsubscribe();
  }, [activateSession, updateConflict]);

  useEffect(() => {
    const unsubscribe = useLibraryStore.subscribe(() => {
      if (!ACCOUNT_SYNC_ENABLED || !syncReadyRef.current || switchingRef.current || !sessionRef.current || pendingConflict) return;
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => { void pushCurrentSnapshot(); }, SYNC_DEBOUNCE_MS);
    });
    return () => {
      unsubscribe();
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [pendingConflict, pushCurrentSnapshot]);

  useEffect(() => {
    if (!ACCOUNT_SYNC_ENABLED || !supabase) return;
    const client = supabase;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        client.auth.startAutoRefresh();
        if (sessionRef.current) {
          if (syncReadyRef.current) void pushCurrentSnapshot();
          else void activateSession(sessionRef.current);
        }
      } else {
        client.auth.stopAutoRefresh();
      }
    });
    return () => subscription.remove();
  }, [activateSession, pushCurrentSnapshot]);

  const completeOAuth = useCallback((code: string): Promise<void> => {
    if (!ACCOUNT_SYNC_ENABLED || !supabase) return Promise.reject(new Error('A sincronização ainda não está ativada.'));
    if (oauthExchangeRef.current?.code === code) return oauthExchangeRef.current.promise;
    const client = supabase;
    const promise = client.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) { setErrorMessage('Não foi possível concluir o login. Tente novamente.'); throw error; }
    });
    oauthExchangeRef.current = { code, promise };
    return promise;
  }, []);

  const signInWithOAuth = useCallback(async () => {
    if (!ACCOUNT_SYNC_ENABLED || !supabase) throw new Error('A sincronização ainda não está ativada.');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: REDIRECT_URL, skipBrowserRedirect: true },
    });
    if (error || !data.url) throw error ?? new Error('Não foi possível abrir o login.');

    const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URL);
    if (result.type !== 'success') throw new Error('cancelled');
    const code = new URL(result.url).searchParams.get('code');
    if (!code) throw new Error('O provedor não retornou um código de acesso.');
    await completeOAuth(code);
    const { data: restored } = await supabase.auth.getSession();
    const signedInUser = restored.session?.user;
    if (signedInUser) void identifyAnalytics({ userId: signedInUser.id,
      name: useLibraryStore.getState().profile.name,
      ...(signedInUser.email ? { email: signedInUser.email } : {}),
      metadata: { provider: 'google', created_at: signedInUser.created_at } });
  }, [completeOAuth]);

  const runAuthentication = useCallback(async (provider: 'apple' | 'google', operation: () => Promise<void>) => {
    if (authenticationRef.current) return;
    authenticationRef.current = true;
    setIsAuthenticating(true);
    setErrorMessage(null);
    trackEvent('login_started', { provider });
    try {
      await operation();
      trackEvent('login_succeeded', { provider });
    } catch (error) {
      if (isCancelledError(error)) trackEvent('login_cancelled', { provider });
      else {
        trackEvent('login_failed', { provider, failure_category: 'authentication' });
        setErrorMessage('Não foi possível entrar. Verifique sua conexão e tente novamente.');
      }
    } finally {
      authenticationRef.current = false;
      setIsAuthenticating(false);
    }
  }, []);

  const signInWithApple = useCallback(() => runAuthentication('apple', async () => {
    if (process.env.EXPO_OS !== 'ios') throw new Error('unsupported_platform');
    if (!ACCOUNT_SYNC_ENABLED || !supabase) throw new Error('A sincronização ainda não está ativada.');
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) throw new Error('A Apple não retornou uma identidade válida.');
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      access_token: credential.authorizationCode ?? undefined,
    });
    if (error) throw error;
    if (data.user) void identifyAnalytics({ userId: data.user.id, name: useLibraryStore.getState().profile.name,
      ...(data.user.email ? { email: data.user.email } : {}),
      metadata: { provider: 'apple', created_at: data.user.created_at } });
  }), [runAuthentication]);

  const signInWithGoogle = useCallback(
    () => runAuthentication('google', signInWithOAuth),
    [runAuthentication, signInWithOAuth],
  );

  const resolveConflict = useCallback(async (choice: ConflictChoice) => {
    const currentSession = sessionRef.current;
    if (!supabase || !currentSession || !pendingConflict || switchingRef.current) return;
    switchingRef.current = true;
    syncReadyRef.current = false;
    try {
      setSyncStatus('syncing');
      const scope = `user:${currentSession.user.id}` as const;
      const selected = choice === 'cloud'
        ? normalizePersistedState({
          ...pendingConflict.remote.snapshot,
          pictureFramePhotoUri: null,
        })
        : pendingConflict.local;
      await switchLibraryStorageScope(scope, selected);
      replaceLibrarySnapshot(choice === 'device' ? await prepareRoomPhotos(selected, currentSession.user.id) : selected);

      const avatar = useLibraryStore.getState().profile.avatar;
      if (choice === 'device' && avatar) useLibraryStore.getState().updateProfile({ avatar: adoptAvatar(avatar, currentSession.user.id) });
      if (!avatar) {
        const providerUrl = currentSession.user.user_metadata?.avatar_url ?? currentSession.user.user_metadata?.picture;
        if (typeof providerUrl === 'string' && providerUrl.startsWith('https://')) useLibraryStore.getState().updateProfile({ avatar: { source: 'provider', version: `provider-${currentSession.user.id}`, providerUrl } });
      }
      await recordBackup(currentSession.user.id, pendingConflict.remote, choice === 'cloud' ? selected : normalizePersistedState(pendingConflict.remote.snapshot));
      if (sessionRef.current !== currentSession) return;
      syncReadyRef.current = true;
      updateConflict(null);
    } catch {
      setSyncStatus('error');
      setErrorMessage('Não foi possível restaurar sua biblioteca. Tente novamente.');
    } finally {
      switchingRef.current = false;
    }
    if (syncReadyRef.current) void pushCurrentSnapshot();
  }, [pendingConflict, pushCurrentSnapshot, recordBackup, updateConflict]);

  useEffect(() => {
    if (!pendingConflict && syncReadyRef.current) void pushCurrentSnapshot();
  }, [pendingConflict, pushCurrentSnapshot]);

  const signOut = useCallback(async () => {
    if (!supabase || switchingRef.current) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    switchingRef.current = true;
    authenticationRef.current = true;
    setIsAuthenticating(true);
    syncReadyRef.current = false;
    sessionRef.current = null;
    metadataRef.current = null;
    setSession(null);
    updateConflict(null);
    setSyncStatus('idle');
    setLastSyncedAt(null);
    try {
      await switchLibraryStorageScope('guest');
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (!error) trackEvent('account_signed_out');
      void identifyAnalytics(null);
    } finally {
      switchingRef.current = false;
      authenticationRef.current = false;
      setIsAuthenticating(false);
    }
  }, [updateConflict]);

  const deleteAccount = useCallback(async () => {
    if (!supabase || !sessionRef.current || switchingRef.current) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    switchingRef.current = true;
    const wasSyncReady = syncReadyRef.current;
    syncReadyRef.current = false;
    if (syncOperationRef.current) await syncOperationRef.current;
    try {
      const userId = sessionRef.current.user.id;
      let snapshot = await prepareRoomPhotos(createPersistedState(useLibraryStore.getState()), userId);
      snapshot = await preserveGuestRoomPhotos(supabase, userId, snapshot);
      snapshot.profile = { ...snapshot.profile, avatar: await guestAvatar(supabase, userId, snapshot.profile.avatar) };
      const { error } = await supabase.functions.invoke('delete-account', { body: {} });
      if (error) throw error;
      trackEvent('account_deleted');
      void identifyAnalytics(null);
      await overwriteLibraryStorageScope('guest', snapshot);
      syncReadyRef.current = false;
      sessionRef.current = null;
      metadataRef.current = null;
      setSession(null);
      updateConflict(null);
      setSyncStatus('idle');
      setLastSyncedAt(null);
      await supabase.auth.signOut({ scope: 'local' });
      await switchLibraryStorageScope('guest', snapshot);
      replaceLibrarySnapshot(snapshot);
      // Remote deletion succeeded; metadata cleanup must not report account deletion failure.
      await SecureStore.deleteItemAsync(metadataKey(userId)).catch(() => undefined);
    } finally {
      if (sessionRef.current) syncReadyRef.current = wasSyncReady;
      switchingRef.current = false;
    }
  }, [updateConflict]);

  const retrySync = useCallback(async () => {
    if (!sessionRef.current) return;
    if (!syncReadyRef.current) await activateSession(sessionRef.current);
    else await pushCurrentSnapshot();
  }, [activateSession, pushCurrentSnapshot]);

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    provider: getProvider(session?.user ?? null),
    isLoading: ACCOUNT_SYNC_ENABLED && isLoading,
    isAuthenticating,
    errorMessage,
    syncStatus,
    lastSyncedAt,
    hasConflict: Boolean(pendingConflict),
    signInWithApple,
    signInWithGoogle,
    completeOAuth,
    resolveConflict,
    retrySync,
    signOut,
    deleteAccount,
  }), [
    completeOAuth, deleteAccount, errorMessage, isAuthenticating, isLoading, lastSyncedAt, pendingConflict,
    resolveConflict, retrySync, session, signInWithApple, signInWithGoogle,
    signOut, syncStatus,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
