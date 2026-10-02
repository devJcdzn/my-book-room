/* eslint-disable react/no-unknown-property */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import { GLView } from 'expo-gl';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, PanResponder, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdditiveBlending, type Group, type OrthographicCamera, setConsoleFunction } from 'three';

import { useRoomTexture } from '@/src/components/room/use-room-texture';

import { RoomEditorPanel } from '@/src/components/room/room-editor-panel';
import { shouldHandleRoomCameraGesture, useRoomEditor } from '@/src/store/room-editor-store';
import { BOOKCASE_ORIGIN, DESK_ORIGIN, transformRoomPoint, type RoomLayout, type RoomPiece } from '@/src/types/room-layout';
import { preloadCatModels, RoomCat } from '@/src/components/room/room-cat';
import { RoomPieceGroup, RoomFurniture } from '@/src/components/room/room-furniture';
import { resolveRoomOptionId } from '@/src/services/room-customization-access';
import { coverUrlForId } from '@/src/services/open-library';
import { registerRoomSnapshotHandler, setLastCapturedRoomUri } from '@/src/services/room-snapshot-service';
import { type AmbienceMode, useLibraryStore } from '@/src/store/library-store';
import { controls, colors, darkTheme, typography } from '@/src/theme';
import type { Book } from '@/src/types/book';
import {
  getFloorPalette,
  getWallPalette,
  type FloorPalette,
  type WallPalette,
} from '@/src/types/room-customization';

setConsoleFunction?.((type, message, ...params) => {
  if (
    message.includes('Multiple instances of Three.js being imported') ||
    message.includes('Clock: This module has been deprecated')
  ) {
    return;
  }
  if (type === 'warn') {
    console.warn(message, ...params);
  } else if (type === 'error') {
    console.error(message, ...params);
  } else {
    console.log(message, ...params);
  }
});

type Vector = [number, number, number];
type SceneProps = {
  onCustomize?: () => void;
  onOpenBook: (bookId: string) => void;
  onSelectBook: (bookId: string) => void;
  onShare?: () => void;
  isPro: boolean;
  isCustomizing?: boolean;
  onCustomizingChange?: (isCustomizing: boolean) => void;
  onCanvasReady?: () => void;
  onFurnitureReady?: () => void;
  onSceneError?: () => void;
  onSceneReady?: () => void;
};

type RotationState = {
  targetY: number;
};

type ZoomState = {
  current: number;
  target: number;
};

export type ResolvedAmbience = 'day' | 'night';

export const AMBIENCE_THEMES: Record<
  ResolvedAmbience,
  {
    bgColor: string;
    ambientColor: string;
    ambientIntensity: number;
    sunColor: string;
    sunIntensity: number;
    sunPosition: Vector;
    lampColor: string;
    lampIntensity: number;
    lampDistance: number;
    coneOpacity: number;
    dustOpacity: number;
    floorShadowOpacity: number;
  }
> = {
  day: {
    bgColor: '#EAE0D2',
    ambientColor: '#FFF9F0',
    ambientIntensity: 1.38,
    sunColor: '#FFF2DF',
    sunIntensity: 2.2,
    sunPosition: [4.5, 7.5, 5],
    lampColor: '#FFD6A4',
    lampIntensity: 1.6,
    lampDistance: 5.5,
    coneOpacity: 0.025,
    dustOpacity: 0.22,
    floorShadowOpacity: 0.52,
  },
  night: {
    bgColor: darkTheme.bg,
    ambientColor: '#5C554D',
    ambientIntensity: 0.65,
    sunColor: '#A89B88',
    sunIntensity: 0.85,
    sunPosition: [3.8, 6.2, 4.2],
    lampColor: '#FFA64D',
    lampIntensity: 3.4, // Luz focal acolhedora sem estourar as paredes
    lampDistance: 8.5,
    coneOpacity: 0.08, // Feixe volumétrico dourado aditivo
    dustOpacity: 0.7,
    floorShadowOpacity: 0.78,
  },
};

export function resolveAmbience(mode: AmbienceMode): ResolvedAmbience {
  if (mode !== 'auto') return mode;
  const hour = new Date().getHours();
  return hour >= 6 && hour < 18 ? 'day' : 'night';
}

const AMBIENCE_META: Record<AmbienceMode, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  auto: { label: 'Auto', icon: 'time-outline', color: '#A36845' },
  day: { label: 'Dia', icon: 'sunny', color: '#D97706' },
  night: { label: 'Noite', icon: 'moon', color: darkTheme.accent },
};

// Rotação horizontal simétrica estável sem oscilação
const ROTATION_LIMIT = 0.58; // ~33 graus cada lado
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 2.4;
const OPEN_BOOK_POSITION: Vector = [0.10, 1.20, 0.74];
function useBookCoverTexture(book: Book) {
  return useRoomTexture(book.coverUrl ?? coverUrlForId(book.coverId));
}

const bookShape = (id: string) => {
  const score = [...id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return {
    width: 0.70 + (score % 4) * 0.05,
    thickness: 0.09 + (score % 3) * 0.018,
    depth: 0.46 + (score % 5) * 0.02,
    rotation: ((score % 7) - 3) * 0.018,
  };
};

const deskPosition = (book: Book, index: number): Vector => {
  const shape = bookShape(book.id);
  return [
    1.12 + ((index % 3) - 1) * 0.025,
    1.20 + index * 0.11 + shape.thickness / 2,
    0.68 + ((index % 2) * 2 - 1) * 0.018,
  ];
};

const shelfPosition = (index: number, book?: Book): Vector => {
  const column = index % 4;
  const row = Math.floor(index / 4);
  const height=book?bookShape(book.id).width*.88:.53;
  return [0.88 + column * 0.38, .215 + height/2 + row * .82, -2.61];
};

function CameraRig({ offsetY = 0, width, height, zoom }: { offsetY?: number; width: number; height: number; zoom: number }) {
  const camera = useThree((state) => state.camera as OrthographicCamera);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    camera.position.set(6.7, 6.25, 7.4);
    camera.lookAt(0, 1.08, 0);
    // Three.js cameras update their projection imperatively.
    // eslint-disable-next-line react-hooks/immutability
    camera.zoom = zoom;
    if (offsetY) camera.setViewOffset(width, height, 0, offsetY, width, height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    invalidate();
  }, [camera, offsetY, width, height, zoom, invalidate]);

  return null;
}

function FirstFrameNotifier({ onReady }: { onReady?: () => void }) {
  const hasFired = useRef(false);
  useFrame(() => {
    if (!hasFired.current) {
      hasFired.current = true;
      onReady?.();
    }
  });
  return null;
}

function FurnitureReadyNotifier({ onReady }: { onReady?: () => void }) {
  const hasFired = useRef(false);

  useEffect(() => {
    if (!hasFired.current) {
      hasFired.current = true;
      onReady?.();
    }
  }, [onReady]);

  return null;
}

function RoomSnapshotRegistrar({
  onSetAmbience,
}: {
  onSetAmbience?: (ambience: 'day' | 'night' | null) => void;
}) {
  const { gl, scene, camera, size } = useThree();

  useEffect(() => {
    return registerRoomSnapshotHandler(async (options?: { ambience?: 'day' | 'night' }) => {
      const orthoCam = camera as OrthographicCamera;
      const prevZoom = orthoCam.zoom;
      const prevPos = orthoCam.position.clone();
      const prevRotation = orthoCam.quaternion.clone();
      try {
        const targetAmbience = options?.ambience;
        if (targetAmbience && onSetAmbience) {
          onSetAmbience(targetAmbience);
          // Permite que o React e Three.js renderizem o frame com a iluminação solicitada
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        // Frame the entire isometric room cleanly with balanced margins:
        // Room bounding box span is ~8.6 units.
        const framingZoom = Math.min(size.width / 9.6, size.height / 13.5);
        orthoCam.zoom = framingZoom;
        orthoCam.position.set(6.7, 6.25, 7.4);
        orthoCam.lookAt(0, 1.25, 0);
        orthoCam.updateProjectionMatrix();

        // Render scene with the full-room framing
        gl.render(scene, orthoCam);

        const exgl = (gl as any).getContext?.() ?? gl;
        let finalUri: string | null = null;
        if (exgl) {
          const snapshot = await GLView.takeSnapshotAsync(exgl, { format: 'png', compress: 1.0 });
          const rawUri = typeof snapshot?.uri === 'string' ? snapshot.uri : null;
          if (rawUri) {
            finalUri = rawUri;

            // Crop to a perfect centered 1:1 square if height > width
            if (snapshot.width && snapshot.height && snapshot.height > snapshot.width) {
              try {
                const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
                const side = snapshot.width;
                const originY = Math.max(0, Math.round((snapshot.height - side) / 2));
                const cropped = await manipulateAsync(
                  rawUri,
                  [{ crop: { originX: 0, originY, width: side, height: side } }],
                  { format: SaveFormat.PNG }
                );
                if (cropped?.uri) {
                  finalUri = cropped.uri;
                }
              } catch (cropErr) {
                console.warn('Fallback sem crop na imagem da sala:', cropErr);
              }
            }

            setLastCapturedRoomUri(finalUri, targetAmbience);
          }
        }

        return finalUri;
      } catch (err) {
        console.warn('Não foi possível gerar snapshot 3D direto:', err);
      } finally {
        orthoCam.zoom = prevZoom;
        orthoCam.position.copy(prevPos);
        orthoCam.quaternion.copy(prevRotation);
        orthoCam.updateProjectionMatrix();
        onSetAmbience?.(null);
        gl.render(scene, orthoCam);
      }
      return null;
    });
  }, [gl, scene, camera, size, onSetAmbience]);

  return null;
}

type SceneAssetBoundaryProps = {
  children: React.ReactNode;
  onError?: () => void;
};

type SceneAssetBoundaryState = {
  hasError: boolean;
};

class SceneAssetBoundary extends React.Component<SceneAssetBoundaryProps, SceneAssetBoundaryState> {
  state: SceneAssetBoundaryState = { hasError: false };

  static getDerivedStateFromError(): SceneAssetBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn('Não foi possível carregar um asset da sala:', error.message);
    this.props.onError?.();
  }

  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

function ClosedBook({ book, upright = false }: { book: Book; upright?: boolean }) {
  const shape = bookShape(book.id);
  const color = book.coverColor;
  const coverTexture = useBookCoverTexture(book);

  if (upright) {
    // Dimensões do livro em pé na estante:
    // x: espessura na prateleira (~0.14 a 0.20)
    // y: altura do livro (~0.57 a 0.70)
    // z: profundidade da estante (~0.31 a 0.38)
    const w = shape.thickness * 1.6;
    const h = shape.width * 0.88;
    const d = shape.depth * 0.9;
    const boardThick = 0.014;
    const paperRecess = 0.016;

    // A estante tem a lombada voltada para +z (sala/câmera).
    // O miolo de folhas fica recuado para -z e protegido pelas capas duras.
    return (
      <group rotation={[0, 0, shape.rotation * 1.8]}>
        {/* Capa esquerda (contracapa) */}
        <mesh position={[-w / 2 + boardThick / 2, 0, 0]}>
          <boxGeometry args={[boardThick, h, d]} />
          <meshStandardMaterial color={color} roughness={0.78} />
        </mesh>

        {/* Capa direita (capa da frente) */}
        <mesh position={[w / 2 - boardThick / 2, 0, 0]}>
          <boxGeometry args={[boardThick, h, d]} />
          <meshStandardMaterial color={color} roughness={0.78} />
        </mesh>

        {coverTexture ? (
          <>
            <mesh position={[w / 2 + 0.002, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
              <planeGeometry args={[d * 0.94, h * 0.94]} />
              <meshStandardMaterial map={coverTexture} roughness={0.82} />
            </mesh>
            <mesh position={[-w / 2 - 0.002, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
              <planeGeometry args={[d * 0.94, h * 0.94]} />
              <meshStandardMaterial map={coverTexture} roughness={0.82} />
            </mesh>
          </>
        ) : null}

        {/* Lombada sólida voltada para a sala (+z) */}
        <mesh position={[0, 0, d / 2 - boardThick / 2]}>
          <boxGeometry args={[w, h, boardThick]} />
          <meshStandardMaterial color={color} roughness={0.75} />
        </mesh>

        {/* Nervuras clássicas em relevo na lombada (3 filetes horizontais) */}
        {[-h * 0.28, 0, h * 0.28].map((yOffset, i) => (
          <mesh key={i} position={[0, yOffset, d / 2 + 0.003]}>
            <boxGeometry args={[w * 0.98, 0.016, 0.012]} />
            <meshStandardMaterial color="#D4AF37" metalness={0.25} roughness={0.5} />
          </mesh>
        ))}

        {/* Plaqueta/Etiqueta nobre de título na lombada */}
        <mesh position={[0, h * 0.14, d / 2 + 0.005]}>
          <boxGeometry args={[w * 0.74, h * 0.20, 0.008]} />
          <meshStandardMaterial color="#FDF9F0" roughness={0.9} />
        </mesh>
        {/* Linha elegante de texto dourado na etiqueta */}
        <mesh position={[0, h * 0.14, d / 2 + 0.010]}>
          <boxGeometry args={[w * 0.52, 0.008, 0.004]} />
          <meshStandardMaterial color="#A68341" roughness={0.6} />
        </mesh>

        {/* Miolo de páginas (rebaixado e visível de cima com quadratura clássica) */}
        <mesh position={[0, 0, -paperRecess / 2]}>
          <boxGeometry args={[w - boardThick * 2.2, h - 0.024, d - boardThick - paperRecess]} />
          <meshStandardMaterial color="#FFF9EC" roughness={1} />
        </mesh>

        {/* Capitel / tecido decorativo visível no topo da lombada */}
        <mesh position={[0, h / 2 - 0.01, d / 2 - 0.02]}>
          <boxGeometry args={[w - 0.02, 0.012, 0.018]} />
          <meshStandardMaterial color="#993D3D" roughness={0.8} />
        </mesh>
      </group>
    );
  }

  // Livro deitado na mesa ou empilhado:
  const w = shape.depth;
  const t = shape.thickness;
  const d = shape.width;
  const boardThick = 0.012;

  return (
    <group rotation={[0, shape.rotation, 0]}>
      {/* Capa inferior */}
      <mesh position={[0, -t / 2 + boardThick / 2, 0]}>
        <boxGeometry args={[w, boardThick, d]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>

      {/* Capa superior */}
      <mesh position={[0, t / 2 - boardThick / 2, 0]}>
        <boxGeometry args={[w, boardThick, d]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>

      {coverTexture ? (
        <mesh position={[0, t / 2 + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w * 0.94, d * 0.94]} />
          <meshStandardMaterial map={coverTexture} roughness={0.82} />
        </mesh>
      ) : (
        <>
          <mesh position={[0.02, t / 2 + 0.002, 0]}>
            <boxGeometry args={[w * 0.82, 0.004, d * 0.82]} />
            <meshStandardMaterial color={color} roughness={0.6} />
          </mesh>
          <mesh position={[0.02, t / 2 + 0.004, 0]}>
            <boxGeometry args={[w * 0.76, 0.004, d * 0.76]} />
            <meshStandardMaterial color="#E8D5B5" roughness={0.9} />
          </mesh>
        </>
      )}

      {/* Lombada lateral esquerda unindo as capas */}
      <mesh position={[-w / 2 + boardThick / 2, 0, 0]}>
        <boxGeometry args={[boardThick, t, d]} />
        <meshStandardMaterial color={color} roughness={0.78} />
      </mesh>

      {/* Miolo de folhas com quadratura elegante */}
      <mesh position={[boardThick / 2, 0, 0]}>
        <boxGeometry args={[w - boardThick * 2, t - boardThick * 2.2, d - 0.02]} />
        <meshStandardMaterial color="#FFF9ED" roughness={1} />
      </mesh>

      {/* Fitilho marcador de páginas em fita de cetim terracota */}
      <mesh position={[w / 2 + 0.02, -t / 2 + 0.022, 0.05]} rotation={[0, 0.2, 0.25]}>
        <boxGeometry args={[0.07, 0.006, 0.028]} />
        <meshStandardMaterial color="#B85F42" roughness={0.6} />
      </mesh>
    </group>
  );
}

function OpenBook({ color, onPress }: { color: string; onPress: () => void }) {
  const group = useRef<Group>(null);

  useFrame(() => {
    if (!group.current) return;
    group.current.scale.lerp({ x: 1, y: 1, z: 1 }, 0.12);
    group.current.position.y += (OPEN_BOOK_POSITION[1] - group.current.position.y) * 0.12;
  });

  return (
    <group
      ref={group}
      position={[OPEN_BOOK_POSITION[0], OPEN_BOOK_POSITION[1] - 0.03, OPEN_BOOK_POSITION[2]]}
      rotation={[0, -0.08, 0]}
      scale={[0.86, 0.86, 0.86]}
    >
      {/* Capa externa esquerda */}
      <mesh position={[-0.26, -0.012, 0]} rotation={[0, 0, -0.04]}>
        <boxGeometry args={[0.52, 0.016, 0.66]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      {/* Capa externa direita */}
      <mesh position={[0.26, -0.012, 0]} rotation={[0, 0, 0.04]}>
        <boxGeometry args={[0.52, 0.016, 0.66]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      {/* Base da lombada central */}
      <mesh position={[0, -0.016, 0]}>
        <boxGeometry args={[0.08, 0.012, 0.66]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>

      {/* Bloco de páginas esquerdas com curvatura suave */}
      <mesh position={[-0.24, 0.016, 0]} rotation={[0, 0, -0.04]}>
        <boxGeometry args={[0.47, 0.026, 0.61]} />
        <meshStandardMaterial color="#FFF5E5" roughness={1} />
      </mesh>
      {/* Folha superior esquerda ligeiramente elevada */}
      <mesh position={[-0.24, 0.033, 0]} rotation={[0, 0, -0.06]}>
        <boxGeometry args={[0.46, 0.006, 0.60]} />
        <meshStandardMaterial color="#FFFDF7" roughness={1} />
      </mesh>

      {/* Bloco de páginas direitas com curvatura suave */}
      <mesh position={[0.24, 0.016, 0]} rotation={[0, 0, 0.04]}>
        <boxGeometry args={[0.47, 0.026, 0.61]} />
        <meshStandardMaterial color="#FFF5E5" roughness={1} />
      </mesh>
      {/* Folha superior direita ligeiramente elevada */}
      <mesh position={[0.24, 0.033, 0]} rotation={[0, 0, 0.06]}>
        <boxGeometry args={[0.46, 0.006, 0.60]} />
        <meshStandardMaterial color="#FFFDF7" roughness={1} />
      </mesh>

      {/* Impressão sutil de linhas de texto nas páginas */}
      {[-0.18, -0.06, 0.06, 0.18].map((zOffset, i) => (
        <React.Fragment key={i}>
          {/* Linha esquerda */}
          <mesh position={[-0.24, 0.038, zOffset]} rotation={[0, 0, -0.06]}>
            <boxGeometry args={[0.34, 0.002, 0.03]} />
            <meshStandardMaterial color="#E2D4C0" roughness={1} />
          </mesh>
          {/* Linha direita */}
          <mesh position={[0.24, 0.038, zOffset]} rotation={[0, 0, 0.06]}>
            <boxGeometry args={[0.34, 0.002, 0.03]} />
            <meshStandardMaterial color="#E2D4C0" roughness={1} />
          </mesh>
        </React.Fragment>
      ))}

      {/* Sulco/Vinco central da lombada */}
      <mesh position={[0, 0.026, 0]}>
        <boxGeometry args={[0.016, 0.028, 0.61]} />
        <meshStandardMaterial color="#CEBFAB" roughness={1} />
      </mesh>

      {/* Fitilho de cetim pousado graciosamente na página direita */}
      <mesh position={[0.12, 0.044, 0.08]} rotation={[0, -0.28, 0.06]}>
        <boxGeometry args={[0.026, 0.005, 0.42]} />
        <meshStandardMaterial color="#B85F42" roughness={0.7} />
      </mesh>
      {/* Ponta do fitilho caindo além da borda */}
      <mesh position={[0.18, 0.026, 0.33]} rotation={[0.42, -0.15, 0]}>
        <boxGeometry args={[0.026, 0.005, 0.12]} />
        <meshStandardMaterial color="#B85F42" roughness={0.7} />
      </mesh>

      {/* Hit box transparente ampliada para clique confortável */}
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onPress();
        }}
        position={[0, 0.12, 0]}
      >
        <boxGeometry args={[1.20, 0.24, 0.82]} />
        <meshBasicMaterial depthWrite={false} opacity={0} transparent />
      </mesh>
    </group>
  );
}

function StackedBook({ book, index, onPress }: { book: Book; index: number; onPress: () => void }) {
  const group = useRef<Group>(null);
  const target = deskPosition(book, index);

  useFrame(() => {
    if (!group.current) return;
    group.current.position.x += (target[0] - group.current.position.x) * 0.14;
    group.current.position.y += (target[1] - group.current.position.y) * 0.14;
    group.current.position.z += (target[2] - group.current.position.z) * 0.14;
  });

  return (
    <group ref={group} position={target}>
      <ClosedBook book={book} />
      <mesh onClick={(event) => { event.stopPropagation(); onPress(); }} position={[0, 0.12, 0]}>
        <boxGeometry args={[1.24, 0.28, 0.86]} />
        <meshBasicMaterial depthWrite={false} opacity={0} transparent />
      </mesh>
    </group>
  );
}

function ShelfBook({ book, index, onPress }: { book: Book; index: number; onPress: () => void }) {
  const pos = shelfPosition(index,book);
  return (
    <group position={pos}>
      <ClosedBook book={book} upright />
      <mesh onClick={(event) => { event.stopPropagation(); onPress(); }} position={[0, 0.4, 0.2]}>
        <boxGeometry args={[0.4, 0.9, 0.6]} />
        <meshBasicMaterial depthWrite={false} opacity={0} transparent />
      </mesh>
    </group>
  );
}

function MovingBook({ book, start, end, onComplete }: { book: Book; start: Vector; end: Vector; onComplete: () => void }) {
  const group = useRef<Group>(null);
  const elapsed = useRef(0);
  const completed = useRef(false);

  useFrame((_, delta) => {
    if (!group.current || completed.current) return;
    elapsed.current += delta;
    const progress = Math.min(1, elapsed.current / 0.62);
    const eased = 1 - Math.pow(1 - progress, 3);
    group.current.position.set(
      start[0] + (end[0] - start[0]) * eased,
      start[1] + (end[1] - start[1]) * eased + Math.sin(progress * Math.PI) * 1.05,
      start[2] + (end[2] - start[2]) * eased,
    );
    group.current.rotation.z = eased * Math.PI * 0.5;
    group.current.rotation.y = eased * Math.PI * 0.08;
    if (progress === 1) {
      completed.current = true;
      onComplete();
    }
  });

  return <group ref={group} position={start}><ClosedBook book={book} /></group>;
}

function CoffeeMug() {
  const steamRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (!steamRef.current) return;
    const t = clock.elapsedTime;
    steamRef.current.children.forEach((child, i) => {
      const cycle = ((t * 0.7 + i * 0.45) % 1.5) / 1.5;
      child.position.y = 0.14 + cycle * 0.30;
      child.scale.setScalar(0.4 + cycle * 0.65);
    });
  });

  return (
    <group position={[0.43, 1.14, -0.40]}>
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.075, 0.065, 0.16, 14]} />
        <meshStandardMaterial color="#FAF5EE" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.145, 0]}>
        <cylinderGeometry args={[0.065, 0.065, 0.018, 12]} />
        <meshStandardMaterial color="#2B1D16" roughness={0.5} />
      </mesh>
      <mesh position={[-0.08, 0.08, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.04, 0.013, 8, 12, Math.PI * 1.3]} />
        <meshStandardMaterial color="#FAF5EE" roughness={0.8} />
      </mesh>
      <group ref={steamRef}>
        {[0, 1].map((i) => (
          <mesh key={i} position={[(i - 0.5) * 0.025, 0.12, 0]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshBasicMaterial color="#FFFFFF" depthWrite={false} opacity={0.2} transparent />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function AmbientDust({ isLampOn, opacity }: { isLampOn: boolean; opacity: number }) {
  const dustRef = useRef<Group>(null);

  // Partículas restritas estritamente ao raio de iluminação interno do quarto
  const positions: Vector[] = useMemo(() => [
    [-1.8, 1.1, -0.9],
    [-1.5, 1.6, -0.6],
    [-1.2, 0.9, -0.3],
    [-1.6, 2.0, -0.8],
    [-1.0, 1.4, 0.0],
    [-0.7, 1.2, 0.2],
    [-1.4, 1.3, -1.1],
    [-1.1, 1.8, -0.5],
    [-0.5, 1.5, 0.1],
    [-1.3, 0.8, -0.2],
    [-0.8, 1.7, -0.4],
    [-1.7, 1.5, -0.4],
    [-0.9, 1.1, 0.4],
    [-1.2, 2.1, -0.7],
  ], []);

  useFrame(({ clock }) => {
    if (!dustRef.current || !isLampOn) return;
    const t = clock.elapsedTime * 0.5;
    dustRef.current.children.forEach((child, i) => {
      child.position.y += Math.sin(t + i) * 0.002;
      child.position.x += Math.cos(t * 0.7 + i * 2) * 0.0015;
    });
  });

  if (!isLampOn) return null;

  return (
    <group ref={dustRef}>
      {positions.map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[0.022, 6, 6]} />
          <meshBasicMaterial
            blending={AdditiveBlending}
            color="#FFD685"
            depthWrite={false}
            opacity={opacity * (0.55 + (i % 3) * 0.25)}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

// Sombras projetadas e de contato no piso e tapete (stylized directional shadows)
function DeskContactShadows({
  hasActiveBook,
  hasStackedBooks,
}: {
  hasActiveBook: boolean;
  hasStackedBooks: boolean;
}) {
  return (
    <group position={[0.42, 1.144, 0.62]}>
      {/* Sombra botânica projetada da plantinha com florzinhas */}
      <group position={[-0.98, 0.002, -0.50]}>
        {/* Contato sob o vasinho */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.11, 16]} />
          <meshBasicMaterial color="#1E0E06" depthWrite={false} opacity={0.46} polygonOffset polygonOffsetFactor={-1.5} polygonOffsetUnits={-1.5} transparent />
        </mesh>

        {/* Projeção do corpo do vasinho para trás-esquerda */}
        <mesh position={[-0.06, 0, -0.06]} rotation={[-Math.PI / 2, 0, 0.78]}>
          <planeGeometry args={[0.14, 0.18]} />
          <meshBasicMaterial color="#241209" depthWrite={false} opacity={0.38} polygonOffset polygonOffsetFactor={-1.5} polygonOffsetUnits={-1.5} transparent />
        </mesh>

        {/* Projeção da haste da flor e botões florais */}
        <mesh position={[-0.12, 0, -0.12]} rotation={[-Math.PI / 2, 0, 0.78]}>
          <planeGeometry args={[0.03, 0.16]} />
          <meshBasicMaterial color="#221008" depthWrite={false} opacity={0.34} polygonOffset polygonOffsetFactor={-1.5} polygonOffsetUnits={-1.5} transparent />
        </mesh>
        <mesh position={[-0.16, 0, -0.16]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.055, 12]} />
          <meshBasicMaterial color="#241209" depthWrite={false} opacity={0.32} polygonOffset polygonOffsetFactor={-1.5} polygonOffsetUnits={-1.5} transparent />
        </mesh>
      </group>

      {/* Sombra sob o porta-canetas (contato e leve projeção) */}
      <group position={[-0.78, 0.002, -0.50]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.10, 16]} />
          <meshBasicMaterial color="#1E0E06" depthWrite={false} opacity={0.44} polygonOffset polygonOffsetFactor={-1.5} polygonOffsetUnits={-1.5} transparent />
        </mesh>
        <mesh position={[-0.04, 0, -0.04]} rotation={[-Math.PI / 2, 0, 0.78]}>
          <planeGeometry args={[0.10, 0.14]} />
          <meshBasicMaterial color="#241209" depthWrite={false} opacity={0.30} polygonOffset polygonOffsetFactor={-1.5} polygonOffsetUnits={-1.5} transparent />
        </mesh>
      </group>

      {/* Sombra sob a xícara de café (contato e leve projeção) */}
      <group position={[0.43, 0.002, -0.40]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.10, 16]} />
          <meshBasicMaterial color="#1E0E06" depthWrite={false} opacity={0.42} polygonOffset polygonOffsetFactor={-1.5} polygonOffsetUnits={-1.5} transparent />
        </mesh>
        <mesh position={[-0.04, 0, -0.04]} rotation={[-Math.PI / 2, 0, 0.78]}>
          <circleGeometry args={[0.10, 14]} />
          <meshBasicMaterial color="#241209" depthWrite={false} opacity={0.28} polygonOffset polygonOffsetFactor={-1.5} polygonOffsetUnits={-1.5} transparent />
        </mesh>
      </group>

      {/* Sombra sob o livro ativo aberto na mesa */}
      {hasActiveBook ? (
        <mesh position={[-0.34, 0.002, 0.09]} rotation={[-Math.PI / 2, 0, -0.08]}>
          <planeGeometry args={[1.08, 0.70]} />
          <meshBasicMaterial color="#1C0E05" depthWrite={false} opacity={0.40} polygonOffset polygonOffsetFactor={-1.5} polygonOffsetUnits={-1.5} transparent />
        </mesh>
      ) : null}

      {/* Sombra sob a pilha de livros na mesa */}
      {hasStackedBooks ? (
        <mesh position={[0.68, 0.002, 0.04]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.85, 0.60]} />
          <meshBasicMaterial color="#1C0E05" depthWrite={false} opacity={0.38} polygonOffset polygonOffsetFactor={-1.5} polygonOffsetUnits={-1.5} transparent />
        </mesh>
      ) : null}
    </group>
  );
}

// Acessórios e interação preservados sobre a mesa importada
function DeskDetails() {
  return (
    <group position={[0.42, 0, 0.62]}>
      {/* Porta-canetas elegante com caneta e lápis estilizados no fundo à esquerda */}
      <group position={[0.92, 1.17, -0.50]}>
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.085, 0.07, 0.16, 14]} />
          <meshStandardMaterial color="#5E705A" roughness={0.85} />
        </mesh>
        <mesh position={[-0.025, 0.17, 0.01]} rotation={[0.15, 0, -0.2]}>
          <cylinderGeometry args={[0.012, 0.012, 0.20, 8]} />
          <meshStandardMaterial color="#B95F3B" roughness={0.5} />
        </mesh>
        <mesh position={[0.025, 0.15, -0.02]} rotation={[-0.1, 0, 0.22]}>
          <cylinderGeometry args={[0.011, 0.011, 0.18, 8]} />
          <meshStandardMaterial color="#D4A359" roughness={0.9} />
        </mesh>
      </group>

      <CoffeeMug />

    </group>
  );
}

function RoomShell({ isLampOn, onToggleLamp, theme, isNight, wallPalette, floorPalette, onCatLoadingChange, catId, onFurnitureReady, onSceneError, onSceneReady, layout }: {
  isLampOn:boolean; onToggleLamp:()=>void; theme:(typeof AMBIENCE_THEMES)[ResolvedAmbience]; isNight:boolean;
  wallPalette:WallPalette; floorPalette:FloorPalette; catId:string; layout:RoomLayout;
  onCatLoadingChange?:(loading:boolean,catId:string)=>void; onFurnitureReady?:()=>void; onSceneError?:()=>void; onSceneReady?:()=>void;
}) {
  return (
    <>
      <hemisphereLight color={theme.ambientColor} groundColor={isNight ? "#34303C" : "#94816B"} intensity={theme.ambientIntensity} />
      <directionalLight color={theme.sunColor} intensity={theme.sunIntensity} position={theme.sunPosition} />

      {/* Sombra suave de projeção abaixo do diorama */}
      <mesh position={[0, -0.26, 0]}>
        <boxGeometry args={[7.35, 0.02, 7.55]} />
        <meshBasicMaterial color="#160E08" depthWrite={false} opacity={theme.floorShadowOpacity} transparent />
      </mesh>

      {/* Base sólida de madeira escura */}
      <mesh position={[0, -0.15, 0]}>
        <boxGeometry args={[7.35, 0.18, 7.55]} />
        <meshStandardMaterial color={floorPalette.baseColor} roughness={0.95} />
      </mesh>

      {/* Piso em madeira aconchegante */}
      <mesh position={[0, -0.04, 0]}>
        <boxGeometry args={[7.2, 0.1, 7.4]} />
        <meshStandardMaterial color={floorPalette.plankColor} roughness={0.92} />
      </mesh>

      {/* Frisos do assoalho */}
      {[-2.5, -1.25, 0, 1.25, 2.5].map((x) => (
        <mesh key={x} position={[x, 0.015, 0]}>
          <boxGeometry args={[0.025, 0.012, 7.1]} />
          <meshStandardMaterial color={floorPalette.grooveColor} roughness={0.95} />
        </mesh>
      ))}

      {/* Paredes alinhadas às bordas do piso, com o canto preenchido sem folgas. */}
      {/* Parede traseira: face externa em z = -3.70 e face interna em z = -3.54. */}
      <mesh position={[0.08, 1.755, -3.62]}>
        <boxGeometry args={[7.04, 3.5, 0.16]} />
        <meshStandardMaterial color={wallPalette.backWallColor} roughness={1} />
      </mesh>
      {/* Parede esquerda: acompanha o piso de z = -3.70 até z = +3.70. */}
      <mesh position={[-3.52, 1.755, 0]}>
        <boxGeometry args={[0.16, 3.5, 7.4]} />
        <meshStandardMaterial color={wallPalette.leftWallColor} roughness={1} />
      </mesh>
      {/* Acabamento ocupa exatamente a junção entre as duas paredes. */}
      <mesh position={[-3.52, 1.755, -3.62]}>
        <boxGeometry args={[0.16, 3.5, 0.16]} />
        <meshStandardMaterial color={wallPalette.cornerColor} roughness={1} />
      </mesh>

      <FurnitureAttachment piece={layout.pieces.find(p=>p.category==='desk')!} origin={DESK_ORIGIN}>
        <DeskDetails />
      </FurnitureAttachment>

      <SceneAssetBoundary onError={onSceneError}>
        <Suspense fallback={null}>
          <RoomFurniture
            layout={layout}
            isLampOn={isLampOn}
            isNight={isNight}
            onToggleLamp={onToggleLamp}
            theme={theme}
          />
          <FurnitureReadyNotifier key={layout.pieces.map(piece => piece.modelId).join('|')} onReady={onFurnitureReady} />
          <FirstFrameNotifier onReady={onSceneReady} />
        </Suspense>
      </SceneAssetBoundary>

      {/* Gatinho da sala com carregamento sob demanda e disfarce 3D procedural */}
      <SceneAssetBoundary onError={onSceneError}>
        <RoomPieceGroup piece={layout.pieces.find(p => p.category === 'cat')!}>
          <RoomCat catId={catId} positioned onLoadingChange={onCatLoadingChange} />
        </RoomPieceGroup>
      </SceneAssetBoundary>


      {/* Partículas de poeira dourada */}
      <AmbientDust isLampOn={isLampOn} opacity={theme.dustOpacity} />
    </>
  );
}

function RoomGeometry({
  onOpenBook,
  onSelectBook,
  onFurnitureReady,
  onSceneError,
  onSceneReady,
  rotationRef,
  zoomRef,
  theme,
  isNight,
  resolvedAmbience,
  onCatLoadingChange,
  isPro,
}: SceneProps & {
  rotationRef: React.MutableRefObject<RotationState>;
  zoomRef: React.MutableRefObject<ZoomState>;
  theme: (typeof AMBIENCE_THEMES)[ResolvedAmbience];
  isNight: boolean;
  resolvedAmbience: ResolvedAmbience;
  onCatLoadingChange?: (loading: boolean, catId: string) => void;
}) {
  const books = useLibraryStore((state) => state.books);
  const deskBookIds = useLibraryStore((state) => state.deskBookIds);
  const activeBookId = useLibraryStore((state) => state.activeBookId);
  const completingBookId = useLibraryStore((state) => state.completingBookId);
  const finalizeCompletion = useLibraryStore((state) => state.finalizeCompletion);
  const storeLampOn = useLibraryStore((state) => state.isLampOn);
  const isLampOn = isNight ? true : storeLampOn;
  const toggleLamp = useLibraryStore((state) => state.toggleLamp);
  const wallPaletteId = useLibraryStore((state) => state.wallPaletteId);
  const floorPaletteId = useLibraryStore((state) => state.floorPaletteId);
  const catId = useLibraryStore(state=>state.catId);
  const savedLayout = useLibraryStore(state=>state.roomLayout);
  const draft = useRoomEditor(state=>state.draft);
  const cameraMode = useRoomEditor(state=>state.cameraMode);
  const layout=draft??savedLayout;
  const desk=layout.pieces.find(p=>p.category==='desk')!;
  const bookcase=layout.pieces.find(p=>p.category==='bookcase')!;
  const appearance = useRoomEditor(state => state.appearance);
  const wallPalette=getWallPalette(appearance?.wallPaletteId ?? wallPaletteId);
  const floorPalette=getFloorPalette(appearance?.floorPaletteId ?? floorPaletteId);

  const roomGroup = useRef<Group>(null);

  // Rotação estritamente horizontal sem desvio de centro, e zoom suave
  useFrame(() => {
    if (!roomGroup.current) return;
    if (draft) {
      roomGroup.current.rotation.set(0, cameraMode ? rotationRef.current.targetY : 0, 0);
      roomGroup.current.scale.setScalar(zoomRef.current.target);
      roomGroup.current.position.set(0, 0, 0);
      return;
    }
    roomGroup.current.rotation.y += (rotationRef.current.targetY - roomGroup.current.rotation.y) * 0.12;
    roomGroup.current.rotation.x = 0;
    roomGroup.current.rotation.z = 0;

    // Zoom suave
    zoomRef.current.current += (zoomRef.current.target - zoomRef.current.current) * 0.12;
    const currentZoom = zoomRef.current.current;
    roomGroup.current.scale.set(currentZoom, currentZoom, currentZoom);

    // Centro ancorado perfeitamente em (0, 0, 0) sem drift
    roomGroup.current.position.set(0, 0, 0);
  });

  const handleToggleLamp = () => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleLamp();
  };

  const activeBook = completingBookId
    ? undefined
    : books.find((book) => book.id === activeBookId && deskBookIds.includes(book.id) && book.status === 'reading');
  const readingBooks = deskBookIds
    .map((bookId) => books.find((book) => book.id === bookId && book.id !== activeBook?.id && book.status === 'reading'))
    .filter((book): book is Book => Boolean(book));
  const completedBooks = books.filter((book) => book.status === 'completed');
  const movingBook = books.find((book) => book.id === completingBookId);

  return (
    <group ref={roomGroup}>
      <RoomShell layout={layout} floorPalette={floorPalette} wallPalette={wallPalette} isLampOn={isLampOn} isNight={isNight}
        catId={resolveRoomOptionId('cat',appearance?.catId ?? catId,isPro)} onCatLoadingChange={onCatLoadingChange} onFurnitureReady={onFurnitureReady}
        onSceneError={onSceneError} onSceneReady={onSceneReady} onToggleLamp={handleToggleLamp} theme={theme} />

      <FurnitureAttachment piece={desk} origin={DESK_ORIGIN}>
      {/* Sombras de contato sobre o tampo da mesa */}
      <DeskContactShadows
        hasActiveBook={Boolean(activeBook)}
        hasStackedBooks={readingBooks.length > 0}
      />

      {/* Livro ativo aberto sobre a mesa (renderizado SOMENTE quando houver livro em leitura) */}
      {activeBook ? (
        <OpenBook key={activeBook.id} color={activeBook.coverColor} onPress={() => { if (!draft) onOpenBook(activeBook.id); }} />
      ) : null}

      {/* Livros empilhados ao lado na mesa */}
      {readingBooks.map((book, index) => (
        <StackedBook key={book.id} book={book} index={index} onPress={() => { if (!draft) onSelectBook(book.id); }} />
      ))}

      </FurnitureAttachment>
      <FurnitureAttachment piece={bookcase} origin={BOOKCASE_ORIGIN}>
      {/* Livros concluídos na estante */}
      {completedBooks.map((book, index) => (
        <ShelfBook key={book.id} book={book} index={index} onPress={() => { if (!draft) onOpenBook(book.id); }} />
      ))}

      </FurnitureAttachment>
      {/* Livro flutuando em arco da mesa para a estante após conclusão */}
      {movingBook ? (
        <MovingBook
          book={movingBook}
          start={transformRoomPoint(OPEN_BOOK_POSITION,desk,DESK_ORIGIN)}
          end={transformRoomPoint(shelfPosition(completedBooks.length,movingBook),bookcase,BOOKCASE_ORIGIN)}
          onComplete={() => finalizeCompletion(movingBook.id)}
        />
      ) : null}
    </group>
  );
}

function FurnitureAttachment({ piece, origin, children }: { piece:RoomPiece; origin:Vector; children:React.ReactNode }) {
  return <group position={piece.position} rotation={[0,piece.rotation,0]}><group position={[-origin[0],-origin[1],-origin[2]]}>{children}</group></group>;
}

export function IsometricScene(props: SceneProps) {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const baseZoom = useMemo(() => Math.max(width / 8.8, height / 14.4), [height, width]);

  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const cycleAmbienceMode = useLibraryStore((state) => state.cycleAmbienceMode);
  const resolvedAmbience = resolveAmbience(ambienceMode);
  const [snapshotAmbienceOverride, setSnapshotAmbienceOverride] = useState<'day' | 'night' | null>(null);
  const effectiveAmbience = snapshotAmbienceOverride ?? resolvedAmbience;
  const currentTheme = AMBIENCE_THEMES[effectiveAmbience];
  const isNight = effectiveAmbience === 'night';
  const profile = useLibraryStore((state) => state.profile);
  const firstName = profile.name.trim().split(/\s+/)[0];
  const roomTitle = firstName && firstName !== 'Leitor(a)' ? `Quarto do ${firstName}` : 'Meu quarto';

  const [isActive, setIsActive] = useState(false);
  useFocusEffect(useCallback(() => {
    const updateActivity = () => setIsActive(AppState.currentState === 'active');
    updateActivity();
    const subscription = AppState.addEventListener('change', updateActivity);
    return () => {
      subscription.remove();
      setIsActive(false);
    };
  }, []));

  const invalidateRef = useRef<(frames?: number) => void>(() => {});
  const rotationRef = useRef<RotationState>({ targetY: 0 });
  const zoomRef = useRef<ZoomState>({ current: MIN_ZOOM, target: MIN_ZOOM });

  const editorDraft=useRoomEditor(state=>state.draft);
  const isEditing = Boolean(editorDraft);
  const [editorPanelHeight, setEditorPanelHeight] = useState(330);
  const editorViewportHeight = Math.max(120, height - insets.top - 76 - editorPanelHeight);
  const savedLayout = useLibraryStore(state => state.roomLayout);
  const modelKey = (editorDraft ?? savedLayout).pieces.map(piece => piece.modelId).join('|');
  const [loadedModelKey, setLoadedModelKey] = useState<string | null>(null);
  const [hasModified, setHasModified] = useState(false);
  const [panResponder, setPanResponder] = useState<ReturnType<typeof PanResponder.create> | null>(null);

  const [internalCustomizing, setInternalCustomizing] = useState(false);
  const isCustomizing = props.isCustomizing ?? internalCustomizing;
  const setIsCustomizing = (value: boolean) => {
    setInternalCustomizing(value);
    props.onCustomizingChange?.(value);
  };

  const isCustomizingRef = useRef(isCustomizing);

  const catId = useLibraryStore((state) => state.catId);
  const effectiveCatId = resolveRoomOptionId('cat', catId, props.isPro);
  const [catLoadingId, setCatLoadingId] = useState<string | null>(null);

  const handleCatLoadingChange = useCallback((loading: boolean, activeCatId: string) => {
    setCatLoadingId(loading ? activeCatId : null);
  }, []);

  useEffect(() => {
    if (isCustomizing) {
      const timer = setTimeout(() => {
        preloadCatModels(effectiveCatId);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [effectiveCatId, isCustomizing]);

  useEffect(() => {
    isCustomizingRef.current = isCustomizing;
  }, [isCustomizing]);

  const handleEnterCustomization = () => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    zoomRef.current.target = MIN_ZOOM;
    rotationRef.current.targetY = 0;
    setHasModified(false);
    const state = useLibraryStore.getState();
    useRoomEditor.getState().begin(state.roomLayout, {
      wallPaletteId: state.wallPaletteId,
      floorPaletteId: state.floorPaletteId,
      rugPaletteId: state.rugPaletteId,
      catId: state.catId,
    });
    setIsCustomizing(true);
    props.onCustomize?.();
  };

  const handleExitCustomization = () => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    zoomRef.current.target = MIN_ZOOM;
    setHasModified(false);
    setIsCustomizing(false);
  };

  useEffect(() => {
    let initialAngle = 0;
    let initialDistance = 0;
    let initialZoom = MIN_ZOOM;

    const responder = PanResponder.create({
      onStartShouldSetPanResponderCapture: evt => evt.nativeEvent.touches.length > 1,
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        if (useRoomEditor.getState().draft && !useRoomEditor.getState().cameraMode && evt.nativeEvent.touches.length < 2) return false;
        // Se estiver no modo de personalização e o gesto ocorrer no terço inferior da tela (área do seletor), nunca captura
        if (isCustomizingRef.current && !useRoomEditor.getState().draft && evt.nativeEvent.pageY > height - 260) {
          return false;
        }
        const touches = evt.nativeEvent.touches.length;
        return shouldHandleRoomCameraGesture(Boolean(useRoomEditor.getState().draft), useRoomEditor.getState().cameraMode, touches, gestureState.dx, gestureState.dy);
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        if (useRoomEditor.getState().draft && !useRoomEditor.getState().cameraMode && evt.nativeEvent.touches.length < 2) return false;
        // Se estiver no modo de personalização e o gesto ocorrer no terço inferior da tela (área do seletor), nunca captura
        if (isCustomizingRef.current && !useRoomEditor.getState().draft && evt.nativeEvent.pageY > height - 260) {
          return false;
        }
        const touches = evt.nativeEvent.touches.length;
        return shouldHandleRoomCameraGesture(Boolean(useRoomEditor.getState().draft), useRoomEditor.getState().cameraMode, touches, gestureState.dx, gestureState.dy);
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        initialAngle = rotationRef.current.targetY;
        const touches = evt.nativeEvent.touches;
        if (touches.length >= 2) {
          initialDistance = Math.hypot(
            touches[0].pageX - touches[1].pageX,
            touches[0].pageY - touches[1].pageY
          );
          initialZoom = zoomRef.current.target;
        } else {
          initialDistance = 0;
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        invalidateRef.current(2);
        if (touches.length >= 2 && initialDistance === 0) {
          initialDistance = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
          initialZoom = zoomRef.current.target;
          return;
        }
        if (touches.length < 2 && initialDistance > 0) {
          initialDistance = 0;
          initialAngle = rotationRef.current.targetY - gestureState.dx * 0.0048;
        }

        // Pinch-to-zoom com 2 dedos
        if (touches.length >= 2 && initialDistance > 0) {
          const currentDist = Math.hypot(
            touches[0].pageX - touches[1].pageX,
            touches[0].pageY - touches[1].pageY
          );
          const scale = currentDist / initialDistance;
          zoomRef.current.target = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, initialZoom * scale));
          setHasModified(
            Math.abs(rotationRef.current.targetY) > 0.04
              || Math.abs(zoomRef.current.target - MIN_ZOOM) > 0.05
          );
          return;
        }

        // Rotação estritamente horizontal simétrica com 1 dedo
        const sensitivity = 0.0048;
        const nextY = initialAngle + gestureState.dx * sensitivity;

        // Limita a rotação simetricamente sem expor o verso ou inverter
        rotationRef.current.targetY = Math.max(-ROTATION_LIMIT, Math.min(ROTATION_LIMIT, nextY));

        if (Math.abs(rotationRef.current.targetY) > 0.04 || Math.abs(zoomRef.current.target - MIN_ZOOM) > 0.05) {
          setHasModified(true);
        }
      },
    });

    setPanResponder(responder);
  }, [height]);

  const resetCamera = () => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    rotationRef.current.targetY = 0;
    zoomRef.current.target = MIN_ZOOM;
    setHasModified(false);
  };

  const handleCycleAmbience = () => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    cycleAmbienceMode();
  };

  const camera = useMemo(() => ({
    position: [6.7, 6.25, 7.4] as Vector,
    zoom: isEditing ? Math.min(width / 8.8, editorViewportHeight / 7.2) : baseZoom,
    near: 2,
    far: 32,
  }), [baseZoom, isEditing, editorViewportHeight, width]);

  const ambienceLabel = ambienceMode === 'auto' ? 'Automático' : AMBIENCE_META[ambienceMode].label;

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.bgColor }]}>
      {/* Camada exclusiva da cena 3D com captura de rotação e zoom isolada */}
      <View style={StyleSheet.absoluteFill} {...(panResponder?.panHandlers ?? {})}>
        <Canvas
          camera={camera}
          frameloop={!isActive ? 'never' : !editorDraft && loadedModelKey === modelKey ? 'always' : 'demand'}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
            preserveDrawingBuffer: true,
          }}
          onCreated={state => { invalidateRef.current = state.invalidate; props.onCanvasReady?.(); }}
          orthographic
          style={styles.canvas}
        >
          <RoomSnapshotRegistrar onSetAmbience={setSnapshotAmbienceOverride} />
          <color attach="background" args={[currentTheme.bgColor]} />
          <CameraRig width={width} height={height} zoom={camera.zoom} offsetY={isEditing ? (editorPanelHeight - insets.top - 76) / 2 : 0} />
          <RoomGeometry
            {...props}
            onFurnitureReady={() => {
              setLoadedModelKey(modelKey);
              props.onFurnitureReady?.();
            }}
            isNight={isNight}
            onCatLoadingChange={handleCatLoadingChange}
            resolvedAmbience={effectiveAmbience}
            rotationRef={rotationRef}
            theme={currentTheme}
            zoomRef={zoomRef}
          />
        </Canvas>
      </View>

      {editorDraft ? <RoomEditorPanel isNight={isNight} loadingCatId={catLoadingId} onHeightChange={setEditorPanelHeight} onClose={handleExitCustomization} /> : (
        <View style={[styles.cameraControlsWrap, { top: insets.top + 4 }]}>
          <View style={styles.controlsLeft}>
            <Pressable
              accessibilityHint="Altera a iluminação do quarto entre Dia, Pôr do Sol, Noite ou Automático"
              accessibilityLabel={`Iluminação: ${ambienceLabel}`}
              accessibilityRole="button"
              hitSlop={6}
              onPress={handleCycleAmbience}
              style={({ pressed }) => [
                styles.headerButton,
                isNight && styles.darkPill,
                pressed && styles.btnPressed,
              ]}
            >
              <Ionicons
                color={isNight ? darkTheme.accent : AMBIENCE_META[ambienceMode].color}
                name={AMBIENCE_META[ambienceMode].icon}
                size={18}
              />
            </Pressable>

            {/* Botão Restaurar */}
            {hasModified ? (
              <Pressable
                accessibilityLabel="Recentralizar câmera e rotação"
                accessibilityRole="button"
                hitSlop={6}
                onPress={resetCamera}
                style={({ pressed }) => [
                  styles.headerButton,
                  isNight && styles.darkPill,
                  pressed && styles.btnPressed,
                ]}
              >
                <Ionicons color={isNight ? darkTheme.accent : colors.terracotta} name="refresh" size={20} />
              </Pressable>
            ) : null}
          </View>

          <View pointerEvents="none" style={styles.roomTitleWrap}>
            <Text numberOfLines={1} style={[styles.roomTitle, isNight && styles.roomTitleNight]}>{roomTitle}</Text>
          </View>

          <View style={styles.controlsRight}>
            <Pressable
              accessibilityHint="Abre o modo interativo para personalizar cores e decoração da sala"
              accessibilityLabel="Personalizar quarto"
              accessibilityRole="button"
              hitSlop={8}
              onPress={handleEnterCustomization}
              style={({ pressed }) => [
                styles.headerButton,
                isNight && styles.darkPill,
                pressed && styles.btnPressed,
              ]}
            >
              <Ionicons color={isNight ? darkTheme.accent : colors.terracotta} name="color-palette-outline" size={22} />
            </Pressable>

            {props.onShare ? (
              <Pressable
                accessibilityHint="Compartilhar imagem do refúgio e estatísticas nos Stories ou redes"
                accessibilityLabel="Compartilhar refúgio"
                accessibilityRole="button"
                hitSlop={8}
                onPress={props.onShare}
                style={({ pressed }) => [
                  styles.headerButton,
                  isNight && styles.darkPill,
                  pressed && styles.btnPressed,
                ]}
              >
                <Ionicons color={isNight ? darkTheme.accent : colors.terracotta} name="share-social-outline" size={21} />
              </Pressable>
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  canvas: {
    flex: 1,
  },
  cameraControlsWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    pointerEvents: 'box-none',
  },
  controlsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: { ...controls.iconButton, backgroundColor: colors.paper, borderWidth: 1.25, borderColor: colors.line, boxShadow: '0 2px 8px rgba(53, 42, 36, 0.18)' },
  darkPill: {
    backgroundColor: darkTheme.surfaceElevated,
    borderColor: darkTheme.border,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.55)',
  },
  roomTitleWrap: {
    position: 'absolute',
    left: 104,
    right: 104,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomTitle: {
    color: colors.ink,
    fontFamily: typography.ui,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  roomTitleNight: {
    color: darkTheme.text,
  },
  btnPressed: {
    opacity: 0.6,
  },
});
