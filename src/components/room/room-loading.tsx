import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, darkTheme, radii, typography } from '@/src/theme';

export type RoomLoadingPhase = 'library' | 'furniture' | 'lighting';
export type RoomLoadingAmbience = 'day' | 'sunset' | 'night';

type RoomLoadingProps = {
  ambience: RoomLoadingAmbience;
  phase: RoomLoadingPhase;
  isSlow: boolean;
  onRetry: () => void;
};

const ambiencePalettes: Record<RoomLoadingAmbience, {
  background: string;
  surface: string;
  border: string;
  backWall: string;
  leftWall: string;
  floor: string;
  accent: string;
  text: string;
  muted: string;
}> = {
  day: {
    background: colors.cream,
    surface: colors.paper,
    border: colors.line,
    backWall: '#E8D6BC',
    leftWall: '#D6BE9D',
    floor: '#B99467',
    accent: colors.terracotta,
    text: colors.ink,
    muted: colors.muted,
  },
  sunset: {
    background: '#E8C9B8',
    surface: '#F7E4D4',
    border: '#D5A994',
    backWall: '#D9A184',
    leftWall: '#BD806B',
    floor: '#98624D',
    accent: '#C05621',
    text: '#39231E',
    muted: '#725248',
  },
  night: {
    background: darkTheme.bg,
    surface: darkTheme.surface,
    border: darkTheme.border,
    backWall: '#25283A',
    leftWall: '#1F2231',
    floor: '#433126',
    accent: '#FFAE70',
    text: darkTheme.text,
    muted: darkTheme.textMuted,
  },
};

const phaseCopy: Record<RoomLoadingPhase, { title: string; subtitle: string }> = {
  library: {
    title: 'Abrindo sua biblioteca',
    subtitle: 'Preparando um cantinho só seu.',
  },
  furniture: {
    title: 'Montando os móveis',
    subtitle: 'A mesa e a estante estão chegando.',
  },
  lighting: {
    title: 'Acendendo as luzes',
    subtitle: 'Só mais um instante para entrar.',
  },
};

export function RoomLoading({ ambience, phase, isSlow, onRetry }: RoomLoadingProps) {
  const copy = phaseCopy[phase];
  const hasFurniture = phase !== 'library';
  const hasLighting = phase === 'lighting';
  const palette = ambiencePalettes[ambience];

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      pointerEvents={isSlow ? 'auto' : 'none'}
      style={[styles.overlay, { backgroundColor: palette.background }]}
    >
      <Animated.View entering={FadeInDown.duration(420)} style={styles.content}>
        <View
          accessibilityLabel="Prévia da sala sendo montada"
          style={[styles.roomPreview, { backgroundColor: palette.surface, borderColor: palette.border }]}
        >
          <View style={[styles.backWall, { backgroundColor: palette.backWall }]} />
          <View style={[styles.leftWall, { backgroundColor: palette.leftWall }]} />
          <View style={[styles.floor, { backgroundColor: palette.floor }]} />
          {hasFurniture ? (
            <>
              <Animated.View entering={FadeInUp.delay(120).duration(320)} style={styles.rug} />
              <Animated.View entering={FadeInUp.delay(240).duration(320)} style={styles.bookcase}>
                <View style={styles.bookcaseShelf} />
                <View style={styles.bookcaseShelf} />
                <View style={styles.bookcaseBooks} />
              </Animated.View>
              <Animated.View entering={FadeInUp.delay(360).duration(320)} style={styles.desk}>
                <View style={styles.deskTop} />
                <View style={styles.deskLegLeft} />
                <View style={styles.deskLegRight} />
                <View style={[styles.bookStack, { backgroundColor: palette.accent }]} />
              </Animated.View>
            </>
          ) : null}
          {hasLighting ? (
            <Animated.View entering={FadeIn.delay(460).duration(320)} style={styles.lamp}>
              <View style={[styles.lampShade, { borderBottomColor: palette.accent }]} />
              <View style={[styles.lampStem, { backgroundColor: palette.accent }]} />
              <View style={[styles.lampGlow, { backgroundColor: palette.accent }]} />
            </Animated.View>
          ) : null}
        </View>

        <View style={styles.copyBlock}>
          <View style={styles.brandMark}>
            <Ionicons color={palette.accent} name="book" size={18} />
          </View>
          <Text selectable style={[styles.title, { color: palette.text }]}>{isSlow ? 'Ainda preparando sua sala' : copy.title}</Text>
          <Text selectable style={[styles.subtitle, { color: palette.muted }]}>
            {isSlow ? 'Os móveis estão levando um pouco mais de tempo.' : copy.subtitle}
          </Text>
        </View>

        {isSlow ? (
          <Pressable
            accessibilityLabel="Tentar carregar a sala novamente"
            accessibilityRole="button"
            onPress={onRetry}
            style={({ pressed }) => [styles.retryButton, { borderColor: palette.accent }, pressed && styles.pressed]}
          >
            <Ionicons color={palette.accent} name="refresh-outline" size={17} />
            <Text selectable style={[styles.retryLabel, { color: palette.accent }]}>Tentar novamente</Text>
          </Pressable>
        ) : (
          <View accessibilityLabel={`Etapa: ${copy.title}`} style={styles.dots}>
            {[0, 1, 2].map((dot) => (
              <View key={dot} style={[styles.dot, { backgroundColor: palette.accent, opacity: 1 - dot * 0.28 }]} />
            ))}
          </View>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 10,
  },
  content: {
    width: '100%',
    maxWidth: 330,
    alignItems: 'center',
    gap: 22,
  },
  roomPreview: {
    width: 274,
    height: 214,
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: radii.large,
    borderCurve: 'continuous',
    boxShadow: '0 16px 30px rgba(50, 37, 31, 0.12)',
  },
  backWall: {
    position: 'absolute',
    top: 22,
    right: 18,
    left: 18,
    height: 102,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  leftWall: {
    position: 'absolute',
    top: 22,
    left: 18,
    width: 43,
    height: 102,
    transform: [{ skewY: '-18deg' }],
    transformOrigin: 'right center',
  },
  floor: {
    position: 'absolute',
    right: -18,
    bottom: -34,
    left: -18,
    height: 130,
    transform: [{ rotate: '-7deg' }],
  },
  rug: {
    position: 'absolute',
    bottom: 26,
    left: 79,
    width: 132,
    height: 48,
    borderRadius: 50,
    backgroundColor: '#A65342',
    opacity: 0.78,
    transform: [{ rotate: '-7deg' }],
  },
  bookcase: {
    position: 'absolute',
    bottom: 70,
    left: 34,
    width: 58,
    height: 94,
    padding: 5,
    backgroundColor: '#563423',
    borderRadius: 3,
    gap: 7,
  },
  bookcaseShelf: {
    height: 3,
    backgroundColor: '#B78B66',
  },
  bookcaseBooks: {
    position: 'absolute',
    right: 11,
    bottom: 12,
    left: 11,
    height: 44,
    borderLeftWidth: 6,
    borderRightWidth: 8,
    borderColor: '#D9A35F',
  },
  desk: {
    position: 'absolute',
    right: 39,
    bottom: 43,
    width: 128,
    height: 75,
  },
  deskTop: {
    position: 'absolute',
    top: 11,
    right: 0,
    left: 0,
    height: 16,
    borderRadius: 3,
    backgroundColor: '#8A5B3E',
    transform: [{ skewY: '-6deg' }],
  },
  deskLegLeft: {
    position: 'absolute',
    top: 25,
    left: 15,
    width: 8,
    height: 50,
    backgroundColor: '#6C432E',
    transform: [{ rotate: '5deg' }],
  },
  deskLegRight: {
    position: 'absolute',
    top: 25,
    right: 16,
    width: 8,
    height: 50,
    backgroundColor: '#6C432E',
    transform: [{ rotate: '-5deg' }],
  },
  bookStack: {
    position: 'absolute',
    top: 2,
    left: 34,
    width: 33,
    height: 10,
    borderRadius: 2,
    transform: [{ rotate: '-4deg' }],
  },
  lamp: {
    position: 'absolute',
    right: 41,
    bottom: 113,
    width: 38,
    height: 52,
    alignItems: 'center',
  },
  lampShade: {
    width: 34,
    height: 20,
    borderBottomWidth: 10,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  lampStem: {
    width: 4,
    height: 25,
  },
  lampGlow: {
    width: 8,
    height: 5,
    borderRadius: 4,
    opacity: 0.8,
  },
  copyBlock: {
    alignItems: 'center',
    gap: 7,
  },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(182, 90, 61, 0.1)',
  },
  title: {
    fontFamily: typography.editorial,
    fontSize: 21,
    fontWeight: '600',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 7,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  retryButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: radii.full,
  },
  retryLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.68,
  },
});
