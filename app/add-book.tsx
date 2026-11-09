import { AppTextInput, FieldError } from '@/src/components/app-text-input';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BookCover } from '@/src/components/book-cover';
import { PrimaryButton } from '@/src/components/primary-button';
import { resolveAmbience } from '@/src/types/ambience';
import { bookCatalogClient } from '@/src/services/book-catalog';
import { extractCoverColor } from '@/src/services/cover-color';
import { deriveBookColor, useLibraryStore } from '@/src/store/library-store';
import { controls, colors, darkTheme, radii, typography } from '@/src/theme';
import type { BookSearchResult } from '@/src/types/book';

const PALETTE = [
  { color: '#6D7657', label: 'Sálvia' }, { color: '#2E4057', label: 'Azul escuro' },
  { color: '#4F7480', label: 'Azul petróleo' }, { color: '#6A4D61', label: 'Ameixa' },
  { color: '#C58A3C', label: 'Ocre' }, { color: '#B95F3B', label: 'Terracota' },
];

export default function AddBookScreen() {
  const {
    from,
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
    from?: string;
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

  const [focusedField, setFocusedField] = useState<"title" | "author" | "pages" | "isbn">();
  const [customTitle, setCustomTitle] = useState(initialCatalogResult?.title ?? (typeof initialQuery === 'string' ? initialQuery : ''));
  const [customAuthor, setCustomAuthor] = useState(
    initialCatalogResult?.author === 'Autor desconhecido' ? '' : initialCatalogResult?.author ?? '',
  );
  const [customIsbn, setCustomIsbn] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [pagesTouched, setPagesTouched] = useState(false);
  const [customPages, setCustomPages] = useState('');
  const [customColor, setCustomColor] = useState(
    initialCatalogResult ? deriveBookColor(initialCatalogResult.workKey) : PALETTE[0].color,
  );

  const addOpenLibraryBook = useLibraryStore((state) => state.addOpenLibraryBook);
  const addCustomBook = useLibraryStore((state) => state.addCustomBook);
  const updateBookCoverColor = useLibraryStore((state) => state.updateBookCoverColor);
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const isNight = resolveAmbience(ambienceMode) === 'night';
  const accent = isNight ? darkTheme.selectionText : colors.sageDark;
  const inputStyle = (field: typeof focusedField) => [
    styles.input, isNight && styles.darkInput, focusedField === field && { borderColor: accent },
  ];
  const shelfName = useLibraryStore(state => shelfId ? state.shelfNames[shelfId] : undefined);
  const parsedPages = Number(customPages);
  const validPages = Number.isInteger(parsedPages) && parsedPages >= 1 && parsedPages <= 99_999;
  const titleError = titleTouched && !customTitle.trim() ? 'Digite o título do livro.' : undefined;
  const pagesError = pagesTouched && !validPages ? 'Informe um total entre 1 e 99.999 páginas.' : undefined;
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
    if (from === 'onboarding') {
      useLibraryStore.getState().setOnboardingStep(7);
      router.dismissTo('/onboarding');
    } else {
      router.back();
    }
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={[styles.screen, isNight && styles.darkScreen]}
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, isNight && styles.darkTitle]}>Adicionar livro</Text>
          <Text style={[styles.subtitle, isNight && styles.darkMuted]}>
            {initialCatalogResult ? 'Só falta informar o total de páginas.' : 'Cadastro manual'}
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

      <View style={[styles.coverSection, isNight && styles.darkForm]}>
        <View style={[styles.preview, isNight && styles.darkPreview]}>
          <BookCover
            color={initialCatalogResult ? deriveBookColor(initialCatalogResult.workKey) : customColor}
            coverUrl={initialCatalogResult?.coverUrl}
            style={styles.previewCover}
          >
            {!initialCatalogResult?.coverUrl && (
              <Text allowFontScaling={false} numberOfLines={4} style={styles.coverLabel}>{customTitle.trim() || 'Seu livro'}</Text>
            )}
          </BookCover>
          <View style={styles.previewCopy}>
            <Text numberOfLines={2} style={[styles.previewTitle, isNight && styles.darkTitle]}>{customTitle.trim() || 'Título do livro'}</Text>
            <Text numberOfLines={1} style={[styles.previewAuthor, isNight && styles.darkMuted]}>{customAuthor.trim() || 'Autor(a)'}</Text>
            <Text style={[styles.previewPages, isNight && styles.darkMuted]}>{customPages ? `${customPages} páginas` : 'Páginas a definir'}</Text>
          </View>
        </View>
        {!initialCatalogResult ? (
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, isNight && styles.darkMuted]}>Cor da capa</Text>
            <View style={styles.palette}>
              {PALETTE.map(({ color, label }) => {
                const selected = customColor === color;
                return (
                  <Pressable
                    key={color}
                    accessibilityLabel={`Selecionar cor ${label}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
                      setCustomColor(color);
                    }}
                    style={[styles.swatch, { backgroundColor: color }, selected && { borderWidth: 2, borderColor: accent }]}
                  >
                    {selected ? <View style={styles.swatchCheck}><Ionicons color={colors.ink} name="checkmark" size={15} accessible={false} /></View> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </View>

      <View style={[styles.form, isNight && styles.darkForm]}>
        <Text style={[styles.sectionTitle, isNight && styles.darkTitle]}>
          {initialCatalogResult ? 'Detalhes da edição' : 'Detalhes do livro'}
        </Text>
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, isNight && styles.darkMuted]}>Título</Text>
          <AppTextInput
            autoCapitalize="sentences"
            accessibilityLabel="Título"
            invalid={Boolean(titleError)}
            onFocus={() => setFocusedField('title')}
            onBlur={() => { setFocusedField(undefined); setTitleTouched(true); }}
            keyboardAppearance={isNight ? 'dark' : 'light'}
            selectionColor={accent}
            onChangeText={setCustomTitle}
            placeholder="Ex.: Cem Anos de Solidão"
            placeholderTextColor={isNight ? darkTheme.textSubtle : colors.mutedLight}
            style={inputStyle('title')}
            value={customTitle}
          />
          <FieldError isNight={isNight} message={titleError} />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, isNight && styles.darkMuted]}>Autor(a) · opcional</Text>
          <AppTextInput
            autoCapitalize="words"
            accessibilityLabel="Autor ou autora"
            onFocus={() => setFocusedField('author')}
            onBlur={() => setFocusedField(undefined)}
            keyboardAppearance={isNight ? 'dark' : 'light'}
            selectionColor={accent}
            onChangeText={setCustomAuthor}
            placeholder="Nome do autor"
            placeholderTextColor={isNight ? darkTheme.textSubtle : colors.mutedLight}
            style={inputStyle('author')}
            value={customAuthor}
          />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, isNight && styles.darkMuted]}>Total de páginas</Text>
          <AppTextInput
            keyboardType="number-pad"
            maxLength={5}
            accessibilityLabel="Total de páginas"
            invalid={Boolean(pagesError)}
            onFocus={() => setFocusedField('pages')}
            onBlur={() => { setFocusedField(undefined); setPagesTouched(true); }}
            keyboardAppearance={isNight ? 'dark' : 'light'}
            selectionColor={accent}
            onChangeText={setCustomPages}
            placeholder="Ex.: 350"
            placeholderTextColor={isNight ? darkTheme.textSubtle : colors.mutedLight}
            style={inputStyle('pages')}
            value={customPages}
          />
          <FieldError isNight={isNight} message={pagesError} />
        </View>

        {!initialCatalogResult ? (
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, isNight && styles.darkMuted]}>ISBN (opcional)</Text>
            <AppTextInput
              autoCapitalize="characters"
              autoCorrect={false}
              accessibilityLabel="ISBN opcional"
              onFocus={() => setFocusedField('isbn')}
              onBlur={() => setFocusedField(undefined)}
              keyboardAppearance={isNight ? 'dark' : 'light'}
              selectionColor={accent}
              onChangeText={setCustomIsbn}
              placeholder="Ex.: 9780140328721"
              placeholderTextColor={isNight ? darkTheme.textSubtle : colors.mutedLight}
              style={inputStyle('isbn')}
              value={customIsbn}
            />
          </View>
        ) : null}
        {shelfName ? <Text style={[styles.destination, isNight && styles.darkMuted]}>Destino: {shelfName}</Text> : null}
        <PrimaryButton disabled={!customTitle.trim() || !validPages}
          label="Salvar na prateleira" onPress={handleAdd}
          isNight={isNight} />
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
  coverSection: { padding: 14, gap: 12, backgroundColor: colors.paper, borderRadius: radii.large, borderCurve: 'continuous' },
  form: { gap: 18, padding: 18, borderRadius: radii.large, borderCurve: 'continuous', backgroundColor: colors.paper },
  darkForm: { backgroundColor: darkTheme.surface },
  sectionTitle: { color: colors.ink, fontFamily: typography.editorial, fontSize: 19 },
  fieldGroup: { gap: 7 },
  label: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  input: { ...controls.input, borderRadius: radii.medium, borderCurve: 'continuous', borderColor: colors.line, color: colors.ink, backgroundColor: colors.paper },
  darkInput: { color: darkTheme.text, borderColor: darkTheme.inputBorder, backgroundColor: darkTheme.inputBg },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radii.full },
  swatchCheck: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 14, borderCurve: 'continuous', backgroundColor: colors.softFill },
  darkPreview: { backgroundColor: darkTheme.surfaceElevated },
  previewCover: { width: 84, height: 126, borderRadius: radii.small, borderCurve: 'continuous', justifyContent: 'center', padding: 8 },
  coverLabel: { color: colors.ink, backgroundColor: colors.paper, borderRadius: 4, overflow: 'hidden', padding: 4, fontFamily: typography.editorial, fontSize: 12, textAlign: 'center' },
  previewCopy: { flex: 1, gap: 4 },
  previewTitle: { color: colors.ink, fontFamily: typography.editorial, fontSize: 20 },
  previewAuthor: { color: colors.muted, fontSize: 13 },
  previewPages: { color: colors.muted, fontSize: 12 },
  destination: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  darkTitle: { color: darkTheme.text },
  darkMuted: { color: darkTheme.textMuted },
});
