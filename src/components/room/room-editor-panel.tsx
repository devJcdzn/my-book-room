import { trackEvent } from '@/src/services/analytics';
import { colors, controls, darkTheme, typography } from "@/src/theme";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
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
import { prepareAvatar } from '@/src/services/profile-avatar';
import { ROOM_PHOTOS_BUCKET } from '@/src/services/room-photos';

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RoomAppearanceOptions } from "@/src/components/room/room-customization-overlay";
import { roomModel } from "@/src/components/room/room-models";
import { useRoomEditor } from "@/src/store/room-editor-store";
import { useLibraryStore } from "@/src/store/library-store";
import {
  isRoomPlacementValid,
  MAX_EXTRA_DECORATIONS,
  nudgeRoomPiece,
  ROOM_CATEGORIES,
  ROOM_COLLECTIONS,
  ROOM_FINISHES,
  snapRoomRotation,
  type RoomCategory,
  type RoomPiece,
} from "@/src/types/room-layout";

type Tool = "pieces" | "position" | "model" | "finish" | "art" | "environment";
type Icon = React.ComponentProps<typeof Ionicons>["name"];
const tools: { id: Tool; label: string; icon: Icon }[] = [
  { id: "pieces", label: "Peças", icon: "grid-outline" },
  { id: "position", label: "Mover", icon: "move-outline" },
  { id: "model", label: "Modelo", icon: "cube-outline" },
  { id: "finish", label: "Cores", icon: "color-palette-outline" },
  { id: "art", label: "Imagem", icon: "image-outline" },
  { id: "environment", label: "Sala", icon: "layers-outline" },
];
const nextDecorationId = (category: string) => `${category}-${Date.now()}`;
const categoryName = (category: RoomCategory) =>
  category === "frame"
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
  initialCategory,
  loadingCatId,
}: {
  isNight: boolean;
  onClose: () => void;
  onHeightChange: (height: number) => void;
  initialCategory?: RoomCategory;
  loadingCatId?: string | null;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const {
    draft,
    cameraMode,
    setCameraMode,
    selectedId,
    invalid,
    past,
    future,
    select,
    update,
    add,
    remove,
    restore,
    close,
    undo,
    redo,
  } = useRoomEditor();
  const books = useLibraryStore((state) => state.books);
  const completedBooks = books.filter((book) => book.status === 'completed');
  const setLayout = useLibraryStore((state) => state.setRoomLayout);
  const [category, setCategory] = useState<RoomCategory>(
    initialCategory ?? "desk",
  );
  const [busy, setBusy] = useState(false);
  const [tool, setTool] = useState<Tool>("pieces");
  const [collapsed, setCollapsed] = useState(false);
  const [step, setStep] = useState(0.1);
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
        useRoomEditor.getState().close();
        onClose();
        return true;
      },
    );
    return () => subscription.remove();
  }, [onClose]);
  if (!draft) return null;
  const selected = draft.pieces.find((p) => p.id === selectedId);
  const activeCategory = selected?.category ?? category;
  const text = { color: isNight ? darkTheme.text : colors.ink };
  const accent = isNight ? darkTheme.accent : colors.terracotta;
  const active = { borderColor: accent, backgroundColor: isNight ? darkTheme.surfaceElevated : colors.terracottaSoft };
  const primary = { backgroundColor: accent };
  const primaryText = { color: isNight ? darkTheme.actionText : colors.white };
  const muted = { color: isNight ? darkTheme.textMuted : colors.muted };
  const surface = { backgroundColor: isNight ? darkTheme.surface : colors.paper };
  const control = { backgroundColor: isNight ? darkTheme.surfaceElevated : colors.softFill };
  const finish = () => {
    close();
    onClose();
  };
  const placeNew = (piece: RoomPiece) => {
    // Find a free slot rather than creating overlapping duplicates.
    if (piece.surface === "floor") {
      for (let z = -2.7; z <= 2.8; z += 0.5)
        for (let x = -2.7; x <= 2.8; x += 0.5) {
          const candidate = {
            ...piece,
            position: [Math.round(x * 10) / 10, 0, Math.round(z * 10) / 10] as [
              number,
              number,
              number,
            ],
          };
          if (isRoomPlacementValid(candidate, draft.pieces))
            return add(candidate);
        }
    } else {
      for (const surface of ["back-wall", "left-wall"] as const)
        for (let h = -2.5; h <= 2.5; h += 0.5)
          for (let y = 1; y <= 2.5; y += 0.5) {
            const candidate = {
              ...piece,
              surface,
              rotation: surface === "left-wall" ? Math.PI / 2 : 0,
              position: (surface === "left-wall"
                ? [-3.43, y, h]
                : [h, y, -3.53]) as [number, number, number],
            };
            if (isRoomPlacementValid(candidate, draft.pieces))
              return add(candidate);
          }
    }
    Alert.alert("Sem espaço", "Mova algumas peças para abrir espaço.");
    return false;
  };
  const choosePhoto = async () => {
    if (!selected || busy) return;
    const id = selected.id;
    setBusy(true);
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
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
      Alert.alert(
        "Foto indisponível",
        "Não foi possível abrir esta foto. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  };
  const apply = (piece: RoomPiece) => feedback(update(piece));
  const action = (
    label: string,
    onPress: () => void,
    options: {
      icon?: Icon;
      disabled?: boolean;
      primary?: boolean;
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
        styles.button,
        control,
        options.primary && primary,
        options.iconOnly && styles.iconButton,
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
                ? "#BF5546"
                : text.color
          }
        />
      ) : null}
      {!options.iconOnly ? (
        <Text
          style={[
            styles.buttonText,
            text,
            options.primary && primaryText,
            options.danger && { color: "#BF5546" },
          ]}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
  const extraCount = draft.pieces.filter(
    (p) =>
      (p.category === "plant" && p.id !== "desk-plant") ||
      (p.category === "frame" && !["frame", "poster"].includes(p.id)),
  ).length;
  const canDuplicate =
    selected &&
    (selected.category === "frame" ||
      (selected.category === "plant" && selected.surface === "floor"));
  const canRemove =
    selected &&
    ["plant", "frame", "window"].includes(selected.category) &&
    selected.id !== "desk-plant";
  const addDecoration = (category: RoomCategory) => {
    const existing = draft.pieces.find((p) => p.category === category);
    const piece: RoomPiece = {
      id: category === "window" ? "window" : nextDecorationId(category),
      category,
      modelId: existing?.modelId ?? `natural-${category}`,
      finish: existing?.finish ?? "original",
      surface: category === "plant" ? "floor" : "back-wall",
      position: [0, 0, 0],
      rotation: 0,
    };
    if (placeNew(piece)) {
      setTool("position");
      setCollapsed(false);
      feedback();
    }
  };
  const move = (direction: "left" | "right" | "up" | "down") => {
    const state = useRoomEditor.getState();
    const piece = state.draft?.pieces.find((p) => p.id === state.selectedId);
    if (piece) apply(nudgeRoomPiece(piece, direction, step));
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
        control,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} color={text.color} size={24} />
    </Pressable>
  );
  const rotate = (direction: number) => {
    if (selected)
      apply({
        ...selected,
        rotation: snapRoomRotation(
          selected.rotation + (direction * Math.PI) / 4,
        ),
      });
  };
  const activeTool =
    tool === "position" && selected?.category === "cat"
      ? "model"
      : tool === "finish" && selected?.category !== "rug"
      ? "position"
      : tool === "art" && selected?.category !== "frame"
        ? "position"
        : tool;
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View
        style={[
          styles.top,
          surface,
          {
            top: insets.top + 8,
            left: Math.max(insets.left, 12),
            right: Math.max(insets.right, 12),
          },
        ]}
      >
        {action("Cancelar", finish)}
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
            if (changed) trackEvent('room_customization_saved', { piece_count: editor.draft!.pieces.length });
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
        <View style={styles.summary}>
          {selected && selected.category !== "cat" && activeTool !== "environment" ? (
            <Image
              source={roomModel(selected).thumbnail}
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
            <Text numberOfLines={1} style={[styles.title, text]}>
              {activeTool === "environment"
                ? "Personalizar sala"
                : selected
                  ? categoryName(selected.category)
                  : "Personalizar sala"}
            </Text>
            <Text style={[styles.caption, muted]}>
              {activeTool === "environment"
                ? "Escolha as cores das paredes e do piso"
                : selected
                  ? `${selected.category === "cat" ? "Gatinho" : ROOM_COLLECTIONS.find((c) => selected.modelId.startsWith(c.id))?.name} · ${surfaceName(selected)}`
                  : "Toque em uma peça na sala ou na lista"}
            </Text>
          </View>
          {action(
            collapsed ? "Expandir controles" : "Recolher controles",
            () => setCollapsed(!collapsed),
            { icon: collapsed ? "chevron-up" : "chevron-down", iconOnly: true },
          )}
        </View>
        {invalid && activeTool !== "environment" ? (
          <Text accessibilityLiveRegion="polite" style={[styles.error, { color: isNight ? darkTheme.accent : colors.terracottaDark }]}>
            Não cabe aqui. A última posição válida foi mantida.
          </Text>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tools} style={styles.toolScroll}>
          {tools
            .filter(
              (item) =>
                (item.id === "pieces" || item.id === "environment" || Boolean(selected)) &&
                (item.id !== "position" || selected?.category !== "cat") &&
                (item.id !== "art" || selected?.category === "frame") &&
                (item.id !== "finish" || selected?.category === "rug"),
            )
            .map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                accessibilityState={{ selected: activeTool === item.id }}
                onPress={() => {
                  stopRepeat();
                  setCameraMode(false);
                  setTool(item.id);
                  setCollapsed(false);
                  feedback();
                }}
                style={({ pressed }) => [
                  styles.tool,
                  activeTool === item.id && active,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name={item.icon}
                  size={22}
                  color={activeTool === item.id ? accent : muted.color}
                />
                <Text
                  numberOfLines={1}
                  style={[
                    styles.toolLabel,
                    activeTool === item.id ? text : muted,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
        </ScrollView>
        {!collapsed ? (
          <ScrollView
            key={activeTool}
            showsVerticalScrollIndicator
            contentContainerStyle={styles.body}
            style={styles.scroll}
          >
            {activeTool === "pieces" ? (
              <>
                <Text style={[styles.hint, muted]}>Escolha uma peça para mover ou mudar o modelo.</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryGrid}>
                  {ROOM_CATEGORIES.map((c) => (
                    <Pressable
                      key={c.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: activeCategory === c.id }}
                      onPress={() => {
                        setCategory(c.id);
                        select(
                          draft.pieces.find((p) => p.category === c.id)?.id ??
                            null,
                        );
                        feedback();
                      }}
                      style={[
                        styles.chip,
                        control,
                        activeCategory === c.id && active,
                      ]}
                    >
                      <Text style={[styles.buttonText, text]}>{c.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={styles.grid}>
                  {draft.pieces
                    .filter((p) => p.category === activeCategory)
                    .map((p, i) => (
                      <Pressable
                        key={p.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Selecionar ${categoryName(p.category)} ${i + 1}, ${surfaceName(p)}`}
                        accessibilityState={{ selected: p.id === selectedId }}
                        onPress={() => {
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
                        {p.category === "cat" ? (
                          <View
                            style={[
                              styles.piecePreview,
                              {
                                alignItems: "center",
                                justifyContent: "center",
                              },
                            ]}
                          >
                            <Ionicons
                              name="paw-outline"
                              size={36}
                              color={text.color}
                            />
                          </View>
                        ) : (
                          <Image
                            source={roomModel(p).thumbnail}
                            style={styles.piecePreview}
                            contentFit="contain"
                          />
                        )}
                        <Text style={[styles.buttonText, text]}>
                          {categoryName(p.category)}
                          {draft.pieces.filter(
                            (other) => other.category === p.category,
                          ).length > 1
                            ? ` ${i + 1}`
                            : ""}
                        </Text>
                        <Text style={[styles.caption, muted]}>
                          {surfaceName(p)}
                        </Text>
                      </Pressable>
                    ))}
                </View>
                {["plant", "frame"].includes(activeCategory)
                  ? action(
                      activeCategory === "plant"
                        ? "Adicionar planta no piso"
                        : "Adicionar quadro",
                      () => addDecoration(activeCategory),
                      {
                        icon: "add",
                        disabled: extraCount >= MAX_EXTRA_DECORATIONS,
                      },
                    )
                  : null}
                {activeCategory === "window" &&
                !draft.pieces.some((p) => p.category === "window")
                  ? action("Adicionar janela", () => addDecoration("window"), {
                      icon: "add",
                    })
                  : null}
                <View style={styles.between}>

                  {action(
                    "Restaurar disposição",
                    () =>
                      Alert.alert(
                        "Restaurar disposição?",
                        "Você poderá desfazer esta ação antes de salvar.",
                        [
                          { text: "Cancelar", style: "cancel" },
                          {
                            text: "Restaurar",
                            onPress: () => {
                              restore();
                              feedback();
                            },
                          },
                        ],
                      ),
                    { icon: "refresh-outline" },
                  )}
                </View>
              </>
            ) : null}
            {!selected && activeTool !== "pieces"
              ? action("Escolher uma peça", () => setTool("pieces"), {
                  icon: "grid-outline",
                })
              : null}
            {selected && activeTool === "position" ? (
              <>
                <View style={styles.row}>
                  {action("Mover peça", () => setCameraMode(false), { icon: "move-outline", primary: !cameraMode, grow: true })}
                  {action("Girar sala", () => setCameraMode(true), { icon: "videocam-outline", primary: cameraMode, grow: true })}
                </View>
                {cameraMode ? (
                  <Text style={[styles.hint, muted]}>
                    Arraste para girar a sala. Use dois dedos para aproximar ou
                    afastar.
                  </Text>
                ) : null}
                {cameraMode ? null : selected.surface === "desk" ? (
                  <Text style={[styles.hint, muted]}>
                    Esta planta acompanha a mesa. Selecione a mesa para mover o
                    conjunto.
                  </Text>
                ) : (
                  <>
                    <Text style={[styles.hint, muted]}>
                      Arraste a peça na sala. Para ajustar com precisão, use as setas.
                    </Text>
                    <View style={styles.positionControls}>
                      <View style={styles.pad}>
                        <View style={styles.padRow}>
                          {arrow(
                            "up",
                            selected.surface === "floor"
                              ? "Mover para o fundo"
                              : "Mover para cima",
                            "chevron-up",
                          )}
                        </View>
                        <View style={styles.padRow}>
                          {arrow(
                            "left",
                            "Mover para a esquerda",
                            "chevron-back",
                          )}
                          <View style={styles.padCenter}>
                            <Ionicons
                              name="move-outline"
                              size={19}
                              color={muted.color}
                            />
                          </View>
                          {arrow(
                            "right",
                            "Mover para a direita",
                            "chevron-forward",
                          )}
                        </View>
                        <View style={styles.padRow}>
                          {arrow(
                            "down",
                            selected.surface === "floor"
                              ? "Mover para a frente"
                              : "Mover para baixo",
                            "chevron-down",
                          )}
                        </View>
                      </View>
                      <View style={styles.positionOptions}>
                        <Text style={[styles.caption, muted]}>
                          Passo de ajuste
                        </Text>
                        <View style={styles.row}>
                          {[0.1, 0.5].map((value) => (
                            <Pressable
                              key={value}
                              accessibilityRole="button"
                              accessibilityLabel={`Passo ${value.toFixed(1)} unidade`}
                              accessibilityState={{ selected: step === value }}
                              onPress={() => setStep(value)}
                              style={[
                                styles.chip,
                                control,
                                step === value && active,
                              ]}
                            >
                              <Text style={[styles.buttonText, text]}>
                                {value === 0.1 ? "Fino" : "Amplo"}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                        <Text style={[styles.caption, muted]}>{selected.surface === "floor" ? "Rotação" : "Localização"}</Text>
                        {selected.surface === "floor" ? (
                          <View style={styles.row}>
                            {action("Girar 45° à esquerda", () => rotate(-1), {
                              icon: "arrow-undo-outline",
                              iconOnly: true,
                            })}
                            {action("Girar 45° à direita", () => rotate(1), {
                              icon: "arrow-redo-outline",
                              iconOnly: true,
                            })}
                            <Text style={[styles.caption, muted]}>
                              {Math.round((selected.rotation * 180) / Math.PI) %
                                360}
                              °
                            </Text>
                          </View>
                        ) : (
                          action(
                            "Trocar parede",
                            () => placeWall(selected, apply),
                            { icon: "swap-horizontal" },
                          )
                        )}
                      </View>
                    </View>
                  </>
                )}
                <View style={styles.row}>
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
                          disabled: extraCount >= MAX_EXTRA_DECORATIONS,
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
                        { icon: "trash-outline", danger: true },
                      )
                    : null}
                  {selected.category === "plant" && selected.surface === "desk"
                    ? action(
                        "Adicionar no piso",
                        () => addDecoration("plant"),
                        {
                          icon: "add",
                          disabled: extraCount >= MAX_EXTRA_DECORATIONS,
                        },
                      )
                    : null}
                </View>
              </>
            ) : null}
            {selected &&
            activeTool === "model" &&
            selected.category !== "cat" ? (
              <>
                <Text style={[styles.hint, muted]}>
                  Troque o modelo mantendo posição e acabamento.
                </Text>
                {ROOM_COLLECTIONS.map((collection) => {
                  const modelId = `${collection.id}-${selected.category}`;
                  return (
                    <Pressable
                      key={modelId}
                      accessibilityRole="button"
                      accessibilityLabel={collection.name}
                      accessibilityState={{
                        selected: selected.modelId === modelId,
                      }}
                      onPress={() => apply({ ...selected, modelId })}
                      style={[
                        styles.modelCard,
                        control,
                        selected.modelId === modelId && active,
                      ]}
                    >
                      <Image
                        source={roomModel({ ...selected, modelId }).thumbnail}
                        style={styles.modelPreview}
                        contentFit="contain"
                      />
                      <Text style={[styles.buttonText, styles.flex, text]}>
                        {collection.name}
                      </Text>
                      <Ionicons
                        name={
                          selected.modelId === modelId
                            ? "checkmark-circle"
                            : "ellipse-outline"
                        }
                        size={23}
                        color={
                          selected.modelId === modelId ? accent : muted.color
                        }
                      />
                    </Pressable>
                  );
                })}
                {["desk", "bookcase", "lamp", "plant"].includes(
                  selected.category,
                ) ? (
                  <View style={styles.body}>
                    <Text style={[styles.caption, muted]}>Acabamento</Text>
                    <View style={styles.grid}>
                      {ROOM_FINISHES.map((f) => (
                        <Pressable
                          key={f.id}
                          accessibilityRole="button"
                          accessibilityLabel={f.name}
                          accessibilityState={{
                            selected: selected.finish === f.id,
                          }}
                          onPress={() => apply({ ...selected, finish: f.id })}
                          style={[
                            styles.finishCard,
                            control,
                            selected.finish === f.id && active,
                          ]}
                        >
                          <View
                            style={[
                              styles.swatch,
                              { backgroundColor: f.color },
                            ]}
                          />
                          <Text style={[styles.buttonText, styles.flex, text]}>
                            {f.name}
                          </Text>
                          {selected.finish === f.id ? (
                            <Ionicons
                              name="checkmark"
                              size={18}
                              color={text.color}
                            />
                          ) : null}
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}
              </>
            ) : null}
            {activeTool === "environment" ? (
              <RoomAppearanceOptions category="environment" isNight={isNight} />
            ) : null}
            {selected?.category === "cat" && activeTool === "model" ? (
              <RoomAppearanceOptions
                category="cat"
                isNight={isNight}
                loadingCatId={loadingCatId}
              />
            ) : null}
            {selected?.category === "rug" && activeTool === "finish" ? (
              <RoomAppearanceOptions category="rug" isNight={isNight} />
            ) : null}
            {selected && activeTool === "art" ? (
              <>
                <View style={styles.row}>
                  {action(
                    busy ? "Abrindo foto…" : "Sua foto",
                    () => {
                      void choosePhoto();
                    },
                    { icon: "image-outline", disabled: busy, grow: true },
                  )}
                  {action(
                    "Arte padrão",
                    () =>
                      apply({ ...selected, photoUri: '', photo: { source: 'none', version: nextDecorationId("photo"), pending: true, previousPath: selected.photo?.storagePath ?? selected.photo?.previousPath }, bookId: undefined }),
                    { icon: "brush-outline", grow: true },
                  )}
                </View>
                <View style={styles.row}>
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
                      <Text style={[styles.buttonText, text]}>
                        {aspect === "square" ? "Quadrado" : "Retrato"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {completedBooks.length ? (
                  <Text style={[styles.hint, muted]}>
                    Ou use a capa de um livro concluído
                  </Text>
                ) : (
                  <Text style={[styles.hint, muted]}>
                    Conclua um livro para desbloquear sua capa nos quadros.
                  </Text>
                )}
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
                    style={[
                      styles.bookRow,
                      control,
                      selected.bookId === book.id && active,
                    ]}
                  >
                    {book.coverUrl ? (
                      <Image
                        source={book.coverUrl}
                        style={styles.bookCover}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={[
                          styles.bookCover,
                          { backgroundColor: book.coverColor },
                        ]}
                      />
                    )}
                    <Text
                      numberOfLines={2}
                      style={[styles.buttonText, text, styles.flex]}
                    >
                      {book.title}
                    </Text>
                  </Pressable>
                ))}
              </>
            ) : null}
          </ScrollView>
        ) : null}

      </View>
    </View>
  );
}

function placeWall(piece: RoomPiece, apply: (p: RoomPiece) => void) {
  const surface = piece.surface === "back-wall" ? "left-wall" : "back-wall";
  apply({
    ...piece,
    surface,
    rotation: surface === "left-wall" ? Math.PI / 2 : 0,
    position:
      surface === "left-wall"
        ? [-3.43, piece.position[1], piece.position[0]]
        : [piece.position[2], piece.position[1], -3.53],
  });
}
const styles = StyleSheet.create({
  top: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    padding: 6,
    borderRadius: 20,
  },
  panel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 8,
  },
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
  error: { fontSize: 13, lineHeight: 18, color: "#BF5546" },
  flex: { flex: 1 },
  scroll: { flexShrink: 1 },
  body: { gap: 12, paddingBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  between: { gap: 8 },
  button: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: controls.button.borderRadius,
  },
  buttonText: { fontSize: 13, fontWeight: "600" },
  iconButton: { ...controls.iconButton, paddingHorizontal: 0 },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.65 },
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
  pieceCard: {
    width: "48%",
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "transparent",
    gap: 2,
  },
  selectionCheck: { position: "absolute", top: 8, right: 8, zIndex: 1 },
  categoryGrid: { gap: 8 },
  piecePreview: { height: 80, width: "100%" },
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
  positionControls: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  pad: { gap: 3 },
  padRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  arrow: {
    ...controls.iconButton,
  },
  padCenter: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  positionOptions: { gap: 10, flexShrink: 1 },
  bookRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: controls.button.borderRadius,
    borderWidth: 1,
    borderColor: "transparent",
  },
  bookCover: { width: 32, height: 46, borderRadius: 3 },
  toolScroll: { flexGrow: 0, flexShrink: 0, minHeight: 64 },
  tools: { gap: 8, paddingVertical: 4 },
  tool: {
    minWidth: 78,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "transparent",
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: controls.button.borderRadius,
  },
  toolLabel: { fontSize: 12, fontWeight: "600" },
});
