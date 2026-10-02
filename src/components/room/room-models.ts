/* eslint-disable @typescript-eslint/no-require-imports */
import type { RoomPiece } from "@/src/types/room-layout";

export const ROOM_MODELS: Record<
  string,
  { source: number; thumbnail: number }
> = {
  "natural-desk": {
    source: require("@/assets/room-collection/natural-desk.glb"),
    thumbnail: require("@/assets/room-collection/natural-desk.png"),
  },
  "natural-seat": {
    source: require("@/assets/room-collection/natural-seat.glb"),
    thumbnail: require("@/assets/room-collection/natural-seat.png"),
  },
  "natural-bookcase": {
    source: require("@/assets/room-collection/natural-bookcase.glb"),
    thumbnail: require("@/assets/room-collection/natural-bookcase.png"),
  },
  "natural-lamp": {
    source: require("@/assets/room-collection/natural-lamp.glb"),
    thumbnail: require("@/assets/room-collection/natural-lamp.png"),
  },
  "natural-window": {
    source: require("@/assets/room-collection/natural-window.glb"),
    thumbnail: require("@/assets/room-collection/natural-window.png"),
  },
  "natural-frame": {
    source: require("@/assets/room-collection/natural-frame.glb"),
    thumbnail: require("@/assets/room-collection/natural-frame.png"),
  },
  "natural-rug": {
    source: require("@/assets/room-collection/natural-rug.glb"),
    thumbnail: require("@/assets/room-collection/natural-rug.png"),
  },
  "natural-plant": {
    source: require("@/assets/room-collection/natural-plant.glb"),
    thumbnail: require("@/assets/room-collection/natural-plant.png"),
  },
  "classic-desk": {
    source: require("@/assets/room-collection/classic-desk.glb"),
    thumbnail: require("@/assets/room-collection/classic-desk.png"),
  },
  "classic-seat": {
    source: require("@/assets/room-collection/classic-seat.glb"),
    thumbnail: require("@/assets/room-collection/classic-seat.png"),
  },
  "classic-bookcase": {
    source: require("@/assets/room-collection/classic-bookcase.glb"),
    thumbnail: require("@/assets/room-collection/classic-bookcase.png"),
  },
  "classic-lamp": {
    source: require("@/assets/room-collection/classic-lamp.glb"),
    thumbnail: require("@/assets/room-collection/classic-lamp.png"),
  },
  "classic-window": {
    source: require("@/assets/room-collection/classic-window.glb"),
    thumbnail: require("@/assets/room-collection/classic-window.png"),
  },
  "classic-frame": {
    source: require("@/assets/room-collection/classic-frame.glb"),
    thumbnail: require("@/assets/room-collection/classic-frame.png"),
  },
  "classic-rug": {
    source: require("@/assets/room-collection/classic-rug.glb"),
    thumbnail: require("@/assets/room-collection/classic-rug.png"),
  },
  "classic-plant": {
    source: require("@/assets/room-collection/classic-plant.glb"),
    thumbnail: require("@/assets/room-collection/classic-plant.png"),
  },
  "botanic-desk": {
    source: require("@/assets/room-collection/botanic-desk.glb"),
    thumbnail: require("@/assets/room-collection/botanic-desk.png"),
  },
  "botanic-seat": {
    source: require("@/assets/room-collection/botanic-seat.glb"),
    thumbnail: require("@/assets/room-collection/botanic-seat.png"),
  },
  "botanic-bookcase": {
    source: require("@/assets/room-collection/botanic-bookcase.glb"),
    thumbnail: require("@/assets/room-collection/botanic-bookcase.png"),
  },
  "botanic-lamp": {
    source: require("@/assets/room-collection/botanic-lamp.glb"),
    thumbnail: require("@/assets/room-collection/botanic-lamp.png"),
  },
  "botanic-window": {
    source: require("@/assets/room-collection/botanic-window.glb"),
    thumbnail: require("@/assets/room-collection/botanic-window.png"),
  },
  "botanic-frame": {
    source: require("@/assets/room-collection/botanic-frame.glb"),
    thumbnail: require("@/assets/room-collection/botanic-frame.png"),
  },
  "botanic-rug": {
    source: require("@/assets/room-collection/botanic-rug.glb"),
    thumbnail: require("@/assets/room-collection/botanic-rug.png"),
  },
  "botanic-plant": {
    source: require("@/assets/room-collection/botanic-plant.glb"),
    thumbnail: require("@/assets/room-collection/botanic-plant.png"),
  },
};

export const roomModel = (piece: RoomPiece) =>
  ROOM_MODELS[piece.modelId] ?? ROOM_MODELS[`natural-${piece.category}`];
