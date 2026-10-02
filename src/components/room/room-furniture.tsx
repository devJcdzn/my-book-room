/* eslint-disable react/no-unknown-property */
import React, { useEffect, useMemo, useRef } from "react";
import {
  useLoader,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber/native";
import {
  DataTexture,
  LinearFilter,
  Mesh,
  MeshStandardMaterial,
  Matrix4,
  Plane,
  Vector3,
  type Group,
} from "three";
import {
  type GLTF,
  GLTFLoader,
} from "three/examples/jsm/loaders/GLTFLoader.js";

import { roomModel } from "@/src/components/room/room-models";
import { retainRoomModel, retainRoomResources } from "@/src/components/room/room-resources";
import { RoomPictureFrame } from "@/src/components/room/room-picture-frame";
import { RoomPoster } from "@/src/components/room/room-poster";
import { RoomWindow } from "@/src/components/room/room-window";
import { useRoomEditor } from "@/src/store/room-editor-store";
import { useLibraryStore } from "@/src/store/library-store";
import {
  pieceBounds,
  snapRoomCoordinate,
  type RoomLayout,
  type RoomPiece,
} from "@/src/types/room-layout";
import {
  getBookcasePalette,
  getRugPalette,
  getWindowStyle,
  getPictureFrameStyle,
} from "@/src/types/room-customization";

// One shared 4 KB mask: soft contact shadows without shadow-map render passes.
const contactShadow = (() => {
  const size = 32;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const distance = Math.max(
        Math.abs(((x + 0.5) / size) * 2 - 1),
        Math.abs(((y + 0.5) / size) * 2 - 1),
      );
      const fade = Math.max(0, Math.min(1, (1 - distance) / 0.45));
      const index = (y * size + x) * 4;
      data[index] = data[index + 1] = data[index + 2] = 255;
      data[index + 3] = Math.round(255 * fade * fade * (3 - 2 * fade));
    }
  const texture = new DataTexture(data, size, size);
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
})();

function ContactShadow({
  piece,
  isNight,
}: {
  piece: RoomPiece;
  isNight: boolean;
}) {
  useEffect(() => retainRoomResources(new Set([contactShadow])), []);
  const bounds = pieceBounds(piece);
  const footprint =
    piece.category === "plant" ? 0.45 : piece.category === "lamp" ? 0.6 : 0.95;
  const width = (bounds.max[0] - bounds.min[0]) * footprint;
  const depth = (bounds.max[2] - bounds.min[2]) * footprint;
  return (
    <mesh
      position={[
        (bounds.min[0] + bounds.max[0]) / 2,
        0.012,
        (bounds.min[2] + bounds.max[2]) / 2,
      ]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[width, depth]} />
      <meshBasicMaterial
        map={contactShadow}
        color="#251A10"
        transparent
        opacity={isNight ? 0.16 : 0.1}
        depthWrite={false}
      />
    </mesh>
  );
}

type FurnitureTheme = {
  lampColor: string;
  lampIntensity: number;
  lampDistance: number;
  coneOpacity: number;
};

type ImageBitmapFactory = typeof globalThis.createImageBitmap;

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BINARY_CHUNK = 0x004e4942;

const B64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const inlinedBufferCache = new WeakMap<ArrayBuffer, ArrayBuffer>();

function fastToBase64(bytes: Uint8Array): string {
  const len = bytes.length;
  let res = "";
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
    res += B64_CHARS[(b0 >> 2) & 0x3f] + B64_CHARS[(b0 << 4) & 0x3f] + "==";
  } else if (extra === 2) {
    const b0 = bytes[mainLen];
    const b1 = bytes[mainLen + 1];
    res +=
      B64_CHARS[(b0 >> 2) & 0x3f] +
      B64_CHARS[((b0 << 4) | (b1 >> 4)) & 0x3f] +
      B64_CHARS[(b1 << 2) & 0x3f] +
      "=";
  }

  return res;
}

function inlineEmbeddedImages(data: ArrayBuffer) {
  const cachedOutput = inlinedBufferCache.get(data);
  if (cachedOutput) return cachedOutput;

  const source = new DataView(data);
  if (source.byteLength < 28 || source.getUint32(0, true) !== GLB_MAGIC)
    return data;

  const jsonLength = source.getUint32(12, true);
  if (source.getUint32(16, true) !== JSON_CHUNK) return data;

  const binaryHeaderOffset = 20 + jsonLength;
  if (source.getUint32(binaryHeaderOffset + 4, true) !== BINARY_CHUNK)
    return data;

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
    image.uri = `data:${image.mimeType ?? "image/png"};base64,${fastToBase64(bytes)}`;
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
  outputBytes.set(
    new Uint8Array(data, binaryOffset, binaryLength),
    outputBinaryHeader + 8,
  );

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

export function RoomModel({ piece }: { piece: RoomPiece }) {
  const invalidate = useThree((state) => state.invalidate);
  const gltf = useLoader(
    NativeGLTFLoader,
    roomModel(piece).source as unknown as string,
  ) as GLTF;
  useEffect(() => retainRoomModel(gltf.scene), [gltf]);
  const bookcasePalette = useLibraryStore((state) => state.bookcasePaletteId);
  const savedRugPalette = useLibraryStore((state) => state.rugPaletteId);
  const rugPalette =
    useRoomEditor((state) => state.appearance?.rugPaletteId) ?? savedRugPalette;
  const windowStyle = useLibraryStore((state) => state.leftWallWindowStyle);
  const frameStyle = useLibraryStore((state) => state.pictureFrameStyleId);
  const woodColor = piece.category === "bookcase"
    ? getBookcasePalette(bookcasePalette).frameColor
    : piece.category === "window"
      ? getWindowStyle(windowStyle).frameColor
      : piece.category === "frame"
        ? getPictureFrameStyle(frameStyle).frameColor
        : null;
  const rugColor = piece.category === "rug" ? getRugPalette(rugPalette).mainColor : "";
  const object = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    const colors = { oak: "#B88B58", walnut: "#60402C", sage: "#809375" };
    cloned.traverse((child) => {
      child.frustumCulled = false;
      if (!(child instanceof Mesh)) return;
      const cloneMaterial = (original: MeshStandardMaterial) => {
        const material = original.clone();
        if (material.name.endsWith("_wood")) {
          if (piece.finish !== "original")
            material.color.set(colors[piece.finish]);
          else if (woodColor) material.color.set(woodColor);
        }
        if (piece.category === "rug" && material.name.endsWith("_fabric"))
          material.color.set(
            piece.finish === "original"
              ? rugColor
              : colors[piece.finish],
          );
        if (
          piece.finish !== "original" &&
          (material.name.endsWith("_ceramic") ||
            (piece.category === "lamp" && material.name.endsWith("_metal")) ||
            (piece.category !== "lamp" && material.name.endsWith("_fabric")))
        )
          material.color.set(colors[piece.finish]);
        return material;
      };
      child.material = Array.isArray(child.material)
        ? child.material.map((m) => cloneMaterial(m as MeshStandardMaterial))
        : cloneMaterial(child.material as MeshStandardMaterial);
    });
    return cloned;
  }, [
    gltf,
    piece.category,
    piece.finish,
    woodColor,
    rugColor,
  ]);
  useEffect(() => {
    invalidate(2);
  }, [object, invalidate]);
  useEffect(
    () => () => {
      object.traverse((child) => {
        if (child instanceof Mesh)
          for (const material of Array.isArray(child.material)
            ? child.material
            : [child.material])
            material.dispose();
      });
    },
    [object],
  );
  return <primitive object={object} dispose={null} />;
}

export function RoomPieceGroup({
  piece,
  children,
}: {
  piece: RoomPiece;
  children: React.ReactNode;
}) {
  const group = useRef<Group>(null);
  const drag = useRef<Vector3 | null>(null);
  const editing = useRoomEditor((state) => Boolean(state.draft));
  const selected = useRoomEditor((state) => state.selectedId === piece.id);
  const invalid = useRoomEditor(
    (state) => state.invalid && state.selectedId === piece.id,
  );
  const bounds = pieceBounds(piece);
  const width = bounds.max[0] - bounds.min[0],
    height = bounds.max[1] - bounds.min[1],
    depth = bounds.max[2] - bounds.min[2];
  const pointOnSurface = (event: ThreeEvent<PointerEvent>) => {
    const parent = group.current?.parent;
    if (!parent) return null;
    parent.updateWorldMatrix(true, false);
    const ray = event.ray
      .clone()
      .applyMatrix4(new Matrix4().copy(parent.matrixWorld).invert());
    const plane =
      piece.surface === "back-wall"
        ? new Plane(new Vector3(0, 0, 1), 3.53)
        : piece.surface === "left-wall"
          ? new Plane(new Vector3(1, 0, 0), 3.43)
          : new Plane(new Vector3(0, 1, 0), 0);
    return ray.intersectPlane(plane, new Vector3());
  };
  return (
    <group
      ref={group}
      position={piece.position}
      rotation={[0, piece.rotation, 0]}
    >
      {children}
      {editing ? (
        <mesh
          position={[
            (bounds.min[0] + bounds.max[0]) / 2,
            (bounds.min[1] + bounds.max[1]) / 2,
            (bounds.min[2] + bounds.max[2]) / 2,
          ]}
          onPointerDown={(event) => {
            if (useRoomEditor.getState().cameraMode) return;
            event.stopPropagation();
            useRoomEditor.getState().select(piece.id);
            if (piece.surface === "desk") return;
            const point = pointOnSurface(event);
            if (!point) return;
            useRoomEditor.getState().beginMove();
            drag.current = point.sub(new Vector3(...piece.position));
            (
              event.target as unknown as {
                setPointerCapture: (id: number) => void;
              }
            ).setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            event.stopPropagation();
            const point = pointOnSurface(event);
            if (!point) return;
            point.sub(drag.current);
            const position: [number, number, number] =
              piece.surface === "back-wall"
                ? [
                    snapRoomCoordinate(point.x),
                    snapRoomCoordinate(point.y),
                    -3.53,
                  ]
                : piece.surface === "left-wall"
                  ? [
                      -3.43,
                      snapRoomCoordinate(point.y),
                      snapRoomCoordinate(point.z),
                    ]
                  : [
                      snapRoomCoordinate(point.x),
                      piece.position[1],
                      snapRoomCoordinate(point.z),
                    ];
            useRoomEditor.getState().update({ ...piece, position });
          }}
          onPointerUp={(event) => {
            drag.current = null;
            useRoomEditor.getState().endMove();
            (
              event.target as unknown as {
                releasePointerCapture: (id: number) => void;
              }
            ).releasePointerCapture(event.pointerId);
          }}
          onLostPointerCapture={() => {
            drag.current = null;
            useRoomEditor.getState().endMove();
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <boxGeometry args={[width, height, Math.max(depth, 0.12)]} />
          <meshBasicMaterial
            color={invalid ? "#BF493B" : "#6B8E71"}
            transparent
            opacity={selected ? 0.16 : 0}
            depthWrite={false}
          />
        </mesh>
      ) : null}
    </group>
  );
}

export function RoomFurniture({
  layout,
  isLampOn,
  onToggleLamp,
  theme,
  isNight,
}: {
  layout: RoomLayout;
  isLampOn: boolean;
  isNight: boolean;
  onToggleLamp: () => void;
  theme: FurnitureTheme;
}) {
  const editing = useRoomEditor((state) => Boolean(state.draft));
  const books = useLibraryStore((state) => state.books);
  const photo = useLibraryStore((state) => state.pictureFramePhotoUri);
  const posterBookId = useLibraryStore((state) => state.leftWallPosterBookId);
  return (
    <>
      {layout.pieces
        .filter((p) => p.surface !== "desk" && p.category !== "cat")
        .map((piece) => (
          <RoomPieceGroup key={piece.id} piece={piece}>
            <group
              scale={
                piece.category === "frame" && piece.aspect === "portrait"
                  ? [0.8, 1.45, 1]
                  : 1
              }
            >
              <RoomModel piece={piece} />
            </group>
            {piece.surface === "floor" && piece.category !== "rug" ? (
              <ContactShadow piece={piece} isNight={isNight} />
            ) : null}
            {piece.category === "desk"
              ? layout.pieces
                  .filter((p) => p.surface === "desk")
                  .map((p) => (
                    <RoomPieceGroup key={p.id} piece={p}>
                      <RoomModel piece={p} />
                    </RoomPieceGroup>
                  ))
              : null}
            {piece.category === "window" ? (
              <RoomWindow contentOnly ambience={isNight ? "night" : "day"} />
            ) : null}
            {piece.category === "frame" ? (
              <group scale={piece.aspect === "portrait" ? [0.8, 1.45, 1] : 1}>
                {piece.bookId ? (
                  <RoomPoster
                    contentOnly
                    book={
                      books.find(
                        (b) => b.id === (piece.bookId ?? posterBookId),
                      ) ?? books[0]
                    }
                  />
                ) : (
                  <RoomPictureFrame
                    contentOnly
                    photoUriOverride={
                      piece.photoUri ?? (piece.id === "frame" ? photo : null)
                    }
                  />
                )}
              </group>
            ) : null}
            {piece.category === "lamp" ? (
              <>
                {isLampOn ? (
                  <pointLight
                    color={theme.lampColor}
                    distance={theme.lampDistance}
                    intensity={theme.lampIntensity}
                    position={[0, 2.1, 0.15]}
                  />
                ) : null}
                <mesh position={[0, 2.12, 0]}>
                  <sphereGeometry args={[0.075, 10, 10]} />
                  <meshBasicMaterial color={isLampOn ? "#FFF0CC" : "#6D5B47"} />
                </mesh>
                {!editing ? (
                  <mesh
                    position={[0, 1.25, 0]}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleLamp();
                    }}
                  >
                    <cylinderGeometry args={[0.48, 0.48, 2.5, 8]} />
                    <meshBasicMaterial
                      transparent
                      opacity={0}
                      depthWrite={false}
                    />
                  </mesh>
                ) : null}
              </>
            ) : null}
          </RoomPieceGroup>
        ))}
    </>
  );
}
