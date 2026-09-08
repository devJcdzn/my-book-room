import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BookCard } from '@/src/components/book-card';
import { PrimaryButton } from '@/src/components/primary-button';
import { useLibraryStore } from '@/src/store/library-store';
import { colors, radii } from '@/src/theme';

type FilterTab = 'all' | 'reading' | 'completed';

export default function BooksScreen() {
  const books = useLibraryStore((state) => state.books);
  const activeBookId = useLibraryStore((state) => state.activeBookId);
  const [filter, setFilter] = useState<FilterTab>('all');

  const readingBooks = useMemo(() => books.filter((book) => book.status !== 'completed'), [books]);
  const completedBooks = useMemo(() => books.filter((book) => book.status === 'completed'), [books]);

  const filteredBooks = useMemo(() => {
    if (filter === 'reading') return readingBooks;
    if (filter === 'completed') return completedBooks;
    return books;
  }, [books, filter, readingBooks, completedBooks]);

  const handleFilterChange = (nextFilter: FilterTab) => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFilter(nextFilter);
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator
      style={styles.screen}
    >
      {books.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons color={colors.sage} name="library-outline" size={38} />
          </View>
          <Text selectable style={styles.emptyTitle}>
            Sua estante aguarda leituras.
          </Text>
          <Text selectable style={styles.emptyText}>
            Adicione um livro para acompanhar o progresso na mesa 3D e preencher sua sala.
          </Text>
          <PrimaryButton label="Adicionar primeiro livro" onPress={() => router.push('/add-book')} />
        </View>
      ) : (
        <>
          {/* Barra de resumo */}
          <View style={styles.summaryBar}>
            <View style={styles.summaryStat}>
              <Text selectable style={styles.summaryNumber}>{readingBooks.length}</Text>
              <Text selectable style={styles.summaryLabel}>na mesa</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
              <Text selectable style={styles.summaryNumber}>{completedBooks.length}</Text>
              <Text selectable style={styles.summaryLabel}>concluídos</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStat}>
              <Text selectable style={styles.summaryNumber}>
                {books.reduce((sum, b) => sum + b.currentPage, 0)}
              </Text>
              <Text selectable style={styles.summaryLabel}>pág. lidas</Text>
            </View>
          </View>

          {/* Filtros em chips */}
          <View style={styles.filterRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => handleFilterChange('all')}
              style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
                Todos ({books.length})
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => handleFilterChange('reading')}
              style={[styles.filterChip, filter === 'reading' && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, filter === 'reading' && styles.filterTextActive]}>
                Na mesa ({readingBooks.length})
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => handleFilterChange('completed')}
              style={[styles.filterChip, filter === 'completed' && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, filter === 'completed' && styles.filterTextActive]}>
                Concluídos ({completedBooks.length})
              </Text>
            </Pressable>
          </View>

          {/* Lista de livros */}
          <View style={styles.bookList}>
            {filteredBooks.map((book, index) => (
              <BookCard
                key={book.id}
                book={book}
                index={index}
                isActiveOnDesk={book.id === activeBookId && book.status === 'reading'}
              />
            ))}
          </View>

          {/* Botão para adicionar mais um livro */}
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/add-book');
            }}
            style={({ pressed }) => [styles.addBanner, pressed && styles.addBannerPressed]}
          >
            <Ionicons color={colors.terracotta} name="add-circle-outline" size={24} />
            <Text style={styles.addBannerText}>Adicionar outro livro</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    gap: 14,
    padding: 16,
    paddingBottom: 110, // Margem generosa para nunca ficar atrás da tab bar
  },
  emptyState: {
    gap: 14,
    padding: 24,
    borderRadius: radii.large,
    borderCurve: 'continuous',
    backgroundColor: colors.paper,
    alignItems: 'center',
    marginTop: 20,
    boxShadow: '0 4px 12px rgba(53, 42, 36, 0.06)',
  },
  emptyIcon: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    borderCurve: 'continuous',
    backgroundColor: colors.sageSoft,
  },
  emptyTitle: {
    color: colors.ink,
    fontFamily: 'Georgia',
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 6,
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: radii.medium,
    borderCurve: 'continuous',
    backgroundColor: colors.sageSoft,
  },
  summaryStat: {
    alignItems: 'center',
    gap: 2,
  },
  summaryNumber: {
    color: colors.ink,
    fontFamily: 'Georgia',
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#B9C2AB',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  filterChipActive: {
    backgroundColor: colors.terracotta,
    borderColor: colors.terracotta,
  },
  filterText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  filterTextActive: {
    color: colors.white,
    fontWeight: '700',
  },
  bookList: {
    gap: 10,
  },
  addBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 6,
    borderRadius: radii.medium,
    borderCurve: 'continuous',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: 'dashed',
  },
  addBannerPressed: {
    opacity: 0.7,
  },
  addBannerText: {
    color: colors.terracotta,
    fontSize: 15,
    fontWeight: '700',
  },
});
