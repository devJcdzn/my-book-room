import { TransitionModal } from '@/src/components/transition-modal';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Canvas, Circle, Group, Image as SkiaImage, Oval, Path, Rect, Skia, useImage } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { cancelAnimation, Easing, useDerivedValue, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PAID_COLLECTIONS, useCollectionPurchases, type PaidCollection } from '@/src/services/collection-access';
import { controls, radii, typography } from '@/src/theme';
import { resolveAmbience } from '@/src/types/ambience';
import { useLibraryStore } from '@/src/store/library-store';
import { getReadingControlsPalette } from '@/src/utils/reading-session';
import { COLLECTION_SHOWCASES } from './room-collection-assets';

const STARS = [{ x: .12, y: .29 }, { x: .23, y: .18 }, { x: .34, y: .22 }, { x: .4, y: .12 }, { x: .75, y: .14 }, { x: .86, y: .23 }, { x: .8, y: .34 }, { x: .91, y: .4 }];

function collectionMotifs(size: number) {
  const ticks = Skia.PathBuilder.Make();
  for (let i = 0; i < 48; i++) {
    const angle = i * Math.PI / 24;
    const inner = size * (i % 4 === 0 ? .425 : .443);
    const outer = size * .46;
    ticks.moveTo(size / 2 + Math.cos(angle) * inner, size / 2 + Math.sin(angle) * inner);
    ticks.lineTo(size / 2 + Math.cos(angle) * outer, size / 2 + Math.sin(angle) * outer);
  }
  const constellation = Skia.PathBuilder.Make();
  for (const points of [[[.12, .29], [.23, .18], [.34, .22], [.4, .12]], [[.75, .14], [.86, .23], [.8, .34], [.91, .4]]]) {
    points.forEach(([x, y], i) => { if (i === 0) constellation.moveTo(x * size, y * size); else constellation.lineTo(x * size, y * size); });
  }
  const steam = Skia.PathBuilder.Make();
  for (const x of [.43, .5, .57]) {
    steam.moveTo(size * x, size * .87);
    steam.cubicTo(size * (x - .035), size * .83, size * (x + .035), size * .8, size * x, size * .76);
  }
  const cup = Skia.PathBuilder.Make();
  cup.moveTo(size * .41, size * .89);
  cup.cubicTo(size * .42, size * .97, size * .58, size * .97, size * .59, size * .89);
  cup.close();
  const leaf = Skia.PathBuilder.Make();
  leaf.moveTo(size * .13, size * .24);
  leaf.cubicTo(size * .1, size * .17, size * .21, size * .15, size * .2, size * .14);
  leaf.cubicTo(size * .23, size * .21, size * .18, size * .26, size * .13, size * .24);
  leaf.close();
  return { ticks: ticks.detach(), constellation: constellation.detach(), steam: steam.detach(), cup: cup.detach(), leaf: leaf.detach() };
}

function UnlockScene({ collection, onClose }: { collection: PaidCollection; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const size = Math.min(width - 48, height * .43, 400);
  const ambience = useLibraryStore(state => state.ambienceMode);
  const isNight = resolveAmbience(ambience) === 'night';
  const palette = getReadingControlsPalette(isNight);
  const observatory = collection === 'observatory';
  const ink = observatory && !isNight ? '#34465E' : palette.text;
  const accent = observatory ? (isNight ? '#D6BD85' : '#8D713D') : palette.accent;
  const motifs = useMemo(() => collectionMotifs(size), [size]);
  const image = useImage(COLLECTION_SHOWCASES[collection][0]);
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    // Start only after the official image has decoded, without blocking dismissal.
    if (!image) return;
    progress.value = reducedMotion ? 1 : 0;
    if (!reducedMotion) progress.value = withTiming(1, { duration: 2500, easing: Easing.linear });
    return () => cancelAnimation(progress);
  }, [image, progress, reducedMotion]);
  const reveal = useDerivedValue(() => {
    const t = Math.min(1, progress.value * (observatory ? 1.8 : 2.3));
    return 1 - (1 - t) ** 3;
  });
  const roomTransform = useDerivedValue(() => [{ translateY: (1 - reveal.value) * 9 }, { scale: .97 + reveal.value * .03 }]);
  const orbitTransform = useDerivedValue(() => [{ rotate: (1 - (1 - progress.value) ** 3) * .18 }]);
  const decorationOpacity = useDerivedValue(() => .26 + Math.sin(progress.value * Math.PI) * .18);
  const panelOpen = useDerivedValue(() => {
    const t = Math.min(1, progress.value * 2);
    return t * t * (3 - 2 * t);
  });
  const panelOpacity = useDerivedValue(() => .85 * (1 - panelOpen.value));
  const leftPanel = useDerivedValue(() => [{ translateX: -size * .45 * panelOpen.value }]);
  const rightPanel = useDerivedValue(() => [{ translateX: size * .45 * panelOpen.value }]);
  const steamTransform = useDerivedValue(() => [{ translateY: -progress.value * 7 }]);
  const leafTransform = useDerivedValue(() => [{ translateY: progress.value * 12 }, { translateX: Math.sin(progress.value * Math.PI) * 6 }]);
  const path = Skia.PathBuilder.Make();
  path.moveTo(size * .21, size * .2);
  path.cubicTo(size * .1, size * .1, size * .56, size * .06, size * .76, size * .22);
  path.cubicTo(size * .98, size * .48, size * .82, size * .9, size * .42, size * .88);
  const teaStroke = path.detach();
  return <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]}>
    <View style={styles.top}>
      <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={onClose} hitSlop={12} style={({ pressed }) => [styles.close, { backgroundColor: palette.surface, borderColor: palette.border }, pressed && styles.pressed]}><Ionicons name="close" size={21} color={ink} accessible={false} /></Pressable>
    </View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={[styles.artwork, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <Canvas style={{ width: size, height: size }} accessibilityElementsHidden>
        <Group opacity={decorationOpacity}>
          {observatory ? <Group origin={{ x: size / 2, y: size / 2 }} transform={orbitTransform}>
            <Oval x={size * .08} y={size * .24} width={size * .84} height={size * .52} color={accent} style="stroke" strokeWidth={1.2} />
            <Oval x={size * .23} y={size * .08} width={size * .54} height={size * .84} color={accent} style="stroke" strokeWidth={1} />
            <Circle cx={size / 2} cy={size / 2} r={size * .46} color={accent} style="stroke" strokeWidth={.7} />
            <Path path={motifs.ticks} color={accent} style="stroke" strokeWidth={1} />
            <Path path={motifs.constellation} color={accent} style="stroke" strokeWidth={1.1} end={reveal} />
            <Circle cx={size * .96} cy={size / 2} r={3.5} color={accent} />
            {STARS.map((star, i) => <Circle key={i} cx={size * star.x} cy={size * star.y} r={i % 2 ? 2.5 : 1.8} color={accent} />)}
          </Group> : <>
            <Path path={teaStroke} start={0} end={reveal} style="stroke" strokeWidth={1.5} strokeCap="round" color={accent} />
            <Group transform={leafTransform}>
              <Path path={motifs.leaf} color={accent} />
              <Oval x={size * .83} y={size * .64} width={6} height={14} color={accent} />
            </Group>
            <Path path={motifs.cup} color={ink} style="stroke" strokeWidth={1.4} />
            <Group transform={steamTransform}><Path path={motifs.steam} color={accent} style="stroke" strokeWidth={1.3} strokeCap="round" end={reveal} /></Group>
          </>}
        </Group>
        <Group opacity={reveal} origin={{ x: size / 2, y: size / 2 }} transform={roomTransform}>
          <SkiaImage image={image} x={0} y={0} width={size} height={size} fit="contain" />
        </Group>
        {!observatory && <Group opacity={panelOpacity}>
          {[leftPanel, rightPanel].map((transform, side) => <Group key={side} transform={transform}>
            <Rect x={size * (.08 + side * .42)} y={size * .16} width={size * .42} height={size * .66} color={palette.surfaceAlt} />
            <Rect x={size * (.08 + side * .42)} y={size * .16} width={size * .42} height={size * .66} color={palette.accent} style="stroke" strokeWidth={1.5} />
            {[1, 2].map(i => <Rect key={i} x={size * (.08 + side * .42 + i * .14)} y={size * .16} width={1} height={size * .66} color={palette.accent} />)}
            {[1, 2, 3, 4].map(i => <Rect key={i} x={size * (.08 + side * .42)} y={size * (.16 + i * .132)} width={size * .42} height={1} color={palette.accent} />)}
          </Group>)}
        </Group>}
      </Canvas>
      </View>
      <View style={styles.copy}>
        <Text accessibilityRole="header" style={[styles.title, { color: ink }]}>{PAID_COLLECTIONS[collection].name}</Text>
        <View style={[styles.status, { backgroundColor: palette.selection }]}>
          <Ionicons name="checkmark-circle-outline" color={palette.accent} size={18} accessible={false} />
          <Text style={[styles.subtitle, { color: palette.accent }]}>Coleção desbloqueada</Text>
        </View>
        <Text style={[styles.description, { color: palette.muted }]}>{observatory ? 'Um novo universo para suas leituras.' : 'Mais calma para cada página.'}</Text>
      </View>
    </ScrollView>
    <Pressable accessibilityRole="button" onPress={onClose}
      style={({ pressed }) => [styles.button, { backgroundColor: palette.action }, pressed && styles.pressed]}>
      <Text style={[styles.buttonText, { color: palette.actionText }]}>Explorar coleção</Text>
      <Ionicons name="arrow-forward" size={19} color={palette.actionText} accessible={false} />
    </Pressable>
  </SafeAreaView>;
}

export function CollectionUnlock({ preview, onPreviewClose }: { preview?: PaidCollection; onPreviewClose?: () => void } = {}) {
  const unlocked = useCollectionPurchases(state => state.unlocked);
  const collection = preview ?? unlocked[0];
  const close = () => {
    if (preview) onPreviewClose?.();
    else useCollectionPurchases.setState(state => ({ unlocked: state.unlocked.slice(1) }));
  };
  return <TransitionModal visible={Boolean(collection)} presentationStyle="fullScreen" onRequestClose={close}>
    <SafeAreaProvider>{collection ? <UnlockScene key={collection} collection={collection} onClose={close} /> : null}</SafeAreaProvider>
  </TransitionModal>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 24 },
  top: { alignItems: 'flex-end', paddingTop: 8 },
  close: { ...controls.iconButton, borderWidth: StyleSheet.hairlineWidth },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingVertical: 12 },
  artwork: { borderRadius: radii.large, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  copy: { alignItems: 'center', gap: 10 },
  title: { fontFamily: typography.editorial, fontSize: 34, lineHeight: 42, textAlign: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radii.full },
  subtitle: { fontSize: 14, fontWeight: '600', textAlign: 'center', flexShrink: 1 },
  description: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  button: { ...controls.button, marginVertical: 12, flexDirection: 'row', gap: 8 },
  buttonText: { ...controls.buttonText, flexShrink: 1, textAlign: 'center' },
  pressed: controls.buttonPressed,
});
