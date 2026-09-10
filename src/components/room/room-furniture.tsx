/* eslint-disable @typescript-eslint/no-require-imports, react/no-unknown-property */
import { useEffect } from 'react';
import { useLoader } from '@react-three/fiber/native';
import { AdditiveBlending, DoubleSide, type Object3D } from 'three';
import { type GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const FURNITURE_SOURCES = [
  require('@/assets/Separate_Assets_glb/Work_Table_06.glb'),
  require('@/assets/Separate_Assets_glb/Chair_17.glb'),
  require('@/assets/Separate_Assets_glb/Light_05.glb'),
  require('@/assets/Separate_Assets_glb/Plants_05.glb'),
  require('@/assets/Separate_Assets_glb/Plants_15.glb'),
];

type FurnitureTheme = {
  lampColor: string;
  lampIntensity: number;
  lampDistance: number;
  coneOpacity: number;
};

type RoomFurnitureProps = {
  isLampOn: boolean;
  isNight: boolean;
  onToggleLamp: () => void;
  theme: FurnitureTheme;
};

type ImageBitmapFactory = typeof globalThis.createImageBitmap;

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BINARY_CHUNK = 0x004e4942;

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const base64Cache = new Map<number, string>();
const inlinedBufferCache = new WeakMap<ArrayBuffer, ArrayBuffer>();

function fastToBase64(bytes: Uint8Array): string {
  const len = bytes.length;
  const sampleKey =
    len ^
    (bytes[0] || 0) ^
    ((bytes[Math.floor(len / 2)] || 0) << 8) ^
    ((bytes[len - 1] || 0) << 16);

  const cached = base64Cache.get(sampleKey);
  if (cached) return cached;

  let res = '';
  const extra = len % 3;
  const mainLen = len - extra;

  for (let i = 0; i < mainLen; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    res +=
      B64_CHARS[(b0 >> 2) & 0x3f] +
      B64_CHARS[((b0 << 4) | (b1 >> 4)) & 0x3f] +
      B64_CHARS[((b1 << 2) | (b2 >> 6)) & 0x3f] +
      B64_CHARS[b2 & 0x3f];
  }

  if (extra === 1) {
    const b0 = bytes[mainLen];
    res += B64_CHARS[(b0 >> 2) & 0x3f] + B64_CHARS[(b0 << 4) & 0x3f] + '==';
  } else if (extra === 2) {
    const b0 = bytes[mainLen];
    const b1 = bytes[mainLen + 1];
    res +=
      B64_CHARS[(b0 >> 2) & 0x3f] +
      B64_CHARS[((b0 << 4) | (b1 >> 4)) & 0x3f] +
      B64_CHARS[(b1 << 2) & 0x3f] +
      '=';
  }

  base64Cache.set(sampleKey, res);
  return res;
}

function inlineEmbeddedImages(data: ArrayBuffer) {
  const cachedOutput = inlinedBufferCache.get(data);
  if (cachedOutput) return cachedOutput;

  const source = new DataView(data);
  if (source.byteLength < 28 || source.getUint32(0, true) !== GLB_MAGIC) return data;

  const jsonLength = source.getUint32(12, true);
  if (source.getUint32(16, true) !== JSON_CHUNK) return data;

  const binaryHeaderOffset = 20 + jsonLength;
  if (source.getUint32(binaryHeaderOffset + 4, true) !== BINARY_CHUNK) return data;

  const binaryLength = source.getUint32(binaryHeaderOffset, true);
  const binaryOffset = binaryHeaderOffset + 8;
  const json = JSON.parse(
    new TextDecoder().decode(new Uint8Array(data, 20, jsonLength)),
  ) as {
    bufferViews?: { byteLength: number; byteOffset?: number }[];
    images?: { bufferView?: number; mimeType?: string; uri?: string }[];
  };

  let changed = false;
  for (const image of json.images ?? []) {
    if (image.bufferView === undefined) continue;
    const bufferView = json.bufferViews?.[image.bufferView];
    if (!bufferView) continue;

    const bytes = new Uint8Array(
      data,
      binaryOffset + (bufferView.byteOffset ?? 0),
      bufferView.byteLength,
    );
    image.uri = `data:${image.mimeType ?? 'image/png'};base64,${fastToBase64(bytes)}`;
    delete image.bufferView;
    changed = true;
  }

  if (!changed) return data;

  const encodedJson = new TextEncoder().encode(JSON.stringify(json));
  const paddedJsonLength = Math.ceil(encodedJson.length / 4) * 4;
  const output = new ArrayBuffer(12 + 8 + paddedJsonLength + 8 + binaryLength);
  const outputView = new DataView(output);
  const outputBytes = new Uint8Array(output);

  outputView.setUint32(0, GLB_MAGIC, true);
  outputView.setUint32(4, 2, true);
  outputView.setUint32(8, output.byteLength, true);
  outputView.setUint32(12, paddedJsonLength, true);
  outputView.setUint32(16, JSON_CHUNK, true);
  outputBytes.fill(0x20, 20, 20 + paddedJsonLength);
  outputBytes.set(encodedJson, 20);

  const outputBinaryHeader = 20 + paddedJsonLength;
  outputView.setUint32(outputBinaryHeader, binaryLength, true);
  outputView.setUint32(outputBinaryHeader + 4, BINARY_CHUNK, true);
  outputBytes.set(new Uint8Array(data, binaryOffset, binaryLength), outputBinaryHeader + 8);

  inlinedBufferCache.set(data, output);
  return output;
}

export class NativeGLTFLoader extends GLTFLoader {
  override parse(
    data: ArrayBuffer | string,
    path: string,
    onLoad: (gltf: GLTF) => void,
    onError?: (error: ErrorEvent) => void,
  ) {
    const runtime = globalThis as unknown as {
      createImageBitmap?: ImageBitmapFactory;
    };
    const originalCreateImageBitmap = runtime.createImageBitmap;

    try {
      runtime.createImageBitmap = undefined;
      return super.parse(
        data instanceof ArrayBuffer ? inlineEmbeddedImages(data) : data,
        path,
        onLoad,
        onError,
      );
    } finally {
      runtime.createImageBitmap = originalCreateImageBitmap;
    }
  }
}

function Model({ object }: { object: Object3D }) {
  useEffect(() => {
    object.traverse((child) => {
      child.frustumCulled = false;
    });
  }, [object]);

  return <primitive object={object} />;
}

export function RoomFurniture({ isLampOn, isNight, onToggleLamp, theme }: RoomFurnitureProps) {
  const models = useLoader(NativeGLTFLoader, FURNITURE_SOURCES as unknown as string[]) as GLTF[];
  const [table, chair, lamp, deskPlant, floorPlant] = models;

  return (
    <>
      <group position={[0.42, 0, 0.62]} scale={[2, 1.5, 2.05]}>
        <Model object={table.scene} />
      </group>

      <group position={[0.42, 0, 1.75]} rotation={[0, Math.PI, 0]} scale={1.65}>
        <Model object={chair.scene} />
      </group>

      <group position={[-0.56, 1.17, 0.12]} scale={1.05}>
        <Model object={deskPlant.scene} />
      </group>

      {/* Planta de chão posicionada ao lado da estante de livros (não colada, harmoniosa) */}
      <group position={[0.10, 0, -2.80]} rotation={[0, -0.4, 0]} scale={1.35}>
        <Model object={floorPlant.scene} />
      </group>

      <group position={[-2.28, 0, -1.08]}>
        <group scale={1.95}>
          <Model object={lamp.scene} />
        </group>

        <mesh position={[0, 2.35, 0]}>
          <sphereGeometry args={[0.09, 10, 10]} />
          <meshBasicMaterial color={isLampOn ? '#FFF7DE' : '#5E4E42'} />
        </mesh>

        {isLampOn ? (
          <>
            <pointLight
              color={theme.lampColor}
              distance={theme.lampDistance}
              intensity={theme.lampIntensity}
              position={[0.35, 2.15, 0.35]}
            />
            <pointLight
              color="#FF9E48"
              distance={8.2}
              intensity={theme.lampIntensity * 0.42}
              position={[0.9, 1.7, 0.8]}
            />

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

        <mesh
          onClick={(event) => {
            event.stopPropagation();
            onToggleLamp();
          }}
          position={[0, 1.35, 0]}
        >
          <cylinderGeometry args={[0.55, 0.55, 2.8, 8]} />
          <meshBasicMaterial depthWrite={false} opacity={0} transparent />
        </mesh>
      </group>
    </>
  );
}
