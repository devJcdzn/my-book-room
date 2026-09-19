import {
  DEFAULT_BOOKCASE_PALETTE_ID,
  DEFAULT_CAT_ID,
  DEFAULT_FLOOR_PALETTE_ID,
  DEFAULT_PICTURE_FRAME_STYLE_ID,
  DEFAULT_POSTER_FRAME_ID,
  DEFAULT_RUG_PALETTE_ID,
  DEFAULT_WALL_PALETTE_ID,
  DEFAULT_WINDOW_STYLE_ID,
} from '@/src/types/room-customization';

export const FREE_ROOM_CUSTOMIZATION_IDS = {
  walls: ['antique-parchment', 'warm-sand', 'nocturne-slate'],
  flooring: ['nordic-birch', 'golden-oak', 'smoked-ebony'],
  rug: ['natural-linen', 'terracotta-classic', 'soft-slate'],
  bookcase: ['provencal-white', 'rustic-mahogany', 'nocturne-ebony'],
  window: ['provencal-white', 'rustic-mahogany', 'nocturne-ebony'],
  cat: ['catnap-orange'],
  frame: ['studio-white', 'classic-walnut', 'gallery-black'],
} as const;

export type RoomCustomizationCategory = keyof typeof FREE_ROOM_CUSTOMIZATION_IDS;

const DEFAULT_ROOM_CUSTOMIZATION_IDS: Record<RoomCustomizationCategory, string> = {
  walls: DEFAULT_WALL_PALETTE_ID,
  flooring: DEFAULT_FLOOR_PALETTE_ID,
  rug: DEFAULT_RUG_PALETTE_ID,
  bookcase: DEFAULT_BOOKCASE_PALETTE_ID,
  window: DEFAULT_WINDOW_STYLE_ID,
  cat: DEFAULT_CAT_ID,
  frame: DEFAULT_POSTER_FRAME_ID,
};

export const isFreeRoomOption = (category: RoomCustomizationCategory, id: string) =>
  FREE_ROOM_CUSTOMIZATION_IDS[category].some((optionId) => optionId === id);

export const resolveRoomOptionId = (
  category: RoomCustomizationCategory,
  id: string,
  isPro: boolean,
) => (isPro || isFreeRoomOption(category, id) ? id : DEFAULT_ROOM_CUSTOMIZATION_IDS[category]);

export type RoomCustomizationSnapshot = {
  wallPaletteId: string;
  floorPaletteId: string;
  rugPaletteId: string;
  bookcasePaletteId: string;
  catId: string;
  leftWallWindowStyle: string;
  leftWallFrameColor: string;
  pictureFrameStyleId: string;
  pictureFramePhotoUri: string | null;
};

export const resolveRoomCustomization = (
  customization: RoomCustomizationSnapshot,
  isPro: boolean,
): RoomCustomizationSnapshot => ({
  wallPaletteId: resolveRoomOptionId('walls', customization.wallPaletteId, isPro),
  floorPaletteId: resolveRoomOptionId('flooring', customization.floorPaletteId, isPro),
  rugPaletteId: resolveRoomOptionId('rug', customization.rugPaletteId, isPro),
  bookcasePaletteId: resolveRoomOptionId('bookcase', customization.bookcasePaletteId, isPro),
  catId: resolveRoomOptionId('cat', customization.catId, isPro),
  leftWallWindowStyle: resolveRoomOptionId('window', customization.leftWallWindowStyle, isPro),
  leftWallFrameColor: resolveRoomOptionId('frame', customization.leftWallFrameColor, isPro),
  pictureFrameStyleId: isPro || isFreeRoomOption('frame', customization.pictureFrameStyleId)
    ? customization.pictureFrameStyleId
    : DEFAULT_PICTURE_FRAME_STYLE_ID,
  pictureFramePhotoUri: isPro ? customization.pictureFramePhotoUri : null,
});
