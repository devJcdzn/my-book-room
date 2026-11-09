import { SegmentedTabs } from '@/src/components/segmented-tabs';
import { showSaveFailure, showSaveFeedback } from '@/src/components/save-feedback';
import { showAlert } from '@/src/components/app-dialog';
import { IAP_ENABLED } from '@/src/config/features';
import { lockedCollection, useCollectionPurchases } from '@/src/services/collection-access';
import { openCollectionPaywall, restoreCollectionPurchases } from '@/src/services/collection-purchases';
import { COLLECTION_PREVIEWS, COLLECTION_SHOWCASES, RUG_PREVIEWS } from '@/src/components/room/room-collection-assets';
import { ROOM_COLOR_CATEGORIES } from "@/src/types/room-customization";
import { trackEvent } from '@/src/services/analytics';
import { colors, controls, darkTheme, radii, typography } from "@/src/theme";
import React, { useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { cacheAvatar, prepareAvatar } from '@/src/services/profile-avatar';
import { ROOM_PHOTOS_BUCKET } from '@/src/services/room-photos';
import { supabase } from '@/src/services/supabase';
import { BookCover } from '@/src/components/book-cover';
import type { Book } from '@/src/types/book';

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RoomAppearanceOptions, RoomColorCategories, RoomColorSwatch } from "@/src/components/room/room-customization-overlay";
import { useRoomEditor } from "@/src/store/room-editor-store";
import { useLibraryStore } from "@/src/store/library-store";
import {
  PLANT_VARIANTS,
  getRugVariant,
  RUG_SHAPES,
  RUG_VARIANTS,
  type RugShape,
  isRoomPlacementValid,
  MAX_EXTRA_DECORATIONS,
  nudgeRoomPiece,
  roomPieceMoveStep,
  roomDeskHeight,
  ROOM_CATEGORIES,
  snapRoomRotation,
  ROOM_ROTATION_STEP,
  type RoomCategory,
  type RoomPiece,
} from "@/src/types/room-layout";

type Tool = "pieces" | "position" | "model" | "finish" | "art" | "environment";
type Icon = React.ComponentProps<typeof Ionicons>["name"];
const tools: { id: Tool; label: string; icon: Icon }[] = [
  { id: "pieces", label: "Peças", icon: "grid-outline" },
  { id: "position", label: "Mover", icon: "move-outline" },
  { id: "model", label: "Coleções", icon: "grid-outline" },
  { id: "finish", label: "Cores", icon: "color-palette-outline" },
  { id: "art", label: "Imagem", icon: "image-outline" },
  { id: "environment", label: "Sala", icon: "layers-outline" },
];
const ROOM_PREVIEWS: Record<RoomCategory, number> = {
  desk: require('@/assets/isometric-room/desk-0.png'),
  seat: require('@/assets/isometric-room/seat-0.png'),
  bookcase: require('@/assets/isometric-room/bookcase-0.png'),
  lamp: require('@/assets/isometric-room/lamp-0.png'),
  plant: require('@/assets/isometric-room/plant-0.png'),
  rug: require('@/assets/isometric-room/rug-0.png'),
  pillow: require('@/assets/isometric-room/pillow-0.png'),
  window: require('@/assets/isometric-room/window-0.png'),
  frame: require('@/assets/isometric-room/frame-0.png'),
  poster: require('@/output/room-collections/poster.png'),
  cat: require('@/assets/isometric-room/cat-0-00.png'),
};
const COLLECTION_PALETTES = [
  { id: "isometric", name: "Original", wallPaletteId: "mist-blue", floorPaletteId: "ash-wood" },
  { id: "botanic", name: "Botânica", wallPaletteId: "botanic-sage", floorPaletteId: "botanic-birch" },
  { id: "atelier", name: "Ateliê", wallPaletteId: "atelier-clay", floorPaletteId: "atelier-honey" },
  { id: "library", name: "Biblioteca", wallPaletteId: "library-parchment", floorPaletteId: "library-walnut" },
  { id: "observatory", name: "Observatório", wallPaletteId: "observatory-blue", floorPaletteId: "observatory-oak" },
  { id: "teahouse", name: "Casa de Chá", wallPaletteId: "teahouse-sand", floorPaletteId: "teahouse-wood" },
];
const COLLECTION_MARKS = Object.fromEntries(ROOM_COLOR_CATEGORIES.map(category => [
  category.id === 'base' ? 'isometric' : category.id,
  category.id === 'base' ? { name: 'Original', colors: ['#CCD6DD', '#A49C90', '#8E8492'] } : category,
]));

const collectionMark = (modelId: string) => {
  const collection = COLLECTION_MARKS[modelId.split('-')[0]];
  return collection ? <View accessible accessibilityLabel={`Coleção ${collection.name}`} style={{ flexDirection: 'row', gap: 4, marginVertical: 6 }}>
    {collection.colors.map(color => <View key={color} style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: color }} />)}
  </View> : null;
};
const nextDecorationId = (category: string) => `${category}-${Date.now()}`;
const categoryName = (category: RoomCategory) =>
  category === "poster" ? "Pôster" : category === "frame"
    ? "Quadro"
    : category === "plant"
      ? "Planta"
      : (ROOM_CATEGORIES.find((c) => c.id === category)?.name ?? category);
const surfaceName = (piece: RoomPiece) =>
  ({
    floor: "No piso",
    desk: "Sobre a mesa",
    "back-wall": "Parede do fundo",
    "left-wall": "Parede esquerda",
  })[piece.surface];
const feedback = (valid = true) => {
  if (process.env.EXPO_OS !== "web")
    void (valid
      ? Haptics.selectionAsync()
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
};

export function RoomEditorPanel({
  isNight,
  onClose,
  onHeightChange,
  onToolbarHeightChange,
  loadingCatId,
}: {
  isNight: boolean;
  onClose: () => void;
  onHeightChange: (height: number) => void;
  onToolbarHeightChange: (height: number) => void;
  initialCategory?: RoomCategory;
  loadingCatId?: string | null;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const {
    draft,
    appearance,
    setAppearance,
    setCameraMode,
    selectedId,
    invalid,
    past,
    future,
    select,
    update,
    add,
    remove,
    close,
    undo,
    redo,
  } = useRoomEditor();
  const owned = useCollectionPurchases(state => state.owned);
  const purchaseBusy = useCollectionPurchases(state => state.busy);
  const books = useLibraryStore((state) => state.books);
  const completedBooks = books.filter((book) => book.status === 'completed');
  const setLayout = useLibraryStore((state) => state.setRoomLayout);
  const [busy, setBusy] = useState(false);
  const [tool, setTool] = useState<Tool>("pieces");
  const [emptyCategory, setEmptyCategory] = useState<RoomCategory | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [colorFilter, setColorFilter] = useState<{ selection: string; category: string } | null>(null);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const openCollection = (id: string) => { setCollectionId(id); setGalleryIndex(0); setCollapsed(false); };
  const collection = COLLECTION_PALETTES.find(item => item.id === collectionId);
  const [environmentTab, setEnvironmentTab] = useState<"collections" | "size" | "colors">("collections");
  const selectedModelId = draft?.pieces.find(piece => piece.id === selectedId)?.modelId;
  const rugSelectionKey = `${selectedId}:${selectedModelId}`;
  const colorCategory = colorFilter?.selection === rugSelectionKey ? colorFilter.category :
    ROOM_COLOR_CATEGORIES.find(category => category.id !== 'base' && selectedModelId?.startsWith(`${category.id}-`))?.id ?? 'base';
  const [rugFilter, setRugFilter] = useState<{ selection: string; shape: RugShape } | null>(null);
  const rugShape = rugFilter?.selection === rugSelectionKey ? rugFilter.shape : getRugVariant(selectedModelId ?? '')?.shape ?? 'rectangle';
  const previousSelection = useRef(selectedId);
  useEffect(() => {
    if (selectedId && selectedId !== previousSelection.current) {
      setTool("position");
      setCollapsed(false);
    }
    if (!selectedId && previousSelection.current && tool !== "environment") setTool("pieces");
    previousSelection.current = selectedId;
  // Changing tools keeps the selected item on its current page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);
  useEffect(() => { setCameraMode(collapsed); }, [collapsed, setCameraMode]);
  const heldArrow = useRef(false);
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopRepeat = () => {
    if (repeat.current) clearInterval(repeat.current);
    repeat.current = null;
    useRoomEditor.getState().endMove();
  };
  useEffect(
    () => () => {
      if (repeat.current) clearInterval(repeat.current);
      useRoomEditor.getState().endMove();
    },
    [],
  );
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (collectionId) { setCollectionId(null); return true; }
        useRoomEditor.getState().close();
        onClose();
        return true;
      },
    );
    return () => subscription.remove();
  }, [onClose, collectionId]);
  if (!draft) return null;
  const selected = draft.pieces.find((p) => p.id === selectedId);
  const text = { color: isNight ? darkTheme.text : colors.ink };
  const accent = isNight ? darkTheme.selectionText : colors.sageDark;
  const active = { borderColor: accent, backgroundColor: isNight ? darkTheme.selection : colors.sageSoft };
  const primary = { backgroundColor: isNight ? darkTheme.primary : colors.ink };
  const primaryText = { color: isNight ? darkTheme.actionText : colors.paper };
  const dangerColor = isNight ? darkTheme.danger : colors.danger;
  const muted = { color: isNight ? darkTheme.textMuted : colors.muted };
  const surface = { backgroundColor: isNight ? darkTheme.surface : colors.paper };
  const control = { backgroundColor: isNight ? darkTheme.surfaceElevated : colors.softFill };
  const finish = () => {
    close();
    onClose();
  };
  const placeNew = (piece: RoomPiece) => {
    // Find a free slot rather than creating overlapping duplicates.
    if (piece.surface === "desk") {
      for (const z of [-0.2, 0.2]) for (const x of [0.5, 0, -0.5]) {
        const candidate = { ...piece, position: [x, roomDeskHeight(draft.pieces.find(item => item.category === "desk")?.modelId ?? "") * Math.sqrt(2 / 3), z] as [number, number, number] };
        if (isRoomPlacementValid(candidate, draft.pieces, draft.roomSize)) return add(candidate);
      }
    } else if (piece.surface === "floor") {
      for (let z = -draft.roomSize / 2 + 0.5; z < draft.roomSize / 2; z += 0.5)
        for (let x = -draft.roomSize / 2 + 0.5; x < draft.roomSize / 2; x += 0.5) {
          const candidate = {
            ...piece,
            position: [Math.round(x * 10) / 10, 0, Math.round(z * 10) / 10] as [
              number,
              number,
              number,
            ],
          };
          if (isRoomPlacementValid(candidate, draft.pieces, draft.roomSize))
            return add(candidate);
        }
    } else {
      for (const surface of ["back-wall", "left-wall"] as const)
        for (let h = -draft.roomSize / 2 + 0.5; h < draft.roomSize / 2; h += 0.5)
          for (let y = 1; y <= 2.5; y += 0.5) {
            const candidate = {
              ...piece,
              surface,
              rotation: surface === "left-wall" ? Math.PI / 2 : 0,
              position: (surface === "left-wall"
                ? [-draft.roomSize / 2 + 0.12, y, h]
                : [h, y, -draft.roomSize / 2 + 0.12]) as [number, number, number],
            };
            if (isRoomPlacementValid(candidate, draft.pieces, draft.roomSize))
              return add(candidate);
          }
    }
    showAlert("Sem espaço", "Mova algumas peças para abrir espaço.");
    return false;
  };
  const choosePhoto = async () => {
    if (!selected || busy) return;
    const id = selected.id;
    setBusy(true);
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: selected.category !== "poster",
        aspect: selected.category === "poster" ? [1, 2] : selected.aspect === "portrait" ? [1, 1.4] : [1, 1],
        quality: 0.85,
      });
      if (picked.canceled) return;
      const storageName = useLibraryStore.persist.getOptions().name ?? '';
      const scope = storageName.includes('user:') ? storageName.split('user:')[1] : 'guest';
      const photo = await prepareAvatar(picked.assets[0].uri, scope, selected.photo, ROOM_PHOTOS_BUCKET, 1024);
      const current = useRoomEditor
        .getState()
        .draft?.pieces.find((p) => p.id === id);
      if (current)
        update({ ...current, photo, photoUri: photo.localUri, bookId: undefined });
    } catch {
      showAlert(
        "Foto indisponível",
        "Não foi possível abrir esta foto. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  };
  const requireAccess = (id: string | undefined) => {
    const locked = lockedCollection(id, owned);
    if (locked) { void openCollectionPaywall(locked); return false; }
    return true;
  };
  const apply = (piece: RoomPiece) => {
    if (selected?.modelId !== piece.modelId && lockedCollection(piece.color, owned)) piece = { ...piece, color: undefined };
    if (requireAccess(piece.modelId) && requireAccess(piece.color)) feedback(update(piece));
  };
  const action = (
    label: string,
    onPress: () => void,
    options: {
      icon?: Icon;
      disabled?: boolean;
      primary?: boolean;
      quiet?: boolean;
      danger?: boolean;
      iconOnly?: boolean;
      grow?: boolean;
    } = {},
  ) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: options.disabled ?? false }}
      disabled={options.disabled}
      onPress={onPress}
      style={({ pressed }) => [
        options.iconOnly ? styles.iconButton : styles.button,
        options.primary ? primary : options.quiet ? undefined : control,
        options.grow && styles.flex,
        options.disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {options.icon ? (
        <Ionicons
          name={options.icon}
          size={20}
          color={
            options.primary
              ? primaryText.color
              : options.danger
                ? dangerColor
                : text.color
          }
        />
      ) : null}
      {!options.iconOnly ? (
        <Text
          style={[
            styles.actionLabel,
            text,
            options.primary && primaryText,
            options.danger && { color: dangerColor },
          ]}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
  const extraCount = draft.pieces.filter(piece => piece.category !== "poster").length;
  const canDuplicate = selected && !["cat", "plant"].includes(selected.category);
  const canRemove = selected && selected.category !== "cat" &&
    !(selected.category === "pillow" && selected.id === draft.pieces.find(piece => piece.category === "pillow")?.id) &&
    (!(selected.category === "desk" || selected.category === "bookcase") || draft.pieces.filter(p => p.category === selected.category).length > 1);
  const addDecoration = (category: RoomCategory, surface?: "floor" | "desk", modelId?: string) => {
    const existing = draft.pieces.find((p) => p.category === category);
    const piece: RoomPiece = {
      id: category === "window" ? "window" : nextDecorationId(category),
      category,
      modelId: modelId ?? (selected?.category === category ? selected.modelId : existing?.modelId) ?? `isometric-${category}`,
      finish: existing?.finish ?? "original",
      surface: surface ?? (category === "plant" ? "desk" : "back-wall"),
      position: [0, 0, 0],
      rotation: 0,
    };
    if (placeNew(piece)) {
      setEmptyCategory(null);
      setTool("position");
      setCollapsed(false);
      feedback();
    }
  };
  const move = (direction: "left" | "right" | "up" | "down") => {
    const state = useRoomEditor.getState();
    const piece = state.draft?.pieces.find((p) => p.id === state.selectedId);
    if (piece) apply(nudgeRoomPiece(piece, direction, roomPieceMoveStep(piece)));
  };
  const arrow = (
    direction: "left" | "right" | "up" | "down",
    label: string,
    icon: Icon,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Mantenha pressionado para mover continuamente"
      onPress={() => {
        if (heldArrow.current) {
          heldArrow.current = false;
          return;
        }
        move(direction);
      }}
      onPressIn={() => {
        heldArrow.current = false;
      }}
      onLongPress={() => {
        heldArrow.current = true;
        useRoomEditor.getState().beginMove();
        move(direction);
        repeat.current = setInterval(() => move(direction), 150);
      }}
      onPressOut={stopRepeat}
      style={({ pressed }) => [
        styles.arrow,
        pressed && active,
      ]}
    >
      <Ionicons name={icon} color={text.color} size={24} />
    </Pressable>
  );
  const rotate = (direction: number) => {
    if (selected)
      apply({
        ...selected,
        rotation: snapRoomRotation(selected.rotation + direction * ROOM_ROTATION_STEP),
      });
  };
  const collectionLocked = collection ? lockedCollection(collection.id, owned) : null;
  const collectionColorsApplied = Boolean(collection && appearance?.wallPaletteId === collection.wallPaletteId && appearance?.floorPaletteId === collection.floorPaletteId);
  const addableCategories = (["plant", "window", "frame", "poster"] as const).filter(category => !draft.pieces.some(piece => piece.category === category));
  const catalogCategory = selected?.category ?? emptyCategory;
  const canColor = Boolean(selected && !['cat', 'desk', 'bookcase', 'poster'].includes(selected.category)
    && (selected.category !== 'lamp' || ['observatory-lamp', 'atelier-lamp'].includes(selected.modelId)));
  const activeTool = tool === 'art' || (tool === 'finish' && !canColor) ? 'model' : tool;
  const toolLabel = (item: typeof tools[number]) => item.id === 'model' && selected?.category === 'poster' ? 'Imagem' : item.id === 'model' && selected?.category === 'plant' ? 'Tipo' : item.label;
  const selectedColor = selected?.color ?? (selected?.modelId.startsWith('teahouse-') && ['seat', 'pillow'].includes(selected.category) ? '#8C9275' : selected?.category === 'rug' ? getRugVariant(selected.modelId)?.theme.color
    : selected?.modelId.startsWith('observatory-') && ['desk', 'seat', 'pillow', 'lamp'].includes(selected.category) ? '#34465E' : selected?.modelId === 'atelier-lamp' ? '#C08A72' : undefined);

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View
        onLayout={(event) => onToolbarHeightChange(event.nativeEvent.layout.height)}
        style={[
          styles.top,
          surface,
          { borderColor: isNight ? darkTheme.border : colors.line },
          {
            top: insets.top + 8,
            left: Math.max(insets.left, 12),
            right: Math.max(insets.right, 12),
          },
        ]}
      >
        {action("Cancelar", finish, { quiet: true })}
        <View style={styles.row}>
          {action(
            "Desfazer",
            () => {
              undo();
              feedback();
            },
            {
              icon: "arrow-undo-outline",
              iconOnly: true,
              disabled: !past.length,
            },
          )}
          {action(
            "Refazer",
            () => {
              redo();
              feedback();
            },
            {
              icon: "arrow-redo-outline",
              iconOnly: true,
              disabled: !future.length,
            },
          )}
        </View>
        {action(
          "Salvar",
          () => {
            useRoomEditor.getState().endMove();
            const editor = useRoomEditor.getState();
            if (!editor.draft) {
              showSaveFailure('Não foi possível salvar o Ambiente. Abra a personalização e tente novamente.');
              return;
            }
            const previous = useLibraryStore.getState();
            const changed = JSON.stringify(previous.roomLayout) !== JSON.stringify(editor.draft)
              || (editor.appearance && (previous.wallPaletteId !== editor.appearance.wallPaletteId
                || previous.floorPaletteId !== editor.appearance.floorPaletteId
                || previous.rugPaletteId !== editor.appearance.rugPaletteId
                || previous.catId !== editor.appearance.catId));
            setLayout(editor.draft!);
            if (editor.appearance) {
              const store = useLibraryStore.getState();
              store.setWallPaletteId(editor.appearance.wallPaletteId);
              store.setFloorPaletteId(editor.appearance.floorPaletteId);
              store.setRugPaletteId(editor.appearance.rugPaletteId);
              store.setCatId(editor.appearance.catId);
            }
            if (changed) {
              trackEvent('room_customization_saved', { piece_count: editor.draft!.pieces.length });
              showSaveFeedback('Alterações do Ambiente salvas');
            }
            feedback();
            finish();
          },
          { primary: true },
        )}
      </View>
      <View
        onLayout={(event) => onHeightChange(event.nativeEvent.layout.height)}
        style={[
          styles.panel,
          surface,
          {
            maxHeight: height * 0.52,
            borderColor: isNight ? darkTheme.border : colors.line,
            paddingBottom: Math.max(insets.bottom, 12),
            paddingLeft: Math.max(insets.left, 16),
            paddingRight: Math.max(insets.right, 16),
          },
        ]}
      >
        <View pointerEvents="none" style={[styles.grabber, { backgroundColor: isNight ? darkTheme.border : colors.line }]} />
        <View style={styles.summary}>
          {collection ? action("Voltar", () => setCollectionId(null), { icon: "chevron-back", iconOnly: true }) : activeTool !== "pieces" ? action("Voltar aos itens", () => {
            stopRepeat();
            select(null);
            setEmptyCategory(null);
            setTool("pieces");
            setCameraMode(false);
          }, { icon: "chevron-back", iconOnly: true }) : null}
          {!collection && selected && activeTool !== "pieces" && activeTool !== "environment" ? (
            <Image
              source={COLLECTION_PREVIEWS[selected.modelId] ?? ROOM_PREVIEWS[selected.category]}
              style={styles.selectedPreview}
              contentFit="contain"
            />
          ) : (
            <Ionicons
              name={
                activeTool === "environment" ? "layers-outline" : selected?.category === "cat" ? "paw-outline" : "grid-outline"
              }
              size={28}
              color={text.color}
            />
          )}
          <View style={styles.flex}>
            <Text accessibilityRole="header" style={[styles.title, text]}>
              {collection ? collection.name : activeTool === "environment"
                ? "Sala e cores"
                : emptyCategory ? categoryName(emptyCategory) : selected && activeTool !== "pieces"
                  ? (selected.modelId === "library-seat" ? "Poltrona" : categoryName(selected.category))
                  : "Personalizar sala"}
            </Text>
            <Text style={[styles.caption, muted]}>
              {collection ? "Visão da coleção" : activeTool === "environment"
                ? "Paredes, piso e espaço"
                : selected && activeTool !== "pieces"
                  ? surfaceName(selected)
                  : emptyCategory && emptyCategory !== "plant" ? "Escolha uma coleção" : "Escolha um item"}
            </Text>
          </View>
          {action(
            collapsed ? "Expandir controles" : "Recolher controles",
            () => setCollapsed(!collapsed),
            { icon: collapsed ? "chevron-up" : "chevron-down", iconOnly: true },
          )}
        </View>
        {invalid && activeTool !== "environment" ? (
          <Text accessibilityLiveRegion="polite" style={[styles.error, { color: dangerColor }]}>
            Não cabe aqui. A última posição válida foi mantida.
          </Text>
        ) : null}
        {!collapsed && !collection && activeTool !== "pieces" && activeTool !== "environment" ? (
          <SegmentedTabs
            items={tools
              .filter(
              (item) =>
                item.id !== "pieces" && item.id !== "environment" && Boolean(selected) &&
                item.id !== "art" &&
                (item.id !== "finish" || canColor) &&
                (item.id !== "model" || ["cat", "plant"].includes(selected?.category ?? "") || Boolean(selected && (COLLECTION_PREVIEWS[`botanic-${selected.category}`] || COLLECTION_PREVIEWS[`library-${selected.category}`] || COLLECTION_PREVIEWS[`atelier-${selected.category}`] || COLLECTION_PREVIEWS[`observatory-${selected.category}`] || COLLECTION_PREVIEWS[`teahouse-${selected.category}`] || ["window", "frame", "poster"].includes(selected.category)))),
              ).map(item => ({ ...item, label: toolLabel(item) }))}
            selected={activeTool}
            isNight={isNight}
            onSelect={id => {
              stopRepeat();
              setCameraMode(false);
              setTool(id);
              setCollapsed(false);
            }}
          />
        ) : null}
        {!collapsed && !collection && activeTool === "environment" ? (
          <SegmentedTabs
            items={[
              { id: "collections", label: "Coleções", icon: "grid-outline" },
              { id: "size", label: "Tamanho", accessibilityLabel: "Tamanho da sala", icon: "resize-outline" },
              { id: "colors", label: "Cores", icon: "color-palette-outline" },
            ]}
            selected={environmentTab}
            isNight={isNight}
            onSelect={setEnvironmentTab}
          />
        ) : null}
        {!collapsed ? (
          <>
          <ScrollView
            key={collectionId ?? (activeTool === "environment" ? environmentTab : activeTool)}
            showsVerticalScrollIndicator
            contentContainerStyle={styles.body}
            style={styles.scroll}
          >
            {collection ? <>
              <Image source={COLLECTION_SHOWCASES[collection.id][galleryIndex]} contentFit="contain"
                accessibilityLabel={`${collection.name}, ${['vista completa', 'composição vertical', 'ângulo alternativo'][galleryIndex]}`}
                style={[styles.collectionHero, control]} />
              <View style={styles.row}>
                {COLLECTION_SHOWCASES[collection.id].map((image, index) => <Pressable key={index}
                  accessibilityRole="button" accessibilityLabel={['Vista completa', 'Composição vertical', 'Ângulo alternativo'][index]}
                  accessibilityState={{ selected: galleryIndex === index }} onPress={() => setGalleryIndex(index)}
                  style={[styles.galleryThumb, control, galleryIndex === index && active]}>
                  <Image source={image} contentFit="contain" style={styles.galleryImage} />
                </Pressable>)}
              </View>
              {action(collectionLocked ? 'Desbloquear coleção' : collectionColorsApplied ? 'Cores aplicadas' : 'Aplicar cores', () => {
                if (!requireAccess(collection.id)) return;
                setAppearance({ wallPaletteId: collection.wallPaletteId, floorPaletteId: collection.floorPaletteId });
                feedback();
              }, { icon: collectionLocked ? 'lock-closed-outline' : collectionColorsApplied ? 'checkmark' : 'color-palette-outline', primary: true, disabled: purchaseBusy || (collectionColorsApplied && !collectionLocked) })}
              <Text style={[styles.caption, muted]}>Altera paredes e piso. Os móveis são escolhidos por peça.</Text>
              <Text style={[styles.hint, text]}>Móveis e detalhes</Text>
              <View style={styles.grid}>
                {(['desk', 'seat', 'bookcase', 'lamp', 'window', 'frame', 'rug', 'pillow'] as const).map(category => {
                  const modelId = `${collection.id}-${category}`;
                  const source = category === 'rug' ? RUG_PREVIEWS[modelId] : COLLECTION_PREVIEWS[modelId];
                  return <View key={category} style={[styles.pieceCard, control]}>
                    <Image source={source ?? ROOM_PREVIEWS[category]} contentFit="contain" style={styles.piecePreview} />
                    <Text numberOfLines={1} style={[styles.buttonText, text]}>{categoryName(category)}</Text>
                  </View>;
                })}
              </View>
            </> : <>
            {activeTool === 'model' && selected && !['plant', 'cat', 'poster'].includes(selected.category) ?
              action('Ver coleção', () => openCollection(selected.modelId.split('-')[0]), { icon: 'images-outline' }) : null}
            {activeTool === "pieces" ? (
              <>
                {action("Sala e cores", () => { select(null); setEmptyCategory(null); setTool("environment"); }, { icon: "layers-outline" })}
                <Text accessibilityRole="header" style={[styles.catalogHeading, text]}>Na sala</Text>
                <View style={styles.grid}>
                  {draft.pieces
                    .map((p, i) => (
                      <Pressable
                        key={p.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Selecionar ${p.modelId === "library-seat" ? "Poltrona" : categoryName(p.category)} ${i + 1}, ${surfaceName(p)}`}
                        accessibilityState={{ selected: p.id === selectedId }}
                        onPress={() => {
                          if (!requireAccess(p.modelId)) return;
                          select(p.id);
                          setTool("position");
                          feedback();
                        }}
                        style={[
                          styles.pieceCard,
                          control,
                          p.id === selectedId && active,
                        ]}
                      >
                        {p.id === selectedId ? (
                          <Ionicons
                            name="checkmark-circle"
                            size={22}
                            color={accent}
                            style={styles.selectionCheck}
                          />
                        ) : null}
                        <Image
                          source={COLLECTION_PREVIEWS[p.modelId] ?? ROOM_PREVIEWS[p.category]}
                          style={styles.piecePreview}
                          contentFit="contain"
                        />
                        {p.category !== "poster" ? collectionMark(p.modelId) : null}
                        {lockedCollection(p.modelId, owned) ? <Ionicons name="lock-closed-outline" size={18} color={accent} style={styles.selectionCheck} /> : null}
                        <Text numberOfLines={1} style={[styles.buttonText, text]}>
                          {p.modelId === "library-seat" ? "Poltrona" : categoryName(p.category)}
                          {draft.pieces.filter(
                            (other) => other.category === p.category,
                          ).length > 1
                            ? ` ${draft.pieces.filter(other => other.category === p.category).findIndex(other => other.id === p.id) + 1}`
                            : ""}
                        </Text>
                        <Text style={[styles.caption, muted]}>
                          {surfaceName(p)}
                        </Text>
                      </Pressable>
                    ))}
                </View>
                {addableCategories.length ? <>
                  <Text accessibilityRole="header" style={[styles.catalogHeading, text]}>Adicionar à sala</Text>
                  <View style={styles.grid}>
                    {addableCategories.map(category => (
                      <Pressable key={category} accessibilityRole="button" accessibilityLabel={`Adicionar ${categoryName(category)}`}
                        onPress={() => { if (category === "poster") { addDecoration("poster"); setTool("model"); } else { select(null); setEmptyCategory(category); setTool("model"); } feedback(); }}
                        style={({ pressed }) => [styles.pieceCard, control, pressed && styles.pressed]}>
                        <Image source={ROOM_PREVIEWS[category]} contentFit="contain" style={styles.piecePreview} />
                        <View style={styles.catalogLabelRow}>
                          <Text style={[styles.catalogLabel, text]}>{categoryName(category)}</Text>
                          <Ionicons name="add-circle-outline" size={19} color={accent} accessible={false} />
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </> : null}
              </>
            ) : null}
            {!selected && emptyCategory === "plant" && activeTool === "model" ? (
              <View style={styles.row}>
                {(["desk", "floor"] as const).map(surface => action(surface === "desk" ? "Mesa" : "Chão", () => { addDecoration("plant", surface); setEmptyCategory(null); }, { icon: "add", grow: true }))}
              </View>
            ) : null}
            {!selected && !emptyCategory && activeTool !== "pieces" && activeTool !== "environment"
              ? action("Escolher uma peça", () => setTool("pieces"), {
                  icon: "grid-outline",
                })
              : null}
            {selected && activeTool === "position" ? (
              <>
                <View style={[styles.positionControls, { borderColor: isNight ? darkTheme.border : colors.line }]}>
                  <Text style={[styles.positionLabel, text]}>Mover</Text>
                  <Text style={[styles.hint, muted]}>Arraste na sala ou use as setas.</Text>
                  <View style={[styles.moveStrip, control]}>
                    {arrow("left", "Mover para a esquerda", "chevron-back")}
                    {arrow("up", selected.surface === "floor" || selected.surface === "desk" ? "Mover para o fundo" : "Mover para cima", "chevron-up")}
                    {arrow("down", selected.surface === "floor" || selected.surface === "desk" ? "Mover para a frente" : "Mover para baixo", "chevron-down")}
                    {arrow("right", "Mover para a direita", "chevron-forward")}
                  </View>
                  {selected.surface === "floor" ? (
                    <View style={styles.rotationRow}>
                      <View style={styles.flex}>
                        <Text style={[styles.positionLabel, text]}>Girar</Text>
                        <Text style={[styles.caption, muted]}>Passos de 45°</Text>
                      </View>
                      <View style={[styles.rotationStrip, control]}>
                        {action("Girar 45° à esquerda", () => rotate(-1), { icon: "arrow-undo-outline", iconOnly: true })}
                        {action("Girar 45° à direita", () => rotate(1), { icon: "arrow-redo-outline", iconOnly: true })}
                      </View>
                    </View>
                  ) : selected.surface === "back-wall" || selected.surface === "left-wall" ? (
                    action("Trocar parede", () => placeWall(selected, draft.roomSize, apply), { icon: "swap-horizontal" })
                  ) : null}
                </View>
                {canDuplicate || canRemove ? <View style={styles.row}>
                  {canDuplicate
                    ? action(
                        "Duplicar",
                        () => {
                          if (
                            placeNew({
                              ...selected,
                              id: nextDecorationId(selected.category),
                            })
                          )
                            feedback();
                        },
                        {
                          icon: "copy-outline",
                          grow: true,
                          disabled: selected.category !== "poster" && extraCount >= MAX_EXTRA_DECORATIONS,
                        },
                      )
                    : null}
                  {canRemove
                    ? action(
                        "Remover",
                        () => {
                          remove(selected.id);
                          feedback();
                        },
                        { icon: "trash-outline", danger: true, grow: true },
                      )
                    : null}
                </View> : null}
              </>
            ) : null}
            {selected?.category === "plant" && activeTool === "position" ? (
              <View style={styles.row}>
                {(["desk", "floor"] as const).map(surface => action(
                  surface === "desk" ? "Mesa" : "Chão",
                  () => addDecoration("plant", surface),
                  { icon: "add", disabled: draft.pieces.some(piece => piece.category === "plant" && piece.surface === surface), grow: true },
                ))}
              </View>
            ) : null}
            {selected?.category === "cat" ? action("Personalizar almofada", () => {
              const pillow = draft.pieces.find(piece => piece.category === "pillow");
              if (pillow) { select(pillow.id); setTool("model"); }
            }, { icon: "color-palette-outline" }) : null}
            {selected && canColor && activeTool === "finish" ? (
              <>
              <Text style={[styles.hint, text]}>{selected.category === "lamp" ? "Base" : selected.category === "plant" ? "Vaso" : selected.modelId === "observatory-desk" ? "Tampo" : selected.modelId === "observatory-seat" ? "Encosto" : "Cor"}</Text>
              <RoomColorCategories selected={colorCategory} onSelect={category => setColorFilter({ selection: rugSelectionKey, category })} isNight={isNight} />
              <View style={styles.row}>
                {(ROOM_COLOR_CATEGORIES.find(category => category.id === colorCategory)?.colors ?? []).map(color => (
                  <RoomColorSwatch key={color} label={`Cor ${color}`} color={color}
                    selected={selectedColor === color} locked={Boolean(lockedCollection(color, owned))} isNight={isNight}
                    onPress={() => { apply({ ...selected, color }); feedback(); }} />
                ))}
                {action("Restaurar cor do modelo", () => { apply({ ...selected, color: undefined }); feedback(); }, { icon: "refresh-outline", iconOnly: true, disabled: !selected.color })}
              </View>
              </>
            ) : null}
            {selected?.category === "plant" && activeTool === "model" ? (
              <View style={styles.grid}>
                {[{ id: "isometric-plant", name: "Original" }, ...PLANT_VARIANTS].map(plant => (
                  <Pressable key={plant.id} accessibilityRole="button" accessibilityLabel={plant.name}
                    accessibilityState={{ selected: selected.modelId === plant.id }}
                    onPress={() => { apply({ ...selected, modelId: plant.id }); feedback(); }}
                    style={[styles.pieceCard, control, selected.modelId === plant.id && active]}>
                    <Image source={COLLECTION_PREVIEWS[plant.id] ?? ROOM_PREVIEWS.plant} contentFit="contain" style={styles.piecePreview} />
                    <Text style={[styles.catalogLabel, text]}>{plant.name}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {activeTool === "environment" ? (
              <>
                {environmentTab === "size" ? (
                  <View style={styles.comingSoon}>
                    <Ionicons name="resize-outline" size={32} color={muted.color} />
                    <Text style={[styles.title, text]}>Em breve</Text>
                    <Text style={[styles.hint, muted, styles.centerText]}>Novas opções para ajustar o tamanho da sala estão a caminho.</Text>
                  </View>
                ) : null}
                {environmentTab === "collections" ? <>
                <View style={styles.grid}>
                  {COLLECTION_PALETTES.map(collection => {
                    const chosen = appearance?.wallPaletteId === collection.wallPaletteId && appearance?.floorPaletteId === collection.floorPaletteId;
                    const locked = Boolean(lockedCollection(collection.id, owned));
                    return (
                      <Pressable key={collection.id} accessibilityRole="button"
                        accessibilityLabel={`Ver coleção ${collection.name}${locked ? ', bloqueada' : ''}`}
                        accessibilityState={{ selected: chosen }}
                        onPress={() => { openCollection(collection.id); feedback(); }}
                        style={({ pressed }) => [styles.collectionCard, control, chosen && active, pressed && styles.pressed]}>
                        <Image source={COLLECTION_SHOWCASES[collection.id][0]} contentFit="contain" style={styles.collectionPreview} accessible={false} />
                        <View style={styles.collectionCopy}>
                          <View style={styles.collectionHeading}>
                            <Text style={[styles.collectionName, text, styles.flex]}>{collection.name}</Text>
                            <Ionicons name={locked ? "lock-closed-outline" : chosen ? "checkmark-circle" : "chevron-forward"} size={17} color={accent} accessible={false} />
                          </View>
                          {collectionMark(collection.id)}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
                </> : null}
                {environmentTab === "colors" ? <RoomAppearanceOptions category="environment" isNight={isNight} /> : null}
              </>
            ) : null}
            {selected?.category === 'rug' && activeTool === 'model' ? (
              <>
                <View style={styles.shapeRow}>
                  {RUG_SHAPES.map(shape => (
                    <Pressable key={shape.id} accessibilityRole="button" accessibilityLabel={shape.name}
                      accessibilityState={{ selected: rugShape === shape.id }} onPress={() => setRugFilter({ selection: rugSelectionKey, shape: shape.id })}
                      style={[styles.shapeChoice, control, rugShape === shape.id && active]}>
                      <View style={[styles.shapeIcon, { borderColor: rugShape === shape.id ? active.borderColor : text.color },
                        shape.id === 'round' && styles.roundShape,
                        shape.id === 'oval' && styles.ovalShape,
                        shape.id === 'runner' && styles.runnerShape]} />
                    </Pressable>
                  ))}
                </View>
                <View style={styles.grid}>
                  {RUG_VARIANTS.filter(variant => variant.shape === rugShape).sort((a, b) => ['isometric', 'botanic', 'atelier', 'library', 'observatory', 'teahouse'].indexOf(a.theme.id) - ['isometric', 'botanic', 'atelier', 'library', 'observatory', 'teahouse'].indexOf(b.theme.id)).map(variant => (
                    <Pressable key={variant.id} accessibilityRole="button" accessibilityLabel={`${variant.theme.name}, ${RUG_SHAPES.find(shape => shape.id === variant.shape)?.name}`}
                      accessibilityState={{ selected: selected.modelId === variant.id }}
                      onPress={() => { apply({ ...selected, modelId: variant.id }); feedback(); }}
                      style={[styles.pieceCard, control, selected.modelId === variant.id && active]}>
                      <Image source={RUG_PREVIEWS[variant.id]} contentFit="contain" style={styles.piecePreview} />
                      {collectionMark(variant.id)}
                      {lockedCollection(variant.id, owned) ? <Ionicons name="lock-closed-outline" size={18} color={accent} style={styles.selectionCheck} /> : null}
                      <Text style={[styles.catalogLabel, text]}>{variant.theme.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
            {catalogCategory && !["rug", "plant", "cat"].includes(catalogCategory) && (COLLECTION_PREVIEWS[`botanic-${catalogCategory}`] || COLLECTION_PREVIEWS[`library-${catalogCategory}`] || COLLECTION_PREVIEWS[`atelier-${catalogCategory}`] || COLLECTION_PREVIEWS[`observatory-${catalogCategory}`] || COLLECTION_PREVIEWS[`teahouse-${catalogCategory}`]) && activeTool === "model" ? (
              <>
                <Text style={[styles.hint, muted]}>{selected ? "Toque em um modelo para trocar a peça." : "Escolha um modelo para adicionar à sala."}</Text>
                <View style={styles.grid}>
                  {[
                    { id: `isometric-${catalogCategory}`, name: 'Original', image: ROOM_PREVIEWS[catalogCategory] },
                    ...['botanic', 'atelier', 'library', 'observatory', 'teahouse'].filter(theme => COLLECTION_PREVIEWS[`${theme}-${catalogCategory}`]).map(theme => ({ id: `${theme}-${catalogCategory}`, name: ({ botanic: 'Botânica', library: 'Biblioteca', atelier: 'Ateliê', observatory: 'Observatório', teahouse: 'Casa de Chá' } as Record<string, string>)[theme], image: COLLECTION_PREVIEWS[`${theme}-${catalogCategory}`] })),
                  ].map(model => (
                    <Pressable key={model.id} accessibilityRole="button" accessibilityLabel={`${model.name}${lockedCollection(model.id, owned) ? ', bloqueado' : ''}`}
                      accessibilityState={{ selected: selected?.modelId === model.id }}
                      onPress={() => {
                        if (selected) { apply({ ...selected, modelId: model.id }); feedback(); }
                        else if (requireAccess(model.id)) addDecoration(catalogCategory, undefined, model.id);
                      }}
                      style={({ pressed }) => [styles.pieceCard, control, selected?.modelId === model.id && active, pressed && styles.pressed]}>
                      <Image source={model.image} contentFit="contain" style={styles.piecePreview} />
                      {collectionMark(model.id)}
                      {lockedCollection(model.id, owned) ? <Ionicons name="lock-closed-outline" size={18} color={accent} style={styles.selectionCheck} accessible={false} /> : selected?.modelId === model.id || !selected ? <Ionicons name={selected ? "checkmark-circle" : "add-circle-outline"} size={19} color={accent} style={styles.selectionCheck} accessible={false} /> : null}
                      <Text style={[styles.catalogLabel, text]}>{model.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
            {selected?.category === "cat" && activeTool === "model" ? (
              <RoomAppearanceOptions
                category="cat"
                isNight={isNight}
                loadingCatId={loadingCatId}
              />
            ) : null}
            {selected && ["frame", "poster"].includes(selected.category) && activeTool === "model" ? (
              <>
                <RoomArtPreview piece={selected} book={completedBooks.find(book => book.id === selected.bookId)} isNight={isNight} />
                {action(
                  busy ? "Abrindo galeria…" : "Escolher foto da galeria",
                  () => { void choosePhoto(); },
                  { icon: "images-outline", disabled: busy, primary: true },
                )}
                {selected.bookId || (selected.photo?.source !== 'none' && (selected.photo || selected.photoUri)) ? action(
                  selected.category === "poster" ? "Remover imagem" : "Voltar à arte original",
                  () => apply({ ...selected, photoUri: '', photo: { source: 'none', version: nextDecorationId("photo"), pending: true, previousPath: selected.photo?.storagePath ?? selected.photo?.previousPath }, bookId: undefined }),
                  { icon: "refresh-outline", disabled: busy },
                ) : null}
                {selected.category === "frame" ? <View style={styles.row}>
                  {(["square", "portrait"] as const).map((aspect) => (
                    <Pressable
                      key={aspect}
                      accessibilityRole="button"
                      accessibilityState={{
                        selected: (selected.aspect ?? "square") === aspect,
                      }}
                      onPress={() => apply({ ...selected, aspect })}
                      style={[
                        styles.chip,
                        control,
                        styles.flex,
                        (selected.aspect ?? "square") === aspect &&
                          active,
                      ]}
                    >
                      <Text numberOfLines={1} style={[styles.buttonText, text]}>
                        {aspect === "square" ? "Quadrado" : "Retrato"}
                      </Text>
                    </Pressable>
                  ))}
                </View> : null}
                {selected.category === "poster" ? <>
                {completedBooks.length ? (
                  <Text style={[styles.hint, muted]}>
                    Capas desbloqueadas
                  </Text>
                ) : (
                  <Text style={[styles.hint, muted]}>
                    Conclua um livro para desbloquear sua capa nos pôsteres.
                  </Text>
                )}
                {completedBooks.length > 0 && <View style={[styles.coverChoices, { borderColor: isNight ? darkTheme.border : colors.line }]}>
                {completedBooks.map((book) => (
                  <Pressable
                    key={book.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Usar capa de ${book.title}`}
                    accessibilityState={{
                      selected: selected.bookId === book.id,
                    }}
                    onPress={() =>
                      apply({
                        ...selected,
                        bookId: book.id,
                        photoUri: undefined,
                        photo: { source: 'none', version: nextDecorationId("photo"), pending: true, previousPath: selected.photo?.storagePath ?? selected.photo?.previousPath },
                      })
                    }
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.bookRow, selected.bookId === book.id && active,
                      pressed && styles.pressed,
                    ]}
                  >
                    <BookCover color={book.coverColor} coverUrl={book.coverUrl} style={styles.bookCover} />
                    <View style={styles.flex}>
                      <Text style={[styles.buttonText, text]}>{book.title}</Text>
                      {book.author ? <Text style={[styles.caption, muted]}>{book.author}</Text> : null}
                    </View>
                    <Ionicons name={selected.bookId === book.id ? "checkmark-circle" : "chevron-forward"} size={19} color={accent} accessible={false} />
                  </Pressable>
                ))}
                </View>}
                </> : null}
              </>
            ) : null}
            </>}
          </ScrollView>
          {IAP_ENABLED ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Restaurar compras"
              accessibilityState={{ disabled: purchaseBusy, busy: purchaseBusy }}
              disabled={purchaseBusy}
              onPress={() => { void restoreCollectionPurchases(); }}
              style={({ pressed }) => [styles.restoreLink, purchaseBusy && styles.disabled, pressed && styles.pressed]}
            >
              <Text style={[styles.caption, muted, styles.restoreLinkText]}>Restaurar compras</Text>
            </Pressable>
          ) : null}
          </>
        ) : null}

      </View>
    </View>
  );
}

function placeWall(piece: RoomPiece, roomSize: number, apply: (p: RoomPiece) => void) {
  const surface = piece.surface === "back-wall" ? "left-wall" : "back-wall";
  apply({
    ...piece,
    surface,
    rotation: surface === "left-wall" ? Math.PI / 2 : 0,
    position:
      surface === "left-wall"
        ? [-roomSize / 2 + 0.12, piece.position[1], piece.position[0]]
        : [piece.position[2], piece.position[1], -roomSize / 2 + 0.12],
  });
}
function RoomArtPreview({ piece, book, isNight }: { piece: RoomPiece; book?: Book; isNight: boolean }) {
  const photo = piece.photo?.source === 'none' ? undefined : piece.photo;
  const localUri = piece.photo?.source === 'none' ? undefined : photo?.localUri || piece.photoUri || photo?.providerUrl;
  const [cached, setCached] = useState<{ photo: NonNullable<RoomPiece['photo']>; uri: string }>();
  useEffect(() => {
    if (book || localUri || !photo?.storagePath) return;
    let active = true;
    void cacheAvatar(supabase, 'room', photo, ROOM_PHOTOS_BUCKET).then(uri => {
      if (active && uri) setCached({ photo, uri });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [book, localUri, photo]);
  const photoUri = localUri ?? (photo && cached?.photo === photo ? cached.uri : undefined);
  const source = book ? book.coverUrl : photoUri;
  const poster = piece.category === "poster";
  const label = book ? book.title : photoUri || photo ? "Foto da galeria" : poster ? "Sem imagem" : "Arte original";
  const textColor = isNight ? darkTheme.text : colors.ink;
  return (
    <View style={[styles.artPreview, { backgroundColor: isNight ? darkTheme.surfaceElevated : colors.softFill }]}>
      <View style={[styles.artMat, {
        aspectRatio: poster ? 0.5 : piece.aspect === "portrait" ? 0.7 / 0.97 : 1,
        backgroundColor: book?.coverColor ?? (isNight ? darkTheme.surface : colors.paper),
        borderColor: isNight ? darkTheme.border : colors.line,
      }]}>
        {source ? (
          <Image source={source} contentFit="cover" recyclingKey={source} style={StyleSheet.absoluteFill} accessible={false} />
        ) : book ? (
          <Ionicons name="book-outline" size={24} color={colors.paper} accessible={false} />
        ) : (
          <Image source={COLLECTION_PREVIEWS[piece.modelId] ?? ROOM_PREVIEWS[piece.category]} contentFit="contain" style={StyleSheet.absoluteFill} accessible={false} />
        )}
      </View>
      <Text accessibilityLabel={`Prévia: ${label}`} style={[styles.buttonText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    padding: 6,
    borderRadius: radii.large,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
  },
  panel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 8,
  },
  grabber: { width: 34, height: 4, borderRadius: 2, alignSelf: "center" },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 56,
  },
  selectedPreview: { width: 52, height: 52 },
  title: { fontFamily: typography.editorial, fontSize: 20, lineHeight: 27 },
  caption: { fontSize: 12, lineHeight: 17 },
  hint: { fontSize: 13, lineHeight: 19 },
  comingSoon: { alignItems: "center", paddingVertical: 32, paddingHorizontal: 24, gap: 12 },
  centerText: { textAlign: "center" },
  error: { fontSize: 13, lineHeight: 18 },
  flex: { flex: 1 },
  scroll: { flexShrink: 1 },
  body: { gap: 12, paddingBottom: 4 },
  restoreLink: { minHeight: 44, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  restoreLinkText: { textDecorationLine: 'underline' },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  between: { gap: 8 },
  button: { ...controls.button, minWidth: 44, flexShrink: 1, flexDirection: "row", gap: 6 },
  actionLabel: { ...controls.buttonText, flexShrink: 1, textAlign: "center" },
  collectionCard: { width: '48%', borderRadius: radii.large, borderCurve: 'continuous', borderWidth: 1, borderColor: 'transparent', overflow: 'hidden' },
  collectionPreview: { width: '100%', aspectRatio: 1.22 },
  collectionCopy: { paddingHorizontal: 10, paddingBottom: 6 },
  collectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  collectionName: { fontFamily: typography.editorial, fontSize: 16 },
  collectionHero: { width: '100%', height: 230, borderRadius: radii.large, borderCurve: 'continuous' },
  galleryThumb: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: 'transparent', padding: 4 },
  galleryImage: { width: '100%', height: 64 },
  buttonText: { fontSize: 13, fontWeight: "600" },
  iconButton: { ...controls.iconButton, paddingHorizontal: 0 },
  disabled: controls.buttonDisabled,
  pressed: controls.buttonPressed,
  chip: {
    minHeight: 44,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  catalogHeading: { fontFamily: typography.editorial, fontSize: 18 },
  catalogLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
  catalogLabel: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
  pieceCard: {
    width: "48%",
    padding: 10,
    borderRadius: radii.large,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "transparent",
    gap: 2,
  },
  selectionCheck: { position: "absolute", top: 8, right: 8, zIndex: 1 },
  categoryGrid: { gap: 8 },
  piecePreview: { width: "100%", aspectRatio: 1.38 },
  modelCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "transparent",
  },
  modelPreview: { width: 88, height: 66 },
  finishCard: {
    width: "48%",
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "transparent",
  },
  swatch: { width: 28, height: 28, borderRadius: 14 },
  shapeRow: { flexDirection: "row", gap: 8 },
  shapeChoice: { flex: 1, height: 48, borderRadius: 16, borderWidth: 1, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
  shapeIcon: { width: 30, height: 22, borderWidth: 2, borderRadius: 3 },
  roundShape: { width: 25, height: 25, borderRadius: 13 },
  ovalShape: { width: 32, height: 22, borderRadius: 16 },
  runnerShape: { width: 36, height: 15, borderRadius: 8 },
  positionControls: { padding: 12, gap: 8, borderRadius: radii.large, borderCurve: "continuous", borderWidth: StyleSheet.hairlineWidth },
  positionLabel: { fontSize: 14, fontWeight: "600" },
  moveStrip: { flexDirection: "row", gap: 3, padding: 3, borderRadius: radii.full },
  arrow: { ...controls.iconButton, width: undefined, flex: 1, minWidth: 44 },
  rotationRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rotationStrip: { flexDirection: "row", padding: 3, borderRadius: radii.full },
  artPreview: { alignItems: "center", gap: 9, padding: 12, borderRadius: radii.large, borderCurve: "continuous" },
  artMat: { height: 118, borderWidth: 1, borderRadius: 6, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  coverChoices: { borderRadius: radii.large, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden", padding: 3 },
  bookRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: radii.medium,
    borderWidth: 1,
    borderColor: "transparent",
  },
  bookCover: { width: 38, height: 56, borderRadius: 5 },

});
