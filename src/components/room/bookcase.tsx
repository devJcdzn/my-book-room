/* eslint-disable react/no-unknown-property */
import React from 'react';

import { BOOKCASE_PALETTES, type BookcasePalette } from '@/src/types/room-customization';

// Alturas exatas das superfícies das prateleiras para assentamento dos livros
// row 0: topo da prateleira 1 = 0.215 (centro do livro = 0.48)
// row 1: topo da prateleira 2 = 1.035 (centro do livro = 1.30)
// row 2: topo da prateleira 3 = 1.855 (centro do livro = 2.12)
// row 3: topo da prateleira 4 = 2.675 (prateleira superior/frieze)
const SHELVES = [
  { y: 0.175, lipY: 0.165 },
  { y: 0.995, lipY: 0.985 },
  { y: 1.815, lipY: 1.805 },
  { y: 2.635, lipY: 2.625 },
];

const BEADBOARD_GROOVES = [-0.60, -0.30, 0, 0.30, 0.60];

export function Bookcase({ palette = BOOKCASE_PALETTES[0] }: { palette?: BookcasePalette }) {
  return (
    <group position={[1.45, 0, -3.00]}>
      {/* --- PLINTO / BASEBOARD (RODAPÉ ROBUSTO DE MARCENARIA) --- */}
      {/* Base sólida de sustentação */}
      <mesh position={[0, 0.075, 0.40]}>
        <boxGeometry args={[2.14, 0.15, 0.64]} />
        <meshStandardMaterial color={palette.frameColor} roughness={0.92} />
      </mesh>
      {/* Friso decorativo no topo do rodapé */}
      <mesh position={[0, 0.13, 0.73]}>
        <boxGeometry args={[2.12, 0.04, 0.02]} />
        <meshStandardMaterial color={palette.trimColor} roughness={0.88} />
      </mesh>
      {/* Pés de apoio frontais nas extremidades */}
      <mesh position={[-1.02, 0.04, 0.68]}>
        <boxGeometry args={[0.08, 0.08, 0.06]} />
        <meshStandardMaterial color={palette.frameColor} roughness={0.95} />
      </mesh>
      <mesh position={[1.02, 0.04, 0.68]}>
        <boxGeometry args={[0.08, 0.08, 0.06]} />
        <meshStandardMaterial color={palette.frameColor} roughness={0.95} />
      </mesh>

      {/* --- MONTANTES LATERAIS (STILES / COLUNAS ESTRUTURAIS) --- */}
      {/* Lateral esquerda */}
      <mesh position={[-0.98, 1.42, 0.40]}>
        <boxGeometry args={[0.08, 2.54, 0.58]} />
        <meshStandardMaterial color={palette.frameColor} roughness={0.88} />
      </mesh>
      {/* Friso frontal da lateral esquerda */}
      <mesh position={[-0.98, 1.42, 0.70]}>
        <boxGeometry args={[0.035, 2.54, 0.02]} />
        <meshStandardMaterial color={palette.trimColor} roughness={0.85} />
      </mesh>

      {/* Lateral direita */}
      <mesh position={[0.98, 1.42, 0.40]}>
        <boxGeometry args={[0.08, 2.54, 0.58]} />
        <meshStandardMaterial color={palette.frameColor} roughness={0.88} />
      </mesh>
      {/* Friso frontal da lateral direita */}
      <mesh position={[0.98, 1.42, 0.70]}>
        <boxGeometry args={[0.035, 2.54, 0.02]} />
        <meshStandardMaterial color={palette.trimColor} roughness={0.85} />
      </mesh>

      {/* --- PAINEL TRASEIRO (BEADBOARD / TONGUE-AND-GROOVE) --- */}
      {/* Placa de fundo com acabamento profundo que destaca os livros */}
      <mesh position={[0, 1.42, 0.12]}>
        <boxGeometry args={[1.90, 2.54, 0.035]} />
        <meshStandardMaterial color={palette.backColor} roughness={0.96} />
      </mesh>
      {/* Ranhuras verticais de marcenaria clássica */}
      {BEADBOARD_GROOVES.map((gx) => (
        <mesh key={gx} position={[gx, 1.42, 0.142]}>
          <boxGeometry args={[0.016, 2.52, 0.009]} />
          <meshStandardMaterial color={palette.backColor} roughness={0.98} />
        </mesh>
      ))}

      {/* --- PRATELEIRAS HORIZONTAIS COM MOLDURAS E PINOS --- */}
      {SHELVES.map((shelf, idx) => (
        <group key={idx}>
          {/* Prancha horizontal da prateleira */}
          <mesh position={[0, shelf.y, 0.40]}>
            <boxGeometry args={[1.88, 0.08, 0.53]} />
            <meshStandardMaterial color={palette.shelfColor} roughness={0.86} />
          </mesh>
          {/* Borda frontal com moldura saliente (bullnose lip) */}
          <mesh position={[0, shelf.lipY, 0.68]}>
            <boxGeometry args={[1.88, 0.07, 0.03]} />
            <meshStandardMaterial color={palette.trimColor} roughness={0.82} />
          </mesh>
          {/* Pinos metálicos de sustentação (detalhe artesanal) */}
          <mesh position={[-0.935, shelf.y - 0.045, 0.40]}>
            <boxGeometry args={[0.018, 0.018, 0.32]} />
            <meshStandardMaterial color={palette.metalColor} metalness={0.4} roughness={0.5} />
          </mesh>
          <mesh position={[0.935, shelf.y - 0.045, 0.40]}>
            <boxGeometry args={[0.018, 0.018, 0.32]} />
            <meshStandardMaterial color={palette.metalColor} metalness={0.4} roughness={0.5} />
          </mesh>
        </group>
      ))}

      {/* --- CORNIJA SUPERIOR / CROWN MOLDING EM CAMADAS --- */}
      {/* Faixa superior interna (frieze) assentada diretamente no topo dos montantes */}
      <mesh position={[0, 2.72, 0.40]}>
        <boxGeometry args={[1.96, 0.06, 0.58]} />
        <meshStandardMaterial color={palette.frameColor} roughness={0.9} />
      </mesh>
      {/* Moldura de transição intermediária */}
      <mesh position={[0, 2.76, 0.41]}>
        <boxGeometry args={[2.08, 0.035, 0.62]} />
        <meshStandardMaterial color={palette.trimColor} roughness={0.85} />
      </mesh>
      {/* Cornija superior principal saliente (cap ledge) */}
      <mesh position={[0, 2.795, 0.42]}>
        <boxGeometry args={[2.18, 0.04, 0.66]} />
        <meshStandardMaterial color={palette.frameColor} roughness={0.88} />
      </mesh>
    </group>
  );
}
