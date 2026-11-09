import Ionicons from '@expo/vector-icons/Ionicons';
import { Canvas, Circle, Group, Path, RadialGradient, Skia, vec } from '@shopify/react-native-skia';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { AppState, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { cancelAnimation, Easing, useDerivedValue, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import scene from '@/assets/room-loading-scene.json';
import { colors, darkTheme, radii, typography } from '@/src/theme';

export type RoomLoadingPhase = 'library' | 'furniture' | 'lighting';
export type RoomLoadingAmbience = 'day' | 'night';
type RoomLoadingProps = { ambience: RoomLoadingAmbience; phase: RoomLoadingPhase; isSlow: boolean; onRetry: () => void };
type ScenePart = { id: string; delay: number; paths: { d: string; fill: string; stroke?: string }[] };
const DURATION = 2800;

function AssemblingPart({ part, progress }: { part: ScenePart; progress: SharedValue<number> }) {
  const paths = useMemo(() => part.paths.map(path => ({ ...path, shape: Skia.Path.MakeFromSVGString(path.d) })), [part]);
  const reveal = useDerivedValue(() => {
    const t = Math.max(0, Math.min(1, (progress.value * DURATION / 1000 - part.delay) / .45));
    return 1 - Math.pow(1 - t, 3);
  });
  const transform = useDerivedValue(() => [{ translateY: (1 - reveal.value) * 5 }]);
  return <Group opacity={reveal} transform={transform}>
    {paths.map((path, index) => path.shape ? <Group key={index}>
      {path.fill !== 'none' ? <Path path={path.shape} color={path.fill} /> : null}
      <Path path={path.shape} color={path.stroke ?? scene.stroke} style="stroke" strokeWidth={scene.strokeWidth} strokeJoin="round" strokeCap="round" />
    </Group> : null)}
  </Group>;
}

export function RoomLoading({ ambience, phase, isSlow, onRetry }: RoomLoadingProps) {
  const { width, height } = useWindowDimensions();
  const size = Math.min(320, width - 48, height * 0.46);
  const night = ambience === 'night';
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(reducedMotion ? 1 : 0);
  const muted = night ? darkTheme.textMuted : colors.muted;

  useFocusEffect(useCallback(() => {
    const update = () => {
      cancelAnimation(progress);
      if (reducedMotion) progress.set(1);
      else if (AppState.currentState === 'active') {
        progress.set(withTiming(1, { duration: DURATION * (1 - progress.get()), easing: Easing.linear }));
      }
    };
    update();
    const subscription = AppState.addEventListener('change', update);
    return () => { subscription.remove(); cancelAnimation(progress); };
  }, [progress, reducedMotion]));

  const light = useDerivedValue(() => Math.max(0, Math.min(1, (progress.value - .8) * 5)));
  const labels = { library: 'Carregando sua biblioteca', furniture: 'Preparando os móveis', lighting: 'Finalizando a iluminação' };
  return <View style={[styles.overlay, { backgroundColor: night ? darkTheme.bg : colors.softFill }]}>
    <View style={styles.content}>
      <View style={{ width: size, height: size * scene.height / scene.width }} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Canvas style={StyleSheet.absoluteFill}>
          <Group transform={[{ scale: size / scene.width }]}>
            {scene.groups.map(part => <AssemblingPart key={part.id} part={part} progress={progress} />)}
            <Group opacity={light}>
              <Circle cx={84} cy={101} r={38}>
                <RadialGradient c={vec(84, 101)} r={38} colors={['#FFE9A840', '#FFE9A800']} />
              </Circle>
            </Group>
          </Group>
        </Canvas>
      </View>
      <View style={styles.copy} accessibilityLiveRegion="polite">
        <Text accessibilityRole="header" style={[styles.title, { color: night ? darkTheme.text : colors.ink }]}>
          {isSlow ? 'Está demorando um pouco' : 'Preparando seu cantinho'}
        </Text>
        <Text style={[styles.subtitle, { color: muted }]}>
          {isSlow ? 'Você pode tentar carregar a sala novamente.' : labels[phase]}
        </Text>
      </View>
      {isSlow ? <Pressable accessibilityRole="button" accessibilityLabel="Tentar carregar a sala novamente" onPress={onRetry}
        style={({ pressed }) => [styles.retry, { backgroundColor: night ? darkTheme.primary : colors.ink }, pressed && styles.pressed]}>
        <Ionicons color={night ? darkTheme.actionText : colors.paper} name="refresh-outline" size={17} accessible={false} />
        <Text style={[styles.retryLabel, { color: night ? darkTheme.actionText : colors.paper }]}>Tentar novamente</Text>
      </Pressable> : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 16 },
  content: { width: '100%', maxWidth: 340, alignItems: 'center', gap: 20 },
  copy: { width: '100%', alignItems: 'center', gap: 8 },
  title: { fontFamily: typography.editorial, fontSize: 27, lineHeight: 34, textAlign: 'center' },
  subtitle: { fontFamily: typography.ui, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 280 },
  retry: { minHeight: 48, paddingHorizontal: 20, borderRadius: radii.full, flexDirection: 'row', alignItems: 'center', gap: 8 },
  retryLabel: { fontFamily: typography.ui, fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
