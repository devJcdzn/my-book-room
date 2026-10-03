/* eslint-disable react/no-unknown-property */
import React, { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { cacheAvatar } from '@/src/services/profile-avatar';
import { ROOM_PHOTOS_BUCKET } from '@/src/services/room-photos';
import { supabase } from '@/src/services/supabase';
import { useAuth } from '@/src/providers/auth-provider';
import type { ProfileAvatar } from '@/src/types/profile-avatar';

import { useRoomTexture } from '@/src/components/room/use-room-texture';

import { useLibraryStore } from '@/src/store/library-store';
import {
  getPictureFrameStyle,
  type PictureFrameSize,
} from '@/src/types/room-customization';

// Arte procedural aconchegante para quando o usuário não tiver foto definida
function DefaultCozyArt({ width, height }: { width: number; height: number }) {
  const isPortrait = height > width * 1.25;

  return (
    <group position={[0, 0, 0.002]}>
      {/* Fundo creme de papel algodão fino */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color="#F4EFE6" roughness={0.92} />
      </mesh>

      {/* Círculo do sol matinal acolhedor */}
      <mesh position={[isPortrait ? 0.06 : 0.16, isPortrait ? height * 0.22 : 0.18, 0.001]}>
        <circleGeometry args={[isPortrait ? 0.14 : 0.20, 32]} />
        <meshStandardMaterial color="#E8A856" roughness={0.88} />
      </mesh>

      {/* Silhueta montanhosa ao longe (verde sálvia suave) */}
      <mesh position={[isPortrait ? -0.05 : -0.08, isPortrait ? -height * 0.08 : -0.04, 0.002]}>
        <circleGeometry args={[isPortrait ? 0.28 : 0.34, 32, 0, Math.PI]} />
        <meshStandardMaterial color="#8DA08B" roughness={0.88} />
      </mesh>

      {/* Colina em terracota suave ao primeiro plano */}
      <mesh position={[isPortrait ? 0.04 : 0.06, isPortrait ? -height * 0.22 : -0.14, 0.003]}>
        <circleGeometry args={[isPortrait ? 0.34 : 0.40, 32, 0, Math.PI]} />
        <meshStandardMaterial color="#BD6B4D" roughness={0.85} />
      </mesh>

      {/* Detalhe de pinheiro minimalista */}
      <mesh position={[isPortrait ? -0.14 : -0.18, isPortrait ? -height * 0.08 : -0.05, 0.004]}>
        <coneGeometry args={[0.05, isPortrait ? 0.24 : 0.22, 16]} />
        <meshStandardMaterial color="#415745" roughness={0.9} />
      </mesh>
      <mesh position={[isPortrait ? -0.07 : -0.10, isPortrait ? -height * 0.14 : -0.08, 0.004]}>
        <coneGeometry args={[0.04, isPortrait ? 0.20 : 0.18, 16]} />
        <meshStandardMaterial color="#364A3A" roughness={0.9} />
      </mesh>
    </group>
  );
}

type RoomPictureFrameProps = {
  contentOnly?: boolean;
  sizeOverride?: PictureFrameSize;
  styleIdOverride?: string;
  photoUriOverride?: string | null;
  photo?: ProfileAvatar;
};

export function RoomPictureFrame({
  contentOnly = false,
  sizeOverride,
  styleIdOverride,
  photoUriOverride,
  photo,
}: RoomPictureFrameProps) {
  const storeSize = useLibraryStore((state) => state.pictureFrameSize);
  const storeStyleId = useLibraryStore((state) => state.pictureFrameStyleId);
  const storePhotoUri = useLibraryStore((state) => state.pictureFramePhotoUri);

  const { user } = useAuth();
  const [cached, setCached] = useState<{ version: string; uri: string }>();
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { if (state === 'active') setRefresh(value => value + 1); });
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (!photo || photo.source === 'none') return;
    let active = true;
    void cacheAvatar(supabase, user?.id ?? 'guest', photo, ROOM_PHOTOS_BUCKET).then(uri => {
      if (active && uri) setCached({ version: photo.version, uri });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [photo, user?.id, refresh]);
  const size = sizeOverride ?? storeSize;
  const styleId = styleIdOverride ?? storeStyleId;
  const photoUri = photo?.source === 'none' ? null : photo && cached?.version === photo.version ? cached.uri : photo?.localUri ?? (photoUriOverride !== undefined ? photoUriOverride : storePhotoUri);

  const style = getPictureFrameStyle(styleId);
  const userTexture = useRoomTexture(photoUri);

  if (!contentOnly && size === 'none') {
    return null;
  }

  if (contentOnly) return userTexture ? (
    <mesh position={[0, 0, .065]}><planeGeometry args={[.80, .80]} /><meshStandardMaterial map={userTexture} roughness={.82} /></mesh>
  ) : <group position={[0,0,.065]}><DefaultCozyArt width={.80} height={.80} /></group>;

  // Dimensões do Quadro conforme proporção:
  // 1:1 (Quadrado clássico da sala) vs 2:1 (Retrato vertical expandido)
  const isOneToOne = size === '1:1';

  const outerWidth = isOneToOne ? 1.16 : 0.90;
  const outerHeight = isOneToOne ? 1.16 : 1.54;
  const frameThickness = 0.055;
  const frameDepth = 0.042;

  const matWidth = outerWidth - frameThickness * 2;
  const matHeight = outerHeight - frameThickness * 2;

  // Janela da tela/arte com margem elegante de passe-partout (em 2:1 vertical, proporção 1:2 vertical)
  const artWidth = isOneToOne ? 0.82 : 0.66;
  const artHeight = isOneToOne ? 0.82 : 1.30;

  // Centro da arte na face interna da parede traseira em z = -3.54
  return (
    <group position={[-1.85, 1.95, -3.535]}>
      {/* 1. Fundo Traseiro Protetor (MDF / Backboard) */}
      <mesh position={[0, 0, 0.002]}>
        <planeGeometry args={[matWidth, matHeight]} />
        <meshStandardMaterial color="#2B1D16" roughness={0.95} />
      </mesh>

      {/* 4. Passe-partout (Margem Nobre de Linho Marfim) */}
      <mesh position={[0, 0, 0.006]}>
        <planeGeometry args={[matWidth, matHeight]} />
        <meshStandardMaterial color={style.matColor} roughness={0.92} />
      </mesh>

      {/* 5. Friso Dourado / Chanfro de Contraste ao Redor da Arte */}
      <mesh position={[0, 0, 0.008]}>
        <planeGeometry args={[artWidth + 0.014, artHeight + 0.014]} />
        <meshStandardMaterial color="#BA984E" metalness={0.4} roughness={0.5} />
      </mesh>

      {/* 6. Tela Artística (Canvas / Foto do Usuário ou Arte Padrão) */}
      {userTexture ? (
        <mesh position={[0, 0, 0.010]}>
          <planeGeometry args={[artWidth, artHeight]} />
          <meshStandardMaterial map={userTexture} roughness={0.82} />
        </mesh>
      ) : (
        <group position={[0, 0, 0.010]}>
          <DefaultCozyArt height={artHeight} width={artWidth} />
        </group>
      )}

      {/* 7. Batentes Externos da Moldura de Marcenaria (4 Lados Chanfrados) */}
      {/* Moldura Superior */}
      <mesh position={[0, outerHeight / 2 - frameThickness / 2, frameDepth / 2]}>
        <boxGeometry args={[outerWidth, frameThickness, frameDepth]} />
        <meshStandardMaterial color={style.frameColor} roughness={0.7} />
      </mesh>

      {/* Moldura Inferior */}
      <mesh position={[0, -outerHeight / 2 + frameThickness / 2, frameDepth / 2]}>
        <boxGeometry args={[outerWidth, frameThickness, frameDepth]} />
        <meshStandardMaterial color={style.frameColor} roughness={0.7} />
      </mesh>

      {/* Batente Lateral Esquerdo */}
      <mesh position={[-outerWidth / 2 + frameThickness / 2, 0, frameDepth / 2]}>
        <boxGeometry args={[frameThickness, outerHeight - frameThickness * 2, frameDepth]} />
        <meshStandardMaterial color={style.frameColor} roughness={0.7} />
      </mesh>

      {/* Batente Lateral Direito */}
      <mesh position={[outerWidth / 2 - frameThickness / 2, 0, frameDepth / 2]}>
        <boxGeometry args={[frameThickness, outerHeight - frameThickness * 2, frameDepth]} />
        <meshStandardMaterial color={style.frameColor} roughness={0.7} />
      </mesh>

      {/* 8. Vidro de Proteção Translúcido (Museum Glass com Reflexo Suave) */}
      <mesh position={[0, 0, frameDepth * 0.85]}>
        <planeGeometry args={[matWidth - 0.004, matHeight - 0.004]} />
        <meshStandardMaterial
          color="#F2F8FA"
          depthWrite={false}
          opacity={0.07}
          roughness={0.08}
          transparent
        />
      </mesh>
    </group>
  );
}
