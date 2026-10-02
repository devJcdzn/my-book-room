import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, useAnimatedStyle, useReducedMotion,
  useSharedValue, withRepeat, withTiming, type SharedValue,
} from 'react-native-reanimated';

import { colors, darkTheme, radii, typography } from '@/src/theme';

export type RoomLoadingPhase = 'library' | 'furniture' | 'lighting';
export type RoomLoadingAmbience = 'day' | 'night';

type RoomLoadingProps = {
  ambience: RoomLoadingAmbience;
  phase: RoomLoadingPhase;
  isSlow: boolean;
  onRetry: () => void;
};

const phaseCopy: Record<RoomLoadingPhase, { title: string; subtitle: string }> = {
  library: {
    title: 'Preparando sua sala',
    subtitle: 'Carregando os modelos do seu cantinho.',
  },
  furniture: {
    title: 'Montando seu cantinho',
    subtitle: 'Carregando a mesa, a estante e seus livros.',
  },
  lighting: {
    title: 'Quase em casa',
    subtitle: 'Finalizando a cena para você entrar.',
  },
};

function LoadingDot({ clock, index, color, reducedMotion }: {
  clock: SharedValue<number>;
  index: number;
  color: string;
  reducedMotion: boolean;
}) {
  const motion = useAnimatedStyle(() => {
    const pulse = reducedMotion ? 0 : Math.pow(Math.max(0, Math.sin(clock.get() * Math.PI * 4 - index * 0.8)), 2);
    return { opacity: 0.35 + pulse * 0.65, transform: [{ translateY: -3 * pulse }] };
  });
  return <Animated.View style={[styles.dot, { backgroundColor: color }, motion]} />;
}

export function RoomLoading({ ambience, phase, isSlow, onRetry }: RoomLoadingProps) {
  const copy = phaseCopy[phase];
  const night = ambience === 'night';
  const accent = night ? darkTheme.accent : colors.terracotta;
  const reducedMotion = useReducedMotion();
  const clock = useSharedValue(0);

  useFocusEffect(useCallback(() => {
    const updateAnimation = () => {
      cancelAnimation(clock);
      clock.set(0);
      if (!reducedMotion && AppState.currentState === 'active') {
        clock.set(withRepeat(withTiming(1, { duration: 3200, easing: Easing.linear }), -1));
      }
    };
    updateAnimation();
    const subscription = AppState.addEventListener('change', updateAnimation);
    return () => {
      subscription.remove();
      cancelAnimation(clock);
      clock.set(0);
    };
  }, [clock, reducedMotion]));

  const mascotMotion = useAnimatedStyle(() => {
    const angle = clock.get() * Math.PI * 2;
    const breath = (1 - Math.cos(angle)) / 2;
    return {
      transform: [
        { translateY: -8 * breath },
        { rotate: `${2 * Math.sin(angle)}deg` },
        { scale: 1 + 0.025 * breath },
      ],
    };
  });

  return (
    <View pointerEvents={isSlow ? 'auto' : 'none'} style={[styles.overlay, { backgroundColor: night ? darkTheme.bg : colors.cream }]}>
      <View style={styles.content}>
        <Animated.View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.mascot, mascotMotion]}>
          <Image source={require('../../../assets/niko-loading.png')} contentFit="contain" style={styles.image} />
        </Animated.View>
        <View accessibilityLiveRegion="polite" style={styles.copy}>
          <Text accessibilityRole="header" style={[styles.title, { color: night ? darkTheme.text : colors.ink }]}>
            {isSlow ? 'Seu cantinho está a caminho' : copy.title}
          </Text>
          <Text style={[styles.subtitle, { color: night ? darkTheme.textMuted : colors.inkSoft }]}>
            {isSlow ? 'O carregamento está demorando mais que o habitual. Você pode tentar novamente.' : copy.subtitle}
          </Text>
        </View>
        <View style={styles.status}>
          {isSlow ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Tentar carregar a sala novamente" onPress={onRetry}
              style={({ pressed }) => [styles.retry, { borderColor: accent }, pressed && styles.pressed]}>
              <Ionicons color={accent} name="refresh-outline" size={17} />
              <Text style={[styles.retryLabel, { color: accent }]}>Tentar novamente</Text>
            </Pressable>
          ) : (
            <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.dots}>
              {[0, 1, 2].map((index) => <LoadingDot key={index} clock={clock} index={index} color={accent} reducedMotion={reducedMotion} />)}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { width: '100%', maxWidth: 340, alignItems: 'center', gap: 24 },
  mascot: { width: '72%', maxWidth: 240, aspectRatio: 1 },
  image: { width: '100%', height: '100%' },
  copy: { width: '100%', alignItems: 'center', gap: 10 },
  title: { fontFamily: typography.editorial, fontSize: 28, textAlign: 'center' },
  subtitle: { fontFamily: typography.ui, fontSize: 16, lineHeight: 24, textAlign: 'center', maxWidth: 300 },
  status: { minHeight: 48, justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 9, paddingVertical: 12 },
  dot: { width: 7, height: 7, borderRadius: radii.full },
  retry: { minHeight: 48, paddingHorizontal: 20, borderWidth: 1, borderRadius: radii.full, flexDirection: 'row', alignItems: 'center', gap: 8 },
  retryLabel: { fontFamily: typography.ui, fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
