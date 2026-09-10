import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { type AmbienceMode, useLibraryStore } from '@/src/store/library-store';
import { colors, darkTheme, radii, typography } from '@/src/theme';
import { getFloorPalette, getWallPalette } from '@/src/types/room-customization';

const AMBIENCE_MODES: {
  id: AmbienceMode;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: 'auto', label: 'Auto', icon: 'time-outline' },
  { id: 'day', label: 'Dia', icon: 'sunny-outline' },
  { id: 'sunset', label: 'Ocaso', icon: 'partly-sunny-outline' },
  { id: 'night', label: 'Noite', icon: 'moon-outline' },
];

export default function ProfileScreen() {
  const books = useLibraryStore((state) => state.books);
  const profile = useLibraryStore((state) => state.profile);
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const setAmbienceMode = useLibraryStore((state) => state.setAmbienceMode);
  const wallPaletteId = useLibraryStore((state) => state.wallPaletteId);
  const floorPaletteId = useLibraryStore((state) => state.floorPaletteId);

  const completed = books.filter((book) => book.status === 'completed').length;
  const totalPagesRead = books.reduce((sum, b) => sum + b.currentPage, 0);
  const isNight = resolveAmbience(ambienceMode) === 'night';
  const avatarInitial = profile.name.trim().charAt(0).toUpperCase() || 'L';

  const wallPalette = getWallPalette(wallPaletteId);
  const floorPalette = getFloorPalette(floorPaletteId);

  const handleSelectAmbience = (mode: AmbienceMode) => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAmbienceMode(mode);
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      style={[styles.screen, isNight && styles.darkScreen]}
    >
      {/* 1. CARTÃO DO LEITOR (EX-LIBRIS MINIMALISTA) */}
      <View style={[styles.card, isNight && styles.darkCard]}>
        <View style={styles.profileRow}>
          <View accessibilityLabel="Monograma do leitor" style={[styles.avatar, isNight && styles.darkAvatar]}>
            <Text selectable style={[styles.avatarText, isNight && styles.darkAvatarText]}>
              {avatarInitial}
            </Text>
          </View>

          <View style={styles.profileInfo}>
            <Text style={[styles.exLibrisLabel, isNight && styles.darkSubtleText]}>
              EX LIBRIS
            </Text>
            <Text numberOfLines={1} selectable style={[styles.name, isNight && styles.darkTitle]}>
              {profile.name}
            </Text>
          </View>

          <Pressable
            accessibilityHint="Editar nome e citação"
            accessibilityLabel="Editar perfil"
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => {
              if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.navigate('/edit-profile');
            }}
            style={({ pressed }) => [
              styles.editBtn,
              isNight && styles.darkEditBtn,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons color={isNight ? '#FFAE70' : colors.terracotta} name="pencil-outline" size={16} />
          </Pressable>
        </View>

        {/* Citação / Epígrafe fluida e tipográfica */}
        {profile.bio ? (
          <View style={[styles.quoteWrap, isNight && styles.darkQuoteWrap]}>
            <Text selectable style={[styles.quoteText, isNight && styles.darkQuoteText]}>
              “{profile.bio}”
            </Text>
            {profile.bioAttribution ? (
              <Text selectable style={[styles.quoteAuthor, isNight && styles.darkMutedText]}>
                — {profile.bioAttribution}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* 2. MARCOS DE LEITURA (SIMPLES E DIRETO) */}
      <View style={[styles.card, styles.statsRow, isNight && styles.darkCard]}>
        <View style={styles.statItem}>
          <Text selectable style={[styles.statNumber, isNight && styles.darkTitle]}>
            {completed}
          </Text>
          <Text selectable style={[styles.statLabel, isNight && styles.darkMutedText]}>
            {completed === 1 ? 'volume lido' : 'volumes lidos'}
          </Text>
        </View>

        <View style={[styles.statDivider, isNight && styles.darkDivider]} />

        <View style={styles.statItem}>
          <Text selectable style={[styles.statNumber, isNight && styles.darkTitle]}>
            {totalPagesRead}
          </Text>
          <Text selectable style={[styles.statLabel, isNight && styles.darkMutedText]}>
            {totalPagesRead === 1 ? 'página lida' : 'páginas lidas'}
          </Text>
        </View>

        <View style={[styles.statDivider, isNight && styles.darkDivider]} />

        <View style={styles.statItem}>
          <Text selectable style={[styles.statNumber, isNight && styles.darkTitle]}>
            {books.length}
          </Text>
          <Text selectable style={[styles.statLabel, isNight && styles.darkMutedText]}>
            no acervo
          </Text>
        </View>
      </View>

      {/* 3. CONFIGURAÇÃO DA SALA 3D (SIMPLIFICADA) */}
      <View style={[styles.card, isNight && styles.darkCard]}>
        <View style={styles.settingHeader}>
          <Text style={[styles.settingLabel, isNight && styles.darkMutedText]}>
            Atmosfera da sala
          </Text>
        </View>

        {/* Seletor de atmosfera limpo */}
        <View style={[styles.ambienceBar, isNight && styles.darkAmbienceBar]}>
          {AMBIENCE_MODES.map((mode) => {
            const isSelected = ambienceMode === mode.id;
            return (
              <Pressable
                key={mode.id}
                accessibilityLabel={`Atmosfera ${mode.label}`}
                accessibilityRole="button"
                onPress={() => handleSelectAmbience(mode.id)}
                style={[
                  styles.ambienceTab,
                  isSelected && (isNight ? styles.ambienceTabActiveNight : styles.ambienceTabActive),
                ]}
              >
                <Ionicons
                  color={
                    isSelected
                      ? (isNight ? '#FFAE70' : colors.terracotta)
                      : (isNight ? darkTheme.textMuted : colors.muted)
                  }
                  name={mode.icon}
                  size={14}
                />
                <Text
                  style={[
                    styles.ambienceTabText,
                    isNight && styles.darkMutedText,
                    isSelected && (isNight ? styles.ambienceTabTextActiveNight : styles.ambienceTabTextActive),
                  ]}
                >
                  {mode.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.rowDivider, isNight && styles.darkDivider]} />

        {/* Atalho para personalização do quarto */}
        <Pressable
          accessibilityHint="Abre a tela de personalização de paredes e pisos"
          accessibilityLabel="Personalizar sala"
          accessibilityRole="button"
          onPress={() => {
            if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.navigate('/customize-room');
          }}
          style={({ pressed }) => [
            styles.customizeRow,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.customizeLeft}>
            <View style={[styles.miniSwatch, { backgroundColor: wallPalette.previewColor }]} />
            <View style={[styles.miniSwatch, { backgroundColor: floorPalette.plankColor }]} />
            <Text style={[styles.customizeText, isNight && styles.darkTitle]}>
              Personalizar sala
            </Text>
          </View>

          <View style={styles.customizeRight}>
            <Text style={[styles.customizePaletteName, isNight && styles.darkMutedText]}>
              {wallPalette.name}
            </Text>
            <Ionicons color={isNight ? darkTheme.textSubtle : colors.mutedLight} name="chevron-forward" size={16} />
          </View>
        </Pressable>
      </View>

      {/* 4. NOTA DISCRETA NO FINAL */}
      <View style={styles.footer}>
        <Text style={[styles.footerText, isNight && styles.darkSubtleText]}>
          Bookroom · Seu refúgio pessoal para ler com calma
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  darkScreen: { backgroundColor: darkTheme.bg },
  content: { gap: 14, padding: 18, paddingBottom: 140 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },

  /* Cartões gerais */
  card: {
    padding: 16,
    borderRadius: radii.large,
    borderCurve: 'continuous',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.lineSubtle,
    boxShadow: '0 1px 4px rgba(50, 37, 31, 0.03)',
  },
  darkCard: {
    backgroundColor: darkTheme.surface,
    borderColor: darkTheme.borderSubtle,
  },

  /* 1. Perfil / Ex-Libris */
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.terracottaSoft,
    borderWidth: 1,
    borderColor: 'rgba(182, 90, 61, 0.2)',
  },
  darkAvatar: {
    backgroundColor: 'rgba(255, 174, 112, 0.15)',
    borderColor: 'rgba(255, 174, 112, 0.3)',
  },
  avatarText: {
    color: colors.terracotta,
    fontFamily: typography.editorial,
    fontSize: 22,
    fontWeight: '600',
  },
  darkAvatarText: {
    color: '#FFAE70',
  },
  profileInfo: {
    flex: 1,
    gap: 1,
  },
  exLibrisLabel: {
    color: colors.muted,
    fontFamily: typography.ui,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  name: {
    color: colors.ink,
    fontFamily: typography.editorial,
    fontSize: 21,
    fontWeight: '600',
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.softFill,
  },
  darkEditBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  quoteWrap: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.lineSubtle,
    gap: 4,
  },
  darkQuoteWrap: {
    borderTopColor: darkTheme.borderSubtle,
  },
  quoteText: {
    color: colors.inkSoft,
    fontFamily: typography.editorial,
    fontSize: 14,
    lineHeight: 21,
    fontStyle: 'italic',
  },
  darkQuoteText: {
    color: darkTheme.text,
  },
  quoteAuthor: {
    color: colors.muted,
    fontFamily: typography.ui,
    fontSize: 11,
    fontWeight: '500',
    alignSelf: 'flex-end',
    letterSpacing: 0.3,
  },

  /* 2. Estatísticas */
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 14,
  },
  statItem: {
    alignItems: 'center',
    gap: 2,
  },
  statNumber: {
    color: colors.ink,
    fontFamily: typography.editorial,
    fontSize: 22,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: colors.muted,
    fontFamily: typography.ui,
    fontSize: 11,
    fontWeight: '500',
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
    backgroundColor: colors.lineSubtle,
  },
  darkDivider: {
    backgroundColor: darkTheme.borderSubtle,
  },

  /* 3. Configurações da sala */
  settingHeader: {
    marginBottom: 8,
  },
  settingLabel: {
    color: colors.muted,
    fontFamily: typography.ui,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  ambienceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: radii.full,
    borderCurve: 'continuous',
    backgroundColor: colors.softFill,
  },
  darkAmbienceBar: {
    backgroundColor: '#181A26',
    borderWidth: 1,
    borderColor: darkTheme.borderSubtle,
  },
  ambienceTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderCurve: 'continuous',
  },
  ambienceTabActive: {
    backgroundColor: colors.paper,
    boxShadow: '0 1px 3px rgba(50, 37, 31, 0.08)',
  },
  ambienceTabActiveNight: {
    backgroundColor: '#262A3C',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.35)',
  },
  ambienceTabText: {
    color: colors.muted,
    fontFamily: typography.ui,
    fontSize: 12,
    fontWeight: '500',
  },
  ambienceTabTextActive: {
    color: colors.terracotta,
    fontWeight: '600',
  },
  ambienceTabTextActiveNight: {
    color: '#FFAE70',
    fontWeight: '600',
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.lineSubtle,
    marginVertical: 12,
  },
  customizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  customizeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniSwatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  customizeText: {
    color: colors.ink,
    fontFamily: typography.ui,
    fontSize: 13,
    fontWeight: '600',
  },
  customizeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  customizePaletteName: {
    color: colors.muted,
    fontFamily: typography.ui,
    fontSize: 12,
  },

  /* 4. Rodapé */
  footer: {
    alignItems: 'center',
    marginTop: 4,
  },
  footerText: {
    color: colors.mutedLight,
    fontFamily: typography.editorial,
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },

  /* Dark theme utilities */
  darkTitle: { color: darkTheme.text },
  darkMutedText: { color: darkTheme.textMuted },
  darkSubtleText: { color: darkTheme.textSubtle },
});
