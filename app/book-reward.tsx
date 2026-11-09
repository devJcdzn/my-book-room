import { AppDialog, showAlert } from '@/src/components/app-dialog';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { Image } from 'expo-image';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import { router, Stack, usePathname, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookCover } from '@/src/components/book-cover';
import { getReadingControlsPalette } from '@/src/utils/reading-session';
import { useLibraryStore } from '@/src/store/library-store';
import { resolveAmbience } from '@/src/types/ambience';
import { colors, controls, radii, typography } from '@/src/theme';

export default function BookRewardScreen() {
  const pathname = usePathname();
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const book = useLibraryStore((state) => state.books.find((item) => item.id === bookId));
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const reveal = useSharedValue(reducedMotion ? 1 : 0);
  const pop = useSharedValue(1);
  const frame = useSharedValue(reducedMotion ? 1 : 0);
  const burst = useSharedValue(0);
  const isNight = resolveAmbience(ambienceMode) === 'night';
  const palette = getReadingControlsPalette(isNight);
  const cardRef = useRef<View>(null);
  const sharingRef = useRef(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareCover, setShareCover] = useState<{ url: string; failed: boolean }>();
  const coverReady = !book?.coverUrl || shareCover?.url === book.coverUrl;

  const shareReward = async () => {
    if (sharingRef.current || !cardRef.current || !coverReady) return;
    sharingRef.current = true;
    setIsSharing(true);
    let uri: string | undefined;
    try {
      if (!await Sharing.isAvailableAsync()) {
        showAlert('Compartilhamento indisponível', 'Este aparelho não pode compartilhar a imagem agora.');
        return;
      }
      uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile', width: 1080, height: 1920 });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Minha nova capa no Nookly' });
    } catch {
      showAlert('Não foi possível compartilhar', 'Tente novamente em alguns instantes.');
    } finally {
      if (uri) releaseCapture(uri);
      sharingRef.current = false;
      setIsSharing(false);
    }
  };

  const playReward = useCallback(() => {
    [reveal, pop, frame, burst].forEach(cancelAnimation);
    reveal.set(reducedMotion ? 1 : 0);
    pop.set(1);
    frame.set(reducedMotion ? 1 : 0);
    burst.set(0);
    if (reducedMotion) return;
    reveal.set(withDelay(220, withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.cubic) })));
    pop.set(withSequence(
      withTiming(0.94, { duration: 220 }),
      withDelay(420, withSpring(1.1, { damping: 10, stiffness: 160 })),
      withTiming(1.03, { duration: 300 }),
    ));
    frame.set(withDelay(780, withSpring(1, { damping: 12, stiffness: 150 })));
    burst.set(withDelay(900, withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) })));
  }, [burst, frame, pop, reducedMotion, reveal]);

  useEffect(() => {
    playReward();
    const haptic = setTimeout(() => {
      if (process.env.EXPO_OS === 'ios' && book?.status === 'completed') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, reducedMotion ? 0 : 950);
    return () => {
      clearTimeout(haptic);
      [reveal, pop, frame, burst].forEach(cancelAnimation);
    };
  }, [book?.id, book?.status, burst, frame, playReward, pop, reducedMotion, reveal]);

  const bookMotion = useAnimatedStyle(() => ({
    opacity: 1 - reveal.value,
    transform: [{ translateY: reveal.value * 35 }, { rotate: `${-8 * reveal.value}deg` }, { scale: 1 - reveal.value * 0.12 }],
  }));
  const coverMotion = useAnimatedStyle(() => ({
    transform: [{ translateY: -35 * reveal.value }, { rotate: `${Math.sin(reveal.value * Math.PI) * -4}deg` }, { scale: pop.value }],
  }));
  const frameMotion = useAnimatedStyle(() => ({
    opacity: Math.min(1, frame.value),
    transform: [{ scale: 1.3 - frame.value * 0.3 }],
  }));

  const glowMotion = useAnimatedStyle(() => ({
    opacity: reducedMotion ? 0.1 : 0.1 * frame.value + 0.12 * Math.sin(burst.value * Math.PI),
    transform: [{ scale: 0.8 + frame.value * 0.2 + burst.value * 0.2 }],
  }));

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <AppDialog enabled={pathname === '/book-reward'} />
      {book?.status === 'completed' ? (
        <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.captureLayer}>
          <View ref={cardRef} collapsable={false} style={[styles.shareCard, { backgroundColor: palette.background }]}>
            <View style={styles.shareArtwork}>
              <View style={[styles.shareGlow, { backgroundColor: palette.selection }]} />
              <View style={styles.sharePoster}>
                <View style={styles.frame} />
                <View style={[styles.cover, { backgroundColor: book.coverColor, overflow: 'hidden' }]}>
                  {book.coverUrl && !(shareCover?.url === book.coverUrl && shareCover.failed) ? <Image source={book.coverUrl} contentFit="cover" transition={0} style={StyleSheet.absoluteFill} onLoad={() => setShareCover({ url: book.coverUrl!, failed: false })} onError={() => setShareCover({ url: book.coverUrl!, failed: true })} /> : <Text allowFontScaling={false} style={styles.fallbackTitle}>{book.title}</Text>}
                </View>
              </View>
            </View>
            <Text allowFontScaling={false} style={[styles.shareTitle, { color: palette.text }]}>Desbloqueei uma nova capa</Text>
            <Text allowFontScaling={false} numberOfLines={2} adjustsFontSizeToFit style={[styles.shareBookTitle, { color: palette.text }]}>{book.title}</Text>
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.shareAuthor, { color: palette.muted }]}>{book.author}</Text>
            <Text allowFontScaling={false} style={[styles.shareDescription, { color: palette.muted }]}>Mais uma leitura concluída.
Mais uma história na minha sala.</Text>
            <View style={styles.watermark}>
              <Image source={require('@/assets/images/android-icon-monochrome.png')} contentFit="contain" tintColor={palette.text} transition={0} style={styles.watermarkLogo} />
              <Text allowFontScaling={false} style={[styles.watermarkName, { color: palette.text }]}>Nookly</Text>
            </View>
          </View>
        </View>
      ) : null}
    <ScrollView contentInsetAdjustmentBehavior="never" contentContainerStyle={[styles.content, { paddingTop: insets.top + 14, paddingBottom: 20 }]} style={{ flex: 1, backgroundColor: palette.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style={isNight ? 'light' : 'dark'} />
      <Pressable accessibilityRole="button" accessibilityLabel="Fechar apresentação" onPress={() => router.back()} style={[styles.close, { backgroundColor: palette.surface }]}>
        <Ionicons name="close" size={22} color={palette.text} />
      </Pressable>
      {book?.status === 'completed' ? (
        <>
          <View style={styles.artwork}>
            <Animated.View pointerEvents="none" style={[styles.glow, { backgroundColor: palette.accent }, glowMotion]} />
            {!reducedMotion ? Array.from({ length: 12 }, (_, index) => <RewardSpark key={index} index={index} progress={burst} color={index % 2 ? palette.accent : isNight ? '#E9C786' : '#A87932'} />) : null}
            <Animated.View style={[styles.book, bookMotion]}>
              <BookCover color={book.coverColor} coverUrl={book.coverUrl} style={styles.cover} />
              <View style={styles.pages} />
            </Animated.View>
            <Animated.View style={[styles.poster, coverMotion]}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Rever a animação da capa de ${book.title}`} onPress={playReward} style={styles.posterTouch}>
              <Animated.View style={[styles.frame, frameMotion]} />
              <BookCover color={book.coverColor} coverUrl={book.coverUrl} style={styles.cover}>
                {!book.coverUrl ? <Text style={styles.fallbackTitle}>{book.title}</Text> : null}
              </BookCover>
              </Pressable>
            </Animated.View>
          </View>
          {!reducedMotion ? <Pressable accessibilityRole="button" onPress={playReward} style={styles.replay}>
            <Ionicons name="refresh-outline" size={16} color={palette.muted} />
            <Text style={[styles.replayText, { color: palette.muted }]}>Rever animação</Text>
          </Pressable> : null}
          <Animated.View entering={reducedMotion ? undefined : FadeIn.delay(1100).duration(400)} style={styles.copy}>
            <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>Leitura concluída</Text>
            <Text style={[styles.bookTitle, { color: palette.text }]}>{book.title}</Text>
            {book.rating ? (
              <View accessible accessibilityLabel={`Sua avaliação: ${book.rating} de 5 estrelas`} style={styles.rating}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <Ionicons key={value} name={value <= book.rating! ? 'star' : 'star-outline'} size={19} color={palette.accent} />
                ))}
              </View>
            ) : null}
            <View style={[styles.rewardPanel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <View style={[styles.check, { backgroundColor: palette.selection }]}>
                <Ionicons name="gift-outline" size={22} color={palette.accent} accessible={false} />
              </View>
              <View style={styles.rewardCopy}>
                <Text style={[styles.rewardTitle, { color: palette.text }]}>Capa liberada para pôsteres</Text>
                <Text style={[styles.hint, { color: palette.muted }]}>Na personalização da sala, adicione um pôster e escolha esta capa.</Text>
              </View>
            </View>
          </Animated.View>
        </>
      ) : <Text style={[styles.description, { color: palette.text }]}>Este livro ainda não tem uma capa desbloqueada.</Text>}
    </ScrollView>
      {book?.status === 'completed' ? (
        <View style={[styles.footer, { backgroundColor: palette.background, paddingBottom: Math.max(insets.bottom, 14) }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Compartilhar conquista" accessibilityState={{ disabled: isSharing || !coverReady, busy: isSharing }} disabled={isSharing || !coverReady} onPress={() => void shareReward()} style={({ pressed }) => [styles.action, { backgroundColor: palette.selection }, (isSharing || !coverReady) && styles.disabled, pressed && styles.pressed]}>
            {isSharing ? <ActivityIndicator color={palette.text} /> : <Ionicons name="share-outline" size={20} color={palette.accent} />}
            <Text style={[styles.actionLabel, { color: palette.accent }]}>{isSharing ? 'Preparando…' : 'Compartilhar'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.dismissTo('/')} style={({ pressed }) => [styles.action, { backgroundColor: palette.action }, pressed && styles.pressed]}>
            <Ionicons name="home-outline" size={20} color={palette.actionText} />
            <Text style={[styles.actionLabel, { color: palette.actionText }]}>Ir para minha sala</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function RewardSpark({ index, progress, color }: { index: number; progress: SharedValue<number>; color: string }) {
  const angle = (index / 12) * Math.PI * 2;
  const motion = useAnimatedStyle(() => {
    const value = progress.value;
    return {
      opacity: Math.sin(value * Math.PI),
      transform: [
        { translateX: Math.cos(angle) * (85 + value * 80) },
        { translateY: Math.sin(angle) * (110 + value * 70) - 30 + value * value * 30 },
        { rotate: `${index * 30 + value * 110}deg` },
        { scale: Math.sin(value * Math.PI) },
      ],
    };
  });
  return <Animated.View pointerEvents="none" accessible={false} style={[styles.spark, motion]}><Ionicons name={index % 3 ? 'sparkles' : 'ellipse'} size={index % 3 ? 13 : 5} color={color} /></Animated.View>;
}

const styles = StyleSheet.create({
  captureLayer: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  shareCard: { width: 320, height: 568, paddingHorizontal: 26, paddingTop: 24, paddingBottom: 20, alignItems: 'center', gap: 8 },
  shareArtwork: { height: 210, width: '100%', alignItems: 'center', justifyContent: 'center' },
  shareGlow: { position: 'absolute', width: 200, height: 200, borderRadius: 100 },
  sharePoster: { width: 120, height: 180 },
  shareTitle: { fontFamily: typography.editorial, fontSize: 24, lineHeight: 29, textAlign: 'center' },
  shareBookTitle: { fontSize: 14, lineHeight: 18, fontWeight: '600', textAlign: 'center' },
  shareAuthor: { fontSize: 12, lineHeight: 16, textAlign: 'center' },
  shareDescription: { fontSize: 12, lineHeight: 17, textAlign: 'center' },
  watermark: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 'auto' },
  watermarkLogo: { width: 28, height: 28 },
  watermarkName: { fontFamily: typography.editorial, fontSize: 19 },
  footer: { width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 28, paddingTop: 12, gap: 10 },
  disabled: controls.buttonDisabled,
  content: { flexGrow: 1, width: '100%', maxWidth: 600, alignSelf: 'center', paddingHorizontal: 28, gap: 12 },
  close: { ...controls.iconButton, alignSelf: 'flex-end' },
  artwork: { height: 292, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  glow: { position: 'absolute', width: 260, height: 260, borderRadius: 130 },
  spark: { position: 'absolute', left: '50%', top: '50%', width: 14, height: 14, marginLeft: -7, marginTop: -7, alignItems: 'center', justifyContent: 'center' },
  posterTouch: { flex: 1 },
  replay: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: -30 },
  replayText: { fontSize: 12 },
  book: { position: 'absolute', width: 176, height: 264, borderRadius: 6, backgroundColor: colors.inkSoft, paddingLeft: 6 },
  pages: { position: 'absolute', right: -6, top: 5, bottom: 5, width: 6, backgroundColor: colors.softFill, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  poster: { width: 176, height: 264 },
  cover: { width: '100%', height: '100%', borderRadius: 3 },
  frame: { position: 'absolute', top: -14, bottom: -14, left: -14, right: -14, borderWidth: 6, borderColor: colors.inkSoft, backgroundColor: colors.softFill, borderRadius: 3 },
  fallbackTitle: { color: colors.white, fontFamily: typography.editorial, fontSize: 22, textAlign: 'center', padding: 14, backgroundColor: colors.ink },
  rating: { flexDirection: 'row', gap: 5, paddingVertical: 3 },
  rewardPanel: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radii.large, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth },
  rewardCopy: { flex: 1, gap: 3 },
  rewardTitle: { fontSize: 15, fontWeight: '600' },
  copy: { alignItems: 'center', gap: 10 },
  check: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: typography.editorial, fontSize: 26, lineHeight: 33, textAlign: 'center', maxWidth: 340 },
  bookTitle: { fontSize: 15, lineHeight: 22, fontWeight: '600', textAlign: 'center' },
  description: { fontSize: 15, lineHeight: 23, textAlign: 'center', maxWidth: 360 },
  hint: { fontSize: 13, lineHeight: 20 },
  action: { ...controls.button, flexDirection: 'row', gap: 10 },
  actionLabel: { ...controls.buttonText, flexShrink: 1, textAlign: 'center' },
  pressed: controls.buttonPressed,
});
