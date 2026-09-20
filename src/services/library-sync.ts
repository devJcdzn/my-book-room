import type { SupabaseClient } from '@supabase/supabase-js';

import {
  normalizePersistedState,
  type PersistedLibraryState,
} from '@/src/store/library-store';

export type CloudLibrarySnapshot = Omit<PersistedLibraryState, 'pictureFramePhotoUri'>;

export type RemoteLibraryBackup = {
  snapshot: CloudLibrarySnapshot;
  revision: number;
  updatedAt: string;
};

export const createCloudLibrarySnapshot = (
  snapshot: PersistedLibraryState,
): CloudLibrarySnapshot => {
  const { pictureFramePhotoUri: _localPhoto, ...cloudSnapshot } = snapshot;
  return cloudSnapshot;
};

export const normalizeCloudLibrarySnapshot = (
  value: unknown,
  localPhotoUri: string | null,
): PersistedLibraryState => normalizePersistedState({
  ...(value && typeof value === 'object' ? value : {}),
  pictureFramePhotoUri: localPhotoUri,
});

export const fetchLibraryBackup = async (
  client: SupabaseClient,
  userId: string,
): Promise<RemoteLibraryBackup | null> => {
  const { data, error } = await client
    .from('user_library_backups')
    .select('snapshot, revision, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    snapshot: createCloudLibrarySnapshot(normalizePersistedState(data.snapshot)),
    revision: Number(data.revision),
    updatedAt: String(data.updated_at),
  };
};

export const saveLibraryBackup = async (
  client: SupabaseClient,
  userId: string,
  snapshot: PersistedLibraryState,
  expectedRevision: number | null,
): Promise<RemoteLibraryBackup> => {
  const { data, error } = await client.rpc('save_user_library_backup', {
    p_expected_revision: expectedRevision,
    p_snapshot: createCloudLibrarySnapshot(snapshot),
  });

  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('O backup não retornou uma revisão válida.');

  return {
    snapshot: createCloudLibrarySnapshot(normalizePersistedState(row.snapshot)),
    revision: Number(row.revision),
    updatedAt: String(row.updated_at),
  };
};
