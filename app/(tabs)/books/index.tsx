import { SegmentedTabs } from '@/src/components/segmented-tabs';
import { AppTextInput } from '@/src/components/app-text-input';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BookCover } from '@/src/components/book-cover';
import { LibrarySheet } from '@/src/components/library-sheet';
import { resolveAmbience } from '@/src/types/ambience';
import { useLibraryStore } from '@/src/store/library-store';
import { controls, colors, darkTheme, radii, typography } from '@/src/theme';
import { getLibraryPalette } from '@/src/library-palette';
import type { Book } from '@/src/types/book';

type ShelfTab = 'want-to-read' | 'reading' | 'completed';
type ActiveLibrarySheet =
  | { type: 'add-book'; shelfId: string; status: ShelfTab }
  | { type: 'edit-shelf'; shelves: { id: string; status: ShelfTab }[]; index: number; name: string; bookCount: number }
  | null;
type ShelfRow = { id: string; shelves: { id: string; status: ShelfTab }[]; index: number; name: string };

export default function BooksScreen() {
  const insets = useSafeAreaInsets();
  const books = useLibraryStore((state) => state.books);
  const activeBookId = useLibraryStore((state) => state.activeBookId);
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const wantToReadShelves = useLibraryStore((state) => state.wantToReadShelves);
  const readingShelves = useLibraryStore((state) => state.readingShelves);
  const completedShelves = useLibraryStore((state) => state.completedShelves);
  const shelfNames = useLibraryStore((state) => state.shelfNames);
  const libraryBackgroundId = useLibraryStore((state) => state.libraryBackgroundId);
  const addLibraryShelf = useLibraryStore((state) => state.addLibraryShelf);
  const renameLibraryShelf = useLibraryStore((state) => state.renameLibraryShelf);
  const removeLibraryShelf = useLibraryStore((state) => state.removeLibraryShelf);
  const isNight = resolveAmbience(ambienceMode) === 'night';
  const palette = getLibraryPalette(libraryBackgroundId)[isNight ? 'dark' : 'light'];
  const [selectedTab, setSelectedTab] = useState<ShelfTab>('reading');
  const [activeSheet, setActiveSheet] = useState<ActiveLibrarySheet>(null);
  const [shelfNameFocused, setShelfNameFocused] = useState(false);
  const [shelfNameDraft, setShelfNameDraft] = useState('');

  const libraryBooks = books.filter((book) => book.status !== 'want-to-read');
  const wantToReadBooks = books.filter((book) => book.status === 'want-to-read');
  const completedBooks = books.filter((book) => book.status === 'completed');
  const visibleBooks = selectedTab === 'reading' ? libraryBooks
    : selectedTab === 'completed' ? completedBooks : wantToReadBooks;
  const shelfRows: ShelfRow[] = selectedTab === 'reading'
    ? Array.from({ length: Math.max(readingShelves.length, completedShelves.length) }, (_, index) => {
      const shelfEntries: ShelfRow['shelves'] = [];
      if (readingShelves[index]) shelfEntries.push({ id: readingShelves[index], status: 'reading' });
      if (completedShelves[index]) shelfEntries.push({ id: completedShelves[index], status: 'completed' });
      const id = shelfEntries[0]?.id ?? `library-shelf-${index}`;
      return {
        id,
        shelves: shelfEntries,
        index,
        name: shelfNames[readingShelves[index]] || shelfNames[completedShelves[index]] || `Prateleira ${index + 1}`,
      };
    })
    : (selectedTab === 'completed' ? completedShelves : wantToReadShelves).map((id, index) => ({
      id,
      shelves: [{ id, status: selectedTab }],
      index,
      name: shelfNames[id] || `Prateleira ${index + 1}`,
    }));

  const openBook = (book: Book) => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.navigate({ pathname: '/book-progress', params: { bookId: book.id } });
  };

  const closeSheet = () => setActiveSheet(null);
  const openShelfSheet = (row: ShelfRow, bookCount: number) => {
    setShelfNameFocused(false);
    setShelfNameDraft(row.name);
    setActiveSheet({ type: 'edit-shelf', shelves: row.shelves, index: row.index, name: row.name, bookCount });
  };
  const saveShelfName = () => {
    if (activeSheet?.type !== 'edit-shelf' || !shelfNameDraft.trim()) return;
    activeSheet.shelves.forEach(({ id }) => renameLibraryShelf(id, shelfNameDraft));
    closeSheet();
  };
  const deleteShelf = () => {
    if (activeSheet?.type !== 'edit-shelf' || activeSheet.index === 0 || activeSheet.bookCount > 0) return;
    const removed = activeSheet.shelves.every(({ id, status }) => removeLibraryShelf(status, id));
    if (removed) closeSheet();
  };
  return (
    <>
      <Stack.Screen options={{
        headerShown: false,
        contentStyle: { backgroundColor: palette.background },
      }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.content, process.env.EXPO_OS !== 'ios' && { paddingTop: insets.top + 14 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={[styles.screen, { backgroundColor: palette.background }]}
      >
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Buscar livros no catálogo" onPress={() => router.navigate('/books/catalog')} style={({ pressed }) => [styles.headerButton, { backgroundColor: palette.surface, borderColor: palette.border }, pressed && styles.pressed]}>
            <Ionicons name="search-outline" size={22} color={isNight ? darkTheme.selectionText : colors.sageDark} />
          </Pressable>
          <Text accessibilityRole="header" adjustsFontSizeToFit numberOfLines={1} style={[styles.headerTitle, { color: palette.text }]}>Biblioteca</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Personalizar aparência da biblioteca" onPress={() => router.navigate('/books/appearance')} style={({ pressed }) => [styles.headerButton, { backgroundColor: palette.surface, borderColor: palette.border }, pressed && styles.pressed]}>
            <Ionicons name="color-palette-outline" size={22} color={isNight ? darkTheme.selectionText : colors.sageDark} />
          </Pressable>
        </View>
        <Text style={[styles.headerSubtitle, { color: palette.mutedText }]}>Seus livros, em um só lugar.</Text>
        <SegmentedTabs
          items={[
            { id: 'reading', label: 'Biblioteca' },
            { id: 'want-to-read', label: 'Quero ler' },
            { id: 'completed', label: 'Concluídos' },
          ]}
          isNight={isNight}
          onSelect={setSelectedTab}
          selected={selectedTab}
          style={styles.tabs}
        />
        <Animated.View key={selectedTab} entering={tabTransition}>
          <Shelf
            emptyState={!visibleBooks.length && (selectedTab === 'completed' || !shelfRows.length) ? (
              <BookSlot
                isNight={isNight}
                label={selectedTab === 'completed' && books.length ? 'Ir para Biblioteca' : 'Adicionar livro'}
                onPress={() => {
                  if (selectedTab === 'completed' && books.length) { setSelectedTab('reading'); return; }
                  const status = selectedTab === 'want-to-read' ? 'want-to-read' : 'reading';
                  const shelfId = (status === 'want-to-read' ? wantToReadShelves : readingShelves)[0];
                  if (shelfId) setActiveSheet({ type: 'add-book', shelfId, status });
                  else router.navigate('/books/catalog');
                }}
                icon={selectedTab === 'completed' && books.length ? 'arrow-forward' : 'add'}
              />
            ) : null}
            books={visibleBooks}
            bookCount={visibleBooks.length}
            shelfRows={shelfRows}
            addableShelfIds={selectedTab === 'want-to-read' ? wantToReadShelves : readingShelves}
            isActive={(book) => book.id === activeBookId}
            isNight={isNight}
            palette={palette}
            onOpen={openBook}
            onEditShelf={openShelfSheet}
            onAddBook={(shelfId) => setActiveSheet({ type: 'add-book', shelfId, status: selectedTab })}
            onAddShelf={() => {
              if (selectedTab === 'reading') {
                addLibraryShelf('reading');
                addLibraryShelf('completed');
              } else {
                addLibraryShelf(selectedTab);
              }
            }}
          />
        </Animated.View>
      </ScrollView>
      <LibrarySheet
        backgroundColor={palette.surface}
        mutedColor={palette.mutedText}
        onClose={closeSheet}
        textColor={palette.text}
        title={activeSheet?.type === 'edit-shelf' ? 'Editar prateleira' : 'Adicionar livro'}
        visible={activeSheet !== null}
      >
        {activeSheet?.type === 'add-book' ? (
          <View style={styles.addBookInset}>
            <View style={[styles.addBookOptions, { borderColor: palette.border }]}>
              <SheetAction
                icon="search-outline"
                isNight={isNight}
                palette={palette}
                title="Buscar no catálogo"
                onPress={() => {
                  const { shelfId, status } = activeSheet;
                  closeSheet();
                  router.navigate({ pathname: '/books/catalog', params: { shelfId, status } });
                }}
              />
              <View style={[styles.addBookDivider, { backgroundColor: palette.border }]} />
              <SheetAction
                icon="create-outline"
                isNight={isNight}
                palette={palette}
                title="Cadastrar manualmente"
                onPress={() => {
                  const { shelfId, status } = activeSheet;
                  closeSheet();
                  router.navigate({ pathname: '/add-book', params: { shelfId, status } });
                }}
              />
            </View>
          </View>
        ) : activeSheet?.type === 'edit-shelf' ? (
          <View style={styles.sheetOptions}>
            <Text style={[styles.sheetActionTitle, { color: palette.text }]}>Nome</Text>
            <AppTextInput
              accessibilityLabel="Nome da prateleira"
              onFocus={() => setShelfNameFocused(true)}
              onBlur={() => setShelfNameFocused(false)}
              keyboardAppearance={isNight ? 'dark' : 'light'}
              selectionColor={isNight ? darkTheme.selectionText : colors.sageDark}
              maxLength={40}
              onChangeText={setShelfNameDraft}
              onSubmitEditing={saveShelfName}
              placeholder="Nome da prateleira"
              placeholderTextColor={palette.mutedText}
              returnKeyType="done"
              style={[styles.shelfNameInput, { backgroundColor: palette.mutedSurface, borderColor: shelfNameFocused ? (isNight ? darkTheme.selectionText : colors.sageDark) : palette.border, color: palette.text }]}
              value={shelfNameDraft}
            />
            <Pressable
              accessibilityRole="button"
              disabled={!shelfNameDraft.trim() || shelfNameDraft.trim() === activeSheet.name}
              onPress={saveShelfName}
              style={({ pressed }) => [styles.saveShelfButton, { backgroundColor: isNight ? darkTheme.primary : colors.ink }, (!shelfNameDraft.trim() || shelfNameDraft.trim() === activeSheet.name) && styles.disabled, pressed && styles.pressed]}
            >
              <Text style={[styles.saveShelfText, { color: isNight ? darkTheme.actionText : colors.paper }]}>Salvar</Text>
            </Pressable>
            <View style={[styles.sheetSeparator, { backgroundColor: palette.border }]} />
            <Pressable
              accessibilityRole="button"
              disabled={activeSheet.index === 0 || activeSheet.bookCount > 0}
              accessibilityLabel="Excluir prateleira"
              onPress={deleteShelf}
              style={({ pressed }) => [styles.deleteShelfButton, { borderColor: palette.border }, (activeSheet.index === 0 || activeSheet.bookCount > 0) && styles.disabled, pressed && styles.pressed]}
            >
              <Ionicons color={activeSheet.index === 0 || activeSheet.bookCount > 0 ? palette.mutedText : (isNight ? darkTheme.danger : colors.danger)} name="trash-outline" size={19} />
              <Text style={[styles.deleteShelfText, { color: activeSheet.index === 0 || activeSheet.bookCount > 0 ? palette.mutedText : (isNight ? darkTheme.danger : colors.danger) }]}>Excluir</Text>
            </Pressable>
            {activeSheet.index === 0 || activeSheet.bookCount > 0 ? (
              <Text style={[styles.shelfHelpText, { color: palette.mutedText }]}>
                {activeSheet.index === 0 ? 'A primeira prateleira é fixa.' : 'Esvazie a prateleira para excluir.'}
              </Text>
            ) : null}
          </View>
        ) : null}
      </LibrarySheet>
    </>
  );
}

function SheetAction({
  icon,
  isNight,
  onPress,
  palette,
  title,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  isNight: boolean;
  onPress: () => void;
  palette: ReturnType<typeof getLibraryPalette>['light'];
  title: string;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.sheetAction, { backgroundColor: palette.mutedSurface }, pressed && styles.pressed]}>
      <View style={[styles.sheetActionIcon, { backgroundColor: isNight ? darkTheme.selection : colors.sageSoft }]}>
        <Ionicons color={isNight ? darkTheme.selectionText : colors.sageDark} name={icon} size={21} accessible={false} />
      </View>
      <View style={styles.sheetActionCopy}>
        <Text style={[styles.sheetActionTitle, { color: palette.text }]}>{title}</Text>
      </View>
      <Ionicons color={palette.mutedText} name="chevron-forward" size={18} accessible={false} />
    </Pressable>
  );
}

function Shelf({
  addableShelfIds,
  emptyState,
  books,
  bookCount,
  shelfRows,
  isActive,
  isNight,
  palette,
  onOpen,
  onEditShelf,
  onAddBook,
  onAddShelf,
}: {
  addableShelfIds: string[];
  emptyState: ReactNode;
  books: Book[];
  bookCount: number;
  shelfRows: ShelfRow[];
  isActive: (book: Book) => boolean;
  isNight: boolean;
  palette: ReturnType<typeof getLibraryPalette>['light'];
  onOpen: (book: Book) => void;
  onAddBook: (shelfId: string) => void;
  onAddShelf: () => void;
  onEditShelf: (row: ShelfRow, bookCount: number) => void;
}) {
  return (
    <View style={styles.shelfSection}>
      {!shelfRows.length && emptyState ? <View style={styles.emptyBookRow}>{emptyState}</View> : null}
      {shelfRows.map((row, index) => {
        const addableShelf = row.shelves.find(({ id }) => addableShelfIds.includes(id));
        const shelfBooks = books.filter((book) => row.shelves.some((shelf) => shelf.id === book.shelfId));
        return (
          <View key={row.id} style={styles.singleShelf}>
            <View style={styles.shelfHeading}>
            <Pressable
              accessibilityLabel={`Editar ${row.name}`}
              accessibilityRole="button"
              onPress={() => onEditShelf(row, shelfBooks.length)}
              style={styles.shelfTitleButton}
            >
              <Text numberOfLines={1} style={[styles.shelfLabel, { color: palette.text }]}>{row.name}</Text>
              <Ionicons color={palette.mutedText} name="create-outline" size={15} />
            </Pressable>
              <Text style={[styles.shelfCount, { color: palette.mutedText }]}>{shelfBooks.length} {shelfBooks.length === 1 ? 'livro' : 'livros'}</Text>
            </View>
            <ScrollView horizontal style={styles.bookRowViewport} contentContainerStyle={styles.bookRow} showsHorizontalScrollIndicator={false}>
              {shelfBooks.map((book) => (
                <Pressable
                  key={book.id}
                  accessibilityLabel={`${book.title}, ${book.author}${isActive(book) ? ', na mesa' : ''}`}
                  accessibilityRole="button"
                  onPress={() => onOpen(book)}
                  style={({ pressed }) => [styles.bookButton, pressed && styles.pressed]}
                >
                  <BookCover color={book.coverColor} coverUrl={book.coverUrl} style={styles.cover}>
                    {!book.coverUrl && <Text numberOfLines={4} style={styles.coverTitle}>{book.title}</Text>}
                  </BookCover>
                </Pressable>
              ))}
              {addableShelf ? (
                <BookSlot isNight={isNight} label={`Adicionar livro à ${row.name}`} onPress={() => onAddBook(addableShelf.id)} />
              ) : index === 0 ? emptyState : null}
            </ScrollView>
            <View style={styles.shelfBoard}>
              <Image source={require('@/assets/images/library-shelf.png')} contentFit="fill" style={[styles.shelfWood, isNight && { opacity: 0.72 }]} accessibilityIgnoresInvertColors />
            </View>
          </View>
        );
      })}
      <View style={styles.shelfFooter}>
        <Pressable accessibilityRole="button" onPress={onAddShelf} style={({ pressed }) => [styles.addShelfButton, { borderColor: palette.border }, pressed && styles.pressed]}>
          <Ionicons color={isNight ? darkTheme.selectionText : colors.ink} name="add-circle-outline" size={21} />
          <Text style={[styles.addShelfText, { color: palette.text }]}>Adicionar prateleira</Text>
        </Pressable>
        <Text style={[styles.bookCount, { color: palette.mutedText }]}>{bookCount} {bookCount === 1 ? 'livro' : 'livros'}</Text>
      </View>
    </View>
  );
}

function BookSlot({ isNight, label, icon = 'add', onPress }: {
  isNight: boolean; label: string; icon?: 'add' | 'arrow-forward'; onPress: () => void;
}) {
  const color = isNight ? darkTheme.selectionText : colors.sageDark;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={({ pressed }) => [styles.bookButton, styles.emptyBookSlot, { borderColor: color }, pressed && styles.pressed]}>
      <Ionicons name={icon} color={color} size={26} accessible={false} />
    </Pressable>
  );
}

const tabTransition = FadeIn.duration(90).reduceMotion(ReduceMotion.System);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingTop: 14, paddingBottom: 24, gap: 16 },
  header: { minHeight: 48, marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: typography.editorial, fontSize: 30, lineHeight: 40 },
  headerSubtitle: { fontFamily: typography.ui, fontSize: 14, lineHeight: 21, minHeight: 46, textAlign: 'center', paddingHorizontal: 28, paddingBottom: 4 },
  headerButton: { ...controls.iconButton, borderWidth: 1 },
  tabs: { marginHorizontal: 20 },
  shelfSection: { gap: 24 },
  shelfFooter: { alignItems: 'center', gap: 10 },
  singleShelf: { marginHorizontal: 12 },
  shelfHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, gap: 12, marginBottom: 14 },
  shelfTitleButton: { flexShrink: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  shelfLabel: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  shelfCount: { fontSize: 11 },
  bookRowViewport: { height: 148 },
  bookRow: { height: '100%', alignItems: 'flex-end', gap: 12, paddingHorizontal: 14 },
  emptyBookRow: { minHeight: 148, justifyContent: 'flex-end', alignItems: 'flex-start', paddingHorizontal: 14 },
  emptyBookSlot: { borderWidth: 1, borderStyle: 'dashed', borderRadius: radii.small, borderCurve: 'continuous' },
  bookButton: { width: 96, height: 144, alignItems: 'center', justifyContent: 'center' },
  cover: { width: 96, height: 144, borderRadius: radii.small, borderCurve: 'continuous', justifyContent: 'center', padding: 8 },
  coverTitle: { color: colors.ink, backgroundColor: colors.paper, borderRadius: 4, overflow: 'hidden', padding: 5, fontFamily: typography.editorial, fontSize: 13, textAlign: 'center' },
  shelfBoard: { height: 28, overflow: 'hidden', marginTop: -1, borderRadius: 3 },
  shelfWood: { position: 'absolute', width: '104%', left: '-2%', height: 330, top: -153 },
  addShelfButton: { ...controls.button, alignSelf: 'stretch', marginHorizontal: 18, borderWidth: 1, borderStyle: 'dashed', flexDirection: 'row', gap: 8 },
  addShelfText: { ...controls.buttonText,  },
  bookCount: { textAlign: 'center', fontSize: 12 },
  sheetOptions: { gap: 10, paddingTop: 10, paddingBottom: 8 },
  addBookInset: { paddingTop: 10, paddingBottom: 4 },
  addBookOptions: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.large, borderCurve: 'continuous', overflow: 'hidden' },
  addBookDivider: { height: StyleSheet.hairlineWidth, marginLeft: 64 },
  sheetAction: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 8 },
  sheetActionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sheetActionCopy: { flex: 1, gap: 3 },
  sheetActionTitle: { fontSize: 14, fontWeight: '600' },
  shelfNameInput: { ...controls.input, borderRadius: radii.medium, borderCurve: 'continuous' },
  saveShelfButton: { ...controls.button },
  saveShelfText: { ...controls.buttonText, color: '#FFFFFF' },
  sheetSeparator: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  deleteShelfButton: { ...controls.button, minHeight: 44, flexDirection: 'row', gap: 8, borderWidth: StyleSheet.hairlineWidth },
  deleteShelfText: { ...controls.buttonText,  },
  shelfHelpText: { fontSize: 12, lineHeight: 17, textAlign: 'center' },
  disabled: controls.buttonDisabled,
  pressed: controls.buttonPressed,
});
