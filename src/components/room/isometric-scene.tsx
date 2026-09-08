/* eslint-disable react/no-unknown-property */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdditiveBlending, DoubleSide, type Group, type OrthographicCamera } from 'three';

import { type AmbienceMode, useLibraryStore } from '@/src/store/library-store';
import { colors } from '@/src/theme';
import type { Book } from '@/src/types/book';

type Vector = [number, number, number];
type SceneProps = {
  onAddBook: () => void;
  onOpenBook: (bookId: string) => void;
  onSelectBook: (bookId: string) => void;
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
const OPEN_BOOK_POSITION: Vector = [-0.08, 1.3, 0.72];

const bookShape = (id: string) => {
  const score = [...id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return {
    width: 0.92 + (score % 4) * 0.08,
    thickness: 0.12 + (score % 3) * 0.025,
    depth: 0.58 + (score % 5) * 0.025,
    rotation: ((score % 7) - 3) * 0.018,
  };
};

const deskPosition = (book: Book, index: number): Vector => {
  const shape = bookShape(book.id);
  return [
    0.96 + ((index % 3) - 1) * 0.025,
    1.27 + index * 0.155 + shape.thickness / 2,
    0.42 + ((index % 2) * 2 - 1) * 0.018,
  ];
};

const shelfPosition = (index: number): Vector => {
  const column = index % 4;
  const row = Math.floor(index / 4);
  return [0.95 + column * 0.4, 0.48 + row * 0.82, -2.34];
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

function ClosedBook({ book, upright = false }: { book: Book; upright?: boolean }) {
  const shape = bookShape(book.id);
  const size: Vector = upright
    ? [shape.thickness * 1.6, shape.width * 0.82, shape.depth * 0.68]
    : [shape.width, shape.thickness, shape.depth];

  return (
    <group rotation={upright ? [0, 0, shape.rotation * 3] : [0, shape.rotation, 0]}>
      <mesh>
        <boxGeometry args={size} />
        <meshStandardMaterial color={book.coverColor} roughness={0.9} />
      </mesh>
      <mesh position={upright ? [0, 0, size[2] / 2 + 0.006] : [0, size[1] / 2 + 0.006, 0]}>
        <boxGeometry args={upright ? [size[0] * 0.72, size[1] * 0.88, 0.012] : [size[0] * 0.82, 0.012, size[2] * 0.82]} />
        <meshStandardMaterial color="#F5E9D5" roughness={1} />
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
    <group ref={group} position={[OPEN_BOOK_POSITION[0], OPEN_BOOK_POSITION[1] - 0.12, OPEN_BOOK_POSITION[2]]} rotation={[0, -0.12, 0]} scale={[0.86, 0.86, 0.86]}>
      <mesh position={[-0.37, 0, 0]} rotation={[0, 0, -0.035]}>
        <boxGeometry args={[0.75, 0.045, 0.9]} />
        <meshStandardMaterial color={color} roughness={0.92} />
      </mesh>
      <mesh position={[0.37, 0, 0]} rotation={[0, 0, 0.035]}>
        <boxGeometry args={[0.75, 0.045, 0.9]} />
        <meshStandardMaterial color={color} roughness={0.92} />
      </mesh>
      <mesh position={[-0.35, 0.055, 0]} rotation={[0, 0, -0.055]}>
        <boxGeometry args={[0.69, 0.035, 0.84]} />
        <meshStandardMaterial color="#FFF5E5" roughness={1} />
      </mesh>
      <mesh position={[0.35, 0.055, 0]} rotation={[0, 0, 0.055]}>
        <boxGeometry args={[0.69, 0.035, 0.84]} />
        <meshStandardMaterial color="#FFF5E5" roughness={1} />
      </mesh>
      <mesh position={[0, 0.075, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.84, 8]} />
        <meshStandardMaterial color="#D9C7AB" roughness={1} />
      </mesh>
      <mesh position={[0.08, 0.08, 0.44]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[0.04, 0.01, 0.22]} />
        <meshStandardMaterial color="#B85F42" roughness={0.9} />
      </mesh>
      <mesh onClick={(event) => { event.stopPropagation(); onPress(); }} position={[0, 0.16, 0]}>
        <boxGeometry args={[1.72, 0.3, 1.12]} />
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

function FloorLamp({
  isOn,
  onToggle,
  theme,
  isNight,
}: {
  isOn: boolean;
  onToggle: () => void;
  theme: (typeof AMBIENCE_THEMES)[ResolvedAmbience];
  isNight: boolean;
}) {
  return (
    <group position={[-2.28, 0, -1.08]}>
      {/* Base sólida de metal escovado */}
      <mesh position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.38, 0.44, 0.12, 16]} />
        <meshStandardMaterial color="#453830" roughness={0.9} />
      </mesh>
      {/* Haste metálica */}
      <mesh position={[0, 1.28, 0]}>
        <cylinderGeometry args={[0.045, 0.055, 2.45, 10]} />
        <meshStandardMaterial color="#58483E" roughness={0.85} />
      </mesh>
      {/* Cúpula do abajur com brilho acolhedor à noite */}
      <mesh position={[0, 2.45, 0]}>
        <coneGeometry args={[0.48, 0.65, 18, 1, true]} />
        <meshStandardMaterial
          color={isOn ? '#E69C72' : '#8A7060'}
          emissive={isOn ? (isNight ? '#FF9A4D' : '#FFAE70') : '#000000'}
          emissiveIntensity={isOn ? (isNight ? 0.95 : 0.4) : 0}
          roughness={0.9}
          side={DoubleSide}
        />
      </mesh>
      {/* Bulbo da lâmpada */}
      <mesh position={[0, 2.35, 0]}>
        <sphereGeometry args={[0.09, 10, 10]} />
        <meshBasicMaterial color={isOn ? '#FFF7DE' : '#5E4E42'} />
      </mesh>

      {isOn ? (
        <>
          {/* Luz focal quente emanada do abajur, posicionada levemente para o interior da sala */}
          <pointLight
            color={theme.lampColor}
            distance={theme.lampDistance}
            intensity={theme.lampIntensity}
            position={[0.35, 2.15, 0.35]}
          />
          {/* Luz suave de preenchimento quente direcionada para a escrivaninha e estante */}
          <pointLight
            color="#FF9E48"
            distance={8.2}
            intensity={theme.lampIntensity * 0.42}
            position={[0.9, 1.7, 0.8]}
          />

          {/* Feixe volumétrico acolhedor com AdditiveBlending (elimina aspecto cinza fosco) */}
          <mesh position={[0, 1.15, 0]}>
            <cylinderGeometry args={[0.16, 1.48, 2.15, 24, 1, true]} />
            <meshBasicMaterial
              blending={AdditiveBlending}
              color="#FF9636"
              depthWrite={false}
              opacity={theme.coneOpacity}
              side={DoubleSide}
              transparent
            />
          </mesh>

          {/* Poça de luz quente acolhedora projetada no chão e tapete sob o abajur */}
          <mesh position={[0.2, 0.02, 0.15]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[1.55, 24]} />
            <meshBasicMaterial
              blending={AdditiveBlending}
              color="#FFA245"
              depthWrite={false}
              opacity={isNight ? 0.32 : 0.14}
              transparent
            />
          </mesh>
        </>
      ) : null}

      {/* Hitbox ampliada para alternar o abajur */}
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        position={[0, 1.3, 0]}
      >
        <cylinderGeometry args={[0.55, 0.55, 2.7, 8]} />
        <meshBasicMaterial depthWrite={false} opacity={0} transparent />
      </mesh>
    </group>
  );
}

function DeskPlant() {
  return (
    <group position={[-0.78, 1.14, -0.42]}>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.15, 0.11, 0.2, 12]} />
        <meshStandardMaterial color="#B85F42" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.165, 0.165, 0.035, 12]} />
        <meshStandardMaterial color="#A45136" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.19, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.02, 12]} />
        <meshStandardMaterial color="#3E2B20" roughness={1} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => {
        const angle = (i * Math.PI * 2) / 5;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * 0.07, 0.23, Math.sin(angle) * 0.07]}
            rotation={[Math.sin(angle) * 0.35, -angle, Math.cos(angle) * 0.35]}
          >
            <sphereGeometry args={[0.065, 8, 8]} />
            <meshStandardMaterial color="#5E7D5A" roughness={0.8} />
          </mesh>
        );
      })}
    </group>
  );
}

function CoffeeMug() {
  const steamRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (!steamRef.current) return;
    const t = clock.elapsedTime;
    steamRef.current.children.forEach((child, i) => {
      const cycle = ((t * 0.7 + i * 0.45) % 1.5) / 1.5;
      child.position.y = 0.15 + cycle * 0.35;
      child.scale.setScalar(0.4 + cycle * 0.7);
    });
  });

  return (
    <group position={[-0.45, 1.14, -0.42]}>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.09, 0.08, 0.2, 14]} />
        <meshStandardMaterial color="#FAF5EE" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.02, 12]} />
        <meshStandardMaterial color="#2B1D16" roughness={0.5} />
      </mesh>
      <mesh position={[-0.1, 0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.05, 0.016, 8, 12, Math.PI * 1.3]} />
        <meshStandardMaterial color="#FAF5EE" roughness={0.8} />
      </mesh>
      <group ref={steamRef}>
        {[0, 1].map((i) => (
          <mesh key={i} position={[(i - 0.5) * 0.03, 0.15, 0]}>
            <sphereGeometry args={[0.038, 8, 8]} />
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

// Sombras de contato no piso (low-poly contact shadows)
function FloorContactShadows({ isNight }: { isNight: boolean }) {
  const baseOpacity = isNight ? 0.45 : 0.28;
  return (
    <group position={[0, 0.015, 0]}>
      {/* Sombra de projeção suave sob o tapete circular */}
      <mesh position={[-0.15, 0, 0.92]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.72, 28]} />
        <meshBasicMaterial color="#2B160C" depthWrite={false} opacity={baseOpacity * 0.9} transparent />
      </mesh>

      {/* Sombra principal alongada projetada pela mesa no chão e tapete */}
      <mesh position={[0.48, 0.002, 0.68]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.76, 1.66]} />
        <meshBasicMaterial color="#24130A" depthWrite={false} opacity={baseOpacity * 1.1} transparent />
      </mesh>

      {/* Almofadas de contato escurecidas sob os 4 pés da mesa */}
      {[-1.08, 1.08].flatMap((x) =>
        [-0.54, 0.54].map((z) => (
          <mesh key={`leg-shadow-${x}-${z}`} position={[0.42 + x, 0.004, 0.62 + z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.22, 0.22]} />
            <meshBasicMaterial color="#160A05" depthWrite={false} opacity={baseOpacity * 1.4} transparent />
          </mesh>
        ))
      )}

      {/* Sombra de contato sob a base da luminária de chão */}
      <mesh position={[-2.28, 0.002, -1.08]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.54, 20]} />
        <meshBasicMaterial color="#1E0E06" depthWrite={false} opacity={baseOpacity * 1.25} transparent />
      </mesh>

      {/* Sombra de contato e oclusão na base da estante de livros */}
      <mesh position={[1.7, 0.002, -2.73]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.32, 0.64]} />
        <meshBasicMaterial color="#1A0D05" depthWrite={false} opacity={baseOpacity * 1.35} transparent />
      </mesh>
    </group>
  );
}

// Sombras de contato sobre o tampo de madeira da mesa
function DeskContactShadows({
  hasActiveBook,
  hasStackedBooks,
}: {
  hasActiveBook: boolean;
  hasStackedBooks: boolean;
}) {
  return (
    <group position={[0.42, 1.142, 0.62]}>
      {/* Sombra sob o vasinho da planta suculenta */}
      <mesh position={[-0.78, 0.001, -0.42]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.16, 16]} />
        <meshBasicMaterial color="#221107" depthWrite={false} opacity={0.38} transparent />
      </mesh>

      {/* Sombra sob a xícara de café */}
      <mesh position={[-0.45, 0.001, -0.42]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.13, 16]} />
        <meshBasicMaterial color="#221107" depthWrite={false} opacity={0.36} transparent />
      </mesh>

      {/* Sombra sob o porta-canetas */}
      <mesh position={[-1.02, 0.001, 0.45]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.19, 16]} />
        <meshBasicMaterial color="#221107" depthWrite={false} opacity={0.34} transparent />
      </mesh>

      {/* Sombra sob o livro ativo aberto na mesa */}
      {hasActiveBook ? (
        <mesh position={[-0.5, 0.001, 0.1]} rotation={[-Math.PI / 2, 0, -0.12]}>
          <planeGeometry args={[1.6, 0.98]} />
          <meshBasicMaterial color="#1C0E05" depthWrite={false} opacity={0.42} transparent />
        </mesh>
      ) : null}

      {/* Sombra sob a pilha de livros na mesa */}
      {hasStackedBooks ? (
        <mesh position={[0.54, 0.001, -0.2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.15, 0.8]} />
          <meshBasicMaterial color="#1C0E05" depthWrite={false} opacity={0.38} transparent />
        </mesh>
      ) : null}
    </group>
  );
}

// Mesa de estudo com suporte a tampo limpo (zero livros) e clique para adicionar livro
function Desk({
  isEmpty,
  onAddBook,
}: {
  isEmpty: boolean;
  onAddBook: () => void;
}) {
  return (
    <group position={[0.42, 0, 0.62]}>
      {/* Tampo da mesa em madeira */}
      <mesh position={[0, 1.04, 0]}>
        <boxGeometry args={[2.62, 0.2, 1.52]} />
        <meshStandardMaterial color="#754A33" roughness={0.92} />
      </mesh>

      {/* 4 Pernas da mesa */}
      {[-1.08, 1.08].flatMap((x) =>
        [-0.54, 0.54].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.48, z]}>
            <boxGeometry args={[0.14, 0.98, 0.14]} />
            <meshStandardMaterial color="#513126" roughness={1} />
          </mesh>
        ))
      )}

      {/* Porta canetas e régua */}
      <mesh position={[-1.02, 1.17, 0.45]}>
        <cylinderGeometry args={[0.18, 0.15, 0.22, 12]} />
        <meshStandardMaterial color="#6F8066" roughness={0.9} />
      </mesh>
      <mesh position={[-1.02, 1.27, 0.45]} rotation={[0, 0, -0.18]}>
        <torusGeometry args={[0.19, 0.045, 8, 14, Math.PI * 1.4]} />
        <meshStandardMaterial color="#6F8066" roughness={0.9} />
      </mesh>

      <DeskPlant />
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
}: {
  isLampOn: boolean;
  onToggleLamp: () => void;
  theme: (typeof AMBIENCE_THEMES)[ResolvedAmbience];
  isNight: boolean;
  isEmptyDesk: boolean;
  onAddBook: () => void;
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
        <meshStandardMaterial color="#4A2E1F" roughness={0.95} />
      </mesh>

      {/* Piso em madeira aconchegante */}
      <mesh position={[0, -0.04, 0]}>
        <boxGeometry args={[7.2, 0.1, 7.4]} />
        <meshStandardMaterial color="#B99467" roughness={0.92} />
      </mesh>

      {/* Frisos do assoalho */}
      {[-2.5, -1.25, 0, 1.25, 2.5].map((x) => (
        <mesh key={x} position={[x, 0.015, 0]}>
          <boxGeometry args={[0.025, 0.012, 7.1]} />
          <meshBasicMaterial color="#97724C" />
        </mesh>
      ))}

      {/* Sombras de contato no piso */}
      <FloorContactShadows isNight={isNight} />

      {/* PAREDES COM ENCONTRO DE CANTO PERFEITO E SEM SOBRAS */}
      {/* Parede traseira: termina exatamente em z = -3.42 e x = -3.60 */}
      <mesh position={[0, 1.65, -3.34]}>
        <boxGeometry args={[7.2, 3.5, 0.16]} />
        <meshStandardMaterial color="#E8D6BC" roughness={1} />
      </mesh>
      {/* Parede esquerda: começa exatamente em z = -3.42 e vai até o piso frontal z = +3.70 */}
      <mesh position={[-3.52, 1.65, 0.14]}>
        <boxGeometry args={[0.16, 3.5, 7.12]} />
        <meshStandardMaterial color="#D6BE9D" roughness={1} />
      </mesh>
      {/* Coluna / acabamento de quina perfeita para emenda impecável */}
      <mesh position={[-3.52, 1.65, -3.34]}>
        <boxGeometry args={[0.165, 3.502, 0.165]} />
        <meshStandardMaterial color="#D0BEA2" roughness={1} />
      </mesh>

      {/* Tapete circular aconchegante */}
      <mesh position={[-0.15, 0.025, 0.92]}>
        <cylinderGeometry args={[1.62, 1.62, 0.035, 28]} />
        <meshStandardMaterial color="#A65342" roughness={1} />
      </mesh>
      <mesh position={[-0.15, 0.048, 0.92]}>
        <cylinderGeometry args={[1.24, 1.24, 0.012, 28]} />
        <meshBasicMaterial color="#C77C61" />
      </mesh>

      {/* Mesa de estudo e leitura */}
      <Desk isEmpty={isEmptyDesk} onAddBook={onAddBook} />

      {/* Estante de livros */}
      <group position={[1.7, 0, -2.73]}>
        <mesh position={[0, 1.42, 0]}>
          <boxGeometry args={[2.18, 2.76, 0.5]} />
          <meshStandardMaterial color="#533226" roughness={0.95} />
        </mesh>
        <mesh position={[0, 1.42, 0.27]}>
          <boxGeometry args={[1.8, 2.38, 0.035]} />
          <meshStandardMaterial color="#8A6248" roughness={1} />
        </mesh>
        {[0.16, 0.98, 1.8, 2.68].map((y) => (
          <mesh key={y} position={[0, y, 0.54]}>
            <boxGeometry args={[2.02, 0.11, 0.58]} />
            <meshStandardMaterial color="#62402F" roughness={0.95} />
          </mesh>
        ))}
      </group>

      {/* Luminária de chão com iluminação focal dramática à noite */}
      <FloorLamp isNight={isNight} isOn={isLampOn} onToggle={onToggleLamp} theme={theme} />

      {/* Partículas de poeira dourada */}
      <AmbientDust isLampOn={isLampOn} opacity={theme.dustOpacity} />

      {/* Quadro na parede */}
      <group position={[-1.85, 1.9, -3.22]}>
        <mesh><boxGeometry args={[1.08, 0.76, 0.07]} /><meshStandardMaterial color="#956448" roughness={1} /></mesh>
        <mesh position={[0, 0, 0.05]}><boxGeometry args={[0.8, 0.49, 0.035]} /><meshStandardMaterial color="#F0DFBF" roughness={1} /></mesh>
        <mesh position={[-0.12, -0.04, 0.075]} rotation={[0, 0, -0.5]}><boxGeometry args={[0.1, 0.43, 0.02]} /><meshBasicMaterial color="#78866B" /></mesh>
      </group>
    </>
  );
}

function RoomGeometry({
  onAddBook,
  onOpenBook,
  onSelectBook,
  rotationRef,
  zoomRef,
  theme,
  isNight,
}: SceneProps & {
  rotationRef: React.MutableRefObject<RotationState>;
  zoomRef: React.MutableRefObject<ZoomState>;
  theme: (typeof AMBIENCE_THEMES)[ResolvedAmbience];
  isNight: boolean;
}) {
  const books = useLibraryStore((state) => state.books);
  const activeBookId = useLibraryStore((state) => state.activeBookId);
  const completingBookId = useLibraryStore((state) => state.completingBookId);
  const finalizeCompletion = useLibraryStore((state) => state.finalizeCompletion);
  const isLampOn = useLibraryStore((state) => state.isLampOn);
  const toggleLamp = useLibraryStore((state) => state.toggleLamp);

  const roomGroup = useRef<Group>(null);

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

  // Mesa limpa quando 0 livros estiverem em leitura
  const isEmptyDesk = !activeBook && readingBooks.length === 0;

  return (
    <group ref={roomGroup}>
      <RoomShell
        isEmptyDesk={isEmptyDesk}
        isLampOn={isLampOn}
        isNight={isNight}
        onAddBook={onAddBook}
        onToggleLamp={handleToggleLamp}
        theme={theme}
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

  useEffect(() => {
    let initialAngle = 0;
    let initialDistance = 0;
    let initialZoom = 1.0;

    const responder = PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6;
      },
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
  }, []);

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
    near: 0.1,
    far: 100,
  }), [baseZoom]);

  const resolvedName = resolvedAmbience === 'night' ? 'Noite' : resolvedAmbience === 'sunset' ? 'Ocaso' : 'Dia';
  const ambienceButtonLabel = ambienceMode === 'auto' ? `Auto (${resolvedName})` : AMBIENCE_META[ambienceMode].label;

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.bgColor }]} {...(panResponder?.panHandlers ?? {})}>
      <Canvas
        camera={camera}
        frameloop="always"
        gl={{ antialias: true, alpha: true }}
        orthographic
        style={styles.canvas}
      >
        <color attach="background" args={[currentTheme.bgColor]} />
        <CameraRig />
        <RoomGeometry
          {...props}
          isNight={isNight}
          rotationRef={rotationRef}
          theme={currentTheme}
          zoomRef={zoomRef}
        />
      </Canvas>

      {/* Controles Flutuantes: Zoom, Ambiência (Dia / Pôr do Sol / Noite / Auto) e Restaurar */}
      <View style={[styles.cameraControlsWrap, { top: insets.top + 10 }]}>
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

        {/* Botão de Ambiência com indicador do período ativo */}
        <Pressable
          accessibilityHint="Altera a iluminação do quarto entre Dia, Pôr do Sol, Noite ou Automático"
          accessibilityLabel={`Iluminação: ${ambienceButtonLabel}`}
          accessibilityRole="button"
          hitSlop={6}
          onPress={handleCycleAmbience}
          style={({ pressed }) => [
            styles.ambienceBtn,
            isNight && styles.darkPill,
            pressed && styles.btnPressed,
          ]}
        >
          <Ionicons
            color={isNight && ambienceMode === 'night' ? '#FFAE70' : AMBIENCE_META[ambienceMode].color}
            name={ambienceMode === 'auto' ? (resolvedAmbience === 'night' ? 'moon' : resolvedAmbience === 'sunset' ? 'partly-sunny' : 'sunny') : AMBIENCE_META[ambienceMode].icon}
            size={16}
          />
          <Text style={[styles.ambienceText, isNight && styles.darkText]}>
            {ambienceButtonLabel}
          </Text>
        </Pressable>

        {hasModified ? (
          <Pressable
            accessibilityLabel="Recentralizar câmera e rotação"
            accessibilityRole="button"
            hitSlop={6}
            onPress={resetCamera}
            style={({ pressed }) => [
              styles.resetBtn,
              isNight && styles.darkPill,
              pressed && styles.btnPressed,
            ]}
          >
            <Ionicons color={isNight ? '#F5E8D3' : colors.ink} name="refresh" size={14} />
            <Text style={[styles.resetText, isNight && styles.darkText]}>Restaurar</Text>
          </Pressable>
        ) : null}
      </View>
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
  ambienceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 18,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255, 249, 240, 0.94)',
    borderWidth: 1,
    borderColor: colors.line,
    boxShadow: '0 2px 8px rgba(53, 42, 36, 0.12)',
  },
  ambienceText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 18,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255, 249, 240, 0.94)',
    borderWidth: 1,
    borderColor: colors.line,
    boxShadow: '0 2px 8px rgba(53, 42, 36, 0.12)',
  },
  resetText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  darkPill: {
    backgroundColor: 'rgba(26, 28, 40, 0.94)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.45)',
  },
  darkText: {
    color: '#F5E8D3',
  },
  dividerDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  btnPressed: {
    opacity: 0.6,
  },
});
