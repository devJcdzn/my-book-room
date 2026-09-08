import Ionicons from '@expo/vector-icons/Ionicons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useLibraryStore } from '@/src/store/library-store';
import { colors, radii } from '@/src/theme';

export default function ProfileScreen() {
  const books = useLibraryStore((state) => state.books);
  const completed = books.filter((book) => book.status === 'completed').length;
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} style={styles.screen}>
      <View style={styles.profileHeader}>
        <View accessibilityLabel="Avatar de Marina" style={styles.avatar}><Text selectable style={styles.avatarText}>M</Text></View>
        <View style={styles.identity}><Text selectable style={styles.name}>Marina</Text><Text selectable style={styles.handle}>leitora de tardes quietas</Text></View>
      </View>
      <View style={styles.quoteBlock}>
        <Ionicons color={colors.terracotta} name="bookmark-outline" size={24} />
        <Text selectable style={styles.quote}>Uma sala construída página por página.</Text>
      </View>
      <View style={styles.stats}>
        <View style={styles.stat}><Text selectable style={styles.statNumber}>{books.length}</Text><Text selectable style={styles.statLabel}>livros adicionados</Text></View>
        <View style={styles.divider} />
        <View style={styles.stat}><Text selectable style={styles.statNumber}>{completed}</Text><Text selectable style={styles.statLabel}>na estante</Text></View>
      </View>
      <Text selectable style={styles.placeholder}>Perfil demonstrativo · configurações e conta ficam para uma próxima versão.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream }, content: { gap: 22, padding: 22, paddingBottom: 40 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 78, height: 78, alignItems: 'center', justifyContent: 'center', borderRadius: 26, borderCurve: 'continuous', backgroundColor: colors.terracotta },
  avatarText: { color: colors.white, fontFamily: 'Georgia', fontSize: 34 }, identity: { flex: 1, gap: 4 },
  name: { color: colors.ink, fontFamily: 'Georgia', fontSize: 29 }, handle: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  quoteBlock: { gap: 14, padding: 22, borderRadius: radii.large, borderCurve: 'continuous', backgroundColor: colors.paper, boxShadow: '0 8px 24px rgba(76, 48, 37, 0.08)' },
  quote: { maxWidth: 280, color: colors.ink, fontFamily: 'Georgia', fontSize: 23, lineHeight: 31 },
  stats: { flexDirection: 'row', alignItems: 'stretch', padding: 20, borderRadius: radii.large, borderCurve: 'continuous', backgroundColor: colors.sageSoft },
  stat: { flex: 1, gap: 5 }, statNumber: { color: colors.ink, fontFamily: 'Georgia', fontSize: 30, fontVariant: ['tabular-nums'] }, statLabel: { color: colors.muted, fontSize: 13 },
  divider: { width: 1, marginHorizontal: 18, backgroundColor: '#B9C2AB' }, placeholder: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
