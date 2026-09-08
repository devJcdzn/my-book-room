import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BookCover } from '@/src/components/book-cover';
import { PrimaryButton } from '@/src/components/primary-button';
import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { useBookSearch } from '@/src/hooks/use-book-search';
import { extractCoverColor } from '@/src/services/cover-color';
import { deriveBookColor, useLibraryStore } from '@/src/store/library-store';
import { colors, darkTheme, radii } from '@/src/theme';
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
    addOpenLibraryBook({ ...book, totalPages: book.totalPages });
    updateCoverColor(book);
    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const handleCreateCustom = () => {
    if (!customTitle.trim() || !validPages) return;
    if (pendingResult) {
      addOpenLibraryBook({
        ...pendingResult,
        title: customTitle.trim(),
        author: customAuthor.trim() || 'Autor desconhecido',
        totalPages: parsedPages,
      });
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
              <Text style={[styles.previewPages, isNight && styles.darkPageCount]}>
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
              {isSearching ? `Resultados para "${query.trim()}"` : 'Tendências do dia'}
            </Text>
            {!isSearching ? (
              <Text style={[styles.sectionBadge, isNight && styles.darkSectionBadge]}>
                Catálogo online
              </Text>
            ) : null}
          </View>

          {status === 'loading' && results.length === 0 ? (
            <View style={[styles.emptyState, isNight && styles.darkCard]}>
              <ActivityIndicator color={isNight ? '#FFAE70' : colors.terracotta} />
              <Text selectable style={[styles.emptyText, isNight && styles.darkMutedText]}>
                Carregando catálogo…
              </Text>
            </View>
          ) : status === 'error' && results.length === 0 ? (
            <View style={[styles.emptyState, isNight && styles.darkCard]}>
              <Ionicons color={colors.sage} name="cloud-offline-outline" size={38} />
              <Text selectable style={[styles.emptyTitle, isNight && styles.darkTitle]}>
                Catálogo online indisponível
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
                        <View style={[styles.pageBadge, isNight && styles.darkPageBadge]}>
                          <Text
                            selectable
                            style={[styles.pageCount, isNight && styles.darkPageCount]}
                          >
                            {book.totalPages ? `${book.totalPages} páginas` : 'Páginas a definir'}
                          </Text>
                        </View>
                        {book.firstPublishYear ? (
                          <Text style={[styles.yearText, isNight && styles.darkMutedText]}>
                            {book.firstPublishYear}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    {/* Ação / Status */}
                    {added ? (
                      <View style={[styles.addedMark, isNight && styles.darkAddedMark]}>
                        <Ionicons color={isNight ? '#78C296' : colors.sage} name="checkmark" size={16} />
                        <Text style={[styles.addedText, isNight && styles.darkAddedText]}>Na mesa</Text>
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
    paddingVertical: 4,
    marginTop: 4,
  },
  sheetHeaderTitles: {
    flex: 1,
    gap: 2,
  },
  sheetTitle: {
    fontFamily: 'Georgia',
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
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
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkCloseBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  closeBtnPressed: {
    opacity: 0.6,
    transform: [{ scale: 0.94 }],
  },
  tabToggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.paper,
    padding: 4,
    borderRadius: radii.medium,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.line,
  },
  darkTabToggleRow: {
    backgroundColor: darkTheme.surface,
    borderColor: darkTheme.border,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: radii.small,
    borderCurve: 'continuous',
  },
  toggleBtnActive: {
    backgroundColor: colors.terracotta,
  },
  toggleBtnActiveNight: {
    backgroundColor: '#FFAE70',
  },
  toggleBtnText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  toggleBtnTextActive: {
    color: colors.white,
    fontWeight: '700',
  },
  toggleBtnTextActiveNight: {
    color: '#131520',
    fontWeight: '700',
  },
  searchWrap: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.medium,
    borderCurve: 'continuous',
    backgroundColor: colors.paper,
  },
  darkSearchWrap: {
    backgroundColor: darkTheme.surface,
    borderColor: darkTheme.border,
  },
  searchInput: {
    flex: 1,
    minHeight: 48,
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
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  darkSectionTitle: {
    color: '#FAF4EB',
  },
  sectionBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.terracotta,
    backgroundColor: 'rgba(185, 95, 59, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  darkSectionBadge: {
    color: '#FFAE70',
    backgroundColor: 'rgba(255, 174, 112, 0.12)',
  },
  list: {
    gap: 10,
  },
  bookRow: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.medium,
    borderCurve: 'continuous',
    backgroundColor: colors.paper,
    boxShadow: '0 2px 6px rgba(53, 42, 36, 0.04)',
  },
  bookRowDisabled: {
    opacity: 0.62,
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
    boxShadow: '0 3px 6px rgba(0, 0, 0, 0.14)',
  },
  coverSpine: {
    width: 3,
    height: 52,
    marginLeft: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  bookInfo: {
    flex: 1,
    gap: 3,
  },
  bookTitle: {
    color: colors.ink,
    fontFamily: 'Georgia',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  bookAuthor: {
    color: colors.muted,
    fontSize: 13,
  },
  bookMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  pageBadge: {
    backgroundColor: colors.sageSoft,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  darkPageBadge: {
    backgroundColor: 'rgba(255, 174, 112, 0.12)',
  },
  pageCount: {
    color: colors.sage,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  darkPageCount: {
    color: '#FFAE70',
  },
  yearText: {
    fontSize: 11,
    color: colors.muted,
  },
  addedMark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderCurve: 'continuous',
    backgroundColor: colors.sageSoft,
  },
  darkAddedMark: {
    backgroundColor: 'rgba(120, 194, 150, 0.16)',
  },
  addedText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.sage,
  },
  darkAddedText: {
    color: '#78C296',
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(185, 95, 59, 0.08)',
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
    borderWidth: 1,
    borderColor: colors.line,
  },
  emptyTitle: {
    color: colors.ink,
    fontFamily: 'Georgia',
    fontSize: 18,
    textAlign: 'center',
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
    borderWidth: 1,
    borderColor: colors.line,
  },
  formSectionTitle: {
    color: colors.ink,
    fontFamily: 'Georgia',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  darkLabel: {
    color: '#FAF4EB',
  },
  textInput: {
    minHeight: 46,
    paddingHorizontal: 12,
    fontSize: 15,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.small,
    borderCurve: 'continuous',
    backgroundColor: colors.white,
  },
  darkTextInput: {
    backgroundColor: darkTheme.inputBg,
    borderColor: darkTheme.inputBorder,
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
    boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
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
    backgroundColor: colors.cream,
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
    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
  },
  coverPreviewSpine: {
    width: 3,
    height: 44,
    marginLeft: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  previewInfo: {
    flex: 1,
    gap: 2,
  },
  previewTitle: {
    color: colors.ink,
    fontFamily: 'Georgia',
    fontSize: 15,
    fontWeight: '700',
  },
  previewAuthor: {
    color: colors.muted,
    fontSize: 13,
  },
  previewPages: {
    color: colors.sage,
    fontSize: 12,
    fontWeight: '700',
  },
  darkCard: {
    backgroundColor: darkTheme.surface,
    borderColor: darkTheme.border,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
  },
  darkTitle: {
    color: '#FAF4EB',
  },
  darkMutedText: {
    color: darkTheme.textMuted,
  },
});
