import { trackEvent } from '@/src/services/analytics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import * as StoreReview from 'expo-store-review';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text, ScrollView, StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, FadeOut, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { BookCover } from '@/src/components/book-cover';
import { ReadingWeekCalendar } from '@/src/components/reading-week-calendar';
import { AMBIENCE_THEMES, IsometricScene, resolveAmbience } from '@/src/components/room/isometric-skia-scene';
import { RoomLoading, type RoomLoadingPhase } from '@/src/components/room/room-loading';
import { ShareRoomModal } from '@/src/components/room/share-room-modal';
import { captureRoomSnapshot, getLastCapturedRoomUri } from '@/src/services/room-snapshot-service';
import { READING_DESK_CAPACITY, useLibraryStore } from '@/src/store/library-store';
import { colors, darkTheme, radii } from '@/src/theme';
import type { Book } from '@/src/types/book';

const tapFeedback = () => {
  if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

const reviewPromptKey = 'nookly_review_prompted';

export default function RoomScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [isRoomFocused, setIsRoomFocused] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const readingOpacity = useSharedValue(1);
  const readingOverlayStyle = useAnimatedStyle(() => ({ opacity: readingOpacity.get() }));
  useEffect(() => {
    readingOpacity.set(withTiming(isRoomFocused ? 0 : 1, {
      duration: 180,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
      reduceMotion: ReduceMotion.Never,
    }));
  }, [isRoomFocused, readingOpacity]);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [isFurnitureReady, setIsFurnitureReady] = useState(false);
  const [isSceneReady, setIsSceneReady] = useState(false);
  const [showLoading, setShowLoading] = useState(true);
  const [isLoadingSlow, setIsLoadingSlow] = useState(false);
  const [sceneVersion, setSceneVersion] = useState(0);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [calendarBottom, setCalendarBottom] = useState<number | null>(null);
  const [readingDockTop, setReadingDockTop] = useState<number | null>(null);
  const books = useLibraryStore((state) => state.books);
  const deskBookIds = useLibraryStore((state) => state.deskBookIds);
  const readingDays = useLibraryStore((state) => state.readingDays);
  const activeBookId = useLibraryStore((state) => state.activeBookId);
  const activeTimer = useLibraryStore((state) => state.activeReadingTimer);
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const readingSessions = useLibraryStore((state) => state.readingSessions);
  const hasHydrated = useLibraryStore((state) => state._hasHydrated);
  const previousSessionCount = useRef<number | null>(null);
  const reviewPromptPending = useRef(false);
  const reviewRequestInProgress = useRef(false);

  useEffect(() => {
    if (!hasHydrated) return;
    if (previousSessionCount.current === null) {
      previousSessionCount.current = readingSessions.length;
      return;
    }
    if (previousSessionCount.current < 3 && readingSessions.length >= 3) {
      reviewPromptPending.current = true;
    }
    previousSessionCount.current = readingSessions.length;
  }, [hasHydrated, readingSessions.length]);

  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'ios' || !reviewPromptPending.current || readingSessions.length < 3 || reviewRequestInProgress.current) return;
    let active = true;
    reviewRequestInProgress.current = true;

    void (async () => {
      try {
        if (await AsyncStorage.getItem(reviewPromptKey)) {
          reviewPromptPending.current = false;
          return;
        }
        if (!await StoreReview.isAvailableAsync() || !active) return;
        await AsyncStorage.setItem(reviewPromptKey, 'true');
        if (!active) {
          await AsyncStorage.removeItem(reviewPromptKey);
          return;
        }
        reviewPromptPending.current = false;
        await StoreReview.requestReview();
      } catch {
        // Apple's native review prompt may be unavailable or suppressed.
      } finally {
        reviewRequestInProgress.current = false;
      }
    })();

    return () => {
      active = false;
    };
  }, [readingSessions.length]));

  const resolvedAmbience = resolveAmbience(ambienceMode);
  const theme = AMBIENCE_THEMES[resolvedAmbience];
  const updateCalendarBounds = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.y + event.nativeEvent.layout.height;
    setCalendarBottom(current => current === next ? current : next);
  };
  const updateDockBounds = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.y;
    setReadingDockTop(current => current === next ? current : next);
  };
  const roomFitBounds = calendarBottom !== null && readingDockTop !== null
    ? { top: calendarBottom + 12, bottom: readingDockTop - 12 }
    : undefined;

  useEffect(() => {
    if (isSceneReady) return;
    const timer = setTimeout(() => setIsLoadingSlow(true), 12000);
    return () => clearTimeout(timer);
  }, [isSceneReady, sceneVersion]);

  const retryScene = () => {
    setIsCanvasReady(false);
    setIsFurnitureReady(false);
    setIsSceneReady(false);
    setShowLoading(true);
    setIsLoadingSlow(false);
    setSceneVersion((version) => version + 1);
  };

  const handleSurfaceRecovery = useCallback(() => {
    setIsSceneReady(false);
    setIsLoadingSlow(false);
    setShowLoading(true);
  }, []);

  const handleSceneError = () => {
    setIsSceneReady(false);
    setShowLoading(true);
    setIsLoadingSlow(true);
  };

  const handleOpenShare = () => {
    tapFeedback();
    setIsShareModalOpen(true);
  };

  const loadingPhase: RoomLoadingPhase = !isCanvasReady
    ? 'library'
    : !isFurnitureReady
      ? 'furniture'
      : 'lighting';

  const activeBook = books.find((book) => book.id === activeBookId && book.status === 'reading');
  const deskBooks = deskBookIds
    .map((bookId) => books.find((book) => book.id === bookId && book.status === 'reading'))
    .filter((book): book is Book => Boolean(book));
  const referenceBook = books.find((book) => book.id === activeTimer?.bookId) ?? activeBook ?? deskBooks[0];
  const dockAvailableWidth = width - insets.left - insets.right - 32;
  const dockSlotWidth = Math.min(50, Math.max(44, (dockAvailableWidth - 48) / READING_DESK_CAPACITY));
  const dockSlotHeight = dockSlotWidth * 1.38;
  const dockWidth = referenceBook ? Math.min(dockAvailableWidth, 328) : Math.min(dockAvailableWidth, dockSlotWidth * READING_DESK_CAPACITY + 36);

  const dockTextColor = resolvedAmbience === 'night' ? darkTheme.text : colors.ink;
  const dockNight = resolvedAmbience === 'night';
  const dockLine = dockNight ? darkTheme.border : colors.line;
  const dockAccent = dockNight ? darkTheme.selectionText : colors.sageDark;
  const dockMuted = dockNight ? darkTheme.textMuted : colors.muted;
  const dockSelection = dockNight ? darkTheme.selection : colors.sageSoft;
  const readReferenceBook = () => {
    tapFeedback();
    trackEvent('reading_action_used', { action: activeTimer ? 'resume' : 'read', surface: 'desk' });
    if (activeTimer) { router.push('/reading-timer'); return; }
    if (referenceBook && useLibraryStore.getState().startReadingTimer(referenceBook.id)) {
      router.push('/reading-timer');
    }
  };

  const openProgress = (bookId: string) => {
    tapFeedback();
    router.navigate({ pathname: '/book-progress', params: { bookId } });
  };

  const openLibrary = () => {
    tapFeedback();
    router.navigate('/(tabs)/books');
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.bgColor }]}>
      <IsometricScene
        key={sceneVersion}
        isPro={false}
        isCustomizing={isCustomizing}
        fitBounds={roomFitBounds}
        isRoomFocused={isRoomFocused}
        onToggleRoomFocus={() => setIsRoomFocused(current => !current)}
        onCanvasReady={() => setIsCanvasReady(true)}
        onCustomizingChange={setIsCustomizing}
        onFurnitureReady={() => setIsFurnitureReady(true)}
        onOpenBook={openProgress}
        onSceneError={handleSceneError}
        onSurfaceRecovery={handleSurfaceRecovery}
        onSceneReady={() => {
          setIsSceneReady(true);
          setShowLoading(false);
        }}
        onOpenLibrary={openLibrary}
        onShare={handleOpenShare}
      />

      {showLoading ? (
        <Animated.View
          exiting={FadeOut.duration(420).reduceMotion(ReduceMotion.System)}
          pointerEvents="auto"
          style={[
            StyleSheet.absoluteFill,
            styles.loadingContainer,
          ]}
        >
          <RoomLoading
            ambience={resolvedAmbience}
            isSlow={isLoadingSlow && !isSceneReady}
            onRetry={retryScene}
            phase={loadingPhase}
          />
        </Animated.View>
      ) : null}

      {!isCustomizing ? (
        <Animated.View pointerEvents="none" accessibilityElementsHidden={isRoomFocused}
          importantForAccessibility={isRoomFocused ? 'no-hide-descendants' : 'auto'}
          style={[styles.calendarOverlay, readingOverlayStyle]}>
          <ReadingWeekCalendar isNight={resolvedAmbience === 'night'} onLayout={updateCalendarBounds} readingDays={readingDays} />
        </Animated.View>
      ) : null}

      {!isCustomizing ? (
        /* A mesa comporta três livros iniciados, incluindo os espaços vazios. */
        <Animated.View
          pointerEvents={isRoomFocused ? 'none' : 'auto'}
          accessibilityElementsHidden={isRoomFocused}
          importantForAccessibility={isRoomFocused ? 'no-hide-descendants' : 'auto'}
          onLayout={updateDockBounds}
          style={[styles.recentReadingDockWrap, readingOverlayStyle, { left: insets.left + 16, right: insets.right + 16 }]}
        >
          <View style={[styles.recentReadingDock, { width: dockWidth, backgroundColor: dockNight ? darkTheme.surface : colors.paper, borderColor: dockLine }]}>
            <ScrollView
              contentContainerStyle={styles.recentReadingCovers}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {deskBooks.map((book) => {
                const isActive = book.id === referenceBook?.id;
                return (
                  <Pressable
                    key={book.id}
                    accessibilityHint="Abre os detalhes do livro"
                    accessibilityLabel={`${book.title}${isActive ? ', livro atual na mesa' : ', na mesa'}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    onPress={() => openProgress(book.id)}
                    style={({ pressed }) => [
                      styles.dockCoverFrame,
                      { width: dockSlotWidth, height: dockSlotHeight },
                      isActive && {
                        borderColor: dockAccent, backgroundColor: dockSelection,
                      },
                      pressed && styles.dockCoverPressed,
                    ]}
                  >
                    <BookCover color={book.coverColor} coverUrl={book.coverUrl} style={styles.dockCover}>
                      {!book.coverUrl && <Ionicons name="book-outline" size={20} color={colors.paper} accessible={false} />}
                    </BookCover>
                  </Pressable>
                );
              })}
              {Array.from({ length: Math.max(0, READING_DESK_CAPACITY - deskBooks.length) }, (_, slot) => (
                <Pressable
                  key={`add-book-${slot}`}
                  accessibilityHint="Abre a Biblioteca. Só começar a leitura coloca o livro na mesa."
                  accessibilityLabel="Abrir biblioteca"
                  accessibilityRole="button"
                  onPress={() => {
                    tapFeedback();
                    router.navigate('/books');
                  }}
                  style={({ pressed }) => [
                    styles.dockAddSlot,
                    { borderColor: dockLine },
                    { width: dockSlotWidth, height: dockSlotHeight },
                    pressed && styles.dockCoverPressed,
                  ]}
                >
                  <Ionicons color={dockMuted} name="add" size={17} accessible={false} />
                </Pressable>
              ))}
            </ScrollView>
            {referenceBook ? (
              <View style={[styles.resumeBar, { borderColor: dockLine }]}>
                <View style={styles.resumeBook}>
                  <Text numberOfLines={2} style={[styles.resumeTitle, { color: dockTextColor }]}>
                    {referenceBook.title}
                  </Text>
                  <Text style={[styles.resumePage, { color: dockMuted }]}>Página {referenceBook.currentPage}</Text>
                </View>
                <View style={styles.resumeActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={activeTimer ? 'Retomar sessão' : 'Ler'}
                    onPress={readReferenceBook}
                    style={({ pressed }) => [styles.resumeAction, { backgroundColor: dockNight ? darkTheme.primary : dockSelection }, pressed && styles.dockCoverPressed]}
                  >
                    <Ionicons name="play" color={dockNight ? darkTheme.actionText : dockAccent} size={16} accessible={false} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Registrar leitura"
                    onPress={() => {
                      trackEvent('reading_action_used', { action: 'register', surface: 'desk' });
                      router.push({ pathname: '/reading-log', params: { bookId: referenceBook.id } });
                    }}
                    style={({ pressed }) => [styles.resumeAction, pressed && { backgroundColor: dockSelection }]}
                  >
                    <Ionicons name="journal-outline" color={dockTextColor} size={18} accessible={false} />
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        </Animated.View>
      ) : null}

      <ShareRoomModal
        onCaptureSnapshot={captureRoomSnapshot}
        onClose={() => setIsShareModalOpen(false)}
        roomSnapshotUri={getLastCapturedRoomUri()}
        visible={isShareModalOpen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  calendarOverlay: { ...StyleSheet.absoluteFill, zIndex: 2 },
  resumeBar: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, paddingTop: 5, borderTopWidth: StyleSheet.hairlineWidth },
  resumeBook: { flex: 1, gap: 2 },
  resumeTitle: { fontSize: 14, fontWeight: '500' },
  resumePage: { fontSize: 12 },
  resumeActions: { flexDirection: 'row' },
  resumeAction: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radii.full,
  },
  screen: { flex: 1 },
  loadingContainer: { zIndex: 100 },
  recentReadingDockWrap: {
    position: 'absolute',
    bottom: 98,
    left: 12,
    right: 12,
    alignItems: 'center',
  },
  recentReadingDock: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
    borderRadius: radii.large,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
  },
  recentReadingCovers: {
    minWidth: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  dockCoverFrame: {
    width: 56,
    height: 78,
    padding: 2,
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: radii.small,
    borderCurve: 'continuous',
  },
  dockCoverPressed: {
    opacity: 0.78,
  },
  dockAddSlot: {
    width: 56,
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    borderRadius: radii.small,
    borderCurve: 'continuous',
  },
  dockCover: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
});
