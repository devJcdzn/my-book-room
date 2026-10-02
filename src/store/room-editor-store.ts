import { create } from "zustand";
import {
  createDefaultRoomLayout,
  isRoomPlacementValid,
  MAX_EXTRA_DECORATIONS,
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
  restore: () => void;
  beginMove: () => void;
  endMove: () => void;
  undo: () => void;
  redo: () => void;
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
      if (appearance) set({ appearance: { ...appearance, ...patch } });
    },
    begin: (layout, appearance) =>
      set({
        ...idle,
        draft: structuredClone(layout),
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
      const draft = get().draft;
      if (
        !draft ||
        !draft.pieces.some((p) => p.id === piece.id) ||
        !isRoomPlacementValid(piece, draft.pieces)
      ) {
        set({ invalid: true });
        return false;
      }
      commit({
        ...draft,
        pieces: draft.pieces.map((p) => (p.id === piece.id ? piece : p)),
      });
      return true;
    },
    add: (piece) => {
      const draft = get().draft;
      if (!draft) return false;
      const extras = draft.pieces.filter(
        (p) =>
          (p.category === "plant" && p.id !== "desk-plant") ||
          (p.category === "frame" && !["frame", "poster"].includes(p.id)),
      );
      if (
        ((piece.category === "plant" || piece.category === "frame") &&
          extras.length >= MAX_EXTRA_DECORATIONS) ||
        !isRoomPlacementValid(piece, draft.pieces)
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
        !["plant", "frame", "window"].includes(piece.category) ||
        id === "desk-plant"
      )
        return;
      commit(
        { ...draft, pieces: draft.pieces.filter((p) => p.id !== id) },
        draft.pieces.find((p) => p.id !== id && p.category === piece.category)
          ?.id ?? null,
      );
    },
    restore: () => commit(createDefaultRoomLayout(), "desk"),
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
  };
});
