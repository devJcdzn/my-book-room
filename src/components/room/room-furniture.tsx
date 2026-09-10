/* eslint-disable @typescript-eslint/no-require-imports, react/no-unknown-property */
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { useLoader } from '@react-three/fiber/native';
import { AdditiveBlending, DoubleSide, type Object3D } from 'three';
import { type GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const MODEL_SOURCES = [
  require('@/assets/Separate_Assets_glb/Work_Table_06.glb'),
  require('@/assets/Separate_Assets_glb/Chair_17.glb'),
  require('@/assets/Separate_Assets_glb/Light_05.glb'),
  require('@/assets/Separate_Assets_glb/Plants_05.glb'),
  require('@/assets/Separate_Assets_glb/Plants_15.glb'),
  require('@/assets/Separate_Assets_glb/Picture_21.glb'),
  require('@/assets/cats-assets/catnap-orange.glb'),
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

function toBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x4000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return btoa(binary);
}

function inlineEmbeddedImages(data: ArrayBuffer) {
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
    image.uri = `data:${image.mimeType ?? 'image/png'};base64,${toBase64(bytes)}`;
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

  return output;
}

class NativeGLTFLoader extends GLTFLoader {
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
  const models = useLoader(NativeGLTFLoader, MODEL_SOURCES as unknown as string[]) as GLTF[];
  const [table, chair, lamp, deskPlant, floorPlant, picture, cat] = models;

  return (
    <>
      <group position={[0.42, 0, 0.62]} scale={[2, 1.5, 2.05]}>
        <Model object={table.scene} />
      </group>

      <group position={[0.42, 0, 1.75]} rotation={[0, Math.PI, 0]} scale={1.65}>
        <Model object={chair.scene} />
      </group>

      {/* Gatinho laranja aconchegante dormindo no espaço livre ao lado da mesa */}
      <group
        onClick={(event) => {
          event.stopPropagation();
          if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        position={[2.10, 0.02, 1.40]}
        rotation={[0, -0.75, 0]}
      >
        <group position={[0, 0.445 * 0.60, 0]} scale={0.60}>
          <Model object={cat.scene} />
        </group>
        <mesh position={[0, 0.25, 0]}>
          <sphereGeometry args={[0.58, 8, 8]} />
          <meshBasicMaterial depthWrite={false} opacity={0} transparent />
        </mesh>
      </group>

      <group position={[-0.56, 1.17, 0.12]} scale={1.05}>
        <Model object={deskPlant.scene} />
      </group>

      {/* Planta de chão abaixo do quadro e encostada na parede */}
      <group position={[-1.85, 0, -2.80]} rotation={[0, 0.4, 0]} scale={1.35}>
        <Model object={floorPlant.scene} />
      </group>

      <group position={[-1.85, 1.9, -3.255]} scale={[1.9, 1.65, 1]}>
        <Model object={picture.scene} />
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
