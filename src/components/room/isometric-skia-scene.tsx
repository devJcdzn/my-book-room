import { extractDominantCoverColor } from '@/src/services/cover-color';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Canvas, Circle, ColorMatrix, Group, Image as SkiaImage, Paint, Path, Skia, useCanvasRef, useImage, type SkImage } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, ReduceMotion, runOnJS, useAnimatedStyle, useDerivedValue, useSharedValue, withRepeat, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { accessibleRoomLayout, lockedCollection, useCollectionPurchases } from '@/src/services/collection-access';
import { IAP_ENABLED } from '@/src/config/features';
import { useAuth } from '@/src/providers/auth-provider';
import { RoomEditorPanel } from '@/src/components/room/room-editor-panel';
import { CozyRoom3DScene, type CozyRoom3DHandle } from '@/src/components/room/cozy-room-3d-scene';
import { registerRoomSnapshotHandler, clearRoomSnapshotCache } from '@/src/services/room-snapshot-service';
import { useRoomEditor } from '@/src/store/room-editor-store';
import { useLibraryStore } from '@/src/store/library-store';
import { colors, darkTheme, radii } from '@/src/theme';
import { AMBIENCE_LABELS, AMBIENCE_THEMES, isSunsetAmbience, resolveAmbience } from '@/src/types/ambience';
import { projectRoomPoint, unprojectScreenDelta, unprojectWallDelta } from '@/src/types/isometric-projection';
import { roomPieceMoveStep, pieceBounds, roomWallHeight, transformRoomPoint, type RoomPiece } from '@/src/types/room-layout';

type SceneProps = {
  onOpenBook: (bookId: string) => void;
  onOpenLibrary: () => void;
  onShare?: () => void;
  isPro: boolean;
  isCustomizing?: boolean;
  onCustomizingChange?: (value: boolean) => void;
  onCanvasReady?: () => void;
  onFurnitureReady?: () => void;
  onSceneError?: () => void;
  onSceneReady?: () => void;
  onSurfaceRecovery?: () => void;
  isRoomFocused?: boolean;
  onToggleRoomFocus?: () => void;
  fitBounds?: { top: number; bottom: number };
};

export { AMBIENCE_THEMES, resolveAmbience };

type Camera = { x: number; y: number; zoom: number; rotation: number };
type SceneState = {
  pieces: RoomPiece[];
  draft: boolean;
  width: number;
  height: number;
  originY: number;
  tile: number;
  camera: Camera;
  onOpenBook: (id: string) => void;
  onOpenLibrary: () => void;
  onPieceSelect: (id: string) => void;
  onPieceMove: (id: string, x: number, z: number, y?: number) => void;
  deskBookIds: string[];
  books: { id: string; status: string; coverColor: string; coverUrl?: string }[];
  catVariant: string;
  isLampOn: boolean;
  invalid: boolean;
};

const MAX_ZOOM = 4;
const MIN_ZOOM = 1;
const LAMP_DUST = [
  [0.28, 1.1, -0.72], [0.52, 1.6, -0.52], [0.12, 0.9, -0.25], [0.74, 2.05, -0.8],
  [0.82, 1.42, -0.35], [1.05, 1.2, 0.05], [0.38, 1.3, -1.02], [0.96, 1.82, -0.48],
  [1.18, 1.52, 0.12], [0.46, 0.82, -0.32], [0.9, 1.72, -0.2], [0.18, 1.48, -0.18],
  [1.3, 1.08, 0.34], [0.62, 2.12, -0.65],
] as const;

function polygon(points: { x: number; y: number }[]) {
  const path = Skia.PathBuilder.Make();
  if (points.length) {
    path.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) path.lineTo(point.x, point.y);
    path.close();
  }
  return path.build();
}

function point(x: number, y: number, z: number, state: Pick<SceneState, 'width' | 'height' | 'originY' | 'tile' | 'camera'>) {
  return projectRoomPoint({ x, y, z }, state, state.tile, state.camera);
}

function LampDustParticle({
  base,
  phase,
  index,
  tile,
  night,
}: {
  base: { x: number; y: number };
  phase: SharedValue<number>;
  index: number;
  tile: number;
  night: boolean;
}) {
  const x = useDerivedValue(() => base.x + Math.cos(phase.value * 0.7 + index * 1.7) * tile * 0.035);
  const y = useDerivedValue(() => base.y + Math.sin(phase.value + index * 1.3) * tile * 0.024);
  const opacity = useDerivedValue(() => {
    const pulse = 0.5 + Math.sin(phase.value * 0.6 + index * 1.9) * 0.5;
    return (night ? 0.16 : 0.04) * (0.48 + pulse * 0.48);
  });
  return (
    <Circle cx={x} cy={y} r={tile * 0.008} color="#FFD685" opacity={opacity} blendMode="plus" />
  );
}

function LampAtmosphere({
  piece,
  state,
  night,
  animate,
}: {
  piece: RoomPiece;
  state: SceneState;
  night: boolean;
  animate: boolean;
}) {
  const phase = useSharedValue(0);
  const active = state.isLampOn;
  useEffect(() => {
    cancelAnimation(phase);
    if (active && animate) phase.value = withRepeat(withTiming(Math.PI * 2, { duration: 12000 }), -1, false);
    else phase.value = 0;
    return () => cancelAnimation(phase);
  }, [active, animate, phase]);

  const particlePoints = LAMP_DUST.slice(0, 5).map(([x, y, z]) => transformPoint([x, y * Math.sqrt(2 / 3), z], piece, state));
  if (!active) return null;
  return <>
    {particlePoints.map((base, index) => <LampDustParticle key={index} base={base} phase={phase} index={index} tile={state.tile} night={night} />)}
  </>;
}

function transformPoint(pointValue: [number, number, number], piece: RoomPiece, state: SceneState) {
  const world = transformRoomPoint(pointValue, piece);
  return point(world[0], world[1], world[2], state);
}

const CAT_CROPS = [[60, 80, 331, 258], [49, 70, 322, 258], [40, 77, 312, 258], [30, 77, 302, 258], [60, 55, 331, 232], [49, 50, 322, 234], [40, 50, 313, 234], [31, 54, 302, 234], [70, 18, 322, 271], [58, 16, 313, 271], [49, 18, 304, 271], [40, 19, 294, 271], [60, 0, 320, 202], [49, 0, 312, 201], [40, 0, 302, 202], [31, 0, 293, 202]];
function CatSprite({ piece, state, catVariant, night, animate, onError }: { piece: RoomPiece; state: SceneState; catVariant: string; night: boolean; animate: boolean; onError?: () => void }) {
  // Read the original atlas at full resolution, rather than enlarging 64px masks.
  const atlas = useImage(require('@/output/sprites-v2/source/gato.png'), () => onError?.());
  const quarter = ((Math.round((piece.rotation + state.camera.rotation) / (Math.PI / 2)) % 4) + 4) % 4;
  const [x0, y0, x1, y1] = CAT_CROPS[quarter * 4];
  const scale = state.tile * 0.5 / (x1 - x0);
  const anchor = point(piece.position[0], 0.09, piece.position[2], state);
  const left = anchor.x - (x1 - x0) * scale / 2;
  const top = anchor.y - (y1 - y0) * scale * 0.82;
  const headX = left + (x1 - x0) * scale * (quarter % 2 === 0 ? 0.23 : 0.77);
  const headY = top + (y1 - y0) * scale * 0.12;
  const phase = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(phase);
    phase.set(0);
    if (animate) phase.set(withRepeat(withTiming(1, { duration: 4800 }), -1, false));
    return () => cancelAnimation(phase);
  }, [animate, phase]);
  const breathing = useDerivedValue(() => [{ scaleY: 1 + 0.055 * (1 - Math.cos(phase.value * Math.PI * 2)) / 2 }]);
  const atlasY = y0 + quarter * ((atlas?.height() ?? 0) / 4);
  const brightness = (night ? 0.58 : 1) * (catVariant === 'black-catnap' ? 0.35 : 1);
  const gray = catVariant === 'gray-catnap' || catVariant === 'black-catnap';
  const matrix = gray
    ? [.3*brightness,.59*brightness,.11*brightness,0,0, .3*brightness,.59*brightness,.11*brightness,0,0, .3*brightness,.59*brightness,.11*brightness,0,0, 0,0,0,1,0]
    : [brightness,0,0,0,0, 0,brightness,0,0,0, 0,0,brightness,0,0, 0,0,0,1,0];
  if (!atlas) return null;
  return <>
  <Group origin={{ x: anchor.x, y: anchor.y }} transform={breathing}>
  <Group clip={{ x: left, y: top, width: (x1-x0)*scale, height: (y1-y0)*scale }} layer={<Paint><ColorMatrix matrix={matrix} /></Paint>}>
    <SkiaImage image={atlas} x={left-x0*scale} y={top-atlasY*scale} width={atlas.width()*scale} height={atlas.height()*scale} fit="fill" />
  </Group>
  </Group>
  {animate ? [0, 1, 2].map(index => <SleepZ key={index} phase={phase} index={index} x={headX} y={headY} tile={state.tile} night={night} />) : null}
  </>;
}

function SleepZ({ phase, index, x, y, tile, night }: { phase: SharedValue<number>; index: number; x: number; y: number; tile: number; night: boolean }) {
  const glyph = useMemo(() => {
    const size = Math.max(6, tile * (0.075 + index * 0.012));
    const path = Skia.PathBuilder.Make();
    path.moveTo(x - size * 0.36, y - size * 0.9);
    path.quadTo(x, y - size * 1.03, x + size * 0.36, y - size * 0.9);
    path.lineTo(x - size * 0.36, y - size * 0.12);
    path.quadTo(x, y, x + size * 0.36, y - size * 0.12);
    return path.build();
  }, [x, y, tile, index]);
  const progress = useDerivedValue(() => (phase.value + index / 3) % 1);
  const opacity = useDerivedValue(() => Math.sin(progress.value * Math.PI) * 0.85);
  const transform = useDerivedValue(() => [{ translateX: Math.sin(progress.value * Math.PI) * tile * 0.035 }, { translateY: -progress.value * tile * 0.27 }]);
  return <Group opacity={opacity} transform={transform}>
    <Path path={glyph} style="stroke" strokeWidth={Math.max(1.5, tile * 0.02)} strokeCap="round" strokeJoin="round" color={night ? '#E7CCAA' : '#806B58'} />
  </Group>;
}

function footprintPath(piece: RoomPiece, state: SceneState) {
  if (piece.surface !== 'floor') return null;
  const bounds = pieceBounds(piece);
  const corner = (x: number, z: number) => transformPoint([x, 0.025, z], piece, state);
  return polygon([
    corner(bounds.min[0], bounds.min[2]), corner(bounds.max[0], bounds.min[2]),
    corner(bounds.max[0], bounds.max[2]), corner(bounds.min[0], bounds.max[2]),
  ]);
}

function hitPiece(x: number, y: number, state: SceneState) {
  const piece = state.pieces.find(item => item.category === 'cat');
  if (!piece) return null;
  const anchor = point(piece.position[0], 0.09, piece.position[2], state);
  return Math.abs(x - anchor.x) <= state.tile * 0.25 &&
    y >= anchor.y - state.tile * 0.32 && y <= anchor.y + state.tile * 0.12 ? piece : null;
}

function toCanvasPoint(x: number, y: number, translateX: number, translateY: number, zoom: number, state: SceneState) {
  return {
    x: (x - state.width / 2 - translateX) / zoom + state.width / 2,
    y: (y - state.originY - translateY) / zoom + state.originY,
  };
}

export function IsometricSkiaScene(props: SceneProps) {
  const hasHydrated = useLibraryStore(state => state._hasHydrated);
  const checked = useCollectionPurchases(state => state.checked);
  const { isLoading } = useAuth();
  if (!hasHydrated || (IAP_ENABLED && (isLoading || !checked))) return <View style={styles.container} />;
  return <LoadedIsometricSkiaScene {...props} />;
}

function LoadedIsometricSkiaScene(props: SceneProps) {
  const { onCanvasReady, onFurnitureReady, onSceneReady, onSurfaceRecovery } = props;
  const windowSize = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const canvasRef = useRef<View>(null);
  const [measuredSize, setMeasuredSize] = useState({ width: 0, height: 0 });
  const width = measuredSize.width || windowSize.width;
  const height = measuredSize.height || windowSize.height;
  const editor = useRoomEditor();
  const savedLayout = useLibraryStore(state => state.roomLayout);
  const books = useLibraryStore(state => state.books);
  const deskBookIds = useLibraryStore(state => state.deskBookIds);
  const roomBooks = useMemo(() => books.map(book => ({
    id: book.id, status: book.status, coverColor: book.dominantCoverColor ?? book.coverColor, coverUrl: book.coverUrl,
  })), [books]);
  const ambienceMode = useLibraryStore(state => state.ambienceMode);
  const owned = useCollectionPurchases(state => state.owned);
  const savedWallPaletteId = useLibraryStore(state => state.wallPaletteId);
  const wallSelection = editor.appearance?.wallPaletteId ?? savedWallPaletteId;
  const wallPaletteId = lockedCollection(wallSelection, owned) ? 'mist-blue' : wallSelection;
  const savedFloorPaletteId = useLibraryStore(state => state.floorPaletteId);
  const floorSelection = editor.appearance?.floorPaletteId ?? savedFloorPaletteId;
  const floorPaletteId = lockedCollection(floorSelection, owned) ? 'ash-wood' : floorSelection;
  const savedRugPaletteId = useLibraryStore(state => state.rugPaletteId);
  const rugSelection = editor.appearance?.rugPaletteId ?? savedRugPaletteId;
  const rugPaletteId = lockedCollection(rugSelection, owned) ? 'soft-slate' : rugSelection;
  const bookcasePaletteId = useLibraryStore(state => state.bookcasePaletteId);
  const windowStyleId = useLibraryStore(state => state.leftWallWindowStyle);
  const savedCatId = useLibraryStore(state => state.catId);
  const catId = editor.appearance?.catId ?? savedCatId;
  const isLampOn = useLibraryStore(state => state.isLampOn);
  const [glSnapshotImage, setGlSnapshotImage] = useState<SkImage | null>(null);
  const snapshotCanvas = useCanvasRef();
  const [snapshotMode, setSnapshotMode] = useState(false);
  const [ambienceOverride, setAmbienceOverride] = useState<'day' | 'night' | null>(null);
  const [ambienceTime, setAmbienceTime] = useState(() => new Date());
  const isNight = (ambienceOverride ?? resolveAmbience(ambienceMode, ambienceTime)) === 'night';
  const isSunset = !ambienceOverride && isSunsetAmbience(ambienceMode, ambienceTime);
  const [rotation, setRotation] = useState(0);
  const rotationStart = useSharedValue(0);
  const rotationValue = useSharedValue(0);
  const camera = { x: 0, y: 0, zoom: 1, rotation };
  const cameraX = useSharedValue(0);
  const cameraY = useSharedValue(0);
  const cameraZoom = useSharedValue(1);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const pinchStartZoom = useSharedValue(1);
  const sceneReady = useRef(false);
  const [surfaceVersion, setSurfaceVersion] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener('change', next => {
      const resumed = next === 'active' && (previous === 'inactive' || previous === 'background');
      previous = next;
      if (!resumed) return;
      // Both native drawing layers can lose their drawable while iOS is inactive.
      setGlSnapshotImage(null);
      setSnapshotMode(false);
      setAmbienceOverride(null);
      sceneReady.current = false;
      onSurfaceRecovery?.();
      setSurfaceVersion(version => version + 1);
    });
    return () => subscription.remove();
  }, [onSurfaceRecovery]);
  const [isActive, setIsActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    if (!isActive || ambienceMode !== 'auto') return;
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      const now = new Date();
      setAmbienceTime(now);
      timer = setTimeout(update, 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()));
    };
    update();
    return () => clearTimeout(timer);
  }, [ambienceMode, isActive]);

  const shelfCapacity = (editor.draft ?? savedLayout).pieces.reduce((total, piece) => {
    if (piece.category !== 'bookcase') return total;
    if (piece.modelId === 'teahouse-bookcase') return total + 14;
    return total + (['atelier-bookcase', 'observatory-bookcase'].includes(piece.modelId) ? 28 : 32);
  }, 0);
  useEffect(() => {
    if (!isActive) return;
    let active = true;
    const visibleBooks = [
      ...books.filter(book => !deskBookIds.includes(book.id)).slice(0, shelfCapacity),
      ...books.filter(book => deskBookIds.includes(book.id)),
    ];
    const fillCoverColors = async () => {
      for (const book of visibleBooks) {
        if (!active) break;
        if (!book.coverUrl || book.dominantCoverColor) continue;
        const color = await extractDominantCoverColor(book.coverUrl);
        if (active && color) useLibraryStore.getState().setDominantCoverColor(book.id, book.coverUrl, color);
      }
    };
    void fillCoverColors();
    return () => { active = false; };
  }, [books, deskBookIds, isActive, shelfCapacity]);

  const [reduceMotion, setReduceMotion] = useState(false);
  const [editorPanelHeight, setEditorPanelHeight] = useState(0);
  const [editorToolbarHeight, setEditorToolbarHeight] = useState(0);
  const storedLayout = useMemo(() => accessibleRoomLayout(editor.draft ?? savedLayout, owned), [editor.draft, savedLayout, owned]);
  const layout = useMemo(() => {
  const cat = storedLayout.pieces.find(piece => piece.category === 'cat');
  const cushion = storedLayout.pieces.find(piece => piece.category === 'pillow');
  return cat ? { ...storedLayout, pieces: [
    ...storedLayout.pieces.map(piece => piece.id === cushion?.id ? { ...piece, position: [cat.position[0], 0, cat.position[2]] as [number, number, number] } : piece),
    ...(!cushion ? [{ ...cat, id: 'cat-cushion', category: 'pillow' as const, modelId: 'isometric-pillow', position: [cat.position[0], 0, cat.position[2]] as [number, number, number] }] : []),
  ] } : storedLayout;
  }, [storedLayout]);
  const panelOpen = Boolean(editor.draft);
  const fitTop = panelOpen
    ? insets.top + 8 + (editorToolbarHeight || 52) + 12
    : props.fitBounds?.top ?? insets.top + 145;
  const fitBottom = panelOpen
    ? height - (editorPanelHeight || 250) - 12
    : props.fitBounds?.bottom ?? height - insets.bottom - 205;
  const availableHeight = Math.max(180, fitBottom - fitTop);
  const wallScreenHeight = roomWallHeight(layout.roomSize) * Math.sqrt(3 / 8);
  const framingScale = panelOpen ? 1 : 1.5;
  const tileForHeight = (frameHeight: number) => framingScale * Math.max(18, Math.min(
    (width - insets.left - insets.right - 32) / (6 + 0.16),
    frameHeight / (6 / 2 + roomWallHeight(6) * Math.sqrt(3 / 8) + 0.2),
  ));
  const navigationTile = tileForHeight(availableHeight);
  const focusTop = insets.top + 64;
  const focusBottom = height - insets.bottom - 76;
  const focusHeight = Math.max(180, focusBottom - focusTop);
  const focusTile = tileForHeight(focusHeight);
  const focusOriginY = Math.max(0, Math.min(height, (focusTop + focusBottom) / 2 + focusTile * wallScreenHeight / 2));
  const focusProgress = useSharedValue(props.isRoomFocused ? 1 : 0);
  useEffect(() => {
    focusProgress.set(withTiming(props.isRoomFocused ? 1 : 0, {
      duration: 240,
      easing: Easing.bezier(0.77, 0, 0.175, 1),
      reduceMotion: ReduceMotion.System,
    }));
  }, [focusProgress, props.isRoomFocused]);
  const focusScale = useDerivedValue(() => panelOpen || snapshotMode ? 1 : 1 + focusProgress.get() * (focusTile / navigationTile - 1));
  const animatedFrameHeight = useDerivedValue(() => panelOpen ? availableHeight : availableHeight + focusProgress.get() * (focusHeight - availableHeight));
  const renderHeight = snapshotMode ? width : height;
  const tile = snapshotMode ? Math.min((width - 24) / (layout.roomSize + 0.2), (width - 24) / (layout.roomSize / 2 + wallScreenHeight + 0.2)) : navigationTile;
  const originY = snapshotMode ? width / 2 + tile * wallScreenHeight / 2 : Math.max(0, Math.min(height, (fitTop + fitBottom) / 2 + tile * roomWallHeight(layout.roomSize) * Math.sqrt(3 / 8) / 2));
  const focusOffset = useDerivedValue(() => panelOpen || snapshotMode ? 0 : focusProgress.get() * (focusOriginY - originY));
  const previousFraming = useRef({ panelOpen, tile, originY });
  useLayoutEffect(() => {
    const previous = previousFraming.current;
    previousFraming.current = { panelOpen, tile, originY };
    if (!previous.panelOpen || panelOpen || snapshotMode) return;

    const tileRatio = previous.tile / tile;
    const originDelta = previous.originY - originY;
    scheduleOnUI(() => {
      'worklet';
      const spring = { stiffness: 250, damping: 32, overshootClamping: true, reduceMotion: ReduceMotion.System };
      // Preserve the displayed framing while the renderer switches to room coordinates.
      cameraY.set(cameraY.get() + originDelta - focusOffset.get());
      cameraZoom.set(cameraZoom.get() * tileRatio / focusScale.get());
      cameraX.set(withSpring(0, spring));
      cameraY.set(withSpring(0, spring));
      cameraZoom.set(withSpring(1, spring));
    });
  }, [panelOpen, snapshotMode, tile, originY, cameraX, cameraY, cameraZoom, focusOffset, focusScale]);

  const cameraStyle = useAnimatedStyle(() => ({
    transformOrigin: [width / 2, originY, 0],
    transform: [
      { translateX: snapshotMode ? 0 : cameraX.value },
      { translateY: snapshotMode ? 0 : cameraY.get() + focusOffset.get() },
      { scale: snapshotMode ? 1 : cameraZoom.get() * focusScale.get() },
    ],
  }));
  const pieces = layout.pieces;
  const latest = useRef<SceneState | null>(null);
  const [focusRevision, setFocusRevision] = useState(0);
  const roomSceneRef = useRef<CozyRoom3DHandle>(null);
  const gesture = useRef({ startX: 0, startY: 0, startZoom: 1, startCamera: { x: 0, y: 0 }, selected: null as RoomPiece | null });
  const state: SceneState = {
    pieces, draft: panelOpen,
    width, height, originY, tile, camera: snapshotMode ? { ...camera, rotation: 0 } : camera, catVariant: catId, isLampOn, invalid: editor.invalid, onOpenBook: props.onOpenBook, onOpenLibrary: props.onOpenLibrary,
    onPieceSelect: editor.select,
    onPieceMove: (id, x, z, y) => {
      const piece = useRoomEditor.getState().draft?.pieces.find(item => item.id === id);
      if (piece) {
        const nextX = piece.surface === 'left-wall' ? piece.position[0] : x;
        const nextZ = piece.surface === 'back-wall' ? piece.position[2] : z;
        useRoomEditor.getState().update({ ...piece, position: [nextX, y ?? piece.position[1], nextZ] });
      }
    },
    deskBookIds, books: roomBooks,
  };
  useEffect(() => { latest.current = state; });

  useEffect(() => {
    if (!panelOpen || snapshotMode || editor.cameraMode || gesture.current.selected) return;
    const selected = layout.pieces.find(piece => piece.id === editor.selectedId);
    if (!selected) return;
    const desk = selected.surface === 'desk' ? layout.pieces.find(piece => piece.category === 'desk') : undefined;
    const world = desk ? transformRoomPoint(selected.position, desk) : selected.position;
    const bounds = pieceBounds(selected);
    const center = point(world[0], world[1] + bounds.max[1] * 0.4, world[2], state);
    const zoom = 1.6;
    const spring = { stiffness: 250, damping: 32, overshootClamping: true, reduceMotion: ReduceMotion.System };
    cameraZoom.set(withSpring(zoom, spring));
    cameraX.set(withSpring((width / 2 - center.x) * zoom, spring));
    cameraY.set(withSpring((fitTop + availableHeight / 2 - originY) - (center.y - originY) * zoom, spring));
    // Reframe on selection, not on each movement or panel resize.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen, editor.selectedId, focusRevision]);

  const resetCamera = (animated = false) => {
    setRotation(0);
    rotationValue.set(0);
    const timing = { duration: 240, easing: Easing.bezier(0.77, 0, 0.175, 1), reduceMotion: ReduceMotion.System };
    cameraX.set(animated ? withTiming(0, timing) : 0);
    cameraY.set(animated ? withTiming(0, timing) : 0);
    cameraZoom.set(animated ? withTiming(1, timing) : 1);
  };
  const beginTouch = useCallback((x: number, y: number, translateX: number, translateY: number, zoom: number) => {
    const current = latest.current;
    if (!current) return;
    const local = toCanvasPoint(x, y, translateX, translateY, zoom, current);
    gesture.current = { startX: x, startY: y, startZoom: zoom, startCamera: { x: translateX, y: translateY }, selected: null };
    if (current.draft && !useRoomEditor.getState().cameraMode) {
      const hit = roomSceneRef.current?.hitTest(local.x + current.width / 2, local.y, current.width * 2, current.height);
      const piece = hitPiece(local.x, local.y, current) ?? (hit && current.pieces.find((item) => item.id === hit.pieceId));
      if (piece) { useRoomEditor.getState().beginMove(); gesture.current.selected = piece; current.onPieceSelect(piece.id); }
    }
  }, []);
  const moveTouch = useCallback((dx: number, dy: number) => {
    const current = latest.current;
    if (!current) return;
    if (gesture.current.selected) {
      const selected = gesture.current.selected;
      if (selected.surface === 'back-wall' || selected.surface === 'left-wall') {
        const { horizontal, height } = unprojectWallDelta(dx, dy, current.tile, gesture.current.startZoom, current.camera.rotation ?? 0, selected.surface);
        const grid = 1 / roomPieceMoveStep(selected);
        const snap = (value: number) => Math.round(value * grid) / grid;
        current.onPieceMove(selected.id,
          selected.surface === 'back-wall' ? snap(selected.position[0] + horizontal) : selected.position[0],
          selected.surface === 'left-wall' ? snap(selected.position[2] + horizontal) : selected.position[2],
          snap(selected.position[1] + height));
        return;
      }
      const { x, z } = unprojectScreenDelta(dx, dy, current.tile, gesture.current.startZoom, current.camera.rotation);
      const origin = gesture.current.selected.position;
      const grid = 1 / roomPieceMoveStep(gesture.current.selected);
      current.onPieceMove(gesture.current.selected.id,
        Math.round((origin[0] + (gesture.current.selected.surface === 'left-wall' ? 0 : x)) * grid) / grid,
        Math.round((origin[2] + (gesture.current.selected.surface === 'back-wall' ? 0 : z)) * grid) / grid);
    }
  }, []);
  const endTouch = useCallback(() => {
    useRoomEditor.getState().endMove();
    if (gesture.current.selected) setFocusRevision(value => value + 1);
    gesture.current.selected = null;
  }, []);
  const tapTouch = useCallback((x: number, y: number, translateX: number, translateY: number, zoom: number) => {
    const current = latest.current;
    if (!current) return;
    if (current.draft) {
      beginTouch(x, y, translateX, translateY, zoom);
      endTouch();
      return;
    }
    const local = toCanvasPoint(x, y, translateX, translateY, zoom, current);
    const hit = roomSceneRef.current?.hitTest(local.x + current.width / 2, local.y, current.width * 2, current.height);
    if (hit?.bookId) { current.onOpenBook(hit.bookId); return; }
    const item = (hit && current.pieces.find((piece) => piece.id === hit.pieceId)) ?? hitPiece(local.x, local.y, current);
    if (item?.category === 'lamp') {
      useLibraryStore.getState().toggleLamp();
      void Haptics.selectionAsync();
    } else if (item?.category === 'poster' && item.bookId) {
      current.onOpenBook(item.bookId);
    } else if (item?.category === 'desk') {
      const id = current.deskBookIds.at(-1);
      if (id) current.onOpenBook(id);
    } else if (item?.category === 'bookcase') {
      current.onOpenLibrary();
    }
  }, [beginTouch, endTouch]);
  // Gesture callbacks run after commit on the UI/JS event loop and read the latest refs.
  /* eslint-disable react-hooks/refs, react-hooks/preserve-manual-memoization -- Gesture worklets share mutable UI values and need stable gesture instances. */
  const sceneGesture = useMemo(() => {
    const pan = Gesture.Pan().maxPointers(1)
      .onStart(event => {
        cancelAnimation(cameraX);
        cancelAnimation(cameraY);
        cancelAnimation(cameraZoom);
        panStartX.set(cameraX.value);
        panStartY.set(cameraY.value);
        runOnJS(beginTouch)(event.x - event.translationX, event.y - event.translationY, cameraX.get(), cameraY.get() + focusOffset.get(), cameraZoom.get() * focusScale.get());
      })
      .onUpdate(event => {
        if (panelOpen && !editor.cameraMode) {
          runOnJS(moveTouch)(event.translationX, event.translationY);
        } else {
          const horizontalLimit = Math.max(0, (tile * layout.roomSize * Math.cos(rotationValue.value) * cameraZoom.value * focusScale.get() - width) / 2);
          const verticalLimit = Math.max(0, (tile * (layout.roomSize * Math.cos(rotationValue.value) / 2 + wallScreenHeight) * cameraZoom.value * focusScale.get() - animatedFrameHeight.get()) / 2);
          cameraX.set(Math.max(-horizontalLimit, Math.min(horizontalLimit, panStartX.value + event.translationX)));
          cameraY.set(Math.max(-verticalLimit, Math.min(verticalLimit, panStartY.value + event.translationY)));
        }
      })
      .onFinalize(() => runOnJS(endTouch)());
    const pinch = Gesture.Pinch()
      .onStart(() => {
        cancelAnimation(cameraZoom);
        pinchStartZoom.set(cameraZoom.value);
      })
      .onUpdate(event => {
        const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pinchStartZoom.value * event.scale));
        cameraZoom.set(zoom);
        const horizontalLimit = Math.max(0, (tile * layout.roomSize * Math.cos(rotationValue.value) * zoom * focusScale.get() - width) / 2);
        const verticalLimit = Math.max(0, (tile * (layout.roomSize * Math.cos(rotationValue.value) / 2 + wallScreenHeight) * zoom * focusScale.get() - animatedFrameHeight.get()) / 2);
        cameraX.set(Math.max(-horizontalLimit, Math.min(horizontalLimit, cameraX.value)));
        cameraY.set(Math.max(-verticalLimit, Math.min(verticalLimit, cameraY.value)));
      });
    const rotate = Gesture.Rotation()
      .onBegin(() => { rotationStart.set(rotationValue.value); })
      .onUpdate(event => {
        const angle = Math.max(-Math.PI / 4 + 0.05, Math.min(Math.PI / 4 - 0.05, rotationStart.value + event.rotation));
        rotationValue.set(angle);
        runOnJS(setRotation)(angle);
      });
    const tap = Gesture.Tap().maxDistance(8)
      .onEnd((event, success) => { if (success) runOnJS(tapTouch)(event.x, event.y, cameraX.get(), cameraY.get() + focusOffset.get(), cameraZoom.get() * focusScale.get()); });
    return Gesture.Simultaneous(pan, pinch, rotate, tap);
  }, [panelOpen, editor.cameraMode, beginTouch, moveTouch, endTouch, tapTouch, cameraX, cameraY, cameraZoom, panStartX, panStartY, pinchStartZoom, rotationStart, rotationValue, tile, layout.roomSize, width, wallScreenHeight, focusOffset, focusScale, animatedFrameHeight]);
  /* eslint-enable react-hooks/refs, react-hooks/preserve-manual-memoization */

  const beginEdit = () => {
    const store = useLibraryStore.getState();
    useRoomEditor.getState().begin(store.roomLayout, {
      wallPaletteId: store.wallPaletteId, floorPaletteId: store.floorPaletteId,
      rugPaletteId: store.rugPaletteId, catId: store.catId,
    });
    props.onCustomizingChange?.(true);
    resetCamera();
  };
  const closeEdit = () => {
    props.onCustomizingChange?.(false);
  };

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);


  useFocusEffect(useCallback(() => {
    setIsActive(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', value => setIsActive(value === 'active'));
    onCanvasReady?.();
    return () => { subscription.remove(); setIsActive(false); };
  }, [onCanvasReady, setIsActive]));

  useEffect(() => {
    const unregister = registerRoomSnapshotHandler(async options => {
      setSnapshotMode(true);
      setAmbienceOverride(options?.ambience ?? null);
      try {
        await new Promise(resolve => setTimeout(resolve, 220));
        const uri = await roomSceneRef.current?.snapshot(options?.ambience);
        if (!uri) throw new Error('A captura 3D não está disponível.');
        const data = await Skia.Data.fromURI(uri);
        const image = Skia.Image.MakeImageFromEncoded(data);
        if (!image) throw new Error('Não foi possível ler a imagem 3D.');
        setGlSnapshotImage(image);
        await new Promise(resolve => setTimeout(resolve, 100));
        const composed = await snapshotCanvas.current?.makeImageSnapshotAsync();
        if (!composed) throw new Error('Não foi possível compor a sala.');
        const file = new File(Paths.cache, `room-share-${Date.now()}.png`);
        file.write(composed.encodeToBytes());
        return file.uri;
      } finally {
        setGlSnapshotImage(null);
        setAmbienceOverride(null);
        setSnapshotMode(false);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });
    return unregister;
  }, [snapshotCanvas]);
  useEffect(() => { clearRoomSnapshotCache(); }, [layout, books, wallPaletteId, floorPaletteId, catId, ambienceMode]);

  const cycleAmbience = () => {
    const next = { auto: 'day', day: 'sunset', sunset: 'night', night: 'auto' } as const;
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    useLibraryStore.getState().setAmbienceMode(next[ambienceMode]);
  };
  const selectedPiece = pieces.find((piece) => piece.id === editor.selectedId);
  const selectedFootprint = panelOpen && selectedPiece ? footprintPath(selectedPiece, state) : null;
  const lampPiece = pieces.find((piece) => piece.category === 'lamp');

  const roomControlSurface = {
    backgroundColor: isNight ? darkTheme.surface : colors.paper,
    borderColor: isNight ? darkTheme.border : colors.line,
  };
  const roomControl = (label: string, icon: keyof typeof Ionicons.glyphMap, onPress: () => void, value?: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label}
      accessibilityValue={value ? { text: value } : undefined} onPress={onPress}
      style={styles.control}>
      {({ pressed }) => (
        <View style={[styles.controlGlyph, pressed && { backgroundColor: isNight ? darkTheme.selection : colors.sageSoft }]}>
          <Ionicons name={icon} size={19} color={value ? (isNight ? darkTheme.selectionText : colors.sageDark) : (isNight ? darkTheme.text : colors.ink)} accessible={false} />
        </View>
      )}
    </Pressable>
  );

  return (
    <View
      onLayout={(event: LayoutChangeEvent) => {
        const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
        setMeasuredSize(current => Math.abs(current.width - nextWidth) < 0.5 && Math.abs(current.height - nextHeight) < 0.5
          ? current
          : { width: nextWidth, height: nextHeight });
      }}
      style={[styles.container, { backgroundColor: isNight ? darkTheme.bg : isSunset ? colors.sunsetBackdrop : colors.softFill }]}
    >
      <GestureDetector gesture={sceneGesture}>
      <View ref={canvasRef} collapsable={false} style={snapshotMode ? { position: 'absolute', top: 0, width, height: renderHeight, overflow: 'hidden', backgroundColor: isNight ? darkTheme.bg : isSunset ? colors.sunsetBackdrop : colors.softFill } : StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, cameraStyle]}>
          <CozyRoom3DScene
            key={`room-gl-${surfaceVersion}`}
            ref={roomSceneRef}
            layout={layout}
            books={state.books}
            deskBookIds={deskBookIds}
            width={width * 2}
            height={height}
            originY={originY}
            tile={tile}
            rotation={snapshotMode ? 0 : rotation}
            isNight={isNight}
            isSunset={isSunset}
            isLampOn={isLampOn}
            isActive={isActive && !panelOpen}
            reduceMotion={reduceMotion}
            wallPaletteId={wallPaletteId}
            floorPaletteId={floorPaletteId}
            rugPaletteId={rugPaletteId}
            bookcasePaletteId={bookcasePaletteId}
            windowStyleId={windowStyleId}
            onReady={() => {
              if (!sceneReady.current) {
                sceneReady.current = true;
                onFurnitureReady?.();
                onSceneReady?.();
              }
            }}
            onError={() => props.onSceneError?.()}
            style={{ position: 'absolute', left: -width / 2, top: 0, width: width * 2, height, opacity: glSnapshotImage ? 0 : 1 }}
          />
          <Canvas key={`room-skia-${surfaceVersion}`} ref={snapshotCanvas} style={StyleSheet.absoluteFill}>
            {glSnapshotImage ? <>
              <Path path={polygon([{x:0,y:0},{x:width,y:0},{x:width,y:renderHeight},{x:0,y:renderHeight}])} color={isNight ? darkTheme.bg : isSunset ? colors.sunsetBackdrop : colors.softFill} />
              <SkiaImage image={glSnapshotImage} x={-width/2} y={0} width={width*2} height={height} fit="fill" />
            </> : null}
            {lampPiece && state.isLampOn ? <LampAtmosphere piece={lampPiece} state={state} night={isNight} animate={isActive && !panelOpen && !snapshotMode && !reduceMotion} /> : null}
            <Group>
              {pieces.filter(piece => piece.category === 'cat').map(piece => <CatSprite key={piece.id} piece={piece} state={state} catVariant={catId} night={isNight} animate={isActive && !panelOpen && !snapshotMode && !reduceMotion} onError={props.onSceneError} />)}
            </Group>
            {selectedFootprint ? <Path path={selectedFootprint} color={editor.invalid ? '#bf4e43' : '#738b5e'} style="stroke" strokeWidth={2} opacity={0.92} /> : null}
          </Canvas>
        </Animated.View>
      </View>
      </GestureDetector>
      {!panelOpen ? (
        <View style={[styles.header, { top: insets.top + 8, left: insets.left + 18, right: insets.right + 18 }]}>
          <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit style={[styles.title, isNight && styles.titleNight]}>nookly</Text>
          <View style={[styles.controlGroup, roomControlSurface]}>
            {roomControl('Alternar iluminação', isNight ? 'moon-outline' : isSunset ? 'partly-sunny-outline' : 'sunny-outline', cycleAmbience,
              AMBIENCE_LABELS[ambienceMode])}
            {roomControl('Reenquadrar quarto', 'scan-outline', () => resetCamera(true))}
            {props.onToggleRoomFocus && roomControl(
                props.isRoomFocused ? 'Mostrar mesa e calendário' : 'Ocultar mesa e calendário',
                props.isRoomFocused ? 'contract-outline' : 'expand-outline',
                props.onToggleRoomFocus,
                props.isRoomFocused ? 'Modo foco ativo' : undefined,
              )}
            <View style={[styles.controlDivider, { backgroundColor: roomControlSurface.borderColor }]} />
            {roomControl('Personalizar quarto', 'options-outline', beginEdit)}
            {props.onShare && roomControl('Compartilhar quarto', 'share-outline', props.onShare)}
          </View>
        </View>
      ) : <RoomEditorPanel isNight={isNight} onClose={closeEdit} onHeightChange={setEditorPanelHeight} onToolbarHeightChange={setEditorToolbarHeight} />}

    </View>
  );
}

export const IsometricScene = IsometricSkiaScene;

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  header: { position: 'absolute', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 2 },
  controlGroup: { flexDirection: 'row', borderRadius: radii.full, borderWidth: StyleSheet.hairlineWidth },
  controlDivider: { width: StyleSheet.hairlineWidth, height: 20, alignSelf: 'center' },
  control: { width: 44, height: 44, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  controlGlyph: { width: 32, height: 32, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'left', color: colors.ink, fontSize: 22, fontWeight: '600', letterSpacing: -1.1 },
  titleNight: { color: darkTheme.text },
});
