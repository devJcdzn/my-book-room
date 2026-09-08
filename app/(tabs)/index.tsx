import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AMBIENCE_THEMES, IsometricScene, resolveAmbience } from '@/src/components/room/isometric-scene';
import { useLibraryStore } from '@/src/store/library-store';
import { colors } from '@/src/theme';

const tapFeedback = () => {
  if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

export default function RoomScreen() {
  const insets = useSafeAreaInsets();
  const books = useLibraryStore((state) => state.books);
  const activeBookId = useLibraryStore((state) => state.activeBookId);
  const selectActiveBook = useLibraryStore((state) => state.selectActiveBook);
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);

  const resolvedAmbience = resolveAmbience(ambienceMode);
  const theme = AMBIENCE_THEMES[resolvedAmbience];
  const isNight = resolvedAmbience === 'night';

  const activeBook = books.find((book) => book.id === activeBookId && book.status === 'reading')
    ?? [...books].reverse().find((book) => book.status === 'reading');

  const openProgress = (bookId: string) => {
    tapFeedback();
    router.push({ pathname: '/book-progress', params: { bookId } });
  };

  const selectBook = (bookId: string) => {
    tapFeedback();
    selectActiveBook(bookId);
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.bgColor }]}>
      <IsometricScene
        onAddBook={() => {
          tapFeedback();
          router.push('/add-book');
        }}
        onOpenBook={openProgress}
        onSelectBook={selectBook}
      />

      {/* Botão flutuante nativo no topo direito para adicionar livro */}
      <Pressable
        accessibilityHint="Abre a tela para adicionar novo livro à biblioteca"
        accessibilityLabel="Adicionar livro"
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => {
          tapFeedback();
          router.push('/add-book');
        }}
        style={({ pressed }) => [
          styles.floatingAddBtn,
          { top: insets.top + 10 },
          isNight && styles.darkPill,
          pressed && styles.btnPressed,
        ]}
      >
        <Ionicons color={colors.terracotta} name="add" size={25} />
      </Pressable>

      {/* Dica inicial se não houver livros */}
      {books.length === 0 ? (
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
      ) : activeBook ? (
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
            <View style={[styles.widgetCover, { backgroundColor: activeBook.coverColor }]} />
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
  floatingAddBtn: {
    position: 'absolute',
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255, 249, 240, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    boxShadow: '0 2px 8px rgba(53, 42, 36, 0.12)',
  },
  btnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  bottomHintWrap: {
    position: 'absolute',
    right: 0,
    bottom: 24,
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
    bottom: 20,
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
    fontFamily: 'Georgia',
    fontSize: 14,
    fontWeight: '700',
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
