import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { useProAccess } from '@/src/providers/revenuecat-provider';
import { isFreeRoomOption, resolveRoomOptionId } from '@/src/services/room-customization-access';
import { useLibraryStore } from '@/src/store/library-store';
import { colors, darkTheme, radii, typography } from '@/src/theme';
import {
  FLOOR_PALETTES,
  FloorPalette,
  RUG_PALETTES,
  RugPalette,
  WALL_PALETTES,
  WallPalette,
} from '@/src/types/room-customization';

type CustomizationTab = 'walls' | 'flooring' | 'rug';

export default function CustomizeRoomScreen() {
  const [activeTab, setActiveTab] = useState<CustomizationTab>('walls');
  const wallPaletteId = useLibraryStore((state) => state.wallPaletteId);
  const setWallPaletteId = useLibraryStore((state) => state.setWallPaletteId);
  const floorPaletteId = useLibraryStore((state) => state.floorPaletteId);
  const setFloorPaletteId = useLibraryStore((state) => state.setFloorPaletteId);
  const rugPaletteId = useLibraryStore((state) => state.rugPaletteId);
  const setRugPaletteId = useLibraryStore((state) => state.setRugPaletteId);
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const isNight = resolveAmbience(ambienceMode) === 'night';
  const { isPro, isPending: isProPending, requestProAccess } = useProAccess();

  const effectiveWallPaletteId = resolveRoomOptionId('walls', wallPaletteId, isPro);
  const effectiveFloorPaletteId = resolveRoomOptionId('flooring', floorPaletteId, isPro);
  const effectiveRugPaletteId = resolveRoomOptionId('rug', rugPaletteId, isPro);

  const handleSelectWallPalette = async (palette: WallPalette) => {
    if (!isPro && !isFreeRoomOption('walls', palette.id)) {
      if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const unlocked = await requestProAccess();
      if (!unlocked) return;
      if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setWallPaletteId(palette.id);
  };

  const handleSelectFloorPalette = async (palette: FloorPalette) => {
    if (!isPro && !isFreeRoomOption('flooring', palette.id)) {
      if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const unlocked = await requestProAccess();
      if (!unlocked) return;
      if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setFloorPaletteId(palette.id);
  };

  const handleSelectRugPalette = async (palette: RugPalette) => {
    if (!isPro && !isFreeRoomOption('rug', palette.id)) {
      if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const unlocked = await requestProAccess();
      if (!unlocked) return;
      if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setRugPaletteId(palette.id);
  };

  const handleTabPress = (tab: CustomizationTab) => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator
      style={[styles.screen, isNight && styles.darkScreen]}
    >
      {/* Cabeçalho do modal */}
      <View style={styles.header}>
        <View style={styles.headerTitles}>
          <Text selectable style={[styles.title, isNight && styles.darkTitle]}>
            Personalizar refúgio
          </Text>
          <Text selectable style={[styles.subtitle, isNight && styles.darkMutedText]}>
            Transforme a atmosfera visual da sua sala de leitura
          </Text>
        </View>

        <Pressable
          accessibilityHint="Fecha o painel de personalização"
          accessibilityLabel="Fechar"
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.closeBtn,
            isNight && styles.darkCloseBtn,
            pressed && styles.closeBtnPressed,
          ]}
        >
          <Ionicons color={isNight ? '#FAF4EB' : colors.ink} name="close" size={20} />
        </Pressable>
      </View>

      {/* Banner de Apresentação do Unlimited quando na versão Free */}
      {!isPro ? (
        <Pressable
          accessibilityHint="Abre o Bookroom Unlimited para desbloquear toda a coleção"
          accessibilityLabel="Conhecer o Bookroom Unlimited"
          accessibilityRole="button"
          disabled={isProPending}
          onPress={async () => {
            if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const unlocked = await requestProAccess();
            if (unlocked && process.env.EXPO_OS === 'ios') {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          }}
          style={({ pressed }) => [
            styles.unlimitedScreenBanner,
            isNight && styles.darkUnlimitedScreenBanner,
            pressed && styles.cardPressed,
          ]}
        >
          <View style={styles.unlimitedScreenBannerLeft}>
            <View style={[styles.unlimitedBannerIconCircle, isNight && styles.darkUnlimitedBannerIconCircle]}>
              <Ionicons color={isNight ? '#FFAE70' : colors.terracotta} name="sparkles" size={14} />
            </View>
            <View style={styles.unlimitedBannerTextGroup}>
              <Text style={[styles.unlimitedBannerTitle, isNight && styles.darkTitle]}>
                Coleção Completa Unlimited
              </Text>
              <Text style={[styles.unlimitedBannerSubtitle, isNight && styles.darkMutedText]}>
                Desbloqueie todas as paredes, pisos e tapetes
              </Text>
            </View>
          </View>
          <Ionicons color={isNight ? '#FFAE70' : colors.terracotta} name="chevron-forward" size={16} />
        </Pressable>
      ) : null}

      {/* Seletor de categorias fluido com chips confortáveis */}
      <View style={styles.categoryScrollWrap}>
        <ScrollView
          contentContainerStyle={styles.categoryBar}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {/* Categoria 1: Paredes */}
          <Pressable
            accessibilityLabel="Categoria Paredes"
            accessibilityRole="button"
            onPress={() => handleTabPress('walls')}
            style={({ pressed }) => [
              styles.categoryChip,
              isNight && styles.darkCategoryChip,
              activeTab === 'walls' && (isNight ? styles.categoryChipActiveNight : styles.categoryChipActive),
              pressed && styles.cardPressed,
            ]}
          >
            <Ionicons
              color={
                activeTab === 'walls'
                  ? (isNight ? '#FFAE70' : colors.terracotta)
                  : (isNight ? darkTheme.textMuted : colors.muted)
              }
              name="color-palette-outline"
              size={16}
            />
            <Text
              style={[
                styles.categoryChipText,
                isNight && styles.darkMutedText,
                activeTab === 'walls' && (isNight ? styles.categoryChipTextActiveNight : styles.categoryChipTextActive),
              ]}
            >
              Paredes
            </Text>
          </Pressable>

          {/* Categoria 2: Piso */}
          <Pressable
            accessibilityLabel="Categoria Piso de madeira"
            accessibilityRole="button"
            onPress={() => handleTabPress('flooring')}
            style={({ pressed }) => [
              styles.categoryChip,
              isNight && styles.darkCategoryChip,
              activeTab === 'flooring' && (isNight ? styles.categoryChipActiveNight : styles.categoryChipActive),
              pressed && styles.cardPressed,
            ]}
          >
            <Ionicons
              color={
                activeTab === 'flooring'
                  ? (isNight ? '#FFAE70' : colors.terracotta)
                  : (isNight ? darkTheme.textMuted : colors.muted)
              }
              name="grid-outline"
              size={16}
            />
            <Text
              style={[
                styles.categoryChipText,
                isNight && styles.darkMutedText,
                activeTab === 'flooring' && (isNight ? styles.categoryChipTextActiveNight : styles.categoryChipTextActive),
              ]}
            >
              Piso
            </Text>
          </Pressable>

          {/* Categoria 3: Tapete */}
          <Pressable
            accessibilityLabel="Categoria Tapete"
            accessibilityRole="button"
            onPress={() => handleTabPress('rug')}
            style={({ pressed }) => [
              styles.categoryChip,
              isNight && styles.darkCategoryChip,
              activeTab === 'rug' && (isNight ? styles.categoryChipActiveNight : styles.categoryChipActive),
              pressed && styles.cardPressed,
            ]}
          >
            <Ionicons
              color={
                activeTab === 'rug'
                  ? (isNight ? '#FFAE70' : colors.terracotta)
                  : (isNight ? darkTheme.textMuted : colors.muted)
              }
              name="disc-outline"
              size={16}
            />
            <Text
              style={[
                styles.categoryChipText,
                isNight && styles.darkMutedText,
                activeTab === 'rug' && (isNight ? styles.categoryChipTextActiveNight : styles.categoryChipTextActive),
              ]}
            >
              Tapete
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Conteúdo da categoria ativa: Paredes */}
      {activeTab === 'walls' && (
        <View style={styles.palettesSection}>
          <Text selectable style={[styles.sectionHeading, isNight && styles.darkSectionHeading]}>
            Tons de Parede
          </Text>

          <View style={styles.palettesGrid}>
            {WALL_PALETTES.map((palette) => {
              const isSelected = palette.id === effectiveWallPaletteId;
              const isLocked = !isPro && !isFreeRoomOption('walls', palette.id);

              return (
                <Pressable
                  key={palette.id}
                  accessibilityHint={`Aplica esta tonalidade nas paredes do quarto${isLocked ? '. Requer Unlimited Furniture.' : ''}`}
                  accessibilityLabel={`Tom de parede: ${palette.name}${isLocked ? ' (bloqueado)' : ''}`}
                  accessibilityRole="button"
                  disabled={isProPending}
                  onPress={() => handleSelectWallPalette(palette)}
                  style={({ pressed }) => [
                    styles.paletteCard,
                    isNight && styles.darkPaletteCard,
                    isSelected && (isNight ? styles.paletteCardSelectedNight : styles.paletteCardSelected),
                    pressed && styles.cardPressed,
                  ]}
                >
                  {/* Swatch de pré-visualização de quina (parede esquerda + parede traseira) */}
                  <View
                    accessibilityLabel={`Amostra de cor ${palette.name}`}
                    style={[styles.swatchWrap, { backgroundColor: palette.backWallColor }]}
                  >
                    <View
                      style={[
                        styles.swatchLeftHalf,
                        { backgroundColor: palette.leftWallColor },
                      ]}
                    />
                    <View
                      style={[
                        styles.swatchCornerLine,
                        { backgroundColor: palette.cornerColor },
                      ]}
                    />
                  </View>

                  {/* Detalhes da cor */}
                  <View style={styles.paletteInfo}>
                    <Text
                      numberOfLines={1}
                      selectable
                      style={[
                        styles.paletteName,
                        isNight && styles.darkTitle,
                        isSelected && (isNight ? styles.paletteNameActiveNight : styles.paletteNameActive),
                      ]}
                    >
                      {palette.name}
                    </Text>
                    <View style={styles.paletteSubtitleRow}>
                      <Text numberOfLines={1} selectable style={[styles.paletteSubtitle, isNight && styles.darkMutedText]}>
                        {palette.subtitle}
                      </Text>
                      {isLocked ? (
                        <View style={[styles.cardLockedTag, isNight && styles.darkCardLockedTag]}>
                          <Text style={[styles.cardLockedTagText, isNight && styles.darkCardLockedTagText]}>
                            Unlimited
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  {/* Indicador de seleção */}
                  <View
                    style={[
                      styles.checkCircle,
                      isNight && styles.darkCheckCircle,
                      isSelected && (isNight ? styles.checkCircleActiveNight : styles.checkCircleActive),
                      isLocked && (isNight ? styles.checkCircleLockedNight : styles.checkCircleLocked),
                    ]}
                  >
                    {isLocked ? (
                      <Ionicons color={isNight ? '#FFAE70' : '#D48842'} name="lock-closed" size={12} />
                    ) : isSelected ? (
                      <Ionicons
                        color={isNight ? '#131520' : colors.white}
                        name="checkmark"
                        size={14}
                      />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Conteúdo da categoria ativa: Piso de Madeira */}
      {activeTab === 'flooring' && (
        <View style={styles.palettesSection}>
          <Text selectable style={[styles.sectionHeading, isNight && styles.darkSectionHeading]}>
            Assoalhos de Madeira
          </Text>

          <View style={styles.palettesGrid}>
            {FLOOR_PALETTES.map((palette) => {
              const isSelected = palette.id === effectiveFloorPaletteId;
              const isLocked = !isPro && !isFreeRoomOption('flooring', palette.id);

              return (
                <Pressable
                  key={palette.id}
                  accessibilityHint={`Aplica esta madeira no piso do quarto${isLocked ? '. Requer Unlimited Furniture.' : ''}`}
                  accessibilityLabel={`Piso de madeira: ${palette.name}${isLocked ? ' (bloqueado)' : ''}`}
                  accessibilityRole="button"
                  disabled={isProPending}
                  onPress={() => handleSelectFloorPalette(palette)}
                  style={({ pressed }) => [
                    styles.paletteCard,
                    isNight && styles.darkPaletteCard,
                    isSelected && (isNight ? styles.paletteCardSelectedNight : styles.paletteCardSelected),
                    pressed && styles.cardPressed,
                  ]}
                >
                  {/* Swatch de réguas de madeira */}
                  <View
                    accessibilityLabel={`Amostra de madeira ${palette.name}`}
                    style={[styles.floorSwatchWrap, { backgroundColor: palette.plankColor }]}
                  >
                    <View style={[styles.floorPlankGroove, { backgroundColor: palette.grooveColor }]} />
                    <View style={[styles.floorPlankGroove, { backgroundColor: palette.grooveColor }]} />
                    <View style={[styles.floorBaseRim, { backgroundColor: palette.baseColor }]} />
                  </View>

                  {/* Detalhes da madeira */}
                  <View style={styles.paletteInfo}>
                    <Text
                      numberOfLines={1}
                      selectable
                      style={[
                        styles.paletteName,
                        isNight && styles.darkTitle,
                        isSelected && (isNight ? styles.paletteNameActiveNight : styles.paletteNameActive),
                      ]}
                    >
                      {palette.name}
                    </Text>
                    <View style={styles.paletteSubtitleRow}>
                      <Text numberOfLines={1} selectable style={[styles.paletteSubtitle, isNight && styles.darkMutedText]}>
                        {palette.subtitle}
                      </Text>
                      {isLocked ? (
                        <View style={[styles.cardLockedTag, isNight && styles.darkCardLockedTag]}>
                          <Text style={[styles.cardLockedTagText, isNight && styles.darkCardLockedTagText]}>
                            Unlimited
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  {/* Indicador de seleção */}
                  <View
                    style={[
                      styles.checkCircle,
                      isNight && styles.darkCheckCircle,
                      isSelected && (isNight ? styles.checkCircleActiveNight : styles.checkCircleActive),
                      isLocked && (isNight ? styles.checkCircleLockedNight : styles.checkCircleLocked),
                    ]}
                  >
                    {isLocked ? (
                      <Ionicons color={isNight ? '#FFAE70' : '#D48842'} name="lock-closed" size={12} />
                    ) : isSelected ? (
                      <Ionicons
                        color={isNight ? '#131520' : colors.white}
                        name="checkmark"
                        size={14}
                      />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Conteúdo da categoria ativa: Tapete */}
      {activeTab === 'rug' && (
        <View style={styles.palettesSection}>
          <Text selectable style={[styles.sectionHeading, isNight && styles.darkSectionHeading]}>
            Estilos de Tapete
          </Text>

          <View style={styles.palettesGrid}>
            {RUG_PALETTES.map((palette) => {
              const isSelected = palette.id === effectiveRugPaletteId;
              const isLocked = !isPro && !isFreeRoomOption('rug', palette.id);

              return (
                <Pressable
                  key={palette.id}
                  accessibilityHint={`Aplica esta cor ao tapete circular do quarto${isLocked ? '. Requer Unlimited Furniture.' : ''}`}
                  accessibilityLabel={`Estilo de tapete: ${palette.name}${isLocked ? ' (bloqueado)' : ''}`}
                  accessibilityRole="button"
                  disabled={isProPending}
                  onPress={() => handleSelectRugPalette(palette)}
                  style={({ pressed }) => [
                    styles.paletteCard,
                    isNight && styles.darkPaletteCard,
                    isSelected && (isNight ? styles.paletteCardSelectedNight : styles.paletteCardSelected),
                    pressed && styles.cardPressed,
                  ]}
                >
                  {/* Swatch circular do tapete com círculo interno */}
                  <View
                    accessibilityLabel={`Amostra de cor ${palette.name}`}
                    style={[styles.swatchWrap, styles.rugSwatchWrap, { backgroundColor: palette.mainColor }]}
                  >
                    <View
                      style={[
                        styles.rugInnerCircle,
                        { backgroundColor: palette.innerColor },
                      ]}
                    />
                  </View>

                  {/* Detalhes da cor */}
                  <View style={styles.paletteInfo}>
                    <Text
                      numberOfLines={1}
                      selectable
                      style={[
                        styles.paletteName,
                        isNight && styles.darkTitle,
                        isSelected && (isNight ? styles.paletteNameActiveNight : styles.paletteNameActive),
                      ]}
                    >
                      {palette.name}
                    </Text>
                    <View style={styles.paletteSubtitleRow}>
                      <Text numberOfLines={1} selectable style={[styles.paletteSubtitle, isNight && styles.darkMutedText]}>
                        {palette.subtitle}
                      </Text>
                      {isLocked ? (
                        <View style={[styles.cardLockedTag, isNight && styles.darkCardLockedTag]}>
                          <Text style={[styles.cardLockedTagText, isNight && styles.darkCardLockedTagText]}>
                            Unlimited
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  {/* Indicador de seleção */}
                  <View
                    style={[
                      styles.checkCircle,
                      isNight && styles.darkCheckCircle,
                      isSelected && (isNight ? styles.checkCircleActiveNight : styles.checkCircleActive),
                      isLocked && (isNight ? styles.checkCircleLockedNight : styles.checkCircleLocked),
                    ]}
                  >
                    {isLocked ? (
                      <Ionicons color={isNight ? '#FFAE70' : '#D48842'} name="lock-closed" size={12} />
                    ) : isSelected ? (
                      <Ionicons
                        color={isNight ? '#131520' : colors.white}
                        name="checkmark"
                        size={14}
                      />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: '100%',
    minHeight: '100%',
    backgroundColor: colors.paper,
  },
  darkScreen: {
    backgroundColor: darkTheme.bg,
  },
  content: {
    gap: 18,
    padding: 20,
    paddingBottom: 72,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  headerTitles: {
    flex: 1,
    gap: 3,
  },
  title: {
    color: colors.ink,
    fontFamily: typography.editorial,
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 26,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: typography.ui,
    fontSize: 13,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  darkCloseBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeBtnPressed: {
    opacity: 0.6,
    transform: [{ scale: 0.94 }],
  },
  categoryScrollWrap: {
    marginHorizontal: -4,
  },
  categoryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: radii.full,
    borderCurve: 'continuous',
    backgroundColor: colors.softFill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  darkCategoryChip: {
    backgroundColor: '#181A26',
    borderColor: darkTheme.borderSubtle,
  },
  categoryChipActive: {
    backgroundColor: colors.paper,
    borderColor: colors.terracotta,
    boxShadow: '0 2px 6px rgba(182, 90, 61, 0.12)',
  },
  categoryChipActiveNight: {
    backgroundColor: '#262A3C',
    borderColor: '#FFAE70',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35)',
  },
  categoryChipText: {
    color: colors.muted,
    fontFamily: typography.ui,
    fontSize: 13,
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: colors.terracotta,
    fontWeight: '600',
  },
  categoryChipTextActiveNight: {
    color: '#FFAE70',
    fontWeight: '600',
  },
  categoryChipTextDisabled: {
    color: '#A89E95',
    fontFamily: typography.ui,
    fontSize: 13,
    fontWeight: '500',
  },
  badgePill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    backgroundColor: 'rgba(50, 37, 31, 0.08)',
  },
  darkBadgePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  badgeText: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  darkBadgeText: {
    color: darkTheme.textSubtle,
  },
  palettesSection: {
    gap: 12,
  },
  sectionHeading: {
    color: colors.muted,
    fontFamily: typography.ui,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  darkSectionHeading: {
    color: darkTheme.textMuted,
  },
  palettesGrid: {
    gap: 10,
  },
  paletteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    borderRadius: radii.medium,
    borderCurve: 'continuous',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.lineSubtle,
    boxShadow: '0 2px 6px rgba(50, 37, 31, 0.03)',
  },
  darkPaletteCard: {
    backgroundColor: darkTheme.surface,
    borderColor: darkTheme.borderSubtle,
  },
  paletteCardSelected: {
    borderColor: colors.terracotta,
    backgroundColor: '#FAF5EF',
    boxShadow: '0 3px 10px rgba(182, 90, 61, 0.12)',
  },
  paletteCardSelectedNight: {
    borderColor: '#FFAE70',
    backgroundColor: '#202434',
    boxShadow: '0 3px 10px rgba(0, 0, 0, 0.4)',
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  swatchWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  swatchLeftHalf: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '50%',
  },
  swatchCornerLine: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 1.5,
  },
  floorSwatchWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    justifyContent: 'space-evenly',
    paddingVertical: 6,
  },
  floorPlankGroove: {
    width: '100%',
    height: 1.5,
    opacity: 0.75,
  },
  floorBaseRim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3.5,
  },
  rugSwatchWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rugInnerCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    opacity: 0.9,
  },
  paletteInfo: {
    flex: 1,
    gap: 2,
  },
  paletteName: {
    color: colors.ink,
    fontFamily: typography.ui,
    fontSize: 15,
    fontWeight: '600',
  },
  paletteNameActive: {
    color: colors.terracotta,
  },
  paletteNameActiveNight: {
    color: '#FFAE70',
  },
  paletteSubtitle: {
    color: colors.muted,
    fontFamily: typography.ui,
    fontSize: 12,
  },
  paletteSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardLockedTag: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    backgroundColor: 'rgba(212, 136, 66, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 136, 66, 0.28)',
  },
  darkCardLockedTag: {
    backgroundColor: 'rgba(255, 174, 112, 0.14)',
    borderColor: 'rgba(255, 174, 112, 0.32)',
  },
  cardLockedTagText: {
    fontFamily: typography.ui,
    fontSize: 10,
    fontWeight: '600',
    color: colors.terracotta,
  },
  darkCardLockedTagText: {
    color: '#FFAE70',
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkCheckCircle: {
    borderColor: darkTheme.border,
  },
  checkCircleActive: {
    backgroundColor: colors.terracotta,
    borderColor: colors.terracotta,
  },
  checkCircleActiveNight: {
    backgroundColor: '#FFAE70',
    borderColor: '#FFAE70',
  },
  checkCircleLocked: {
    backgroundColor: 'rgba(212, 136, 66, 0.10)',
    borderColor: 'rgba(212, 136, 66, 0.35)',
  },
  checkCircleLockedNight: {
    backgroundColor: 'rgba(255, 174, 112, 0.14)',
    borderColor: 'rgba(255, 174, 112, 0.35)',
  },
  unlimitedScreenBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: radii.medium,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(189, 107, 77, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(189, 107, 77, 0.22)',
    marginBottom: 16,
  },
  darkUnlimitedScreenBanner: {
    backgroundColor: 'rgba(255, 174, 112, 0.10)',
    borderColor: 'rgba(255, 174, 112, 0.24)',
  },
  unlimitedScreenBannerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  unlimitedBannerIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(189, 107, 77, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(189, 107, 77, 0.28)',
  },
  darkUnlimitedBannerIconCircle: {
    backgroundColor: 'rgba(255, 174, 112, 0.16)',
    borderColor: 'rgba(255, 174, 112, 0.32)',
  },
  unlimitedBannerTextGroup: {
    flex: 1,
    gap: 2,
  },
  unlimitedBannerTitle: {
    fontFamily: typography.ui,
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.ink,
  },
  unlimitedBannerSubtitle: {
    fontFamily: typography.ui,
    fontSize: 11.5,
    color: colors.muted,
  },
  comingSoonWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  comingSoonTitle: {
    color: colors.ink,
    fontFamily: typography.editorial,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  comingSoonDesc: {
    color: colors.muted,
    fontFamily: typography.ui,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 280,
  },
  darkTitle: { color: darkTheme.text },
  darkMutedText: { color: darkTheme.textMuted },
  darkSubtleText: { color: darkTheme.textSubtle },
});
