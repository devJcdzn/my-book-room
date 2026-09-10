import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookCover } from '@/src/components/book-cover';
import { useLibraryStore } from '@/src/store/library-store';
import { colors, typography } from '@/src/theme';
import {
  BOOKCASE_PALETTES,
  BookcasePalette,
  CAT_OPTIONS,
  CatOption,
  FLOOR_PALETTES,
  FloorPalette,
  getBookcasePalette,
  getFloorPalette,
  getPictureFrameStyle,
  getPosterFrame,
  getRugPalette,
  getWallPalette,
  getWindowStyle,
  PICTURE_FRAME_STYLES,
  PictureFrameSize,
  POSTER_FRAME_OPTIONS,
  RUG_PALETTES,
  RugPalette,
  WALL_PALETTES,
  WallPalette,
  WINDOW_STYLES,
} from '@/src/types/room-customization';

export type ScreenAnchorPos = {
  x: number;
  y: number;
};

export type CustomizationAnchorItem = {
  id: string;
  category: 'walls' | 'flooring' | 'rug' | 'bookcase' | 'cat' | 'left_wall' | 'picture_frame';
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  pos: [number, number, number];
};

// Itens efetivamente personalizáveis com espaçamento generoso e sem sobreposições
export const CUSTOMIZATION_ANCHORS: CustomizationAnchorItem[] = [
  {
    id: 'walls',
    category: 'walls',
    title: 'Paredes',
    icon: 'color-palette-outline',
    pos: [0.0, 3.15, -3.2],
  },
  {
    id: 'left_wall',
    category: 'left_wall',
    title: 'Decorar',
    icon: 'add',
    pos: [-3.44, 2.05, 0.55],
  },
  {
    id: 'picture_frame',
    category: 'picture_frame',
    title: 'Quadro',
    icon: 'image-outline',
    pos: [-1.85, 1.95, -3.2],
  },
  {
    id: 'flooring',
    category: 'flooring',
    title: 'Piso',
    icon: 'layers-outline',
    pos: [-2.3, 0.05, 1.9],
  },
  {
    id: 'bookcase',
    category: 'bookcase',
    title: 'Estante',
    icon: 'library-outline',
    pos: [1.45, 2.2, -2.7],
  },
  {
    id: 'rug',
    category: 'rug',
    title: 'Tapete',
    icon: 'disc-outline',
    pos: [-0.5, 0.05, 1.8],
  },
  {
    id: 'cat',
    category: 'cat',
    title: 'Gatinho',
    icon: 'paw-outline',
    pos: [2.10, 0.70, 1.40],
  },
];

type RoomCustomizationOverlayProps = {
  anchorPositions: Record<string, ScreenAnchorPos>;
  isNight: boolean;
  onExit: () => void;
  loadingCatId?: string | null;
};

export function RoomCustomizationOverlay({
  anchorPositions,
  isNight,
  onExit,
  loadingCatId,
}: RoomCustomizationOverlayProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [activeCategory, setActiveCategory] = useState<
    'walls' | 'flooring' | 'rug' | 'bookcase' | 'cat' | 'left_wall' | 'picture_frame' | null
  >(null);

  const wallPaletteId = useLibraryStore((state) => state.wallPaletteId);
  const setWallPaletteId = useLibraryStore((state) => state.setWallPaletteId);
  const floorPaletteId = useLibraryStore((state) => state.floorPaletteId);
  const setFloorPaletteId = useLibraryStore((state) => state.setFloorPaletteId);
  const bookcasePaletteId = useLibraryStore((state) => state.bookcasePaletteId);
  const setBookcasePaletteId = useLibraryStore((state) => state.setBookcasePaletteId);
  const rugPaletteId = useLibraryStore((state) => state.rugPaletteId);
  const setRugPaletteId = useLibraryStore((state) => state.setRugPaletteId);
  const catId = useLibraryStore((state) => state.catId);
  const setCatId = useLibraryStore((state) => state.setCatId);
  const leftWallItem = useLibraryStore((state) => state.leftWallItem);
  const setLeftWallItem = useLibraryStore((state) => state.setLeftWallItem);
  const leftWallPosterBookId = useLibraryStore((state) => state.leftWallPosterBookId);
  const setLeftWallPosterBookId = useLibraryStore((state) => state.setLeftWallPosterBookId);
  const leftWallWindowStyle = useLibraryStore((state) => state.leftWallWindowStyle);
  const setLeftWallWindowStyle = useLibraryStore((state) => state.setLeftWallWindowStyle);
  const leftWallFrameColor = useLibraryStore((state) => state.leftWallFrameColor);
  const setLeftWallFrameColor = useLibraryStore((state) => state.setLeftWallFrameColor);
  const pictureFrameSize = useLibraryStore((state) => state.pictureFrameSize);
  const setPictureFrameSize = useLibraryStore((state) => state.setPictureFrameSize);
  const pictureFrameStyleId = useLibraryStore((state) => state.pictureFrameStyleId);
  const setPictureFrameStyleId = useLibraryStore((state) => state.setPictureFrameStyleId);
  const pictureFramePhotoUri = useLibraryStore((state) => state.pictureFramePhotoUri);
  const setPictureFramePhotoUri = useLibraryStore((state) => state.setPictureFramePhotoUri);
  const books = useLibraryStore((state) => state.books);

  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

  const currentWallPalette = getWallPalette(wallPaletteId);
  const currentFloorPalette = getFloorPalette(floorPaletteId);
  const currentBookcasePalette = getBookcasePalette(bookcasePaletteId);
  const currentRugPalette = getRugPalette(rugPaletteId);
  const currentWindowStyle = getWindowStyle(leftWallWindowStyle);
  const currentPosterFrame = getPosterFrame(leftWallFrameColor);
  const currentPictureFrameStyle = getPictureFrameStyle(pictureFrameStyleId);

  const completedBooks = books.filter((book) => book.status === 'completed');
  const selectableBooks = completedBooks.length > 0 ? completedBooks : books;

  const handlePickPicturePhoto = async (targetSize: PictureFrameSize) => {
    if (targetSize === 'none') return;
    try {
      setIsProcessingPhoto(true);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permissão necessária',
          'Precisamos de permissão para acessar a galeria de fotos e personalizar o quadro.'
        );
        setIsProcessingPhoto(false);
        return;
      }

      const isOneToOne = targetSize === '1:1';
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: isOneToOne ? [1, 1] : [1, 2],
        quality: 0.85,
      });

      if (result.canceled || !result.assets[0]?.uri) {
        setIsProcessingPhoto(false);
        return;
      }

      const targetWidth = isOneToOne ? 512 : 384;
      const targetHeight = isOneToOne ? 512 : 768;

      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: targetWidth, height: targetHeight } }],
        {
          compress: 0.75,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      setPictureFramePhotoUri(manipulated.uri);
      if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.warn('Erro ao carregar foto para o quadro:', err);
      Alert.alert('Erro', 'Não foi possível carregar a imagem selecionada.');
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  const handlePinPress = (
    category: 'walls' | 'flooring' | 'rug' | 'bookcase' | 'cat' | 'left_wall' | 'picture_frame'
  ) => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveCategory(category);
  };

  const handleSelectWallPalette = (palette: WallPalette) => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWallPaletteId(palette.id);
  };

  const handleSelectFloorPalette = (palette: FloorPalette) => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFloorPaletteId(palette.id);
  };

  const handleSelectBookcasePalette = (palette: BookcasePalette) => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBookcasePaletteId(palette.id);
  };

  const handleSelectRugPalette = (palette: RugPalette) => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRugPaletteId(palette.id);
  };

  const handleSelectCat = (cat: CatOption) => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCatId(cat.id);
  };

  const isSurfaceActive =
    activeCategory === 'walls' ||
    activeCategory === 'flooring' ||
    activeCategory === 'rug';

  const currentPaletteName =
    activeCategory === 'walls'
      ? currentWallPalette.name
      : activeCategory === 'flooring'
        ? currentFloorPalette.name
        : currentRugPalette.name;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {/* Botão Concluir no Topo Direito */}
      <View
        pointerEvents="box-none"
        style={[styles.topBar, { top: insets.top + (process.env.EXPO_OS === 'android' ? 12 : 8) }]}
      >
        <Pressable
          accessibilityHint="Salva as personalizações e retorna à visão padrão da sala"
          accessibilityLabel="Concluir personalização"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => {
            if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onExit();
          }}
          style={({ pressed }) => [styles.doneBtn, pressed && styles.btnPressed]}
        >
          <Ionicons color="#FFF" name="checkmark" size={20} />
        </Pressable>
      </View>

      {/* Floating Badge Pins Ancorados em 3D: Visíveis apenas quando nenhuma categoria estiver aberta, garantindo sala desobstruída durante a edição */}
      {activeCategory === null ? (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          pointerEvents="box-none"
          style={StyleSheet.absoluteFill}
        >
          {CUSTOMIZATION_ANCHORS.map((item) => {
            const coords = anchorPositions[item.id];
            if (!coords) return null;

            const clampedX = Math.max(24, Math.min(width - 24, coords.x));
            const clampedY = Math.max(insets.top + 50, coords.y);
            const isSelected = activeCategory === item.category;

            // Customização visual dinâmica para slots de parede (esquerda e fundo)
            const isLeftWall = item.id === 'left_wall';
            const isLeftWallEmpty = isLeftWall && leftWallItem === 'none';

            const isPictureFrame = item.id === 'picture_frame';
            const isPictureFrameEmpty = isPictureFrame && pictureFrameSize === 'none';

            const isEmptySlot = isLeftWallEmpty || isPictureFrameEmpty;

            let pinIcon: keyof typeof Ionicons.glyphMap = item.icon;
            let pinTitle = item.title;

            if (isLeftWall) {
              if (leftWallItem === 'none') {
                pinIcon = 'add';
                pinTitle = 'Decorar';
              } else if (leftWallItem === 'window') {
                pinIcon = 'grid-outline';
                pinTitle = 'Janela';
              } else if (leftWallItem === 'poster') {
                pinIcon = 'image-outline';
                pinTitle = 'Pôster';
              }
            } else if (isPictureFrame) {
              if (pictureFrameSize === 'none') {
                pinIcon = 'add';
                pinTitle = 'Quadro';
              } else {
                pinIcon = 'image-outline';
                pinTitle = pictureFrameSize === '1:1' ? 'Quadro Quadrado' : 'Quadro Retrato';
              }
            }

            return (
              <View
                key={item.id}
                pointerEvents="box-none"
                style={[
                  styles.pinContainer,
                  {
                    left: clampedX,
                    top: clampedY,
                  },
                ]}
              >
                <Pressable
                  accessibilityHint={`Abre as opções de personalização de ${pinTitle}`}
                  accessibilityLabel={`${pinTitle} (Personalizável)`}
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={() => handlePinPress(item.category)}
                  style={({ pressed }) => [
                    styles.pinButton,
                    isNight && styles.darkPinButton,
                    isEmptySlot && styles.addSlotPinButton,
                    isEmptySlot && isNight && styles.darkAddSlotPinButton,
                    isSelected && styles.pinButtonSelected,
                    pressed && styles.btnPressed,
                  ]}
                >
                  <Ionicons
                    color={
                      isSelected
                        ? '#FFF'
                        : isNight ? '#FFAE70' : colors.terracotta
                    }
                    name={pinIcon}
                    size={isEmptySlot ? 20 : 18}
                  />
                </Pressable>

                {/* Label Compacto Flutuante Abaixo do Pin */}
                <View
                  pointerEvents="none"
                  style={[
                    styles.pinLabelWrap,
                    isNight && styles.darkPinLabelWrap,
                    isSelected && styles.pinLabelSelected,
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.pinLabelText,
                      isNight && styles.darkText,
                      isSelected && styles.pinLabelTextSelected,
                    ]}
                  >
                    {pinTitle}
                  </Text>
                </View>
              </View>
            );
          })}
        </Animated.View>
      ) : null}

      {/* Painel Flutuante de Seleção de Superfícies (Paredes, Piso, Tapete) */}
      {isSurfaceActive ? (
        <Animated.View
          entering={FadeInDown.duration(220)}
          exiting={FadeOutDown.duration(160)}
          style={[styles.paletteCapsule, isNight && styles.darkPaletteCapsule, { bottom: insets.bottom + 80 }]}
        >
          {/* Seletor Segmentado de Superfícies: Apenas Paredes, Piso e Tapete */}
          <View style={[styles.categoryTabsRow, isNight && styles.darkCategoryTabsRow]}>
            <Pressable
              accessibilityLabel="Selecionar Paredes"
              accessibilityRole="button"
              hitSlop={6}
              onPress={() => handlePinPress('walls')}
              style={({ pressed }) => [
                styles.categoryTab,
                activeCategory === 'walls' && styles.categoryTabActive,
                pressed && styles.btnPressed,
              ]}
            >
              <Ionicons
                color={activeCategory === 'walls' ? '#FFF' : isNight ? '#A0A5B5' : colors.muted}
                name="color-palette-outline"
                size={14}
              />
              <Text
                style={[
                  styles.categoryTabText,
                  isNight && styles.darkCategoryTabText,
                  activeCategory === 'walls' && styles.categoryTabTextActive,
                ]}
              >
                Paredes
              </Text>
            </Pressable>

            <Pressable
              accessibilityLabel="Selecionar Piso"
              accessibilityRole="button"
              hitSlop={6}
              onPress={() => handlePinPress('flooring')}
              style={({ pressed }) => [
                styles.categoryTab,
                activeCategory === 'flooring' && styles.categoryTabActive,
                pressed && styles.btnPressed,
              ]}
            >
              <Ionicons
                color={activeCategory === 'flooring' ? '#FFF' : isNight ? '#A0A5B5' : colors.muted}
                name="layers-outline"
                size={14}
              />
              <Text
                style={[
                  styles.categoryTabText,
                  isNight && styles.darkCategoryTabText,
                  activeCategory === 'flooring' && styles.categoryTabTextActive,
                ]}
              >
                Piso
              </Text>
            </Pressable>

            <Pressable
              accessibilityLabel="Selecionar Tapete"
              accessibilityRole="button"
              hitSlop={6}
              onPress={() => handlePinPress('rug')}
              style={({ pressed }) => [
                styles.categoryTab,
                activeCategory === 'rug' && styles.categoryTabActive,
                pressed && styles.btnPressed,
              ]}
            >
              <Ionicons
                color={activeCategory === 'rug' ? '#FFF' : isNight ? '#A0A5B5' : colors.muted}
                name="disc-outline"
                size={14}
              />
              <Text
                style={[
                  styles.categoryTabText,
                  isNight && styles.darkCategoryTabText,
                  activeCategory === 'rug' && styles.categoryTabTextActive,
                ]}
              >
                Tapete
              </Text>
            </Pressable>

            {/* Botão de Fechar Compacto */}
            <Pressable
              accessibilityLabel="Ocultar seletor"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => setActiveCategory(null)}
              style={styles.closeTabBtn}
            >
              <Ionicons color={isNight ? '#8C92A4' : '#9E9287'} name="close" size={16} />
            </Pressable>
          </View>

          {/* Nome da Paleta Atual */}
          <View style={styles.paletteHeaderRow}>
            <Text numberOfLines={1} style={[styles.paletteTitleText, isNight && styles.darkText]}>
              {currentPaletteName}
            </Text>
          </View>

          {/* Linha Minimalista de Círculos de Cores */}
          <ScrollView
            contentContainerStyle={styles.swatchesRow}
            horizontal
            keyboardShouldPersistTaps="always"
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
          >
            {activeCategory === 'walls' &&
              WALL_PALETTES.map((palette) => {
                const isCurrent = palette.id === wallPaletteId;
                return (
                  <Pressable
                    key={palette.id}
                    accessibilityHint={palette.subtitle}
                    accessibilityLabel={`Cor ${palette.name}`}
                    accessibilityRole="button"
                    hitSlop={6}
                    onPress={() => handleSelectWallPalette(palette)}
                    style={({ pressed }) => [
                      styles.swatchCircleWrap,
                      isCurrent && styles.swatchCircleActive,
                      pressed && styles.btnPressed,
                    ]}
                  >
                    <View style={[styles.swatchCircle, { backgroundColor: palette.previewColor }]} />
                  </Pressable>
                );
              })}

            {activeCategory === 'flooring' &&
              FLOOR_PALETTES.map((palette) => {
                const isCurrent = palette.id === floorPaletteId;
                return (
                  <Pressable
                    key={palette.id}
                    accessibilityHint={palette.subtitle}
                    accessibilityLabel={`Piso ${palette.name}`}
                    accessibilityRole="button"
                    hitSlop={6}
                    onPress={() => handleSelectFloorPalette(palette)}
                    style={({ pressed }) => [
                      styles.swatchCircleWrap,
                      isCurrent && styles.swatchCircleActive,
                      pressed && styles.btnPressed,
                    ]}
                  >
                    <View style={[styles.swatchCircle, { backgroundColor: palette.plankColor }]}>
                      <View style={[styles.floorGroovePreview, { backgroundColor: palette.grooveColor }]} />
                    </View>
                  </Pressable>
                );
              })}

            {activeCategory === 'rug' &&
              RUG_PALETTES.map((palette) => {
                const isCurrent = palette.id === rugPaletteId;
                return (
                  <Pressable
                    key={palette.id}
                    accessibilityHint={palette.subtitle}
                    accessibilityLabel={`Tapete ${palette.name}`}
                    accessibilityRole="button"
                    hitSlop={6}
                    onPress={() => handleSelectRugPalette(palette)}
                    style={({ pressed }) => [
                      styles.swatchCircleWrap,
                      isCurrent && styles.swatchCircleActive,
                      pressed && styles.btnPressed,
                    ]}
                  >
                    <View style={[styles.swatchCircle, { backgroundColor: palette.mainColor }]}>
                      <View style={[styles.rugInnerCirclePreview, { backgroundColor: palette.innerColor }]} />
                    </View>
                  </Pressable>
                );
              })}
          </ScrollView>
        </Animated.View>
      ) : null}

      {/* Card Flutuante Exclusivo da Estante */}
      {activeCategory === 'bookcase' ? (
        <Animated.View
          entering={FadeInDown.duration(200)}
          exiting={FadeOutDown.duration(150)}
          style={[styles.bookcaseCapsule, isNight && styles.darkPaletteCapsule, { bottom: insets.bottom + 80 }]}
        >
          <View style={styles.bookcaseHeaderRow}>
            <View style={styles.bookcaseHeaderLeft}>
              <Ionicons color={colors.terracotta} name="library-outline" size={15} />
              <Text style={[styles.bookcaseHeaderTitle, isNight && styles.darkText]}>
                Estante • {currentBookcasePalette.name}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Fechar seletor"
              hitSlop={8}
              onPress={() => setActiveCategory(null)}
              style={styles.closeTabBtn}
            >
              <Ionicons color={isNight ? '#8C92A4' : '#9E9287'} name="close" size={16} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.swatchesRow}
            horizontal
            keyboardShouldPersistTaps="always"
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
          >
            {BOOKCASE_PALETTES.map((palette) => {
              const isCurrent = palette.id === bookcasePaletteId;
              return (
                <Pressable
                  key={palette.id}
                  accessibilityHint={palette.subtitle}
                  accessibilityLabel={`Estante ${palette.name}`}
                  accessibilityRole="button"
                  hitSlop={6}
                  onPress={() => handleSelectBookcasePalette(palette)}
                  style={({ pressed }) => [
                    styles.swatchCircleWrap,
                    isCurrent && styles.swatchCircleActive,
                    pressed && styles.btnPressed,
                  ]}
                >
                  <View style={[styles.swatchCircle, { backgroundColor: palette.frameColor }]}>
                    <View style={[styles.bookcaseShelfPreview, { backgroundColor: palette.shelfColor }]} />
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>
      ) : null}

      {/* Card Flutuante Exclusivo do Gatinho: Posicionado à esquerda para NUNCA cobrir o gato à direita */}
      {activeCategory === 'cat' ? (
        <Animated.View
          entering={FadeInDown.duration(200)}
          exiting={FadeOutDown.duration(150)}
          style={[styles.catCapsule, isNight && styles.darkPaletteCapsule, { bottom: insets.bottom + 80 }]}
        >
          <View style={styles.catHeaderRow}>
            <View style={styles.catHeaderLeft}>
              <Ionicons color={colors.terracotta} name="paw" size={15} />
              <Text style={[styles.catHeaderTitle, isNight && styles.darkText]}>
                {loadingCatId ? 'Aconchegando gatinho...' : 'Gatinho da Sala'}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Fechar seletor"
              hitSlop={8}
              onPress={() => setActiveCategory(null)}
              style={styles.closeTabBtn}
            >
              <Ionicons color={isNight ? '#8C92A4' : '#9E9287'} name="close" size={16} />
            </Pressable>
          </View>

          <View style={styles.catOptionsRow}>
            {CAT_OPTIONS.map((cat) => {
              const isCurrent = cat.id === catId;
              const isLoading = cat.id === loadingCatId;
              return (
                <Pressable
                  key={cat.id}
                  accessibilityHint={cat.subtitle}
                  accessibilityLabel={cat.name}
                  accessibilityRole="button"
                  hitSlop={6}
                  onPress={() => handleSelectCat(cat)}
                  style={({ pressed }) => [
                    styles.catOptionChip,
                    isCurrent && styles.catOptionChipActive,
                    isLoading && styles.catOptionChipLoading,
                    isNight && !isCurrent && styles.darkCatOptionChip,
                    pressed && styles.btnPressed,
                  ]}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFF" size={12} style={{ marginRight: 2 }} />
                  ) : (
                    <View style={[styles.catSwatchMini, { backgroundColor: cat.bedColor }]}>
                      <View style={[styles.catFurDot, { backgroundColor: cat.furColor }]} />
                    </View>
                  )}
                  <Text
                    style={[
                      styles.catOptionText,
                      isCurrent && styles.catOptionTextActive,
                      isNight && !isCurrent && styles.darkText,
                    ]}
                  >
                    {cat.name.replace('Gatinho ', '')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      ) : null}

      {/* Card Flutuante Exclusivo da Decoração da Parede Esquerda (Janela ou Pôster) */}
      {activeCategory === 'left_wall' ? (
        <Animated.View
          entering={FadeInDown.duration(200)}
          exiting={FadeOutDown.duration(150)}
          style={[styles.leftWallCapsule, isNight && styles.darkPaletteCapsule, { bottom: insets.bottom + 80 }]}
        >
          {/* Cabeçalho */}
          <View style={styles.leftWallHeaderRow}>
            <View style={styles.leftWallHeaderLeft}>
              <Ionicons
                color={colors.terracotta}
                name={
                  leftWallItem === 'window'
                    ? 'grid-outline'
                    : leftWallItem === 'poster'
                      ? 'image-outline'
                      : 'sparkles-outline'
                }
                size={16}
              />
              <Text style={[styles.leftWallHeaderTitle, isNight && styles.darkText]}>
                {leftWallItem === 'window'
                  ? `Janela • ${currentWindowStyle.name}`
                  : leftWallItem === 'poster'
                    ? 'Pôster de Leitura'
                    : 'Decorar Parede'}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Fechar seletor"
              hitSlop={8}
              onPress={() => setActiveCategory(null)}
              style={styles.closeTabBtn}
            >
              <Ionicons color={isNight ? '#8C92A4' : '#9E9287'} name="close" size={16} />
            </Pressable>
          </View>

          {/* Seletor Segmentado: Vazia | Janela | Pôster */}
          <View style={[styles.leftWallTypeRow, isNight && styles.darkCategoryTabsRow]}>
            <Pressable
              accessibilityLabel="Deixar parede limpa"
              accessibilityRole="button"
              hitSlop={6}
              onPress={() => {
                if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setLeftWallItem('none');
              }}
              style={({ pressed }) => [
                styles.leftWallTypeTab,
                leftWallItem === 'none' && styles.leftWallTypeTabActive,
                pressed && styles.btnPressed,
              ]}
            >
              <Ionicons
                color={leftWallItem === 'none' ? '#FFF' : isNight ? '#A0A5B5' : colors.muted}
                name="ban-outline"
                size={13}
              />
              <Text
                style={[
                  styles.leftWallTypeTabText,
                  isNight && styles.darkCategoryTabText,
                  leftWallItem === 'none' && styles.leftWallTypeTabTextActive,
                ]}
              >
                Vazia
              </Text>
            </Pressable>

            <Pressable
              accessibilityLabel="Adicionar janela"
              accessibilityRole="button"
              hitSlop={6}
              onPress={() => {
                if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setLeftWallItem('window');
              }}
              style={({ pressed }) => [
                styles.leftWallTypeTab,
                leftWallItem === 'window' && styles.leftWallTypeTabActive,
                pressed && styles.btnPressed,
              ]}
            >
              <Ionicons
                color={leftWallItem === 'window' ? '#FFF' : isNight ? '#A0A5B5' : colors.muted}
                name="grid-outline"
                size={13}
              />
              <Text
                style={[
                  styles.leftWallTypeTabText,
                  isNight && styles.darkCategoryTabText,
                  leftWallItem === 'window' && styles.leftWallTypeTabTextActive,
                ]}
              >
                Janela
              </Text>
            </Pressable>

            <Pressable
              accessibilityLabel="Adicionar pôster"
              accessibilityRole="button"
              hitSlop={6}
              onPress={() => {
                if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setLeftWallItem('poster');
                if (!leftWallPosterBookId && selectableBooks.length > 0) {
                  setLeftWallPosterBookId(selectableBooks[0].id);
                }
              }}
              style={({ pressed }) => [
                styles.leftWallTypeTab,
                leftWallItem === 'poster' && styles.leftWallTypeTabActive,
                pressed && styles.btnPressed,
              ]}
            >
              <Ionicons
                color={leftWallItem === 'poster' ? '#FFF' : isNight ? '#A0A5B5' : colors.muted}
                name="image-outline"
                size={13}
              />
              <Text
                style={[
                  styles.leftWallTypeTabText,
                  isNight && styles.darkCategoryTabText,
                  leftWallItem === 'poster' && styles.leftWallTypeTabTextActive,
                ]}
              >
                Pôster
              </Text>
            </Pressable>
          </View>

          {/* Opções quando Janela está selecionada */}
          {leftWallItem === 'window' ? (
            <ScrollView
              contentContainerStyle={styles.swatchesRow}
              horizontal
              keyboardShouldPersistTaps="always"
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
            >
              {WINDOW_STYLES.map((style) => {
                const isCurrent = style.id === leftWallWindowStyle;
                return (
                  <Pressable
                    key={style.id}
                    accessibilityHint={style.subtitle}
                    accessibilityLabel={`Janela ${style.name}`}
                    accessibilityRole="button"
                    hitSlop={6}
                    onPress={() => {
                      if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setLeftWallWindowStyle(style.id);
                    }}
                    style={({ pressed }) => [
                      styles.swatchCircleWrap,
                      isCurrent && styles.swatchCircleActive,
                      pressed && styles.btnPressed,
                    ]}
                  >
                    <View style={[styles.swatchCircle, { backgroundColor: style.frameColor }]}>
                      <View style={[styles.windowPanePreview, { borderColor: style.mullionColor }]}>
                        <View style={[styles.windowMullionH, { backgroundColor: style.mullionColor }]} />
                        <View style={[styles.windowMullionV, { backgroundColor: style.mullionColor }]} />
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {/* Opções quando Pôster está selecionado */}
          {leftWallItem === 'poster' ? (
            <View style={styles.posterSectionContainer}>
              {/* Seleção do Livro */}
              <Text style={[styles.posterSubheading, isNight && styles.darkTextMuted]}>
                {completedBooks.length > 0
                  ? 'Escolha um livro lido para emoldurar:'
                  : 'Selecione um livro da estante:'}
              </Text>

              {selectableBooks.length === 0 ? (
                <View style={styles.emptyPosterBooksWrap}>
                  <Ionicons color={colors.muted} name="book-outline" size={16} />
                  <Text style={[styles.emptyPosterBooksText, isNight && styles.darkTextMuted]}>
                    Nenhum livro disponível para emoldurar.
                  </Text>
                </View>
              ) : (
                <ScrollView
                  contentContainerStyle={styles.posterBooksRow}
                  horizontal
                  keyboardShouldPersistTaps="always"
                  nestedScrollEnabled
                  showsHorizontalScrollIndicator={false}
                >
                  {selectableBooks.map((book) => {
                    const isSelected =
                      book.id === (leftWallPosterBookId ?? selectableBooks[0]?.id);
                    return (
                      <Pressable
                        key={book.id}
                        accessibilityHint={`Emoldurar capa de ${book.title}`}
                        accessibilityLabel={book.title}
                        accessibilityRole="button"
                        hitSlop={4}
                        onPress={() => {
                          if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setLeftWallPosterBookId(book.id);
                        }}
                        style={({ pressed }) => [
                          styles.posterBookChip,
                          isSelected && styles.posterBookChipSelected,
                          pressed && styles.btnPressed,
                        ]}
                      >
                        <View
                          style={[
                            styles.posterBookCoverWrap,
                            isSelected && styles.posterBookCoverWrapSelected,
                          ]}
                        >
                          <BookCover
                            color={book.coverColor}
                            coverUrl={
                              book.coverUrl ??
                              (book.coverId
                                ? `https://covers.openlibrary.org/b/id/${book.coverId}-M.jpg`
                                : undefined)
                            }
                            style={styles.posterMiniCover}
                          />
                          {isSelected ? (
                            <View style={styles.posterCheckBadge}>
                              <Ionicons color="#FFF" name="checkmark" size={10} />
                            </View>
                          ) : null}
                        </View>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.posterBookTitle,
                            isSelected && styles.posterBookTitleSelected,
                            isNight && !isSelected && styles.darkText,
                          ]}
                        >
                          {book.title}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              {/* Seleção de Molduras */}
              <View style={styles.posterFrameHeaderRow}>
                <Text style={[styles.posterSubheading, isNight && styles.darkTextMuted]}>
                  Moldura • {currentPosterFrame.name}
                </Text>
              </View>
              <ScrollView
                contentContainerStyle={styles.swatchesRow}
                horizontal
                keyboardShouldPersistTaps="always"
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
              >
                {POSTER_FRAME_OPTIONS.map((frame) => {
                  const isCurrent = frame.id === leftWallFrameColor;
                  return (
                    <Pressable
                      key={frame.id}
                      accessibilityHint={frame.subtitle}
                      accessibilityLabel={`Moldura ${frame.name}`}
                      accessibilityRole="button"
                      hitSlop={6}
                      onPress={() => {
                        if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setLeftWallFrameColor(frame.id);
                      }}
                      style={({ pressed }) => [
                        styles.swatchCircleWrap,
                        isCurrent && styles.swatchCircleActive,
                        pressed && styles.btnPressed,
                      ]}
                    >
                      <View style={[styles.swatchCircle, { backgroundColor: frame.frameColor }]}>
                        <View style={[styles.posterMatPreview, { backgroundColor: frame.matColor }]} />
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          {/* Informação quando Parede Vazia está selecionada */}
          {leftWallItem === 'none' ? (
            <View style={styles.leftWallEmptyNotice}>
              <Ionicons color={colors.terracotta} name="sparkles-outline" size={16} />
              <Text style={[styles.leftWallEmptyNoticeText, isNight && styles.darkTextMuted]}>
                A parede está limpa. Escolha Janela ou Pôster para personalizar seu espaço.
              </Text>
            </View>
          ) : null}
        </Animated.View>
      ) : null}

      {/* Card Flutuante Exclusivo do Quadro de Parede */}
      {activeCategory === 'picture_frame' ? (
        <Animated.View
          entering={FadeInDown.duration(200)}
          exiting={FadeOutDown.duration(150)}
          style={[styles.leftWallCapsule, isNight && styles.darkPaletteCapsule, { bottom: insets.bottom + 80 }]}
        >
          {/* Cabeçalho */}
          <View style={styles.leftWallHeaderRow}>
            <View style={styles.leftWallHeaderLeft}>
              <Ionicons
                color={colors.terracotta}
                name={pictureFrameSize === 'none' ? 'sparkles-outline' : 'image'}
                size={16}
              />
              <Text style={[styles.leftWallHeaderTitle, isNight && styles.darkText]}>
                {pictureFrameSize === 'none'
                  ? 'Quadro da Parede'
                  : `Quadro • ${pictureFrameSize === '1:1' ? 'Quadrado' : 'Retrato'}`}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Fechar seletor"
              hitSlop={8}
              onPress={() => setActiveCategory(null)}
              style={styles.closeTabBtn}
            >
              <Ionicons color={isNight ? '#8C92A4' : '#9E9287'} name="close" size={16} />
            </Pressable>
          </View>

          {/* Seletor Segmentado: Vazia | Quadrado | Retrato */}
          <View style={[styles.leftWallTypeRow, isNight && styles.darkCategoryTabsRow]}>
            <Pressable
              accessibilityLabel="Deixar parede sem quadro"
              accessibilityRole="button"
              hitSlop={6}
              onPress={() => {
                if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPictureFrameSize('none');
              }}
              style={({ pressed }) => [
                styles.leftWallTypeTab,
                pictureFrameSize === 'none' && styles.leftWallTypeTabActive,
                pressed && styles.btnPressed,
              ]}
            >
              <Ionicons
                color={pictureFrameSize === 'none' ? '#FFF' : isNight ? '#A0A5B5' : colors.muted}
                name="ban-outline"
                size={13}
              />
              <Text
                style={[
                  styles.leftWallTypeTabText,
                  isNight && styles.darkCategoryTabText,
                  pictureFrameSize === 'none' && styles.leftWallTypeTabTextActive,
                ]}
              >
                Vazia
              </Text>
            </Pressable>

            <Pressable
              accessibilityLabel="Selecionar formato Quadrado"
              accessibilityRole="button"
              hitSlop={6}
              onPress={() => {
                if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPictureFrameSize('1:1');
              }}
              style={({ pressed }) => [
                styles.leftWallTypeTab,
                pictureFrameSize === '1:1' && styles.leftWallTypeTabActive,
                pressed && styles.btnPressed,
              ]}
            >
              <Ionicons
                color={pictureFrameSize === '1:1' ? '#FFF' : isNight ? '#A0A5B5' : colors.muted}
                name="square-outline"
                size={13}
              />
              <Text
                style={[
                  styles.leftWallTypeTabText,
                  isNight && styles.darkCategoryTabText,
                  pictureFrameSize === '1:1' && styles.leftWallTypeTabTextActive,
                ]}
              >
                Quadrado
              </Text>
            </Pressable>

            <Pressable
              accessibilityLabel="Selecionar formato Retrato"
              accessibilityRole="button"
              hitSlop={6}
              onPress={() => {
                if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPictureFrameSize('2:1');
              }}
              style={({ pressed }) => [
                styles.leftWallTypeTab,
                pictureFrameSize === '2:1' && styles.leftWallTypeTabActive,
                pressed && styles.btnPressed,
              ]}
            >
              <Ionicons
                color={pictureFrameSize === '2:1' ? '#FFF' : isNight ? '#A0A5B5' : colors.muted}
                name="phone-portrait-outline"
                size={13}
              />
              <Text
                style={[
                  styles.leftWallTypeTabText,
                  isNight && styles.darkCategoryTabText,
                  pictureFrameSize === '2:1' && styles.leftWallTypeTabTextActive,
                ]}
              >
                Retrato
              </Text>
            </Pressable>
          </View>

          {/* Configurações quando o Quadro está Ativo (1:1 ou 2:1) */}
          {pictureFrameSize !== 'none' ? (
            <View style={styles.posterSectionContainer}>
              {/* Seção da Foto */}
              <View style={styles.picturePhotoContainer}>
                {pictureFramePhotoUri ? (
                  <View style={styles.picturePhotoRow}>
                    <Image
                      source={{ uri: pictureFramePhotoUri }}
                      style={[
                        styles.picturePhotoThumb,
                        pictureFrameSize === '2:1' && styles.picturePhotoThumbPortrait,
                      ]}
                    />
                    <View style={styles.picturePhotoActions}>
                      <Pressable
                        accessibilityLabel="Trocar foto do quadro"
                        disabled={isProcessingPhoto}
                        onPress={() => handlePickPicturePhoto(pictureFrameSize)}
                        style={({ pressed }) => [
                          styles.pictureActionButton,
                          pressed && styles.btnPressed,
                        ]}
                      >
                        {isProcessingPhoto ? (
                          <ActivityIndicator color="#FFF" size="small" />
                        ) : (
                          <>
                            <Ionicons color="#FFF" name="image-outline" size={14} />
                            <Text style={styles.pictureActionButtonText}>Trocar Foto</Text>
                          </>
                        )}
                      </Pressable>

                      <Pressable
                        accessibilityLabel="Restaurar arte editorial padrão do quadro"
                        onPress={() => {
                          if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setPictureFramePhotoUri(null);
                        }}
                        style={({ pressed }) => [
                          styles.pictureRemoveButton,
                          isNight && styles.darkPictureRemoveButton,
                          pressed && styles.btnPressed,
                        ]}
                      >
                        <Ionicons
                          color={isNight ? '#FFAE70' : colors.terracotta}
                          name="color-palette-outline"
                          size={14}
                        />
                        <Text style={[styles.pictureRemoveButtonText, isNight && styles.darkText]}>Arte Padrão</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    accessibilityLabel="Escolher foto da galeria"
                    accessibilityRole="button"
                    disabled={isProcessingPhoto}
                    onPress={() => handlePickPicturePhoto(pictureFrameSize)}
                    style={({ pressed }) => [
                      styles.picturePickEmptyButton,
                      pressed && styles.btnPressed,
                    ]}
                  >
                    {isProcessingPhoto ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <>
                        <Ionicons color="#FFF" name="images-outline" size={16} />
                        <Text style={styles.picturePickEmptyButtonText}>
                          Escolher Foto da Galeria
                        </Text>
                      </>
                    )}
                  </Pressable>
                )}
                <Text style={[styles.picturePrivacyCaption, isNight && styles.darkTextMuted]}>
                  Sua foto é privada, compactada e armazenada apenas no seu aparelho.
                </Text>
              </View>

              {/* Seleção do Acabamento da Moldura */}
              <View style={styles.posterFrameHeaderRow}>
                <Text style={[styles.posterSubheading, isNight && styles.darkTextMuted]}>
                  Moldura • {currentPictureFrameStyle.name}
                </Text>
              </View>
              <ScrollView
                contentContainerStyle={styles.swatchesRow}
                horizontal
                keyboardShouldPersistTaps="always"
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
              >
                {PICTURE_FRAME_STYLES.map((frame) => {
                  const isCurrent = frame.id === pictureFrameStyleId;
                  return (
                    <Pressable
                      key={frame.id}
                      accessibilityHint={frame.subtitle}
                      accessibilityLabel={`Moldura ${frame.name}`}
                      accessibilityRole="button"
                      hitSlop={6}
                      onPress={() => {
                        if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setPictureFrameStyleId(frame.id);
                      }}
                      style={({ pressed }) => [
                        styles.swatchCircleWrap,
                        isCurrent && styles.swatchCircleActive,
                        pressed && styles.btnPressed,
                      ]}
                    >
                      <View style={[styles.swatchCircle, { backgroundColor: frame.frameColor }]}>
                        <View style={[styles.posterMatPreview, { backgroundColor: frame.matColor }]} />
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          {/* Informação quando Parede Vazia está selecionada */}
          {pictureFrameSize === 'none' ? (
            <View style={styles.leftWallEmptyNotice}>
              <Ionicons color={colors.terracotta} name="sparkles-outline" size={16} />
              <Text style={[styles.leftWallEmptyNoticeText, isNight && styles.darkTextMuted]}>
                A parede do fundo está sem quadro. Escolha Quadrado ou Retrato para expor sua foto ou arte.
              </Text>
            </View>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  doneBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.terracotta,
    boxShadow: '0 2px 10px rgba(185, 95, 59, 0.35)',
  },
  pinContainer: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateX: -19 }, { translateY: -19 }],
  },
  pinButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255, 250, 242, 0.96)',
    borderWidth: 1.5,
    borderColor: colors.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 3px 10px rgba(53, 42, 36, 0.18)',
  },
  darkPinButton: {
    backgroundColor: 'rgba(28, 30, 44, 0.96)',
    borderColor: '#FFAE70',
    boxShadow: '0 3px 12px rgba(0, 0, 0, 0.5)',
  },
  pinButtonSelected: {
    backgroundColor: colors.terracotta,
    borderColor: '#FFF',
    transform: [{ scale: 1.15 }],
    boxShadow: '0 4px 14px rgba(185, 95, 59, 0.45)',
  },
  pinLabelWrap: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 250, 242, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(53, 42, 36, 0.08)',
  },
  darkPinLabelWrap: {
    backgroundColor: 'rgba(26, 28, 40, 0.94)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  pinLabelSelected: {
    backgroundColor: colors.terracotta,
    borderColor: colors.terracotta,
  },
  pinLabelText: {
    fontSize: 11,
    fontFamily: typography.ui,
    fontWeight: '600',
    color: colors.ink,
  },
  pinLabelTextSelected: {
    color: '#FFF',
  },
  paletteCapsule: {
    position: 'absolute',
    left: 16,
    right: 16,
    maxWidth: 440,
    alignSelf: 'center',
    borderRadius: 24,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255, 252, 248, 0.97)',
    borderWidth: 1,
    borderColor: colors.line,
    boxShadow: '0 8px 28px rgba(53, 42, 36, 0.18)',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  darkPaletteCapsule: {
    backgroundColor: 'rgba(22, 24, 35, 0.97)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    boxShadow: '0 8px 28px rgba(0, 0, 0, 0.60)',
  },
  categoryTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(53, 42, 36, 0.05)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
  },
  darkCategoryTabsRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  categoryTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 11,
    borderCurve: 'continuous',
  },
  categoryTabActive: {
    backgroundColor: colors.terracotta,
    boxShadow: '0 2px 6px rgba(185, 95, 59, 0.25)',
  },
  categoryTabText: {
    fontSize: 12,
    fontFamily: typography.ui,
    fontWeight: '500',
    color: colors.muted,
  },
  darkCategoryTabText: {
    color: '#A0A5B5',
  },
  categoryTabTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  closeTabBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(53, 42, 36, 0.05)',
    marginLeft: 6,
  },
  paletteHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  paletteTitleText: {
    fontSize: 13,
    fontFamily: typography.ui,
    fontWeight: '600',
    color: colors.ink,
  },
  swatchesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
    gap: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  swatchCircleWrap: {
    padding: 3,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchCircleActive: {
    borderColor: colors.terracotta,
    transform: [{ scale: 1.1 }],
    boxShadow: '0 2px 8px rgba(185, 95, 59, 0.35)',
  },
  swatchCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    boxShadow: '0 2px 5px rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
  },
  floorGroovePreview: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    alignSelf: 'center',
    opacity: 0.7,
  },
  bookcaseShelfPreview: {
    position: 'absolute',
    left: 4,
    right: 4,
    height: 3,
    borderRadius: 1.5,
    alignSelf: 'center',
    opacity: 0.9,
  },
  rugInnerCirclePreview: {
    width: 18,
    height: 18,
    borderRadius: 9,
    opacity: 0.85,
  },
  bookcaseCapsule: {
    position: 'absolute',
    left: 16,
    right: 16,
    maxWidth: 380,
    alignSelf: 'center',
    borderRadius: 22,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255, 252, 248, 0.97)',
    borderWidth: 1,
    borderColor: colors.line,
    boxShadow: '0 6px 24px rgba(53, 42, 36, 0.16)',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  bookcaseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  bookcaseHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bookcaseHeaderTitle: {
    fontSize: 13,
    fontFamily: typography.ui,
    fontWeight: '700',
    color: colors.ink,
  },
  catCapsule: {
    position: 'absolute',
    left: 16,
    width: 282,
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255, 252, 248, 0.97)',
    borderWidth: 1,
    borderColor: colors.line,
    boxShadow: '0 6px 24px rgba(53, 42, 36, 0.16)',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  catHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  catHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catHeaderTitle: {
    fontSize: 13,
    fontFamily: typography.ui,
    fontWeight: '700',
    color: colors.ink,
  },
  catOptionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  catOptionChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(53, 42, 36, 0.05)',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  catOptionChipActive: {
    backgroundColor: colors.terracotta,
    borderColor: colors.terracotta,
    boxShadow: '0 2px 8px rgba(185, 95, 59, 0.3)',
  },
  catOptionChipLoading: {
    backgroundColor: 'rgba(185, 95, 59, 0.85)',
    borderColor: 'rgba(255, 255, 255, 0.75)',
  },
  darkCatOptionChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  catSwatchMini: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.12)',
  },
  catFurDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  catOptionText: {
    fontSize: 11,
    fontFamily: typography.ui,
    fontWeight: '600',
    color: colors.ink,
  },
  catOptionTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  addSlotPinButton: {
    borderWidth: 2,
    borderColor: colors.terracotta,
    backgroundColor: 'rgba(255, 248, 240, 0.98)',
    boxShadow: '0 4px 14px rgba(185, 95, 59, 0.28)',
  },
  darkAddSlotPinButton: {
    backgroundColor: 'rgba(38, 30, 26, 0.98)',
    borderColor: '#FFAE70',
    boxShadow: '0 4px 14px rgba(255, 174, 112, 0.25)',
  },
  leftWallCapsule: {
    position: 'absolute',
    left: 16,
    right: 16,
    maxWidth: 430,
    alignSelf: 'center',
    borderRadius: 24,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255, 252, 248, 0.97)',
    borderWidth: 1,
    borderColor: colors.line,
    boxShadow: '0 8px 28px rgba(53, 42, 36, 0.18)',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  leftWallHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  leftWallHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  leftWallHeaderTitle: {
    fontSize: 13.5,
    fontFamily: typography.ui,
    fontWeight: '700',
    color: colors.ink,
  },
  leftWallTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(53, 42, 36, 0.05)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
  },
  leftWallTypeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 11,
    borderCurve: 'continuous',
  },
  leftWallTypeTabActive: {
    backgroundColor: colors.terracotta,
    boxShadow: '0 2px 6px rgba(185, 95, 59, 0.25)',
  },
  leftWallTypeTabText: {
    fontSize: 12,
    fontFamily: typography.ui,
    fontWeight: '500',
    color: colors.muted,
  },
  leftWallTypeTabTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  windowPanePreview: {
    width: 20,
    height: 24,
    borderRadius: 2,
    borderWidth: 1,
    backgroundColor: 'rgba(116, 167, 219, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  windowMullionH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1.5,
  },
  windowMullionV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1.5,
  },
  posterSectionContainer: {
    gap: 8,
  },
  posterSubheading: {
    fontSize: 11.5,
    fontFamily: typography.ui,
    fontWeight: '600',
    color: colors.muted,
    paddingHorizontal: 4,
  },
  emptyPosterBooksWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(53, 42, 36, 0.04)',
    borderRadius: 10,
  },
  emptyPosterBooksText: {
    fontSize: 11.5,
    fontFamily: typography.ui,
    color: colors.muted,
    flex: 1,
  },
  posterBooksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  posterBookChip: {
    alignItems: 'center',
    width: 58,
  },
  posterBookChipSelected: {
    transform: [{ scale: 1.05 }],
  },
  posterBookCoverWrap: {
    width: 44,
    height: 60,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'transparent',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
    marginBottom: 4,
  },
  posterBookCoverWrapSelected: {
    borderColor: colors.terracotta,
  },
  posterMiniCover: {
    width: '100%',
    height: '100%',
  },
  posterCheckBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterBookTitle: {
    fontSize: 9.5,
    fontFamily: typography.ui,
    fontWeight: '500',
    color: colors.ink,
    textAlign: 'center',
  },
  posterBookTitleSelected: {
    color: colors.terracotta,
    fontWeight: '700',
  },
  posterFrameHeaderRow: {
    marginTop: 2,
  },
  posterMatPreview: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  leftWallEmptyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(185, 95, 59, 0.08)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  leftWallEmptyNoticeText: {
    fontSize: 12,
    fontFamily: typography.ui,
    color: colors.ink,
    flex: 1,
    lineHeight: 16,
  },
  darkTextMuted: {
    color: '#A0A5B5',
  },
  darkText: {
    color: '#FAF4EB',
  },
  btnPressed: {
    opacity: 0.7,
  },
  picturePhotoContainer: {
    gap: 8,
    paddingTop: 4,
  },
  picturePhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(53, 42, 36, 0.04)',
    borderRadius: 14,
    padding: 10,
  },
  picturePhotoThumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#EAE5DC',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  picturePhotoThumbPortrait: {
    width: 40,
    height: 60,
  },
  picturePhotoActions: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  pictureActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.terracotta,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    minHeight: 40,
    boxShadow: '0 2px 6px rgba(185, 95, 59, 0.25)',
  },
  pictureActionButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontFamily: typography.ui,
    fontWeight: '600',
  },
  pictureRemoveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(53, 42, 36, 0.06)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    minHeight: 40,
    borderWidth: 1,
    borderColor: 'rgba(53, 42, 36, 0.08)',
  },
  darkPictureRemoveButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  pictureRemoveButtonText: {
    color: colors.ink,
    fontSize: 11.5,
    fontFamily: typography.ui,
    fontWeight: '600',
  },
  picturePickEmptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.terracotta,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 18,
    minHeight: 44,
    boxShadow: '0 2px 8px rgba(185, 95, 59, 0.25)',
  },
  picturePickEmptyButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontFamily: typography.ui,
    fontWeight: '600',
  },
  picturePrivacyCaption: {
    fontSize: 11,
    fontFamily: typography.ui,
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: 8,
    marginTop: 2,
  },
});
