import { create } from 'zustand';
import { IAP_ENABLED } from '@/src/config/features';
import { ROOM_COLOR_CATEGORIES } from '@/src/types/room-customization';
import type { RoomLayout, RoomPiece } from '@/src/types/room-layout';

export const PAID_COLLECTIONS = {
  observatory: { name: 'Observatório', offering: 'nookly.collection.observatory', entitlement: 'nookly.collection.observatory' },
  teahouse: { name: 'Casa de Chá', offering: 'nookly.collection.teahouse', entitlement: 'nookly.collection.teahouse' },
} as const;
export type PaidCollection = keyof typeof PAID_COLLECTIONS;
export const useCollectionPurchases = create<{ owned: PaidCollection[]; ready: boolean; checked: boolean; busy: boolean; unlocked: PaidCollection[] }>(() => ({ owned: [], ready: false, checked: false, busy: false, unlocked: [] }));

export function newlyUnlockedCollections(before: readonly PaidCollection[], after: readonly PaidCollection[]): PaidCollection[] {
  return after.filter(collection => !before.includes(collection));
}

export function ownedCollections(info: { entitlements: { active: Record<string, { isActive: boolean }> } }): PaidCollection[] {
  return (Object.keys(PAID_COLLECTIONS) as PaidCollection[]).filter(id => info.entitlements.active[PAID_COLLECTIONS[id].entitlement]?.isActive === true);
}

export function lockedCollection(id: string | undefined, owned: readonly string[], enabled = IAP_ENABLED): PaidCollection | null {
  if (!enabled || !id) return null;
  return (Object.keys(PAID_COLLECTIONS) as PaidCollection[]).find(collection =>
    !owned.includes(collection) && (id === collection || id.startsWith(`${collection}-`) ||
      ROOM_COLOR_CATEGORIES.find(category => category.id === collection)?.colors.some(color => color.toLowerCase() === id.toLowerCase()))) ?? null;
}

export function accessibleRoomPiece(piece: RoomPiece, owned: readonly string[], enabled = IAP_ENABLED): RoomPiece {
  const modelLocked = lockedCollection(piece.modelId, owned, enabled);
  const colorLocked = lockedCollection(piece.color, owned, enabled);
  return modelLocked || colorLocked ? { ...piece,
    ...(modelLocked ? { modelId: `isometric-${piece.category}`, finish: 'original' as const } : {}),
    color: modelLocked || colorLocked ? undefined : piece.color,
  } : piece;
}

// Resolve for display only: keep saved choices available after purchase or restore.
export function accessibleRoomLayout(layout: RoomLayout, owned: readonly string[], enabled = IAP_ENABLED): RoomLayout {
  if (!enabled) return layout;
  return { ...layout, pieces: layout.pieces.map(piece => accessibleRoomPiece(piece, owned, enabled)) };
}
