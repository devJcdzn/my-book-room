import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { BookCover } from '@/src/components/book-cover';
import { AMBIENCE_THEMES, IsometricScene, resolveAmbience } from '@/src/components/room/isometric-scene';
import { useLibraryStore } from '@/src/store/library-store';
import { colors, typography } from '@/src/theme';

const tapFeedback = () => {
  if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

export default function RoomScreen() {
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [isSceneReady, setIsSceneReady] = useState(false);
  const books = useLibraryStore((state) => state.books);
  const activeBookId = useLibraryStore((state) => state.activeBookId);
  const selectActiveBook = useLibraryStore((state) => state.selectActiveBook);
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);

  const resolvedAmbience = resolveAmbience(ambienceMode);
  const theme = AMBIENCE_THEMES[resolvedAmbience];
  const isNight = resolvedAmbience === 'night';

  // Oculta a Splash Screen nativa assim que a sala 3D estiver com os assets carregados e pronta
  useEffect(() => {
    if (isSceneReady) {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [isSceneReady]);

  // Fallback de segurança para garantir exibição mesmo em dispositivos lentos
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSceneReady(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

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
        isCustomizing={isCustomizing}
        onAddBook={() => {
          tapFeedback();
          router.navigate('/add-book');
        }}
        onCustomizingChange={setIsCustomizing}
        onOpenBook={openProgress}
        onSceneReady={() => setIsSceneReady(true)}
        onSelectBook={selectBook}
      />

      {/* Disfarce de Carregamento Inicial (Cold Start) para transição fluida do primeiro render */}
      {!isSceneReady ? (
        <Animated.View
          exiting={FadeOut.duration(380)}
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.disguiseContainer,
            { backgroundColor: theme.bgColor },
          ]}
        >
          <View style={styles.disguiseContent}>
            <View style={[styles.disguiseIconWrap, isNight && styles.darkDisguiseIconWrap]}>
              <Ionicons
                color={isNight ? '#FFAE70' : colors.terracotta}
                name="book"
                size={30}
              />
            </View>
            <Text style={[styles.disguiseTitle, isNight && styles.darkText]}>
              Aconchegando seu cantinho...
            </Text>
            <View style={styles.disguiseDotsRow}>
              <View style={[styles.disguiseDot, isNight && styles.darkDisguiseDot]} />
              <View style={[styles.disguiseDot, isNight && styles.darkDisguiseDot, { opacity: 0.6 }]} />
              <View style={[styles.disguiseDot, isNight && styles.darkDisguiseDot, { opacity: 0.3 }]} />
            </View>
          </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
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
  disguiseContainer: {
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disguiseContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  disguiseIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255, 249, 240, 0.94)',
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 24px rgba(53, 42, 36, 0.12)',
  },
  darkDisguiseIconWrap: {
    backgroundColor: 'rgba(26, 28, 40, 0.94)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
  },
  disguiseTitle: {
    fontSize: 15,
    fontFamily: typography.ui,
    fontWeight: '600',
    color: colors.ink,
    letterSpacing: 0.2,
  },
  disguiseDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  disguiseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.terracotta,
  },
  darkDisguiseDot: {
    backgroundColor: '#FFAE70',
  },
  darkText: {
    color: '#FAF4EB',
  },
});
