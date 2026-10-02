export type RoomCategory =
  | "desk"
  | "seat"
  | "bookcase"
  | "lamp"
  | "window"
  | "frame"
  | "rug"
  | "plant"
  | "cat";
export type RoomCollection = "natural" | "classic" | "botanic";
export type RoomSurface = "floor" | "back-wall" | "left-wall" | "desk";
export type RoomPosition = [number, number, number];
export type RoomPiece = {
  id: string;
  category: RoomCategory;
  modelId: string;
  finish: "original" | "oak" | "walnut" | "sage";
  surface: RoomSurface;
  position: RoomPosition;
  rotation: number;
  photoUri?: string;
  bookId?: string;
  aspect?: "square" | "portrait";
};
export type RoomLayout = { version: 1; pieces: RoomPiece[] };
export const ROOM_CATEGORIES: { id: RoomCategory; name: string }[] = [
  { id: "desk", name: "Mesa" },
  { id: "seat", name: "Assento" },
  { id: "bookcase", name: "Estante" },
  { id: "lamp", name: "Luminária" },
  { id: "window", name: "Janela" },
  { id: "frame", name: "Quadros" },
  { id: "rug", name: "Tapete" },
  { id: "plant", name: "Plantas" },
  { id: "cat", name: "Gatinho" },
];
export const ROOM_COLLECTIONS: { id: RoomCollection; name: string }[] = [
  { id: "natural", name: "Natural claro" },
  { id: "classic", name: "Biblioteca clássica" },
  { id: "botanic", name: "Botânico" },
];
export const ROOM_FINISHES = [
  { id: "original", name: "Original", color: "#C5A581" },
  { id: "oak", name: "Carvalho", color: "#B88B58" },
  { id: "walnut", name: "Nogueira", color: "#60402C" },
  { id: "sage", name: "Sálvia", color: "#809375" },
] as const;
export const MAX_EXTRA_DECORATIONS = 8;
export const DESK_ORIGIN: RoomPosition = [0.42, 0, 0.62];
export const BOOKCASE_ORIGIN: RoomPosition = [1.45, 0, -3];
export const snapRoomCoordinate = (value: number) =>
  Math.round(value * 10) / 10;
export const snapRoomRotation = (value: number) =>
  (Math.round(value / (Math.PI / 4)) * Math.PI) / 4;

// Directions follow the editor's fixed isometric view, rather than object rotation.
export function nudgeRoomPiece(
  piece: RoomPiece,
  direction: "left" | "right" | "up" | "down",
  step = 0.1,
): RoomPiece {
  if (piece.surface === "desk") return piece;
  const position: RoomPosition = [...piece.position];
  if (piece.surface === "floor") {
    const offsets = {
      left: [-1, 1],
      right: [1, -1],
      up: [-1, -1],
      down: [1, 1],
    };
    const [x, z] = offsets[direction];
    position[0] = snapRoomCoordinate(position[0] + x * step);
    position[2] = snapRoomCoordinate(position[2] + z * step);
  } else if (direction === "up" || direction === "down") {
    position[1] = snapRoomCoordinate(
      position[1] + (direction === "up" ? step : -step),
    );
  } else {
    const axis = piece.surface === "back-wall" ? 0 : 2;
    const sign = direction === "left" ? -1 : 1;
    position[axis] = snapRoomCoordinate(
      position[axis] + sign * step * (axis === 2 ? -1 : 1),
    );
  }
  return { ...piece, position };
}

export function createDefaultRoomLayout(
  legacy: {
    leftWallItem?: string;
    pictureFrameSize?: string;
    pictureFramePhotoUri?: string | null;
    leftWallPosterBookId?: string;
  } = {},
): RoomLayout {
  const piece = (
    category: RoomCategory,
    position: RoomPosition,
    surface: RoomSurface = "floor",
    rotation = 0,
    id: string = category,
  ): RoomPiece => ({
    id,
    category,
    modelId: `natural-${category}`,
    finish: "original",
    surface,
    position:
      surface === "left-wall"
        ? [
            -3.43,
            snapRoomCoordinate(position[1]),
            snapRoomCoordinate(position[2]),
          ]
        : surface === "back-wall"
          ? [
              snapRoomCoordinate(position[0]),
              snapRoomCoordinate(position[1]),
              -3.53,
            ]
          : (position.map((v, i) =>
              i === 1 ? v : snapRoomCoordinate(v),
            ) as RoomPosition),
    rotation,
    photoUri: undefined,
    bookId: undefined,
  });
  const pieces = [
    piece("desk", [...DESK_ORIGIN]),
    piece("seat", [0.42, 0, 1.95], "floor", Math.PI),
    piece("bookcase", [...BOOKCASE_ORIGIN]),
    piece("lamp", [-2.28, 0, -1.08]),
    piece("rug", [0.42, 0.015, 1.05]),
    piece("plant", [-0.9, 1.15, -0.4], "desk", 0, "desk-plant"),
    { ...piece("cat", [2.2, 0, 1.4], "floor", -Math.PI / 4), modelId: "cat" },
  ];
  if (legacy.leftWallItem === "window")
    pieces.push(piece("window", [-3.43, 2, 0.55], "left-wall", Math.PI / 2));
  if (legacy.leftWallItem === "poster")
    pieces.push({
      ...piece(
        "frame",
        [-3.43, 2.05, 0.55],
        "left-wall",
        Math.PI / 2,
        "poster",
      ),
      bookId: legacy.leftWallPosterBookId ?? "first-book",
      aspect: "portrait",
    });
  if (legacy.pictureFrameSize !== "none")
    pieces.push({
      ...piece("frame", [-1, 2.1, -3.53], "back-wall"),
      photoUri: legacy.pictureFramePhotoUri ?? undefined,
      aspect: legacy.pictureFrameSize === "2:1" ? "portrait" : "square",
    });
  return { version: 1, pieces };
}

// Bounds in the exported model's local coordinates, after Blender's Y-up conversion.
export function pieceBounds(piece: RoomPiece): {
  min: RoomPosition;
  max: RoomPosition;
} {
  const category = piece.category;
  if (category === "cat")
    return { min: [-0.54, 0, -0.54], max: [0.54, 0.65, 0.54] };
  if (category === "desk")
    return { min: [-1.2, 0, -0.75], max: [1.2, 1.15, 0.75] };
  if (category === "seat")
    return { min: [-0.52, 0, -0.45], max: [0.52, 1.6, 0.45] };
  if (category === "bookcase")
    return { min: [-1.15, 0, 0.055], max: [1.15, 2.94, 0.8] };
  if (category === "lamp")
    return { min: [-0.47, 0, -0.47], max: [0.47, 2.55, 0.47] };
  if (category === "plant")
    return { min: [-0.65, 0, -0.65], max: [0.65, 1.12, 0.65] };
  if (category === "rug")
    return { min: [-1.72, 0, -1.72], max: [1.72, 0.08, 1.72] };
  if (category === "window")
    return { min: [-1.04, -0.98, 0], max: [1.04, 1.24, 0.3] };
  return piece.aspect === "portrait"
    ? { min: [-0.46, -0.83, 0], max: [0.46, 0.83, 0.1] }
    : { min: [-0.57, -0.57, 0], max: [0.57, 0.57, 0.1] };
}

function floorRect(piece: RoomPiece) {
  const bounds = pieceBounds(piece);
  const angle = piece.category === "cat" ? 0 : piece.rotation;
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const corners = [bounds.min[0], bounds.max[0]].flatMap((x) =>
    [bounds.min[2], bounds.max[2]].map((z) => [
      piece.position[0] + x * c + z * s,
      piece.position[2] - x * s + z * c,
    ]),
  );
  return {
    x0: Math.min(...corners.map((p) => p[0])),
    x1: Math.max(...corners.map((p) => p[0])),
    z0: Math.min(...corners.map((p) => p[1])),
    z1: Math.max(...corners.map((p) => p[1])),
  };
}
const solid = (piece: RoomPiece) =>
  piece.surface === "floor" && piece.category !== "rug";

export function isRoomPlacementValid(
  piece: RoomPiece,
  pieces: RoomPiece[],
): boolean {
  if (
    !piece.position.every(Number.isFinite) ||
    !Number.isFinite(piece.rotation)
  )
    return false;
  if (piece.surface === "desk") return piece.id === "desk-plant";
  if (piece.surface !== "floor") {
    const bounds = pieceBounds(piece);
    const horizontal =
      piece.surface === "back-wall" ? piece.position[0] : piece.position[2];
    const y = piece.position[1];
    if (
      horizontal + bounds.min[0] < -3.35 ||
      horizontal + bounds.max[0] > 3.35 ||
      y + bounds.min[1] < 0.12 ||
      y + bounds.max[1] > 3.48
    )
      return false;
    return !pieces.some((other) => {
      if (other.id === piece.id || other.surface !== piece.surface)
        return false;
      const b = pieceBounds(other),
        h =
          other.surface === "back-wall" ? other.position[0] : other.position[2];
      return (
        horizontal + bounds.min[0] < h + b.max[0] &&
        horizontal + bounds.max[0] > h + b.min[0] &&
        y + bounds.min[1] < other.position[1] + b.max[1] &&
        y + bounds.max[1] > other.position[1] + b.min[1]
      );
    });
  }
  const a = floorRect(piece);
  if (a.x0 < -3.4 || a.x1 > 3.5 || a.z0 < -3.5 || a.z1 > 3.6) return false;
  if (!solid(piece)) return true;
  return !pieces.some((other) => {
    if (other.id === piece.id || !solid(other)) return false;
    const b = floorRect(other);
    return (
      a.x0 < b.x1 - 0.02 &&
      a.x1 > b.x0 + 0.02 &&
      a.z0 < b.z1 - 0.02 &&
      a.z1 > b.z0 + 0.02
    );
  });
}

export function transformRoomPoint(
  point: RoomPosition,
  piece: RoomPiece,
  origin: RoomPosition = [0, 0, 0],
): RoomPosition {
  const x = point[0] - origin[0],
    z = point[2] - origin[2],
    c = Math.cos(piece.rotation),
    s = Math.sin(piece.rotation);
  return [
    piece.position[0] + x * c + z * s,
    piece.position[1] + point[1] - origin[1],
    piece.position[2] - x * s + z * c,
  ];
}

export function normalizeRoomLayout(
  value: unknown,
  legacy: Parameters<typeof createDefaultRoomLayout>[0] = {},
): RoomLayout {
  const fallback = createDefaultRoomLayout(legacy);
  if (
    !value ||
    typeof value !== "object" ||
    !("pieces" in value) ||
    !Array.isArray(value.pieces)
  )
    return fallback;
  const pieces: RoomPiece[] = [];
  for (const raw of value.pieces.slice(0, 19)) {
    if (!raw || typeof raw !== "object") continue;
    const p = raw as RoomPiece;
    if (
      !ROOM_CATEGORIES.some((c) => c.id === p.category) ||
      typeof p.id !== "string" ||
      !p.id ||
      pieces.some((x) => x.id === p.id)
    )
      continue;
    if (
      p.category !== "plant" &&
      p.category !== "frame" &&
      pieces.some((x) => x.category === p.category)
    )
      continue;
    if (
      typeof p.modelId !== "string" ||
      !(p.category === "cat"
        ? p.modelId === "cat"
        : ROOM_COLLECTIONS.some((c) => p.modelId === `${c.id}-${p.category}`))
    )
      continue;
    if (
      !Array.isArray(p.position) ||
      p.position.length !== 3 ||
      !p.position.every(Number.isFinite) ||
      !Number.isFinite(p.rotation)
    )
      continue;
    const wall = p.category === "frame" || p.category === "window";
    if (
      wall
        ? !["back-wall", "left-wall"].includes(p.surface)
        : p.surface !== "floor" &&
          !(
            p.category === "plant" &&
            p.id === "desk-plant" &&
            p.surface === "desk"
          )
    )
      continue;
    const normalized: RoomPiece = {
      id: p.id.slice(0, 80),
      category: p.category,
      modelId: p.modelId,
      finish: ROOM_FINISHES.some((f) => f.id === p.finish)
        ? p.finish
        : "original",
      surface: p.surface,
      position:
        p.surface === "back-wall"
          ? [
              snapRoomCoordinate(p.position[0]),
              snapRoomCoordinate(p.position[1]),
              -3.53,
            ]
          : p.surface === "left-wall"
            ? [
                -3.43,
                snapRoomCoordinate(p.position[1]),
                snapRoomCoordinate(p.position[2]),
              ]
            : [
                snapRoomCoordinate(p.position[0]),
                p.surface === "desk" ? 1.15 : p.category === "rug" ? 0.015 : 0,
                snapRoomCoordinate(p.position[2]),
              ],
      rotation: wall
        ? p.surface === "left-wall"
          ? Math.PI / 2
          : 0
        : snapRoomRotation(p.rotation),
      photoUri: typeof p.photoUri === "string" ? p.photoUri : undefined,
      bookId: typeof p.bookId === "string" ? p.bookId : undefined,
    };
    if (p.category === "frame")
      normalized.aspect = p.aspect === "portrait" ? "portrait" : "square";
    if (isRoomPlacementValid(normalized, pieces)) pieces.push(normalized);
  }
  for (const original of fallback.pieces.filter(
    (p) =>
      ["desk", "seat", "bookcase", "lamp", "rug"].includes(p.category) ||
      p.id === "desk-plant",
  )) {
    if (
      !pieces.some(
        (p) =>
          p.category === original.category &&
          (original.category !== "plant" || p.id === "desk-plant"),
      )
    ) {
      if (!isRoomPlacementValid(original, pieces)) return fallback;
      pieces.push(original);
    }
  }
  if (!pieces.some((p) => p.category === "cat")) {
    const cat = fallback.pieces.find((p) => p.category === "cat")!;
    let placed = false;
    const candidates = [
      cat.position,
      ...Array.from(
        { length: 49 },
        (_, i) =>
          [
            snapRoomCoordinate(-2.7 + (i % 7) * 0.8),
            0,
            snapRoomCoordinate(-2.7 + Math.floor(i / 7) * 0.8),
          ] as RoomPosition,
      ),
    ];
    for (const position of candidates) {
      const candidate = { ...cat, position };
      if (isRoomPlacementValid(candidate, pieces)) {
        pieces.push(candidate);
        placed = true;
        break;
      }
    }
    if (!placed) return fallback;
  }
  const extras = pieces.filter(
    (p) =>
      (p.category === "plant" && p.id !== "desk-plant") ||
      (p.category === "frame" && !["frame", "poster"].includes(p.id)),
  );
  return {
    version: 1,
    pieces: pieces.filter(
      (p) => !extras.slice(MAX_EXTRA_DECORATIONS).includes(p),
    ),
  };
}
