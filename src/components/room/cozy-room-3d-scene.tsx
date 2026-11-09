/* eslint-disable @typescript-eslint/no-require-imports */
import { COLLECTION_ASSETS } from '@/src/components/room/room-collection-assets';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { Renderer, TextureLoader } from 'expo-three';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { getWallPalette, getFloorPalette } from '@/src/types/room-customization';
import { cacheAvatar } from '@/src/services/profile-avatar';
import { ROOM_PHOTOS_BUCKET } from '@/src/services/room-photos';
import { supabase } from '@/src/services/supabase';
import { ROOM_DESK_SCALE, roomDeskHeight, roomFurnitureScale, roomPlantScale, getRugVariant, roomRugSupports, pieceBounds, roomWallHeight, type RoomLayout, type RoomPiece } from '@/src/types/room-layout';

const HEIGHT_UNIT = Math.sqrt(2 / 3);
const SRGB_ENCODING = (THREE as typeof THREE & { sRGBEncoding: number }).sRGBEncoding;
const MODEL_ASSETS = {
  desk: require('@/output/room-3d-prototype/glb/mesa.glb'),
  seat: require('@/output/room-3d-prototype/glb/cadeira.glb'),
  ...COLLECTION_ASSETS,
  bookcase: require('@/output/room-3d-prototype/glb/estante.glb'),
  book: require('@/output/room-3d-prototype/glb/livro.glb'),
  openBook: require('@/output/room-3d-prototype/glb/livro-aberto.glb'),
  lamp: require('@/output/room-3d-prototype/glb/luminaria.glb'),
  pillow: require('@/output/room-3d-prototype/glb/almofada.glb'),
  plant: require('@/output/room-3d-prototype/glb/planta.glb'),
  frame: require('@/output/room-3d-prototype/glb/quadro.glb'),
  poster: require('@/output/room-collections/poster.glb'),
  rug: require('@/output/room-3d-prototype/glb/tapete.glb'),
  floor: require('@/output/room-3d-prototype/glb/piso.glb'),
  leftWall: require('@/output/room-3d-prototype/glb/parede-esquerda.glb'),
  backWall: require('@/output/room-3d-prototype/glb/parede-direita.glb'),
} as const;

type ModelKey = keyof typeof MODEL_ASSETS;
type RoomBook = { id: string; status: string; coverColor: string; coverUrl?: string };
export type RoomHit = { pieceId: string; category: RoomPiece['category']; bookId?: string };
export type CozyRoom3DHandle = { snapshot: (ambience?: 'day' | 'night') => Promise<string>; hitTest: (x: number, y: number, width: number, height: number) => RoomHit | null };

type Props = {
  layout: RoomLayout;
  books: RoomBook[];
  deskBookIds: string[];
  width: number;
  height: number;
  originY: number;
  tile: number;
  rotation: number;
  isNight: boolean;
  isSunset: boolean;
  isLampOn: boolean;
  isActive: boolean;
  reduceMotion: boolean;
  wallPaletteId: string;
  floorPaletteId: string;
  rugPaletteId: string;
  bookcasePaletteId: string;
  windowStyleId: string;
  photoUris?: Record<string, string>;
  onReady: () => void;
  onError: () => void;
  style?: StyleProp<ViewStyle>;
};

type TextureEntry = { texture: THREE.Texture; loaded: boolean; listeners: Set<(texture: THREE.Texture) => void> };
type Runtime = {
  gl: ExpoWebGLRenderingContext;
  renderer: Renderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  modelSources: Map<ModelKey, THREE.Group>;
  shell: THREE.Group;
  pieces: THREE.Group;
  roots: Map<string, THREE.Group>;
  framePlanes: Map<string, THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>>;
  books: Map<string, THREE.Group>;
  textureLoader: TextureLoader;
  textures: Map<string, TextureEntry>;
  textureCopies: Set<THREE.Texture>;
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  fillLight: THREE.HemisphereLight;
  keyLight: THREE.DirectionalLight;
  lampLight?: THREE.PointLight;
  render: () => void;
};

const MODEL_BY_CATEGORY: Partial<Record<RoomPiece['category'], ModelKey>> = {
  desk: 'desk', seat: 'seat', bookcase: 'bookcase', lamp: 'lamp', frame: 'frame', poster: 'poster', rug: 'rug', plant: 'plant', pillow: 'pillow',
};

function pieceModelKey(piece: RoomPiece): ModelKey | undefined {
  const rug = piece.category === 'rug' ? getRugVariant(piece.modelId) : undefined;
  if (rug && ['observatory', 'teahouse'].includes(rug.theme.id)) return piece.modelId as ModelKey;
  if (rug) return rug.shape === 'rectangle'
    ? (rug.theme.id === 'isometric' ? 'rug' : 'botanic-rug')
    : `library-${rug.shape}-rug`;
  return piece.modelId in COLLECTION_ASSETS ? piece.modelId as ModelKey : MODEL_BY_CATEGORY[piece.category];
}

function loadModel(source: number): Promise<THREE.Group> {
  return (async () => {
    const asset = Asset.fromModule(source);
    await asset.downloadAsync();
    if (!asset.localUri) throw new Error('Não foi possível baixar um modelo do quarto.');
    const buffer = await new File(asset.localUri).arrayBuffer();
    const gltf = await new GLTFLoader().parseAsync(buffer, '');
    if (!gltf.scene) throw new Error(`O arquivo ${asset.name} não contém uma cena GLB.`);
    return gltf.scene;
  })();
}

function cloneModel(source: THREE.Group) {
  const clone = source.clone(true);
  clone.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !object.material) return;
    const cloneMaterial = (material: THREE.Material) => {
      if (material.name.split('.')[0] === 'cozy_outline' && material instanceof THREE.MeshStandardMaterial) {
        // Ink contours keep their color instead of receiving the lamp's lighting.
        const outline = new THREE.MeshBasicMaterial({ color: material.color, side: material.side });
        outline.name = material.name;
        return outline;
      }
      return material.clone();
    };
    object.material = Array.isArray(object.material)
      ? object.material.map(cloneMaterial)
      : cloneMaterial(object.material);
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (material instanceof THREE.MeshStandardMaterial) material.userData.originalColor = material.color.toArray();
    }
  });
  return clone;
}

function getSourceModel(runtime: Runtime, key: ModelKey) {
  const model = runtime.modelSources.get(key);
  if (!model) throw new Error(`O modelo 3D "${key}" não foi carregado.`);
  return model;
}

function setSRGBEncoding(texture: THREE.Texture) {
  (texture as THREE.Texture & { encoding: number }).encoding = SRGB_ENCODING;
}

function shade(color: string, night: boolean, factor = 0.54) {
  const result = new THREE.Color(color).convertSRGBToLinear();
  if (night) result.multiplyScalar(Math.max(0.7, factor));
  return result;
}

function setMaterialColor(material: THREE.Material, color: string, night: boolean, factor?: number) {
  const candidate = material as THREE.MeshStandardMaterial;
  if ('color' in candidate && candidate.color instanceof THREE.Color) candidate.color.copy(shade(color, night, factor));
}

function markInteractive(root: THREE.Object3D, piece: RoomPiece) {
  root.userData.pieceId = piece.id;
  root.userData.category = piece.category;
  root.traverse((child) => {
    child.userData.pieceId = piece.id;
    child.userData.category = piece.category;
  });
}

function disposeRoot(root: THREE.Group) {
  root.parent?.remove(root);
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.userData.insetFrameGeometry?.dispose();
    if (object.userData.ownedFrameGeometry) object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      const map = (material as THREE.MeshStandardMaterial).map;
      if (map) map.dispose();
      material.dispose();
    });
  });
}

function addBoxOutline(mesh: THREE.Mesh, thickness = 0.012) {
  const geometry = mesh.geometry.clone();
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    positions.setXYZ(i,
      positions.getX(i) + Math.sign(positions.getX(i)) * thickness,
      positions.getY(i) + Math.sign(positions.getY(i)) * thickness,
      positions.getZ(i) + Math.sign(positions.getZ(i)) * thickness);
  }
  const outline = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: new THREE.Color('#3C2B22').convertSRGBToLinear(), side: THREE.BackSide }));
  outline.name = 'cozy-box-outline';
  outline.userData.ownedFrameGeometry = true;
  mesh.add(outline);
}

function addFrameRing(parent: THREE.Group, width: number, height: number, openingWidth: number, openingHeight: number, depth: number, material: THREE.Material, thickness: number) {
  const geometry = (w: number, h: number, innerW: number, innerH: number, d: number) => {
    const shape = new THREE.Shape();
    shape.moveTo(-w/2, -h/2); shape.lineTo(w/2, -h/2);
    shape.lineTo(w/2, h/2); shape.lineTo(-w/2, h/2); shape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-innerW/2, -innerH/2); hole.lineTo(-innerW/2, innerH/2);
    hole.lineTo(innerW/2, innerH/2); hole.lineTo(innerW/2, -innerH/2); hole.closePath();
    shape.holes.push(hole);
    return new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, steps: 1, curveSegments: 1 });
  };
  const frame = new THREE.Mesh(geometry(width, height, openingWidth, openingHeight, depth), material);
  const outline = new THREE.Mesh(geometry(width+thickness*2, height+thickness*2, openingWidth-thickness*2, openingHeight-thickness*2, depth+thickness*2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#3C2B22').convertSRGBToLinear(), side: THREE.BackSide }));
  outline.position.z = -thickness;
  frame.userData.ownedFrameGeometry = outline.userData.ownedFrameGeometry = true;
  frame.add(outline);
  parent.add(frame);
  return frame;
}

function addWindow() {
  const windowStyle = { frameColor: '#E7AE69', mullionColor: '#E7AE69' };
  const root = new THREE.Group();
  root.name = 'janela-cozy';
  const frame = new THREE.MeshStandardMaterial({ color: windowStyle.frameColor, roughness: 0.78 });
  const glass = new THREE.MeshStandardMaterial({ color: '#A8C7C3', roughness: 0.28, metalness: 0.04 });
  const mullion = new THREE.MeshStandardMaterial({ color: windowStyle.mullionColor, roughness: 0.8 });
  frame.name = 'window_frame';
  glass.name = 'window_glass';
  mullion.name = 'window_mullion';
  const addBox = (name: string, size: [number, number, number], position: [number, number, number], material: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material.clone());
    mesh.name = name;
    mesh.position.set(...position);
    mesh.userData.ownedFrameGeometry = true;
    if (!name.startsWith('glass')) addBoxOutline(mesh, 0.022);
    root.add(mesh);
  };

  addBox('glass-left', [0.88, 1.72, 0.045], [-0.47, 1, 0], glass);
  addBox('glass-right', [0.88, 1.72, 0.045], [0.47, 1, 0], glass);
  const surround = addFrameRing(root, 2, 1.96, 1.76, 1.72, 0.13, frame, 0.022);
  surround.position.set(0, 1, -0.025);
  addBox('mullion-center', [0.07, 1.72, 0.15], [0, 1, 0.06], mullion);
  addBox('sill', [2.12, 0.1, 0.22], [0, 0.015, 0.07], frame);
  root.userData.windowFrameColor = windowStyle.frameColor;
  root.userData.windowMullionColor = windowStyle.mullionColor;
  return root;
}

function addFrameSurface(root: THREE.Group) {
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.582, 0.782 * HEIGHT_UNIT),
    new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 1, metalness: 0 }),
  );
  // Keep the outer outline, but remove the raised abstract-art outlines for photos.
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object.name !== 'quadro_outline') return;
    const geometry = object.geometry;
    const positions = geometry.getAttribute('position');
    const indices = geometry.index;
    const retained: number[] = [];
    for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
      const triangle = [0, 1, 2].map(offset => indices ? indices.getX(i + offset) : i + offset);
      const inside = triangle.every(vertex => Math.abs(positions.getX(vertex)) < 0.275 &&
        positions.getY(vertex) > 0.05 * HEIGHT_UNIT && positions.getY(vertex) < 0.8 * HEIGHT_UNIT);
      if (!inside) retained.push(...triangle);
    }
    const inset = geometry.clone();
    inset.setIndex(retained);
    object.userData.originalFrameGeometry = geometry;
    object.userData.insetFrameGeometry = inset;
  });
  const rim = new THREE.Group();
  rim.name = 'photo-inset-rim';
  let wood: THREE.Material | undefined;
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    wood ??= materials.find(material => ['cozy_wood', 'atelier_wood', 'teahouse_wood'].includes(material.name.split('.')[0]));
  });
  const rimMaterial = wood?.clone() ?? new THREE.MeshStandardMaterial({ color: '#E7AE69', roughness: 1 });
  // Four raised rails surround the recessed print; the opening overlaps its edges.
  const innerWidth = 0.58;
  const innerHeight = 0.78 * HEIGHT_UNIT;
  const outerWidth = 0.65;
  const outerHeight = 0.85 * HEIGHT_UNIT;
  const surround = addFrameRing(rim, outerWidth, outerHeight, innerWidth, innerHeight, 0.065, rimMaterial, 0.012);
  surround.position.set(0, outerHeight / 2, 0.025);
  rim.visible = false;
  root.add(rim);
  plane.name = 'frame-photo-surface';
  // Match the paper inset in quadro.glb, including its compressed vertical scale.
  plane.position.set(0, 0.425 * HEIGHT_UNIT, 0.0415);
  root.add(plane);
  return plane as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
}

function cacheTexture(runtime: Runtime, uri: string, onLoad: (texture: THREE.Texture) => void) {
  const existing = runtime.textures.get(uri);
  if (existing) {
    if (existing.loaded) onLoad(existing.texture);
    else existing.listeners.add(onLoad);
    return;
  }

  const entry: TextureEntry = { texture: new THREE.Texture(), loaded: false, listeners: new Set([onLoad]) };
  runtime.textures.set(uri, entry);
  entry.texture = runtime.textureLoader.load(uri, (texture) => {
    setSRGBEncoding(texture);
    entry.loaded = true;
    for (const listener of entry.listeners) listener(texture);
    entry.listeners.clear();
    runtime.render();
  }, undefined, () => {
    runtime.textures.delete(uri);
    entry.listeners.clear();
  });
}

function cropTexture(texture: THREE.Texture, targetRatio: number) {
  const image = texture.image as { width?: number; height?: number } | undefined;
  const width = image?.width ?? 0;
  const height = image?.height ?? 0;
  if (!width || !height || !targetRatio) return;
  const sourceRatio = width / height;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  if (sourceRatio > targetRatio) {
    texture.repeat.set(targetRatio / sourceRatio, 1);
    texture.offset.set((1 - texture.repeat.x) / 2, 0);
  } else {
    texture.repeat.set(1, sourceRatio / targetRatio);
    texture.offset.set(0, (1 - texture.repeat.y) / 2);
  }
  texture.needsUpdate = true;
}

function setFrameImage(runtime: Runtime, plane: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>, source: string | undefined, fallbackColor?: string) {
  const frameScale = plane.parent?.scale;
  const targetRatio = plane.geometry.parameters.width * (frameScale?.x ?? 1) /
    (plane.geometry.parameters.height * (frameScale?.y ?? 1) / HEIGHT_UNIT);
  const key = `${source ?? ''}:${fallbackColor}:${targetRatio}`;
  if (plane.userData.contentKey === key) return;
  plane.userData.contentKey = key;
  plane.visible = Boolean(source || fallbackColor);
  plane.parent?.traverse((object) => {
    if (object.name === 'photo-inset-rim') object.visible = plane.visible;
    if (!(object instanceof THREE.Mesh) || object === plane) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (material.name === 'art_terracotta' || material.name === 'cozy_leaf') material.visible = !plane.visible;
    }
    if (object.userData.insetFrameGeometry) {
      object.geometry = plane.visible ? object.userData.insetFrameGeometry : object.userData.originalFrameGeometry;
    }
  });
  if (plane.material.map) {
    runtime.textureCopies.delete(plane.material.map);
    plane.material.map.dispose();
  }
  plane.material.map = null;
  if (plane.userData.poster) plane.scale.set(1, 1, 1);
  plane.material.color.set(fallbackColor ?? '#FFFFFF').convertSRGBToLinear();
  plane.material.needsUpdate = true;
  if (!source) return;

  cacheTexture(runtime, source, (base) => {
    if (plane.parent === null || plane.userData.contentKey !== key) return;
    const texture = cloneRoomTexture(base);
    setSRGBEncoding(texture);
    cropTexture(texture, targetRatio);
    runtime.textureCopies.add(texture);
    plane.material.map = texture;
    plane.material.color.set('#FFFFFF');
    plane.material.needsUpdate = true;
  });
}

function cloneRoomTexture(base: THREE.Texture) {
  const texture = base.clone();
  texture.image = base.image;
  if ((base as THREE.Texture & { isDataTexture?: boolean }).isDataTexture) {
    (texture as THREE.Texture & { isDataTexture?: boolean }).isDataTexture = true;
  }
  return texture;
}


function updateCamera(runtime: Runtime, props: Props) {
  const ppu = props.tile / Math.SQRT2;
  const width = props.width / ppu;
  const height = props.height / ppu;
  runtime.camera.left = -width / 2;
  runtime.camera.right = width / 2;
  runtime.camera.top = height / 2;
  runtime.camera.bottom = -height / 2;
  runtime.camera.updateProjectionMatrix();

  const azimuth = Math.PI / 4 + props.rotation;
  const up = new THREE.Vector3(-Math.sin(Math.PI / 6) * Math.cos(azimuth), Math.cos(Math.PI / 6), -Math.sin(Math.PI / 6) * Math.sin(azimuth));
  const offset = (props.originY - props.height / 2) / ppu;
  const target = up.multiplyScalar(offset);
  const distance = 24;
  runtime.camera.position.copy(target).add(new THREE.Vector3(distance * Math.cos(Math.PI / 6) * Math.cos(azimuth), distance * 0.5, distance * Math.cos(Math.PI / 6) * Math.sin(azimuth)));
  runtime.camera.lookAt(target);
}

function setupShell(runtime: Runtime, props: Props) {
  if (runtime.shell.userData.roomSize !== props.layout.roomSize) {
    for (const child of [...runtime.shell.children]) {
      if (child instanceof THREE.Group) disposeRoot(child);
      else runtime.shell.remove(child);
    }
    const floor = cloneModel(getSourceModel(runtime, 'floor'));
    const leftWall = cloneModel(getSourceModel(runtime, 'leftWall'));
    const backWall = cloneModel(getSourceModel(runtime, 'backWall'));
    const scale = props.layout.roomSize / 6;
    floor.scale.set(scale, 1, scale);
    leftWall.position.set(-props.layout.roomSize / 2, 0, 0);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.scale.set(scale, roomWallHeight(props.layout.roomSize) / (3.2 * HEIGHT_UNIT), 1);
    backWall.position.set(0, 0, -props.layout.roomSize / 2);
    backWall.scale.set(scale, roomWallHeight(props.layout.roomSize) / (3.2 * HEIGHT_UNIT), 1);
    runtime.shell.add(floor, leftWall, backWall);
    runtime.shell.userData.roomSize = props.layout.roomSize;
  }
  const wall = getWallPalette(props.wallPaletteId);
  const floor = getFloorPalette(props.floorPaletteId);
  runtime.shell.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      const color = material.name === 'cozy_wall_left' ? wall.leftWallColor
        : material.name === 'cozy_wall_right' ? wall.backWallColor
        : material.name === 'cozy_floor' ? floor.plankColor
        : material.name === 'cozy_border' ? floor.baseColor : undefined;
      if (color) setMaterialColor(material, color, false);
    }
  });
}


function updateLampEffects(runtime: Runtime, props: Props) {
  const lamp = props.layout.pieces.find(piece => piece.category === 'lamp');
  const root = lamp ? runtime.roots.get(lamp.id) : undefined;
  if (root && runtime.lampLight?.parent !== root) {
    runtime.lampLight?.parent?.remove(runtime.lampLight);
    const light = new THREE.PointLight('#FFD6AA', 0, 5.5, 2);
    light.position.set(0, 2.23 * HEIGHT_UNIT, 0);
    root.add(light);
    runtime.lampLight = light;
  }
  if (root && runtime.lampLight) {
    runtime.lampLight.position.set(lamp?.modelId === 'observatory-lamp' ? 0.19 : 0,
      (lamp?.modelId === 'teahouse-lamp' ? 1.96 : 2.23) * HEIGHT_UNIT, 0);
  }
  root?.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial) || !material.name.startsWith('cozy_fabric') && !material.name.startsWith('botanic_fabric') && !material.name.startsWith('library_fabric') && !material.name.startsWith('atelier_fabric') && !material.name.startsWith('observatory_fabric') && !material.name.startsWith('teahouse_fabric')) continue;
      material.emissive.set('#FFE1B8').convertSRGBToLinear();
      material.emissiveIntensity = props.isLampOn ? (props.isNight ? 0.30 : 0.18) : 0;
    }
  });
  if (runtime.lampLight) {
    runtime.lampLight.distance = props.isNight ? 5.5 : 8.5;
    runtime.lampLight.decay = props.isNight ? 2 : 1;
    runtime.lampLight.intensity = root && props.isLampOn ? (props.isNight ? 1.15 : 0.12) : 0;
  }
}

function updateBooks(runtime: Runtime, props: Props) {
  const placements = new Map<string, { book: RoomBook; parent: THREE.Group; position: [number, number, number]; standing: boolean; scale?: number; open?: boolean }>();
  const desk = props.layout.pieces.find((piece) => piece.category === 'desk');
  if (desk) {
    const top = roomDeskHeight(desk.modelId) * HEIGHT_UNIT;
    const offsets: [number, number][] = [[-0.35, 0.12], [0.48, 0.12], [0.48, 0.12]];
    props.deskBookIds.slice(-3).forEach((id, index) => {
      const book = props.books.find((item) => item.id === id && item.status === 'reading');
      if (!book) return;
      const [x, z] = offsets[index] ?? [0, 0];
      placements.set(book.id, { book, parent: runtime.roots.get(desk.id)!, position: [x, top + Math.max(0, index - 1) * 0.06 * HEIGHT_UNIT * 1.6, z], standing: false, open: index === 0 });
    });
  }
  const shelved = props.books.filter((book) => !props.deskBookIds.includes(book.id));
  const shelves = props.layout.pieces.filter((piece) => piece.category === 'bookcase');
  let shelfOffset = 0;
  shelves.forEach((shelf) => {
    const atelier = shelf.modelId === 'atelier-bookcase';
    const observatory = shelf.modelId === 'observatory-bookcase';
    const teahouse = shelf.modelId === 'teahouse-bookcase';
    const slots = atelier || observatory || teahouse ? 7 : 8;
    const capacity = slots * (teahouse ? 2 : 4);
    shelved.slice(shelfOffset, shelfOffset + capacity).forEach((book, index) => {
      const level = Math.floor(index / slots);
      const slot = index % slots;
      // Leave the alternating niche dividers clear.
      const nicheSlots = [-0.54, -0.39, -0.07, 0.08, 0.23, 0.38, 0.53];
      const x = atelier ? (level % 2 ? -nicheSlots[6 - slot] : nicheSlots[slot]) : -0.52 + slot * 0.15;
      placements.set(book.id, { book, parent: runtime.roots.get(shelf.id)!, position: [x, (teahouse ? 0.60 + level * 0.47 : 0.08 + level * 0.63) * HEIGHT_UNIT + (teahouse ? 0.1225 : 0.21875), 0.1], standing: true, scale: teahouse ? 0.7 : 1.25 });
    });
    shelfOffset += capacity;
  });

  for (const [id, root] of runtime.books) {
    if (placements.has(id)) continue;
    disposeRoot(root);
    runtime.books.delete(id);
  }
  for (const [id, placement] of placements) {
    if (!placement.parent) continue;
    let root = runtime.books.get(id);
    if (root && root.userData.open !== Boolean(placement.open)) {
      disposeRoot(root);
      runtime.books.delete(id);
      root = undefined;
    }
    if (!root) {
      root = new THREE.Group();
      root.userData.open = Boolean(placement.open);
      root.add(cloneModel(getSourceModel(runtime, placement.open ? 'openBook' : 'book')));
      root.userData.bookId = id;
      runtime.books.set(id, root);
      placement.parent.add(root);
    } else if (root.parent !== placement.parent) {
      placement.parent.add(root);
    }
    root.position.set(...placement.position);
    root.scale.setScalar(placement.standing ? placement.scale ?? 1.25 : 1.6 / ROOM_DESK_SCALE);
    root.rotation.set(0, 0, placement.standing ? Math.PI / 2 : 0);
    root.traverse((object) => {
      object.userData.bookId = id;
      object.userData.pieceId = placement.parent.userData.pieceId;
      object.userData.category = placement.parent.userData.category;
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        const role = material.name.split('.')[0];
        // Three.js converts CSS hex colors to its linear working space.
        if (role === 'book_cover' || role === 'book_spine') material.color.set(placement.book.coverColor);
        else if (role === 'book_pages') setMaterialColor(material, '#F1E5D0', false);
      }
    });
  }
}

function updateScene(runtime: Runtime, props: Props) {
  runtime.fillLight.intensity = props.isNight ? 0.19 : props.isSunset ? 0.32 : 0.85;
  runtime.keyLight.intensity = props.isNight ? 0.085 : props.isSunset ? 0.72 : 0.55;
  runtime.fillLight.color.set(props.isNight ? '#BBC5D6' : props.isSunset ? '#E1B5CE' : '#FFF9EC');
  runtime.fillLight.groundColor.set(props.isNight ? '#484351' : props.isSunset ? '#55436A' : '#6B5846');
  runtime.keyLight.color.set(props.isNight ? '#B8C0D0' : props.isSunset ? '#FF9B59' : '#FFF2D7');
  runtime.keyLight.position.set(-3, props.isSunset ? 3 : 8, 5);
  updateCamera(runtime, props);
  runtime.gl.viewport(0, 0, runtime.gl.drawingBufferWidth, runtime.gl.drawingBufferHeight);
  setupShell(runtime, props);

  const visible = new Set(props.layout.pieces.filter((piece) => piece.category !== 'cat').map((piece) => piece.id));
  for (const [id, root] of runtime.roots) {
    if (visible.has(id)) continue;
    disposeRoot(root);
    runtime.roots.delete(id);
    runtime.framePlanes.delete(id);
  }

  const pieces = [...props.layout.pieces].filter((piece) => piece.category !== 'cat');
  pieces.sort((a, b) => Number(a.surface === 'desk') - Number(b.surface === 'desk'));
  for (const piece of pieces) {
    const desiredModel = pieceModelKey(piece);
    // Keep the current window until its collection model is ready. A procedural
    // placeholder does not carry the collection's original material colors.
    if (piece.category === 'window' && desiredModel && !runtime.modelSources.has(desiredModel)) continue;
    const modelKey = desiredModel && runtime.modelSources.has(desiredModel) ? desiredModel : MODEL_BY_CATEGORY[piece.category];
    if (!modelKey && piece.category !== 'window') continue;
    let root = runtime.roots.get(piece.id);
    const proceduralWindow = piece.category === 'window' && !modelKey;
    const expectedModel = proceduralWindow ? 'procedural-window' : modelKey;
    if (root && root.userData.modelKey !== expectedModel) {
      disposeRoot(root);
      runtime.roots.delete(piece.id);
      runtime.framePlanes.delete(piece.id);
      root = undefined;
    }
    if (!root) {
      root = proceduralWindow ? addWindow() : cloneModel(getSourceModel(runtime, modelKey!));
      root.userData.modelKey = expectedModel;
      markInteractive(root, piece);
      runtime.roots.set(piece.id, root);
      if (piece.category === 'frame') runtime.framePlanes.set(piece.id, addFrameSurface(root));
      if (piece.category === 'poster') {
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.2 * HEIGHT_UNIT),
          new THREE.MeshStandardMaterial({ color: '#F6EEDC', roughness: 1, metalness: 0 }));
        plane.position.set(0, 0.6 * HEIGHT_UNIT, 0.008);
        plane.userData.poster = true;
        plane.userData.ownedFrameGeometry = true;
        root.add(plane);
        runtime.framePlanes.set(piece.id, plane);
      }
    }
    markInteractive(root, piece);
    const parent = piece.surface === 'desk'
      ? runtime.roots.get(props.layout.pieces.find((item) => item.category === 'desk')?.id ?? '') ?? runtime.pieces
      : runtime.pieces;
    if (root.parent !== parent) parent.add(root);
    if (piece.surface === 'desk') {
      const isDeskPlant = piece.category === 'plant';
      root.position.set(piece.position[0] / ROOM_DESK_SCALE, isDeskPlant ? roomDeskHeight(props.layout.pieces.find(item => item.category === "desk")?.modelId ?? "") * HEIGHT_UNIT : piece.position[1], piece.position[2] / ROOM_DESK_SCALE);
    } else {
      root.position.set(...piece.position);
      if (piece.surface === 'floor' && piece.category !== 'rug') {
        const bounds = pieceBounds(piece);
        const onRug = props.layout.pieces.some(rug => {
          if (rug.category !== 'rug') return false;
          const dx = piece.position[0] - rug.position[0];
          const dz = piece.position[2] - rug.position[2];
          const x = dx * Math.cos(rug.rotation) + dz * Math.sin(rug.rotation);
          const z = -dx * Math.sin(rug.rotation) + dz * Math.cos(rug.rotation);
          return roomRugSupports(rug, x, z, (bounds.max[0]-bounds.min[0])/2, (bounds.max[2]-bounds.min[2])/2);
        });
        if (onRug) root.position.y += 0.045;
      }
    }
    if (piece.category === 'poster') {
      // Thin paper sits against the wall face rather than at the frame's deeper inset.
      if (piece.surface === 'back-wall') root.position.z -= 0.055;
      else root.position.x -= 0.055;
    }
    root.rotation.set(0, piece.rotation, 0);
    if (piece.category === 'window') root.scale.set(proceduralWindow ? 0.7 : 1, proceduralWindow ? 0.6 * HEIGHT_UNIT : 1, 1);
    if (['desk', 'seat', 'pillow'].includes(piece.category)) root.scale.setScalar(roomFurnitureScale(piece));
    if (piece.category === 'plant') root.scale.setScalar(roomPlantScale(piece) / (piece.surface === 'desk' ? ROOM_DESK_SCALE : 1));
    if (piece.category === 'rug') {
      const variant = getRugVariant(piece.modelId);
      if (variant) root.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          const role = material.name.split('.')[0];
          if (variant.theme.id === 'teahouse' && material instanceof THREE.MeshStandardMaterial && (role === 'teahouse_wood' || (role === 'teahouse_fabric' && !piece.color))) {
            material.color.fromArray(material.userData.originalColor);
            continue;
          }
          if (['cozy_rug', 'botanic_sage', 'library_wine', 'observatory_clay', 'teahouse_fabric'].includes(role)) {
            setMaterialColor(material, piece.color ?? variant.theme.color, false);
            if (!piece.color && variant.theme.id === 'botanic') (material as THREE.MeshStandardMaterial).color.multiplyScalar(0.88);
          }
          if (['cozy_border', 'botanic_cream', 'library_parchment', 'teahouse_wood'].includes(role)) setMaterialColor(material, variant.theme.border, false);
        }
      });
    }
    if (piece.modelId === 'observatory-desk' || piece.modelId === 'observatory-seat') {
      root.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (['observatory_top', 'observatory_back'].includes(material.name.split('.')[0]) && material instanceof THREE.MeshStandardMaterial) {
            if (piece.category === 'seat' && piece.color) setMaterialColor(material, piece.color, false);
            else material.color.fromArray(material.userData.originalColor);
          }
        }
      });
    }
    if (['plant', 'desk', 'seat', 'bookcase', 'lamp'].includes(piece.category)) {
      root.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          const role = material.name.split('.')[0];
          const wood = role.includes('wood');
          const fabric = role.includes('fabric') || role === 'botanic_sage_seat' || (piece.category === 'seat' && role === 'teahouse_clay');
          if (piece.category === 'lamp' && fabric && material instanceof THREE.MeshStandardMaterial) {
            material.color.fromArray(material.userData.originalColor);
          }
          const tint = piece.category === 'plant' ? ['plant_pot', 'plant_clay', 'cozy_ceramic'].includes(role)
            : piece.category === 'desk' ? !piece.modelId.startsWith('observatory-') && wood
            : piece.category === 'seat' ? !piece.modelId.startsWith('observatory-') && fabric
            : piece.category === 'bookcase' ? wood
            : ['atelier_clay', 'observatory_clay'].includes(role);
          if (!tint || !(material instanceof THREE.MeshStandardMaterial)) continue;
          if (piece.color && !['desk', 'bookcase'].includes(piece.category)) setMaterialColor(material, piece.color, false);
          else material.color.fromArray(material.userData.originalColor);
        }
      });
    }
    if (piece.category === 'pillow') {
      root.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (piece.modelId === 'teahouse-pillow' && !piece.color && material instanceof THREE.MeshStandardMaterial) {
            material.color.fromArray(material.userData.originalColor);
            continue;
          }
          if (['cozy_cushion', 'botanic_cream', 'library_fabric', 'atelier_fabric', 'observatory_clay', 'teahouse_clay'].includes(material.name.split('.')[0])) setMaterialColor(material, piece.color ?? (piece.modelId.startsWith('teahouse-') ? '#8C9275' : piece.modelId.startsWith('observatory-') ? '#34465E' : piece.modelId.startsWith('atelier-') ? '#EEE1C9' : piece.modelId.startsWith('library-') ? '#D8C6A0' : piece.modelId.startsWith('botanic-') ? '#EBDDC1' : '#778DAF'), false);
        }
      });
    }
    if (piece.category === 'frame' || piece.category === 'window') {
      root.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (['cozy_wood', 'window_frame', 'window_mullion', 'library_wood', 'atelier_wood', 'observatory_wood', 'teahouse_wood'].includes(material.name.split('.')[0])) {
            if (piece.modelId.startsWith('teahouse-') && !piece.color && material instanceof THREE.MeshStandardMaterial) {
              material.color.fromArray(material.userData.originalColor);
              continue;
            }
            setMaterialColor(material, piece.color ?? (piece.modelId.startsWith('teahouse-') ? '#9A734D' : piece.modelId.startsWith('observatory-') ? '#B89A61' : piece.modelId.startsWith('atelier-') ? '#C89E68' : piece.modelId === 'library-window' ? '#85603F' : '#E7AE69'), false);
          }
        }
      });
    }
    if (piece.category === 'frame' || piece.category === 'poster') {
      // Both formats share a generous width; portrait gains height rather than narrowing.
      if (piece.category === 'frame') root.scale.set(0.7 / 0.65, (piece.aspect === 'portrait' ? 0.97 : 0.7) / 0.85, 1);
      const plane = runtime.framePlanes.get(piece.id);
      if (plane) {
        const book = piece.category === 'poster' ? props.books.find((item) => item.id === piece.bookId && item.status === 'completed') : undefined;
        const photo = piece.photo?.source === 'none' ? undefined : piece.photo?.localUri ?? piece.photoUri ?? piece.photo?.providerUrl ?? props.photoUris?.[piece.id];
        const source = piece.bookId ? book?.coverUrl : photo;
        const color = piece.bookId ? book?.coverColor ?? '#E9D2A8' : source ? '#F2E7D6' : undefined;
        plane.userData.bookId = piece.bookId && book ? book.id : undefined;
        setFrameImage(runtime, plane, source, color);
      }
    }
  }

  updateBooks(runtime, props);
  updateLampEffects(runtime, props);
  runtime.render();
}

export const CozyRoom3DScene = forwardRef<CozyRoom3DHandle, Props>(function CozyRoom3DScene(props, ref) {
  const latest = useRef(props);
  const runtime = useRef<Runtime | null>(null);
  const [loaded, setLoaded] = useState(false);
  const loadingCollection = useRef(new Set<ModelKey>());
  const photoKey = props.layout.pieces
    .filter((piece) => ['frame', 'poster'].includes(piece.category))
    .map((piece) => `${piece.id}:${piece.photo?.source ?? ''}:${piece.photo?.version ?? ''}:${piece.photo?.localUri ?? ''}:${piece.photo?.storagePath ?? ''}:${piece.photo?.providerUrl ?? ''}:${piece.photoUri ?? ''}`)
    .join('|');
  const [photoUris, setPhotoUris] = useState<Record<string, string>>({});
  const resolvedProps = { ...props, photoUris };
  latest.current = resolvedProps;

  useEffect(() => {
    const current = runtime.current;
    if (!loaded || !current) return;
    const variants = new Set(props.layout.pieces.map(pieceModelKey).filter((key): key is ModelKey => Boolean(key)));
    for (const key of variants) {
      if (!(key in COLLECTION_ASSETS) || current.modelSources.has(key) || loadingCollection.current.has(key)) continue;
      loadingCollection.current.add(key);
      void loadModel(MODEL_ASSETS[key]).then(model => {
        if (runtime.current !== current) return;
        current.modelSources.set(key, model);
        updateScene(current, latest.current);
      }).catch(error => { console.error('Falha ao carregar modelo do catálogo:', error); })
        .finally(() => { loadingCollection.current.delete(key); });
    }
  }, [loaded, props.layout]);

  useEffect(() => {
    let active = true;
    const frames = latest.current.layout.pieces.filter((piece) => ['frame', 'poster'].includes(piece.category) && piece.photo && piece.photo.source !== 'none');
    const local = Object.fromEntries(frames.flatMap((piece) => {
      const uri = piece.photo?.localUri ?? piece.photoUri ?? piece.photo?.providerUrl;
      return uri ? [[piece.id, uri]] : [];
    }));
    setPhotoUris((current) => Object.keys(current).length === Object.keys(local).length
      && Object.entries(local).every(([id, uri]) => current[id] === uri) ? current : local);
    void Promise.all(frames.filter((piece) => !local[piece.id] && piece.photo).map(async (piece) => {
      try {
        const uri = await cacheAvatar(supabase, 'room', piece.photo!, ROOM_PHOTOS_BUCKET);
        return uri ? [piece.id, uri] as const : null;
      } catch {
        return null;
      }
    })).then((resolved) => {
      if (!active) return;
      setPhotoUris((current) => ({ ...current, ...Object.fromEntries(resolved.filter((item): item is readonly [string, string] => Boolean(item))) }));
    });
    return () => { active = false; };
  }, [photoKey]);

  useImperativeHandle(ref, () => ({
    async snapshot(ambience) {
      const scene = runtime.current;
      if (!scene) throw new Error('A cena 3D ainda não está pronta.');
      updateScene(scene, { ...latest.current,
        isNight: ambience ? ambience === 'night' : latest.current.isNight,
        isSunset: !ambience && latest.current.isSunset, });
      // Read the freshly rendered framebuffer before presenting/discarding it.
      scene.renderer.render(scene.scene, scene.camera);
      try {
        const snapshot = await GLView.takeSnapshotAsync(scene.gl, { format: 'png', flip: false });
        if (!snapshot.localUri) throw new Error('Não foi possível capturar a camada 3D.');
        return snapshot.localUri;
      } finally {
        scene.gl.endFrameEXP();
      }
    },
    hitTest(x, y, width, height) {
      const scene = runtime.current;
      if (!scene || !width || !height) return null;
      scene.pointer.set((x / width) * 2 - 1, 1 - (y / height) * 2);
      scene.raycaster.setFromCamera(scene.pointer, scene.camera);
      const hits = scene.raycaster.intersectObjects(scene.pieces.children, true);
      const object = hits.find((hit) => typeof hit.object.userData.pieceId === 'string')?.object;
      if (!object) return null;
      return {
        pieceId: object.userData.pieceId as string,
        category: object.userData.category as RoomPiece['category'],
        bookId: typeof object.userData.bookId === 'string' ? object.userData.bookId : undefined,
      };
    },
  }), []);

  const onContextCreate = useCallback(async (gl: ExpoWebGLRenderingContext) => {
    if (runtime.current) return;
    let created: Runtime | undefined;
    try {
      const renderer = new Renderer({ gl, alpha: true, antialias: true, pixelRatio: 1 });
      (renderer as Renderer & { outputEncoding: number }).outputEncoding = SRGB_ENCODING;
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.setClearColor('#000000', 0);
      const scene = new THREE.Scene();
      const fillLight = new THREE.HemisphereLight('#FFF9EC', '#6B5846', 0.48);
      scene.add(fillLight);
      const keyLight = new THREE.DirectionalLight('#FFF2D7', 0.22);
      keyLight.position.set(-3, 8, 5);
      scene.add(keyLight);
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
      const shell = new THREE.Group();
      const pieces = new THREE.Group();
      scene.add(shell, pieces);
      const nextRuntime: Runtime = {
        gl,
        renderer,
        scene,
        camera,
        fillLight,
        keyLight,
        modelSources: new Map(),
        shell,
        pieces,
        roots: new Map(),
        framePlanes: new Map(),
        books: new Map(),
        textureLoader: new TextureLoader(),
        textures: new Map(),
        textureCopies: new Set(),
        raycaster: new THREE.Raycaster(),
        pointer: new THREE.Vector2(),
        render: () => {
          renderer.render(scene, camera);
          gl.endFrameEXP();
        },
      };
      created = nextRuntime;
      runtime.current = nextRuntime;
      await Promise.all(Object.entries(MODEL_ASSETS).filter(([key]) => !(key in COLLECTION_ASSETS)).map(async ([key, source]) => {
        nextRuntime.modelSources.set(key as ModelKey, await loadModel(source));
      }));
      if (runtime.current !== created) return;
      setLoaded(true);
      updateScene(created, latest.current);
      latest.current.onReady();
    } catch (error) {
      if (created && runtime.current !== created) return;
      console.error('Falha ao iniciar a cena 3D do quarto:', error);
      latest.current.onError();
    }
  }, []);

  useEffect(() => {
    if (!loaded || !runtime.current) return;
    try {
      updateScene(runtime.current, latest.current);
    } catch (error) {
      console.error('Falha ao atualizar a cena 3D do quarto:', error);
      latest.current.onError();
    }
  }, [loaded, props.isActive, props.layout, props.books, props.deskBookIds, props.width, props.height, props.originY, props.tile, props.rotation, props.isNight, props.isSunset, props.isLampOn, props.wallPaletteId, props.floorPaletteId, props.rugPaletteId, props.bookcasePaletteId, props.windowStyleId, photoUris]);

  useEffect(() => () => {
    const current = runtime.current;
    if (!current) return;
    current.scene.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.userData.insetFrameGeometry?.dispose();
        if (object.userData.ownedFrameGeometry) object.geometry.dispose();
      }
    });
    current.renderer.dispose();
    for (const texture of current.textureCopies) texture.dispose();
    for (const entry of current.textures.values()) entry.texture.dispose();
    runtime.current = null;
  }, []);

  return (
    <View pointerEvents="none" style={[styles.fill, props.style]}>
      <GLView
        onContextCreate={onContextCreate}
        style={styles.fill}
        msaaSamples={4}
      />
    </View>
  );
});

const styles = StyleSheet.create({ fill: StyleSheet.absoluteFill });
