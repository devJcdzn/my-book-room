import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProfileAvatar } from '@/src/types/profile-avatar';

export const AVATAR_BUCKET = 'profile-avatars';
const MAX_BYTES = 2 * 1024 * 1024;
const directory = (scope: string, bucket = AVATAR_BUCKET) => {
  const folder = new Directory(Paths.document, bucket, scope);
  folder.create({ intermediates: true, idempotent: true });
  return folder;
};
const version = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const localAvatarFile = (avatar: ProfileAvatar, scope: string, bucket: string) => {
  const candidates = [
    new File(directory(scope, bucket), `${avatar.version}.jpg`),
    ...(avatar.localUri ? [new File(avatar.localUri)] : []),
    new File(directory('guest', bucket), `${avatar.version}.jpg`),
  ];
  // iOS can change the app container path after updating the installed binary.
  const relativePath = avatar.localUri?.split('/Documents/')[1];
  if (relativePath && !relativePath.split('/').includes('..')) {
    candidates.push(new File(Paths.document, relativePath));
  }
  return candidates.find(file => file.exists);
};

export const prepareAvatar = async (uri: string, scope: string, previous?: ProfileAvatar, bucket = AVATAR_BUCKET, maxDimension = 512): Promise<ProfileAvatar> => {
  const id = version();
  const context = ImageManipulator.manipulate(uri);
  const original = await context.renderAsync();
  const image = await ImageManipulator.manipulate(uri)
    .resize(original.width >= original.height ? { width: Math.min(maxDimension, original.width) } : { height: Math.min(maxDimension, original.height) })
    .renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  const file = new File(saved.uri);
  if (file.size > MAX_BYTES) throw new Error('A foto precisa ter até 2 MB.');
  const destination = new File(directory(scope, bucket), `${id}.jpg`);
  file.copy(destination);
  return { source: 'custom', version: id, localUri: destination.uri, pending: scope !== 'guest', previousPath: previous?.storagePath ?? previous?.previousPath ?? (previous?.pending && scope !== 'guest' ? `${scope}/${previous.version}.jpg` : undefined) };
};

export const adoptAvatar = (avatar: ProfileAvatar, userId: string, bucket = AVATAR_BUCKET): ProfileAvatar => {
  if (avatar.source !== 'custom') return avatar;
  const destination = new File(directory(userId, bucket), `${avatar.version}.jpg`);
  const source = localAvatarFile(avatar, userId, bucket);
  if (!destination.exists && source) source.copy(destination);
  const ownPath = avatar.storagePath?.startsWith(`${userId}/`) ? avatar.storagePath : undefined;
  return { ...avatar, localUri: destination.exists ? destination.uri : avatar.localUri, storagePath: ownPath, previousPath: avatar.previousPath?.startsWith(`${userId}/`) ? avatar.previousPath : undefined, pending: avatar.pending || !ownPath };
};

export const uploadAvatar = async (client: SupabaseClient, userId: string, avatar?: ProfileAvatar, bucket = AVATAR_BUCKET): Promise<ProfileAvatar | undefined> => {
  if (!avatar?.pending || avatar.source !== 'custom') return avatar;
  const local = localAvatarFile(avatar, userId, bucket);
  const restoredUri = !local && avatar.storagePath?.startsWith(`${userId}/`)
    ? await cacheAvatar(client, userId, avatar, bucket) : undefined;
  const file = local ?? (restoredUri ? new File(restoredUri) : undefined);
  if (!file) throw new Error('A foto local não está disponível. Escolha novamente a foto para concluir o envio.');
  if (file.size > MAX_BYTES) throw new Error('A foto local excede 2 MB.');
  const path = `${userId}/${avatar.version}.jpg`;
  const { error } = await client.storage.from(bucket).upload(path, await file.arrayBuffer(), { contentType: 'image/jpeg', upsert: false });
  if (error && !['409', 'Duplicate'].includes(String(error.statusCode ?? error.name))) throw error;
  return { ...avatar, localUri: file.uri, storagePath: path, pending: false };
};

export const cacheAvatar = async (client: SupabaseClient | undefined, userId: string, avatar: ProfileAvatar, bucket = AVATAR_BUCKET): Promise<string | undefined> => {
  if (avatar.source === 'none') return undefined;
  const local = localAvatarFile(avatar, userId, bucket);
  if (local) return local.uri;
  const destination = new File(directory(userId, bucket), `${avatar.version}.jpg`);
  if (destination.exists) return destination.uri;
  let url = avatar.providerUrl;
  if (avatar.storagePath && client) {
    const { data, error } = await client.storage.from(bucket).createSignedUrl(avatar.storagePath, 300);
    if (error) throw error;
    url = data.signedUrl;
  }
  if (!url) return undefined;
  try { await File.downloadFileAsync(url, destination); } catch (error) {
    if (destination.exists) destination.delete();
    throw error;
  }
  return destination.uri;
};

export const guestAvatar = async (client: SupabaseClient, userId: string, avatar?: ProfileAvatar, bucket = AVATAR_BUCKET): Promise<ProfileAvatar | undefined> => {
  if (!avatar) return undefined;
  if (avatar.source === 'none') return { source: 'none', version: avatar.version };
  const uri = await cacheAvatar(client, userId, avatar, bucket);
  if (!uri) throw new Error('Não foi possível preservar a foto neste aparelho.');
  return prepareAvatar(uri, 'guest', undefined, bucket, bucket === AVATAR_BUCKET ? 512 : 1024);
};

export const removeLocalAvatar = (avatar: ProfileAvatar | undefined, scope: string) => {
  if (!avatar?.localUri) return;
  const folder = directory(scope);
  if (!avatar.localUri.startsWith(folder.uri.replace(/\/$/, '') + '/')) return;
  const file = new File(avatar.localUri);
  if (file.exists) file.delete();
};
