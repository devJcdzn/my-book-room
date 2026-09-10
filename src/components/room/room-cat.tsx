/* eslint-disable @typescript-eslint/no-require-imports, react/no-unknown-property */
import * as Haptics from 'expo-haptics';
import React, { Suspense, useCallback, useEffect, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber/native';
import { type Group } from 'three';
import { type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { NativeGLTFLoader } from '@/src/components/room/room-furniture';
import { useLibraryStore } from '@/src/store/library-store';
import { getCatOption } from '@/src/types/room-customization';

export const CAT_SOURCES: Record<string, number> = {
  'catnap-orange': require('@/assets/cats-assets/catnap-orange.glb'),
  'black-catnap': require('@/assets/cats-assets/black-catnap.glb'),
  'gray-catnap': require('@/assets/cats-assets/gray-catnap.glb'),
};

const loadedCats = new Set<string>();

export function isCatModelLoaded(id: string): boolean {
  return loadedCats.has(id);
}

export function preloadCatModels(activeCatId?: string) {
  for (const [id, source] of Object.entries(CAT_SOURCES)) {
    if (id !== activeCatId && !loadedCats.has(id)) {
      try {
        useLoader.preload(NativeGLTFLoader, source as unknown as string);
      } catch {
        // Ignora silenciosamente para não interromper fluxo principal
      }
    }
  }
}

function DreamSparkles() {
  const sparklesRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (!sparklesRef.current) return;
    const t = clock.getElapsedTime();
    sparklesRef.current.children.forEach((child, i) => {
      const offset = i * 1.25;
      const progress = ((t + offset) * 0.45) % 1;
      child.position.y = 0.22 + progress * 0.55;
      child.position.x = Math.sin(t * 1.6 + i * 2) * 0.07 + (i - 1) * 0.06;
      child.position.z = Math.cos(t * 1.3 + i) * 0.05;
      const scale = Math.sin(progress * Math.PI) * (0.026 + i * 0.008);
      child.scale.set(scale, scale, scale);
    });
  });

  return (
    <group ref={sparklesRef}>
      {[0, 1, 2].map((key) => (
        <mesh key={key}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial color="#FFE6A8" opacity={0.65} transparent />
        </mesh>
      ))}
    </group>
  );
}

export function CatLoadingDisguise({ catId }: { catId: string }) {
  const cat = getCatOption(catId);
  const moundRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (moundRef.current) {
      const breath = Math.sin(clock.getElapsedTime() * 2.3) * 0.028;
      moundRef.current.scale.set(1.0 + breath * 0.4, 0.72 + breath, 0.88 + breath * 0.4);
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Sombra de contato no piso */}
      <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.54, 24]} />
        <meshBasicMaterial color="#2B1D16" depthWrite={false} opacity={0.35} transparent />
      </mesh>

      {/* Base sólida da caminha */}
      <mesh position={[0, 0.038, 0]}>
        <cylinderGeometry args={[0.46, 0.43, 0.076, 24]} />
        <meshStandardMaterial color={cat.bedColor} roughness={0.88} />
      </mesh>

      {/* Borda arredondada / fofinha da caminha */}
      <mesh position={[0, 0.082, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.39, 0.072, 12, 28]} />
        <meshStandardMaterial color={cat.bedColor} roughness={0.85} />
      </mesh>

      {/* Almofada interna acolchoada */}
      <mesh position={[0, 0.062, 0]}>
        <cylinderGeometry args={[0.34, 0.34, 0.035, 20]} />
        <meshStandardMaterial color={cat.bedColor} roughness={0.95} />
      </mesh>

      {/* Silhueta enrolada do gatinho com respiração suave */}
      <group ref={moundRef} position={[0.02, 0.125, 0.01]}>
        {/* Corpo esferóide adormecido */}
        <mesh>
          <sphereGeometry args={[0.26, 20, 16]} />
          <meshStandardMaterial color={cat.furColor} roughness={0.78} />
        </mesh>
        {/* Orelhinhas estilizadas no corpinho */}
        <mesh position={[-0.10, 0.12, 0.09]} rotation={[0.3, -0.4, 0.2]}>
          <coneGeometry args={[0.045, 0.085, 4]} />
          <meshStandardMaterial color={cat.furColor} roughness={0.8} />
        </mesh>
        <mesh position={[-0.18, 0.12, 0.02]} rotation={[0.2, -0.7, 0.2]}>
          <coneGeometry args={[0.045, 0.085, 4]} />
          <meshStandardMaterial color={cat.furColor} roughness={0.8} />
        </mesh>
      </group>

      {/* Partículas sutis de sono/sonho subindo da caminha */}
      <DreamSparkles />
    </group>
  );
}

function CatModel({ catId, onLoaded }: { catId: string; onLoaded?: () => void }) {
  const source = CAT_SOURCES[catId] ?? CAT_SOURCES['catnap-orange'];
  const gltf = useLoader(NativeGLTFLoader, source as unknown as string) as GLTF;
  const groupRef = useRef<Group>(null);

  useEffect(() => {
    loadedCats.add(catId);
    onLoaded?.();
    gltf.scene.traverse((child) => {
      child.frustumCulled = false;
    });
  }, [catId, gltf, onLoaded]);

  useFrame((_, delta) => {
    if (groupRef.current && groupRef.current.scale.x < 0.60) {
      const next = Math.min(0.60, groupRef.current.scale.x + delta * 1.4);
      groupRef.current.scale.set(next, next, next);
    }
  });

  return (
    <group ref={groupRef} position={[0, 0.445 * 0.60, 0]} scale={0.48}>
      <primitive object={gltf.scene} />
    </group>
  );
}

type RoomCatProps = {
  onLoadingChange?: (loading: boolean, catId: string) => void;
};

export function RoomCat({ onLoadingChange }: RoomCatProps) {
  const catId = useLibraryStore((state) => state.catId);

  const handleLoaded = useCallback(() => {
    onLoadingChange?.(false, catId);
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [catId, onLoadingChange]);

  useEffect(() => {
    if (!loadedCats.has(catId)) {
      onLoadingChange?.(true, catId);
    } else {
      onLoadingChange?.(false, catId);
    }
  }, [catId, onLoadingChange]);

  return (
    <group
      onClick={() => {
        if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      position={[2.10, 0.02, 1.40]}
      rotation={[0, -0.75, 0]}
    >
      <Suspense fallback={<CatLoadingDisguise catId={catId} />}>
        <CatModel catId={catId} onLoaded={handleLoaded} />
      </Suspense>
    </group>
  );
}
