import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/src/components/primary-button';
import { ProgressEditor } from '@/src/components/progress-editor';
import { useLibraryStore } from '@/src/store/library-store';
import { colors, radii } from '@/src/theme';

export default function BookProgressSheet() {
  const params = useLocalSearchParams<{ bookId?: string | string[] }>();
  const bookId = Array.isArray(params.bookId) ? params.bookId[0] : params.bookId;
  const book = useLibraryStore((state) => state.books.find((item) => item.id === bookId));
  const completingBookId = useLibraryStore((state) => state.completingBookId);
  const updateProgress = useLibraryStore((state) => state.updateProgress);
  const updateOpinion = useLibraryStore((state) => state.updateOpinion);
  const removeBook = useLibraryStore((state) => state.removeBook);
  const requestCompletion = useLibraryStore((state) => state.requestCompletion);

  if (!book) {
    return (
      <View style={styles.unavailable}>
        <Text selectable style={styles.unavailableTitle}>Livro indisponível</Text>
        <PrimaryButton label="Voltar ao ambiente" onPress={() => router.back()} />
      </View>
    );
  }

  const completeBook = () => {
    router.back();
    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => requestCompletion(book.id), 180);
  };

  const handleRating = (rating: number) => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateOpinion(book.id, { rating });
  };

  const handleDelete = () => {
    Alert.alert(
      'Remover livro',
      `Deseja remover "${book.title}" da sua biblioteca?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => {
            if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            removeBook(book.id);
            router.back();
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      style={styles.screen}
    >
      {/* Cabeçalho do livro */}
      <View style={styles.bookHeading}>
        <View style={[styles.bookColor, { backgroundColor: book.coverColor }]}>
          <View style={styles.bookSpineLine} />
        </View>
        <View style={styles.bookInfo}>
          <Text selectable numberOfLines={2} style={styles.title}>{book.title}</Text>
          <Text selectable style={styles.author}>{book.author}</Text>
        </View>
        <Pressable
          accessibilityLabel="Fechar"
          hitSlop={8}
          onPress={() => router.back()}
          style={styles.closeBtn}
        >
          <Ionicons color={colors.muted} name="close" size={22} />
        </Pressable>
      </View>

      {/* Editor de progresso */}
      <View style={styles.section}>
        <Text selectable style={styles.sectionTitle}>Progresso de leitura</Text>
        <ProgressEditor
          book={book}
          completionLocked={Boolean(completingBookId)}
          showIdentity={false}
          onChangePage={(page) => updateProgress(book.id, page)}
          onComplete={completeBook}
        />
      </View>

      {/* Avaliação e Notas */}
      <View style={styles.section}>
        <Text selectable style={styles.sectionTitle}>Sua avaliação & impressões</Text>
        <View accessibilityLabel="Avaliação por estrelas" style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map((value) => (
            <Pressable
              key={value}
              accessibilityLabel={`${value} ${value === 1 ? 'estrela' : 'estrelas'}`}
              accessibilityRole="button"
              hitSlop={6}
              onPress={() => handleRating(value)}
              style={styles.starButton}
            >
              <Ionicons
                color={value <= (book.rating ?? 0) ? colors.terracotta : colors.line}
                name={value <= (book.rating ?? 0) ? 'star' : 'star-outline'}
                size={26}
              />
            </Pressable>
          ))}
        </View>
        <TextInput
          accessibilityLabel={`Anotações sobre ${book.title}`}
          multiline
          onChangeText={(notes) => updateOpinion(book.id, { notes })}
          placeholder="Uma lembrança, uma frase favorita, o que ficou desta leitura…"
          placeholderTextColor={colors.muted}
          style={styles.notes}
          textAlignVertical="top"
          value={book.notes ?? ''}
        />
      </View>

      {/* Ação de remover */}
      <Pressable onPress={handleDelete} style={styles.deleteLink}>
        <Ionicons color="#B24538" name="trash-outline" size={16} />
        <Text style={styles.deleteLinkText}>Remover livro da biblioteca</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { gap: 20, padding: 20, paddingBottom: 48 },
  bookHeading: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  bookColor: {
    width: 20,
    height: 60,
    borderRadius: 5,
    borderCurve: 'continuous',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bookSpineLine: {
    width: 3,
    height: '100%',
    marginLeft: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  bookInfo: { flex: 1, gap: 2 },
  title: { color: colors.ink, fontFamily: 'Georgia', fontSize: 20, lineHeight: 24, fontWeight: '700' },
  author: { color: colors.muted, fontSize: 14 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
  section: {
    gap: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  ratingRow: { flexDirection: 'row', gap: 8 },
  starButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: colors.cream,
  },
  notes: {
    minHeight: 100,
    padding: 12,
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.small,
    borderCurve: 'continuous',
    backgroundColor: colors.white,
  },
  deleteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    marginTop: 8,
  },
  deleteLinkText: {
    color: '#B24538',
    fontSize: 14,
    fontWeight: '600',
  },
  unavailable: { flex: 1, justifyContent: 'center', gap: 20, padding: 24, backgroundColor: colors.paper },
  unavailableTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 24, textAlign: 'center' },
});
