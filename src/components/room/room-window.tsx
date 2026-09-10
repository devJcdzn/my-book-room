/* eslint-disable react/no-unknown-property */
import React, { useMemo } from 'react';
import {
  Color,
  Float32BufferAttribute,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
} from 'three';

import { getWindowStyle } from '@/src/types/room-customization';

type RoomWindowProps = {
  styleId?: string;
  isNight?: boolean;
  ambience?: 'day' | 'sunset' | 'night';
  ambienceMode?: 'auto' | 'day' | 'sunset' | 'night';
};

// Cria malha com degradê suave de céu usando interpolação de cores por vértice na GPU
function createSkyGradientGeometry(mode: 'day' | 'sunset' | 'night'): PlaneGeometry {
  const geom = new PlaneGeometry(1.26, 1.38, 1, 3);
  const colors: number[] = [];

  let hexTop: string;
  let hexMidHigh: string;
  let hexMidLow: string;
  let hexHorizon: string;

  if (mode === 'day') {
    hexTop = '#1E5FA8'; // Azul zênite profundo
    hexMidHigh = '#3B8EE8'; // Azul celeste radiante
    hexMidLow = '#72B5F8'; // Azul luminoso
    hexHorizon = '#D4EBFF'; // Névoa clara e luminosa do horizonte
  } else if (mode === 'sunset') {
    hexTop = '#320E3E'; // Crepúsculo anil/violeta
    hexMidHigh = '#8E1E4A'; // Carmesim/magenta quente
    hexMidLow = '#E64A19'; // Laranja intenso de pôr do sol
    hexHorizon = '#FFB300'; // Dourado radiante na linha do horizonte
  } else {
    hexTop = '#03050C'; // Noite escura profunda
    hexMidHigh = '#080F22'; // Azul anil escuro
    hexMidLow = '#111832'; // Azul meia-noite
    hexHorizon = '#1A244A'; // Horizonte suave com atmosfera estrelada
  }

  const cTop = new Color(hexTop);
  const cMidHigh = new Color(hexMidHigh);
  const cMidLow = new Color(hexMidLow);
  const cHorizon = new Color(hexHorizon);

  // 4 fileiras de vértices de cima para baixo (2 vértices por fileira: esq, dir)
  const rows = [cTop, cTop, cMidHigh, cMidHigh, cMidLow, cMidLow, cHorizon, cHorizon];
  for (const c of rows) {
    colors.push(c.r, c.g, c.b);
  }

  geom.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geom;
}

// Cria silhueta de relevo montanhoso estritamente limitada dentro da abertura [-0.63, 0.63]
function createMountainShape(peaks: [number, number][], minY = -0.69, minX = -0.63, maxX = 0.63): Shape {
  const shape = new Shape();
  shape.moveTo(minX, minY);
  for (const [px, py] of peaks) {
    shape.lineTo(px, py);
  }
  shape.lineTo(maxX, minY);
  shape.closePath();
  return shape;
}

export function RoomWindow({
  styleId,
  isNight: _isNight,
  ambience,
  ambienceMode = 'auto',
}: RoomWindowProps) {
  const windowStyle = getWindowStyle(styleId);

  // Determina atmosfera exterior para o cenário da janela
  const hour = new Date().getHours();
  const effectiveMode: 'day' | 'sunset' | 'night' =
    ambience ??
    (ambienceMode !== 'auto'
      ? ambienceMode
      : hour >= 6 && hour < 18
        ? 'day'
        : hour >= 18 && hour < 20
          ? 'sunset'
          : 'night');

  const skyGeometry = useMemo(() => createSkyGradientGeometry(effectiveMode), [effectiveMode]);

  // Silhuetas de montanhas perfeitamente delimitadas na largura da janela [-0.63, 0.63]
  const distantMountainsShape = useMemo(() => {
    return createMountainShape([
      [-0.63, -0.18],
      [-0.44, -0.04],
      [-0.22, -0.16],
      [0.02, -0.02],
      [0.24, -0.14],
      [0.46, -0.03],
      [0.63, -0.15],
    ]);
  }, []);

  const nearMountainsShape = useMemo(() => {
    return createMountainShape([
      [-0.63, -0.32],
      [-0.40, -0.18],
      [-0.18, -0.28],
      [0.06, -0.16],
      [0.28, -0.30],
      [0.48, -0.20],
      [0.63, -0.28],
    ]);
  }, []);

  const distantMountainGeometry = useMemo(() => new ShapeGeometry(distantMountainsShape), [distantMountainsShape]);
  const nearMountainGeometry = useMemo(() => new ShapeGeometry(nearMountainsShape), [nearMountainsShape]);

  // Cores do relevo e cortinas de acordo com a ambiência
  const distantMountainColor =
    effectiveMode === 'day'
      ? '#4A7870' // Verde-azulado montanhoso distante com névoa
      : effectiveMode === 'sunset'
        ? '#44152D' // Violeta/carmesim escuro do pôr do sol
        : '#0B1220'; // Silhueta noturna escura

  const nearMountainColor =
    effectiveMode === 'day'
      ? '#275E31' // Verde florestal alpino
      : effectiveMode === 'sunset'
        ? '#280E14' // Silhueta castanho-avermelhada crepuscular
        : '#060A12'; // Silhueta escura noturna

  const pineTreeColor =
    effectiveMode === 'day'
      ? '#1A4524'
      : effectiveMode === 'sunset'
        ? '#1A0A0E'
        : '#03060B';

  const curtainColor =
    effectiveMode === 'day'
      ? '#F7F2EA' // Linho marfim macio e acolhedor
      : effectiveMode === 'sunset'
        ? '#EBD7C4' // Linho aquecido pelo ocaso
        : '#2E364A'; // Linho escuro acolhedor noturno

  return (
    // Posicionada na face da parede esquerda (x = -3.435), rotacionada 90° para olhar para +x (interior da sala)
    // Todas as peças possuem z local estritamente positivo (>= 0.005) para NUNCA haver oclusão pela parede
    <group position={[-3.435, 2.05, 0.55]} rotation={[0, Math.PI / 2, 0]}>
      {/* ========================================================================= */}
      {/* 1. FUNDO DO CÉU (Degradê atmosférico suave, delimitado em 1.26 x 1.38)      */}
      {/* ========================================================================= */}
      <mesh geometry={skyGeometry} position={[0, 0.04, 0.005]}>
        <meshBasicMaterial toneMapped={false} vertexColors />
      </mesh>

      {/* ========================================================================= */}
      {/* 2. ELEMENTOS CELESTES E CENÁRIO DENTRO DA ABERTURA                       */}
      {/* ========================================================================= */}

      {/* --- DIA --- */}
      {effectiveMode === 'day' && (
        <group position={[0, 0.04, 0]}>
          {/* Brilho e disco do Sol radiante */}
          <mesh position={[0.26, 0.36, 0.006]}>
            <circleGeometry args={[0.22, 24]} />
            <meshBasicMaterial color="#FFE580" depthWrite={false} opacity={0.35} transparent />
          </mesh>
          <mesh position={[0.26, 0.36, 0.007]}>
            <circleGeometry args={[0.13, 24]} />
            <meshBasicMaterial color="#FFFDE0" />
          </mesh>

          {/* Nuvens brancas fofas no céu */}
          <group position={[-0.26, 0.38, 0.008]}>
            <mesh position={[-0.09, 0, 0]}>
              <circleGeometry args={[0.12, 18]} />
              <meshBasicMaterial color="#FFFFFF" depthWrite={false} opacity={0.92} transparent />
            </mesh>
            <mesh position={[0.09, 0, 0]}>
              <circleGeometry args={[0.11, 18]} />
              <meshBasicMaterial color="#FFFFFF" depthWrite={false} opacity={0.92} transparent />
            </mesh>
            <mesh position={[0, 0.05, 0]}>
              <circleGeometry args={[0.14, 18]} />
              <meshBasicMaterial color="#FFFFFF" depthWrite={false} opacity={0.92} transparent />
            </mesh>
          </group>

          <group position={[0.18, 0.16, 0.008]}>
            <mesh position={[-0.07, 0, 0]}>
              <circleGeometry args={[0.09, 16]} />
              <meshBasicMaterial color="#FFFFFF" depthWrite={false} opacity={0.82} transparent />
            </mesh>
            <mesh position={[0.07, 0, 0]}>
              <circleGeometry args={[0.08, 16]} />
              <meshBasicMaterial color="#FFFFFF" depthWrite={false} opacity={0.82} transparent />
            </mesh>
            <mesh position={[0, 0.04, 0]}>
              <circleGeometry args={[0.10, 16]} />
              <meshBasicMaterial color="#FFFFFF" depthWrite={false} opacity={0.82} transparent />
            </mesh>
          </group>
        </group>
      )}

      {/* --- OCASO / PÔR DO SOL --- */}
      {effectiveMode === 'sunset' && (
        <group position={[0, 0.04, 0]}>
          {/* Sol poente dourado descendo entre as montanhas */}
          <mesh position={[0.14, -0.02, 0.006]}>
            <circleGeometry args={[0.30, 24]} />
            <meshBasicMaterial color="#FF8C00" depthWrite={false} opacity={0.45} transparent />
          </mesh>
          <mesh position={[0.14, -0.02, 0.007]}>
            <circleGeometry args={[0.18, 28]} />
            <meshBasicMaterial color="#FFF4A8" />
          </mesh>

          {/* Nuvens crepusculares douradas e coral */}
          <group position={[-0.24, 0.36, 0.008]}>
            <mesh position={[-0.09, 0, 0]}>
              <circleGeometry args={[0.12, 18]} />
              <meshBasicMaterial color="#FFC7A6" depthWrite={false} opacity={0.88} transparent />
            </mesh>
            <mesh position={[0.09, 0, 0]}>
              <circleGeometry args={[0.11, 18]} />
              <meshBasicMaterial color="#FFC7A6" depthWrite={false} opacity={0.88} transparent />
            </mesh>
            <mesh position={[0, 0.05, 0]}>
              <circleGeometry args={[0.13, 18]} />
              <meshBasicMaterial color="#FFB58E" depthWrite={false} opacity={0.88} transparent />
            </mesh>
          </group>

          <group position={[0.24, 0.20, 0.008]}>
            <mesh position={[-0.07, 0, 0]}>
              <circleGeometry args={[0.09, 16]} />
              <meshBasicMaterial color="#FFA378" depthWrite={false} opacity={0.78} transparent />
            </mesh>
            <mesh position={[0.07, 0, 0]}>
              <circleGeometry args={[0.08, 16]} />
              <meshBasicMaterial color="#FFA378" depthWrite={false} opacity={0.78} transparent />
            </mesh>
          </group>
        </group>
      )}

      {/* --- NOITE ESTRELADA --- */}
      {effectiveMode === 'night' && (
        <group position={[0, 0.04, 0]}>
          {/* Brilho celestial e Lua crescente dourada */}
          <mesh position={[0.26, 0.38, 0.006]}>
            <circleGeometry args={[0.22, 24]} />
            <meshBasicMaterial color="#4E659A" depthWrite={false} opacity={0.32} transparent />
          </mesh>
          <mesh position={[0.26, 0.38, 0.007]}>
            <circleGeometry args={[0.13, 24]} />
            <meshBasicMaterial color="#FFEAA7" />
          </mesh>
          {/* Recorte preciso da lua crescente */}
          <mesh position={[0.22, 0.41, 0.008]}>
            <circleGeometry args={[0.115, 24]} />
            <meshBasicMaterial color="#080F22" />
          </mesh>

          {/* 14 estrelas cintilantes pontilhadas pelo céu */}
          {[
            [-0.34, 0.52, 0.016],
            [0.06, 0.60, 0.017],
            [-0.16, 0.26, 0.015],
            [-0.46, 0.36, 0.011],
            [-0.40, 0.14, 0.010],
            [-0.22, 0.46, 0.012],
            [-0.08, 0.34, 0.011],
            [0.10, 0.50, 0.012],
            [0.36, 0.56, 0.013],
            [0.44, 0.30, 0.011],
            [0.38, 0.16, 0.010],
            [-0.50, 0.50, 0.011],
            [-0.02, 0.18, 0.009],
            [0.22, 0.12, 0.010],
          ].map(([sx, sy, size], i) => (
            <group key={i} position={[sx, sy, 0.008]}>
              <mesh>
                <circleGeometry args={[size, 10]} />
                <meshBasicMaterial color="#FFFFFF" />
              </mesh>
              {size >= 0.015 && (
                <>
                  <mesh>
                    <planeGeometry args={[size * 2.8, size * 0.35]} />
                    <meshBasicMaterial color="#D8E6FF" depthWrite={false} opacity={0.7} transparent />
                  </mesh>
                  <mesh>
                    <planeGeometry args={[size * 0.35, size * 2.8]} />
                    <meshBasicMaterial color="#D8E6FF" depthWrite={false} opacity={0.7} transparent />
                  </mesh>
                </>
              )}
            </group>
          ))}

          {/* Luz aconchegante de cabana distante nas montanhas */}
          <group position={[-0.20, -0.24, 0.012]}>
            <mesh>
              <circleGeometry args={[0.026, 12]} />
              <meshBasicMaterial color="#FFB300" depthWrite={false} opacity={0.55} transparent />
            </mesh>
            <mesh>
              <planeGeometry args={[0.013, 0.013]} />
              <meshBasicMaterial color="#FFF176" />
            </mesh>
          </group>
        </group>
      )}

      {/* Camadas de Montanhas (Delimitadas rigorosamente de -0.63 a +0.63) */}
      <mesh geometry={distantMountainGeometry} position={[0, 0.04, 0.009]}>
        <meshBasicMaterial color={distantMountainColor} />
      </mesh>

      <mesh geometry={nearMountainGeometry} position={[0, 0.04, 0.010]}>
        <meshBasicMaterial color={nearMountainColor} />
      </mesh>

      {/* Pinheiros nórdicos estilizados na encosta da montanha */}
      {[
        [-0.40, -0.16, 0.065],
        [-0.34, -0.18, 0.055],
        [-0.16, -0.24, 0.060],
        [0.08, -0.13, 0.070],
        [0.16, -0.15, 0.055],
        [0.38, -0.19, 0.065],
      ].map(([px, py, h], i) => (
        <group key={i} position={[px, py + 0.04, 0.011]}>
          <mesh position={[0, h / 2, 0]}>
            <coneGeometry args={[h * 0.35, h, 4]} />
            <meshBasicMaterial color={pineTreeColor} />
          </mesh>
        </group>
      ))}

      {/* ========================================================================= */}
      {/* 3. VIDROS COM BRILHO SUTIL E 4 VIDRAÇAS ESPAÇOSAS (Double-Hung Sash)      */}
      {/* ========================================================================= */}
      {/* Vidro translúcido com reflexo */}
      <mesh position={[0, 0.04, 0.016]}>
        <planeGeometry args={[1.24, 1.36]} />
        <meshStandardMaterial
          color="#FFFFFF"
          depthWrite={false}
          metalness={0.15}
          opacity={0.08}
          roughness={0.12}
          transparent
        />
      </mesh>

      {/* Travessa vertical central de marcenaria */}
      <mesh position={[0, 0.04, 0.024]}>
        <boxGeometry args={[0.034, 1.36, 0.022]} />
        <meshStandardMaterial color={windowStyle.mullionColor} roughness={0.78} />
      </mesh>

      {/* Travessa horizontal central do caixilho (Meeting rail proeminente) */}
      <mesh position={[0, 0.04, 0.028]}>
        <boxGeometry args={[1.26, 0.048, 0.036]} />
        <meshStandardMaterial color={windowStyle.mullionColor} roughness={0.75} />
      </mesh>

      {/* Fecho clássico de latão dourado no centro da janela (Sash Lock) */}
      <group position={[0, 0.05, 0.047]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.045, 0.020, 0.018]} />
          <meshStandardMaterial color="#D4AF37" metalness={0.75} roughness={0.25} />
        </mesh>
        <mesh position={[0.008, 0.012, 0.004]} rotation={[0, 0, 0.45]}>
          <cylinderGeometry args={[0.006, 0.006, 0.028, 8]} />
          <meshStandardMaterial color="#DFBE54" metalness={0.8} roughness={0.2} />
        </mesh>
      </group>

      {/* ========================================================================= */}
      {/* 4. ESQUADRIA ROBUSTA COM CORNIJA CLÁSSICA E MOLDURAS ESCULTURAIS          */}
      {/* ========================================================================= */}
      {/* Cornija superior escalonada (Crown Molding de 3 níveis) */}
      <mesh position={[0, 0.77, 0.045]}>
        <boxGeometry args={[1.56, 0.055, 0.075]} />
        <meshStandardMaterial color={windowStyle.frameColor} roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.72, 0.038]}>
        <boxGeometry args={[1.48, 0.045, 0.060]} />
        <meshStandardMaterial color={windowStyle.frameColor} roughness={0.78} />
      </mesh>
      <mesh position={[0, 0.69, 0.034]}>
        <boxGeometry args={[1.44, 0.020, 0.050]} />
        <meshStandardMaterial color={windowStyle.frameColor} roughness={0.80} />
      </mesh>

      {/* Montantes laterais chanfrados (Jambs com presença) */}
      <mesh position={[-0.67, 0.02, 0.032]}>
        <boxGeometry args={[0.09, 1.44, 0.050]} />
        <meshStandardMaterial color={windowStyle.frameColor} roughness={0.78} />
      </mesh>
      <mesh position={[0.67, 0.02, 0.032]}>
        <boxGeometry args={[0.09, 1.44, 0.050]} />
        <meshStandardMaterial color={windowStyle.frameColor} roughness={0.78} />
      </mesh>

      {/* Friso interno de rebaixo arquitetural */}
      <mesh position={[-0.61, 0.02, 0.025]}>
        <boxGeometry args={[0.03, 1.40, 0.035]} />
        <meshStandardMaterial color={windowStyle.frameColor} roughness={0.82} />
      </mesh>
      <mesh position={[0.61, 0.02, 0.025]}>
        <boxGeometry args={[0.03, 1.40, 0.035]} />
        <meshStandardMaterial color={windowStyle.frameColor} roughness={0.82} />
      </mesh>

      {/* Peitoril de madeira maciça espesso e profundo (Sill com presença real) */}
      <mesh position={[0, -0.74, 0.070]}>
        <boxGeometry args={[1.62, 0.08, 0.13]} />
        <meshStandardMaterial color={windowStyle.sillColor} roughness={0.70} />
      </mesh>
      {/* Nariz arredondado do peitoril */}
      <mesh position={[0, -0.71, 0.072]}>
        <boxGeometry args={[1.64, 0.025, 0.135]} />
        <meshStandardMaterial color={windowStyle.sillColor} roughness={0.68} />
      </mesh>
      {/* Saia de sustentação sob o peitoril (Apron) */}
      <mesh position={[0, -0.81, 0.026]}>
        <boxGeometry args={[1.46, 0.055, 0.035]} />
        <meshStandardMaterial color={windowStyle.frameColor} roughness={0.82} />
      </mesh>
      {/* Duas mísulas clássicas de sustentação esculpidas em madeira */}
      <mesh position={[-0.46, -0.86, 0.045]}>
        <boxGeometry args={[0.06, 0.10, 0.055]} />
        <meshStandardMaterial color={windowStyle.frameColor} roughness={0.80} />
      </mesh>
      <mesh position={[0.46, -0.86, 0.045]}>
        <boxGeometry args={[0.06, 0.10, 0.055]} />
        <meshStandardMaterial color={windowStyle.frameColor} roughness={0.80} />
      </mesh>

      {/* ========================================================================= */}
      {/* 5. CORTINAS ESCULTURAIS DE LINHO COM VOLUME E ABRAÇADEIRAS               */}
      {/* ========================================================================= */}
      {/* Varão superior de latão elegante e ponteiras torneadas */}
      <group position={[0, 0.86, 0.085]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.014, 0.014, 1.76, 16]} />
          <meshStandardMaterial color="#C5A059" metalness={0.70} roughness={0.30} />
        </mesh>
        {/* Suportes de parede do varão */}
        <mesh position={[-0.74, -0.015, -0.035]}>
          <boxGeometry args={[0.025, 0.05, 0.07]} />
          <meshStandardMaterial color="#C5A059" metalness={0.70} roughness={0.30} />
        </mesh>
        <mesh position={[0.74, -0.015, -0.035]}>
          <boxGeometry args={[0.025, 0.05, 0.07]} />
          <meshStandardMaterial color="#C5A059" metalness={0.70} roughness={0.30} />
        </mesh>
        {/* Ponteiras esféricas ornamentadas */}
        <mesh position={[-0.89, 0, 0]}>
          <sphereGeometry args={[0.036, 16, 16]} />
          <meshStandardMaterial color="#C5A059" metalness={0.70} roughness={0.30} />
        </mesh>
        <mesh position={[0.89, 0, 0]}>
          <sphereGeometry args={[0.036, 16, 16]} />
          <meshStandardMaterial color="#C5A059" metalness={0.70} roughness={0.30} />
        </mesh>
      </group>

      {/* Cortina Esquerda com ondulações de tecido e abraçadeira */}
      <group position={[-0.68, 0.02, 0.065]}>
        {/* Pregas volumétricas superiores */}
        {[-0.04, 0, 0.04].map((cx, i) => (
          <mesh key={i} position={[cx, 0.38, 0]}>
            <cylinderGeometry args={[0.030, 0.026, 0.82, 10]} />
            <meshStandardMaterial color={curtainColor} roughness={0.92} />
          </mesh>
        ))}
        {/* Abraçadeira da cortina com fivela/botão de latão */}
        <mesh position={[0.02, -0.05, 0.020]}>
          <boxGeometry args={[0.12, 0.045, 0.055]} />
          <meshStandardMaterial color="#B95F3B" roughness={0.70} />
        </mesh>
        <mesh position={[0.075, -0.05, 0.048]}>
          <sphereGeometry args={[0.014, 10, 10]} />
          <meshStandardMaterial color="#D4AF37" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Cascata inferior suave de tecido abrindo até o peitoril */}
        {[-0.03, 0.02].map((cx, i) => (
          <mesh key={`b-${i}`} position={[cx, -0.42, 0.005]}>
            <cylinderGeometry args={[0.032, 0.044, 0.66, 10]} />
            <meshStandardMaterial color={curtainColor} roughness={0.92} />
          </mesh>
        ))}
      </group>

      {/* Cortina Direita com ondulações de tecido e abraçadeira */}
      <group position={[0.68, 0.02, 0.065]}>
        {[-0.04, 0, 0.04].map((cx, i) => (
          <mesh key={i} position={[cx, 0.38, 0]}>
            <cylinderGeometry args={[0.030, 0.026, 0.82, 10]} />
            <meshStandardMaterial color={curtainColor} roughness={0.92} />
          </mesh>
        ))}
        {/* Abraçadeira da cortina com botão */}
        <mesh position={[-0.02, -0.05, 0.020]}>
          <boxGeometry args={[0.12, 0.045, 0.055]} />
          <meshStandardMaterial color="#B95F3B" roughness={0.70} />
        </mesh>
        <mesh position={[-0.075, -0.05, 0.048]}>
          <sphereGeometry args={[0.014, 10, 10]} />
          <meshStandardMaterial color="#D4AF37" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Cascata inferior suave */}
        {[-0.02, 0.03].map((cx, i) => (
          <mesh key={`b-${i}`} position={[cx, -0.42, 0.005]}>
            <cylinderGeometry args={[0.032, 0.044, 0.66, 10]} />
            <meshStandardMaterial color={curtainColor} roughness={0.92} />
          </mesh>
        ))}
      </group>

      {/* ========================================================================= */}
      {/* 6. DETALHES DE LEITURA E DIORAMA NO PEITORIL DE MADEIRA MACIÇA           */}
      {/* ========================================================================= */}
      {/* Vasinho cerâmico com suculenta no lado esquerdo do peitoril */}
      <group position={[-0.38, -0.66, 0.095]}>
        {/* Pires cerâmico */}
        <mesh position={[0, -0.018, 0]}>
          <cylinderGeometry args={[0.046, 0.040, 0.012, 14]} />
          <meshStandardMaterial color="#9E4F2F" roughness={0.85} />
        </mesh>
        {/* Vaso cerâmico em terracota */}
        <mesh position={[0, 0.025, 0]}>
          <cylinderGeometry args={[0.042, 0.030, 0.065, 14]} />
          <meshStandardMaterial color="#B85F3B" roughness={0.78} />
        </mesh>
        {/* Terra fértil escura */}
        <mesh position={[0, 0.055, 0]}>
          <cylinderGeometry args={[0.038, 0.038, 0.01, 12]} />
          <meshStandardMaterial color="#2B1D16" roughness={0.9} />
        </mesh>
        {/* Suculenta exuberante com folhas gordinhas modeladas */}
        <group position={[0, 0.07, 0]}>
          <mesh position={[0, 0.015, 0]} scale={[1, 1.3, 1]}>
            <sphereGeometry args={[0.028, 8, 8]} />
            <meshStandardMaterial color="#48853D" roughness={0.82} />
          </mesh>
          <mesh position={[0.022, 0.008, 0.014]} scale={[0.85, 0.85, 0.85]}>
            <sphereGeometry args={[0.024, 8, 8]} />
            <meshStandardMaterial color="#5FA052" roughness={0.82} />
          </mesh>
          <mesh position={[-0.018, 0.006, -0.012]} scale={[0.8, 0.8, 0.8]}>
            <sphereGeometry args={[0.022, 8, 8]} />
            <meshStandardMaterial color="#5FA052" roughness={0.82} />
          </mesh>
          <mesh position={[-0.015, 0.010, 0.016]} scale={[0.75, 0.75, 0.75]}>
            <sphereGeometry args={[0.020, 8, 8]} />
            <meshStandardMaterial color="#6EB260" roughness={0.82} />
          </mesh>
        </group>
      </group>

      {/* Dois livros deitados no peitoril no lado direito (Conceito da Sala de Leitura) */}
      <group position={[0.36, -0.67, 0.090]}>
        {/* Livro inferior em tecido azul clássico */}
        <group position={[0, 0, 0]}>
          <mesh>
            <boxGeometry args={[0.18, 0.036, 0.10]} />
            <meshStandardMaterial color="#2B4365" roughness={0.75} />
          </mesh>
          {/* Páginas marfim */}
          <mesh position={[0.008, 0, 0]}>
            <boxGeometry args={[0.168, 0.030, 0.092]} />
            <meshStandardMaterial color="#FFF9EE" roughness={0.9} />
          </mesh>
        </group>

        {/* Livro superior levemente inclinado em vinho nobre */}
        <group position={[-0.01, 0.034, 0]} rotation={[0, 0.12, 0]}>
          <mesh>
            <boxGeometry args={[0.16, 0.030, 0.09]} />
            <meshStandardMaterial color="#8B2E3D" roughness={0.72} />
          </mesh>
          {/* Páginas marfim */}
          <mesh position={[0.008, 0, 0]}>
            <boxGeometry args={[0.148, 0.024, 0.082]} />
            <meshStandardMaterial color="#FFF9EE" roughness={0.9} />
          </mesh>
          {/* Filete dourado na lombada */}
          <mesh position={[-0.075, 0, 0]}>
            <boxGeometry args={[0.006, 0.028, 0.086]} />
            <meshStandardMaterial color="#D4AF37" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
