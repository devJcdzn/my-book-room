/* eslint-disable react/no-unknown-property */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Group, OrthographicCamera } from 'three';

import { useLibraryStore } from '@/src/store/library-store';
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
  targetX: number;
};

const BG_COLOR = '#DFCBAF';
const ROTATION_LIMIT_Y = 0.52; // ~30 graus para evitar que as paredes cubram o quarto
const ROTATION_LIMIT_X = 0.08; // ~4.5 graus de inclinação suave
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

function FloorLamp({ isOn, onToggle }: { isOn: boolean; onToggle: () => void }) {
  return (
    <group position={[-2.28, 0, -1.08]}>
      <mesh position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.38, 0.44, 0.12, 16]} />
        <meshStandardMaterial color="#453830" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.28, 0]}>
        <cylinderGeometry args={[0.045, 0.055, 2.45, 10]} />
        <meshStandardMaterial color="#58483E" roughness={0.85} />
      </mesh>
      <mesh position={[0, 2.45, 0]}>
        <coneGeometry args={[0.45, 0.62, 18, 1, true]} />
        <meshStandardMaterial
          color={isOn ? '#E69C72' : '#8A7060'}
          emissive={isOn ? '#FFAE70' : '#000000'}
          emissiveIntensity={isOn ? 0.4 : 0}
          roughness={0.9}
          side={2}
        />
      </mesh>
      <mesh position={[0, 2.35, 0]}>
        <sphereGeometry args={[0.09, 10, 10]} />
        <meshBasicMaterial color={isOn ? '#FFF7DE' : '#5E4E42'} />
      </mesh>

      {isOn ? (
        <>
          <pointLight color="#FFD194" distance={5.5} intensity={2.4} position={[0, 2.2, 0]} />
          <mesh position={[0, 1.2, 0]}>
            <cylinderGeometry args={[0.18, 1.35, 2.1, 16, 1, true]} />
            <meshBasicMaterial color="#FFE2B8" depthWrite={false} opacity={0.065} side={2} transparent />
          </mesh>
        </>
      ) : null}

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

function AmbientDust({ isLampOn }: { isLampOn: boolean }) {
  const dustRef = useRef<Group>(null);
  const particleCount = 12;

  const positions = useMemo(() => {
    return Array.from({ length: particleCount }, (_, i) => [
      -1.7 + ((i * 7) % 32) * 0.1,
      0.9 + ((i * 11) % 24) * 0.08,
      -1.3 + ((i * 13) % 28) * 0.1,
    ] as Vector);
  }, []);

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
          <sphereGeometry args={[0.02, 6, 6]} />
          <meshBasicMaterial
            color="#FFE6AA"
            depthWrite={false}
            opacity={0.3 + (i % 3) * 0.1}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

function RoomShell({ isLampOn, onToggleLamp }: { isLampOn: boolean; onToggleLamp: () => void }) {
  return (
    <>
      <ambientLight intensity={isLampOn ? 1.25 : 1.45} />
      <directionalLight intensity={2.1} position={[4, 7, 5]} />

      {/* Sombra suave de projeção abaixo do diorama em tom quente */}
      <mesh position={[0, -0.26, 0]}>
        <boxGeometry args={[7.5, 0.02, 7.7]} />
        <meshBasicMaterial color="#C8AF93" depthWrite={false} opacity={0.65} transparent />
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

      {/* Paredes em tom bege quente */}
      <mesh position={[0, 1.65, -3.34]}>
        <boxGeometry args={[7.2, 3.5, 0.16]} />
        <meshStandardMaterial color="#E8D6BC" roughness={1} />
      </mesh>
      <mesh position={[-3.52, 1.65, 0]}>
        <boxGeometry args={[0.16, 3.5, 7.4]} />
        <meshStandardMaterial color="#D6BE9D" roughness={1} />
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
      <group position={[0.42, 0, 0.62]}>
        <mesh position={[0, 1.04, 0]}>
          <boxGeometry args={[2.62, 0.2, 1.52]} />
          <meshStandardMaterial color="#754A33" roughness={0.92} />
        </mesh>
        {[-1.08, 1.08].flatMap((x) => [-0.54, 0.54].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.48, z]}>
            <boxGeometry args={[0.14, 0.98, 0.14]} />
            <meshStandardMaterial color="#513126" roughness={1} />
          </mesh>
        )))}
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
      </group>

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

      {/* Luminária de chão */}
      <FloorLamp isOn={isLampOn} onToggle={onToggleLamp} />

      {/* Partículas de poeira dourada */}
      <AmbientDust isLampOn={isLampOn} />

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
}: SceneProps & { rotationRef: React.MutableRefObject<RotationState> }) {
  const books = useLibraryStore((state) => state.books);
  const activeBookId = useLibraryStore((state) => state.activeBookId);
  const completingBookId = useLibraryStore((state) => state.completingBookId);
  const finalizeCompletion = useLibraryStore((state) => state.finalizeCompletion);
  const isLampOn = useLibraryStore((state) => state.isLampOn);
  const toggleLamp = useLibraryStore((state) => state.toggleLamp);

  const roomGroup = useRef<Group>(null);

  // Rotação amortecida no frame
  useFrame(() => {
    if (!roomGroup.current) return;
    roomGroup.current.rotation.y += (rotationRef.current.targetY - roomGroup.current.rotation.y) * 0.12;
    roomGroup.current.rotation.x += (rotationRef.current.targetX - roomGroup.current.rotation.x) * 0.12;
    roomGroup.current.rotation.z = roomGroup.current.rotation.y * -0.03;
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

  return (
    <>
      <CameraRig />
      <group ref={roomGroup}>
        <RoomShell isLampOn={isLampOn} onToggleLamp={handleToggleLamp} />

        {activeBook ? (
          <OpenBook key={activeBook.id} color={activeBook.coverColor} onPress={() => onOpenBook(activeBook.id)} />
        ) : null}

        {!activeBook && !movingBook ? (
          <OpenBook color="#9B8067" onPress={onAddBook} />
        ) : null}

        {readingBooks.map((book, index) => (
          <StackedBook key={book.id} book={book} index={index} onPress={() => onSelectBook(book.id)} />
        ))}

        {completedBooks.map((book, index) => (
          <ShelfBook key={book.id} book={book} index={index} onPress={() => onOpenBook(book.id)} />
        ))}

        {movingBook ? (
          <MovingBook
            book={movingBook}
            end={shelfPosition(completedBooks.length)}
            onComplete={() => finalizeCompletion(movingBook.id)}
          />
        ) : null}
      </group>
    </>
  );
}

export function IsometricScene(props: SceneProps) {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const rotationRef = useRef<RotationState>({ targetY: 0, targetX: 0 });
  const [hasRotated, setHasRotated] = useState(false);
  const [panResponder, setPanResponder] = useState<ReturnType<typeof PanResponder.create> | null>(null);

  useEffect(() => {
    let angle = 0;
    let tilt = 0;
    const responder = PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 7 || Math.abs(gestureState.dy) > 7;
      },
      onPanResponderGrant: () => {
        angle = rotationRef.current.targetY;
        tilt = rotationRef.current.targetX;
      },
      onPanResponderMove: (_, gestureState) => {
        const sensitivityY = 0.0045;
        const sensitivityX = 0.002;
        const nextY = angle + gestureState.dx * sensitivityY;
        const nextX = tilt - gestureState.dy * sensitivityX;

        // Limita a rotação para não inverter o diorama nem expor o verso das paredes
        rotationRef.current.targetY = Math.max(-ROTATION_LIMIT_Y, Math.min(ROTATION_LIMIT_Y, nextY));
        rotationRef.current.targetX = Math.max(-ROTATION_LIMIT_X, Math.min(ROTATION_LIMIT_X, nextX));

        if (Math.abs(rotationRef.current.targetY) > 0.04 || Math.abs(rotationRef.current.targetX) > 0.03) {
          setHasRotated(true);
        }
      },
    });
    setPanResponder(responder);
  }, []);

  const resetRotation = () => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    rotationRef.current.targetY = 0;
    rotationRef.current.targetX = 0;
    setHasRotated(false);
  };

  const camera = useMemo(() => ({
    position: [6.7, 6.25, 7.4] as Vector,
    zoom: Math.max(width / 7.2, height / 11.8),
    near: 0.1,
    far: 100,
  }), [height, width]);

  return (
    <View style={styles.container} {...(panResponder?.panHandlers ?? {})}>
      <Canvas
        camera={camera}
        frameloop="always"
        gl={{ antialias: true, alpha: true }}
        orthographic
        style={styles.canvas}
      >
        <color attach="background" args={[BG_COLOR]} />
        <RoomGeometry {...props} rotationRef={rotationRef} />
      </Canvas>

      {/* Botão flutuante Recentralizar no canto superior esquerdo com safe area */}
      {hasRotated ? (
        <Pressable
          accessibilityLabel="Recentralizar visão da sala"
          accessibilityRole="button"
          onPress={resetRotation}
          style={({ pressed }) => [
            styles.resetCameraBtn,
            { top: insets.top + 10 },
            pressed && styles.btnPressed,
          ]}
        >
          <Ionicons color={colors.ink} name="refresh" size={14} />
          <Text style={styles.resetCameraText}>Recentralizar</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: BG_COLOR,
  },
  canvas: {
    flex: 1,
    backgroundColor: BG_COLOR,
  },
  resetCameraBtn: {
    position: 'absolute',
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255, 249, 240, 0.94)',
    borderWidth: 1,
    borderColor: colors.line,
    boxShadow: '0 2px 8px rgba(53, 42, 36, 0.12)',
  },
  resetCameraText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  btnPressed: {
    opacity: 0.7,
  },
});
