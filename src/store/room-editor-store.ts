import { lockedCollection, useCollectionPurchases } from '@/src/services/collection-access';
import { create } from "zustand";
import {
  createRestoredRoomLayout,
  normalizeRoomLayout,
  isRoomPlacementValid,
  constrainRoomPieceToWalls,
  MAX_EXTRA_DECORATIONS,
  resizeRoomLayout,
  roomDeskHeight,
  type RoomSize,
  type RoomLayout,
  type RoomPiece,
} from "@/src/types/room-layout";

export function shouldHandleRoomCameraGesture(
  editing: boolean,
  cameraMode: boolean,
  touches: number,
  dx: number,
  dy: number,
) {
  if (touches > 1) return true;
  if (editing && !cameraMode) return false;
  return Math.abs(dx) > 7 && Math.abs(dx) > Math.abs(dy) * 1.15;
}

export type RoomAppearance = {
  wallPaletteId: string;
  floorPaletteId: string;
  rugPaletteId: string;
  catId: string;
};

type RoomEditorState = {
  appearance: RoomAppearance | null;
  setAppearance: (patch: Partial<RoomAppearance>) => void;
  draft: RoomLayout | null;
  selectedId: string | null;
  invalid: boolean;
  cameraMode: boolean;
  setCameraMode: (enabled: boolean) => void;
  past: RoomLayout[];
  future: RoomLayout[];
  moveStart: RoomLayout | null;
  begin: (layout: RoomLayout, appearance?: RoomAppearance) => void;
  close: () => void;
  select: (id: string | null) => void;
  update: (piece: RoomPiece) => boolean;
  add: (piece: RoomPiece) => boolean;
  remove: (id: string) => void;
  restore: () => boolean;
  beginMove: () => void;
  endMove: () => void;
  undo: () => void;
  redo: () => void;
  resize: (roomSize: RoomSize) => boolean;
};

const sameLayout = (a: RoomLayout, b: RoomLayout) =>
  JSON.stringify(a) === JSON.stringify(b);
const idle = {
  appearance: null,
  cameraMode: false,
  selectedId: null,
  invalid: false,
  past: [],
  future: [],
  moveStart: null,
};

export const useRoomEditor = create<RoomEditorState>((set, get) => {
  const commit = (draft: RoomLayout, selectedId = get().selectedId) => {
    const state = get();
    if (!state.draft || sameLayout(state.draft, draft)) {
      set({ invalid: false });
      return;
    }
    set({
      draft,
      selectedId,
      invalid: false,
      past: state.moveStart
        ? state.past
        : [...state.past, state.draft].slice(-40),
      future: [],
    });
  };
  const travel = (direction: "undo" | "redo") => {
    get().endMove();
    const state = get();
    const source = direction === "undo" ? state.past : state.future;
    const draft = source.at(-1);
    if (!draft || !state.draft) return;
    set({
      draft,
      past:
        direction === "undo"
          ? source.slice(0, -1)
          : [...state.past, state.draft].slice(-40),
      future:
        direction === "redo"
          ? source.slice(0, -1)
          : [...state.future, state.draft].slice(-40),
      selectedId: draft.pieces.some((p) => p.id === state.selectedId)
        ? state.selectedId
        : (draft.pieces[0]?.id ?? null),
      invalid: false,
    });
  };
  return {
    ...idle,
    draft: null,
    setAppearance: (patch) => {
      const appearance = get().appearance;
      const owned = useCollectionPurchases.getState().owned;
      if (Object.values(patch).some(value => lockedCollection(value, owned))) return;
      if (appearance) set({ appearance: { ...appearance, ...patch } });
    },
    begin: (layout, appearance) =>
      set({
        ...idle,
        draft: normalizeRoomLayout(structuredClone(layout)),
        appearance: appearance ? { ...appearance } : null,
        selectedId: layout.pieces[0]?.id ?? null,
      }),
    setCameraMode: (cameraMode) => {
      get().endMove();
      set({ cameraMode });
    },
    close: () => set({ ...idle, draft: null }),
    select: (selectedId) => {
      get().endMove();
      set({ selectedId, invalid: false, cameraMode: false });
    },
    update: (piece) => {
      const owned = useCollectionPurchases.getState().owned;
      if (lockedCollection(piece.modelId, owned) || lockedCollection(piece.color, owned)) return false;
      const draft = get().draft;
      if (draft) piece = constrainRoomPieceToWalls(piece, draft.roomSize);
      if (
        !draft ||
        !draft.pieces.some((p) => p.id === piece.id) ||
        !isRoomPlacementValid(piece, draft.pieces, draft.roomSize)
      ) {
        set({ invalid: true });
        return false;
      }
      const pillow = draft.pieces.find(p => p.category === "pillow");
      const cat = draft.pieces.find(p => p.category === "cat");
      const original = draft.pieces.find(p => p.id === piece.id)!;
      const movingPillow = piece.id === pillow?.id && piece.position.some((value, axis) => value !== original.position[axis]);
      const companion = piece.category === "cat" ? pillow : movingPillow ? cat : undefined;
      const movedCompanion = companion ? { ...companion, position: [piece.position[0], 0, piece.position[2]] as RoomPiece["position"] } : undefined;
      if (movedCompanion && !isRoomPlacementValid(movedCompanion, draft.pieces, draft.roomSize)) {
        set({ invalid: true });
        return false;
      }
      commit({
        ...draft,
        pieces: draft.pieces.map(p => p.id === piece.id ? piece : p.id === movedCompanion?.id ? movedCompanion : piece.category === "desk" && draft.pieces.find(item => item.category === "desk")?.id === piece.id && p.surface === "desk"
          ? { ...p, position: [p.position[0], roomDeskHeight(piece.modelId) * Math.sqrt(2 / 3), p.position[2]] } : p),
      });
      return true;
    },
    add: (piece) => {
      const owned = useCollectionPurchases.getState().owned;
      if (lockedCollection(piece.modelId, owned) || lockedCollection(piece.color, owned)) return false;
      const draft = get().draft;
      if (!draft) return false;
      if (
        (piece.category !== "poster" && draft.pieces.filter(p => p.category !== "poster").length >= MAX_EXTRA_DECORATIONS) ||
        (piece.category === "cat" && draft.pieces.some(p => p.category === "cat")) ||
        !isRoomPlacementValid(piece, draft.pieces, draft.roomSize)
      ) {
        set({ invalid: true });
        return false;
      }
      commit({ ...draft, pieces: [...draft.pieces, piece] }, piece.id);
      return true;
    },
    remove: (id) => {
      const draft = get().draft;
      const piece = draft?.pieces.find((p) => p.id === id);
      if (
        !draft ||
        !piece ||
        piece.category === "cat" ||
        (["desk", "bookcase"].includes(piece.category) && draft.pieces.filter(p => p.category === piece.category).length <= 1)
      )
        return;
      commit(
        { ...draft, pieces: draft.pieces.filter((p) => p.id !== id) },
        draft.pieces.find((p) => p.id !== id && p.category === piece.category)
          ?.id ?? null,
      );
    },
    restore: () => {
      const current = get().draft;
      if (!current) return false;
      const restored = createRestoredRoomLayout(current);
      if (!restored) {
        set({ invalid: true });
        return false;
      }
      commit(restored, "desk");
      return true;
    },
    beginMove: () => {
      get().endMove();
      set({ moveStart: get().draft });
    },
    endMove: () => {
      const { draft, moveStart, past } = get();
      set({
        moveStart: null,
        ...(draft && moveStart && !sameLayout(draft, moveStart)
          ? { past: [...past, moveStart].slice(-40), future: [] }
          : {}),
      });
    },
    undo: () => travel("undo"),
    redo: () => travel("redo"),
    resize: (roomSize) => {
      const draft = get().draft;
      if (!draft) return false;
      const resized = resizeRoomLayout(draft, roomSize);
      if (!resized) {
        set({ invalid: true });
        return false;
      }
      commit(resized);
      return true;
    },
  };
});
