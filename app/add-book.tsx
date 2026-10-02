import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BookCover } from '@/src/components/book-cover';
import { PrimaryButton } from '@/src/components/primary-button';
import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { bookCatalogClient } from '@/src/services/book-catalog';
import { extractCoverColor } from '@/src/services/cover-color';
import { deriveBookColor, useLibraryStore } from '@/src/store/library-store';
import { controls, colors, darkTheme, radii, typography } from '@/src/theme';
import type { BookSearchResult } from '@/src/types/book';

const PALETTE = ['#B95F3B', '#4F7480', '#6D7657', '#6A4D61', '#C58A3C', '#2E4057'];

export default function AddBookScreen() {
  const {
    catalogAuthor,
    catalogCoverId,
    catalogCoverUrl,
    catalogEditionKey,
    catalogWorkKey,
    catalogYear,
    shelfId,
    status,
    query: initialQuery,
  } = useLocalSearchParams<{
    catalogAuthor?: string;
    catalogCoverId?: string;
    catalogCoverUrl?: string;
    catalogEditionKey?: string;
    catalogWorkKey?: string;
    catalogYear?: string;
    shelfId?: string;
    status?: string;
    query?: string;
  }>();
  const initialCatalogResult = useMemo<BookSearchResult | undefined>(() => {
    if (!catalogWorkKey || typeof initialQuery !== 'string') return undefined;
    const coverId = Number(catalogCoverId);
    const firstPublishYear = Number(catalogYear);
    return {
      workKey: catalogWorkKey,
      title: initialQuery,
      author: catalogAuthor || 'Autor desconhecido',
      ...(catalogEditionKey ? { editionKey: catalogEditionKey } : {}),
      ...(Number.isInteger(coverId) && coverId > 0 ? { coverId } : {}),
      ...(catalogCoverUrl ? { coverUrl: catalogCoverUrl } : {}),
      ...(Number.isInteger(firstPublishYear) && firstPublishYear > 0 ? { firstPublishYear } : {}),
    };
  }, [catalogAuthor, catalogCoverId, catalogCoverUrl, catalogEditionKey, catalogWorkKey, catalogYear, initialQuery]);

  const [customTitle, setCustomTitle] = useState(initialCatalogResult?.title ?? (typeof initialQuery === 'string' ? initialQuery : ''));
  const [customAuthor, setCustomAuthor] = useState(
    initialCatalogResult?.author === 'Autor desconhecido' ? '' : initialCatalogResult?.author ?? '',
  );
  const [customIsbn, setCustomIsbn] = useState('');
  const [customPages, setCustomPages] = useState('');
  const [customColor, setCustomColor] = useState(
    initialCatalogResult ? deriveBookColor(initialCatalogResult.workKey) : PALETTE[0],
  );

  const addOpenLibraryBook = useLibraryStore((state) => state.addOpenLibraryBook);
  const addCustomBook = useLibraryStore((state) => state.addCustomBook);
  const updateBookCoverColor = useLibraryStore((state) => state.updateBookCoverColor);
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const isNight = resolveAmbience(ambienceMode) === 'night';
  const parsedPages = Number(customPages);
  const validPages = Number.isInteger(parsedPages) && parsedPages >= 1 && parsedPages <= 99_999;
  const targetStatus = status === 'want-to-read' ? 'want-to-read' : 'reading';

  const handleAdd = () => {
    if (!customTitle.trim() || !validPages) return;

    if (initialCatalogResult) {
      const catalogBook = {
        ...initialCatalogResult,
        title: customTitle.trim(),
        author: customAuthor.trim() || 'Autor desconhecido',
        totalPages: parsedPages,
      };
      addOpenLibraryBook(catalogBook, { shelfId, status: targetStatus });
      void bookCatalogClient.upsertBook({ result: catalogBook, totalPagesSource: 'user' }).catch(() => undefined);
      if (catalogBook.coverUrl) {
        void extractCoverColor(catalogBook.coverUrl).then((color) => {
          if (color) updateBookCoverColor(catalogBook.workKey, color);
        });
      }
    } else {
      addCustomBook({
        title: customTitle.trim(),
        author: customAuthor.trim() || 'Autor desconhecido',
        coverColor: customColor,
        totalPages: parsedPages,
        ...(customIsbn.trim() ? { isbn: customIsbn.trim() } : {}),
      }, shelfId, targetStatus);
    }

    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={[styles.screen, isNight && styles.darkScreen]}
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, isNight && styles.darkTitle]}>Adicionar livro</Text>
          <Text style={[styles.subtitle, isNight && styles.darkMuted]}>
            {initialCatalogResult ? 'Só falta informar o total de páginas.' : 'Inclua um livro que ainda não está no catálogo.'}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Fechar"
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => router.back()}
          style={[styles.closeButton, isNight && styles.darkCloseButton]}
        >
          <Ionicons color={isNight ? darkTheme.text : colors.ink} name="close" size={20} />
        </Pressable>
      </View>

      <View style={[styles.form, isNight && styles.darkForm]}>
        <Text style={[styles.sectionTitle, isNight && styles.darkTitle]}>
          {initialCatalogResult ? 'Detalhes da edição' : 'Detalhes do livro'}
        </Text>
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, isNight && styles.darkMuted]}>Título *</Text>
          <TextInput
            autoCapitalize="sentences"
            onChangeText={setCustomTitle}
            placeholder="Ex.: Cem Anos de Solidão"
            placeholderTextColor={isNight ? darkTheme.textSubtle : colors.mutedLight}
            style={[styles.input, isNight && styles.darkInput]}
            value={customTitle}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, isNight && styles.darkMuted]}>Autor(a)</Text>
          <TextInput
            autoCapitalize="words"
            onChangeText={setCustomAuthor}
            placeholder="Nome do autor"
            placeholderTextColor={isNight ? darkTheme.textSubtle : colors.mutedLight}
            style={[styles.input, isNight && styles.darkInput]}
            value={customAuthor}
          />
        </View>
        {!initialCatalogResult ? (
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, isNight && styles.darkMuted]}>ISBN (opcional)</Text>
            <TextInput
              autoCapitalize="characters"
              autoCorrect={false}
              onChangeText={setCustomIsbn}
              placeholder="Ex.: 9780140328721"
              placeholderTextColor={isNight ? darkTheme.textSubtle : colors.mutedLight}
              style={[styles.input, isNight && styles.darkInput]}
              value={customIsbn}
            />
          </View>
        ) : null}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, isNight && styles.darkMuted]}>Total de páginas *</Text>
          <TextInput
            keyboardType="number-pad"
            maxLength={5}
            onChangeText={setCustomPages}
            placeholder="Ex.: 350"
            placeholderTextColor={isNight ? darkTheme.textSubtle : colors.mutedLight}
            style={[styles.input, isNight && styles.darkInput]}
            value={customPages}
          />
        </View>

        {!initialCatalogResult ? (
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, isNight && styles.darkMuted]}>Cor do livro na sala</Text>
            <View style={styles.palette}>
              {PALETTE.map((color) => {
                const selected = customColor === color;
                return (
                  <Pressable
                    key={color}
                    accessibilityLabel={`Selecionar cor ${color}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
                      setCustomColor(color);
                    }}
                    style={[styles.swatch, { backgroundColor: color }, selected && styles.selectedSwatch]}
                  >
                    {selected ? <Ionicons color="#FFFFFF" name="checkmark" size={18} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={[styles.preview, isNight && styles.darkPreview]}>
          <BookCover
            color={initialCatalogResult ? deriveBookColor(initialCatalogResult.workKey) : customColor}
            coverUrl={initialCatalogResult?.coverUrl}
            style={styles.previewCover}
          />
          <View style={styles.previewCopy}>
            <Text numberOfLines={2} style={[styles.previewTitle, isNight && styles.darkTitle]}>{customTitle.trim() || 'Título do livro'}</Text>
            <Text numberOfLines={1} style={[styles.previewAuthor, isNight && styles.darkMuted]}>{customAuthor.trim() || 'Autor(a)'}</Text>
            <Text style={[styles.previewPages, isNight && styles.darkMuted]}>{customPages ? `${customPages} páginas` : 'Páginas a definir'}</Text>
          </View>
        </View>
        <PrimaryButton disabled={!customTitle.trim() || !validPages} label="Adicionar à biblioteca" onPress={handleAdd} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  darkScreen: { backgroundColor: darkTheme.bg },
  content: { gap: 18, padding: 20, paddingBottom: 44 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 4 },
  headerCopy: { flex: 1, gap: 4 },
  title: { color: colors.ink, fontFamily: typography.editorial, fontSize: 24 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 19 },
  closeButton: { ...controls.iconButton, backgroundColor: colors.softFill },
  darkCloseButton: { backgroundColor: darkTheme.surfaceElevated },
  form: { gap: 18, padding: 18, borderRadius: radii.large, borderCurve: 'continuous', backgroundColor: colors.paper },
  darkForm: { backgroundColor: darkTheme.surface },
  sectionTitle: { color: colors.ink, fontFamily: typography.editorial, fontSize: 19 },
  fieldGroup: { gap: 7 },
  label: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  input: { ...controls.input, borderColor: colors.line, color: colors.ink, backgroundColor: colors.paper },
  darkInput: { color: darkTheme.text, borderColor: darkTheme.inputBorder, backgroundColor: darkTheme.inputBg },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  selectedSwatch: { borderWidth: 2, borderColor: colors.ink },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 14, borderCurve: 'continuous', backgroundColor: colors.softFill },
  darkPreview: { backgroundColor: darkTheme.surfaceElevated },
  previewCover: { width: 46, height: 66, borderRadius: 4, borderCurve: 'continuous' },
  previewCopy: { flex: 1, gap: 4 },
  previewTitle: { color: colors.ink, fontFamily: typography.editorial, fontSize: 16 },
  previewAuthor: { color: colors.muted, fontSize: 13 },
  previewPages: { color: colors.muted, fontSize: 12 },
  darkTitle: { color: darkTheme.text },
  darkMuted: { color: darkTheme.textMuted },
});
