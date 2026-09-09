import Ionicons from '@expo/vector-icons/Ionicons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { useLibraryStore } from '@/src/store/library-store';
import { colors, darkTheme, radii, typography } from '@/src/theme';

export default function ProfileScreen() {
  const books = useLibraryStore((state) => state.books);
  const completed = books.filter((book) => book.status === 'completed').length;
  const totalPagesRead = books.reduce((sum, b) => sum + b.currentPage, 0);
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const resolvedAmbience = resolveAmbience(ambienceMode);
  const isNight = resolvedAmbience === 'night';

  const ambienceDescriptions: Record<string, string> = {
    auto: 'Ciclo natural ativo · A iluminação acompanha o horário do dia em tempo real.',
    day: 'Manhã luminosa · Luz suave para uma leitura revigorante.',
    sunset: 'Fim de tarde · Tons quentes de dourado sobre a madeira.',
    night: 'Noite serena · Abajur aceso e ambiente acolhedor.',
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      style={[styles.screen, isNight && styles.darkScreen]}
    >
      {/* Ex-Libris / Identidade */}
      <View style={styles.profileHeader}>
        <View accessibilityLabel="Avatar do Leitor" style={[styles.avatar, isNight && styles.darkAvatar]}>
          <Text selectable style={[styles.avatarText, isNight && styles.darkAvatarText]}>M</Text>
        </View>
        <View style={styles.identity}>
          <Text selectable style={[styles.name, isNight && styles.darkTitle]}>Marina</Text>
          <Text selectable style={[styles.handle, isNight && styles.darkMutedText]}>Leitora de tardes quietas</Text>
        </View>
      </View>

      {/* Epígrafe literária */}
      <View style={[styles.quoteCard, isNight && styles.darkCard]}>
        <Text selectable style={[styles.quoteText, isNight && styles.darkQuoteText]}>
          “Sempre imaginei que o paraíso fosse uma espécie de biblioteca.”
        </Text>
        <Text selectable style={[styles.quoteAuthor, isNight && styles.darkMutedText]}>
          — Jorge Luis Borges
        </Text>
      </View>

      {/* Estatísticas do acervo pessoal */}
      <View style={[styles.statsCard, isNight && styles.darkStatsCard]}>
        <View style={styles.statItem}>
          <Text selectable style={[styles.statNumber, isNight && styles.darkTitle]}>{books.length}</Text>
          <Text selectable style={[styles.statLabel, isNight && styles.darkMutedText]}>no acervo</Text>
        </View>
        <View style={[styles.statDivider, isNight && styles.darkDivider]} />
        <View style={styles.statItem}>
          <Text selectable style={[styles.statNumber, isNight && styles.darkTitle]}>{completed}</Text>
          <Text selectable style={[styles.statLabel, isNight && styles.darkMutedText]}>lidos</Text>
        </View>
        <View style={[styles.statDivider, isNight && styles.darkDivider]} />
        <View style={styles.statItem}>
          <Text selectable style={[styles.statNumber, isNight && styles.darkTitle]}>{totalPagesRead}</Text>
          <Text selectable style={[styles.statLabel, isNight && styles.darkMutedText]}>págs. lidas</Text>
        </View>
      </View>

      {/* Cartão de Atmosfera da Sala */}
      <View style={[styles.ambienceCard, isNight && styles.darkCard]}>
        <View style={styles.ambienceHeader}>
          <View style={[styles.ambienceIconWrap, isNight && styles.darkAmbienceIconWrap]}>
            <Ionicons
              color={isNight ? '#FFAE70' : colors.terracotta}
              name={isNight ? 'moon-outline' : resolvedAmbience === 'sunset' ? 'partly-sunny-outline' : 'sunny-outline'}
              size={17}
            />
          </View>
          <Text selectable style={[styles.ambienceTitle, isNight && styles.darkTitle]}>
            Atmosfera da sua sala
          </Text>
        </View>
        <Text selectable style={[styles.ambienceDesc, isNight && styles.darkMutedText]}>
          {ambienceDescriptions[ambienceMode] ?? 'Iluminação personalizada conforme suas preferências.'}
        </Text>
      </View>

      {/* Colofão / Rodapé editorial */}
      <View style={styles.colophonWrap}>
        <Text selectable style={[styles.colophon, isNight && styles.darkSubtleText]}>
          Bookroom · Seu refúgio pessoal para ler com calma.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  darkScreen: { backgroundColor: darkTheme.bg },
  content: { gap: 16, padding: 20, paddingBottom: 110 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 6 },
  avatar: {
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 31,
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
    fontSize: 28,
    fontWeight: '600',
  },
  darkAvatarText: {
    color: '#FFAE70',
  },
  identity: { flex: 1, gap: 2 },
  name: {
    color: colors.ink,
    fontFamily: typography.editorial,
    fontSize: 25,
    fontWeight: '600',
  },
  handle: {
    color: colors.muted,
    fontFamily: typography.ui,
    fontSize: 13,
  },
  quoteCard: {
    gap: 8,
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: radii.large,
    borderCurve: 'continuous',
    backgroundColor: colors.paper,
    borderLeftWidth: 3,
    borderLeftColor: colors.terracotta,
    borderWidth: 1,
    borderColor: colors.lineSubtle,
    boxShadow: '0 2px 8px rgba(50, 37, 31, 0.04)',
  },
  quoteText: {
    color: colors.inkSoft,
    fontFamily: typography.editorial,
    fontSize: 16,
    lineHeight: 24,
    fontStyle: 'italic',
  },
  darkQuoteText: {
    color: darkTheme.text,
  },
  quoteAuthor: {
    color: colors.muted,
    fontFamily: typography.ui,
    fontSize: 12,
    fontWeight: '500',
    alignSelf: 'flex-end',
    letterSpacing: 0.3,
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: radii.large,
    borderCurve: 'continuous',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.lineSubtle,
    boxShadow: '0 2px 8px rgba(50, 37, 31, 0.04)',
  },
  darkStatsCard: {
    backgroundColor: darkTheme.surface,
    borderColor: darkTheme.borderSubtle,
  },
  statItem: { alignItems: 'center', gap: 4 },
  statNumber: {
    color: colors.ink,
    fontFamily: typography.editorial,
    fontSize: 26,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: colors.muted,
    fontFamily: typography.ui,
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statDivider: { width: 1, height: 26, backgroundColor: colors.lineSubtle },
  darkDivider: { backgroundColor: darkTheme.borderSubtle },
  ambienceCard: {
    gap: 8,
    padding: 18,
    borderRadius: radii.large,
    borderCurve: 'continuous',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.lineSubtle,
    boxShadow: '0 2px 8px rgba(50, 37, 31, 0.04)',
  },
  ambienceHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ambienceIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.terracottaSoft,
  },
  darkAmbienceIconWrap: {
    backgroundColor: 'rgba(255, 174, 112, 0.15)',
  },
  ambienceTitle: {
    color: colors.ink,
    fontFamily: typography.ui,
    fontSize: 14,
    fontWeight: '600',
  },
  ambienceDesc: {
    color: colors.muted,
    fontFamily: typography.ui,
    fontSize: 13,
    lineHeight: 20,
  },
  colophonWrap: { alignItems: 'center', marginTop: 12 },
  colophon: {
    color: colors.mutedLight,
    fontFamily: typography.ui,
    fontSize: 12,
    textAlign: 'center',
  },
  darkCard: {
    backgroundColor: darkTheme.surface,
    borderColor: darkTheme.borderSubtle,
  },
  darkTitle: { color: darkTheme.text },
  darkMutedText: { color: darkTheme.textMuted },
  darkSubtleText: { color: darkTheme.textSubtle },
});

