import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ScreenHeader } from '@/src/components/screen-header';
import { CatalogBookGrid } from '@/src/components/catalog-book-grid';
import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { useBookSearch } from '@/src/hooks/use-book-search';
import { useLibraryStore } from '@/src/store/library-store';
import { controls, colors, darkTheme, typography } from '@/src/theme';
import type { BookSearchResult } from '@/src/types/book';

const categories = [
  { label: 'Populares', query: '' },
  { label: 'Ficção', query: 'subject:fiction' },
  { label: 'Fantasia', query: 'subject:fantasy' },
  { label: 'Negócios', query: 'subject:business' },
  { label: 'Autoajuda', query: 'subject:self-help' },
];

export default function CatalogScreen() {
  const { from, query: initialQuery, shelfId, status: targetStatus } = useLocalSearchParams<{ from?: string; query?: string; shelfId?: string; status?: string }>();
  const [query, setQuery] = useState(typeof initialQuery === 'string' ? initialQuery : '');
  const [categoryIndex, setCategoryIndex] = useState(0);
  const insets = useSafeAreaInsets();
  const category = categories[categoryIndex];
  const books = useLibraryStore((state) => state.books);
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const isNight = resolveAmbience(ambienceMode) === 'night';
  const { error, hasMore, loadMore, loadMoreError, results, retry, status } = useBookSearch(query.trim() ? query : category.query);
  const addedWorkKeys = useMemo(
    () => new Set(books.map((book) => book.openLibraryWorkKey).filter((key): key is string => Boolean(key))),
    [books],
  );
  const hasQuery = query.trim().length > 0;
  const isShortQuery = query.trim().length === 1;

  const openBook = (result: BookSearchResult) => {
    const savedBook = books.find((book) => book.openLibraryWorkKey === result.workKey);
    if (savedBook) {
      router.navigate({ pathname: '/book-progress', params: { bookId: savedBook.id, from } });
      return;
    }
    router.navigate({
      pathname: '/book-progress',
      params: {
        preview: 'true',
        from,
        shelfId,
        status: targetStatus,
        workKey: result.workKey,
        title: result.title,
        author: result.author,
        editionKey: result.editionKey,
        coverId: result.coverId ? String(result.coverId) : undefined,
        coverUrl: result.coverUrl,
        isbn: result.isbn,
        firstPublishYear: result.firstPublishYear ? String(result.firstPublishYear) : undefined,
        totalPages: result.totalPages ? String(result.totalPages) : undefined,
      },
    });
  };

  const clearSearch = () => setQuery('');

  return (
    <View style={[styles.screen, isNight && styles.darkScreen]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style={isNight ? 'light' : 'dark'} />
      <ScreenHeader title="Catálogo" isNight={isNight} onBack={() => router.canGoBack() ? router.back() : router.replace('/books')} />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        style={[styles.screen, isNight && styles.darkScreen]}
      >
        <View style={[styles.searchField, isNight && styles.darkSearchField]}>
          <Ionicons color={isNight ? darkTheme.textMuted : colors.muted} name="search" size={19} />
          <TextInput
            accessibilityLabel="Buscar livros no catálogo"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setQuery}
            placeholder="Buscar por título ou autor"
            placeholderTextColor={isNight ? darkTheme.textSubtle : colors.mutedLight}
            returnKeyType="search"
            style={[styles.searchInput, isNight && styles.darkSearchInput]}
            value={query}
          />
          {query.length ? (
            <Pressable accessibilityLabel="Limpar busca" accessibilityRole="button" hitSlop={10} onPress={clearSearch} style={styles.clearButton}>
              <Ionicons color={isNight ? darkTheme.textMuted : colors.muted} name="close-circle" size={19} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories} style={styles.categoryScroll}>
          {categories.map((item, index) => {
            const selected = !hasQuery && categoryIndex === index;
            return (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => { setQuery(''); setCategoryIndex(index); }}
                style={({ pressed }) => [styles.category, isNight && styles.darkCategory, selected && { backgroundColor: isNight ? darkTheme.accent : colors.terracotta, borderColor: 'transparent' }, pressed && styles.pressed]}
              >
                <Text style={[styles.categoryText, isNight && styles.darkText, selected && { color: isNight ? darkTheme.actionText : colors.white }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Text style={[styles.heading, isNight && styles.darkText]}>{hasQuery ? 'Resultados' : categoryIndex === 0 ? 'Descubra livros' : category.label}</Text>
            <Text style={[styles.subheading, isNight && styles.darkMuted]}>
              {hasQuery ? 'Encontre uma obra para sua biblioteca.' : 'Explore títulos para sua próxima leitura.'}
            </Text>
          </View>
          <Text style={[styles.resultCount, isNight && styles.darkMuted]}>{!isShortQuery && results.length ? results.length : ''}</Text>
        </View>

        {isShortQuery ? (
          <Text style={[styles.feedback, isNight && styles.darkMuted]}>Digite mais uma letra para buscar.</Text>
        ) : null}
        {status === 'loading' ? (
          <ActivityIndicator color={isNight ? darkTheme.accent : colors.terracotta} style={styles.loading} />
        ) : null}
        {error ? (
          <View style={styles.feedbackGroup}>
            <Text style={[styles.feedback, isNight && styles.darkMuted]}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={retry}>
              <Text style={[styles.retry, isNight && styles.darkAccent]}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : null}
        {status === 'empty' ? (
          <Text style={[styles.feedback, isNight && styles.darkMuted]}>
            {hasQuery ? 'Nenhum livro encontrado para essa busca.' : 'O catálogo está indisponível agora.'}
          </Text>
        ) : null}
        {!isShortQuery && results.length ? (
          <CatalogBookGrid addedWorkKeys={addedWorkKeys} isNight={isNight} onOpen={openBook} results={results} />
        ) : null}
        {loadMoreError ? <Text style={[styles.feedback, isNight && styles.darkMuted]}>{loadMoreError}</Text> : null}
        {hasMore && results.length && !isShortQuery ? (
          <Pressable accessibilityRole="button" disabled={status === 'loadingMore'} onPress={loadMore} style={styles.loadMore}>
            {status === 'loadingMore' ? (
              <ActivityIndicator color={isNight ? darkTheme.accent : colors.terracotta} />
            ) : (
              <Text style={[styles.retry, isNight && styles.darkAccent]}>Carregar mais</Text>
            )}
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  darkScreen: { backgroundColor: darkTheme.bg },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 20 },
  searchField: { minHeight: controls.input.minHeight, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: controls.input.paddingHorizontal, borderRadius: controls.input.borderRadius, borderCurve: 'continuous', borderWidth: controls.input.borderWidth, borderColor: colors.line, backgroundColor: colors.paper },
  darkSearchField: { backgroundColor: darkTheme.inputBg, borderColor: darkTheme.inputBorder },
  searchInput: { flex: 1, minHeight: controls.input.minHeight, paddingVertical: controls.input.paddingVertical, color: colors.ink, fontSize: controls.input.fontSize },
  darkSearchInput: { color: darkTheme.text },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headingCopy: { flex: 1, gap: 3 },
  heading: { color: colors.ink, fontFamily: typography.editorial, fontSize: 24, lineHeight: 32 },
  subheading: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  resultCount: { color: colors.muted, fontSize: 13, fontVariant: ['tabular-nums'] },
  loading: { paddingVertical: 24 },
  feedbackGroup: { alignItems: 'flex-start', gap: 8 },
  feedback: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  retry: { color: colors.terracotta, fontSize: 14, fontWeight: '600' },
  darkText: { color: darkTheme.text },
  darkMuted: { color: darkTheme.textMuted },
  darkAccent: { color: darkTheme.accent },
  loadMore: { ...controls.button },
  clearButton: { ...controls.iconButton, marginRight: -8 },
  categoryScroll: { marginHorizontal: -20 },
  categories: { paddingHorizontal: 20, gap: 8 },
  category: { minHeight: 44, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, backgroundColor: colors.paper },
  darkCategory: { backgroundColor: darkTheme.surface, borderColor: darkTheme.border },
  categoryText: { color: colors.inkSoft, fontSize: 13, fontWeight: '500' },
  pressed: { opacity: 0.7 },
});
