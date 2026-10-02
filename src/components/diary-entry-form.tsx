import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BookCover } from '@/src/components/book-cover';
import { LibrarySheet } from '@/src/components/library-sheet';
import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { useLibraryStore } from '@/src/store/library-store';
import { controls, colors, darkTheme, getReadingNotePalette, radii, typography } from '@/src/theme';
import { READING_FOLDER_COLORS, READING_NOTE_COLORS, getReadingNoteText } from '@/src/utils/reading-note';

type DiaryEntryFormProps = {
  bookId?: string;
  entryId?: string;
  folderId?: string;
  initialColor: string;
};

export function DiaryEntryForm({ bookId: initialBookId, entryId, folderId: initialFolderId, initialColor }: DiaryEntryFormProps) {
  const books = useLibraryStore((state) => state.books);
  const readingFolders = useLibraryStore((state) => state.readingFolders);
  const addEntry = useLibraryStore((state) => state.addReadingEntry);
  const updateEntry = useLibraryStore((state) => state.updateReadingEntry);
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const initialBook = books.find((book) => book.id === initialBookId)
    ?? (entryId ? books.find((book) => book.readingEntries?.some((entry) => entry.id === entryId)) : undefined)
    ?? books[0];
  const initialEntry = initialBook?.readingEntries?.find((entry) => entry.id === entryId);
  const isNight = resolveAmbience(ambienceMode) === 'night';
  const [selectedBookOverride, setSelectedBookId] = useState<string>();
  const selectedBookId = selectedBookOverride ?? initialBook?.id ?? '';
  const selectedBook = books.find((book) => book.id === selectedBookId);
  const [description, setDescription] = useState(getReadingNoteText(initialEntry));
  const [page, setPage] = useState(initialEntry?.page ? String(initialEntry.page) : '');
  const [pageError, setPageError] = useState('');
  const [noteColor, setNoteColor] = useState(initialEntry?.color ?? initialColor);
  const [isFavorite, setIsFavorite] = useState(initialEntry?.isFavorite ?? false);
  const [selectedFolderId, setSelectedFolderId] = useState(initialEntry?.folderId ?? initialFolderId);
  const [isBookSelectorVisible, setBookSelectorVisible] = useState(false);

  const notePalette = getReadingNotePalette(noteColor, isNight);
  const background = isNight ? darkTheme.bg : colors.cream;
  const text = isNight ? darkTheme.text : colors.ink;
  const muted = isNight ? darkTheme.textMuted : colors.muted;
  const accent = isNight ? darkTheme.accent : colors.terracottaDark;
  const actionText = isNight ? darkTheme.actionText : colors.white;

  const handleColorChange = (color: string) => {
    setNoteColor(color);
  };

  const handleSave = () => {
    const normalizedDescription = description.trim();
    if (!selectedBook || !normalizedDescription) return;
    const normalizedPage = page.trim();
    const parsedPage = normalizedPage ? Number(normalizedPage) : undefined;
    if (parsedPage !== undefined && (!Number.isInteger(parsedPage) || parsedPage < 1 || parsedPage > selectedBook.totalPages)) {
      setPageError(`Informe uma página entre 1 e ${selectedBook.totalPages}.`);
      return;
    }
    setPageError('');
    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const input = {
      title: '',
      text: normalizedDescription,
      page: parsedPage,
      isFavorite,
      color: noteColor,
      folderId: selectedFolderId,
    };
    if (entryId) updateEntry(selectedBook.id, entryId, input);
    else addEntry(selectedBook.id, input);
    router.back();
  };

  if (!selectedBook) {
    return (
      <View style={[styles.empty, { backgroundColor: background }]}>
        <Text style={[styles.emptyTitle, { color: text }]}>Adicione um livro para começar uma nota.</Text>
        <Pressable onPress={() => router.navigate('/books/catalog')} style={[styles.saveButton, isNight && styles.nightSaveButton]}>
          <Text style={[styles.saveText, { color: actionText }]}>Abrir catálogo</Text>
        </Pressable>
      </View>
    );
  }

  const bookHero = (
    <View style={styles.bookHero}>
      <BookCover color={selectedBook.coverColor} coverUrl={selectedBook.coverUrl} style={styles.cover} />
      <View style={styles.bookHeroCopy}>
        <Text numberOfLines={3} style={[styles.bookTitle, { color: text }]}>{selectedBook.title}</Text>
        <Text numberOfLines={1} style={[styles.bookAuthor, { color: muted }]}>{selectedBook.author}</Text>
        {!entryId ? <Text style={[styles.changeBookHint, { color: accent }]}>Toque para trocar o livro</Text> : null}
      </View>
    </View>
  );

  return (
    <>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.content}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, backgroundColor: background }}
      >
        {!entryId ? (
          <Pressable
            accessibilityHint="Escolhe outro livro para vincular a nota"
            accessibilityLabel={`Livro selecionado: ${selectedBook.title}. Alterar livro`}
            accessibilityRole="button"
            onPress={() => setBookSelectorVisible(true)}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            {bookHero}
          </Pressable>
        ) : bookHero}

        <View style={styles.colorSection}>
          <FieldLabel label="Cor da nota" isNight={isNight} />
          <View style={styles.colorOptions}>
            {READING_NOTE_COLORS.map((color, index) => {
              const selected = noteColor === color;
              const swatch = getReadingNotePalette(color, isNight);
              return (
                <Pressable
                  key={color}
                  accessibilityLabel={`Selecionar cor ${index + 1}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  hitSlop={5}
                  onPress={() => handleColorChange(color)}
                  style={[styles.colorOption, { backgroundColor: swatch.surface, borderColor: selected ? accent : swatch.border }, selected && styles.selectedColorOption]}
                >
                  {selected ? <Ionicons color={accent} name="checkmark" size={19} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.inputGroup, isNight && styles.nightGroup]}>
          <FieldLabel isNight={isNight} label="Nota" />
          <TextInput
            accessibilityLabel="Texto da nota"
            maxLength={1000}
            multiline
            onChangeText={setDescription}
            placeholder="Escreva uma ideia, um trecho ou uma impressão da leitura."
            placeholderTextColor={notePalette.muted}
            selectionColor={accent}
            style={[styles.descriptionInput, { backgroundColor: notePalette.surface, borderColor: notePalette.border, color: notePalette.text }]}
            textAlignVertical="top"
            value={description}
          />
        </View>

        <View style={[styles.inputGroup, isNight && styles.nightGroup]}>
          <FieldLabel isNight={isNight} label="Página" optional />
          <TextInput
            accessibilityLabel="Página da nota, opcional"
            keyboardType="number-pad"
            onChangeText={(value) => { setPage(value.replace(/\D/g, '')); setPageError(''); }}
            placeholder={`1–${selectedBook.totalPages}`}
            placeholderTextColor={muted}
            selectionColor={accent}
            style={[styles.pageInput, isNight && styles.nightField]}
            value={page}
          />
          {pageError ? <Text style={[styles.errorText, isNight && styles.nightError]}>{pageError}</Text> : null}
        </View>

        {readingFolders.length > 0 ? (
          <View style={[styles.inputGroup, isNight && styles.nightGroup]}>
            <FieldLabel isNight={isNight} label="Pasta" optional />
            <ScrollView horizontal contentContainerStyle={styles.folderOptions} showsHorizontalScrollIndicator={false}>
              <FolderOption
                color={isNight ? darkTheme.surfaceElevated : colors.softFill}
                label="Sem pasta"
                selected={!selectedFolderId}
                textColor={text}
                selectedBorderColor={accent}
                onPress={() => setSelectedFolderId(undefined)}
              />
              {readingFolders.map((folder) => {
                const folderColor = READING_FOLDER_COLORS.find((color) => color.id === folder.colorId)!;
                return (
                  <FolderOption
                    key={folder.id}
                    color={isNight ? folderColor.dark : folderColor.light}
                    label={folder.name}
                    selected={selectedFolderId === folder.id}
                    textColor={isNight ? folderColor.darkText : folderColor.text}
                    selectedBorderColor={isNight ? folderColor.darkText : folderColor.text}
                    onPress={() => setSelectedFolderId(folder.id)}
                  />
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <Pressable
          accessibilityLabel={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          accessibilityRole="button"
          accessibilityState={{ selected: isFavorite }}
          onPress={() => setIsFavorite((value) => !value)}
          style={[styles.favoriteAction, isNight && styles.nightField]}
        >
          <Ionicons color={accent} name={isFavorite ? 'star' : 'star-outline'} size={18} />
          <Text style={[styles.favoriteText, { color: text }]}>{isFavorite ? 'Nota favorita' : 'Adicionar aos favoritos'}</Text>
        </Pressable>

        <Pressable accessibilityRole="button" disabled={!description.trim()} onPress={handleSave} style={[styles.saveButton, isNight && styles.nightSaveButton, !description.trim() && styles.saveDisabled]}>
          <Text style={[styles.saveText, { color: actionText }]}>{entryId ? 'Salvar alterações' : 'Salvar nota'}</Text>
        </Pressable>
      </ScrollView>

      <LibrarySheet
        backgroundColor={isNight ? darkTheme.surface : colors.paper}
        description="Escolha o livro ao qual esta nota ficará vinculada."
        height={620}
        mutedColor={isNight ? darkTheme.textMuted : colors.muted}
        onClose={() => setBookSelectorVisible(false)}
        textColor={isNight ? darkTheme.text : colors.ink}
        title="Vincular a um livro"
        visible={isBookSelectorVisible}
      >
        <View style={styles.bookList}>
          {books.map((book) => (
            <Pressable
              key={book.id}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedBookId === book.id }}
              onPress={() => { setSelectedBookId(book.id); setBookSelectorVisible(false); }}
              style={[styles.bookOption, isNight && styles.nightField]}
            >
              <BookCover color={book.coverColor} coverUrl={book.coverUrl} style={styles.optionCover} />
              <View style={styles.bookOptionInfo}>
                <Text numberOfLines={2} style={[styles.bookOptionTitle, isNight && styles.nightText]}>{book.title}</Text>
                <Text numberOfLines={1} style={[styles.bookOptionAuthor, isNight && styles.nightMuted]}>{book.author}</Text>
              </View>
              {selectedBookId === book.id ? <Ionicons color={accent} name="checkmark-circle" size={20} /> : null}
            </Pressable>
          ))}
        </View>
      </LibrarySheet>
    </>
  );
}

function FieldLabel({ label, optional, isNight }: { label: string; optional?: boolean; isNight: boolean }) {
  return (
    <View style={styles.labelRow}>
      <Text style={[styles.label, isNight && styles.nightText]}>{label}</Text>
      {optional ? <Text style={[styles.optionalLabel, isNight && styles.nightMuted]}>Opcional</Text> : null}
    </View>
  );
}

function FolderOption({ color, label, selected, textColor, selectedBorderColor, onPress }: { color: string; label: string; selected: boolean; textColor: string; selectedBorderColor: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.folderOption, { backgroundColor: color }, selected && { borderColor: selectedBorderColor }]}
    >
      <Text numberOfLines={1} style={[styles.folderOptionText, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: 20, padding: 20, paddingTop: 8, paddingBottom: 42 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 },
  emptyTitle: { color: colors.ink, fontFamily: typography.editorial, fontSize: 21, textAlign: 'center' },
  bookHero: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 4 },
  bookHeroCopy: { flex: 1, gap: 5 },
  cover: { width: 64, height: 96, borderRadius: 6, overflow: 'hidden' },
  bookTitle: { fontFamily: typography.editorial, fontSize: 17, lineHeight: 24 },
  bookAuthor: { fontSize: 13, lineHeight: 18 },
  changeBookHint: { color: colors.muted, fontSize: 11, marginTop: 1 },
  colorSection: { gap: 12 },
  colorOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  colorOption: { ...controls.iconButton, borderWidth: 1, borderColor: 'rgba(50, 37, 31, 0.13)', alignItems: 'center', justifyContent: 'center' },
  selectedColorOption: { borderWidth: 2 },
  inputGroup: { gap: 12, padding: 16, borderRadius: 20, backgroundColor: colors.paper },
  nightGroup: { backgroundColor: darkTheme.surface },
  labelRow: { minHeight: 20, flexDirection: 'row', alignItems: 'baseline', gap: 7 },
  label: { color: colors.ink, fontFamily: typography.editorial, fontSize: 18, lineHeight: 24 },
  optionalLabel: { color: colors.muted, fontSize: 12 },
  descriptionInput: { ...controls.input, minHeight: 180, color: colors.ink, backgroundColor: 'rgba(255, 255, 255, 0.62)', borderColor: 'rgba(50, 37, 31, 0.12)', lineHeight: 21 },
  pageInput: { ...controls.input, color: colors.ink, backgroundColor: 'rgba(255, 255, 255, 0.62)', borderColor: 'rgba(50, 37, 31, 0.12)' },
  nightField: { backgroundColor: darkTheme.inputBg, borderColor: darkTheme.inputBorder, color: darkTheme.text },
  nightText: { color: darkTheme.text },
  nightMuted: { color: darkTheme.textMuted },
  errorText: { color: '#9E352B', fontSize: 12 },
  nightError: { color: '#E9A294' },
  folderOptions: { gap: 8, paddingVertical: 2, paddingRight: 12 },
  folderOption: { minHeight: 44, maxWidth: 180, paddingHorizontal: 13, justifyContent: 'center', borderRadius: radii.full, borderWidth: 1, borderColor: 'transparent' },
  folderOptionText: { fontSize: 12, fontWeight: '600' },
  favoriteAction: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 13, paddingVertical: 10, borderRadius: radii.medium, backgroundColor: 'rgba(255, 255, 255, 0.46)', borderWidth: 1, borderColor: 'rgba(50, 37, 31, 0.1)' },
  favoriteText: { color: colors.inkSoft, fontSize: 13, fontWeight: '600' },
  saveButton: { ...controls.button, backgroundColor: colors.terracotta },
  nightSaveButton: { backgroundColor: darkTheme.accent },
  saveDisabled: { opacity: 0.45 },
  saveText: { ...controls.buttonText, color: colors.white },
  pressed: { opacity: 0.85 },
  bookList: { gap: 9, paddingBottom: 8 },
  bookOption: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: radii.medium, backgroundColor: 'rgba(50, 37, 31, 0.05)' },
  optionCover: { width: 35, height: 50, borderRadius: 4 },
  bookOptionInfo: { flex: 1, gap: 3 },
  bookOptionTitle: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  bookOptionAuthor: { color: colors.muted, fontSize: 11 },
});
