import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BookCover } from '@/src/components/book-cover';
import { PrimaryButton } from '@/src/components/primary-button';
import { ProgressEditor } from '@/src/components/progress-editor';
import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { useLibraryStore } from '@/src/store/library-store';
import { colors, darkTheme, radii, typography } from '@/src/theme';

export default function BookProgressSheet() {
  const params = useLocalSearchParams<{ bookId?: string | string[] }>();
  const bookId = Array.isArray(params.bookId) ? params.bookId[0] : params.bookId;
  const books = useLibraryStore((state) => state.books);
  const activeBookId = useLibraryStore((state) => state.activeBookId);
  const targetId = bookId ?? activeBookId;
  const book = books.find((item) => item.id === targetId)
    ?? books.find((item) => item.status === 'reading')
    ?? books[0];

  const completingBookId = useLibraryStore((state) => state.completingBookId);
  const updateProgress = useLibraryStore((state) => state.updateProgress);
  const updateOpinion = useLibraryStore((state) => state.updateOpinion);
  const removeBook = useLibraryStore((state) => state.removeBook);
  const requestCompletion = useLibraryStore((state) => state.requestCompletion);
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const isNight = resolveAmbience(ambienceMode) === 'night';

  if (!book) {
    return (
      <View style={[styles.unavailable, isNight && styles.darkScreen]}>
        <Text selectable style={[styles.unavailableTitle, isNight && styles.darkTitle]}>Nenhum livro selecionado</Text>
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
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator
      style={[styles.screen, isNight && styles.darkScreen]}
    >
        {/* Cabeçalho do livro com estética editorial */}
        <View style={styles.bookHeading}>
          <BookCover color={book.coverColor} coverUrl={book.coverUrl} style={styles.bookCover}>
            <View style={styles.bookSpineLine} />
          </BookCover>
          <View style={styles.bookInfo}>
            <Text selectable numberOfLines={2} style={[styles.title, isNight && styles.darkTitle]}>
              {book.title}
            </Text>
            <Text selectable numberOfLines={1} style={[styles.author, isNight && styles.darkMutedText]}>
              {book.author}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Fechar"
            hitSlop={10}
            onPress={() => router.back()}
            style={[styles.closeBtn, isNight && styles.darkCloseBtn]}
          >
            <Ionicons color={isNight ? '#FAF4EB' : colors.ink} name="close" size={18} />
          </Pressable>
        </View>

        {/* Editor de progresso */}
        <View style={styles.section}>
          <Text selectable style={[styles.sectionTitle, isNight && styles.darkSectionTitle]}>
            Progresso de leitura
          </Text>
          <ProgressEditor
            book={book}
            completionLocked={Boolean(completingBookId)}
            showIdentity={false}
            onChangePage={(page) => updateProgress(book.id, page)}
            onComplete={completeBook}
          />
        </View>

        {/* Diário de Leitura & Anotações (Estilo Caderno Moleskine) */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text selectable style={[styles.sectionTitle, isNight && styles.darkSectionTitle]}>
              Diário & impressões
            </Text>
            {/* Avaliação em estrelas minimalista */}
            <View accessibilityLabel="Avaliação por estrelas" style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Pressable
                  key={value}
                  accessibilityLabel={`${value} ${value === 1 ? 'estrela' : 'estrelas'}`}
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => handleRating(value)}
                  style={styles.starTouch}
                >
                  <Ionicons
                    color={
                      value <= (book.rating ?? 0)
                        ? (isNight ? '#FFAE70' : colors.terracotta)
                        : (isNight ? '#353A4E' : '#D6CCC0')
                    }
                    name={value <= (book.rating ?? 0) ? 'star' : 'star-outline'}
                    size={20}
                  />
                </Pressable>
              ))}
            </View>
          </View>

          {/* Bloco de notas aconchegante */}
          <View style={[styles.notesWrapper, isNight && styles.darkNotesWrapper]}>
            <TextInput
              accessibilityLabel={`Anotações sobre ${book.title}`}
              multiline
              onChangeText={(notes) => updateOpinion(book.id, { notes })}
              placeholder="Trechos marcantes, impressões deste capítulo ou pensamentos para recordar…"
              placeholderTextColor={isNight ? darkTheme.textSubtle : colors.muted}
              scrollEnabled={false}
              style={[styles.notes, isNight && styles.darkNotes]}
              textAlignVertical="top"
              value={book.notes ?? ''}
            />
          </View>
        </View>

        {/* Ação de remover discreta */}
        <Pressable hitSlop={8} onPress={handleDelete} style={styles.deleteLink}>
          <Ionicons color="#C04D40" name="trash-outline" size={14} />
          <Text style={styles.deleteLinkText}>Remover da estante</Text>
        </Pressable>
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
  darkScreen: { backgroundColor: darkTheme.bg },
  content: { gap: 24, padding: 20, paddingBottom: 72 },
  bookHeading: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  bookCover: {
    width: 48,
    height: 72,
    borderRadius: 5,
    borderCurve: 'continuous',
    justifyContent: 'center',
    overflow: 'hidden',
    boxShadow: '0 4px 12px rgba(50, 37, 31, 0.14)',
  },
  bookSpineLine: {
    width: 3,
    height: '100%',
    marginLeft: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  bookInfo: { flex: 1, gap: 3 },
  title: {
    color: colors.ink,
    fontFamily: typography.editorial,
    fontSize: 19,
    lineHeight: 23,
    fontWeight: '600',
  },
  author: { color: colors.muted, fontSize: 13 },
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
  section: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  darkSectionTitle: {
    color: darkTheme.textMuted,
  },
  ratingRow: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  starTouch: {
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesWrapper: {
    backgroundColor: colors.softFill,
    borderRadius: radii.medium,
    borderCurve: 'continuous',
    padding: 4,
  },
  darkNotesWrapper: {
    backgroundColor: darkTheme.surfaceElevated,
  },
  notes: {
    minHeight: 130,
    padding: 14,
    color: colors.ink,
    fontSize: 15,
    lineHeight: 23,
    fontFamily: typography.ui,
  },
  darkNotes: {
    color: darkTheme.text,
  },
  deleteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 4,
    opacity: 0.75,
  },
  deleteLinkText: {
    color: '#C04D40',
    fontSize: 13,
    fontWeight: '500',
  },
  unavailable: {
    flex: 1,
    width: '100%',
    minHeight: '100%',
    justifyContent: 'center',
    gap: 20,
    padding: 24,
    backgroundColor: colors.paper,
  },
  unavailableTitle: { color: colors.ink, fontFamily: typography.editorial, fontSize: 22, textAlign: 'center' },
  darkTitle: { color: darkTheme.text },
  darkMutedText: { color: darkTheme.textMuted },
});
