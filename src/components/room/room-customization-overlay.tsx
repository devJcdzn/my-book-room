import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLibraryStore } from '@/src/store/library-store';
import { colors, typography } from '@/src/theme';
import {
  FLOOR_PALETTES,
  FloorPalette,
  getFloorPalette,
  getRugPalette,
  getWallPalette,
  RUG_PALETTES,
  RugPalette,
  WALL_PALETTES,
  WallPalette,
} from '@/src/types/room-customization';

export type ScreenAnchorPos = {
  x: number;
  y: number;
};

export type CustomizationAnchorItem = {
  id: string;
  category: 'walls' | 'flooring' | 'rug';
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  pos: [number, number, number];
};

// Somente os itens efetivamente personalizáveis no momento para evitar poluição visual
export const CUSTOMIZATION_ANCHORS: CustomizationAnchorItem[] = [
  {
    id: 'walls',
    category: 'walls',
    title: 'Paredes',
    icon: 'color-palette-outline',
    pos: [-1.2, 2.7, -3.2],
  },
  {
    id: 'flooring',
    category: 'flooring',
    title: 'Piso',
    icon: 'layers-outline',
    pos: [-1.8, 0.05, 0.6],
  },
  {
    id: 'rug',
    category: 'rug',
    title: 'Tapete',
    icon: 'disc-outline',
    pos: [1.2, 0.12, 1.6],
  },
];

type RoomCustomizationOverlayProps = {
  anchorPositions: Record<string, ScreenAnchorPos>;
  isNight: boolean;
  onExit: () => void;
};

export function RoomCustomizationOverlay({
  anchorPositions,
  isNight,
  onExit,
}: RoomCustomizationOverlayProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [activeCategory, setActiveCategory] = useState<'walls' | 'flooring' | 'rug' | null>('walls');

  const wallPaletteId = useLibraryStore((state) => state.wallPaletteId);
  const setWallPaletteId = useLibraryStore((state) => state.setWallPaletteId);
  const floorPaletteId = useLibraryStore((state) => state.floorPaletteId);
  const setFloorPaletteId = useLibraryStore((state) => state.setFloorPaletteId);
  const rugPaletteId = useLibraryStore((state) => state.rugPaletteId);
  const setRugPaletteId = useLibraryStore((state) => state.setRugPaletteId);

  const currentWallPalette = getWallPalette(wallPaletteId);
  const currentFloorPalette = getFloorPalette(floorPaletteId);
  const currentRugPalette = getRugPalette(rugPaletteId);

  const handlePinPress = (category: 'walls' | 'flooring' | 'rug') => {
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

  const handleSelectRugPalette = (palette: RugPalette) => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRugPaletteId(palette.id);
  };

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

      {/* Floating Badge Pins Ancorados em 3D: Apenas os 3 itens editáveis com espaçamento generoso */}
      {CUSTOMIZATION_ANCHORS.map((item) => {
        const coords = anchorPositions[item.id];
        if (!coords) return null;

        const clampedX = Math.max(24, Math.min(width - 24, coords.x));
        const clampedY = Math.max(insets.top + 50, coords.y);
        const isSelected = activeCategory === item.category;

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
              accessibilityHint={`Abre as opções de cores de ${item.title}`}
              accessibilityLabel={`${item.title} (Personalizável)`}
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => handlePinPress(item.category)}
              style={({ pressed }) => [
                styles.pinButton,
                isNight && styles.darkPinButton,
                isSelected && styles.pinButtonSelected,
                pressed && styles.btnPressed,
              ]}
            >
              <Ionicons
                color={isSelected ? '#FFF' : isNight ? '#FFAE70' : colors.terracotta}
                name={item.icon}
                size={18}
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
                {item.title}
              </Text>
            </View>
          </View>
        );
      })}

      {/* Painel Minimalista Flutuante de Seleção de Cores */}
      {activeCategory ? (
        <Animated.View
          entering={FadeInDown.duration(220)}
          exiting={FadeOutDown.duration(160)}
          style={[styles.paletteCapsule, isNight && styles.darkPaletteCapsule, { bottom: insets.bottom + 80 }]}
        >
          {/* Seletor Segmentado de Categorias no Topo do Card */}
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
    borderRadius: 22,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255, 252, 248, 0.97)',
    borderWidth: 1,
    borderColor: colors.line,
    boxShadow: '0 6px 24px rgba(53, 42, 36, 0.16)',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  darkPaletteCapsule: {
    backgroundColor: 'rgba(22, 24, 35, 0.97)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    boxShadow: '0 6px 24px rgba(0, 0, 0, 0.55)',
  },
  categoryTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(53, 42, 36, 0.05)',
    borderRadius: 14,
    padding: 3,
    marginBottom: 8,
  },
  darkCategoryTabsRow: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  categoryTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 6,
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
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    marginLeft: 4,
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
    gap: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  swatchCircleWrap: {
    padding: 2,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchCircleActive: {
    borderColor: colors.terracotta,
    transform: [{ scale: 1.08 }],
  },
  swatchCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  rugInnerCirclePreview: {
    width: 18,
    height: 18,
    borderRadius: 9,
    opacity: 0.85,
  },
  darkText: {
    color: '#FAF4EB',
  },
  btnPressed: {
    opacity: 0.7,
  },
});
