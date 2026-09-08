import Ionicons from '@expo/vector-icons/Ionicons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { useLibraryStore } from '@/src/store/library-store';
import { colors, darkTheme, radii } from '@/src/theme';

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
      style={[styles.screen, isNight && styles.darkScreen]}
    >
      {/* Ex-Libris / Identidade */}
      <View style={styles.profileHeader}>
        <View accessibilityLabel="Avatar do Leitor" style={styles.avatar}>
          <Text selectable style={styles.avatarText}>M</Text>
        </View>
        <View style={styles.identity}>
          <Text selectable style={[styles.name, isNight && styles.darkTitle]}>Marina</Text>
          <Text selectable style={[styles.handle, isNight && styles.darkMutedText]}>Leitora de tardes quietas</Text>
        </View>
      </View>

      {/* Epígrafe literária */}
      <View style={[styles.quoteCard, isNight && styles.darkCard]}>
        <Ionicons color={isNight ? '#FFAE70' : colors.terracotta} name="bookmark-outline" size={22} />
        <Text selectable style={[styles.quoteText, isNight && styles.darkTitle]}>
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
          <Ionicons
            color={isNight ? '#FFAE70' : colors.terracotta}
            name={isNight ? 'moon-outline' : resolvedAmbience === 'sunset' ? 'partly-sunny-outline' : 'sunny-outline'}
            size={18}
          />
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
  content: { gap: 18, padding: 20, paddingBottom: 110 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderCurve: 'continuous',
    backgroundColor: colors.terracotta,
    boxShadow: '0 4px 14px rgba(185, 95, 59, 0.25)',
  },
  avatarText: { color: colors.white, fontFamily: 'Georgia', fontSize: 30, fontWeight: '700' },
  identity: { flex: 1, gap: 3 },
  name: { color: colors.ink, fontFamily: 'Georgia', fontSize: 26, fontWeight: '700' },
  handle: { color: colors.muted, fontSize: 14 },
  quoteCard: {
    gap: 10,
    padding: 20,
    borderRadius: radii.large,
    borderCurve: 'continuous',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    boxShadow: '0 2px 8px rgba(53, 42, 36, 0.04)',
  },
  quoteText: {
    color: colors.ink,
    fontFamily: 'Georgia',
    fontSize: 17,
    lineHeight: 25,
    fontStyle: 'italic',
  },
  quoteAuthor: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    alignSelf: 'flex-end',
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: radii.large,
    borderCurve: 'continuous',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    boxShadow: '0 2px 8px rgba(53, 42, 36, 0.04)',
  },
  darkStatsCard: {
    backgroundColor: darkTheme.surface,
    borderColor: darkTheme.border,
  },
  statItem: { alignItems: 'center', gap: 3 },
  statNumber: {
    color: colors.ink,
    fontFamily: 'Georgia',
    fontSize: 26,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statDivider: { width: 1, height: 28, backgroundColor: colors.line },
  darkDivider: { backgroundColor: darkTheme.border },
  ambienceCard: {
    gap: 8,
    padding: 18,
    borderRadius: radii.large,
    borderCurve: 'continuous',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  ambienceHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ambienceTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  ambienceDesc: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  colophonWrap: { alignItems: 'center', marginTop: 10 },
  colophon: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  darkCard: {
    backgroundColor: darkTheme.surface,
    borderColor: darkTheme.border,
  },
  darkTitle: { color: darkTheme.text },
  darkMutedText: { color: darkTheme.textMuted },
  darkSubtleText: { color: darkTheme.textSubtle },
});
