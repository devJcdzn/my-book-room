import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, LinearTransition } from 'react-native-reanimated';

import { BookCover } from '@/src/components/book-cover';
import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { useLibraryStore } from '@/src/store/library-store';
import { colors, darkTheme, radii } from '@/src/theme';
import type { Book } from '@/src/types/book';

type Props = {
  book: Book;
  index: number;
  isActiveOnDesk: boolean;
};

export function BookCard({ book, index, isActiveOnDesk }: Props) {
  const updateProgress = useLibraryStore((state) => state.updateProgress);
  const selectActiveBook = useLibraryStore((state) => state.selectActiveBook);
  const removeBook = useLibraryStore((state) => state.removeBook);
  const requestCompletion = useLibraryStore((state) => state.requestCompletion);
  const completingBookId = useLibraryStore((state) => state.completingBookId);

  const progress = Math.min(1, Math.max(0, book.currentPage / book.totalPages));
  const percent = Math.round(progress * 100);
  const isReading = book.status === 'reading';
  const isCompleted = book.status === 'completed';

  const triggerHaptic = () => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleOpenDetails = () => {
    triggerHaptic();
    router.navigate({ pathname: '/book-progress', params: { bookId: book.id } });
  };

  const handleStep = (delta: number) => {
    triggerHaptic();
    const next = Math.min(book.totalPages, Math.max(0, book.currentPage + delta));
    updateProgress(book.id, next);
  };

  const handleSelectActive = () => {
    triggerHaptic();
    selectActiveBook(book.id);
  };

  const handleConfirmDelete = () => {
    Alert.alert(
      'Remover livro',
      `Deseja remover "${book.title}" da sua biblioteca?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => {
            if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            removeBook(book.id);
          },
        },
      ]
    );
  };

  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const isNight = resolveAmbience(ambienceMode) === 'night';

  const handleComplete = () => {
    triggerHaptic();
    requestCompletion(book.id);
    router.navigate('/');
  };

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 35).duration(200)}
      layout={LinearTransition.duration(180)}
      style={styles.cardContainer}
    >
      <Pressable
        accessibilityHint="Toque para abrir detalhes e notas"
        accessibilityLabel={`Livro ${book.title}, ${book.author}, ${percent}% lido`}
        accessibilityRole="button"
        onPress={handleOpenDetails}
        style={({ pressed }) => [styles.card, isNight && styles.darkCard, pressed && styles.cardPressed]}
      >
        <BookCover color={book.coverColor} coverUrl={book.coverUrl} style={styles.coverContainer}>
          <View style={styles.coverSpineShade} />
          <View style={styles.coverPageEdge} />
          <View style={styles.coverBookmark} />
        </BookCover>

        {/* Informações centrais */}
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <View style={styles.titlesWrap}>
              <Text selectable numberOfLines={1} style={[styles.title, isNight && styles.darkTitle]}>
                {book.title}
              </Text>
              <Text selectable numberOfLines={1} style={[styles.author, isNight && styles.darkMutedText]}>
                {book.author}
              </Text>
            </View>

            {/* Menu ou botão de exclusão */}
            <Pressable
              accessibilityLabel="Opções do livro"
              hitSlop={8}
              onPress={handleConfirmDelete}
              style={styles.deleteButton}
            >
              <Ionicons color={isNight ? darkTheme.textSubtle : colors.muted} name="ellipsis-horizontal" size={18} />
            </Pressable>
          </View>

          {/* Status e badges */}
          <View style={styles.statusRow}>
            {isCompleted ? (
              <View style={[styles.completedBadge, isNight && styles.darkCompletedBadge]}>
                <Ionicons color={isNight ? '#78C296' : colors.sage} name="checkmark-circle" size={14} />
                <Text selectable style={[styles.completedText, isNight && styles.darkCompletedText]}>Na estante</Text>
                {book.rating ? (
                  <View style={styles.ratingInline}>
                    <Ionicons color={colors.terracotta} name="star" size={12} />
                    <Text style={styles.ratingText}>{book.rating}</Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={styles.badgeRow}>
                {isActiveOnDesk ? (
                  <View style={[styles.activeBadge, isNight && styles.darkActiveBadge]}>
                    <View style={styles.activeDot} />
                    <Text selectable style={[styles.activeBadgeText, isNight && styles.darkActiveBadgeText]}>Aberto na mesa</Text>
                  </View>
                ) : (
                  <Pressable hitSlop={6} onPress={handleSelectActive} style={[styles.inactiveBadge, isNight && styles.darkInactiveBadge]}>
                    <Text selectable style={[styles.inactiveBadgeText, isNight && styles.darkMutedText]}>Colocar na mesa</Text>
                  </Pressable>
                )}
                <Text selectable style={[styles.pageInfo, isNight && styles.darkSubtleText]}>
                  {book.currentPage}/{book.totalPages} pág.
                </Text>
              </View>
            )}
            <Text selectable style={[styles.percentText, isNight && styles.darkPercentText]}>{percent}%</Text>
          </View>

          {/* Barra de progresso */}
          <View style={[styles.progressBarBg, isNight && styles.darkProgressBarBg]}>
            <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
          </View>

          {/* Steppers rápidos se estiver lendo */}
          {isReading && (
            <View style={styles.actionsRow}>
              <View style={styles.steppers}>
                <Pressable
                  accessibilityLabel="Retroceder 10 páginas"
                  hitSlop={4}
                  onPress={() => handleStep(-10)}
                  style={({ pressed }) => [styles.stepBtn, isNight && styles.darkStepBtn, pressed && styles.stepBtnPressed]}
                >
                  <Text style={[styles.stepBtnText, isNight && styles.darkTitle]}>-10</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="Avançar 10 páginas"
                  hitSlop={4}
                  onPress={() => handleStep(10)}
                  style={({ pressed }) => [styles.stepBtn, isNight && styles.darkStepBtn, pressed && styles.stepBtnPressed]}
                >
                  <Text style={[styles.stepBtnText, isNight && styles.darkTitle]}>+10</Text>
                </Pressable>
              </View>

              {percent >= 100 || book.currentPage >= book.totalPages ? (
                <Pressable
                  disabled={Boolean(completingBookId)}
                  onPress={handleComplete}
                  style={styles.finishBtn}
                >
                  <Ionicons color={colors.white} name="checkmark" size={14} />
                  <Text style={styles.finishBtnText}>Concluir</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={handleOpenDetails}
                  style={styles.detailsPill}
                >
                  <Text style={[styles.detailsPillText, isNight && styles.darkMutedText]}>Editar notas</Text>
                  <Ionicons color={isNight ? darkTheme.textSubtle : colors.muted} name="chevron-forward" size={12} />
                </Pressable>
              )}
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginVertical: 4,
  },
  card: {
    flexDirection: 'row',
    borderRadius: radii.medium,
    borderCurve: 'continuous',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(53, 42, 36, 0.05)',
  },
  cardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.995 }],
  },
  coverContainer: {
    width: 64,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'flex-start',
    borderRightWidth: 1,
    borderRightColor: 'rgba(0,0,0,0.08)',
  },
  coverSpineShade: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 8,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  coverPageEdge: {
    position: 'absolute',
    right: 3,
    top: 6,
    bottom: 6,
    width: 3,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  coverBookmark: {
    position: 'absolute',
    top: 0,
    left: 18,
    width: 5,
    height: 16,
    backgroundColor: '#FFE5B4',
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  content: {
    flex: 1,
    padding: 13,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  titlesWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.ink,
    fontFamily: 'Georgia',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  author: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 16,
  },
  deleteButton: {
    padding: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderCurve: 'continuous',
    backgroundColor: '#EBE2D5',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.terracotta,
  },
  activeBadgeText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '700',
  },
  inactiveBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderCurve: 'continuous',
    backgroundColor: colors.cream,
  },
  inactiveBadgeText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderCurve: 'continuous',
    backgroundColor: colors.sageSoft,
  },
  completedText: {
    color: colors.sage,
    fontSize: 12,
    fontWeight: '700',
  },
  ratingInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 4,
  },
  ratingText: {
    color: colors.terracotta,
    fontSize: 11,
    fontWeight: '700',
  },
  pageInfo: {
    color: colors.muted,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  percentText: {
    color: colors.terracottaDark,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  progressBarBg: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.line,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.terracotta,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  steppers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    borderCurve: 'continuous',
    backgroundColor: colors.sageSoft,
  },
  stepBtnPressed: {
    opacity: 0.7,
  },
  stepBtnText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 7,
    borderCurve: 'continuous',
    backgroundColor: colors.terracotta,
  },
  finishBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  detailsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  detailsPillText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  darkCard: {
    backgroundColor: darkTheme.surface,
    borderColor: darkTheme.border,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35)',
  },
  darkTitle: {
    color: darkTheme.text,
  },
  darkMutedText: {
    color: darkTheme.textMuted,
  },
  darkSubtleText: {
    color: darkTheme.textSubtle,
  },
  darkCompletedBadge: {
    backgroundColor: 'rgba(120, 194, 150, 0.16)',
  },
  darkCompletedText: {
    color: '#78C296',
  },
  darkActiveBadge: {
    backgroundColor: 'rgba(255, 174, 112, 0.18)',
  },
  darkActiveBadgeText: {
    color: '#FFAE70',
  },
  darkInactiveBadge: {
    backgroundColor: darkTheme.surfaceElevated,
  },
  darkPercentText: {
    color: '#FFAE70',
  },
  darkProgressBarBg: {
    backgroundColor: '#2C3044',
  },
  darkStepBtn: {
    backgroundColor: darkTheme.surfaceElevated,
  },
});
