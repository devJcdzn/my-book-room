import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BookCard } from '@/src/components/book-card';
import { PrimaryButton } from '@/src/components/primary-button';
import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { useLibraryStore } from '@/src/store/library-store';
import { colors, darkTheme, radii } from '@/src/theme';

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
    gap: 14,
    padding: 24,
    borderRadius: radii.large,
    borderCurve: 'continuous',
    backgroundColor: colors.paper,
    alignItems: 'center',
    marginTop: 20,
    boxShadow: '0 4px 12px rgba(53, 42, 36, 0.06)',
  },
  darkEmptyState: {
    backgroundColor: darkTheme.surface,
    borderColor: darkTheme.border,
    borderWidth: 1,
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
  darkEmptyIcon: {
    backgroundColor: 'rgba(120, 194, 150, 0.16)',
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
    borderColor: colors.line,
    boxShadow: '0 2px 8px rgba(53, 42, 36, 0.04)',
  },
  darkSummaryCard: {
    backgroundColor: darkTheme.surface,
    borderColor: darkTheme.border,
  },
  summaryStat: {
    alignItems: 'center',
    gap: 3,
  },
  summaryNumber: {
    color: colors.ink,
    fontFamily: 'Georgia',
    fontSize: 24,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.line,
  },
  darkSummaryDivider: {
    backgroundColor: darkTheme.border,
  },
  shelfSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: radii.medium,
    borderCurve: 'continuous',
    backgroundColor: '#EDE5D8',
    borderWidth: 1,
    borderColor: 'rgba(53, 42, 36, 0.06)',
  },
  darkShelfSelector: {
    backgroundColor: '#161824',
    borderColor: darkTheme.border,
  },
  shelfTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.small,
    borderCurve: 'continuous',
  },
  shelfTabActive: {
    backgroundColor: colors.paper,
    boxShadow: '0 1px 4px rgba(53, 42, 36, 0.08)',
  },
  shelfTabActiveNight: {
    backgroundColor: '#262A3C',
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.3)',
  },
  shelfTabText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  shelfTabTextActive: {
    color: colors.terracotta,
    fontWeight: '700',
  },
  shelfTabTextActiveNight: {
    color: '#FFAE70',
    fontWeight: '700',
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
