import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { use, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { BookCover } from '@/src/components/book-cover';
import { TabBarContext } from '@/src/context/tab-bar-context';
import { useRoomEditor } from '@/src/store/room-editor-store';
import { ReadingWeekCalendar } from '@/src/components/reading-week-calendar';
import { AMBIENCE_THEMES, IsometricScene, resolveAmbience } from '@/src/components/room/isometric-scene';
import { RoomLoading, type RoomLoadingPhase } from '@/src/components/room/room-loading';
import { ShareRoomModal } from '@/src/components/room/share-room-modal';
import { captureRoomSnapshot, getLastCapturedRoomUri } from '@/src/services/room-snapshot-service';
import { READING_DESK_CAPACITY, useLibraryStore } from '@/src/store/library-store';
import { colors, darkTheme } from '@/src/theme';
import type { Book } from '@/src/types/book';

const tapFeedback = () => {
  if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

export default function RoomScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [isCustomizing, setIsCustomizing] = useState(false);
  const isOrganizing = useRoomEditor(state => Boolean(state.draft));
  const { setIsTabBarHidden } = use(TabBarContext);
  useEffect(() => {
    setIsTabBarHidden(isOrganizing);
    return () => setIsTabBarHidden(false);
  }, [isOrganizing, setIsTabBarHidden]);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [isFurnitureReady, setIsFurnitureReady] = useState(false);
  const [isSceneReady, setIsSceneReady] = useState(false);
  const [showLoading, setShowLoading] = useState(true);
  const [isLoadingSlow, setIsLoadingSlow] = useState(false);
  const [sceneVersion, setSceneVersion] = useState(0);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const books = useLibraryStore((state) => state.books);
  const deskBookIds = useLibraryStore((state) => state.deskBookIds);
  const readingDays = useLibraryStore((state) => state.readingDays);
  const activeBookId = useLibraryStore((state) => state.activeBookId);
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);

  const resolvedAmbience = resolveAmbience(ambienceMode);
  const theme = AMBIENCE_THEMES[resolvedAmbience];

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
  const dockAvailableWidth = width - insets.left - insets.right - 32;
  const dockSlotWidth = Math.min(72, Math.max(52, (dockAvailableWidth - 64) / READING_DESK_CAPACITY));
  const dockSlotHeight = dockSlotWidth * 1.39;
  const dockWidth = Math.min(dockAvailableWidth, dockSlotWidth * READING_DESK_CAPACITY + 56);

  const openProgress = (bookId: string) => {
    tapFeedback();
    router.navigate({ pathname: '/book-progress', params: { bookId } });
  };

  const selectBook = (bookId: string) => {
    openProgress(bookId);
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.bgColor }]}>
      <IsometricScene
        key={sceneVersion}
        isPro={false}
        isCustomizing={isCustomizing}
        onCanvasReady={() => setIsCanvasReady(true)}
        onCustomizingChange={setIsCustomizing}
        onFurnitureReady={() => setIsFurnitureReady(true)}
        onOpenBook={openProgress}
        onSceneError={handleSceneError}
        onSceneReady={() => {
          setIsSceneReady(true);
          setShowLoading(false);
        }}
        onSelectBook={selectBook}
        onShare={handleOpenShare}
      />

      {showLoading ? (
        <Animated.View
          exiting={FadeOut.duration(380)}
          pointerEvents={isLoadingSlow && !isSceneReady ? 'auto' : 'none'}
          style={[
            StyleSheet.absoluteFill,
            styles.loadingContainer,
            { backgroundColor: theme.bgColor },
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

      {!isCustomizing ? <ReadingWeekCalendar isNight={resolvedAmbience === 'night'} readingDays={readingDays} /> : null}

      {!isCustomizing ? (
        /* A mesa comporta três livros iniciados, incluindo os espaços vazios. */
        <Animated.View
          entering={FadeIn.duration(260)}
          exiting={FadeOut.duration(180)}
          style={[styles.recentReadingDockWrap, { left: insets.left + 16, right: insets.right + 16 }]}
        >
          <View style={[styles.recentReadingDock, resolvedAmbience === 'night' ? styles.nightReadingDock : styles.dayReadingDock, { width: dockWidth }]}>
            <ScrollView
              contentContainerStyle={styles.recentReadingCovers}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {deskBooks.map((book) => {
                const isActive = book.id === activeBook?.id;
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
                        borderColor: resolvedAmbience === 'night' ? darkTheme.accent : colors.terracotta,
                      },
                      pressed && styles.dockCoverPressed,
                    ]}
                  >
                    <BookCover color={book.coverColor} coverUrl={book.coverUrl} style={styles.dockCover} />
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
                    resolvedAmbience === 'night' && styles.nightDockAddSlot,
                    { width: dockSlotWidth, height: dockSlotHeight },
                    pressed && styles.dockCoverPressed,
                  ]}
                >
                  <Ionicons color={resolvedAmbience === 'night' ? darkTheme.textMuted : '#8E6F4C'} name="add" size={20} />
                </Pressable>
              ))}
            </ScrollView>
            <View style={[styles.shelfEdge, resolvedAmbience === 'night' ? styles.nightShelfEdge : styles.dayShelfEdge]} />
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
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    borderRadius: 14,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  dayReadingDock: {
    backgroundColor: '#DCC7A7',
    borderColor: 'rgba(96, 67, 38, 0.16)',
    boxShadow: '0 2px 8px rgba(73, 50, 29, 0.16)',
  },
  nightReadingDock: {
    backgroundColor: '#292621',
    borderColor: 'rgba(243, 240, 235, 0.12)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
  },
  recentReadingCovers: {
    minWidth: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dockCoverFrame: {
    width: 56,
    height: 78,
    padding: 2,
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: 6,
    borderCurve: 'continuous',
  },
  dockCoverPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.96 }],
  },
  dockAddSlot: {
    width: 56,
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(96, 67, 38, 0.24)',
    borderRadius: 6,
    borderCurve: 'continuous',
    backgroundColor: 'transparent',
  },
  nightDockAddSlot: {
    borderColor: 'rgba(243, 240, 235, 0.24)',
  },
  dockCover: {
    width: '100%',
    height: '100%',
    borderRadius: 3,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  shelfEdge: {
    height: 3,
    marginTop: 5,
    borderRadius: 1,
  },
  dayShelfEdge: {
    backgroundColor: '#A68341',
  },
  nightShelfEdge: {
    backgroundColor: '#4A4034',
  },
});
