import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/src/components/primary-button';
import { mockBooks } from '@/src/data/mock-books';
import { useLibraryStore } from '@/src/store/library-store';
import { colors, radii } from '@/src/theme';

const PALETTE = [
  '#B95F3B', // Terracotta
  '#4F7480', // Azul ardósia
  '#6D7657', // Verde sálvia escuro
  '#6A4D61', // Vinho / ameixa
  '#C58A3C', // Mostarda quente
  '#2E4057', // Azul petróleo profundo
];

const normalize = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

export default function AddBookScreen() {
  const [query, setQuery] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);

  // Campos do livro personalizado
  const [customTitle, setCustomTitle] = useState('');
  const [customAuthor, setCustomAuthor] = useState('');
  const [customPages, setCustomPages] = useState('200');
  const [customColor, setCustomColor] = useState(PALETTE[0]);

  const books = useLibraryStore((state) => state.books);
  const addBook = useLibraryStore((state) => state.addBook);
  const addCustomBook = useLibraryStore((state) => state.addCustomBook);

  const addedIds = useMemo(() => new Set(books.map((book) => book.id)), [books]);

  const filtered = useMemo(() => {
    const value = normalize(query.trim());
    return value ? mockBooks.filter((book) => normalize(`${book.title} ${book.author}`).includes(value)) : mockBooks;
  }, [query]);

  const selectCatalogBook = (bookId: string) => {
    if (addedIds.has(bookId)) return;
    addBook(bookId);
    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const handleCreateCustom = () => {
    if (!customTitle.trim()) return;
    const pages = Number(customPages.replace(/\D/g, '')) || 150;
    addCustomBook({
      title: customTitle.trim(),
      author: customAuthor.trim() || 'Autor desconhecido',
      coverColor: customColor,
      totalPages: pages,
    });
    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const startCustomWithQuery = () => {
    setCustomTitle(query.trim());
    setShowCustomForm(true);
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      style={styles.screen}
    >
      {/* Alternador entre Catálogo e Criar */}
      <View style={styles.tabToggleRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowCustomForm(false)}
          style={[styles.toggleBtn, !showCustomForm && styles.toggleBtnActive]}
        >
          <Text style={[styles.toggleBtnText, !showCustomForm && styles.toggleBtnTextActive]}>
            Catálogo sugerido
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowCustomForm(true)}
          style={[styles.toggleBtn, showCustomForm && styles.toggleBtnActive]}
        >
          <Text style={[styles.toggleBtnText, showCustomForm && styles.toggleBtnTextActive]}>
            Criar manualmente
          </Text>
        </Pressable>
      </View>

      {showCustomForm ? (
        /* Formulário de criação personalizada */
        <View style={styles.formContainer}>
          <Text selectable style={styles.formSectionTitle}>Novo livro para sua mesa</Text>

          <View style={styles.fieldGroup}>
            <Text selectable style={styles.label}>Título da obra *</Text>
            <TextInput
              autoCapitalize="sentences"
              onChangeText={setCustomTitle}
              placeholder="Ex: Cem Anos de Solidão"
              placeholderTextColor={colors.muted}
              style={styles.textInput}
              value={customTitle}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text selectable style={styles.label}>Autor(a)</Text>
            <TextInput
              autoCapitalize="words"
              onChangeText={setCustomAuthor}
              placeholder="Ex: Gabriel García Márquez"
              placeholderTextColor={colors.muted}
              style={styles.textInput}
              value={customAuthor}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text selectable style={styles.label}>Número total de páginas</Text>
            <TextInput
              keyboardType="number-pad"
              maxLength={5}
              onChangeText={setCustomPages}
              placeholder="Ex: 350"
              placeholderTextColor={colors.muted}
              style={styles.textInput}
              value={customPages}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text selectable style={styles.label}>Cor da capa 3D</Text>
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

          <View style={styles.previewBox}>
            <View style={[styles.coverPreview, { backgroundColor: customColor }]}>
              <View style={styles.coverPreviewSpine} />
            </View>
            <View style={styles.previewInfo}>
              <Text numberOfLines={1} style={styles.previewTitle}>
                {customTitle.trim() || 'Título do livro'}
              </Text>
              <Text numberOfLines={1} style={styles.previewAuthor}>
                {customAuthor.trim() || 'Nome do autor'}
              </Text>
              <Text style={styles.previewPages}>
                {customPages ? `${customPages} páginas` : '0 páginas'}
              </Text>
            </View>
          </View>

          <PrimaryButton
            disabled={!customTitle.trim()}
            label="Adicionar à Biblioteca"
            onPress={handleCreateCustom}
          />
        </View>
      ) : (
        /* Busca no Catálogo */
        <>
          <View style={styles.searchWrap}>
            <Ionicons color={colors.muted} name="search" size={20} />
            <TextInput
              accessibilityLabel="Buscar por título ou autor"
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              onChangeText={setQuery}
              placeholder="Buscar por título ou autor…"
              placeholderTextColor={colors.muted}
              returnKeyType="search"
              style={styles.searchInput}
              value={query}
            />
          </View>

          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons color={colors.sage} name="book-outline" size={38} />
              <Text selectable style={styles.emptyTitle}>Livro não encontrado no catálogo</Text>
              <Text selectable style={styles.emptyText}>
                Quer cadastrar &quot;{query}&quot; manualmente para sua mesa?
              </Text>
              <PrimaryButton
                label={`Criar "${query.slice(0, 20)}..."`}
                onPress={startCustomWithQuery}
              />
            </View>
          ) : (
            <View style={styles.list}>
              {filtered.map((book) => {
                const added = addedIds.has(book.id);
                return (
                  <Pressable
                    key={book.id}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: added }}
                    disabled={added}
                    onPress={() => selectCatalogBook(book.id)}
                    style={({ pressed }) => [
                      styles.bookRow,
                      added && styles.bookRowDisabled,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={[styles.cover, { backgroundColor: book.coverColor }]}>
                      <View style={styles.coverPage} />
                    </View>
                    <View style={styles.bookInfo}>
                      <Text selectable numberOfLines={2} style={styles.bookTitle}>
                        {book.title}
                      </Text>
                      <Text selectable style={styles.bookAuthor}>{book.author}</Text>
                      <Text selectable style={styles.pageCount}>{book.totalPages} páginas</Text>
                    </View>
                    {added ? (
                      <View style={styles.addedMark}>
                        <Ionicons color={colors.sage} name="checkmark" size={18} />
                      </View>
                    ) : (
                      <Ionicons color={colors.terracotta} name="add-circle-outline" size={26} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { gap: 16, padding: 16, paddingBottom: 48 },
  tabToggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.paper,
    padding: 4,
    borderRadius: radii.medium,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.line,
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
  toggleBtnText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  toggleBtnTextActive: {
    color: colors.white,
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
  searchInput: { flex: 1, minHeight: 48, color: colors.ink, fontSize: 16 },
  list: { gap: 10 },
  bookRow: {
    minHeight: 90,
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
  bookRowDisabled: { opacity: 0.55 },
  pressed: { opacity: 0.72 },
  cover: {
    width: 44,
    height: 64,
    justifyContent: 'center',
    borderRadius: 4,
    borderCurve: 'continuous',
    boxShadow: '0 3px 6px rgba(53, 42, 36, 0.14)',
  },
  coverPage: { width: 3, height: 50, marginLeft: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)' },
  bookInfo: { flex: 1, gap: 2 },
  bookTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 16, lineHeight: 20, fontWeight: '700' },
  bookAuthor: { color: colors.muted, fontSize: 13 },
  pageCount: { color: colors.sage, fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  addedMark: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderCurve: 'continuous',
    backgroundColor: colors.sageSoft,
  },
  emptyState: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 44,
    paddingHorizontal: 20,
    backgroundColor: colors.paper,
    borderRadius: radii.large,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.line,
  },
  emptyTitle: { color: colors.ink, fontFamily: 'Georgia', fontSize: 20, textAlign: 'center' },
  emptyText: { color: colors.muted, fontSize: 14, textAlign: 'center', marginBottom: 6 },
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
});
