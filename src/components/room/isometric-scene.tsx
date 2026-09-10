/* eslint-disable react/no-unknown-property */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import * as Haptics from 'expo-haptics';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdditiveBlending, type Group, type OrthographicCamera, setConsoleFunction, Vector3 } from 'three';

import { Bookcase } from '@/src/components/room/bookcase';
import {
  CUSTOMIZATION_ANCHORS,
  RoomCustomizationOverlay,
  type ScreenAnchorPos,
} from '@/src/components/room/room-customization-overlay';
import { preloadCatModels, RoomCat } from '@/src/components/room/room-cat';
import { RoomFurniture } from '@/src/components/room/room-furniture';
import { RoomPictureFrame } from '@/src/components/room/room-picture-frame';
import { RoomPoster } from '@/src/components/room/room-poster';
import { RoomWindow } from '@/src/components/room/room-window';
import { type AmbienceMode, useLibraryStore } from '@/src/store/library-store';
import { colors } from '@/src/theme';
import type { Book } from '@/src/types/book';
import {
  getBookcasePalette,
  getFloorPalette,
  getRugPalette,
  getWallPalette,
  type BookcasePalette,
  type FloorPalette,
  type LeftWallItemType,
  type RugPalette,
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
  onAddBook: () => void;
  onCustomize?: () => void;
  onOpenBook: (bookId: string) => void;
  onSelectBook: (bookId: string) => void;
  isCustomizing?: boolean;
  onCustomizingChange?: (isCustomizing: boolean) => void;
  onSceneReady?: () => void;
};

type RotationState = {
  targetY: number;
};

type ZoomState = {
  current: number;
  target: number;
};

export type ResolvedAmbience = 'day' | 'sunset' | 'night';

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
  sunset: {
    bgColor: '#CBA288',
    ambientColor: '#FFDFC8',
    ambientIntensity: 1.2,
    sunColor: '#FF7E36',
    sunIntensity: 2.85,
    sunPosition: [6.0, 3.8, 3.8],
    lampColor: '#FFAE62',
    lampIntensity: 2.9,
    lampDistance: 6.8,
    coneOpacity: 0.065,
    dustOpacity: 0.48,
    floorShadowOpacity: 0.64,
  },
  night: {
    bgColor: '#131520',
    ambientColor: '#36476E', // Luz ambiente lunar suave que preserva a estante e mesa
    ambientIntensity: 0.65,
    sunColor: '#52689C',
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
  if (hour >= 6 && hour < 18) return 'day';
  if (hour >= 18 && hour < 20) return 'sunset';
  return 'night';
}

const AMBIENCE_META: Record<AmbienceMode, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  auto: { label: 'Auto', icon: 'time-outline', color: '#A36845' },
  day: { label: 'Dia', icon: 'sunny', color: '#D97706' },
  sunset: { label: 'Ocaso', icon: 'partly-sunny', color: '#C05621' },
  night: { label: 'Noite', icon: 'moon', color: '#818CF8' },
};

// Rotação horizontal simétrica estável sem oscilação
const ROTATION_LIMIT = 0.58; // ~33 graus cada lado
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 2.4;
const OPEN_BOOK_POSITION: Vector = [0.10, 1.20, 0.74];

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

const shelfPosition = (index: number): Vector => {
  const column = index % 4;
  const row = Math.floor(index / 4);
  return [0.88 + column * 0.38, 0.48 + row * 0.82, -2.61];
};

function CameraRig() {
  const camera = useThree((state) => state.camera as OrthographicCamera);

  useEffect(() => {
    camera.position.set(6.7, 6.25, 7.4);
    camera.lookAt(0, 1.08, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }, [camera]);

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

function ClosedBook({ book, upright = false }: { book: Book; upright?: boolean }) {
  const shape = bookShape(book.id);
  const color = book.coverColor;

  if (upright) {
    // Dimensões do livro em pé na estante:
    // x: espessura na prateleira (~0.14 a 0.20)
    // y: altura do livro (~0.57 a 0.70)
    // z: profundidade da estante (~0.31 a 0.38)
    const w = shape.thickness * 1.6;
    const h = shape.width * 0.82;
    const d = shape.depth * 0.68;
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
  const w = shape.width;
  const t = shape.thickness;
  const d = shape.depth;
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

      {/* Moldura nobre em relevo na capa superior */}
      <mesh position={[0.02, t / 2 + 0.002, 0]}>
        <boxGeometry args={[w * 0.82, 0.004, d * 0.82]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      <mesh position={[0.02, t / 2 + 0.004, 0]}>
        <boxGeometry args={[w * 0.76, 0.004, d * 0.76]} />
        <meshStandardMaterial color="#E8D5B5" roughness={0.9} />
      </mesh>

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
      position={[OPEN_BOOK_POSITION[0], OPEN_BOOK_POSITION[1] - 0.12, OPEN_BOOK_POSITION[2]]}
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
  const pos = shelfPosition(index);
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

function MovingBook({ book, end, onComplete }: { book: Book; end: Vector; onComplete: () => void }) {
  const group = useRef<Group>(null);
  const startedAt = useRef<number>(undefined);
  const completed = useRef(false);

  useFrame(({ clock }) => {
    if (!group.current || completed.current) return;
    startedAt.current ??= clock.elapsedTime;
    const progress = Math.min(1, (clock.elapsedTime - startedAt.current) / 0.62);
    const eased = 1 - Math.pow(1 - progress, 3);
    group.current.position.set(
      OPEN_BOOK_POSITION[0] + (end[0] - OPEN_BOOK_POSITION[0]) * eased,
      OPEN_BOOK_POSITION[1] + (end[1] - OPEN_BOOK_POSITION[1]) * eased + Math.sin(progress * Math.PI) * 1.05,
      OPEN_BOOK_POSITION[2] + (end[2] - OPEN_BOOK_POSITION[2]) * eased,
    );
    group.current.rotation.z = eased * Math.PI * 0.5;
    group.current.rotation.y = eased * Math.PI * 0.08;
    if (progress === 1) {
      completed.current = true;
      onComplete();
    }
  });

  return <group ref={group} position={OPEN_BOOK_POSITION}><ClosedBook book={book} /></group>;
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
function FloorContactShadows({ isNight }: { isNight: boolean }) {
  const baseOpacity = isNight ? 0.36 : 0.24;

  return (
    <group>
      {/* --- SOMBRAS AO NÍVEL DO PISO DE MADEIRA (Y = 0.024) --- */}

      {/* Sombra de oclusão da base da estante de livros (plinto de marcenaria X=1.45, Z=-2.60) */}
      <mesh position={[1.45, 0.024, -2.60]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.26, 0.72]} />
        <meshBasicMaterial color="#1A0D05" depthWrite={false} opacity={baseOpacity * 1.15} polygonOffset polygonOffsetFactor={-1.5} polygonOffsetUnits={-1.5} transparent />
      </mesh>

      {/* Sombra de contato suave do gatinho dormindo ao lado da mesa */}
      <mesh position={[2.10, 0.024, 1.40]} rotation={[-Math.PI / 2, 0, -0.75]}>
        <circleGeometry args={[0.50, 24]} />
        <meshBasicMaterial color="#1A0D05" depthWrite={false} opacity={baseOpacity * 1.05} polygonOffset polygonOffsetFactor={-1.5} polygonOffsetUnits={-1.5} transparent />
      </mesh>

      {/* Sombra suave e limpa da base da luminária de chão (restaurada para formato circular único) */}
      <mesh position={[-2.28, 0.024, -1.08]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.54, 24]} />
        <meshBasicMaterial color="#1E0E06" depthWrite={false} opacity={baseOpacity * 1.15} polygonOffset polygonOffsetFactor={-1.5} polygonOffsetUnits={-1.5} transparent />
      </mesh>

      {/* Sombra harmoniosa da planta de chão posicionada ao lado da estante de livros */}
      <group position={[0.10, 0.024, -2.80]}>
        {/* Contato sob o vaso */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.34, 28]} />
          <meshBasicMaterial color="#180A04" depthWrite={false} opacity={baseOpacity * 1.15} polygonOffset polygonOffsetFactor={-1.5} polygonOffsetUnits={-1.5} transparent />
        </mesh>
        {/* Projeção suave e sutil da copa para trás */}
        <mesh position={[-0.10, 0.001, -0.12]} rotation={[-Math.PI / 2, 0, -0.4]}>
          <circleGeometry args={[0.42, 24]} />
          <meshBasicMaterial color="#221107" depthWrite={false} opacity={baseOpacity * 0.65} polygonOffset polygonOffsetFactor={-1.5} polygonOffsetUnits={-1.5} transparent />
        </mesh>
      </group>

      {/* --- SOMBRAS AO NÍVEL DO TAPETE (Y = 0.060) --- */}

      {/* Sombra principal projetada pelo tampo da mesa sobre o tapete */}
      <mesh position={[0.22, 0.060, 0.38]} rotation={[-Math.PI / 2, 0, -0.06]}>
        <planeGeometry args={[2.50, 1.40]} />
        <meshBasicMaterial color="#221107" depthWrite={false} opacity={baseOpacity * 0.70} polygonOffset polygonOffsetFactor={-1.5} polygonOffsetUnits={-1.5} transparent />
      </mesh>

      {/* Sombras de contato suaves dos pés de apoio da mesa */}
      <mesh position={[-0.18, 0.060, 0.62]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.20, 1.05]} />
        <meshBasicMaterial color="#180A04" depthWrite={false} opacity={baseOpacity * 0.75} polygonOffset polygonOffsetFactor={-1.5} polygonOffsetUnits={-1.5} transparent />
      </mesh>
      <mesh position={[1.02, 0.060, 0.62]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.20, 1.05]} />
        <meshBasicMaterial color="#180A04" depthWrite={false} opacity={baseOpacity * 0.75} polygonOffset polygonOffsetFactor={-1.5} polygonOffsetUnits={-1.5} transparent />
      </mesh>

      {/* Sombra unificada de contato da banqueta sobre o tapete (sem efeito fantasma duplo) */}
      <mesh position={[0.42, 0.060, 1.70]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.38, 24]} />
        <meshBasicMaterial color="#180A04" depthWrite={false} opacity={baseOpacity * 0.85} polygonOffset polygonOffsetFactor={-1.5} polygonOffsetUnits={-1.5} transparent />
      </mesh>
    </group>
  );
}

// Sombras de contato e projeção sobre o tampo de madeira da mesa
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
function DeskDetails({
  isEmpty,
  onAddBook,
}: {
  isEmpty: boolean;
  onAddBook: () => void;
}) {
  return (
    <group position={[0.42, 0, 0.62]}>
      {/* Porta-canetas elegante com caneta e lápis estilizados no fundo à esquerda */}
      <group position={[-0.78, 1.17, -0.50]}>
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

      {/* Quando a mesa estiver limpa/vazia, toque nela abre para adicionar livro */}
      {isEmpty ? (
        <mesh
          onClick={(e) => {
            e.stopPropagation();
            onAddBook();
          }}
          position={[0, 1.18, 0]}
        >
          <boxGeometry args={[2.5, 0.2, 1.4]} />
          <meshBasicMaterial depthWrite={false} opacity={0} transparent />
        </mesh>
      ) : null}
    </group>
  );
}

function RoomShell({
  isLampOn,
  onToggleLamp,
  theme,
  isNight,
  isEmptyDesk,
  onAddBook,
  wallPalette,
  floorPalette,
  bookcasePalette,
  rugPalette,
  onCatLoadingChange,
  leftWallItem,
  leftWallWindowStyle,
  leftWallFrameColor,
  posterBook,
  resolvedAmbience,
  onSceneReady,
}: {
  isLampOn: boolean;
  onToggleLamp: () => void;
  theme: (typeof AMBIENCE_THEMES)[ResolvedAmbience];
  isNight: boolean;
  isEmptyDesk: boolean;
  onAddBook: () => void;
  wallPalette: WallPalette;
  floorPalette: FloorPalette;
  bookcasePalette: BookcasePalette;
  rugPalette: RugPalette;
  onCatLoadingChange?: (loading: boolean, catId: string) => void;
  leftWallItem: LeftWallItemType;
  leftWallWindowStyle: string;
  leftWallFrameColor: string;
  posterBook?: Book;
  resolvedAmbience: ResolvedAmbience;
  onSceneReady?: () => void;
}) {
  return (
    <>
      <ambientLight color={theme.ambientColor} intensity={theme.ambientIntensity} />
      <directionalLight color={theme.sunColor} intensity={theme.sunIntensity} position={theme.sunPosition} />

      {/* Sombra suave de projeção abaixo do diorama */}
      <mesh position={[0, -0.26, 0]}>
        <boxGeometry args={[7.5, 0.02, 7.7]} />
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

      {/* PAREDES COM ENCONTRO DE CANTO PERFEITO E COR PERSONALIZÁVEL */}
      {/* Parede traseira: termina exatamente em z = -3.42 e x = -3.60 */}
      <mesh position={[0, 1.65, -3.34]}>
        <boxGeometry args={[7.2, 3.5, 0.16]} />
        <meshStandardMaterial color={wallPalette.backWallColor} roughness={1} />
      </mesh>
      {/* Parede esquerda: começa exatamente em z = -3.42 e vai até o piso frontal z = +3.70 */}
      <mesh position={[-3.52, 1.65, 0.14]}>
        <boxGeometry args={[0.16, 3.5, 7.12]} />
        <meshStandardMaterial color={wallPalette.leftWallColor} roughness={1} />
      </mesh>
      {/* Coluna / acabamento de quina perfeita para emenda impecável */}
      <mesh position={[-3.52, 1.65, -3.34]}>
        <boxGeometry args={[0.165, 3.502, 0.165]} />
        <meshStandardMaterial color={wallPalette.cornerColor} roughness={1} />
      </mesh>

      {/* Decoração da Parede Esquerda: Janela procedural ou Pôster de leitura emoldurado */}
      {leftWallItem === 'window' ? (
        <RoomWindow
          ambience={resolvedAmbience}
          styleId={leftWallWindowStyle}
        />
      ) : null}
      {leftWallItem === 'poster' ? (
        <RoomPoster
          book={posterBook}
          frameId={leftWallFrameColor}
        />
      ) : null}

      {/* Quadro de Parede Personalizável (Fotos locais, formatos 1:1 e 1:2) */}
      <RoomPictureFrame />

      {/* Tapete circular aconchegante */}
      <mesh position={[0.42, 0.025, 1.05]}>
        <cylinderGeometry args={[1.85, 1.85, 0.035, 32]} />
        <meshStandardMaterial color={rugPalette.mainColor} roughness={1} />
      </mesh>
      <mesh position={[0.42, 0.048, 1.05]}>
        <cylinderGeometry args={[1.45, 1.45, 0.012, 32]} />
        <meshStandardMaterial color={rugPalette.innerColor} roughness={1} />
      </mesh>

      {/* Sombras projetadas e de contato (piso, plantas e tapete) */}
      <FloorContactShadows isNight={isNight} />

      {/* Acessórios e interação da mesa de estudo */}
      <DeskDetails isEmpty={isEmptyDesk} onAddBook={onAddBook} />

      <Suspense fallback={null}>
        <RoomFurniture
          isLampOn={isLampOn}
          isNight={isNight}
          onToggleLamp={onToggleLamp}
          theme={theme}
        />
        <FirstFrameNotifier onReady={onSceneReady} />
      </Suspense>

      {/* Gatinho da sala com carregamento sob demanda e disfarce 3D procedural */}
      <RoomCat onLoadingChange={onCatLoadingChange} />

      {/* Estante de livros profissional e completa com marcenaria artesanal */}
      <Bookcase palette={bookcasePalette} />

      {/* Partículas de poeira dourada */}
      <AmbientDust isLampOn={isLampOn} opacity={theme.dustOpacity} />
    </>
  );
}

function RoomGeometry({
  onAddBook,
  onOpenBook,
  onSelectBook,
  onSceneReady,
  rotationRef,
  zoomRef,
  theme,
  isNight,
  resolvedAmbience,
  isCustomizing,
  onUpdateAnchorPositions,
  onCatLoadingChange,
}: SceneProps & {
  rotationRef: React.MutableRefObject<RotationState>;
  zoomRef: React.MutableRefObject<ZoomState>;
  theme: (typeof AMBIENCE_THEMES)[ResolvedAmbience];
  isNight: boolean;
  resolvedAmbience: ResolvedAmbience;
  isCustomizing?: boolean;
  onUpdateAnchorPositions?: (anchors: Record<string, ScreenAnchorPos>) => void;
  onCatLoadingChange?: (loading: boolean, catId: string) => void;
}) {
  const books = useLibraryStore((state) => state.books);
  const activeBookId = useLibraryStore((state) => state.activeBookId);
  const completingBookId = useLibraryStore((state) => state.completingBookId);
  const finalizeCompletion = useLibraryStore((state) => state.finalizeCompletion);
  const isLampOn = useLibraryStore((state) => state.isLampOn);
  const toggleLamp = useLibraryStore((state) => state.toggleLamp);
  const wallPaletteId = useLibraryStore((state) => state.wallPaletteId);
  const wallPalette = getWallPalette(wallPaletteId);
  const floorPaletteId = useLibraryStore((state) => state.floorPaletteId);
  const floorPalette = getFloorPalette(floorPaletteId);
  const bookcasePaletteId = useLibraryStore((state) => state.bookcasePaletteId);
  const bookcasePalette = getBookcasePalette(bookcasePaletteId);
  const rugPaletteId = useLibraryStore((state) => state.rugPaletteId);
  const rugPalette = getRugPalette(rugPaletteId);
  const leftWallItem = useLibraryStore((state) => state.leftWallItem);
  const leftWallPosterBookId = useLibraryStore((state) => state.leftWallPosterBookId);
  const leftWallWindowStyle = useLibraryStore((state) => state.leftWallWindowStyle);
  const leftWallFrameColor = useLibraryStore((state) => state.leftWallFrameColor);

  const roomGroup = useRef<Group>(null);
  const { camera, size } = useThree();
  const lastAnchorMap = useRef<Record<string, ScreenAnchorPos>>({});
  const tempVec = useMemo(() => new Vector3(), []);

  // Rotação estritamente horizontal sem desvio de centro, e zoom suave
  useFrame(() => {
    if (!roomGroup.current) return;
    roomGroup.current.rotation.y += (rotationRef.current.targetY - roomGroup.current.rotation.y) * 0.12;
    roomGroup.current.rotation.x = 0;
    roomGroup.current.rotation.z = 0;

    // Zoom suave
    zoomRef.current.current += (zoomRef.current.target - zoomRef.current.current) * 0.12;
    const currentZoom = zoomRef.current.current;
    roomGroup.current.scale.set(currentZoom, currentZoom, currentZoom);

    // Centro ancorado perfeitamente em (0, 0, 0) sem drift
    roomGroup.current.position.set(0, 0, 0);

    // Atualiza projeção de tela dos âncoras no modo de personalização
    if (isCustomizing && onUpdateAnchorPositions) {
      roomGroup.current.updateMatrixWorld(true);
      const nextMap: Record<string, ScreenAnchorPos> = {};
      let hasShifted = false;

      for (const anchor of CUSTOMIZATION_ANCHORS) {
        tempVec.set(...anchor.pos);
        roomGroup.current.localToWorld(tempVec);
        tempVec.project(camera);
        const px = ((tempVec.x + 1) / 2) * size.width;
        const py = ((-tempVec.y + 1) / 2) * size.height;
        nextMap[anchor.id] = { x: px, y: py };

        const prev = lastAnchorMap.current[anchor.id];
        if (!prev || Math.abs(prev.x - px) > 0.5 || Math.abs(prev.y - py) > 0.5) {
          hasShifted = true;
        }
      }

      if (hasShifted) {
        lastAnchorMap.current = nextMap;
        onUpdateAnchorPositions(nextMap);
      }
    }
  });

  const handleToggleLamp = () => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleLamp();
  };

  const activeBook = completingBookId
    ? undefined
    : books.find((book) => book.id === activeBookId && book.status === 'reading')
      ?? [...books].reverse().find((book) => book.status === 'reading');
  const readingBooks = books.filter((book) => book.status === 'reading' && book.id !== activeBook?.id);
  const completedBooks = books.filter((book) => book.status === 'completed');
  const movingBook = books.find((book) => book.id === completingBookId);

  const posterBook = useMemo(() => {
    if (leftWallItem !== 'poster') return undefined;
    if (leftWallPosterBookId) {
      const found = books.find((book) => book.id === leftWallPosterBookId);
      if (found) return found;
    }
    return completedBooks[0] ?? readingBooks[0] ?? activeBook ?? books[0];
  }, [activeBook, books, completedBooks, leftWallItem, leftWallPosterBookId, readingBooks]);

  // Mesa limpa quando 0 livros estiverem em leitura
  const isEmptyDesk = !activeBook && readingBooks.length === 0;

  return (
    <group ref={roomGroup}>
      <RoomShell
        bookcasePalette={bookcasePalette}
        floorPalette={floorPalette}
        isEmptyDesk={isEmptyDesk}
        isLampOn={isLampOn}
        isNight={isNight}
        leftWallFrameColor={leftWallFrameColor}
        leftWallItem={leftWallItem}
        leftWallWindowStyle={leftWallWindowStyle}
        onAddBook={onAddBook}
        onCatLoadingChange={onCatLoadingChange}
        onSceneReady={onSceneReady}
        onToggleLamp={handleToggleLamp}
        posterBook={posterBook}
        resolvedAmbience={resolvedAmbience}
        rugPalette={rugPalette}
        theme={theme}
        wallPalette={wallPalette}
      />

      {/* Sombras de contato sobre o tampo da mesa */}
      <DeskContactShadows
        hasActiveBook={Boolean(activeBook)}
        hasStackedBooks={readingBooks.length > 0}
      />

      {/* Livro ativo aberto sobre a mesa (renderizado SOMENTE quando houver livro em leitura) */}
      {activeBook ? (
        <OpenBook key={activeBook.id} color={activeBook.coverColor} onPress={() => onOpenBook(activeBook.id)} />
      ) : null}

      {/* Livros empilhados ao lado na mesa */}
      {readingBooks.map((book, index) => (
        <StackedBook key={book.id} book={book} index={index} onPress={() => onSelectBook(book.id)} />
      ))}

      {/* Livros concluídos na estante */}
      {completedBooks.map((book, index) => (
        <ShelfBook key={book.id} book={book} index={index} onPress={() => onOpenBook(book.id)} />
      ))}

      {/* Livro flutuando em arco da mesa para a estante após conclusão */}
      {movingBook ? (
        <MovingBook
          book={movingBook}
          end={shelfPosition(completedBooks.length)}
          onComplete={() => finalizeCompletion(movingBook.id)}
        />
      ) : null}
    </group>
  );
}

export function IsometricScene(props: SceneProps) {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const baseZoom = useMemo(() => Math.max(width / 7.2, height / 11.8), [height, width]);

  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const cycleAmbienceMode = useLibraryStore((state) => state.cycleAmbienceMode);
  const resolvedAmbience = resolveAmbience(ambienceMode);
  const currentTheme = AMBIENCE_THEMES[resolvedAmbience];
  const isNight = resolvedAmbience === 'night';

  const rotationRef = useRef<RotationState>({ targetY: 0 });
  const zoomRef = useRef<ZoomState>({ current: 1.0, target: 1.0 });

  const [hasModified, setHasModified] = useState(false);
  const [panResponder, setPanResponder] = useState<ReturnType<typeof PanResponder.create> | null>(null);

  const [internalCustomizing, setInternalCustomizing] = useState(false);
  const isCustomizing = props.isCustomizing ?? internalCustomizing;
  const setIsCustomizing = (value: boolean) => {
    setInternalCustomizing(value);
    props.onCustomizingChange?.(value);
  };

  const [anchorPositions, setAnchorPositions] = useState<Record<string, ScreenAnchorPos>>({});
  const isCustomizingRef = useRef(isCustomizing);

  const catId = useLibraryStore((state) => state.catId);
  const [catLoadingId, setCatLoadingId] = useState<string | null>(null);

  const handleCatLoadingChange = useCallback((loading: boolean, activeCatId: string) => {
    setCatLoadingId(loading ? activeCatId : null);
  }, []);

  useEffect(() => {
    if (isCustomizing) {
      const timer = setTimeout(() => {
        preloadCatModels(catId);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isCustomizing, catId]);

  useEffect(() => {
    isCustomizingRef.current = isCustomizing;
  }, [isCustomizing]);

  const handleEnterCustomization = () => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    zoomRef.current.target = MIN_ZOOM;
    rotationRef.current.targetY = 0;
    setHasModified(true);
    setIsCustomizing(true);
    props.onCustomize?.();
  };

  const handleExitCustomization = () => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    zoomRef.current.target = 1.0;
    setHasModified(false);
    setIsCustomizing(false);
  };

  useEffect(() => {
    let initialAngle = 0;
    let initialDistance = 0;
    let initialZoom = 1.0;

    const responder = PanResponder.create({
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        // Se estiver no modo de personalização e o gesto ocorrer no terço inferior da tela (área do seletor), nunca captura
        if (isCustomizingRef.current && evt.nativeEvent.pageY > height - 260) {
          return false;
        }
        return Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6;
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Se estiver no modo de personalização e o gesto ocorrer no terço inferior da tela (área do seletor), nunca captura
        if (isCustomizingRef.current && evt.nativeEvent.pageY > height - 260) {
          return false;
        }
        return Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6;
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

        // Pinch-to-zoom com 2 dedos
        if (touches.length >= 2 && initialDistance > 0) {
          const currentDist = Math.hypot(
            touches[0].pageX - touches[1].pageX,
            touches[0].pageY - touches[1].pageY
          );
          const scale = currentDist / initialDistance;
          zoomRef.current.target = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, initialZoom * scale));
          setHasModified(true);
          return;
        }

        // Rotação estritamente horizontal simétrica com 1 dedo
        const sensitivity = 0.0048;
        const nextY = initialAngle + gestureState.dx * sensitivity;

        // Limita a rotação simetricamente sem expor o verso ou inverter
        rotationRef.current.targetY = Math.max(-ROTATION_LIMIT, Math.min(ROTATION_LIMIT, nextY));

        if (Math.abs(rotationRef.current.targetY) > 0.04 || Math.abs(zoomRef.current.target - 1.0) > 0.05) {
          setHasModified(true);
        }
      },
    });

    setPanResponder(responder);
  }, [height]);

  const handleZoomIn = () => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    zoomRef.current.target = Math.min(MAX_ZOOM, zoomRef.current.target + 0.28);
    setHasModified(true);
  };

  const handleZoomOut = () => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    zoomRef.current.target = Math.max(MIN_ZOOM, zoomRef.current.target - 0.28);
    setHasModified(true);
  };

  const resetCamera = () => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    rotationRef.current.targetY = 0;
    zoomRef.current.target = 1.0;
    setHasModified(false);
  };

  const handleCycleAmbience = () => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    cycleAmbienceMode();
  };

  const camera = useMemo(() => ({
    position: [6.7, 6.25, 7.4] as Vector,
    zoom: baseZoom,
    near: 2,
    far: 32,
  }), [baseZoom]);

  const ambienceLabel = ambienceMode === 'auto' ? 'Automático' : AMBIENCE_META[ambienceMode].label;

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.bgColor }]}>
      {/* Camada exclusiva da cena 3D com captura de rotação e zoom isolada */}
      <View style={StyleSheet.absoluteFill} {...(panResponder?.panHandlers ?? {})}>
        <Canvas
          camera={camera}
          frameloop="always"
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          orthographic
          style={styles.canvas}
        >
          <color attach="background" args={[currentTheme.bgColor]} />
          <FirstFrameNotifier onReady={props.onSceneReady} />
          <CameraRig />
          <RoomGeometry
            {...props}
            isCustomizing={isCustomizing}
            isNight={isNight}
            onCatLoadingChange={handleCatLoadingChange}
            onUpdateAnchorPositions={setAnchorPositions}
            resolvedAmbience={resolvedAmbience}
            rotationRef={rotationRef}
            theme={currentTheme}
            zoomRef={zoomRef}
          />
        </Canvas>
      </View>

      {/* Modo de Personalização com Pins 3D e Tooltips Flutuantes */}
      {isCustomizing ? (
        <RoomCustomizationOverlay
          anchorPositions={anchorPositions}
          isNight={isNight}
          loadingCatId={catLoadingId}
          onExit={handleExitCustomization}
        />
      ) : (
        /* Controles Flutuantes Superiores: Zoom, Ambiência, Restaurar e Adicionar Livro */
        <View style={[styles.cameraControlsWrap, { top: insets.top + (process.env.EXPO_OS === 'android' ? 12 : 8) }]}>
          <View style={styles.controlsLeft}>
            <View style={[styles.controlPill, isNight && styles.darkPill]}>
              <Pressable
                accessibilityLabel="Aumentar zoom"
                accessibilityRole="button"
                hitSlop={6}
                onPress={handleZoomIn}
                style={({ pressed }) => [styles.iconBtn, pressed && styles.btnPressed]}
              >
                <Ionicons color={isNight ? '#F5E8D3' : colors.ink} name="add" size={18} />
              </Pressable>

              <View style={[styles.divider, isNight && styles.dividerDark]} />

              <Pressable
                accessibilityLabel="Diminuir zoom"
                accessibilityRole="button"
                hitSlop={6}
                onPress={handleZoomOut}
                style={({ pressed }) => [styles.iconBtn, pressed && styles.btnPressed]}
              >
                <Ionicons color={isNight ? '#F5E8D3' : colors.ink} name="remove" size={18} />
              </Pressable>
            </View>

            {/* Botão de Ambiência (ícone) */}
            <Pressable
              accessibilityHint="Altera a iluminação do quarto entre Dia, Pôr do Sol, Noite ou Automático"
              accessibilityLabel={`Iluminação: ${ambienceLabel}`}
              accessibilityRole="button"
              hitSlop={6}
              onPress={handleCycleAmbience}
              style={({ pressed }) => [
                styles.iconPillBtn,
                isNight && styles.darkPill,
                pressed && styles.btnPressed,
              ]}
            >
              <Ionicons
                color={isNight && ambienceMode === 'night' ? '#FFAE70' : AMBIENCE_META[ambienceMode].color}
                name={ambienceMode === 'auto' ? (resolvedAmbience === 'night' ? 'moon' : resolvedAmbience === 'sunset' ? 'partly-sunny' : 'sunny') : AMBIENCE_META[ambienceMode].icon}
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
                  styles.iconPillBtn,
                  isNight && styles.darkPill,
                  pressed && styles.btnPressed,
                ]}
              >
                <Ionicons color={isNight ? '#F5E8D3' : colors.ink} name="refresh" size={17} />
              </Pressable>
            ) : null}
          </View>

          {/* Controles no Topo Direito: Personalizar e Adicionar Livro */}
          <View style={styles.controlsRight}>
            <Pressable
              accessibilityHint="Abre o modo interativo para personalizar cores e decoração da sala"
              accessibilityLabel="Personalizar quarto"
              accessibilityRole="button"
              hitSlop={8}
              onPress={handleEnterCustomization}
              style={({ pressed }) => [
                styles.iconPillBtn,
                isNight && styles.darkPill,
                pressed && styles.btnPressed,
              ]}
            >
              <Ionicons color={isNight ? '#FFAE70' : colors.terracotta} name="color-palette-outline" size={20} />
            </Pressable>

            {props.onAddBook ? (
              <Pressable
                accessibilityHint="Abre a tela para adicionar novo livro à biblioteca"
                accessibilityLabel="Adicionar livro"
                accessibilityRole="button"
                hitSlop={8}
                onPress={props.onAddBook}
                style={({ pressed }) => [
                  styles.iconPillBtn,
                  isNight && styles.darkPill,
                  pressed && styles.btnPressed,
                ]}
              >
                <Ionicons color={isNight ? '#FFAE70' : colors.terracotta} name="add" size={24} />
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
  controlPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 19,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255, 249, 240, 0.94)',
    borderWidth: 1,
    borderColor: colors.line,
    boxShadow: '0 2px 8px rgba(53, 42, 36, 0.12)',
    overflow: 'hidden',
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    width: 1,
    height: 18,
    backgroundColor: colors.line,
  },
  iconPillBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255, 249, 240, 0.94)',
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(53, 42, 36, 0.12)',
  },
  darkPill: {
    backgroundColor: 'rgba(26, 28, 40, 0.94)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.45)',
  },
  dividerDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  btnPressed: {
    opacity: 0.6,
  },
});
