/* eslint-disable react/no-unknown-property */
import React, { useEffect, useState } from 'react';
import { Texture, TextureLoader } from 'three';

import type { Book } from '@/src/types/book';
import { getPosterFrame } from '@/src/types/room-customization';

// Cache em memória de texturas de pôsteres para acesso instantâneo (0 ms) sem re-download
const posterTextureCache = new Map<string, Texture>();

function usePosterTexture(url?: string): Texture | null {
  const cachedTexture = url ? posterTextureCache.get(url) ?? null : null;
  const [texture, setTexture] = useState<Texture | null>(() => {
    if (!url) return null;
    return posterTextureCache.get(url) ?? null;
  });

  useEffect(() => {
    if (!url || cachedTexture) return;

    const cached = posterTextureCache.get(url);
    if (cached) return;

    let isCancelled = false;
    const loader = new TextureLoader();

    loader.load(
      url,
      (loaded) => {
        if (isCancelled) return;
        loaded.needsUpdate = true;
        posterTextureCache.set(url, loaded);
        setTexture(loaded);
      },
      undefined,
      () => {
        // Em caso de falha de rede/offline, mantém a arte editorial procedural
        if (!isCancelled) setTexture(null);
      },
    );

    return () => {
      isCancelled = true;
    };
  }, [cachedTexture, url]);

  return cachedTexture ?? (url ? texture : null);
}

type RoomPosterProps = {
  book?: Book;
  frameId?: string;
};

export function RoomPoster({ book, frameId }: RoomPosterProps) {
  const frameOption = getPosterFrame(frameId);

  // Otimização de Performance: Prefere a versão de resolução média (-M.jpg ~15 KB)
  // em vez da versão pesada de 400 KB (-L.jpg), consumindo 90% menos memória GPU
  const optimizedCoverUrl = book?.coverId
    ? `https://covers.openlibrary.org/b/id/${book.coverId}-M.jpg`
    : book?.coverUrl;

  const coverTexture = usePosterTexture(optimizedCoverUrl);

  const bookColor = book?.coverColor ?? '#8C3D2B';

  return (
    // Posicionado na parede esquerda (x = -3.43) e rotacionado 90° para olhar para +x (interior da sala)
    <group position={[-3.43, 2.05, 0.55]} rotation={[0, Math.PI / 2, 0]}>
      {/* Sombra de Contato Suave Atrás da Moldura na Parede */}
      <mesh position={[0.02, -0.02, -0.012]}>
        <planeGeometry args={[1.04, 1.44]} />
        <meshBasicMaterial color="#140E0A" depthWrite={false} opacity={0.38} transparent />
      </mesh>

      {/* 1. Moldura de Galeria Chanfrada (Quadro 3D) */}
      {/* Moldura Superior */}
      <mesh position={[0, 0.69, 0.015]}>
        <boxGeometry args={[1.00, 0.055, 0.035]} />
        <meshStandardMaterial color={frameOption.frameColor} roughness={0.65} />
      </mesh>
      {/* Moldura Inferior */}
      <mesh position={[0, -0.69, 0.015]}>
        <boxGeometry args={[1.00, 0.055, 0.035]} />
        <meshStandardMaterial color={frameOption.frameColor} roughness={0.65} />
      </mesh>
      {/* Moldura Esquerda */}
      <mesh position={[-0.475, 0, 0.015]}>
        <boxGeometry args={[0.055, 1.34, 0.035]} />
        <meshStandardMaterial color={frameOption.frameColor} roughness={0.65} />
      </mesh>
      {/* Moldura Direita */}
      <mesh position={[0.475, 0, 0.015]}>
        <boxGeometry args={[0.055, 1.34, 0.035]} />
        <meshStandardMaterial color={frameOption.frameColor} roughness={0.65} />
      </mesh>

      {/* Filete Interno Metálico / Acabamento da Moldura */}
      <mesh position={[0, 0, 0.008]}>
        <planeGeometry args={[0.91, 1.31]} />
        <meshStandardMaterial color={frameOption.trimColor} roughness={0.5} />
      </mesh>

      {/* 2. Paspatur (Passe-partout) em Papel Algodão Marfim */}
      <mesh position={[0, 0, 0.012]}>
        <planeGeometry args={[0.87, 1.27]} />
        <meshStandardMaterial color={frameOption.matColor} roughness={0.95} />
      </mesh>

      {/* 3. Área de Impressão da Arte / Capa do Livro */}
      {coverTexture ? (
        // Textura da Capa Real Renderizada em Alta Nitidez
        <mesh position={[0, 0, 0.014]}>
          <planeGeometry args={[0.66, 0.98]} />
          <meshStandardMaterial map={coverTexture} roughness={0.8} />
        </mesh>
      ) : (
        // Arte Editorial Procedural Instantânea (Zero Lag, Zero Espera)
        <group position={[0, 0, 0.014]}>
          {/* Fundo com a Cor Oficial do Livro */}
          <mesh>
            <planeGeometry args={[0.66, 0.98]} />
            <meshStandardMaterial color={bookColor} roughness={0.85} />
          </mesh>

          {/* Friso Dourado Nobre Estilo Clássico Editorial */}
          <mesh position={[0, 0, 0.002]}>
            <planeGeometry args={[0.58, 0.90]} />
            <meshStandardMaterial color={bookColor} roughness={0.7} />
          </mesh>
          <mesh position={[0, 0, 0.003]}>
            <planeGeometry args={[0.56, 0.88]} />
            <meshStandardMaterial color="#E8D5B0" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0, 0.004]}>
            <planeGeometry args={[0.53, 0.85]} />
            <meshStandardMaterial color={bookColor} roughness={0.85} />
          </mesh>

          {/* Emblema Editorial no Topo */}
          <mesh position={[0, 0.30, 0.006]}>
            <circleGeometry args={[0.045, 16]} />
            <meshStandardMaterial color="#D4AF37" metalness={0.2} roughness={0.5} />
          </mesh>

          {/* Tarja Central de Título */}
          <mesh position={[0, 0.06, 0.006]}>
            <planeGeometry args={[0.44, 0.18]} />
            <meshStandardMaterial color="#FAF6EB" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.09, 0.007]}>
            <planeGeometry args={[0.34, 0.014]} />
            <meshStandardMaterial color="#38291F" roughness={1} />
          </mesh>
          <mesh position={[0, 0.05, 0.007]}>
            <planeGeometry args={[0.26, 0.010]} />
            <meshStandardMaterial color="#6B5342" roughness={1} />
          </mesh>

          {/* Filetes Inferiores de Autoria */}
          <mesh position={[0, -0.26, 0.006]}>
            <planeGeometry args={[0.30, 0.010]} />
            <meshStandardMaterial color="#D4AF37" metalness={0.2} roughness={0.6} />
          </mesh>
          <mesh position={[0, -0.32, 0.006]}>
            <planeGeometry args={[0.18, 0.008]} />
            <meshStandardMaterial color="#E8D5B0" roughness={0.8} />
          </mesh>
        </group>
      )}

      {/* 4. Vidro Protetor de Museu com Reflexo Suave */}
      <mesh position={[0, 0, 0.018]}>
        <planeGeometry args={[0.87, 1.27]} />
        <meshStandardMaterial
          color="#F2F8FF"
          depthWrite={false}
          metalness={0.15}
          opacity={0.10}
          roughness={0.08}
          transparent
        />
      </mesh>
    </group>
  );
}
