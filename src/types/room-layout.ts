import furnitureManifest from '../../output/room-collections/library-furniture-manifest.json';
import { normalizeAvatar, type ProfileAvatar } from '@/src/types/profile-avatar';
export type RoomCategory =
  | "desk"
  | "seat"
  | "bookcase"
  | "lamp"
  | "window"
  | "frame"
  | "poster"
  | "rug"
  | "plant"
  | "pillow"
  | "cat";
export type RoomSurface = "floor" | "back-wall" | "left-wall" | "desk";
export type RoomPosition = [number, number, number];
export type RoomPiece = {
  id: string;
  category: RoomCategory;
  modelId: string;
  color?: string;
  finish: "original" | "oak" | "walnut" | "sage";
  surface: RoomSurface;
  position: RoomPosition;
  rotation: number;
  photoUri?: string;
  photo?: ProfileAvatar;
  bookId?: string;
  aspect?: "square" | "portrait";
};
export type RoomSize = 6 | 8 | 10 | 12;
export type RoomLayout = { version: 2; roomSize: RoomSize; pieces: RoomPiece[]; legacyPhoto?: ProfileAvatar };
export const ROOM_CATEGORIES: { id: RoomCategory; name: string }[] = [
  { id: "desk", name: "Mesa" },
  { id: "seat", name: "Assento" },
  { id: "bookcase", name: "Estante" },
  { id: "lamp", name: "Luminária" },
  { id: "window", name: "Janela" },
  { id: "frame", name: "Quadros" },
  { id: "poster", name: "Pôsteres" },
  { id: "rug", name: "Tapete" },
  { id: "plant", name: "Plantas" },
  { id: "pillow", name: "Almofada" },
  { id: "cat", name: "Gatinho" },
];
export const ROOM_FINISHES = [
  { id: "original", name: "Original", color: "#C5A581" },
  { id: "oak", name: "Carvalho", color: "#B88B58" },
  { id: "walnut", name: "Nogueira", color: "#60402C" },
  { id: "sage", name: "Sálvia", color: "#809375" },
] as const;
export const MAX_EXTRA_DECORATIONS = 40;
export const ROOM_SIZES: RoomSize[] = [6, 8, 10, 12];
export const DESK_ORIGIN: RoomPosition = [0, 0, 0];
export const BOOKCASE_ORIGIN: RoomPosition = [2.5, 0, -3.5];
const WALL_INSET = 0.12;
export const snapRoomCoordinate = (value: number) =>
  Math.round(value * 2) / 2;
export const ROOM_ROTATION_STEP = Math.PI / 4;
export const snapRoomRotation = (value: number) =>
  Math.round(value / ROOM_ROTATION_STEP) * ROOM_ROTATION_STEP;

export const PLANT_VARIANTS = [
  { id: 'succulent-plant', name: 'Suculenta', width: 0.5, height: 0.65, deskScale: 0.75, floorScale: 1 },
  { id: 'cactus-plant', name: 'Cacto', width: 0.48, height: 0.95, deskScale: 0.65, floorScale: 1 },
  { id: 'zz-plant', name: 'Zamioculca', width: 0.7, height: 1.15, deskScale: 0.6, floorScale: 0.9 },
  { id: 'monstera-plant', name: 'Costela-de-adão', width: 1.05, height: 1.5, deskScale: 0.5, floorScale: 0.85 },
  { id: 'snake-plant', name: 'Espada-de-são-jorge', width: 0.65, height: 1.35, deskScale: 0.5, floorScale: 0.9 },
  { id: 'ficus-plant', name: 'Ficus', width: 0.95, height: 2, deskScale: 0.4, floorScale: 0.9 },
];
export const roomPlantScale = (piece: RoomPiece) => {
  const plant = PLANT_VARIANTS.find(plant => plant.id === piece.modelId);
  return piece.surface === 'desk' ? plant?.deskScale ?? 0.6 : plant?.floorScale ?? 1;
};

// Subtiles are coordinates only; they add no render geometry.
export const roomPieceMoveStep = (piece: RoomPiece) =>
  piece.surface === "back-wall" || piece.surface === "left-wall" ? 0.1
    : piece.category === "plant" ? (piece.surface === "desk" ? 0.1 : 0.25)
    : ["frame", "poster", "window", "cat", "pillow"].includes(piece.category) ? 0.25 : 0.5;

// Directions follow the editor's fixed isometric view, rather than object rotation.
export function nudgeRoomPiece(
  piece: RoomPiece,
  direction: "left" | "right" | "up" | "down",
  step = roomPieceMoveStep(piece),
): RoomPiece {
  const snap = (value: number) => Math.round(value * 100) / 100;
  const position: RoomPosition = [...piece.position];
  if (piece.surface === "floor" || piece.surface === "desk") {
    const offsets = {
      left: [-1, 1],
      right: [1, -1],
      up: [-1, -1],
      down: [1, 1],
    };
    const [x, z] = offsets[direction];
    position[0] = snap(position[0] + x * step);
    position[2] = snap(position[2] + z * step);
  } else if (direction === "up" || direction === "down") {
    position[1] = snap(
      position[1] + (direction === "up" ? step : -step),
    );
  } else {
    const axis = piece.surface === "back-wall" ? 0 : 2;
    const sign = direction === "left" ? -1 : 1;
    position[axis] = snap(
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
    modelId: `isometric-${category}`,
    finish: "original",
    surface,
    position:
      surface === "left-wall"
        ? [
            -4 + WALL_INSET,
            position[1],
            position[2],
          ]
        : surface === "back-wall"
          ? [
              position[0],
              position[1],
              -4 + WALL_INSET,
            ]
          : position,
    rotation,
    photoUri: undefined,
    bookId: undefined,
  });
  // Positions use the approved 6-tile Blender scene, converted to Y-up.
  const pieces: RoomPiece[] = [
    piece("desk", [0, 0, -0.25]),
    piece("seat", [-0.15, 0, 1.15], "floor", Math.PI),
    piece("bookcase", [1.8, 0, -2.55]),
    piece("lamp", [-1.9, 0, -1.9]),
    piece("rug", [0, 0.005 * Math.sqrt(2 / 3), 0.5]),
    piece("plant", [0.4, 1.2 * Math.sqrt(2 / 3), -0.15], "desk", 0, "desk-plant"),
    piece("pillow", [1.8, 0, 2.1]),
    { ...piece("cat", [0, 0, 2.5]), modelId: "cat" },
    {
      ...piece("frame", [-0.4, 1.9 * Math.sqrt(2 / 3), -2.94], "back-wall"),
      photoUri: legacy.pictureFramePhotoUri ?? undefined,
      aspect: "square",
    },
  ];
  // Keep the existing tile-snapped editor while anchoring the approved wall.
  const approved = pieces.map(item => item.surface === "back-wall"
    ? { ...item, position: [item.position[0], item.position[1], -3 + WALL_INSET] as RoomPosition }
    : item);
  if (legacy.leftWallPosterBookId) approved.push({
    ...piece("poster", [-2.88, 1.5, 0.5], "left-wall", Math.PI / 2, "poster"),
    position: [-3 + WALL_INSET, 1.5, 0.5], bookId: legacy.leftWallPosterBookId, aspect: "portrait",
  });
  return { version: 2, roomSize: 6, pieces: approved };
}

export function resizeRoomLayout(layout: RoomLayout, roomSize: RoomSize): RoomLayout | null {
  const pieces = layout.pieces.map(piece => {
    if (piece.category === 'cat') return { ...piece, position: [Math.max(-roomSize / 2 + 0.375, Math.min(roomSize / 2 - 0.375, piece.position[0])), 0, Math.max(-roomSize / 2 + 0.3, Math.min(roomSize / 2 - 0.3, piece.position[2]))] as RoomPosition };
    if (piece.surface === 'back-wall') return { ...piece, position: [piece.position[0], piece.position[1], -roomSize / 2 + WALL_INSET] as RoomPosition };
    if (piece.surface === 'left-wall') return { ...piece, position: [-roomSize / 2 + WALL_INSET, piece.position[1], piece.position[2]] as RoomPosition };
    return piece;
  });
  if (roomSize < layout.roomSize) {
    // Place solid furniture first; rugs may overlap, and desk decor follows its desk.
    const placed: RoomPiece[] = [];
    const ordered = [...pieces].sort((a, b) => {
      const priority = (p: RoomPiece) => p.surface === 'desk' || p.category === 'rug' ? 2 : p.category === 'cat' ? 1 : 0;
      return priority(a) - priority(b);
    });
    for (const piece of ordered) {
      const bounds = floorRect(piece);
      const half = roomSize / 2;
      const position: RoomPosition = [...piece.position];
      if (piece.surface === 'floor') {
        position[0] += Math.max(0, -half - bounds.x0) - Math.max(0, bounds.x1 - half);
        position[2] += Math.max(0, -half - bounds.z0) - Math.max(0, bounds.z1 - half);
      }
      const next = nearestValidPosition({ ...piece, position }, placed, roomSize);
      if (!next) return null;
      placed.push(next);
    }
    return { ...layout, roomSize, pieces: pieces.map(piece => placed.find(item => item.id === piece.id)!) };
  }
  return { ...layout, roomSize, pieces };
}

export const RUG_SHAPES = [
  { id: 'rectangle', name: 'Retangulares', size: [3, 2.4] },
  { id: 'round', name: 'Circulares', size: [2.4, 2.4] },
  { id: 'oval', name: 'Ovais', size: [3, 2.2] },
  { id: 'runner', name: 'Passadeiras', size: [3.2, 1.2] },
] as const;
export type RugShape = typeof RUG_SHAPES[number]['id'];
export const RUG_THEMES = [
  { id: 'observatory', name: 'Observatório', color: '#34465E', border: '#EEE6D3' },
  { id: 'isometric', name: 'Original', color: '#8E8492', border: '#DEC39D' },
  { id: 'botanic', name: 'Botânica', color: '#8FAD82', border: '#EBDDC1' },
  { id: 'atelier', name: 'Ateliê', color: '#C08A72', border: '#EEE1C9' },
  { id: 'library', name: 'Biblioteca', color: '#92616B', border: '#D8C6A0' },
  { id: 'teahouse', name: 'Casa de Chá', color: '#EEE5CF', border: '#9A734D' },
] as const;
export const RUG_VARIANTS = RUG_SHAPES.flatMap(shape => RUG_THEMES.map(theme => ({
  id: shape.id === 'rectangle' ? `${theme.id}-rug` : `${theme.id}-${shape.id}-rug`,
  shape: shape.id, theme, size: shape.size,
})));
export const getRugVariant = (modelId: string) => RUG_VARIANTS.find(variant => variant.id === modelId);

// Local support test for thin rugs, without extra render geometry.
export function roomRugSupports(rug: RoomPiece, x: number, z: number, halfWidth = 0, halfDepth = 0) {
  const variant = getRugVariant(rug.modelId);
  const [width, depth] = variant?.size ?? [3, 2.4];
  const rx = width / 2, rz = depth / 2;
  if (variant?.shape === 'round' || variant?.shape === 'oval') {
    return (x / (rx + halfWidth)) ** 2 + (z / (rz + halfDepth)) ** 2 <= 1;
  }
  if (variant?.shape === 'runner') {
    const end = Math.max(0, Math.abs(x) - (rx - rz));
    return (end / (rz + halfWidth)) ** 2 + (z / (rz + halfDepth)) ** 2 <= 1;
  }
  return Math.abs(x) <= rx + halfWidth && Math.abs(z) <= rz + halfDepth;
}

// Shared display scale keeps render geometry and placement limits in agreement.
export const ROOM_DESK_SCALE = 1.04;
export function roomFurnitureScale(piece: RoomPiece) {
  return piece.category === 'desk' ? ROOM_DESK_SCALE : piece.category === 'seat' ? 0.9 : piece.category === 'pillow' ? 0.9 : 1;
}

export const roomDeskHeight = (modelId: string) => modelId === "teahouse-desk" ? 0.65 : 1.2;

// Bounds in the exported model's local coordinates, after Blender's Y-up conversion.
function unscaledPieceBounds(piece: RoomPiece): {
  min: RoomPosition;
  max: RoomPosition;
} {
  const category = piece.category;
  if (category === "poster")
    return { min: [-0.3, 0, -0.02], max: [0.3, 1.2, 0.02] };
  if (category === "cat")
    return { min: [-0.375, 0, -0.3], max: [0.375, 0.3, 0.3] };
  if (category === "desk")
    return { min: [-0.9, 0, -0.5], max: [0.9, roomDeskHeight(piece.modelId), 0.5] };
  if (category === "seat" && piece.modelId === "teahouse-seat")
    return { min: [-0.42, 0, -0.42], max: [0.42, 0.87, 0.42] };
  if (category === "seat" && piece.modelId === "observatory-seat")
    return { min: [-0.425, 0, -0.425], max: [0.425, 1.45, 0.425] };
  if (category === "seat" && piece.modelId === "library-seat")
    return { min: [-0.46, 0, -0.46], max: [0.46, 1.45, 0.46] };
  if (category === "seat")
    return { min: [-0.375, 0, -0.4], max: [0.375, 1.55, 0.4] };
  if (category === "bookcase")
    return { min: [-0.8, 0, -0.3], max: [0.8, piece.modelId === "teahouse-bookcase" ? 1.48 : 2.6, 0.3] };
  if (category === "lamp")
    return { min: [-0.325, 0, -0.325], max: [0.325, 2.5, 0.325] };
  if (category === "plant")
    {
      const plant = PLANT_VARIANTS.find(plant => plant.id === piece.modelId);
      const scale = roomPlantScale(piece);
      const half = (plant?.width ?? 0.5) * scale / 2;
      return { min: [-half, 0, -half], max: [half, (plant?.height ?? 0.75) * scale, half] };
    }
  if (category === "rug") {
    const [width, depth] = getRugVariant(piece.modelId)?.size ?? [3, 2.4];
    return { min: [-width / 2, 0, -depth / 2], max: [width / 2, 0.026, depth / 2] };
  }
  if (category === "pillow" && piece.modelId === "observatory-pillow")
    return { min: [-0.35, 0, -0.35], max: [0.35, 0.084, 0.35] };
  if (category === "pillow")
    return { min: [-0.5, 0, -0.4], max: [0.5, piece.modelId === "teahouse-pillow" ? 0.15 : 0.12, 0.4] };
  if (category === "window" && piece.modelId === "teahouse-window")
    return { min: [-0.75, 0, -0.1], max: [0.75, 1.2, 0.1] };
  if (category === "window" && piece.modelId === "observatory-window")
    return { min: [-0.62, 0, -0.08], max: [0.62, 1.5, 0.08] };
  if (category === "window")
    return { min: [-0.7, 0, -0.075], max: [0.7, 1.2, 0.075] };
  return { min: [-0.35, 0, -0.03], max: [0.35, piece.aspect === "portrait" ? 0.97 : 0.7, 0.03] };
}

export function pieceBounds(piece: RoomPiece) {
  const bounds = unscaledPieceBounds(piece);
  // Pillow bounds describe its previous 0.7 display scale.
  const scale = piece.category === 'pillow' ? roomFurnitureScale(piece) / 0.7 : roomFurnitureScale(piece);
  return { min: bounds.min.map(value => value * scale) as RoomPosition, max: bounds.max.map(value => value * scale) as RoomPosition };
}

function floorRect(piece: RoomPiece) {
  const bounds = pieceBounds(piece);
  const angle = piece.category === "cat" ? 0 : piece.rotation;
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const outline = piece.category === "rug" || piece.category === "cat" ? 0 : 0.02;
  const measured = (furnitureManifest.collisionFootprints as Record<string, number[][]>)[piece.modelId];
  const points = measured ?? [
    [bounds.min[0] - outline, bounds.min[2] - outline],
    [bounds.max[0] + outline, bounds.min[2] - outline],
    [bounds.max[0] + outline, bounds.max[2] + outline],
    [bounds.min[0] - outline, bounds.max[2] + outline],
  ];
  const scale = piece.category === "plant" ? roomPlantScale(piece) : measured ? roomFurnitureScale(piece) : 1;
  const corners = points.map(([x,z]) => [
    piece.position[0] + scale * (x * c + z * s),
    piece.position[2] + scale * (-x * s + z * c),
  ]);
  return {
    corners,
    x0: Math.min(...corners.map((p) => p[0])),
    x1: Math.max(...corners.map((p) => p[0])),
    z0: Math.min(...corners.map((p) => p[1])),
    z1: Math.max(...corners.map((p) => p[1])),
  };
}
// The GLB wall face is 0.055 tiles inside its origin; keep a tiny depth gap.
const WALL_FACE_INSET = 0.057;
export function constrainRoomPieceToWalls(piece: RoomPiece, roomSize: RoomSize): RoomPiece {
  if (piece.surface !== "floor") return piece;
  const bounds = floorRect(piece), half = roomSize / 2;
  const dx = Math.max(-half + WALL_FACE_INSET - bounds.x0, Math.min(0, half - bounds.x1));
  const dz = Math.max(-half + WALL_FACE_INSET - bounds.z0, Math.min(0, half - bounds.z1));
  if (Math.abs(dx) < 1e-9 && Math.abs(dz) < 1e-9) return piece;
  return { ...piece, position: [piece.position[0] + dx, piece.position[1], piece.position[2] + dz] };
}

function floorPiecesOverlap(a: RoomPiece, b: RoomPiece): boolean {
  const left = floorRect(a), right = floorRect(b);
  if (left.x1 <= right.x0 || right.x1 <= left.x0 || left.z1 <= right.z0 || right.z1 <= left.z0) return false;
  const project = (points: number[][], x: number, z: number) => {
    let min = Infinity, max = -Infinity;
    for (const point of points) {
      const value = point[0] * x + point[1] * z;
      min = Math.min(min, value); max = Math.max(max, value);
    }
    return [min, max];
  };
  for (const polygon of [left.corners, right.corners]) {
    for (let i = 0; i < polygon.length; i++) {
      const point = polygon[i], next = polygon[(i + 1) % polygon.length];
      const dx = next[0] - point[0], dz = next[1] - point[1], length = Math.hypot(dx, dz);
      if (length < 1e-9) continue;
      const l = project(left.corners, -dz / length, dx / length);
      const r = project(right.corners, -dz / length, dx / length);
      if (l[1] <= r[0] + 0.001 || r[1] <= l[0] + 0.001) return false;
    }
  }
  return true;
}

const solid = (piece: RoomPiece) =>
  piece.surface === "floor" && !["rug", "pillow"].includes(piece.category);

export function isRoomPlacementValid(
  piece: RoomPiece,
  pieces: RoomPiece[],
  roomSize: RoomSize = 8,
): boolean {
  if (
    !piece.position.every(Number.isFinite) ||
    !Number.isFinite(piece.rotation)
  )
    return false;
  if (piece.category === 'plant' && pieces.some(other => other.id !== piece.id && other.category === 'plant' && other.surface === piece.surface)) return false;
  if (piece.surface === "desk") {
    return piece.category === "plant" && pieces.some(p => p.category === "desk") &&
      Math.abs(piece.position[0]) + pieceBounds(piece).max[0] <= 0.88 * ROOM_DESK_SCALE && Math.abs(piece.position[2]) + pieceBounds(piece).max[2] <= 0.48 * ROOM_DESK_SCALE &&
      !pieces.some(p => p.id !== piece.id && p.surface === "desk" &&
        Math.hypot(p.position[0] - piece.position[0], p.position[2] - piece.position[2]) < 0.3);
  }
  if (piece.surface !== "floor") {
    const bounds = pieceBounds(piece);
    const horizontal =
      piece.surface === "back-wall" ? piece.position[0] : piece.position[2];
    const y = piece.position[1];
    if (
      horizontal + bounds.min[0] < -(roomSize / 2) + 0.15 ||
      horizontal + bounds.max[0] > roomSize / 2 - 0.15 ||
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
  const half = roomSize / 2;
  if (a.x0 < -half + WALL_FACE_INSET - 1e-9 || a.x1 > half + 1e-9 || a.z0 < -half + WALL_FACE_INSET - 1e-9 || a.z1 > half + 1e-9) return false;
  const cat = pieces.find(other => other.category === 'cat' && other.id !== piece.id);
  if (cat && piece.category !== 'rug' && piece.category !== 'cat' && piece.category !== 'pillow') {
    if (floorPiecesOverlap(piece, cat)) return false;
  }
  if (!solid(piece)) return true;
  return !pieces.some((other) => {
    if (other.id === piece.id || !solid(other)) return false;
    return floorPiecesOverlap(piece, other);
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

function nearestValidPosition(piece: RoomPiece, placed: RoomPiece[], roomSize: RoomSize): RoomPiece | undefined {
  if (isRoomPlacementValid(piece, placed, roomSize)) return piece;
  if (piece.surface === 'desk') return undefined;
  const inset = constrainRoomPieceToWalls(piece, roomSize);
  if (isRoomPlacementValid(inset, placed, roomSize)) return inset;
  const original = piece.position;
  for (let radius = 0.5; radius <= roomSize; radius += 0.5) {
    const offsets: [number, number][] = [];
    for (let x = -radius; x <= radius; x += 0.5) {
      for (let z = -radius; z <= radius; z += 0.5) {
        if (Math.abs(x) + Math.abs(z) === radius) offsets.push([x, z]);
      }
    }
    offsets.sort(([ax, az], [bx, bz]) => ax - bx || az - bz);
    for (const [dx, dz] of offsets) {
      const candidate: RoomPiece = {
        ...piece,
        position: piece.surface === 'back-wall'
          ? [snapRoomCoordinate(original[0] + dx), original[1], original[2]]
          : piece.surface === 'left-wall'
            ? [original[0], original[1], snapRoomCoordinate(original[2] + dz)]
            : [snapRoomCoordinate(original[0] + dx), original[1], snapRoomCoordinate(original[2] + dz)],
      };
      if (isRoomPlacementValid(candidate, placed, roomSize)) return candidate;
    }
  }
  return undefined;
}

export function createRestoredRoomLayout(current: RoomLayout): RoomLayout | null {
  const layout = createDefaultRoomLayout();
  const savedFrames = normalizeRoomLayout(current).pieces.filter((piece) => ['frame', 'poster'].includes(piece.category) && (piece.photo || piece.photoUri || piece.bookId));
  const used = new Set<string>();
  const seedFrames = layout.pieces.filter((piece) => piece.category === 'frame');

  for (const target of seedFrames) {
    const source = savedFrames.find((piece) => piece.category === 'frame' && piece.id === target.id && !used.has(piece.id))
      ?? savedFrames.find((piece) => piece.category === 'frame' && !used.has(piece.id));
    if (!source) continue;
    used.add(source.id);
    layout.pieces = layout.pieces.map((piece) => piece.id === target.id
      ? { ...piece, photo: source.photo, photoUri: source.photoUri, bookId: source.bookId, aspect: source.aspect ?? target.aspect }
      : piece);
  }

  const squareFrame = layout.pieces.find((piece) => piece.id === 'frame');
  if (squareFrame && current.legacyPhoto && !squareFrame.photo && !squareFrame.photoUri) {
    layout.pieces = layout.pieces.map((piece) => piece.id === squareFrame.id
      ? { ...piece, photo: current.legacyPhoto }
      : piece);
  }

  for (const source of savedFrames.filter((piece) => !used.has(piece.id))) {
    if (source.category !== "poster" && layout.pieces.filter(piece => piece.category !== "poster").length >= MAX_EXTRA_DECORATIONS) return null;
    const id = layout.pieces.some((piece) => piece.id === source.id) ? `restored-${source.id}` : source.id;
    const candidates: RoomPiece[] = [];
    const half = layout.roomSize / 2;
    for (const surface of ['back-wall', 'left-wall'] as const) {
      for (let along = -half + 0.75; along <= half - 0.75; along += 0.5) {
        for (const y of [1, 1.5, 2]) {
          candidates.push({
            ...source,
            id,
            modelId: source.category === 'poster' ? 'isometric-poster' : 'isometric-frame',
            surface,
            position: surface === 'back-wall'
              ? [along, y, -half + WALL_INSET] as RoomPosition
              : [-half + WALL_INSET, y, along] as RoomPosition,
            rotation: surface === 'left-wall' ? Math.PI / 2 : 0,
            photo: source.photo,
            photoUri: source.photoUri,
            bookId: source.bookId,
            aspect: source.aspect === 'portrait' ? 'portrait' : 'square',
          });
        }
      }
    }
    const placed = candidates.find((candidate) => isRoomPlacementValid(candidate, layout.pieces, layout.roomSize));
    if (!placed) return null;
    layout.pieces.push(placed);
  }

  return {
    ...layout,
    legacyPhoto: current.legacyPhoto,
  };
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
  let roomSize: RoomSize = ROOM_SIZES.includes((value as RoomLayout).roomSize)
    ? (value as RoomLayout).roomSize
    : 8;
  const pieces: RoomPiece[] = [];
  const migratedPieces = value.pieces.map(raw => {
    if (!raw || typeof raw !== 'object') return raw;
    const piece = raw as RoomPiece;
    return piece.category === 'frame' && piece.bookId
      ? { ...piece, category: 'poster', modelId: 'isometric-poster', aspect: 'portrait', color: undefined }
      : raw;
  });
  let limitedCount = 0;
  const orderedPieces = migratedPieces.filter(raw => {
    if (raw && typeof raw === 'object' && (raw as RoomPiece).category === 'poster') return true;
    return limitedCount++ < MAX_EXTRA_DECORATIONS;
  }).sort((left, right) => {
    const priority = (raw: unknown) => {
      if (!raw || typeof raw !== 'object') return 9;
      const category = (raw as Partial<RoomPiece>).category;
      return category === 'desk' || category === 'bookcase' ? 0
        : category === 'seat' || category === 'lamp' || category === 'rug' ? 1
          : category === 'cat' ? 2 : 3;
    };
    return priority(left) - priority(right);
  });
  for (const raw of orderedPieces) {
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
      typeof p.modelId !== "string" ||
      !(p.category === "cat"
        ? p.modelId === "cat"
        : p.modelId.endsWith(`-${p.category}`))
    )
      continue;
    if (
      !Array.isArray(p.position) ||
      p.position.length !== 3 ||
      !p.position.every(Number.isFinite) ||
      !Number.isFinite(p.rotation)
    )
      continue;
    const wall = p.category === "frame" || p.category === "poster" || p.category === "window";
    if (
      wall
        ? !["back-wall", "left-wall"].includes(p.surface)
        : p.surface !== "floor" &&
          !(
            p.category === "plant" &&
            p.surface === "desk"
          )
    )
      continue;
    // One plant per surface, including older layouts with repeated decorations.
    if (p.category === 'plant' && pieces.some(piece => piece.category === 'plant' && piece.surface === p.surface)) continue;
    const normalized: RoomPiece = {
      id: p.id.slice(0, 80),
      category: p.category,
      modelId: p.category === "cat" ? "cat"
        : (["desk", "seat", "bookcase", "lamp", "rug", "pillow", "window"].includes(p.category) && p.modelId === `botanic-${p.category}`)
          || (["desk", "seat", "bookcase", "lamp", "pillow", "window"].includes(p.category) && p.modelId === `library-${p.category}`)
          || (["desk", "seat", "bookcase", "lamp", "pillow", "window", "frame"].includes(p.category) && p.modelId === `atelier-${p.category}`)
          || (["desk", "seat", "bookcase", "lamp", "pillow", "window", "frame"].includes(p.category) && p.modelId === `observatory-${p.category}`)
          || (["desk", "seat", "bookcase", "lamp", "pillow", "window", "frame"].includes(p.category) && p.modelId === `teahouse-${p.category}`)
          || (p.category === "rug" && Boolean(getRugVariant(p.modelId)))
          || (p.category === "plant" && PLANT_VARIANTS.some(plant => plant.id === p.modelId))
          ? p.modelId : `isometric-${p.category}`,
      color: !["desk", "bookcase", "poster"].includes(p.category) && typeof p.color === "string" && /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : undefined,
      finish: ROOM_FINISHES.some((f) => f.id === p.finish)
        ? p.finish
        : "original",
      surface: p.surface,
      position:
        p.surface === "back-wall"
            ? [
                p.position[0],
                p.position[1],
                -(roomSize / 2) + WALL_INSET,
              ]
            : p.surface === "left-wall"
              ? [
                  -(roomSize / 2) + WALL_INSET,
                p.position[1],
                p.position[2],
              ]
            : p.surface === "desk"
            ? [p.position[0], roomDeskHeight(pieces.find(piece => piece.category === "desk")?.modelId ?? "") * Math.sqrt(2 / 3), p.position[2]]
            : [
                p.position[0],
                p.category === "rug" ? 0.005 * Math.sqrt(2 / 3) : 0,
                p.position[2],
              ],
      rotation: wall
        ? p.surface === "left-wall"
          ? Math.PI / 2
          : 0
        : snapRoomRotation(p.rotation),
      photo: normalizeAvatar(p.photo),
      photoUri: typeof p.photoUri === "string" ? p.photoUri : undefined,
      bookId: p.category === "poster" && typeof p.bookId === "string" ? p.bookId : undefined,
    };
    if (p.category === "poster") normalized.aspect = "portrait";
    if (p.category === "frame")
      normalized.aspect = p.aspect === "portrait" ? "portrait" : "square";
    let placed = nearestValidPosition(normalized, pieces, roomSize);
    if (!placed) {
      for (const expandedSize of ROOM_SIZES.filter(size => size > roomSize)) {
        const half = expandedSize / 2;
        const expandedPieces = pieces.map(existing => existing.category === 'cat'
          ? { ...existing, position: [half - 0.5, 0, half - 0.5] as RoomPosition }
          : existing.surface === 'back-wall'
          ? { ...existing, position: [existing.position[0], existing.position[1], -half + WALL_INSET] as RoomPosition }
          : existing.surface === 'left-wall'
            ? { ...existing, position: [-half + WALL_INSET, existing.position[1], existing.position[2]] as RoomPosition }
              : existing);
        if (!expandedPieces.every(candidate => isRoomPlacementValid(candidate, expandedPieces, expandedSize))) continue;
        const expandedCandidate = normalized.surface === 'back-wall'
          ? { ...normalized, position: [normalized.position[0], normalized.position[1], -half + WALL_INSET] as RoomPosition }
          : normalized.surface === 'left-wall'
            ? { ...normalized, position: [-half + WALL_INSET, normalized.position[1], normalized.position[2]] as RoomPosition }
            : normalized.category === 'cat'
              ? { ...normalized, position: [half - 0.5, 0, half - 0.5] as RoomPosition }
              : normalized;
        placed = nearestValidPosition(expandedCandidate, expandedPieces, expandedSize);
        if (placed) {
          pieces.splice(0, pieces.length, ...expandedPieces);
          roomSize = expandedSize;
          break;
        }
      }
    }
    if (placed) pieces.push(placed);
  }
  for (const original of fallback.pieces.filter(
    (p) =>
      ["desk", "seat", "bookcase", "lamp", "rug"].includes(p.category),
  )) {
    if (
      !pieces.some(
        (p) =>
          p.category === original.category &&
          (original.category !== "plant" || p.id === "desk-plant"),
      )
    ) {
      if (!isRoomPlacementValid(original, pieces, roomSize)) return fallback;
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
      if (isRoomPlacementValid(candidate, pieces, roomSize)) {
        pieces.push(candidate);
        placed = true;
        break;
      }
    }
    if (!placed) return fallback;
  }
  if (!pieces.some(piece => piece.category === 'pillow')) {
    const cat = pieces.find(piece => piece.category === 'cat')!;
    pieces.push({ id: 'cat-cushion', category: 'pillow', modelId: 'isometric-pillow', finish: 'original', surface: 'floor', position: [cat.position[0], 0, cat.position[2]], rotation: 0 });
  }
  const extras = pieces.filter(
    (p) =>
      (p.category === "plant" && p.id !== "desk-plant") ||
      (p.category === "frame" && !["frame", "poster"].includes(p.id)),
  );
  return {
    version: 2,
    roomSize,
    legacyPhoto: normalizeAvatar((value as RoomLayout).legacyPhoto),
    pieces: pieces.filter(
      (p) => !extras.slice(MAX_EXTRA_DECORATIONS).includes(p),
    ),
  };
}

// Expanding the floor adds space; ceiling height remains unchanged.
export const roomWallHeight = (_roomSize: number) => 6 * (3.5 / 7.4);
