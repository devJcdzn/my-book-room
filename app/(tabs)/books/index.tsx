import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BookCard } from '@/src/components/book-card';
import { PrimaryButton } from '@/src/components/primary-button';
import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { useLibraryStore } from '@/src/store/library-store';
import { colors, darkTheme, radii, typography } from '@/src/theme';

type FilterTab = 'all' | 'reading' | 'completed';

export default function BooksScreen() {
  const books = useLibraryStore((state) => state.books);
  const activeBookId = useLibraryStore((state) => state.activeBookId);
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const isNight = resolveAmbience(ambienceMode) === 'night';

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
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
        style={[styles.screen, isNight && styles.darkScreen]}
      >
      {books.length === 0 ? (
        <View style={[styles.emptyState, isNight && styles.darkEmptyState]}>
          <View style={[styles.emptyIcon, isNight && styles.darkEmptyIcon]}>
            <Ionicons color={isNight ? '#78C296' : colors.sage} name="library-outline" size={38} />
          </View>
          <Text selectable style={[styles.emptyTitle, isNight && styles.darkTitle]}>
            Sua estante aguarda leituras.
          </Text>
          <Text selectable style={[styles.emptyText, isNight && styles.darkMutedText]}>
            Adicione um livro para acompanhar o progresso na mesa 3D e preencher sua sala.
          </Text>
          <PrimaryButton label="Adicionar primeiro livro" onPress={() => router.navigate('/add-book')} />
        </View>
      ) : (
        <>
          {/* Ficha de resumo literário (Ex-Libris) */}
          <View style={[styles.summaryCard, isNight && styles.darkSummaryCard]}>
            <View style={styles.summaryStat}>
              <Text selectable style={[styles.summaryNumber, isNight && styles.darkTitle]}>
                {readingBooks.length}
              </Text>
              <Text selectable style={[styles.summaryLabel, isNight && styles.darkMutedText]}>
                em leitura
              </Text>
            </View>
            <View style={[styles.summaryDivider, isNight && styles.darkSummaryDivider]} />
            <View style={styles.summaryStat}>
              <Text selectable style={[styles.summaryNumber, isNight && styles.darkTitle]}>
                {completedBooks.length}
              </Text>
              <Text selectable style={[styles.summaryLabel, isNight && styles.darkMutedText]}>
                concluídos
              </Text>
            </View>
            <View style={[styles.summaryDivider, isNight && styles.darkSummaryDivider]} />
            <View style={styles.summaryStat}>
              <Text selectable style={[styles.summaryNumber, isNight && styles.darkTitle]}>
                {books.reduce((sum, b) => sum + b.currentPage, 0)}
              </Text>
              <Text selectable style={[styles.summaryLabel, isNight && styles.darkMutedText]}>
                páginas lidas
              </Text>
            </View>
          </View>

          {/* Seletor de estante refinado */}
          <View style={[styles.shelfSelector, isNight && styles.darkShelfSelector]}>
            <Pressable
              accessibilityRole="button"
              onPress={() => handleFilterChange('all')}
              style={[
                styles.shelfTab,
                filter === 'all' && (isNight ? styles.shelfTabActiveNight : styles.shelfTabActive),
              ]}
            >
              <Text
                style={[
                  styles.shelfTabText,
                  isNight && styles.darkMutedText,
                  filter === 'all' && (isNight ? styles.shelfTabTextActiveNight : styles.shelfTabTextActive),
                ]}
              >
                Todos ({books.length})
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => handleFilterChange('reading')}
              style={[
                styles.shelfTab,
                filter === 'reading' && (isNight ? styles.shelfTabActiveNight : styles.shelfTabActive),
              ]}
            >
              <Text
                style={[
                  styles.shelfTabText,
                  isNight && styles.darkMutedText,
                  filter === 'reading' && (isNight ? styles.shelfTabTextActiveNight : styles.shelfTabTextActive),
                ]}
              >
                Na mesa ({readingBooks.length})
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => handleFilterChange('completed')}
              style={[
                styles.shelfTab,
                filter === 'completed' && (isNight ? styles.shelfTabActiveNight : styles.shelfTabActive),
              ]}
            >
              <Text
                style={[
                  styles.shelfTabText,
                  isNight && styles.darkMutedText,
                  filter === 'completed' && (isNight ? styles.shelfTabTextActiveNight : styles.shelfTabTextActive),
                ]}
              >
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
          <View style={styles.addBtnWrap}>
            <PrimaryButton
              label="Adicionar outro livro"
              tone="secondary"
              onPress={() => {
                if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.navigate('/add-book');
              }}
            />
          </View>
        </>
      )}
    </ScrollView>
    {process.env.EXPO_OS === 'ios' && (
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityHint="Abre a tela para adicionar novo livro à biblioteca"
          accessibilityLabel="Adicionar livro"
          icon="plus"
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.navigate('/add-book');
          }}
          tintColor={isNight ? '#FFAE70' : colors.terracotta}
        />
      </Stack.Toolbar>
    )}
  </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  darkScreen: {
    backgroundColor: darkTheme.bg,
  },
  content: {
    gap: 14,
    padding: 16,
    paddingBottom: 110,
  },
  emptyState: {
    gap: 16,
    paddingVertical: 56,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkEmptyState: {
    backgroundColor: 'transparent',
  },
  emptyIcon: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 40,
    backgroundColor: colors.sageSoft,
    marginBottom: 4,
  },
  darkEmptyIcon: {
    backgroundColor: 'rgba(120, 194, 150, 0.16)',
  },
  emptyTitle: {
    color: colors.ink,
    fontFamily: typography.editorial,
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 30,
    textAlign: 'center',
  },
  emptyText: {
    color: colors.muted,
    fontFamily: typography.ui,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 300,
    marginBottom: 10,
  },
  summaryCard: {
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
  darkSummaryCard: {
    backgroundColor: darkTheme.surface,
    borderColor: darkTheme.borderSubtle,
  },
  summaryStat: {
    alignItems: 'center',
    gap: 4,
  },
  summaryNumber: {
    color: colors.ink,
    fontFamily: typography.editorial,
    fontSize: 26,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  summaryLabel: {
    color: colors.muted,
    fontFamily: typography.ui,
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryDivider: {
    width: 1,
    height: 26,
    backgroundColor: colors.lineSubtle,
  },
  darkSummaryDivider: {
    backgroundColor: darkTheme.borderSubtle,
  },
  shelfSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: radii.full,
    borderCurve: 'continuous',
    backgroundColor: colors.softFill,
  },
  darkShelfSelector: {
    backgroundColor: '#181A26',
    borderWidth: 1,
    borderColor: darkTheme.borderSubtle,
  },
  shelfTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    borderCurve: 'continuous',
  },
  shelfTabActive: {
    backgroundColor: colors.paper,
    boxShadow: '0 2px 6px rgba(50, 37, 31, 0.08)',
  },
  shelfTabActiveNight: {
    backgroundColor: '#262A3C',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.35)',
  },
  shelfTabText: {
    color: colors.muted,
    fontFamily: typography.ui,
    fontSize: 13,
    fontWeight: '500',
  },
  shelfTabTextActive: {
    color: colors.terracotta,
    fontWeight: '600',
  },
  shelfTabTextActiveNight: {
    color: '#FFAE70',
    fontWeight: '600',
  },
  bookList: {
    gap: 10,
  },
  addBtnWrap: {
    marginTop: 6,
  },
  darkTitle: {
    color: darkTheme.text,
  },
  darkMutedText: {
    color: darkTheme.textMuted,
  },
});
