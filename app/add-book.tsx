import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BookCover } from '@/src/components/book-cover';
import { PrimaryButton } from '@/src/components/primary-button';
import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { useBookSearch } from '@/src/hooks/use-book-search';
import { bookCatalogClient, type CatalogPagesSource } from '@/src/services/book-catalog';
import { extractCoverColor } from '@/src/services/cover-color';
import { deriveBookColor, useLibraryStore } from '@/src/store/library-store';
import { colors, darkTheme, radii, typography } from '@/src/theme';
import type { BookSearchResult } from '@/src/types/book';

const PALETTE = [
  '#B95F3B', // Terracotta
  '#4F7480', // Azul ardósia
  '#6D7657', // Verde sálvia escuro
  '#6A4D61', // Vinho / ameixa
  '#C58A3C', // Mostarda quente
  '#2E4057', // Azul petróleo profundo
];

export default function AddBookScreen() {
  const [query, setQuery] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [pendingResult, setPendingResult] = useState<BookSearchResult>();

  // Campos do formulário manual
  const [customTitle, setCustomTitle] = useState('');
  const [customAuthor, setCustomAuthor] = useState('');
  const [customPages, setCustomPages] = useState('');
  const [customColor, setCustomColor] = useState(PALETTE[0]);

  const books = useLibraryStore((state) => state.books);
  const addOpenLibraryBook = useLibraryStore((state) => state.addOpenLibraryBook);
  const addCustomBook = useLibraryStore((state) => state.addCustomBook);
  const updateBookCoverColor = useLibraryStore((state) => state.updateBookCoverColor);
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const isNight = resolveAmbience(ambienceMode) === 'night';

  const { error, hasMore, loadMore, loadMoreError, results, retry, status } = useBookSearch(query);

  const addedIds = useMemo(() => new Set(books.map((book) => book.id)), [books]);
  const parsedPages = Number(customPages);
  const validPages = Number.isInteger(parsedPages) && parsedPages >= 1 && parsedPages <= 99_999;

  const updateCoverColor = (book: BookSearchResult) => {
    if (!book.coverUrl) return;
    void extractCoverColor(book.coverUrl).then((color) => {
      if (color) updateBookCoverColor(book.workKey, color);
    });
  };

  const syncCatalogBook = (result: BookSearchResult, totalPagesSource: CatalogPagesSource) => {
    void bookCatalogClient.upsertBook({ result, totalPagesSource }).catch(() => undefined);
  };

  const selectCatalogBook = (book: BookSearchResult) => {
    if (addedIds.has(book.workKey)) return;
    if (!book.totalPages) {
      setPendingResult(book);
      setCustomTitle(book.title);
      setCustomAuthor(book.author === 'Autor desconhecido' ? '' : book.author);
      setCustomPages('');
      setCustomColor(deriveBookColor(book.workKey));
      setShowCustomForm(true);
      return;
    }
    const catalogBook = { ...book, totalPages: book.totalPages };
    addOpenLibraryBook(catalogBook);
    syncCatalogBook(catalogBook, book.totalPagesSource ?? 'open_library');
    updateCoverColor(book);
    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const handleCreateCustom = () => {
    if (!customTitle.trim() || !validPages) return;
    if (pendingResult) {
      const catalogBook = {
        ...pendingResult,
        title: customTitle.trim(),
        author: customAuthor.trim() || 'Autor desconhecido',
        totalPages: parsedPages,
      };
      addOpenLibraryBook(catalogBook);
      syncCatalogBook(catalogBook, 'user');
      updateCoverColor(pendingResult);
    } else {
      addCustomBook({
        title: customTitle.trim(),
        author: customAuthor.trim() || 'Autor desconhecido',
        coverColor: customColor,
        totalPages: parsedPages,
      });
    }
    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const startCustomWithQuery = () => {
    setPendingResult(undefined);
    setCustomTitle(query.trim());
    setCustomAuthor('');
    setCustomPages('');
    setShowCustomForm(true);
  };

  const isSearching = Boolean(query.trim());

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator
      style={[styles.screen, isNight && styles.darkScreen]}
    >
      {/* Header do Sheet com contraste alto garantido */}
      <View style={styles.sheetHeader}>
        <View style={styles.sheetHeaderTitles}>
          <Text selectable style={[styles.sheetTitle, isNight && styles.darkSheetTitle]}>
            Adicionar livro
          </Text>
          <Text selectable style={[styles.sheetSubtitle, isNight && styles.darkSheetSubtitle]}>
            {showCustomForm
              ? 'Preencha os dados da obra para sua mesa'
              : 'Selecione uma obra ou busque no acervo'}
          </Text>
        </View>
        <Pressable
          accessibilityHint="Fecha o formulário"
          accessibilityLabel="Fechar"
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.closeBtn,
            isNight && styles.darkCloseBtn,
            pressed && styles.closeBtnPressed,
          ]}
        >
          <Ionicons color={isNight ? '#FAF4EB' : colors.ink} name="close" size={20} />
        </Pressable>
      </View>

      {/* Alternador entre Catálogo e Manual */}
      <View style={[styles.tabToggleRow, isNight && styles.darkTabToggleRow]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowCustomForm(false);
          }}
          style={[
            styles.toggleBtn,
            !showCustomForm && (isNight ? styles.toggleBtnActiveNight : styles.toggleBtnActive),
          ]}
        >
          <Text
            style={[
              styles.toggleBtnText,
              !showCustomForm
                ? (isNight ? styles.toggleBtnTextActiveNight : styles.toggleBtnTextActive)
                : (isNight ? styles.darkMutedText : null),
            ]}
          >
            Catálogo e busca
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setPendingResult(undefined);
            setShowCustomForm(true);
          }}
          style={[
            styles.toggleBtn,
            showCustomForm && (isNight ? styles.toggleBtnActiveNight : styles.toggleBtnActive),
          ]}
        >
          <Text
            style={[
              styles.toggleBtnText,
              showCustomForm
                ? (isNight ? styles.toggleBtnTextActiveNight : styles.toggleBtnTextActive)
                : (isNight ? styles.darkMutedText : null),
            ]}
          >
            Criar manualmente
          </Text>
        </Pressable>
      </View>

      {showCustomForm ? (
        /* Formulário de criação personalizada */
        <View style={[styles.formContainer, isNight && styles.darkCard]}>
          <Text selectable style={[styles.formSectionTitle, isNight && styles.darkTitle]}>
            Personalizar livro na mesa
          </Text>

          <View style={styles.fieldGroup}>
            <Text selectable style={[styles.label, isNight && styles.darkLabel]}>
              Título da obra *
            </Text>
            <TextInput
              autoCapitalize="sentences"
              onChangeText={setCustomTitle}
              placeholder="Ex: Cem Anos de Solidão"
              placeholderTextColor={isNight ? darkTheme.textSubtle : colors.muted}
              style={[styles.textInput, isNight && styles.darkTextInput]}
              value={customTitle}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text selectable style={[styles.label, isNight && styles.darkLabel]}>
              Autor(a)
            </Text>
            <TextInput
              autoCapitalize="words"
              onChangeText={setCustomAuthor}
              placeholder="Ex: Gabriel García Márquez"
              placeholderTextColor={isNight ? darkTheme.textSubtle : colors.muted}
              style={[styles.textInput, isNight && styles.darkTextInput]}
              value={customAuthor}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text selectable style={[styles.label, isNight && styles.darkLabel]}>
              Número total de páginas *
            </Text>
            <TextInput
              keyboardType="number-pad"
              maxLength={5}
              onChangeText={setCustomPages}
              placeholder="Ex: 350"
              placeholderTextColor={isNight ? darkTheme.textSubtle : colors.muted}
              style={[styles.textInput, isNight && styles.darkTextInput]}
              value={customPages}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text selectable style={[styles.label, isNight && styles.darkLabel]}>
              Cor da capa 3D
            </Text>
            <View style={styles.paletteRow}>
              {PALETTE.map((color) => {
                const selected = customColor === color;
                return (
                  <Pressable
                    key={color}
                    accessibilityLabel={`Cor ${color}`}
                    accessibilityRole="button"
                    onPress={() => {
                      if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setCustomColor(color);
                    }}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: color },
                      selected && styles.colorSwatchSelected,
                    ]}
                  >
                    {selected && <Ionicons color="#FFF" name="checkmark" size={18} />}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Pré-visualização do livro 3D */}
          <View style={[styles.previewBox, isNight && styles.darkPreviewBox]}>
            <View style={[styles.coverPreview, { backgroundColor: customColor }]}>
              <View style={styles.coverPreviewSpine} />
            </View>
            <View style={styles.previewInfo}>
              <Text numberOfLines={1} style={[styles.previewTitle, isNight && styles.darkTitle]}>
                {customTitle.trim() || 'Título da obra'}
              </Text>
              <Text numberOfLines={1} style={[styles.previewAuthor, isNight && styles.darkMutedText]}>
                {customAuthor.trim() || 'Autor(a)'}
              </Text>
              <Text style={[styles.previewPages, isNight && styles.darkMutedText]}>
                {customPages ? `${customPages} páginas` : '0 páginas'}
              </Text>
            </View>
          </View>

          <PrimaryButton
            disabled={!customTitle.trim() || !validPages}
            label="Adicionar à Biblioteca"
            onPress={handleCreateCustom}
          />
        </View>
      ) : (
        /* Busca e Catálogo */
        <>
          <View style={[styles.searchWrap, isNight && styles.darkSearchWrap]}>
            <Ionicons color={isNight ? '#FFAE70' : colors.muted} name="search" size={20} />
            <TextInput
              accessibilityLabel="Buscar por título, autor ou ISBN"
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              onChangeText={setQuery}
              placeholder="Buscar por título ou autor…"
              placeholderTextColor={isNight ? darkTheme.textSubtle : colors.muted}
              returnKeyType="search"
              style={[styles.searchInput, isNight && styles.darkSearchInput]}
              value={query}
            />
            {status === 'loading' && query.trim().length >= 2 ? (
              <ActivityIndicator color={isNight ? '#FFAE70' : colors.terracotta} size="small" />
            ) : null}
          </View>

          {/* Título da seção */}
          <View style={styles.sectionHeaderRow}>
            <Text selectable style={[styles.sectionTitle, isNight && styles.darkSectionTitle]}>
              {isSearching ? `Resultados para "${query.trim()}"` : 'Sugestões para sua estante'}
            </Text>
          </View>

          {status === 'loading' && results.length === 0 ? (
            <View style={[styles.emptyState, isNight && styles.darkCard]}>
              <ActivityIndicator color={isNight ? '#FFAE70' : colors.terracotta} />
              <Text selectable style={[styles.emptyText, isNight && styles.darkMutedText]}>
                Consultando acervo literário…
              </Text>
            </View>
          ) : status === 'error' && results.length === 0 ? (
            <View style={[styles.emptyState, isNight && styles.darkCard]}>
              <Ionicons color={colors.sage} name="book-outline" size={38} />
              <Text selectable style={[styles.emptyTitle, isNight && styles.darkTitle]}>
                Não foi possível consultar o acervo
              </Text>
              <Text selectable style={[styles.emptyText, isNight && styles.darkMutedText]}>
                {error}
              </Text>
              <PrimaryButton label="Tentar novamente" onPress={retry} />
              <PrimaryButton label="Cadastrar manualmente" onPress={startCustomWithQuery} tone="secondary" />
            </View>
          ) : results.length === 0 && !isSearching ? (
            <View style={[styles.emptyState, isNight && styles.darkCard]}>
              <Ionicons color={colors.sage} name="book-outline" size={38} />
              <Text selectable style={[styles.emptyText, isNight && styles.darkMutedText]}>
                Nenhum livro disponível no momento.
              </Text>
            </View>
          ) : results.length === 0 && isSearching && status !== 'loading' ? (
            <View style={[styles.emptyState, isNight && styles.darkCard]}>
              <Ionicons color={colors.sage} name="book-outline" size={38} />
              <Text selectable style={[styles.emptyTitle, isNight && styles.darkTitle]}>
                Nenhum resultado encontrado
              </Text>
              <Text selectable style={[styles.emptyText, isNight && styles.darkMutedText]}>
                Deseja cadastrar &quot;{query}&quot; manualmente para sua mesa?
              </Text>
              <PrimaryButton
                label={`Criar "${query.slice(0, 22)}..."`}
                onPress={startCustomWithQuery}
              />
            </View>
          ) : (
            <View style={styles.list}>
              {results.map((book) => {
                const added = addedIds.has(book.workKey);
                const bookColor = deriveBookColor(book.workKey);

                return (
                  <Pressable
                    key={book.workKey}
                    accessibilityHint={added ? 'Livro já está na sua biblioteca' : 'Toque para adicionar à biblioteca'}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: added }}
                    disabled={added}
                    onPress={() => selectCatalogBook(book)}
                    style={({ pressed }) => [
                      styles.bookRow,
                      isNight && styles.darkCard,
                      added && styles.bookRowDisabled,
                      pressed && styles.pressed,
                    ]}
                  >
                    <BookCover color={bookColor} coverUrl={book.coverUrl} style={styles.cover}>
                      <View style={styles.coverSpine} />
                    </BookCover>

                    {/* Informações da obra */}
                    <View style={styles.bookInfo}>
                      <Text
                        numberOfLines={2}
                        selectable
                        style={[styles.bookTitle, isNight && styles.darkTitle]}
                      >
                        {book.title}
                      </Text>
                      <Text
                        numberOfLines={1}
                        selectable
                        style={[styles.bookAuthor, isNight && styles.darkMutedText]}
                      >
                        {book.author}
                      </Text>
                      <View style={styles.bookMetaRow}>
                        <Text
                          selectable
                          style={[styles.bookMetaText, isNight && styles.darkMutedText]}
                        >
                          {book.totalPages ? `${book.totalPages} págs.` : 'Páginas a definir'}
                          {book.firstPublishYear ? ` · ${book.firstPublishYear}` : ''}
                        </Text>
                      </View>
                    </View>

                    {/* Ação / Status */}
                    {added ? (
                      <View style={[styles.addedMark, isNight && styles.darkAddedMark]}>
                        <Ionicons color={isNight ? '#78C296' : colors.sage} name="checkmark" size={14} />
                        <Text style={[styles.addedText, isNight && styles.darkAddedText]}>Na biblioteca</Text>
                      </View>
                    ) : (
                      <View style={[styles.addBtn, isNight && styles.darkAddBtn]}>
                        <Ionicons color={isNight ? '#FFAE70' : colors.terracotta} name="add" size={18} />
                      </View>
                    )}
                  </Pressable>
                );
              })}

              {loadMoreError ? (
                <Text selectable style={[styles.emptyText, isNight && styles.darkMutedText]}>
                  {loadMoreError}
                </Text>
              ) : null}

              {hasMore ? (
                <PrimaryButton
                  label="Carregar mais resultados"
                  loading={status === 'loadingMore'}
                  onPress={loadMore}
                  tone="secondary"
                />
              ) : null}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: '100%',
    minHeight: '100%',
    backgroundColor: colors.cream,
  },
  darkScreen: {
    backgroundColor: darkTheme.bg,
  },
  content: {
    gap: 16,
    padding: 18,
    paddingBottom: 48,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginTop: 2,
  },
  sheetHeaderTitles: {
    flex: 1,
    gap: 3,
  },
  sheetTitle: {
    fontFamily: typography.editorial,
    fontSize: 22,
    fontWeight: '600',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  darkSheetTitle: {
    color: '#FAF4EB',
  },
  sheetSubtitle: {
    fontSize: 13,
    color: colors.muted,
  },
  darkSheetSubtitle: {
    color: '#9EA3B0',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkCloseBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeBtnPressed: {
    opacity: 0.6,
    transform: [{ scale: 0.94 }],
  },
  tabToggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.softFill,
    padding: 3,
    borderRadius: radii.full,
  },
  darkTabToggleRow: {
    backgroundColor: darkTheme.surfaceElevated,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: radii.full,
  },
  toggleBtnActive: {
    backgroundColor: colors.white,
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.06)',
  },
  toggleBtnActiveNight: {
    backgroundColor: darkTheme.surface,
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
  },
  toggleBtnText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '500',
  },
  toggleBtnTextActive: {
    color: colors.ink,
    fontWeight: '600',
  },
  toggleBtnTextActiveNight: {
    color: darkTheme.text,
    fontWeight: '600',
  },
  searchWrap: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: radii.full,
    backgroundColor: colors.softFill,
  },
  darkSearchWrap: {
    backgroundColor: darkTheme.surfaceElevated,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    color: colors.ink,
    fontSize: 15,
  },
  darkSearchInput: {
    color: darkTheme.text,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  darkSectionTitle: {
    color: darkTheme.textMuted,
  },
  list: {
    gap: 8,
  },
  bookRow: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    borderRadius: radii.medium,
    borderCurve: 'continuous',
    backgroundColor: colors.paper,
    boxShadow: '0 2px 6px rgba(50, 37, 31, 0.03)',
  },
  bookRowDisabled: {
    opacity: 0.58,
  },
  pressed: {
    opacity: 0.75,
  },
  cover: {
    width: 44,
    height: 64,
    borderRadius: 4,
    borderCurve: 'continuous',
    justifyContent: 'center',
    overflow: 'hidden',
    boxShadow: '0 3px 8px rgba(0, 0, 0, 0.12)',
  },
  coverSpine: {
    width: 3,
    height: '100%',
    marginLeft: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  bookInfo: {
    flex: 1,
    gap: 2,
  },
  bookTitle: {
    color: colors.ink,
    fontFamily: typography.editorial,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
  },
  bookAuthor: {
    color: colors.muted,
    fontSize: 13,
  },
  bookMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  bookMetaText: {
    color: colors.mutedLight,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.1,
  },
  addedMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radii.small,
    backgroundColor: colors.sageSoft,
  },
  darkAddedMark: {
    backgroundColor: 'rgba(120, 194, 150, 0.16)',
  },
  addedText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.sage,
  },
  darkAddedText: {
    color: '#78C296',
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.terracottaSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkAddBtn: {
    backgroundColor: 'rgba(255, 174, 112, 0.15)',
  },
  emptyState: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 36,
    paddingHorizontal: 20,
    backgroundColor: colors.paper,
    borderRadius: radii.large,
    borderCurve: 'continuous',
  },
  emptyTitle: {
    color: colors.ink,
    fontFamily: typography.editorial,
    fontSize: 18,
    textAlign: 'center',
    fontWeight: '600',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 6,
  },
  formContainer: {
    gap: 16,
    padding: 18,
    borderRadius: radii.large,
    borderCurve: 'continuous',
    backgroundColor: colors.paper,
    boxShadow: '0 2px 8px rgba(50, 37, 31, 0.04)',
  },
  formSectionTitle: {
    color: colors.ink,
    fontFamily: typography.editorial,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  darkLabel: {
    color: darkTheme.textMuted,
  },
  textInput: {
    minHeight: 46,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.ink,
    borderRadius: radii.small,
    borderCurve: 'continuous',
    backgroundColor: colors.softFill,
  },
  darkTextInput: {
    backgroundColor: darkTheme.inputBg,
    color: darkTheme.text,
  },
  paletteRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  colorSwatch: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.12)',
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: colors.white,
    transform: [{ scale: 1.1 }],
  },
  previewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    borderRadius: radii.medium,
    borderCurve: 'continuous',
    backgroundColor: colors.softFill,
    marginTop: 6,
  },
  darkPreviewBox: {
    backgroundColor: darkTheme.inputBg,
  },
  coverPreview: {
    width: 38,
    height: 54,
    borderRadius: 4,
    borderCurve: 'continuous',
    justifyContent: 'center',
    overflow: 'hidden',
    boxShadow: '0 2px 6px rgba(0,0,0,0.14)',
  },
  coverPreviewSpine: {
    width: 3,
    height: '100%',
    marginLeft: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  previewInfo: {
    flex: 1,
    gap: 2,
  },
  previewTitle: {
    color: colors.ink,
    fontFamily: typography.editorial,
    fontSize: 15,
    fontWeight: '600',
  },
  previewAuthor: {
    color: colors.muted,
    fontSize: 13,
  },
  previewPages: {
    color: colors.terracotta,
    fontSize: 12,
    fontWeight: '600',
  },
  darkCard: {
    backgroundColor: darkTheme.surface,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
  },
  darkTitle: {
    color: '#FAF4EB',
  },
  darkMutedText: {
    color: darkTheme.textMuted,
  },
});
