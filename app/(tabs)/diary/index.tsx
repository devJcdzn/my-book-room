import { SegmentedTabs } from '@/src/components/segmented-tabs';
import { AppTextInput } from '@/src/components/app-text-input';
import { showAlert } from '@/src/components/app-dialog';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { LibrarySheet } from '@/src/components/library-sheet';
import { ReadingEmptyState } from '@/src/components/reading-empty-state';
import { BookCover } from '@/src/components/book-cover';
import { resolveAmbience } from '@/src/types/ambience';
import { useLibraryStore } from '@/src/store/library-store';
import { controls, colors, darkTheme, getReadingNotePalette, radii, typography } from '@/src/theme';
import type { ReadingEntry, ReadingSession } from '@/src/types/book';
import { READING_FOLDER_COLORS, READING_NOTE_COLORS, getReadingNoteText } from '@/src/utils/reading-note';
import { readingTimeLabel, readingSessionDate, formatReadingDuration } from '@/src/utils/reading-session';

type DiaryItem = { entry: ReadingEntry; bookId: string; title: string; author: string; folderLabel?: string; content: string };
type DiaryFilter = 'all' | 'favorites' | `folder:${string}`;

const formatDate = (value: string) => new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric', month: 'short', year: 'numeric',
}).format(new Date(value));

const estimateCardHeight = (item: DiaryItem) => {
  const folderLines = item.folderLabel ? Math.min(2, Math.max(1, Math.ceil(item.folderLabel.length / 19))) : 0;
  const contentLines = Math.min(8, Math.max(1, Math.ceil(item.content.length / 22)));
  return 100 + folderLines * 18 + contentLines * 22;
};

export default function DiaryScreen() {
  const { width, fontScale } = useWindowDimensions();
  const columnCount = width < 360 || fontScale > 1.2 ? 1 : 2;
  const books = useLibraryStore((state) => state.books);
  const readingSessions = useLibraryStore((state) => state.readingSessions);
  const removeReadingSession = useLibraryStore((state) => state.removeReadingSession);
  const readingFolders = useLibraryStore((state) => state.readingFolders);
  const toggleFavorite = useLibraryStore((state) => state.toggleReadingEntryFavorite);
  const addReadingFolder = useLibraryStore((state) => state.addReadingFolder);
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const isNight = resolveAmbience(ambienceMode) === 'night';
  const [query, setQuery] = useState('');
  const [folderNameFocused, setFolderNameFocused] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [filter, setFilter] = useState<DiaryFilter>('all');
  const [showFolderSheet, setShowFolderSheet] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderColorId, setFolderColorId] = useState<string>(READING_FOLDER_COLORS[0].id);
  const [activeSection, setActiveSection] = useState<'notes' | 'activity'>('notes');

  const orderedSessions = useMemo(
    () => [...readingSessions].sort((a, b) => b.readingDate.localeCompare(a.readingDate) || b.createdAt.localeCompare(a.createdAt)),
    [readingSessions],
  );

  const entries = useMemo(() => books.flatMap((book) => (book.readingEntries ?? []).map((entry) => {
    const folderName = readingFolders.find((folder) => folder.id === entry.folderId)?.name.trim();
    const reservedFolderNames = ['todos', 'geral', 'favoritos'];
    const folderLabel = folderName && !reservedFolderNames.includes(folderName.toLocaleLowerCase('pt-BR')) ? folderName : undefined;
    const content = getReadingNoteText(entry);
    return {
      entry,
      bookId: book.id,
      title: book.title,
      author: book.author,
      folderLabel,
      content,
    };
  })).sort((a, b) => b.entry.createdAt.localeCompare(a.entry.createdAt)), [books, readingFolders]);
  const visibleEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
    return entries.filter((item) => {
      const matchesFilter = filter === 'all'
        || (filter === 'favorites' && item.entry.isFavorite)
        || (filter.startsWith('folder:') && item.entry.folderId === filter.slice('folder:'.length));
      return matchesFilter && (!normalizedQuery || `${item.folderLabel ?? ''} ${item.content} ${item.title} ${item.author}`.toLocaleLowerCase('pt-BR').includes(normalizedQuery));
    });
  }, [entries, filter, query]);
  const columns = useMemo(() => {
    const result: DiaryItem[][] = Array.from({ length: columnCount }, () => []);
    const heights = Array.from({ length: columnCount }, () => 0);
    visibleEntries.forEach((item) => {
      const index = columnCount === 1 || heights[0] <= heights[1] ? 0 : 1;
      result[index].push(item);
      heights[index] += estimateCardHeight(item) + 12;
    });
    return { items: result, addColumnIndex: columnCount === 1 || heights[0] <= heights[1] ? 0 : 1 };
  }, [columnCount, visibleEntries]);

  const handleCreateNote = () => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const activeFolderId = filter.startsWith('folder:') ? filter.slice('folder:'.length) : undefined;
    router.navigate({ pathname: '/(tabs)/diary/note', params: activeFolderId ? { folderId: activeFolderId } : {} });
  };

  const handleCreateFolder = () => {
    if (!folderName.trim()) return;
    if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const folderId = addReadingFolder({ name: folderName, colorId: folderColorId });
    if (folderId) setFilter(`folder:${folderId}`);
    setFolderName('');
    setShowFolderSheet(false);
  };

  const openCreateFolder = () => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowFolderSheet(true);
  };

  const handleToggleFavorite = (item: DiaryItem) => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleFavorite(item.bookId, item.entry.id);
  };

  const handleDeleteSession = (session: ReadingSession) => {
    showAlert('Excluir sessão?', `“${session.name}” será removida do seu Diário.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => removeReadingSession(session.id) },
    ]);
  };

  const cardPress = (item: DiaryItem, noteColor: string) => router.navigate({
    pathname: '/(tabs)/diary/note',
    params: { bookId: item.bookId, entryId: item.entry.id, color: noteColor },
  });

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.screen, isNight && styles.darkScreen]}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text accessibilityRole="header" style={[styles.title, isNight && styles.darkTitle]}>Diário</Text>
            {activeSection === 'notes' ? (
              <Pressable accessibilityLabel="Criar pasta de notas" accessibilityRole="button" onPress={openCreateFolder} style={({ pressed }) => [styles.headerAction, isNight && styles.headerActionNight, pressed && styles.entryCardPressed]}>
                <Ionicons color={isNight ? darkTheme.selectionText : colors.sageDark} name="folder-outline" size={23} />
                <View style={[styles.headerActionPlus, isNight && styles.headerActionPlusNight]}>
                  <Ionicons color={colors.paper} name="add" size={12} />
                </View>
              </Pressable>
            ) : null}
          </View>
          <Text style={[styles.subtitle, isNight && styles.darkMutedText]}>
            {activeSection === 'notes' ? 'Reúna reflexões, trechos e ideias das suas leituras.' : 'Suas sessões de leitura, da mais recente à mais antiga.'}
          </Text>

          <SegmentedTabs
            items={[
              { id: 'notes', label: 'Notas de leitura', icon: 'journal-outline' },
              { id: 'activity', label: 'Atividade', icon: 'time-outline' },
            ]}
            isNight={isNight}
            selected={activeSection}
            onSelect={setActiveSection}
          />

          <Animated.View key={activeSection} entering={tabTransition} style={styles.sectionContent}>
            {activeSection === 'notes' ? (
              <>

                <View style={[styles.searchWrap, isNight && styles.darkSearchWrap, searchFocused && { borderColor: isNight ? darkTheme.selectionText : colors.sageDark }]}>
                  <Ionicons color={isNight ? darkTheme.textMuted : colors.muted} name="search" size={18} />
                  <AppTextInput
                    accessibilityLabel="Buscar notas de leitura"
                    onChangeText={setQuery}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    keyboardAppearance={isNight ? 'dark' : 'light'}
                    selectionColor={isNight ? darkTheme.selectionText : colors.sageDark}
                    placeholder="Buscar notas ou livros"
                    placeholderTextColor={isNight ? darkTheme.textMuted : colors.muted}
                    returnKeyType="search"
                    style={[styles.searchInput, isNight && styles.darkTitle]}
                    value={query}
                  />
                  {query.length > 0 ? (
                    <Pressable accessibilityLabel="Limpar busca" accessibilityRole="button" onPress={() => setQuery('')} style={styles.clearSearch}>
                      <Ionicons color={isNight ? darkTheme.textMuted : colors.muted} name="close-circle" size={18} />
                    </Pressable>
                  ) : null}
                </View>

                <ScrollView horizontal contentContainerStyle={styles.filters} showsHorizontalScrollIndicator={false}>
                  <FilterChip count={entries.length} isNight={isNight} label="Todas" selected={filter === 'all'} onPress={() => setFilter('all')} />
                    <FilterChip
                    count={entries.filter((item) => item.entry.isFavorite).length}
                    icon="star-outline"
                    isNight={isNight}
                    label="Favoritas"
                    selected={filter === 'favorites'}
                    onPress={() => setFilter('favorites')}
                  />
                  {readingFolders.map((folder) => {
                    const palette = READING_FOLDER_COLORS.find((color) => color.id === folder.colorId)!;
                    const selected = filter === `folder:${folder.id}`;
                    return (
                      <FilterChip
                        key={folder.id}
                        count={entries.filter((item) => item.entry.folderId === folder.id).length}
                        isNight={isNight}
                        label={folder.name}
                        selected={selected}
                        folderColors={{
                          background: isNight ? palette.dark : palette.light,
                          text: isNight ? palette.darkText : palette.text,
                          border: isNight ? palette.darkText : palette.text,
                        }}
                        onPress={() => setFilter(selected ? 'all' : `folder:${folder.id}`)}
                      />
                    );
                  })}
                </ScrollView>

                {books.length === 0 ? (
                  <ReadingEmptyState isNight={isNight}
                    artwork={require('@/assets/onboarding/reading-journal.webp')}
                    title="Seu diário começa com um livro"
                    description="Adicione um livro à biblioteca para escrever sua primeira nota."
                    label="Adicionar livro" icon="add" onPress={() => router.navigate('/books/catalog')} />
                ) : visibleEntries.length === 0 ? (
                  <ReadingEmptyState isNight={isNight}
                    artwork={!query.trim() ? require('@/assets/onboarding/reading-journal.webp') : undefined}
                    title={query.trim() ? 'Nenhuma nota encontrada' : filter === 'favorites' ? 'Nenhuma nota favorita' : filter.startsWith('folder:') ? 'Esta pasta ainda está vazia' : 'Suas notas começam aqui'}
                    description={query.trim() ? 'Tente buscar pelo livro ou por uma palavra da nota.' : filter === 'favorites' ? 'Marque uma nota com a estrela para encontrá-la aqui.' : 'Guarde uma ideia, um trecho ou uma impressão da leitura.'}
                    label={query.trim() ? 'Limpar busca' : filter === 'favorites' ? 'Ver todas as notas' : 'Criar nota'}
                    icon={query.trim() ? 'close' : filter === 'favorites' ? 'journal-outline' : 'add'}
                    onPress={query.trim() ? () => setQuery('') : filter === 'favorites' ? () => setFilter('all') : handleCreateNote} />
                ) : (
                  <View style={styles.columns}>
                    {columns.items.map((column, columnIndex) => (
                      <View key={columnIndex} style={styles.column}>
                        {column.map((item) => {
                          const noteColor = item.entry.color ?? READING_NOTE_COLORS[entries.findIndex((entry) => entry.entry.id === item.entry.id) % READING_NOTE_COLORS.length];
                          const notePalette = getReadingNotePalette(noteColor, isNight);
                          return (
                            <Pressable
                              key={item.entry.id}
                              accessibilityHint="Abre esta nota para editar"
                              accessibilityLabel={`${item.folderLabel ? `${item.folderLabel}. ` : ''}${item.content}. Livro: ${item.title}. ${formatDate(item.entry.createdAt)}`}
                              accessibilityRole="button"
                              onPress={() => cardPress(item, noteColor)}
                              style={({ pressed }) => [styles.entryCard, { backgroundColor: notePalette.surface, borderColor: notePalette.border }, pressed && styles.entryCardPressed]}
                            >
                              {item.folderLabel ? <Text numberOfLines={2} style={[styles.entryFolder, { color: notePalette.muted }]}>{item.folderLabel}</Text> : null}
                              <Text numberOfLines={8} style={[styles.entryText, { color: notePalette.text }]}>{item.content}</Text>
                              <View style={[styles.cardDivider, { backgroundColor: notePalette.border }]} />
                              <View style={styles.cardFooter}>
                                <View style={styles.entryBody}>
                                  <Text numberOfLines={2} style={[styles.bookTitle, { color: notePalette.muted }]}>{item.title}{item.entry.page ? ` · p. ${item.entry.page}` : ''}</Text>
                                  <Text numberOfLines={1} style={[styles.entryDate, { color: notePalette.muted }]}>{formatDate(item.entry.createdAt)}</Text>
                                </View>
                                <Pressable
                                  accessibilityLabel={item.entry.isFavorite ? 'Remover nota dos favoritos' : 'Adicionar nota aos favoritos'}
                                  accessibilityRole="button"
                                  accessibilityState={{ selected: item.entry.isFavorite }}
                                  onPress={(event) => { event.stopPropagation(); handleToggleFavorite(item); }}
                                  style={[styles.favoriteButton, { borderColor: notePalette.border }, item.entry.isFavorite && styles.favoriteButtonSelected, isNight && styles.favoriteButtonNight]}
                                >
                                  <Ionicons color={isNight ? darkTheme.selectionText : colors.sageDark} name={item.entry.isFavorite ? 'star' : 'star-outline'} size={18} />
                                </Pressable>
                              </View>
                            </Pressable>
                          );
                        })}
                        {columnIndex === columns.addColumnIndex ? (
                          <Pressable
                            accessibilityHint="Cria uma nota de leitura"
                            accessibilityLabel="Nova nota"
                            accessibilityRole="button"
                            onPress={handleCreateNote}
                            style={({ pressed }) => [styles.addNoteTile, isNight && styles.addNoteTileNight, pressed && styles.entryCardPressed]}
                          >
                            <Ionicons color={isNight ? darkTheme.selectionText : colors.sageDark} name="add" size={27} />
                          </Pressable>
                        ) : null}
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : orderedSessions.length === 0 ? (
              <ReadingEmptyState isNight={isNight}
                artwork={require('@/assets/onboarding/reading-timer.webp')}
                title="Cada leitura conta"
                description="Comece uma sessão ou registre uma leitura pela mesa. Seu histórico aparece aqui."
                label="Ir para minha sala" icon="home-outline" onPress={() => router.navigate('/')} />
            ) : (
              <View style={styles.activityList}>
                {orderedSessions.map((session) => (
                  <ActivityCard
                    key={session.id}
                    isNight={isNight}
                    session={session}
                    onOpen={() => router.push({ pathname: '/reading-session', params: { sessionId: session.id, returnTo: 'diary' } })}
                    onShare={() => router.push({ pathname: '/reading-session', params: { sessionId: session.id, returnTo: 'diary', openShare: '1' } })}
                    onEdit={() => router.push({ pathname: '/reading-log', params: { sessionId: session.id } })}
                    onDelete={() => handleDeleteSession(session)}
                  />
                ))}
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </View>

      <LibrarySheet
        backgroundColor={isNight ? darkTheme.surface : colors.paper}
        description="Organize suas notas por assunto, livro ou projeto."
        height={470}
        mutedColor={isNight ? darkTheme.textMuted : colors.muted}
        onClose={() => setShowFolderSheet(false)}
        textColor={isNight ? darkTheme.text : colors.ink}
        title="Nova pasta"
        visible={showFolderSheet}
      >
        <View style={styles.folderSheetContent}>
          <Text style={[styles.colorLabel, isNight && styles.darkMutedText]}>Nome da pasta</Text>
          <AppTextInput
            accessibilityLabel="Nome da pasta"
            onFocus={() => setFolderNameFocused(true)}
            onBlur={() => setFolderNameFocused(false)}
            selectionColor={isNight ? darkTheme.selectionText : colors.sageDark}
            keyboardAppearance={isNight ? 'dark' : 'light'}
            maxLength={32}
            onChangeText={setFolderName}
            onSubmitEditing={handleCreateFolder}
            placeholder="Ex.: Ideias para guardar"
            placeholderTextColor={isNight ? darkTheme.textMuted : colors.muted}
            returnKeyType="done"
            style={[styles.folderNameInput, isNight && styles.folderNameInputNight, folderNameFocused && { borderColor: isNight ? darkTheme.selectionText : colors.sageDark }]}
            value={folderName}
          />
          <Text style={[styles.colorLabel, isNight && styles.darkMutedText]}>Cor da pasta</Text>
          <View style={styles.folderColorGrid}>
            {READING_FOLDER_COLORS.map((folderColor) => {
              const selected = folderColorId === folderColor.id;
              return (
                <Pressable
                  key={folderColor.id}
                  accessibilityLabel={`Cor ${folderColor.name}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setFolderColorId(folderColor.id)}
                  style={[styles.folderColorChoice, { backgroundColor: isNight ? folderColor.dark : folderColor.light }, selected && styles.folderColorChoiceSelected, selected && isNight && { borderColor: colors.sageSoft }]}
                >
                  {selected ? <Ionicons color={isNight ? folderColor.darkText : folderColor.text} name="checkmark" size={20} /> : null}
                </Pressable>
              );
            })}
          </View>
          <Pressable accessibilityRole="button" disabled={!folderName.trim()} onPress={handleCreateFolder} style={({ pressed }) => [styles.createFolderButton, isNight && { backgroundColor: darkTheme.primary }, !folderName.trim() && styles.disabledAction, pressed && controls.buttonPressed]}>
            <Text style={[styles.createFolderText, isNight && { color: darkTheme.actionText }]}>Criar pasta</Text>
          </Pressable>
        </View>
      </LibrarySheet>

    </>
  );
}

function FilterChip({
  count,
  folderColors,
  icon,
  isNight,
  label,
  selected,
  onPress,
}: {
  count: number;
  folderColors?: { background: string; text: string; border: string };
  icon?: 'star-outline';
  isNight: boolean;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const accent = isNight ? darkTheme.selectionText : colors.sageDark;
  const background = folderColors?.background ?? (selected
    ? (isNight ? darkTheme.selection : colors.sageSoft)
    : (isNight ? darkTheme.surface : colors.paper));
  const textColor = folderColors?.text ?? (selected ? accent : isNight ? darkTheme.textMuted : colors.inkSoft);
  const border = selected ? (folderColors?.border ?? accent) : (isNight ? darkTheme.border : colors.line);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.filterChip, { backgroundColor: background, borderColor: border }, pressed && styles.entryCardPressed]}
    >
      {selected || icon ? <Ionicons color={textColor} name={selected ? 'checkmark' : icon} size={15} accessible={false} /> : null}
      <Text style={[styles.filterText, { color: textColor }]}>{label}</Text>
      <View style={[styles.countBadge, isNight && styles.countBadgeNight]}>
        <Text style={[styles.countText, { color: textColor }]}>{count}</Text>
      </View>
    </Pressable>
  );
}

function ActivityCard({
  session,
  isNight,
  onOpen,
  onShare,
  onEdit,
  onDelete,
}: {
  session: ReadingSession;
  isNight: boolean;
  onOpen: () => void;
  onShare: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const surface = isNight ? darkTheme.surface : colors.paper;
  const text = isNight ? darkTheme.text : colors.ink;
  const muted = isNight ? darkTheme.textMuted : colors.muted;
  const accent = isNight ? darkTheme.selectionText : colors.sageDark;
  const destructive = isNight ? darkTheme.danger : colors.danger;

  return (
    <View style={[styles.activityCard, { backgroundColor: surface, borderColor: isNight ? darkTheme.border : colors.line }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${session.name}, ${session.bookTitle}, ${formatDate(readingSessionDate(session))}, ${session.pagesRead} páginas lidas`}
        accessibilityHint="Abre o resumo da sessão"
        onPress={onOpen}
        style={({ pressed }) => [styles.activityPost, pressed && styles.entryCardPressed]}
      >
        <View style={styles.activityPostBody}>
          <BookCover color={session.coverColor} coverUrl={session.coverUrl} style={styles.activityCover}>
            {!session.coverUrl && <Ionicons name="book-outline" size={22} color={colors.paper} accessible={false} />}
          </BookCover>
          <View style={styles.activityCopy}>
            <View style={styles.activityHeading}>
              <Text style={[styles.activityName, { color: text }]}>{session.name.trim() || 'Sessão de leitura'}</Text>
              <Text numberOfLines={2} style={[styles.activityBook, { color: muted }]}>{session.bookTitle}</Text>
              <Text style={[styles.activityMetaText, { color: muted }]}>{formatDate(readingSessionDate(session))}</Text>
            </View>
            <View style={styles.activitySummary}>
              <View style={styles.activityStat}><Ionicons name="time-outline" color={muted} size={15} /><Text style={[styles.activitySummaryText, { color: muted }]}>{readingTimeLabel(session)}{session.durationSeconds === undefined ? '' : ` · ${formatReadingDuration(session.durationSeconds)}`}</Text></View>
              <Text style={[styles.activitySummaryText, { color: accent }]}>{session.pagesRead} {session.pagesRead === 1 ? 'página lida' : 'páginas lidas'}</Text>
            </View>
          </View>
        </View>
        {session.description?.trim() ? (
          <Text numberOfLines={6} style={[styles.activityDescription, { color: text }]}>{session.description.trim()}</Text>
        ) : null}
      </Pressable>
      <View style={[styles.activityActions, { borderTopColor: isNight ? darkTheme.border : colors.line }]}>
        <ActivityAction accessibilityLabel="Compartilhar sessão" color={accent} icon="share-outline" onPress={onShare} />
        <ActivityAction accessibilityLabel="Editar sessão" color={muted} icon="create-outline" onPress={onEdit} />
        <ActivityAction accessibilityLabel="Excluir sessão" color={destructive} icon="trash-outline" onPress={onDelete} />
      </View>
    </View>
  );
}

function ActivityAction({
  accessibilityLabel,
  color,
  icon,
  onPress,
}: {
  accessibilityLabel: string;
  color: string;
  icon: 'share-outline' | 'create-outline' | 'trash-outline';
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.activityAction, pressed && styles.entryCardPressed]}
    >
      <Ionicons color={color} name={icon} size={24} />
    </Pressable>
  );
}

const tabTransition = FadeIn.duration(90).reduceMotion(ReduceMotion.System);

const styles = StyleSheet.create({
  header: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: typography.editorial, fontSize: 30, lineHeight: 40, color: colors.ink },
  entryFolder: { color: colors.inkSoft, fontSize: 11, lineHeight: 17, fontWeight: '600' },
  activityHeading: { gap: 6 },
  activityStat: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 5 },
  screen: { flex: 1, backgroundColor: colors.cream },
  darkScreen: { backgroundColor: darkTheme.bg },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', gap: 16, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 24 },
  subtitle: { color: colors.muted, fontFamily: typography.ui, fontSize: 14, lineHeight: 21, minHeight: 46, textAlign: 'center', paddingHorizontal: 8, paddingBottom: 4 },
  sectionContent: { gap: 16 },
  darkTitle: { color: darkTheme.text },
  darkMutedText: { color: darkTheme.textMuted },
  searchWrap: { minHeight: controls.input.minHeight, paddingHorizontal: controls.input.paddingHorizontal, borderWidth: controls.input.borderWidth, borderColor: colors.line, borderRadius: radii.medium, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.paper },
  darkSearchWrap: { backgroundColor: darkTheme.inputBg, borderColor: darkTheme.inputBorder },
  searchInput: { flex: 1, paddingVertical: controls.input.paddingVertical, color: colors.ink, fontSize: controls.input.fontSize },
  clearSearch: { ...controls.iconButton, marginRight: -8 },
  filters: { flexDirection: 'row', gap: 8, paddingVertical: 2, paddingRight: 20 },
  filterChip: { minHeight: 44, maxWidth: 220, borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.full, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  filterText: { flexShrink: 1, fontSize: 13, fontWeight: '600' },
  countBadge: { minWidth: 20, height: 20, paddingHorizontal: 4, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.62)' },
  countBadgeNight: { backgroundColor: darkTheme.bg },
  countText: { fontSize: 10, fontWeight: '700', fontVariant: ['tabular-nums'] },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  column: { flex: 1, gap: 11 },
  entryCard: { borderRadius: radii.large, borderCurve: 'continuous', padding: 15, gap: 12, borderWidth: StyleSheet.hairlineWidth },
  entryCardPressed: { opacity: 0.86 },
  entryBody: { flex: 1, gap: 5 },
  entryText: { fontFamily: typography.editorial, fontSize: 16, lineHeight: 24 },
  favoriteButton: { ...controls.iconButton, flexShrink: 0, borderWidth: 1, borderColor: 'rgba(50, 37, 31, 0.16)', backgroundColor: 'rgba(255, 255, 255, 0.38)' },
  favoriteButtonNight: { backgroundColor: darkTheme.surfaceElevated, borderColor: darkTheme.border },
  favoriteButtonSelected: { backgroundColor: 'rgba(255, 255, 255, 0.64)' },
  cardDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(50, 37, 31, 0.2)', marginTop: 2, marginBottom: 0 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bookTitle: { color: colors.ink, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  entryDate: { color: colors.inkSoft, fontSize: 10, lineHeight: 15 },
  addNoteTile: { minHeight: 94, alignItems: 'center', justifyContent: 'center', borderRadius: radii.large, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, backgroundColor: 'transparent' },
  addNoteTileNight: { borderColor: darkTheme.border },
  activityList: { gap: 16 },
  activityCard: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.large, borderCurve: 'continuous' },
  activityPost: { gap: 14, padding: 16 },
  activityPostBody: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  activityCover: { width: 76, height: 114, borderRadius: radii.small, alignItems: 'center', justifyContent: 'center' },
  activityCopy: { flex: 1, minWidth: 0, minHeight: 114, justifyContent: 'space-between', gap: 14 },
  activityName: { fontFamily: typography.editorial, fontSize: 23, lineHeight: 31 },
  activityBook: { fontSize: 12, lineHeight: 18 },
  activityDescription: { fontSize: 14, lineHeight: 23 },
  activitySummary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  activitySummaryText: { flexShrink: 1, fontSize: 12, lineHeight: 18, fontVariant: ['tabular-nums'] },
  activityMetaText: { fontSize: 12, lineHeight: 18 },
  activityActions: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderTopWidth: StyleSheet.hairlineWidth },
  activityAction: { ...controls.iconButton },
  headerAction: { ...controls.iconButton, position: 'absolute', right: 0, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  headerActionNight: { backgroundColor: darkTheme.surface, borderColor: darkTheme.border },
  headerActionPlus: { position: 'absolute', right: 3, top: 4, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  headerActionPlusNight: { backgroundColor: colors.inkSoft },
  folderSheetContent: { gap: 15, paddingBottom: 8 },
  folderNameInput: { ...controls.input, borderRadius: radii.medium, borderCurve: 'continuous', borderColor: colors.line, color: colors.ink, backgroundColor: colors.softFill },
  folderNameInputNight: { color: darkTheme.text, backgroundColor: darkTheme.inputBg, borderColor: darkTheme.inputBorder },
  colorLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  folderColorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 13 },
  folderColorChoice: { width: 43, height: 43, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(50,37,31,0.14)' },
  folderColorChoiceSelected: { borderWidth: 2, borderColor: colors.sageDark },
  createFolderButton: { ...controls.button, marginTop: 3, backgroundColor: colors.ink },
  createFolderText: { ...controls.buttonText, color: colors.white },
  disabledAction: controls.buttonDisabled,
});
