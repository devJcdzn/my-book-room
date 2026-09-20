import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { BookCover } from '@/src/components/book-cover';
import { AMBIENCE_THEMES, IsometricScene, resolveAmbience } from '@/src/components/room/isometric-scene';
import { RoomLoading, type RoomLoadingPhase } from '@/src/components/room/room-loading';
import { ShareRoomModal } from '@/src/components/room/share-room-modal';
import { useProAccess } from '@/src/providers/revenuecat-provider';
import { captureRoomSnapshot, getLastCapturedRoomUri } from '@/src/services/room-snapshot-service';
import { useLibraryStore } from '@/src/store/library-store';
import { colors, typography } from '@/src/theme';

const tapFeedback = () => {
  if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

export default function RoomScreen() {
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [isFurnitureReady, setIsFurnitureReady] = useState(false);
  const [isSceneReady, setIsSceneReady] = useState(false);
  const [showLoading, setShowLoading] = useState(true);
  const [isLoadingSlow, setIsLoadingSlow] = useState(false);
  const [sceneVersion, setSceneVersion] = useState(0);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const books = useLibraryStore((state) => state.books);
  const activeBookId = useLibraryStore((state) => state.activeBookId);
  const selectActiveBook = useLibraryStore((state) => state.selectActiveBook);
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const { isPro } = useProAccess();

  const resolvedAmbience = resolveAmbience(ambienceMode);
  const theme = AMBIENCE_THEMES[resolvedAmbience];
  const isNight = resolvedAmbience === 'night';

  useEffect(() => {
    if (isSceneReady) {
      const timer = setTimeout(() => setShowLoading(false), 320);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isSceneReady]);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoadingSlow(true), 4500);
    return () => clearTimeout(timer);
  }, []);

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

  const loadingPhase: RoomLoadingPhase = isSceneReady
    ? 'lighting'
    : isCanvasReady && !isFurnitureReady
      ? 'furniture'
      : 'lighting';

  const activeBook = books.find((book) => book.id === activeBookId && book.status === 'reading')
    ?? [...books].reverse().find((book) => book.status === 'reading');

  const openProgress = (bookId: string) => {
    tapFeedback();
    router.navigate({ pathname: '/book-progress', params: { bookId } });
  };

  const selectBook = (bookId: string) => {
    tapFeedback();
    selectActiveBook(bookId);
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.bgColor }]}>
      <IsometricScene
        key={sceneVersion}
        isPro={isPro}
        isCustomizing={isCustomizing}
        onAddBook={() => {
          tapFeedback();
          router.navigate('/add-book');
        }}
        onCanvasReady={() => setIsCanvasReady(true)}
        onCustomizingChange={setIsCustomizing}
        onFurnitureReady={() => setIsFurnitureReady(true)}
        onOpenBook={openProgress}
        onSceneError={handleSceneError}
        onSceneReady={() => setIsSceneReady(true)}
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

      {/* Dica inicial se não houver livros */}
      {!isCustomizing && books.length === 0 ? (
        <Animated.View
          entering={FadeIn.delay(350).duration(300)}
          exiting={FadeOut.duration(180)}
          pointerEvents="none"
          style={styles.bottomHintWrap}
        >
          <Text selectable style={[styles.hintPill, isNight && styles.darkHintPill]}>
            Toque na mesa ou no + para começar uma leitura
          </Text>
        </Animated.View>
      ) : !isCustomizing && activeBook ? (
        /* Card flutuante compacto com o livro aberto na mesa */
        <Animated.View
          entering={FadeIn.duration(260)}
          exiting={FadeOut.duration(180)}
          style={styles.activeBookWidgetWrap}
        >
          <Pressable
            accessibilityHint="Abre o progresso do livro ativo"
            accessibilityLabel={`Livro na mesa: ${activeBook.title}, página ${activeBook.currentPage} de ${activeBook.totalPages}`}
            accessibilityRole="button"
            onPress={() => openProgress(activeBook.id)}
            style={({ pressed }) => [
              styles.activeWidget,
              isNight && styles.darkWidget,
              pressed && styles.widgetPressed,
            ]}
          >
            <BookCover color={activeBook.coverColor} coverUrl={activeBook.coverUrl} style={styles.widgetCover} />
            <View style={styles.widgetInfo}>
              <Text numberOfLines={1} style={[styles.widgetTitle, isNight && styles.darkTitle]}>
                {activeBook.title}
              </Text>
              <Text style={[styles.widgetSub, isNight && styles.darkSub]}>
                pág. {activeBook.currentPage} de {activeBook.totalPages} · {Math.round((activeBook.currentPage / activeBook.totalPages) * 100)}%
              </Text>
            </View>
            <Ionicons color={colors.terracotta} name="chevron-forward" size={18} />
          </Pressable>
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
  bottomHintWrap: {
    position: 'absolute',
    right: 0,
    bottom: 104,
    left: 0,
    alignItems: 'center',
  },
  hintPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    overflow: 'hidden',
    borderRadius: 16,
    borderCurve: 'continuous',
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
    backgroundColor: 'rgba(255, 249, 240, 0.92)',
    boxShadow: '0 4px 12px rgba(53, 42, 36, 0.12)',
  },
  darkHintPill: {
    backgroundColor: 'rgba(35, 38, 52, 0.94)',
    color: '#F5E8D3',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)',
  },
  activeBookWidgetWrap: {
    position: 'absolute',
    bottom: 100,
    left: 18,
    right: 18,
  },
  activeWidget: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    paddingRight: 14,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255, 249, 240, 0.94)',
    borderWidth: 1,
    borderColor: colors.line,
    boxShadow: '0 4px 14px rgba(53, 42, 36, 0.12)',
  },
  darkWidget: {
    backgroundColor: 'rgba(32, 35, 48, 0.94)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
  },
  darkPill: {
    backgroundColor: 'rgba(32, 35, 48, 0.94)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35)',
  },
  widgetPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  widgetCover: {
    width: 26,
    height: 38,
    borderRadius: 3,
    borderCurve: 'continuous',
  },
  widgetInfo: {
    flex: 1,
    gap: 2,
  },
  widgetTitle: {
    color: colors.ink,
    fontFamily: typography.editorial,
    fontSize: 14,
    fontWeight: '600',
  },
  darkTitle: {
    color: '#FAF4EB',
  },
  widgetSub: {
    color: colors.muted,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  darkSub: {
    color: '#B2B7C8',
  },
});
