import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { BookCover } from '@/src/components/book-cover';
import { colors, darkTheme } from '@/src/theme';
import type { LibraryPalette } from '@/src/library-palette';
import type { BookSearchResult } from '@/src/types/book';

export function CatalogBookGrid({
  isNight,
  onOpen,
  results,
  palette,
  addedWorkKeys,
}: {
  isNight: boolean;
  onOpen: (book: BookSearchResult) => void;
  results: BookSearchResult[];
  palette?: LibraryPalette['light'];
  addedWorkKeys?: ReadonlySet<string>;
}) {
  const { width, fontScale } = useWindowDimensions();
  const twoColumns = width < 360 || fontScale > 1.2;
  return (
    <View style={styles.grid}>
      {results.map((book) => {
        const isSaved = addedWorkKeys?.has(book.workKey) ?? false;
        return (
          <Pressable
            key={book.workKey}
            accessibilityLabel={`Ver detalhes de ${book.title}, de ${book.author}${isSaved ? ', já está na biblioteca' : ''}`}
            accessibilityRole="button"
            onPress={() => onOpen(book)}
            style={({ pressed }) => [styles.book, twoColumns && styles.bookWide, pressed && styles.pressed]}
          >
            <BookCover color={colors.softFill} coverUrl={book.coverUrl} style={styles.cover} />
            {isSaved ? (
              <View style={[styles.savedMark, { backgroundColor: palette?.surface ?? (isNight ? darkTheme.surface : colors.paper) }]}>
                <Ionicons color={isNight ? darkTheme.accent : colors.terracotta} name="checkmark" size={13} />
              </View>
            ) : null}
            <Text numberOfLines={2} style={[styles.title, palette && { color: palette.text }, isNight && !palette && styles.darkText]}>{book.title}</Text>
            <Text numberOfLines={1} style={[styles.author, palette && { color: palette.mutedText }, isNight && !palette && styles.darkMuted]}>{book.author}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 22 },
  book: { width: '31%', gap: 4, position: 'relative' },
  bookWide: { width: '47%' },
  cover: { width: '100%', aspectRatio: 0.68, borderRadius: 5, borderCurve: 'continuous', backgroundColor: colors.softFill, boxShadow: '0 3px 8px rgba(50, 37, 31, 0.12)' },
  title: { color: colors.ink, fontSize: 13, fontWeight: '600', lineHeight: 18, marginTop: 4 },
  author: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  savedMark: { position: 'absolute', top: 7, right: 7, width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  darkText: { color: darkTheme.text },
  darkMuted: { color: darkTheme.textMuted },
  pressed: { opacity: 0.68, transform: [{ scale: 0.98 }] },
});
