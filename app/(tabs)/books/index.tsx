import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BookCover } from '@/src/components/book-cover';
import { LibrarySheet } from '@/src/components/library-sheet';
import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { useLibraryStore } from '@/src/store/library-store';
import { controls, colors, darkTheme, typography } from '@/src/theme';
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
  const headerInset = process.env.EXPO_OS === 'ios' ? 18 : insets.top + 18;
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
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={[styles.screen, { backgroundColor: palette.background }]}
      >
        <View style={[styles.header, { paddingTop: headerInset, height: 212 + headerInset }]}>
          <Image pointerEvents="none" source={require('@/assets/images/library-header.png')} contentFit="cover" contentPosition="bottom right" style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors />
          {isNight ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.headerNightOverlay]} /> : null}
          <View pointerEvents="none" style={[styles.headerBlend, { experimental_backgroundImage: `linear-gradient(to bottom, ${palette.background}00, ${palette.background})` }]} />
          <View pointerEvents="none" style={styles.headerCopy}>
            <Text style={[styles.headerTitle, { color: isNight ? darkTheme.text : colors.ink }]}>Biblioteca</Text>
            <Text style={[styles.headerSubtitle, { color: isNight ? darkTheme.textMuted : colors.inkSoft }]}>Seus livros, em um só lugar.</Text>
          </View>
          <View style={[styles.headerActions, { top: headerInset }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Buscar livros no catálogo" onPress={() => router.navigate('/books/catalog')} style={({ pressed }) => [styles.headerButton, { backgroundColor: palette.surface, borderColor: palette.border }, pressed && styles.pressed]}>
              <Ionicons name="search-outline" size={22} color={palette.text} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Personalizar aparência da biblioteca" onPress={() => router.navigate('/books/appearance')} style={({ pressed }) => [styles.headerButton, { backgroundColor: isNight ? darkTheme.accent : colors.terracotta, borderColor: 'transparent' }, pressed && styles.pressed]}>
              <Ionicons name="color-palette-outline" size={22} color={isNight ? darkTheme.bg : colors.cream} />
            </Pressable>
          </View>
        </View>
        <ShelfTabs
          isNight={isNight}
          palette={palette}
          onSelect={setSelectedTab}
          selected={selectedTab}
        />
        <Shelf
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
      </ScrollView>
      <LibrarySheet
        backgroundColor={palette.surface}
        description={activeSheet?.type === 'edit-shelf'
          ? 'Renomeie a prateleira ou exclua-a se estiver vazia.'
          : 'Adicione um livro manualmente ou encontre uma edição no catálogo.'}
        height={activeSheet?.type === 'edit-shelf' ? 450 : 380}
        mutedColor={palette.mutedText}
        onClose={closeSheet}
        textColor={palette.text}
        title={activeSheet?.type === 'edit-shelf' ? 'Editar prateleira' : 'Adicionar livro'}
        visible={activeSheet !== null}
      >
        {activeSheet?.type === 'add-book' ? (
          <View style={styles.sheetOptions}>
            <SheetAction
              icon="create-outline"
              isNight={isNight}
              palette={palette}
              title="Adicionar manualmente"
              subtitle="Cadastre um livro fora do catálogo."
              onPress={() => {
                const { shelfId, status } = activeSheet;
                closeSheet();
                router.navigate({ pathname: '/add-book', params: { shelfId, status } });
              }}
            />
            <SheetAction
              icon="library-outline"
              isNight={isNight}
              palette={palette}
              title="Abrir catálogo"
              subtitle="Pesquise e adicione uma edição."
              onPress={() => {
                const { shelfId, status } = activeSheet;
                closeSheet();
                router.navigate({ pathname: '/books/catalog', params: { shelfId, status } });
              }}
            />
          </View>
        ) : activeSheet?.type === 'edit-shelf' ? (
          <View style={styles.sheetOptions}>
            <TextInput
              accessibilityLabel="Nome da prateleira"
              maxLength={40}
              onChangeText={setShelfNameDraft}
              onSubmitEditing={saveShelfName}
              placeholder="Nome da prateleira"
              placeholderTextColor={palette.mutedText}
              returnKeyType="done"
              style={[styles.shelfNameInput, { backgroundColor: palette.mutedSurface, borderColor: palette.border, color: palette.text }]}
              value={shelfNameDraft}
            />
            <Pressable
              accessibilityRole="button"
              disabled={!shelfNameDraft.trim() || shelfNameDraft.trim() === activeSheet.name}
              onPress={saveShelfName}
              style={({ pressed }) => [styles.saveShelfButton, { backgroundColor: isNight ? darkTheme.accent : colors.terracotta }, (!shelfNameDraft.trim() || shelfNameDraft.trim() === activeSheet.name) && styles.disabled, pressed && styles.pressed]}
            >
              <Text style={[styles.saveShelfText, { color: isNight ? darkTheme.actionText : colors.white }]}>Salvar nome</Text>
            </Pressable>
            <View style={[styles.sheetSeparator, { backgroundColor: palette.border }]} />
            <Pressable
              accessibilityRole="button"
              disabled={activeSheet.index === 0 || activeSheet.bookCount > 0}
              onPress={deleteShelf}
              style={({ pressed }) => [styles.deleteShelfButton, { borderColor: palette.border }, (activeSheet.index === 0 || activeSheet.bookCount > 0) && styles.disabled, pressed && styles.pressed]}
            >
              <Ionicons color={activeSheet.index === 0 || activeSheet.bookCount > 0 ? palette.mutedText : '#B7463D'} name="trash-outline" size={19} />
              <Text style={[styles.deleteShelfText, { color: activeSheet.index === 0 || activeSheet.bookCount > 0 ? palette.mutedText : '#B7463D' }]}>Excluir prateleira</Text>
            </Pressable>
            <Text style={[styles.shelfHelpText, { color: palette.mutedText }]}>
              {activeSheet.index === 0 ? 'A primeira prateleira é fixa.' : activeSheet.bookCount > 0 ? 'Mova ou remova os livros antes de excluir.' : 'Somente prateleiras vazias podem ser excluídas.'}
            </Text>
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
  subtitle,
  title,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  isNight: boolean;
  onPress: () => void;
  palette: ReturnType<typeof getLibraryPalette>['light'];
  subtitle: string;
  title: string;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.sheetAction, { backgroundColor: palette.mutedSurface }, pressed && styles.pressed]}>
      <View style={[styles.sheetActionIcon, { backgroundColor: isNight ? darkTheme.surfaceElevated : '#F2DED4' }]}>
        <Ionicons color={isNight ? darkTheme.accent : colors.terracotta} name={icon} size={21} />
      </View>
      <View style={styles.sheetActionCopy}>
        <Text style={[styles.sheetActionTitle, { color: palette.text }]}>{title}</Text>
        <Text style={[styles.sheetActionSubtitle, { color: palette.mutedText }]}>{subtitle}</Text>
      </View>
      <Ionicons color={palette.mutedText} name="chevron-forward" size={18} />
    </Pressable>
  );
}

function ShelfTabs({
  isNight,
  onSelect,
  selected,
  palette,
}: {
  isNight: boolean;
  onSelect: (tab: ShelfTab) => void;
  selected: ShelfTab;
  palette: ReturnType<typeof getLibraryPalette>['light'];
}) {
  return (
    <View accessibilityRole="tablist" style={[styles.tabs, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      {([
        ['reading', 'Biblioteca', 'library-outline'],
        ['want-to-read', 'Quero ler', 'bookmark-outline'],
        ['completed', 'Concluídos', 'checkmark-circle-outline'],
      ] as const).map(([tab, label, icon]) => {
        const active = selected === tab;
        return (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
              onSelect(tab);
            }}
            style={[styles.tab, active && { backgroundColor: isNight ? darkTheme.accent : colors.terracotta }]}
          >
            <Ionicons name={icon} size={17} color={active ? (isNight ? darkTheme.bg : colors.cream) : palette.mutedText} />
            <Text numberOfLines={1} style={[styles.tabText, { color: active ? (isNight ? darkTheme.bg : colors.cream) : palette.mutedText }]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Shelf({
  addableShelfIds,
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
      {shelfRows.map((row) => {
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
              <View style={styles.shelfActions}>
              <Text style={[styles.shelfCount, { color: palette.mutedText }]}>{shelfBooks.length} {shelfBooks.length === 1 ? 'livro' : 'livros'}</Text>
              {row.shelves.some(({ id }) => addableShelfIds.includes(id)) ? (
                <Pressable
                  accessibilityLabel={`Adicionar livro à ${row.name}`}
                  accessibilityRole="button"
                  onPress={() => onAddBook(row.shelves.find(({ id }) => addableShelfIds.includes(id))!.id)}
                  style={({ pressed }) => [styles.addBookButton, { backgroundColor: isNight ? darkTheme.accent : colors.terracotta }, pressed && styles.pressed]}
                >
                  <Ionicons color={isNight ? darkTheme.bg : colors.cream} name="add" size={23} />
                </Pressable>
              ) : null}
              </View>
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
                  <BookCover color={book.coverColor} coverUrl={book.coverUrl} style={styles.cover} />
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.shelfBoard}>
              <Image source={require('@/assets/images/library-shelf.png')} contentFit="fill" style={[styles.shelfWood, isNight && { opacity: 0.72 }]} accessibilityIgnoresInvertColors />
            </View>
          </View>
        );
      })}
      <View style={styles.shelfFooter}>
        <Pressable accessibilityRole="button" onPress={onAddShelf} style={({ pressed }) => [styles.addShelfButton, { borderColor: palette.border }, pressed && styles.pressed]}>
          <Ionicons color={isNight ? darkTheme.accent : colors.terracotta} name="add-circle-outline" size={21} />
          <Text style={[styles.addShelfText, { color: palette.text }]}>Adicionar prateleira</Text>
        </Pressable>
        <Text style={[styles.bookCount, { color: palette.mutedText }]}>{bookCount} {bookCount === 1 ? 'livro' : 'livros'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { paddingBottom: 24, gap: 22 },
  header: { height: 230, paddingHorizontal: 20, paddingTop: 18 },
  headerTitle: { fontFamily: typography.editorial, fontSize: 32, lineHeight: 42 },
  headerSubtitle: { fontSize: 14, lineHeight: 21, marginTop: 6, maxWidth: 215 },
  headerNightOverlay: { backgroundColor: 'rgba(32,30,28,0.64)' },
  headerCopy: { paddingRight: 108 },
  headerBlend: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 78 },
  headerActions: { position: 'absolute', zIndex: 1, top: 18, right: 20, flexDirection: 'row', gap: 10 },
  headerButton: { ...controls.iconButton, borderWidth: 1 },
  tabs: { flexDirection: 'row', marginTop: -44, marginHorizontal: 18, borderWidth: 1, borderRadius: 20, borderCurve: 'continuous', padding: 4, gap: 3 },
  tab: { flex: 1, minWidth: 0, minHeight: 46, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderCurve: 'continuous' },
  tabText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  shelfSection: { gap: 24 },
  shelfFooter: { alignItems: 'center', gap: 10 },
  singleShelf: { marginHorizontal: 12 },
  shelfHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, gap: 12, marginBottom: 14 },
  shelfTitleButton: { flexShrink: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  shelfLabel: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  shelfCount: { fontSize: 11 },
  shelfActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bookRowViewport: { height: 148 },
  bookRow: { height: '100%', alignItems: 'flex-end', gap: 12, paddingHorizontal: 14 },
  bookButton: { width: 96, height: 144, alignItems: 'center', justifyContent: 'center' },
  addBookButton: { ...controls.iconButton },
  cover: { width: 96, height: 144, borderRadius: 5, borderCurve: 'continuous', boxShadow: '0 3px 8px rgba(50, 37, 31, 0.13)' },
  shelfBoard: { height: 42, overflow: 'hidden', marginTop: -1 },
  shelfWood: { position: 'absolute', width: '100%', height: 330, top: -153 },
  addShelfButton: { ...controls.button, alignSelf: 'stretch', marginHorizontal: 18, borderWidth: 1, borderStyle: 'dashed', flexDirection: 'row', gap: 8 },
  addShelfText: { ...controls.buttonText,  },
  bookCount: { textAlign: 'center', fontSize: 12 },
  sheetOptions: { gap: 12, paddingBottom: 8 },
  sheetAction: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderRadius: 16, borderCurve: 'continuous' },
  sheetActionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sheetActionCopy: { flex: 1, gap: 3 },
  sheetActionTitle: { fontSize: 14, fontWeight: '600' },
  sheetActionSubtitle: { fontSize: 12 },
  shelfNameInput: { ...controls.input },
  saveShelfButton: { ...controls.button },
  saveShelfText: { ...controls.buttonText, color: '#FFFFFF' },
  sheetSeparator: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  deleteShelfButton: { ...controls.button, flexDirection: 'row', gap: 8, borderWidth: 1 },
  deleteShelfText: { ...controls.buttonText,  },
  shelfHelpText: { fontSize: 12, lineHeight: 17, textAlign: 'center' },
  disabled: { opacity: 0.48 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
