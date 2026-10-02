import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { LibrarySheet } from '@/src/components/library-sheet';
import { BookCover } from '@/src/components/book-cover';
import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { useLibraryStore } from '@/src/store/library-store';
import { controls, colors, darkTheme, getReadingNotePalette, radii, typography } from '@/src/theme';
import type { ReadingEntry, ReadingSession } from '@/src/types/book';
import { READING_FOLDER_COLORS, READING_NOTE_COLORS, getReadingNoteText } from '@/src/utils/reading-note';
import { formatReadingDuration } from '@/src/utils/reading-session';

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
  const [filter, setFilter] = useState<DiaryFilter>('all');
  const [showFolderSheet, setShowFolderSheet] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderColorId, setFolderColorId] = useState<string>(READING_FOLDER_COLORS[0].id);
  const [activeSection, setActiveSection] = useState<'notes' | 'activity'>('notes');

  const orderedSessions = useMemo(
    () => [...readingSessions].sort((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt)),
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
    Alert.alert('Excluir sessão?', `“${session.name}” será removida do seu Diário.`, [
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
                <Ionicons color={isNight ? darkTheme.accent : colors.terracottaDark} name="folder-outline" size={23} />
                <View style={[styles.headerActionPlus, isNight && styles.headerActionPlusNight]}>
                  <Ionicons color={colors.paper} name="add" size={12} />
                </View>
              </Pressable>
            ) : null}
          </View>
          <Text style={[styles.subtitle, isNight && styles.darkMutedText]}>
            {activeSection === 'notes' ? 'Reúna reflexões, trechos e ideias das suas leituras.' : 'Suas sessões de leitura, da mais recente à mais antiga.'}
          </Text>

          <View accessibilityRole="tablist" style={[styles.sectionTabs, isNight && styles.sectionTabsNight]}>
            <SectionTab active={activeSection === 'notes'} isNight={isNight} icon="journal-outline" label="Notas de leitura" onPress={() => setActiveSection('notes')} />
            <SectionTab active={activeSection === 'activity'} isNight={isNight} icon="time-outline" label="Atividade" onPress={() => setActiveSection('activity')} />
          </View>

          {activeSection === 'notes' ? (
            <>

              <View style={[styles.searchWrap, isNight && styles.darkSearchWrap]}>
                <Ionicons color={isNight ? darkTheme.textMuted : colors.muted} name="search" size={18} />
                <TextInput
                  accessibilityLabel="Buscar notas de leitura"
                  onChangeText={setQuery}
                  placeholder="Buscar notas ou livros"
                  placeholderTextColor={isNight ? darkTheme.textMuted : colors.muted}
                  returnKeyType="search"
                  style={[styles.searchInput, isNight && styles.darkTitle]}
                  value={query}
                />
                {query.length > 0 ? (
                  <Pressable accessibilityLabel="Limpar busca" onPress={() => setQuery('')} hitSlop={8}>
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
                <View style={styles.emptyState}>
                  <Image source={require('@/assets/images/diary-notes-empty.png')} contentFit="contain" style={styles.emptyArtwork} accessible={false} />
                  <Text style={[styles.emptyTitle, isNight && styles.darkTitle]}>Seu diário começa com um livro</Text>
                  <Text style={[styles.emptyText, isNight && styles.darkMutedText]}>Adicione um livro à biblioteca para criar sua primeira nota.</Text>
                  <Pressable accessibilityRole="button" onPress={() => router.navigate('/books/catalog')} style={styles.emptyAction}>
                    <Text style={styles.emptyActionText}>Adicionar livro</Text>
                  </Pressable>
                </View>
              ) : visibleEntries.length === 0 ? (
                <View style={styles.emptyState}>
                  {query.trim() ? (
                    <View style={[styles.emptySearchIcon, isNight && styles.emptySearchIconNight]}><Ionicons color={isNight ? darkTheme.accent : colors.sage} name="search-outline" size={32} /></View>
                  ) : <Image source={require('@/assets/images/diary-notes-empty.png')} contentFit="contain" style={styles.emptyArtwork} accessible={false} />}
                  <Text style={[styles.emptyTitle, isNight && styles.darkTitle]}>
                    {query.trim() ? 'Nenhuma nota encontrada' : filter === 'favorites' ? 'Suas favoritas ficam aqui' : filter.startsWith('folder:') ? 'Esta pasta ainda está vazia' : 'Suas notas começam aqui'}
                  </Text>
                  <Text style={[styles.emptyText, isNight && styles.darkMutedText]}>
                    {query.trim() ? 'Tente buscar pelo livro, pelo título ou por uma palavra da nota.' : filter === 'favorites' ? 'Toque na estrela de uma nota para encontrá-la aqui sempre que quiser.' : filter.startsWith('folder:') ? 'Crie uma nota para reunir suas ideias nesta pasta.' : 'Guarde uma ideia, um trecho marcante ou uma impressão da sua leitura.'}
                  </Text>
                  <Pressable accessibilityRole="button" onPress={query.trim() ? () => setQuery('') : filter === 'favorites' ? () => setFilter('all') : handleCreateNote} style={styles.emptyAction}>
                    {!query.trim() && filter !== 'favorites' ? <Ionicons color={colors.white} name="add" size={18} /> : null}
                    <Text style={styles.emptyActionText}>{query.trim() ? 'Limpar busca' : filter === 'favorites' ? 'Explorar notas' : 'Nova nota'}</Text>
                  </Pressable>
                </View>
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
                                <Ionicons color={isNight ? darkTheme.accent : colors.terracottaDark} name={item.entry.isFavorite ? 'star' : 'star-outline'} size={18} />
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
                          <Ionicons color={isNight ? darkTheme.accent : colors.terracotta} name="add" size={27} />
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </>
          ) : orderedSessions.length === 0 ? (
            <View style={styles.emptyState}>
              <Image source={require('@/assets/images/diary-activity-empty.png')} contentFit="contain" style={styles.emptyArtwork} accessible={false} />
              <Text style={[styles.emptyTitle, isNight && styles.darkTitle]}>Cada leitura conta</Text>
              <Text style={[styles.emptyText, isNight && styles.darkMutedText]}>Inicie uma leitura na sua sala. As sessões salvas ficam aqui para você revisitar.</Text>
              <Pressable accessibilityRole="button" onPress={() => router.navigate('/')} style={styles.emptyAction}><Ionicons name="book-outline" size={18} color={colors.paper} /><Text style={styles.emptyActionText}>Ir para minha sala</Text></Pressable>
            </View>
          ) : (
            <View style={styles.activityList}>
              {orderedSessions.map((session) => (
                <ActivityCard
                  key={session.id}
                  isNight={isNight}
                  session={session}
                  onOpen={() => router.push({ pathname: '/reading-session', params: { sessionId: session.id, returnTo: 'diary' } })}
                  onShare={() => router.push({ pathname: '/reading-session', params: { sessionId: session.id, returnTo: 'diary', openShare: '1' } })}
                  onEdit={() => router.push({ pathname: '/(tabs)/diary/session-edit', params: { sessionId: session.id } })}
                  onDelete={() => handleDeleteSession(session)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </View>

      <LibrarySheet
        backgroundColor={isNight ? darkTheme.surface : colors.paper}
        description="Dê um nome e escolha uma cor para filtrar suas notas."
        height={470}
        mutedColor={isNight ? darkTheme.textMuted : colors.muted}
        onClose={() => setShowFolderSheet(false)}
        textColor={isNight ? darkTheme.text : colors.ink}
        title="Nova pasta"
        visible={showFolderSheet}
      >
        <View style={styles.folderSheetContent}>
          <TextInput
            accessibilityLabel="Nome da pasta"
            maxLength={32}
            onChangeText={setFolderName}
            onSubmitEditing={handleCreateFolder}
            placeholder="Ex.: Ideias para guardar"
            placeholderTextColor={isNight ? darkTheme.textMuted : colors.muted}
            returnKeyType="done"
            style={[styles.folderNameInput, isNight && styles.folderNameInputNight]}
            value={folderName}
          />
          <Text style={[styles.colorLabel, isNight && styles.darkMutedText]}>Cor do filtro</Text>
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
                  style={[styles.folderColorChoice, { backgroundColor: isNight ? folderColor.dark : folderColor.light }, selected && styles.folderColorChoiceSelected]}
                >
                  {selected ? <Ionicons color={isNight ? folderColor.darkText : folderColor.text} name="checkmark" size={20} /> : null}
                </Pressable>
              );
            })}
          </View>
          <Pressable accessibilityRole="button" disabled={!folderName.trim()} onPress={handleCreateFolder} style={[styles.createFolderButton, !folderName.trim() && styles.disabledAction]}>
            <Text style={styles.createFolderText}>Criar pasta</Text>
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
  const background = folderColors?.background ?? (isNight ? darkTheme.surface : colors.softFill);
  const textColor = folderColors?.text ?? (isNight ? darkTheme.textMuted : colors.inkSoft);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.filterChip, { backgroundColor: selected && !folderColors ? (isNight ? darkTheme.accentDark : colors.terracotta) : background }, selected && folderColors && { borderWidth: 1, borderColor: folderColors.border }]}
    >
      {icon ? <Ionicons color={selected && !folderColors ? colors.white : textColor} name={selected ? 'star' : icon} size={15} /> : null}
      <Text numberOfLines={1} style={[styles.filterText, { color: selected && !folderColors ? colors.white : textColor }]}>{label}</Text>
      <View style={[styles.countBadge, selected && !folderColors && styles.selectedCountBadge, isNight && styles.countBadgeNight]}>
        <Text style={[styles.countText, { color: selected && !folderColors ? colors.white : textColor }]}>{count}</Text>
      </View>
    </Pressable>
  );
}

function SectionTab({ active, icon, isNight, label, onPress }: { active: boolean; icon: 'journal-outline' | 'time-outline'; isNight: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={() => {
        if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
        onPress();
      }}
      style={styles.sectionTab}
    >
      <View style={styles.sectionTabLabel}>
        <Ionicons name={icon} size={20} color={active ? (isNight ? darkTheme.accent : colors.terracottaDark) : (isNight ? darkTheme.textMuted : colors.muted)} />
        <Text style={[styles.sectionTabText, { color: active ? (isNight ? darkTheme.text : colors.ink) : (isNight ? darkTheme.textMuted : colors.muted), fontWeight: active ? '600' : '500' }]}>{label}</Text>
      </View>
      <View style={[styles.sectionTabIndicator, { backgroundColor: active ? (isNight ? darkTheme.accent : colors.terracotta) : 'transparent' }]} />
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
  const accent = isNight ? darkTheme.accent : colors.terracotta;
  const destructive = isNight ? '#FF8A80' : '#B3261E';

  return (
    <View style={[styles.activityCard, { backgroundColor: surface, borderColor: isNight ? darkTheme.border : colors.line }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${session.name}, ${session.bookTitle}, ${formatDate(session.endedAt)}, ${session.pagesRead} páginas lidas`}
        accessibilityHint="Abre o resumo da sessão"
        onPress={onOpen}
        style={({ pressed }) => [styles.activityPost, pressed && styles.entryCardPressed]}
      >
        <Text numberOfLines={1} style={[styles.activityBook, { color: muted }]}>{session.bookTitle} · {session.bookAuthor}</Text>
        <View style={styles.activityPostBody}>
          <BookCover color={session.coverColor} coverUrl={session.coverUrl} style={styles.activityCover} />
          <View style={styles.activityCopy}>
            <View style={styles.activityHeading}>
              <Text style={[styles.activityName, { color: text }]}>{session.name.trim() || 'Sessão de leitura'}</Text>
              <Text style={[styles.activityMetaText, { color: muted }]}>{formatDate(session.endedAt)}</Text>
            </View>
            <View style={styles.activitySummary}>
              <View style={styles.activityStat}><Ionicons name="time-outline" color={muted} size={15} /><Text style={[styles.activitySummaryText, { color: muted }]}>{formatReadingDuration(session.durationSeconds)}</Text></View>
              <Text style={[styles.activitySummaryText, { color: muted }]}>{session.pagesRead} {session.pagesRead === 1 ? 'página lida' : 'páginas lidas'}</Text>
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

const styles = StyleSheet.create({
  header: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: typography.editorial, fontSize: 30, lineHeight: 40, color: colors.ink },
  sectionTabLabel: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6 },
  entryFolder: { color: colors.inkSoft, fontSize: 11, lineHeight: 17, fontWeight: '600' },
  emptyArtwork: { width: 170, height: 150 },
  emptySearchIcon: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', borderRadius: 38, backgroundColor: colors.sageSoft, marginBottom: 8 },
  emptySearchIconNight: { backgroundColor: darkTheme.surfaceElevated },
  activityHeading: { gap: 6 },
  activityStat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  screen: { flex: 1, backgroundColor: colors.cream },
  darkScreen: { backgroundColor: darkTheme.bg },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', gap: 16, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 24 },
  subtitle: { color: colors.muted, fontFamily: typography.ui, fontSize: 14, lineHeight: 21, minHeight: 46, textAlign: 'center', paddingHorizontal: 8, paddingBottom: 4 },
  sectionTabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  sectionTabsNight: { borderBottomColor: darkTheme.border },
  sectionTab: { minHeight: 54, flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 8 },
  sectionTabText: { flexShrink: 1, fontFamily: typography.ui, fontSize: 14, lineHeight: 20 },
  sectionTabIndicator: { width: '82%', height: 3, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  darkTitle: { color: darkTheme.text },
  darkMutedText: { color: darkTheme.textMuted },
  searchWrap: { minHeight: controls.input.minHeight, paddingHorizontal: controls.input.paddingHorizontal, borderWidth: controls.input.borderWidth, borderColor: colors.line, borderRadius: controls.input.borderRadius, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.paper },
  darkSearchWrap: { backgroundColor: darkTheme.inputBg, borderColor: darkTheme.inputBorder },
  searchInput: { flex: 1, paddingVertical: controls.input.paddingVertical, color: colors.ink, fontSize: controls.input.fontSize },
  filters: { flexDirection: 'row', gap: 8, paddingVertical: 2, paddingRight: 20 },
  filterChip: { minHeight: 40, maxWidth: 190, borderRadius: radii.full, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  filterText: { flexShrink: 1, fontSize: 13, fontWeight: '600' },
  countBadge: { minWidth: 20, height: 20, paddingHorizontal: 4, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.62)' },
  countBadgeNight: { backgroundColor: 'rgba(0,0,0,0.2)' },
  selectedCountBadge: { backgroundColor: 'rgba(255,255,255,0.2)' },
  countText: { fontSize: 10, fontWeight: '700', fontVariant: ['tabular-nums'] },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  column: { flex: 1, gap: 11 },
  entryCard: { borderRadius: radii.large, padding: 14, gap: 10, borderWidth: 1, borderColor: 'rgba(50, 37, 31, 0.08)' },
  entryCardPressed: { opacity: 0.86 },
  entryBody: { flex: 1, gap: 5 },
  entryText: { fontFamily: typography.editorial, fontSize: 15, lineHeight: 22 },
  favoriteButton: { ...controls.iconButton, flexShrink: 0, borderWidth: 1, borderColor: 'rgba(50, 37, 31, 0.16)', backgroundColor: 'rgba(255, 255, 255, 0.38)' },
  favoriteButtonNight: { backgroundColor: darkTheme.surfaceElevated, borderColor: darkTheme.border },
  favoriteButtonSelected: { backgroundColor: 'rgba(255, 255, 255, 0.64)' },
  cardDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(50, 37, 31, 0.2)', marginTop: 2, marginBottom: 0 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bookTitle: { color: colors.ink, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  entryDate: { color: colors.inkSoft, fontSize: 10, lineHeight: 15 },
  addNoteTile: { minHeight: 94, alignItems: 'center', justifyContent: 'center', borderRadius: radii.large, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, backgroundColor: 'transparent' },
  addNoteTileNight: { borderColor: darkTheme.border },
  emptyState: { alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 28 },
  emptyTitle: { color: colors.ink, fontFamily: typography.editorial, fontSize: 23, lineHeight: 31, textAlign: 'center', maxWidth: 310 },
  emptyText: { color: colors.muted, fontSize: 14, lineHeight: 22, textAlign: 'center', maxWidth: 300 },
  activityList: { gap: 16 },
  activityCard: { overflow: 'hidden', borderWidth: 1, borderRadius: radii.large },
  activityPost: { gap: 14, padding: 16 },
  activityPostBody: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  activityCover: { width: 76, height: 114, borderRadius: 8 },
  activityCopy: { flex: 1, minWidth: 0, minHeight: 114, justifyContent: 'space-between', gap: 14 },
  activityName: { fontFamily: typography.editorial, fontSize: 23, lineHeight: 31 },
  activityBook: { fontSize: 12, lineHeight: 18 },
  activityDescription: { fontSize: 14, lineHeight: 23 },
  activitySummary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  activitySummaryText: { fontSize: 12, lineHeight: 18, fontVariant: ['tabular-nums'] },
  activityMetaText: { fontSize: 12, lineHeight: 18 },
  activityActions: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderTopWidth: StyleSheet.hairlineWidth },
  activityAction: { ...controls.iconButton },
  emptyAction: { ...controls.button, flexDirection: 'row', gap: 8, backgroundColor: colors.terracotta, marginTop: 8 },
  emptyActionText: { ...controls.buttonText, color: colors.white },
  headerAction: { ...controls.iconButton, position: 'absolute', right: 0, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  headerActionNight: { backgroundColor: darkTheme.surface, borderColor: darkTheme.border },
  headerActionPlus: { position: 'absolute', right: 3, top: 4, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.terracotta },
  headerActionPlusNight: { backgroundColor: darkTheme.accentDark },
  folderSheetContent: { gap: 15, paddingBottom: 8 },
  folderNameInput: { ...controls.input, borderColor: colors.line, color: colors.ink, backgroundColor: colors.softFill },
  folderNameInputNight: { color: darkTheme.text, backgroundColor: darkTheme.inputBg, borderColor: darkTheme.inputBorder },
  colorLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  folderColorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 13 },
  folderColorChoice: { width: 43, height: 43, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(50,37,31,0.14)' },
  folderColorChoiceSelected: { borderWidth: 2, borderColor: colors.terracotta },
  createFolderButton: { ...controls.button, marginTop: 3, backgroundColor: colors.terracotta },
  createFolderText: { ...controls.buttonText, color: colors.white },
  disabledAction: { opacity: 0.45 },
});
