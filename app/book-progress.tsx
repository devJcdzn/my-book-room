import { TransitionModal } from '@/src/components/transition-modal';
import { AppTextInput, FieldError } from '@/src/components/app-text-input';
import { showAlert, showMenu } from '@/src/components/app-dialog';
import { trackEvent } from '@/src/services/analytics';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookCover } from '@/src/components/book-cover';
import { resolveAmbience } from '@/src/types/ambience';
import { isValidIsbn, normalizeIsbn, openLibraryClient, type OpenLibraryBookDetails } from '@/src/services/open-library';
import { deriveBookColor, useLibraryStore } from '@/src/store/library-store';
import { controls, colors, darkTheme, radii, typography } from '@/src/theme';
import type { Book, BookSearchResult } from '@/src/types/book';

const pageLimit = 99_999;
const amazonAssociateTag = process.env.EXPO_PUBLIC_AMAZON_ASSOCIATE_TAG?.trim();

const amazonSearchUrlForBook = (book: Pick<Book, 'title' | 'author' | 'isbn'>) => {
  if (!amazonAssociateTag) return undefined;

  const normalizedIsbn = book.isbn?.trim();
  const searchQuery = normalizedIsbn && isValidIsbn(normalizedIsbn)
    ? normalizeIsbn(normalizedIsbn)
    : [book.title, book.author === 'Autor desconhecido' ? undefined : book.author].filter(Boolean).join(' ');

  return `https://www.amazon.com.br/s?k=${encodeURIComponent(searchQuery)}&tag=${encodeURIComponent(amazonAssociateTag)}`;
};

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
  const palette = {
    isDark: isNight,
    background: isNight ? darkTheme.bg : colors.cream,
    surface: isNight ? darkTheme.surface : colors.paper,
    surfaceStrong: isNight ? darkTheme.surfaceElevated : colors.softFill,
    text: isNight ? darkTheme.text : colors.ink,
    muted: isNight ? darkTheme.textMuted : colors.muted,
    border: isNight ? darkTheme.border : colors.line,
    accent: isNight ? darkTheme.selectionText : colors.sageDark,
    fill: isNight ? darkTheme.primary : colors.ink,
    actionText: isNight ? darkTheme.actionText : colors.paper,
  };
  const backgroundColor = palette.background;
  const cardPalette = palette;

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
  const [totalError, setTotalError] = useState('');
  const [editingTotal, setEditingTotal] = useState(false);
  const [completionConfirmationVisible, setCompletionConfirmationVisible] = useState(false);
  const [reviewDraft, setReviewDraft] = useState('');
  const [editingReview, setEditingReview] = useState(false);
  const [expandedSynopsisId, setExpandedSynopsisId] = useState<string>();
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
  const synopsisExpanded = Boolean(book && expandedSynopsisId === book.id);
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
        <StatusBar style={palette.isDark ? 'light' : 'dark'} />
        <Text style={[styles.unavailableTitle, { color: palette.text }]}>Nenhum livro selecionado</Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.secondaryAction}>
          <Text style={styles.secondaryActionLabel}>Voltar à biblioteca</Text>
        </Pressable>
      </View>
    );
  }

  const amazonSearchUrl = amazonSearchUrlForBook(book);
  const openAmazonBook = () => {
    if (!amazonSearchUrl) return;
    void Linking.openURL(amazonSearchUrl)
      .then(() => trackEvent('amazon_affiliate_link_opened', { surface: isPreview ? 'catalog' : 'library' }))
      .catch(() => showAlert('Não foi possível abrir a Amazon', 'Tente novamente em instantes.'));
  };

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
      if (param(params.from) === 'onboarding') {
        useLibraryStore.getState().setOnboardingStep(7);
        router.dismissTo('/onboarding');
      } else {
        router.replace({ pathname: '/book-progress', params: { bookId: saved.id } });
      }
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
      setTotalError(`Informe um número entre 1 e ${pageLimit.toLocaleString('pt-BR')}.`);
      return;
    }
    if (isPreview) setPreviewPagesOverride(parsed);
    else updateTotalPages(book.id, parsed);
    setEditingTotal(false);
  };

  const confirmRemove = () => {
    showAlert('Remover livro', `Deseja remover “${book.title}” da sua biblioteca?`, [
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

  const openReadingLog = (mode?: 'completion') => {
    if (!mode) trackEvent('reading_action_used', { action: 'register', surface: 'book' });
    router.push({ pathname: '/reading-log', params: { bookId: book.id, ...(mode ? { mode } : {}) } });
  };

  const onMenuAction = (event: string) => {
    if (event === 'register-reading' || event === 'completion-date') {
      openReadingLog(event === 'completion-date' ? 'completion' : undefined);
      return;
    }
    if (event === 'correct-page') { setEditingProgress(true); return; }
    if (event === 'reopen') {
      showAlert('Reabrir leitura?', 'Os registros serão preservados. A data de conclusão será removida.', [
        { text: 'Cancelar', style: 'cancel' }, { text: 'Reabrir', onPress: () => useLibraryStore.getState().reopenBook(book.id) },
      ]); return;
    }
    if (event === 'remove-from-desk') {
      removeFromDesk(book.id);
      return;
    }
  };

  const openBookMenu = () => showMenu('Opções do livro', [
    { text: 'Registrar leitura', onPress: () => onMenuAction('register-reading') },
    ...(book.status === 'reading' ? [{ text: 'Corrigir página', onPress: () => onMenuAction('correct-page') }] : []),
    ...(book.status === 'completed' ? [
      { text: 'Data de conclusão', onPress: () => onMenuAction('completion-date') },
      { text: 'Reabrir leitura', onPress: () => onMenuAction('reopen') },
    ] : []),
    ...(isOnDesk ? [{ text: 'Retirar da mesa', onPress: () => onMenuAction('remove-from-desk') }] : []),
    {
      text: `Mover de ${shelfLabel}`,
      opensMenu: true,
      onPress: () => showMenu('Mover para prateleira', shelves.map((shelfId, index) => ({
        text: shelfNames[shelfId] || `Prateleira ${index + 1}`,
        selected: shelfId === book.shelfId,
        onPress: () => moveBookToShelf(book.id, shelfId),
      }))),
    },
    { text: 'Remover da biblioteca', style: 'destructive', onPress: confirmRemove },
  ]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor }]}
    >
      <StatusBar style={palette.isDark ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 20) + (isPreview ? 108 : 24) },
        ]}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <RoundButton accessibilityLabel="Voltar" icon="chevron-back" onPress={() => router.back()} palette={palette} />
          {!isPreview ? (
            <RoundButton accessibilityLabel="Mais opções do livro" icon="ellipsis-horizontal" onPress={openBookMenu} palette={palette} />
          ) : <View style={styles.menuTrigger} />}
        </View>

        <View style={[styles.hero, stackedHero && styles.heroStacked]}>
          <BookCover color={book.coverColor} coverUrl={book.coverUrl} style={styles.cover}>
            {!book.coverUrl && (
              <View style={styles.coverFallback} accessible={false}>
                <Text numberOfLines={5} style={styles.coverTitle}>{book.title}</Text>
              </View>
            )}
          </BookCover>
          <View style={[styles.heroCopy, stackedHero && styles.heroCopyStacked]}>
            <Text selectable style={[styles.title, { color: palette.text, textAlign: stackedHero ? 'center' : 'left' }]}>{book.title}</Text>
            <Text selectable style={[styles.author, { color: palette.muted }]}>{book.author}</Text>
            <View style={[styles.bookStatus, { backgroundColor: palette.surface }]}>
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

        {!isPreview && book.status === 'completed' ? (
          <Pressable accessibilityRole="button" onPress={() => openReadingLog('completion')} style={styles.textAction}>
            <Text style={{ color: palette.text }}>
              Conclusão: {book.completedOn?.split('-').reverse().join('/') ?? 'Informar data'}
            </Text>
          </Pressable>
        ) : null}
        <View style={styles.readingActions}>
          {book.status !== 'completed' && <Pressable
            accessibilityRole="button"
            disabled={completionLocked}
            onPress={() => {
              if (completionLocked) return;
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
                showAlert('Mesa cheia', 'A mesa comporta até três livros. Remova um livro da mesa antes de começar outro.');
                return;
              }
              if (startReadingTimer(book.id)) router.replace('/reading-timer');
            }}
            style={({ pressed }) => [
              styles.startButton,
              { backgroundColor: palette.fill },
              completionLocked && styles.disabledButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons color={palette.actionText} name={isPreview ? 'add' : 'play'} size={17} />
            <Text style={[styles.startButtonText, { color: palette.actionText }]}>
              {isPreview ? previewTargetStatus === 'want-to-read' ? 'Adicionar à lista' : 'Adicionar livro'
                  : activeReadingTimer ? 'Retomar sessão'
                    : isOnDesk ? 'Continuar leitura' : 'Começar leitura'}
            </Text>
          </Pressable>}
          {!isPreview && <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => openReadingLog()}
              style={({ pressed }) => [styles.startButton, styles.registerButton, {
                backgroundColor: isNight ? darkTheme.selection : colors.sageSoft,
              }, pressed && styles.pressed]}
            >
              <Ionicons name="create-outline" color={palette.accent} size={18} accessible={false} />
              <Text style={[styles.startButtonText, { color: palette.accent }]}>Registrar leitura</Text>
            </Pressable>
            {canComplete && <Pressable
              accessibilityLabel="Concluir leitura"
              accessibilityRole="button"
              disabled={completionLocked}
              onPress={openCompletionConfirmation}
              style={({ pressed }) => [
                styles.completeButton,
                { borderColor: palette.border, backgroundColor: palette.surface },
                completionLocked && styles.disabledButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons color={palette.accent} name="checkmark" size={25} />
            </Pressable>}
          </View>}
        </View>

        {amazonSearchUrl ? (
          <View style={[styles.sectionCard, { backgroundColor: cardPalette.surface, borderColor: cardPalette.border }]}>
            <Pressable
              accessibilityLabel={`Ver opções de ${book.title} na Amazon`}
              accessibilityRole="link"
              onPress={openAmazonBook}
              style={({ pressed }) => [styles.amazonButton, pressed && styles.pressed]}
            >
              <FontAwesome name="amazon" size={23} color={colors.ink} accessible={false} />
              <Text style={styles.amazonButtonText}>Ver opções na Amazon</Text>
              <Ionicons color={colors.ink} name="open-outline" size={17} accessible={false} />
            </Pressable>
            <Text style={[styles.amazonCaption, { color: cardPalette.muted }]}>Encontre este livro na Amazon.</Text>
          </View>
        ) : null}

        <View style={[styles.progressCard, { backgroundColor: cardPalette.surface, borderColor: cardPalette.border }]}>
          <View style={styles.progressHeading}>
            <Text style={[styles.sectionLabel, { color: cardPalette.muted }]}>Progresso</Text>
            <Text style={[styles.progressPercent, { color: cardPalette.text }]}>{Math.round(progress * 100)}%</Text>
          </View>
          <View accessible accessibilityRole="progressbar" accessibilityLabel="Progresso da leitura" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }} style={[styles.progressTrack, { backgroundColor: cardPalette.surfaceStrong }]}>
            <View style={[styles.progressFill, { backgroundColor: cardPalette.accent, width: `${progress * 100}%` }]} />
          </View>
          {isReading && !isPreview ? (
            <View style={styles.progressActions}>
              {editingProgress ? (
                <View style={styles.pageInputGroup}>
                  <AppTextInput
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
                  <Pressable accessibilityLabel="Corrigir página" accessibilityRole="button" onPress={() => commitPage()} style={styles.progressIconButton}>
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
                    accessibilityLabel="Corrigir página"
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
                  setTotalError('');
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
            <View>
              <View style={styles.totalEditor}>
                <AppTextInput
                  accessibilityLabel="Novo total de páginas"
                  autoFocus
                  keyboardType="number-pad"
                  maxLength={5}
                  invalid={Boolean(totalError)}
                  onChangeText={value => { setTotalDraft(value); setTotalError(''); }}
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
              <FieldError isNight={palette.isDark} message={totalError} />
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
                    color={value <= (book.rating ?? 0) ? cardPalette.accent : cardPalette.muted}
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
            <AppTextInput
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

        {metadataKey ? (
          <View style={[styles.sectionCard, { backgroundColor: cardPalette.surface, borderColor: cardPalette.border }]}>
            {details?.description ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={synopsisExpanded ? 'Recolher sinopse' : 'Expandir sinopse'}
                accessibilityState={{ expanded: synopsisExpanded }}
                onPress={() => setExpandedSynopsisId(synopsisExpanded ? undefined : book.id)}
                style={({ pressed }) => [styles.synopsisHeading, pressed && styles.pressed]}
              >
                <Text style={[styles.sectionTitle, { color: cardPalette.text }]}>Sobre o livro</Text>
                <Ionicons name={synopsisExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={cardPalette.text} />
              </Pressable>
            ) : <View style={styles.synopsisHeading}><Text style={[styles.sectionTitle, { color: cardPalette.text }]}>Sobre o livro</Text></View>}
            <View style={!synopsisExpanded && styles.synopsisPreview}>
              {details?.description ? (
                <Text selectable numberOfLines={synopsisExpanded ? undefined : 4} style={[styles.description, { color: cardPalette.muted }]}>{details.description}</Text>
              ) : metadataLoading ? (
                <View accessibilityLabel="Carregando sinopse" accessibilityState={{ busy: true }} accessible style={styles.synopsisSkeleton}>
                  {(['100%', '94%', '98%', '65%'] as const).map(width => (
                    <View key={width} style={[styles.synopsisSkeletonLine, { width, backgroundColor: cardPalette.surfaceStrong }]} />
                  ))}
                </View>
              ) : metadataFailed ? (
                <Pressable accessibilityRole="button" onPress={() => setReloadMetadata((value) => value + 1)}>
                  <Text style={[styles.description, { color: cardPalette.muted }]}>Não foi possível carregar os dados. Tentar novamente</Text>
                </Pressable>
              ) : (
                <Text style={[styles.description, { color: cardPalette.muted }]}>Sinopse indisponível na Open Library.</Text>
              )}
            </View>
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
      <TransitionModal
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
            <AppTextInput
              accessibilityLabel="Total de páginas do livro"
              autoFocus
              keyboardType="number-pad"
              maxLength={5}
              invalid={Boolean(pageCountError)}
              onChangeText={(value) => { setPageCountDraft(value); setPageCountError(''); }}
              onSubmitEditing={confirmPageCount}
              placeholder="Ex.: 320"
              placeholderTextColor={palette.muted}
              returnKeyType="done"
              style={[styles.pageCountPromptInput, { color: palette.text, backgroundColor: palette.surfaceStrong, borderColor: palette.border }]}
              value={pageCountDraft}
            />
            <FieldError isNight={palette.isDark} message={pageCountError} />
            <View style={styles.sheetActions}>
              <Pressable accessibilityRole="button" onPress={() => setPageCountPromptVisible(false)} style={({ pressed }) => [styles.sheetCancelButton, pressed && styles.pressed]}>
                <Text style={[styles.sheetCancelLabel, { color: palette.text }]}>Cancelar</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={confirmPageCount} style={({ pressed }) => [styles.sheetConfirmButton, { backgroundColor: palette.fill }, pressed && styles.pressed]}>
                <Text style={[styles.sheetConfirmLabel, { color: palette.actionText }]}>Continuar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </TransitionModal>
      <TransitionModal
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
                <View style={styles.completionBook}>
                  <BookCover color={book.coverColor} coverUrl={book.coverUrl} style={styles.completionCover}>
                    {!book.coverUrl && <Ionicons name="book-outline" size={21} color={colors.paper} accessible={false} />}
                  </BookCover>
                  <View style={styles.completionBookCopy}>
                    <Text style={[styles.sheetTitle, { color: palette.text }]}>Concluir leitura</Text>
                    <Text style={{ color: palette.muted }}>{book.title}</Text>
                  </View>
                </View>
                <Text style={[styles.sheetDescription, { color: palette.muted }]}>Guarde sua impressão final. A resenha e a avaliação são opcionais.</Text>
                {isPreview && book.totalPages < 1 ? (
                  <>
                    <AppTextInput
                      accessibilityLabel="Total de páginas do livro"
                      keyboardType="number-pad"
                      maxLength={5}
                      invalid={Boolean(pageCountError)}
                      onChangeText={(value) => { setPageCountDraft(value); setPageCountError(''); }}
                      placeholder="Total de páginas"
                      placeholderTextColor={palette.muted}
                      style={[styles.pageCountPromptInput, { color: palette.text, backgroundColor: palette.surfaceStrong, borderColor: palette.border }]}
                      value={pageCountDraft}
                    />
                    <FieldError isNight={palette.isDark} message={pageCountError} />
                  </>
                ) : null}
                <View style={[styles.completionRating, { backgroundColor: isNight ? darkTheme.selection : colors.sageSoft }]}>
                  <Text style={[styles.completionRatingLabel, { color: palette.text }]}>Sua avaliação (opcional)</Text>
                  <View style={styles.ratingRow}>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Pressable
                        key={value}
                        accessibilityLabel={`${value} ${value === 1 ? 'estrela' : 'estrelas'}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: completionRatingDraft === value }}
                        onPress={() => setCompletionRatingDraft(completionRatingDraft === value ? undefined : value)}
                        style={styles.starTouch}
                      >
                        <Ionicons color={value <= (completionRatingDraft ?? 0) ? palette.accent : palette.muted} name={value <= (completionRatingDraft ?? 0) ? 'star' : 'star-outline'} size={25} />
                      </Pressable>
                    ))}
                  </View>
                </View>
                <AppTextInput
                  accessibilityLabel="Resenha final opcional"
                  multiline
                  onChangeText={setReviewDraft}
                  placeholder="O que você vai levar deste livro?"
                  placeholderTextColor={palette.muted}
                  style={[styles.reviewDraftInput, { color: palette.text, backgroundColor: palette.surfaceStrong, borderColor: palette.border }]}
                  textAlignVertical="top"
                  value={reviewDraft}
                />
                <View style={[styles.completionReward, { borderColor: palette.border }]}>
                  <Ionicons name="gift-outline" size={19} color={palette.accent} accessible={false} />
                  <Text style={[styles.completionRewardText, { color: palette.text }]}>Ao concluir, a capa fica disponível para os pôsteres da sala.</Text>
                </View>
                <View style={styles.sheetActions}>
                  <Pressable accessibilityRole="button" onPress={() => setCompletionConfirmationVisible(false)} style={({ pressed }) => [styles.sheetCancelButton, pressed && styles.pressed]}>
                    <Text style={[styles.sheetCancelLabel, { color: palette.text }]}>Agora não</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={confirmCompletion} style={({ pressed }) => [styles.sheetConfirmButton, { backgroundColor: palette.fill }, pressed && styles.pressed]}>
                    <Text style={[styles.sheetConfirmLabel, { color: palette.actionText }]}>Concluir leitura</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TransitionModal>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 },
  menuTrigger: { width: controls.iconButton.width, height: controls.iconButton.height },
  roundButton: { ...controls.iconButton, borderWidth: 1 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingHorizontal: 6, paddingVertical: 8 },
  heroStacked: { flexDirection: 'column', alignItems: 'center' },
  heroCopy: { flex: 1, minWidth: 0, gap: 10 },
  heroCopyStacked: { alignSelf: 'stretch', flex: 0, alignItems: 'center' },
  cover: { width: 150, height: 225, borderRadius: radii.small, borderCurve: 'continuous', justifyContent: 'center' },
  coverFallback: { margin: 14, padding: 10, backgroundColor: colors.paper, borderRadius: 4 },
  coverTitle: { color: colors.ink, fontFamily: typography.editorial, fontSize: 17, textAlign: 'center' },
  title: { fontFamily: typography.editorial, fontSize: 25, lineHeight: 31 },
  author: { fontSize: 14, lineHeight: 21 },
  bookStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 9, borderRadius: 12 },
  bookStatusText: { fontSize: 12, lineHeight: 18, flexShrink: 1 },
  readingActions: { gap: 8 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  startButton: { ...controls.button, flexDirection: 'row', gap: 8 },
  registerButton: { flex: 1, minHeight: 48 },
  startButtonText: { ...controls.buttonText, color: colors.paper, lineHeight: 22, flexShrink: 1, textAlign: 'center' },
  completeButton: { ...controls.iconButton, borderWidth: 1 },
  disabledButton: { opacity: 0.55 },
  pressed: controls.buttonPressed,
  progressCard: { gap: 12, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.large, borderCurve: 'continuous' },
  progressHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionLabel: { fontSize: 14, fontWeight: '600' },
  progressPercent: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  progressTrack: { height: 8, overflow: 'hidden', borderRadius: radii.full },
  progressFill: { height: '100%', borderRadius: radii.full },
  progressActions: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
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
  synopsisPreview: { minHeight: 92 },
  synopsisSkeleton: { height: 92, justifyContent: 'space-around' },
  synopsisSkeletonLine: { height: 10, borderRadius: 5 },
  synopsisHeading: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
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
  subjectPill: { maxWidth: '100%', paddingHorizontal: 10, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, borderCurve: 'continuous' },
  subjectText: { fontSize: 12, lineHeight: 18, flexShrink: 1 },
  reviewButton: { ...controls.button, flexDirection: 'row', gap: 9 },
  reviewButtonText: { ...controls.buttonText, flex: 1 },
  amazonButton: { ...controls.button, minHeight: 52, flexDirection: 'row', gap: 12, backgroundColor: '#F4CE91' },
  amazonButtonText: { ...controls.buttonText, flex: 1, color: colors.ink, fontWeight: '600' },
  amazonCaption: { fontSize: 12, lineHeight: 18 },
  notesInput: { ...controls.input, minHeight: 112, lineHeight: 23 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20, 14, 12, 0.44)' },
  modalKeyboard: { flex: 1, justifyContent: 'flex-end' },
  completionSheet: { maxHeight: '88%', paddingHorizontal: 22, paddingTop: 10, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderCurve: 'continuous' },
  sheetGrabber: { width: 44, height: 5, alignSelf: 'center', marginBottom: 16, borderRadius: 3, backgroundColor: 'rgba(120, 108, 98, 0.36)' },
  pageCountSheet: { paddingHorizontal: 22, paddingTop: 10, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderCurve: 'continuous' },
  pageCountPromptInput: { ...controls.input, minHeight: 52, marginBottom: 4, borderColor: '#E5D8C8', color: colors.ink, backgroundColor: '#F2E8D9' },
  previewFooter: { paddingHorizontal: 22, paddingTop: 10 },
  wantToReadButton: { ...controls.button, flexDirection: 'row', gap: 8, borderWidth: 1 },
  wantToReadLabel: { fontSize: 15, fontWeight: '600' },
  sheetTitle: { marginBottom: 6, color: colors.ink, fontFamily: typography.editorial, fontSize: 25, fontWeight: '600', lineHeight: 32 },
  sheetDescription: { marginBottom: 18, color: colors.muted, fontSize: 14, lineHeight: 20 },
  reviewDraftInput: { ...controls.input, minHeight: 112, borderColor: '#E5D8C8', color: colors.ink, backgroundColor: '#F2E8D9', lineHeight: 22 },
  completionBook: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  completionCover: { width: 58, height: 87, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  completionBookCopy: { flex: 1 },
  completionRating: { marginVertical: 12, padding: 12, gap: 4, borderRadius: radii.medium },
  completionReward: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  completionRewardText: { flex: 1, fontSize: 13, lineHeight: 19 },
  completionRatingLabel: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  sheetCancelButton: { ...controls.button, flex: 1 },
  sheetCancelLabel: { ...controls.buttonText, textAlign: 'center' },
  sheetConfirmButton: { ...controls.button, flex: 1.3, backgroundColor: colors.ink },
  sheetConfirmLabel: { ...controls.buttonText, color: colors.paper, textAlign: 'center' },
  unavailable: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 },
  unavailableTitle: { fontFamily: typography.editorial, fontSize: 24 },
  secondaryAction: { ...controls.button, backgroundColor: colors.paper },
  secondaryActionLabel: { ...controls.buttonText, color: colors.ink },
});
