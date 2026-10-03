import type { SupabaseClient } from '@supabase/supabase-js';
import type { PersistedLibraryState } from '@/src/store/library-store';
import { adoptAvatar, guestAvatar, prepareAvatar, uploadAvatar } from '@/src/services/profile-avatar';

export const ROOM_PHOTOS_BUCKET = 'room-photos';
export const roomPhotoPaths = (snapshot: PersistedLibraryState) => [...(snapshot.roomLayout?.pieces.flatMap(piece => piece.photo?.storagePath ? [piece.photo.storagePath] : []) ?? []), ...(snapshot.roomLayout?.legacyPhoto?.storagePath ? [snapshot.roomLayout.legacyPhoto.storagePath] : [])];

// Convert legacy photos only after the permanent scoped copy is ready.
export async function prepareRoomPhotos(snapshot: PersistedLibraryState, scope: string) {
  let legacyPhoto = snapshot.roomLayout?.legacyPhoto;
  if (snapshot.pictureFramePhotoUri && !snapshot.roomLayout?.pieces.some(p => p.id === 'frame')) legacyPhoto = await prepareAvatar(snapshot.pictureFramePhotoUri, scope, legacyPhoto, ROOM_PHOTOS_BUCKET, 1024);
  else if (legacyPhoto && scope !== 'guest') legacyPhoto = adoptAvatar(legacyPhoto, scope, ROOM_PHOTOS_BUCKET);
  if (snapshot.roomLayout?.pieces.some(p => p.id === 'frame')) legacyPhoto = undefined;
  const pieces = [];
  for (const piece of snapshot.roomLayout?.pieces ?? []) {
    const uri = piece.photoUri || (piece.id === 'frame' ? snapshot.pictureFramePhotoUri : undefined);
    let photo = piece.photo;
    if (!photo && uri) photo = await prepareAvatar(uri, scope, undefined, ROOM_PHOTOS_BUCKET, 1024);
    else if (photo && scope !== 'guest') {
      photo = adoptAvatar({ ...photo, localUri: photo.localUri ?? uri ?? undefined }, scope, ROOM_PHOTOS_BUCKET);
    }
    pieces.push({ ...piece, photo, photoUri: photo?.source === 'none' ? undefined : photo?.localUri ?? piece.photoUri });
  }
  return { ...snapshot, pictureFramePhotoUri: null, roomLayout: snapshot.roomLayout ? { ...snapshot.roomLayout, pieces, legacyPhoto } : undefined };
}

export async function uploadRoomPhotos(client: SupabaseClient, userId: string, snapshot: PersistedLibraryState, isCurrent: () => boolean) {
  if (!isCurrent()) throw new Error('Sincronização interrompida.');
  const legacyPhoto = await uploadAvatar(client, userId, snapshot.roomLayout?.legacyPhoto, ROOM_PHOTOS_BUCKET);
  const pieces = [];
  for (const piece of snapshot.roomLayout?.pieces ?? []) {
    if (!isCurrent()) throw new Error('Sincronização interrompida.');
    const photo = await uploadAvatar(client, userId, piece.photo, ROOM_PHOTOS_BUCKET);
    pieces.push({ ...piece, photo });
  }
  return { ...snapshot, roomLayout: snapshot.roomLayout ? { ...snapshot.roomLayout, pieces, legacyPhoto } : undefined };
}

export async function preserveGuestRoomPhotos(client: SupabaseClient, userId: string, snapshot: PersistedLibraryState) {
  const legacyPhoto = await guestAvatar(client, userId, snapshot.roomLayout?.legacyPhoto, ROOM_PHOTOS_BUCKET);
  const pieces = [];
  for (const piece of snapshot.roomLayout?.pieces ?? []) {
    const photo = await guestAvatar(client, userId, piece.photo, ROOM_PHOTOS_BUCKET);
    pieces.push({ ...piece, photo, photoUri: photo?.localUri });
  }
  return { ...snapshot, pictureFramePhotoUri: null, roomLayout: snapshot.roomLayout ? { ...snapshot.roomLayout, pieces, legacyPhoto } : undefined };
}
