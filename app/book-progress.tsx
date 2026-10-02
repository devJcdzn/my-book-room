import Ionicons from '@expo/vector-icons/Ionicons';
import { MenuView, type MenuAction } from '@expo/ui/community/menu';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookCover } from '@/src/components/book-cover';
import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { openLibraryClient, type OpenLibraryBookDetails } from '@/src/services/open-library';
import { deriveBookColor, useLibraryStore } from '@/src/store/library-store';
import { controls, colors, darkTheme, radii, typography } from '@/src/theme';
import type { Book, BookSearchResult } from '@/src/types/book';

const pageLimit = 99_999;

export default function BookProgressPage() {
  const params = useLocalSearchParams<{
    bookId?: string | string[];
    preview?: string | string[];
    from?: string | string[];
    shelfId?: string | string[];
    status?: string | string[];
    workKey?: string | string[];
    title?: string | string[];
    author?: string | string[];
    editionKey?: string | string[];
    coverId?: string | string[];
    coverUrl?: string | string[];
    isbn?: string | string[];
    firstPublishYear?: string | string[];
    totalPages?: string | string[];
  }>();
  const param = (value?: string | string[]) => Array.isArray(value) ? value[0] : value;
  const bookId = param(params.bookId);
  const previewRequested = param(params.preview) === 'true';
  const previewWorkKey = param(params.workKey);
  const previewTitle = param(params.title);
  const previewAuthor = param(params.author);
  const previewPages = Number(param(params.totalPages));
  const previewTargetStatus = param(params.status) === 'want-to-read' ? 'want-to-read' : 'reading';
  const previewResult = useMemo<BookSearchResult | undefined>(() => {
    if (!previewRequested || !previewWorkKey || !previewTitle) return undefined;
    const coverId = Number(param(params.coverId));
    const firstPublishYear = Number(param(params.firstPublishYear));
    return {
      workKey: previewWorkKey,
      title: previewTitle,
      author: previewAuthor || 'Autor desconhecido',
      ...(param(params.editionKey) ? { editionKey: param(params.editionKey) } : {}),
      ...(Number.isInteger(coverId) && coverId > 0 ? { coverId } : {}),
      ...(param(params.coverUrl) ? { coverUrl: param(params.coverUrl) } : {}),
      ...(param(params.isbn) ? { isbn: param(params.isbn) } : {}),
      ...(Number.isInteger(firstPublishYear) && firstPublishYear > 0 ? { firstPublishYear } : {}),
      ...(Number.isInteger(previewPages) && previewPages > 0 ? { totalPages: previewPages } : {}),
    };
  }, [previewRequested, previewWorkKey, previewTitle, previewAuthor, previewPages, params.coverId, params.firstPublishYear, params.editionKey, params.coverUrl, params.isbn]);
  const [failedHeaderCoverUrl, setFailedHeaderCoverUrl] = useState<string>();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const stackedHero = width < 360 || fontScale > 1.2;
  const books = useLibraryStore((state) => state.books);
  const deskBookIds = useLibraryStore((state) => state.deskBookIds);
  const completingBookId = useLibraryStore((state) => state.completingBookId);
  const readingShelves = useLibraryStore((state) => state.readingShelves);
  const completedShelves = useLibraryStore((state) => state.completedShelves);
  const wantToReadShelves = useLibraryStore((state) => state.wantToReadShelves);
  const shelfNames = useLibraryStore((state) => state.shelfNames);
  const activeReadingTimer = useLibraryStore((state) => state.activeReadingTimer);
  const selectActiveBook = useLibraryStore((state) => state.selectActiveBook);
  const startReadingTimer = useLibraryStore((state) => state.startReadingTimer);
  const removeFromDesk = useLibraryStore((state) => state.removeFromDesk);
  const addOpenLibraryBook = useLibraryStore((state) => state.addOpenLibraryBook);
  const updateProgress = useLibraryStore((state) => state.updateProgress);
  const updateTotalPages = useLibraryStore((state) => state.updateTotalPages);
  const updateOpinion = useLibraryStore((state) => state.updateOpinion);
  const moveBookToShelf = useLibraryStore((state) => state.moveBookToShelf);
  const removeBook = useLibraryStore((state) => state.removeBook);
  const completeBook = useLibraryStore((state) => state.completeBook);
  const requestCompletion = useLibraryStore((state) => state.requestCompletion);
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const isNight = resolveAmbience(ambienceMode) === 'night';
  const backgroundColor = isNight ? darkTheme.bg : colors.cream;
  const palette = {
    text: isNight ? darkTheme.text : colors.ink,
    muted: isNight ? darkTheme.textMuted : colors.muted,
    surface: isNight ? darkTheme.surface : colors.paper,
    surfaceStrong: isNight ? darkTheme.surfaceElevated : '#EFE4D6',
    border: isNight ? darkTheme.border : '#E8DCCD',
    fill: isNight ? darkTheme.accent : colors.terracotta,
    accent: isNight ? darkTheme.accent : colors.terracottaDark,
  };
  const cardPalette = palette;
  const savedBook = books.find((item) => item.id === bookId)
    ?? (previewResult ? books.find((item) => item.openLibraryWorkKey === previewResult.workKey) : undefined);
  const previewBook = useMemo<Book | undefined>(() => previewResult && !savedBook ? {
    id: previewResult.workKey,
    source: 'open-library',
    openLibraryWorkKey: previewResult.workKey,
    openLibraryEditionKey: previewResult.editionKey,
    coverId: previewResult.coverId,
    coverUrl: previewResult.coverUrl,
    isbn: previewResult.isbn,
    firstPublishYear: previewResult.firstPublishYear,
    title: previewResult.title,
    author: previewResult.author,
    coverColor: deriveBookColor(previewResult.workKey),
    totalPages: previewResult.totalPages ?? 0,
    currentPage: 0,
    status: previewTargetStatus,
  } : undefined, [previewResult, savedBook, previewTargetStatus]);
  const bookForLookup = savedBook ?? previewBook;

  const bookDetailsLookup = useMemo(() => bookForLookup ? ({
    bookId: bookForLookup.id,
    workKey: bookForLookup.openLibraryWorkKey,
    editionKey: bookForLookup.openLibraryEditionKey,
    isbn: bookForLookup.isbn,
    title: bookForLookup.title,
    author: bookForLookup.author,
  }) : undefined, [bookForLookup]);
  const [metadataState, setMetadataState] = useState<{
    key: string;
    status: 'loaded' | 'failed';
    details?: OpenLibraryBookDetails;
  }>();
  const [reloadMetadata, setReloadMetadata] = useState(0);
  const [pageDraft, setPageDraft] = useState<string>();
  const [editingProgress, setEditingProgress] = useState(false);
  const [totalDraft, setTotalDraft] = useState('');
  const [editingTotal, setEditingTotal] = useState(false);
  const [completionConfirmationVisible, setCompletionConfirmationVisible] = useState(false);
  const [reviewDraft, setReviewDraft] = useState('');
  const [editingReview, setEditingReview] = useState(false);
  const [completionRatingDraft, setCompletionRatingDraft] = useState<number>();
  const [pageCountPromptVisible, setPageCountPromptVisible] = useState(false);
  const [pageCountDraft, setPageCountDraft] = useState('');
  const [pageCountError, setPageCountError] = useState('');
  const [pendingPreviewAction, setPendingPreviewAction] = useState<'reading' | 'want-to-read'>('reading');
  const [previewPagesOverride, setPreviewPagesOverride] = useState<number>();
  const metadataKey = bookDetailsLookup ? `${bookDetailsLookup.bookId}:${reloadMetadata}` : '';
  const metadataLoading = Boolean(metadataKey) && (
    metadataState?.key !== metadataKey || metadataState.status !== 'loaded' && metadataState.status !== 'failed'
  );
  const metadataFailed = metadataState?.key === metadataKey && metadataState.status === 'failed';
  const details = metadataState?.key === metadataKey ? metadataState.details : undefined;
  const isPreview = Boolean(previewBook);
  const book = savedBook ?? (previewBook ? {
    ...previewBook,
    totalPages: previewBook.totalPages || previewPagesOverride || details?.editionPageCount || 0,
  } : undefined);
  const hasBibliographicDetails = Boolean(details && (
    details.subjects.length || details.publishers.length || details.publishDate
    || details.firstPublishDate || details.editionPageCount || details.isbn
  ));

  useEffect(() => {
    if (!bookDetailsLookup) return;
    const controller = new AbortController();
    const requestKey = `${bookDetailsLookup.bookId}:${reloadMetadata}`;
    void openLibraryClient.getBookDetails(bookDetailsLookup, controller.signal)
      .then((result) => setMetadataState({ key: requestKey, status: 'loaded', details: result }))
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        setMetadataState({ key: requestKey, status: 'failed' });
      });
    return () => controller.abort();
  }, [bookDetailsLookup, reloadMetadata]);

  if (!book) {
    return (
      <View style={[styles.unavailable, { backgroundColor }]}>
        <StatusBar style={isNight ? 'light' : 'dark'} />
        <Text style={[styles.unavailableTitle, { color: palette.text }]}>Nenhum livro selecionado</Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.secondaryAction}>
          <Text style={styles.secondaryActionLabel}>Voltar à biblioteca</Text>
        </Pressable>
      </View>
    );
  }

  const shelves = book.status === 'completed' ? completedShelves
    : book.status === 'want-to-read' ? wantToReadShelves : readingShelves;
  const shelfIndex = Math.max(0, shelves.indexOf(book.shelfId ?? ''));
  const shelfLabel = shelfNames[book.shelfId ?? ''] || `Prateleira ${shelfIndex + 1}`;
  const isOnDesk = deskBookIds.includes(book.id);
  const progress = book.totalPages > 0 ? Math.min(1, book.currentPage / book.totalPages) : 0;
  const completionLocked = Boolean(completingBookId);
  const isReading = book.status === 'reading';
  const canComplete = book.status !== 'completed' && book.status !== 'completing';
  const requestedShelfId = param(params.shelfId);

  const saveCatalogPreview = (status: 'reading' | 'want-to-read' | 'completed', totalPages: number, notes?: string, rating?: number) => {
    if (!previewResult) return;
    addOpenLibraryBook({ ...previewResult, totalPages }, {
      status,
      shelfId: status !== 'completed' && requestedShelfId ? requestedShelfId : undefined,
      notes,
      rating,
    });
    const saved = useLibraryStore.getState().books.find((item) => item.id === previewResult.workKey);
    if (saved) {
      if (Platform.OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({ pathname: '/book-progress', params: { bookId: saved.id } });
    }
  };

  const requestPreviewAdd = (status: 'reading' | 'want-to-read') => {
    if (!isPreview) return;
    if (book.totalPages > 0) {
      saveCatalogPreview(status, book.totalPages);
      return;
    }
    setPendingPreviewAction(status);
    setPageCountDraft('');
    setPageCountError('');
    setPageCountPromptVisible(true);
  };

  const confirmPageCount = () => {
    const totalPages = Number(pageCountDraft.trim());
    if (!Number.isInteger(totalPages) || totalPages < 1 || totalPages > pageLimit) {
      setPageCountError(`Informe um número entre 1 e ${pageLimit.toLocaleString('pt-BR')}.`);
      return;
    }
    setPreviewPagesOverride(totalPages);
    setPageCountPromptVisible(false);
    saveCatalogPreview(pendingPreviewAction, totalPages);
  };

  const openCompletionConfirmation = () => {
    if (!canComplete || completionLocked) return;
    setReviewDraft(book.notes ?? '');
    setCompletionRatingDraft(book.rating);
    setPageCountDraft('');
    setPageCountError('');
    setCompletionConfirmationVisible(true);
  };

  const confirmCompletion = () => {
    if (!canComplete || completionLocked) return;
    if (isPreview) {
      const totalPages = book.totalPages || Number(pageCountDraft.trim());
      if (!Number.isInteger(totalPages) || totalPages < 1 || totalPages > pageLimit) {
        setPageCountError(`Informe um número entre 1 e ${pageLimit.toLocaleString('pt-BR')}.`);
        return;
      }
      saveCatalogPreview('completed', totalPages, reviewDraft, completionRatingDraft);
      setCompletionConfirmationVisible(false);
      return;
    }
    if (book.status === 'want-to-read') {
      completeBook(book.id, { notes: reviewDraft, rating: completionRatingDraft ?? null });
      setCompletionConfirmationVisible(false);
      router.back();
      return;
    }
    updateOpinion(book.id, { notes: reviewDraft.trim(), rating: completionRatingDraft ?? null });
    setCompletionConfirmationVisible(false);
    if (Platform.OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
    setTimeout(() => requestCompletion(book.id), 180);
  };

  const commitPage = (value = pageDraft ?? String(book.currentPage)) => {
    const parsed = Number(value.trim());
    if (Number.isInteger(parsed)) updateProgress(book.id, Math.min(book.totalPages, Math.max(0, parsed)));
    setPageDraft(undefined);
    setEditingProgress(false);
  };

  const saveTotalPages = () => {
    const parsed = Number(totalDraft.trim());
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > pageLimit) {
      Alert.alert('Total inválido', `Informe um número entre 1 e ${pageLimit.toLocaleString('pt-BR')}.`);
      return;
    }
    if (isPreview) setPreviewPagesOverride(parsed);
    else updateTotalPages(book.id, parsed);
    setEditingTotal(false);
  };

  const confirmRemove = () => {
    Alert.alert('Remover livro', `Deseja remover “${book.title}” da sua biblioteca?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () => {
          if (Platform.OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          removeBook(book.id);
          router.back();
        },
      },
    ]);
  };

  const actionMenu: MenuAction[] = [
    ...(isOnDesk ? [{ id: 'remove-from-desk', title: 'Retirar da mesa' }] : []),
    {
      id: 'move-shelf',
      title: `Mover de ${shelfLabel}`,
      subactions: shelves.map((shelfId, index) => ({
        id: `shelf:${shelfId}`,
        title: shelfNames[shelfId] || `Prateleira ${index + 1}`,
        state: shelfId === book.shelfId ? 'on' : 'off',
      })),
    },
    { id: 'remove-book', title: 'Remover da biblioteca', attributes: { destructive: true } },
  ];

  const onMenuAction = (event: string) => {
    if (event === 'remove-from-desk') {
      removeFromDesk(book.id);
      return;
    }
    if (event === 'remove-book') {
      confirmRemove();
      return;
    }
    if (event.startsWith('shelf:')) moveBookToShelf(book.id, event.slice('shelf:'.length));
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor }]}
    >
      <StatusBar style={isNight ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 20) + (isPreview ? 108 : 24) },
        ]}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View pointerEvents="none" style={[styles.backgroundScene, { height: insets.top + 350 }]}>
          {book.coverUrl && book.coverUrl !== failedHeaderCoverUrl ? (
            <Image
              source={{ uri: book.coverUrl }}
              contentFit="cover"
              contentPosition="center"
              onError={() => setFailedHeaderCoverUrl(book.coverUrl)}
              style={[StyleSheet.absoluteFill, { opacity: isNight ? 0.34 : 0.42 }]}
            />
          ) : (
            <>
              <Image source={require('@/assets/images/book-details-background.png')} contentFit="cover" contentPosition="top right" style={StyleSheet.absoluteFill} />
              {isNight ? <View style={[StyleSheet.absoluteFill, styles.backgroundShade]} /> : null}
            </>
          )}
          <View style={[styles.backgroundFade, { experimental_backgroundImage: `linear-gradient(to bottom, ${backgroundColor}00, ${backgroundColor})` }]} />
        </View>
        <View style={styles.header}>
          <RoundButton accessibilityLabel="Voltar" icon="chevron-back" onPress={() => router.back()} palette={palette} />
          {!isPreview ? (
            <MenuView
              actions={actionMenu}
              onPressAction={(event) => onMenuAction(event.nativeEvent.event)}
              style={styles.menuTrigger}
              title="Opções do livro"
            >
              <View accessible accessibilityLabel="Mais opções do livro" style={[styles.roundButton, { borderColor: palette.border, backgroundColor: palette.surface }]}>
                <Ionicons color={palette.text} name="ellipsis-horizontal" size={21} />
              </View>
            </MenuView>
          ) : <View style={styles.menuTrigger} />}
        </View>

        <View style={[styles.hero, stackedHero && styles.heroStacked]}>
          <BookCover color={book.coverColor} coverUrl={book.coverUrl} style={styles.cover} />
          <View style={[styles.heroCopy, stackedHero && styles.heroCopyStacked]}>
            <Text selectable style={[styles.title, { color: palette.text }]}>{book.title}</Text>
            <Text selectable style={[styles.author, { color: palette.muted }]}>{book.author}</Text>
            <View style={[styles.bookStatus, { backgroundColor: isNight ? darkTheme.surface : 'rgba(250,245,238,0.9)' }]}>
              <Ionicons color={palette.accent} name={isOnDesk ? 'book' : 'book-outline'} size={16} />
              <Text style={[styles.bookStatusText, { color: palette.text }]}>
                {isOnDesk ? 'Este livro está na mesa'
                  : isPreview ? 'Prévia do catálogo'
                    : book.status === 'want-to-read' ? 'Na sua lista de leitura'
                      : book.status === 'completed' ? 'Concluído'
                        : 'Na sua biblioteca'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            accessibilityRole="button"
            disabled={book.status === 'completed' || completionLocked}
            onPress={() => {
              if (book.status === 'completed' || completionLocked) return;
              if (isPreview) {
                requestPreviewAdd(previewTargetStatus);
                return;
              }
              if (Platform.OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (activeReadingTimer) {
                router.replace('/reading-timer');
                return;
              }
              if (!selectActiveBook(book.id)) {
                Alert.alert('Mesa cheia', 'A mesa comporta até três livros. Remova um livro da mesa antes de começar outro.');
                return;
              }
              if (startReadingTimer(book.id)) router.replace('/reading-timer');
            }}
            style={({ pressed }) => [
              styles.startButton,
              { backgroundColor: isNight ? darkTheme.accentDark : colors.terracotta },
              (book.status === 'completed' || completionLocked) && styles.disabledButton,
              pressed && book.status !== 'completed' && styles.pressed,
            ]}
          >
            <Ionicons color={colors.paper} name={isPreview ? 'add' : 'play'} size={17} />
            <Text numberOfLines={1} style={styles.startButtonText}>
              {book.status === 'completed' ? 'Leitura concluída'
                : isPreview ? previewTargetStatus === 'want-to-read' ? 'Adicionar à lista' : 'Adicionar livro'
                  : activeReadingTimer ? 'Retomar sessão'
                    : isOnDesk ? 'Continuar' : 'Começar'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Concluir leitura"
            accessibilityRole="button"
            disabled={!canComplete || completionLocked}
            onPress={openCompletionConfirmation}
            style={({ pressed }) => [
              styles.completeButton,
              { borderColor: palette.border, backgroundColor: palette.surface },
              (!canComplete || completionLocked) && styles.disabledButton,
              pressed && canComplete && styles.pressed,
            ]}
          >
            <Ionicons color={palette.accent} name="checkmark" size={25} />
          </Pressable>
        </View>

        <View style={[styles.progressCard, { backgroundColor: cardPalette.surface }]}>
          <View style={styles.progressHeading}>
            <Text style={[styles.sectionLabel, { color: cardPalette.muted }]}>Progresso</Text>
            <Text style={[styles.progressPercent, { color: cardPalette.text }]}>{Math.round(progress * 100)}%</Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: cardPalette.surfaceStrong }]}>
            <View style={[styles.progressFill, { backgroundColor: cardPalette.fill, width: `${progress * 100}%` }]} />
          </View>
          {isReading && !isPreview ? (
            <View style={styles.progressActions}>
              {editingProgress ? (
                <View style={styles.pageInputGroup}>
                  <TextInput
                    accessibilityLabel={`Página atual de ${book.title}`}
                    autoFocus
                    keyboardType="number-pad"
                    maxLength={5}
                    onChangeText={setPageDraft}
                    onSubmitEditing={() => commitPage()}
                    returnKeyType="done"
                    selectTextOnFocus
                    style={[styles.pageInput, { color: cardPalette.text, borderColor: cardPalette.border }]}
                    value={pageDraft ?? String(book.currentPage)}
                  />
                  <Text style={[styles.pageTotal, { color: cardPalette.muted }]}>/ {book.totalPages} páginas</Text>
                  <Pressable accessibilityLabel="Salvar progresso" accessibilityRole="button" onPress={() => commitPage()} style={styles.progressIconButton}>
                    <Ionicons color={cardPalette.text} name="checkmark" size={19} />
                  </Pressable>
                  <Pressable accessibilityLabel="Cancelar edição do progresso" accessibilityRole="button" onPress={() => { setPageDraft(undefined); setEditingProgress(false); }} style={styles.progressIconButton}>
                    <Ionicons color={cardPalette.muted} name="close" size={19} />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.pageDisplayRow}>
                  <Text style={[styles.pageCount, { color: cardPalette.text }]}>
                    {book.currentPage} <Text style={{ color: cardPalette.muted, fontWeight: '400' }}>/ {book.totalPages} páginas</Text>
                  </Text>
                  <Pressable
                    accessibilityLabel="Editar progresso de leitura"
                    accessibilityRole="button"
                    onPress={() => { setPageDraft(String(book.currentPage)); setEditingProgress(true); }}
                    style={styles.progressIconButton}
                  >
                    <Ionicons color={cardPalette.muted} name="create-outline" size={19} />
                  </Pressable>
                </View>
              )}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setTotalDraft(String(book.totalPages));
                  setEditingTotal((value) => !value);
                }}
                style={styles.textAction}
              >
                <Text style={[styles.textActionLabel, { color: cardPalette.muted }]}>Editar total</Text>
              </Pressable>
            </View>
          ) : book.status === 'completed' ? (
            <Text style={[styles.completedLabel, { color: cardPalette.text }]}>Leitura concluída · {book.totalPages} páginas</Text>
          ) : <Text style={[styles.completedLabel, { color: cardPalette.muted }]}>{book.totalPages > 0 ? `0 / ${book.totalPages} páginas` : 'Total de páginas não informado'}</Text>}
          {editingTotal ? (
            <View style={styles.totalEditor}>
              <TextInput
                accessibilityLabel="Novo total de páginas"
                autoFocus
                keyboardType="number-pad"
                maxLength={5}
                onChangeText={setTotalDraft}
                onSubmitEditing={saveTotalPages}
                returnKeyType="done"
                selectTextOnFocus
                style={[styles.totalInput, { borderColor: cardPalette.border, color: cardPalette.text }]}
                value={totalDraft}
              />
              <Pressable accessibilityRole="button" onPress={saveTotalPages} style={styles.totalSaveButton}>
                <Text style={[styles.totalSaveLabel, { color: cardPalette.text }]}>Salvar</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setEditingTotal(false)} style={styles.totalCancelButton}>
                <Text style={[styles.totalSaveLabel, { color: cardPalette.muted }]}>Cancelar</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {!isPreview ? <View style={[styles.sectionCard, { backgroundColor: cardPalette.surface, borderColor: cardPalette.border }]}>
          <View style={styles.ratingSection}>
            <Text style={[styles.sectionTitle, { color: cardPalette.text }]}>Sua avaliação</Text>
            <View accessibilityLabel="Avaliação por estrelas" style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Pressable
                  key={value}
                  accessibilityLabel={`${value} ${value === 1 ? 'estrela' : 'estrelas'}`}
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => {
                    if (Platform.OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    updateOpinion(book.id, { rating: book.rating === value ? null : value });
                  }}
                  style={styles.starTouch}
                >
                  <Ionicons
                    color={value <= (book.rating ?? 0) ? cardPalette.accent : cardPalette.border}
                    name={value <= (book.rating ?? 0) ? 'star' : 'star-outline'}
                    size={22}
                  />
                </Pressable>
              ))}
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => setEditingReview((value) => !value)}
            style={({ pressed }) => [styles.reviewButton, { backgroundColor: cardPalette.surfaceStrong }, pressed && styles.pressed]}
          >
            <Ionicons name="create-outline" size={19} color={cardPalette.accent} />
            <Text style={[styles.reviewButtonText, { color: cardPalette.accent }]}>{editingReview ? 'Fechar resenha' : book.notes?.trim() ? 'Editar sua resenha' : 'Escrever uma resenha'}</Text>
            <Ionicons name={editingReview ? 'chevron-up' : 'chevron-forward'} size={17} color={cardPalette.accent} />
          </Pressable>
          {editingReview ? (
            <TextInput
              accessibilityLabel={`Resenha de ${book.title}`}
              multiline
              onChangeText={(notes) => updateOpinion(book.id, { notes })}
              placeholder="Guarde sua impressão sobre o livro."
              placeholderTextColor={cardPalette.muted}
              scrollEnabled={false}
              style={[styles.notesInput, { color: cardPalette.text, backgroundColor: cardPalette.surfaceStrong, borderColor: cardPalette.border }]}
              textAlignVertical="top"
              value={book.notes ?? ''}
            />
          ) : book.notes?.trim() ? (
            <Text selectable style={[styles.description, { color: cardPalette.muted }]}>{book.notes.trim()}</Text>
          ) : null}
        </View> : null}

        {details?.description || metadataLoading || metadataFailed ? (
          <View style={[styles.sectionCard, { backgroundColor: cardPalette.surface, borderColor: cardPalette.border }]}>
            <Text style={[styles.sectionTitle, { color: cardPalette.text }]}>Sobre o livro</Text>
            {details?.description ? (
              <Text selectable style={[styles.description, { color: cardPalette.muted }]}>{details.description}</Text>
            ) : metadataLoading ? (
              <Text style={[styles.description, { color: cardPalette.muted }]}>Carregando informações da Open Library…</Text>
            ) : metadataFailed ? (
              <Pressable accessibilityRole="button" onPress={() => setReloadMetadata((value) => value + 1)}>
                <Text style={[styles.description, { color: cardPalette.muted }]}>Não foi possível carregar os dados. Tentar novamente</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {book.totalPages > 0 || book.firstPublishYear || book.isbn || hasBibliographicDetails ? (
          <View style={[styles.sectionCard, { backgroundColor: cardPalette.surface, borderColor: cardPalette.border }]}>
            <Text style={[styles.sectionTitle, { color: cardPalette.text }]}>Informações</Text>
            <BibliographicDetails details={details ?? { subjects: [], publishers: [], firstPublishDate: book.firstPublishYear?.toString(), isbn: book.isbn }} localPages={book.totalPages} palette={cardPalette} />
          </View>
        ) : null}
      </ScrollView>
        {isPreview && previewTargetStatus !== 'want-to-read' ? (
        <View style={[styles.previewFooter, { backgroundColor, paddingBottom: Math.max(insets.bottom, 14) }]}>
          <Pressable accessibilityRole="button" onPress={() => requestPreviewAdd('want-to-read')} style={({ pressed }) => [styles.wantToReadButton, { borderColor: palette.border }, pressed && styles.pressed]}>
            <Ionicons color={palette.text} name="bookmark-outline" size={18} />
            <Text style={[styles.wantToReadLabel, { color: palette.text }]}>Quero ler</Text>
          </Pressable>
        </View>
      ) : null}
      <Modal
        animationType="slide"
        onRequestClose={() => setPageCountPromptVisible(false)}
        transparent
        visible={pageCountPromptVisible}
      >
        <View style={styles.modalOverlay}>
          <Pressable accessibilityLabel="Fechar" onPress={() => setPageCountPromptVisible(false)} style={StyleSheet.absoluteFill} />
          <View style={[styles.pageCountSheet, { backgroundColor: palette.surface, paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
            <View style={styles.sheetGrabber} />
            <Text style={[styles.sheetTitle, { color: palette.text }]}>Total de páginas</Text>
            <Text style={[styles.sheetDescription, { color: palette.muted }]}>Informe o total desta edição para salvar o livro na sua estante.</Text>
            <TextInput
              accessibilityLabel="Total de páginas do livro"
              autoFocus
              keyboardType="number-pad"
              maxLength={5}
              onChangeText={(value) => { setPageCountDraft(value); setPageCountError(''); }}
              onSubmitEditing={confirmPageCount}
              placeholder="Ex.: 320"
              placeholderTextColor={palette.muted}
              returnKeyType="done"
              style={[styles.pageCountPromptInput, { color: palette.text, backgroundColor: palette.surfaceStrong, borderColor: palette.border }]}
              value={pageCountDraft}
            />
            {pageCountError ? <Text style={styles.pageCountError}>{pageCountError}</Text> : null}
            <View style={styles.sheetActions}>
              <Pressable accessibilityRole="button" onPress={() => setPageCountPromptVisible(false)} style={styles.sheetCancelButton}>
                <Text style={[styles.sheetCancelLabel, { color: palette.text }]}>Cancelar</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={confirmPageCount} style={[styles.sheetConfirmButton, { backgroundColor: palette.fill }]}>
                <Text style={[styles.sheetConfirmLabel, { color: isNight ? darkTheme.actionText : colors.paper }]}>Continuar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="slide"
        onRequestClose={() => setCompletionConfirmationVisible(false)}
        statusBarTranslucent
        transparent
        visible={completionConfirmationVisible}
      >
        <View style={styles.modalOverlay}>
          <Pressable accessibilityLabel="Fechar confirmação" onPress={() => setCompletionConfirmationVisible(false)} style={StyleSheet.absoluteFill} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalKeyboard}>
            <View style={[styles.completionSheet, { backgroundColor: palette.surface, paddingBottom: Math.max(insets.bottom, 20) + 12 }]}>
              <View style={styles.sheetGrabber} />
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={[styles.sheetTitle, { color: palette.text }]}>Concluir leitura</Text>
                <Text style={[styles.sheetDescription, { color: palette.muted }]}>Guarde sua impressão final. A resenha e a avaliação são opcionais.</Text>
                {isPreview && book.totalPages < 1 ? (
                  <>
                    <TextInput
                      accessibilityLabel="Total de páginas do livro"
                      keyboardType="number-pad"
                      maxLength={5}
                      onChangeText={(value) => { setPageCountDraft(value); setPageCountError(''); }}
                      placeholder="Total de páginas"
                      placeholderTextColor={palette.muted}
                      style={[styles.pageCountPromptInput, { color: palette.text, backgroundColor: palette.surfaceStrong, borderColor: palette.border }]}
                      value={pageCountDraft}
                    />
                    {pageCountError ? <Text style={styles.pageCountError}>{pageCountError}</Text> : null}
                  </>
                ) : null}
                <TextInput
                  accessibilityLabel="Resenha final opcional"
                  multiline
                  onChangeText={setReviewDraft}
                  placeholder="O que você vai levar deste livro?"
                  placeholderTextColor={palette.muted}
                  style={[styles.reviewDraftInput, { color: palette.text, backgroundColor: palette.surfaceStrong, borderColor: palette.border }]}
                  textAlignVertical="top"
                  value={reviewDraft}
                />
                <View style={styles.completionRating}>
                  <Text style={[styles.completionRatingLabel, { color: palette.text }]}>Sua avaliação</Text>
                  <View style={styles.ratingRow}>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Pressable
                        key={value}
                        accessibilityLabel={`${value} ${value === 1 ? 'estrela' : 'estrelas'}`}
                        accessibilityRole="button"
                        onPress={() => setCompletionRatingDraft(completionRatingDraft === value ? undefined : value)}
                        style={styles.starTouch}
                      >
                        <Ionicons color={value <= (completionRatingDraft ?? 0) ? palette.fill : palette.border} name={value <= (completionRatingDraft ?? 0) ? 'star' : 'star-outline'} size={25} />
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={styles.sheetActions}>
                  <Pressable accessibilityRole="button" onPress={() => setCompletionConfirmationVisible(false)} style={styles.sheetCancelButton}>
                    <Text style={[styles.sheetCancelLabel, { color: palette.text }]}>Agora não</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={confirmCompletion} style={[styles.sheetConfirmButton, { backgroundColor: palette.fill }]}>
                    <Text style={[styles.sheetConfirmLabel, { color: isNight ? darkTheme.actionText : colors.paper }]}>Concluir leitura</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function RoundButton({
  accessibilityLabel,
  icon,
  onPress,
  palette,
}: {
  accessibilityLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  palette: { text: string; surface: string; border: string };
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.roundButton,
        { borderColor: palette.border, backgroundColor: palette.surface },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons color={palette.text} name={icon} size={21} />
    </Pressable>
  );
}

function BibliographicDetails({
  details,
  localPages,
  palette,
}: {
  details: OpenLibraryBookDetails;
  localPages: number;
  palette: { text: string; muted: string; border: string; surfaceStrong: string };
}) {
  const facts = [
    localPages > 0 ? ['Páginas', String(localPages)] : undefined,
    details.publishers.length ? ['Editora', details.publishers.join(', ')] : undefined,
    details.publishDate ? ['Edição', details.publishDate] : undefined,
    details.firstPublishDate ? ['Publicado originalmente', details.firstPublishDate] : undefined,
    details.editionPageCount && details.editionPageCount !== localPages
      ? ['Páginas nesta edição', String(details.editionPageCount)]
      : undefined,
    details.isbn ? ['ISBN', details.isbn] : undefined,
  ].filter((fact): fact is [string, string] => Boolean(fact));

  if (!facts.length && !details.subjects.length) return null;
  return (
    <View style={[styles.metadata, { borderTopColor: palette.border }]}>
      {facts.map(([label, value]) => (
        <View key={label} style={styles.metadataRow}>
          <Text style={[styles.metadataLabel, { color: palette.muted }]}>{label}</Text>
          <Text selectable style={[styles.metadataValue, { color: palette.text }]}>{value}</Text>
        </View>
      ))}
      {details.subjects.length ? (
        <View style={styles.subjects}>
          <Text style={[styles.metadataLabel, { color: palette.muted }]}>Assuntos</Text>
          <View style={styles.subjectList}>
            {details.subjects.map((subject) => (
              <View key={subject} style={[styles.subjectPill, { backgroundColor: palette.surfaceStrong, borderColor: palette.border }]}>
                <Text style={[styles.subjectText, { color: palette.text }]}>{subject}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 14, paddingHorizontal: 16 },
  backgroundScene: { position: 'absolute', top: 0, left: 0, right: 0 },
  backgroundShade: { backgroundColor: 'rgba(32,30,28,0.75)' },
  backgroundFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 105 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 },
  menuTrigger: { width: controls.iconButton.width, height: controls.iconButton.height },
  roundButton: { ...controls.iconButton, borderWidth: 1 },
  hero: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, paddingHorizontal: 6, paddingTop: 2, paddingBottom: 2 },
  heroStacked: { flexDirection: 'column', alignItems: 'center' },
  heroCopy: { flex: 1, minWidth: 0, gap: 10, minHeight: 204 },
  heroCopyStacked: { alignSelf: 'stretch', flex: 0, minHeight: 0 },
  cover: { width: 136, height: 204, borderRadius: 8, borderCurve: 'continuous', boxShadow: '0 8px 20px rgba(36, 20, 15, 0.24)' },
  title: { fontFamily: typography.editorial, fontSize: 22, lineHeight: 28 },
  author: { fontSize: 14, lineHeight: 21 },
  bookStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 9, borderRadius: 12 },
  bookStatusText: { fontSize: 12, lineHeight: 18, flexShrink: 1 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 6 },
  startButton: { ...controls.button, flex: 1, flexDirection: 'row', gap: 6, backgroundColor: colors.terracotta },
  startButtonText: { ...controls.buttonText, color: colors.paper, lineHeight: 22, flexShrink: 1 },
  completeButton: { ...controls.iconButton, borderWidth: 1 },
  disabledButton: { opacity: 0.55 },
  pressed: { opacity: 0.78 },
  progressCard: { gap: 10, padding: 16, borderRadius: 22, borderCurve: 'continuous' },
  progressHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionLabel: { fontSize: 14, fontWeight: '600' },
  progressPercent: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  progressTrack: { height: 6, overflow: 'hidden', borderRadius: radii.full },
  progressFill: { height: '100%', borderRadius: radii.full },
  progressActions: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pageInputGroup: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pageInput: { minWidth: 48, paddingHorizontal: 5, paddingVertical: 3, borderBottomWidth: 1, fontSize: 16, fontWeight: '700', textAlign: 'right', fontVariant: ['tabular-nums'] },
  pageTotal: { fontSize: 13 },
  pageDisplayRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  pageCount: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  progressIconButton: { ...controls.iconButton },
  textAction: { minHeight: controls.iconButton.height, justifyContent: 'center', paddingHorizontal: 4 },
  textActionLabel: { fontSize: 13, fontWeight: '600' },
  completedLabel: { paddingVertical: 2, fontSize: 14, fontWeight: '600' },
  totalEditor: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  totalInput: { ...controls.input, flex: 1 },
  totalSaveButton: { minHeight: controls.iconButton.height, justifyContent: 'center', paddingHorizontal: 12 },
  totalCancelButton: { minHeight: controls.iconButton.height, justifyContent: 'center', paddingHorizontal: 4 },
  totalSaveLabel: { fontSize: 14, fontWeight: '600' },
  ratingSection: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionTitle: { fontFamily: typography.editorial, fontSize: 19, lineHeight: 26 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  starTouch: { minWidth: 28, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  sectionCard: { gap: 12, padding: 16, borderRadius: 22, borderCurve: 'continuous' },
  description: { fontSize: 14, lineHeight: 23 },
  metadata: { gap: 14 },
  metadataRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  metadataLabel: { width: 112, fontSize: 13, fontWeight: '500' },
  metadataValue: { flex: 1, fontSize: 14, lineHeight: 20 },
  subjects: { gap: 9, paddingTop: 2 },
  subjectList: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  subjectPill: { paddingVertical: 2 },
  subjectText: { fontSize: 12 },
  reviewButton: { ...controls.button, flexDirection: 'row', gap: 9 },
  reviewButtonText: { ...controls.buttonText, flex: 1 },
  notesInput: { ...controls.input, minHeight: 112, lineHeight: 23 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20, 14, 12, 0.44)' },
  modalKeyboard: { flex: 1, justifyContent: 'flex-end' },
  completionSheet: { maxHeight: '88%', paddingHorizontal: 22, paddingTop: 10, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderCurve: 'continuous' },
  sheetGrabber: { width: 44, height: 5, alignSelf: 'center', marginBottom: 16, borderRadius: 3, backgroundColor: 'rgba(120, 108, 98, 0.36)' },
  pageCountSheet: { paddingHorizontal: 22, paddingTop: 10, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderCurve: 'continuous' },
  pageCountPromptInput: { ...controls.input, minHeight: 52, marginBottom: 4, borderColor: '#E5D8C8', color: colors.ink, backgroundColor: '#F2E8D9' },
  pageCountError: { marginTop: 5, color: '#B7463D', fontSize: 13 },
  previewFooter: { paddingHorizontal: 22, paddingTop: 10 },
  wantToReadButton: { ...controls.button, flexDirection: 'row', gap: 8, borderWidth: 1 },
  wantToReadLabel: { fontSize: 15, fontWeight: '600' },
  sheetTitle: { marginBottom: 6, color: colors.ink, fontFamily: typography.editorial, fontSize: 25, fontWeight: '600', lineHeight: 32 },
  sheetDescription: { marginBottom: 18, color: colors.muted, fontSize: 14, lineHeight: 20 },
  reviewDraftInput: { ...controls.input, minHeight: 112, borderColor: '#E5D8C8', color: colors.ink, backgroundColor: '#F2E8D9', lineHeight: 22 },
  completionRating: { minHeight: 58, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  completionRatingLabel: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  sheetCancelButton: { ...controls.button, flex: 1, borderWidth: 1, borderColor: '#E5D8C8' },
  sheetCancelLabel: { ...controls.buttonText, color: colors.ink },
  sheetConfirmButton: { ...controls.button, flex: 1.3, backgroundColor: colors.terracotta },
  sheetConfirmLabel: { ...controls.buttonText, color: colors.paper },
  unavailable: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 },
  unavailableTitle: { fontFamily: typography.editorial, fontSize: 24 },
  secondaryAction: { ...controls.button, backgroundColor: colors.paper },
  secondaryActionLabel: { ...controls.buttonText, color: colors.ink },
});
