import { SegmentedTabs } from '@/src/components/segmented-tabs';
import { AppDialog, showAlert } from '@/src/components/app-dialog';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { BookCover } from '@/src/components/book-cover';
import { LibrarySheet } from '@/src/components/library-sheet';
import { resolveAmbience } from '@/src/types/ambience';
import { useLibraryStore } from '@/src/store/library-store';
import type { ReadingSession } from '@/src/types/book';
import { controls, colors, darkTheme, radii, typography } from '@/src/theme';
import { readingTimeLabel, readingSessionDate, formatReadingDuration, getReadingControlsPalette, getReadingSessionPalette } from '@/src/utils/reading-session';

type ShareImageMode = 'classic' | 'card';

export default function ReadingSessionSummaryScreen() {
  const pathname = usePathname();
  const { sessionId, returnTo, openShare } = useLocalSearchParams<{ sessionId?: string; returnTo?: string; openShare?: string }>();
  const insets = useSafeAreaInsets();
  const sessions = useLibraryStore((state) => state.readingSessions);
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const shareImageRef = useRef<View>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [shareOptionsOverride, setShareOptionsOverride] = useState<boolean | undefined>();
  const isShareOptionsVisible = shareOptionsOverride ?? openShare === '1';
  const [shareImageMode, setShareImageMode] = useState<ShareImageMode>('classic');
  const [previewBackground, setPreviewBackground] = useState<'light' | 'dark'>('light');
  const isNight = resolveAmbience(ambienceMode) === 'night';
  const session = sessions.find((item) => item.id === sessionId);
  const progressPercent = session?.totalPages ? Math.min(100, Math.round(session.endingPage / session.totalPages * 100)) : 0;
  const palette = useMemo(() => getReadingSessionPalette(session?.coverColor ?? colors.terracotta, isNight), [session?.coverColor, isNight]);
  const sharePalette = getReadingControlsPalette(isNight);
  const shareTextColors = previewBackground === 'dark'
    ? { primary: colors.paper, secondary: darkTheme.textMuted }
    : { primary: colors.ink, secondary: colors.inkSoft };

  const shareSessionImage = async () => {
    if (!session || isExporting || !shareImageRef.current) return;

    setIsExporting(true);
    try {
      const imageUri = await captureRef(shareImageRef, { format: 'png', quality: 1, result: 'tmpfile' });
      const Sharing = await import('expo-sharing');
      if (!(await Sharing.isAvailableAsync())) {
        showAlert('Compartilhamento indisponível', 'Não foi possível abrir o menu de compartilhamento neste dispositivo.');
        return;
      }
      await Sharing.shareAsync(imageUri, { mimeType: 'image/png', dialogTitle: 'Compartilhar sessão', UTI: 'public.png' });
    } catch {
      showAlert('Não foi possível gerar a imagem', 'Tente novamente em instantes.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.background, paddingTop: insets.top + 8 }]}>
      <StatusBar style={isNight ? 'light' : 'dark'} />
      <View style={styles.header}>
        <Pressable
          accessibilityLabel={returnTo === 'diary' ? 'Voltar para a atividade' : 'Voltar'}
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => {
            if (returnTo === 'diary' && router.canGoBack()) router.back();
            else router.replace(returnTo === 'diary' ? '/(tabs)/diary' : '/');
          }}
          style={styles.backButton}
        >
          <Ionicons color={palette.text} name="chevron-back" size={24} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Sessão salva</Text>
        <View style={styles.backButton} />
      </View>

      {session ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={[styles.successMark, { backgroundColor: palette.surface }]}>
              <Ionicons color={palette.accent} name="checkmark" size={25} />
            </View>
            <Text style={[styles.sessionName, { color: palette.text }]}>{session.name}</Text>
            <Text style={[styles.sessionDate, { color: palette.muted }]}>
              {new Date(readingSessionDate(session)).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
          </View>

          <View style={[styles.bookCard, { backgroundColor: palette.surface }]}>
            <BookCover color={session.coverColor} coverUrl={session.coverUrl} style={styles.cover} />
            <Text numberOfLines={2} style={[styles.bookTitle, { color: palette.text }]}>{session.bookTitle}</Text>
            <Text numberOfLines={1} style={[styles.bookAuthor, { color: palette.muted }]}>{session.bookAuthor}</Text>
          </View>

          <View style={[styles.statsCard, { backgroundColor: palette.surface }]}>
            <Metric label={readingTimeLabel(session)} value={formatReadingDuration(session.durationSeconds)} palette={palette} />
            <View style={[styles.metricDivider, { backgroundColor: palette.border }]} />
            <Metric label="Páginas lidas" value={String(session.pagesRead)} palette={palette} />
          </View>

          <View style={[styles.progressCard, { backgroundColor: palette.surface }]}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Seu progresso</Text>
            <View style={styles.progressRow}>
              <View style={styles.progressPoint}>
                <Text style={[styles.pageNumber, { color: palette.text }]}>{session.startingPage}</Text>
                <Text style={[styles.pageLabel, { color: palette.muted }]}>página inicial</Text>
              </View>
              <Ionicons color={palette.accent} name="arrow-forward" size={19} />
              <View style={[styles.progressPoint, styles.progressEnd]}>
                <Text style={[styles.pageNumber, { color: palette.text }]}>{session.endingPage}</Text>
                <Text style={[styles.pageLabel, { color: palette.muted }]}>página final</Text>
              </View>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: palette.border }]}>
              <View style={[styles.progressFill, { backgroundColor: palette.accent, width: `${progressPercent}%` }]} />
            </View>
            <Text style={[styles.totalLabel, { color: palette.muted }]}>{progressPercent}% do livro</Text>
          </View>

          {session.description ? (
            <View style={[styles.descriptionCard, { backgroundColor: palette.surface }]}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Sobre esta leitura</Text>
              <Text style={[styles.description, { color: palette.muted }]}>{session.description}</Text>
            </View>
          ) : null}

          <View style={styles.shareActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShareOptionsOverride(true)}
              style={({ pressed }) => [styles.shareButton, { backgroundColor: isNight ? darkTheme.primary : palette.accent }, pressed && styles.pressed]}
            >
              <Ionicons color={palette.actionText} name="share-outline" size={19} />
              <Text style={[styles.shareButtonText, { color: palette.actionText }]}>Compartilhar sessão</Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/')}
            style={({ pressed }) => [styles.homeButton, { backgroundColor: palette.surface, borderColor: palette.border }, pressed && styles.pressed]}
          >
            <Ionicons color={palette.accent} name="home-outline" size={19} />
            <Text style={[styles.homeButtonText, { color: palette.text }]}>Voltar para o quarto</Text>
          </Pressable>
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>Esta sessão não está disponível.</Text>
          <Pressable onPress={() => router.replace('/')} style={[styles.homeButton, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Ionicons color={palette.accent} name="home-outline" size={19} />
            <Text style={[styles.homeButtonText, { color: palette.text }]}>Voltar para o quarto</Text>
          </Pressable>
        </View>
      )}

      {session ? (
        <View
          ref={shareImageRef}
          collapsable={false}
          pointerEvents="none"
          style={[styles.exportCanvas, shareImageMode === 'card' && styles.exportCardCanvas]}
        >
          {shareImageMode === 'card' ? (
            <SessionShareCard session={session} palette={sharePalette} progressPercent={progressPercent} />
          ) : (
            <>
              <Text style={[styles.exportSessionName, { color: shareTextColors.primary }]}>{session.name}</Text>
              <Text style={[styles.exportDate, { color: shareTextColors.secondary }]}>
                {new Date(readingSessionDate(session)).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
              <View style={[styles.exportBookCard, { backgroundColor: sharePalette.surface }]}>
                <BookCover color={session.coverColor} coverUrl={session.coverUrl} style={styles.exportCover} />
                <Text style={[styles.exportBookTitle, { color: sharePalette.text }]}>{session.bookTitle}</Text>
                <Text style={[styles.exportBookAuthor, { color: sharePalette.muted }]}>{session.bookAuthor}</Text>
              </View>
              <View style={[styles.exportStatsCard, { backgroundColor: sharePalette.selection }]}>
                <Metric label={readingTimeLabel(session)} value={formatReadingDuration(session.durationSeconds)} palette={sharePalette} />
                <View style={[styles.metricDivider, { backgroundColor: sharePalette.border }]} />
                <Metric label="Páginas lidas" value={String(session.pagesRead)} palette={sharePalette} />
              </View>
              <View style={[styles.exportProgressCard, { backgroundColor: sharePalette.surface }]}>
                <Text style={[styles.exportSectionTitle, { color: sharePalette.text }]}>Seu progresso</Text>
                <View style={styles.progressRow}>
                  <View style={styles.progressPoint}>
                    <Text style={[styles.pageNumber, { color: sharePalette.text }]}>{session.startingPage}</Text>
                    <Text style={[styles.pageLabel, { color: sharePalette.muted }]}>página inicial</Text>
                  </View>
                  <Ionicons color={sharePalette.accent} name="arrow-forward" size={19} />
                  <View style={[styles.progressPoint, styles.progressEnd]}>
                    <Text style={[styles.pageNumber, { color: sharePalette.text }]}>{session.endingPage}</Text>
                    <Text style={[styles.pageLabel, { color: sharePalette.muted }]}>página final</Text>
                  </View>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: sharePalette.border }]}>
                  <View style={[styles.progressFill, { backgroundColor: sharePalette.accent, width: `${progressPercent}%` }]} />
                </View>
                <Text style={[styles.totalLabel, { color: sharePalette.muted }]}>{progressPercent}% do livro</Text>
              </View>
              {session.description ? <Text style={[styles.exportDescription, { color: shareTextColors.secondary }]}>{session.description}</Text> : null}
              <Text style={[styles.watermark, { color: shareTextColors.secondary }]}>Nookly · Sua biblioteca, no seu ritmo</Text>
            </>
          )}
        </View>
      ) : null}

      <AppDialog enabled={pathname === '/reading-session' && (!session || !isShareOptionsVisible)} />
      <LibrarySheet
        backgroundColor={sharePalette.surface}
        description="Simule o fundo da foto; ele não entra na imagem exportada."
        height={800}
        mutedColor={sharePalette.muted}
        onClose={() => setShareOptionsOverride(false)}
        textColor={sharePalette.text}
        title="Compartilhar sessão"
        visible={Boolean(session) && isShareOptionsVisible}
      >
        <AppDialog enabled={pathname === '/reading-session' && isShareOptionsVisible} />
        <View style={styles.shareSheetContent}>
          <Text style={[styles.shareOptionsTitle, { color: sharePalette.text }]}>Formato da imagem</Text>
          <SegmentedTabs
            items={[
              { id: 'classic', label: 'Clássico', icon: 'reader-outline' },
              { id: 'card', label: 'Card único', icon: 'albums-outline' },
            ]}
            selected={shareImageMode}
            onSelect={setShareImageMode}
            isNight={isNight}
          />

          <View style={[styles.sharePreview, shareImageMode === 'classic' ? styles.sharePreviewClassic : styles.sharePreviewCard, { backgroundColor: previewBackground === 'light' ? colors.softFill : darkTheme.bg }]}>
            {shareImageMode === 'card' && session ? (
              <SessionShareCard preview session={session} palette={sharePalette} progressPercent={progressPercent} />
            ) : (
              <View style={styles.previewClassic}>
                <Text numberOfLines={1} style={[styles.previewSessionName, { color: shareTextColors.primary }]}>{session?.name}</Text>
                <Text style={[styles.previewDate, { color: shareTextColors.secondary }]}>
                  {session ? new Date(readingSessionDate(session)).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                </Text>
                <View style={[styles.previewClassicBook, { backgroundColor: sharePalette.surface }]}>
                  {session ? <BookCover color={session.coverColor} coverUrl={session.coverUrl} style={styles.previewClassicCover} /> : null}
                  <Text numberOfLines={2} style={[styles.previewClassicBookTitle, { color: sharePalette.text }]}>{session?.bookTitle}</Text>
                  <Text numberOfLines={1} style={[styles.previewClassicBookAuthor, { color: sharePalette.muted }]}>{session?.bookAuthor}</Text>
                </View>
                <View style={[styles.previewClassicStats, { backgroundColor: sharePalette.selection }]}>
                  <View style={styles.previewClassicMetric}>
                    <Text style={[styles.previewMetric, { color: sharePalette.accent }]}>{session ? formatReadingDuration(session.durationSeconds) : ''}</Text>
                    <Text style={[styles.previewMetricLabel, { color: sharePalette.muted }]}>{session ? readingTimeLabel(session) : 'Tempo'}</Text>
                  </View>
                  <View style={[styles.previewDivider, { backgroundColor: sharePalette.border }]} />
                  <View style={styles.previewClassicMetric}>
                    <Text style={[styles.previewMetric, { color: sharePalette.accent }]}>{session?.pagesRead}</Text>
                    <Text style={[styles.previewMetricLabel, { color: sharePalette.muted }]}>Páginas lidas</Text>
                  </View>
                </View>
                <View style={[styles.previewClassicProgress, { backgroundColor: sharePalette.surface }]}>
                  <Text style={[styles.previewProgressTitle, { color: sharePalette.text }]}>Seu progresso</Text>
                  <View style={styles.previewClassicProgressRow}>
                    <View style={styles.previewClassicPage}>
                      <Text style={[styles.previewProgressPages, { color: sharePalette.text }]}>{session?.startingPage}</Text>
                      <Text style={[styles.previewMetricLabel, { color: sharePalette.muted }]}>página inicial</Text>
                    </View>
                    <Ionicons color={sharePalette.accent} name="arrow-forward" size={12} />
                    <View style={[styles.previewClassicPage, styles.previewClassicPageEnd]}>
                      <Text style={[styles.previewProgressPages, { color: sharePalette.text }]}>{session?.endingPage}</Text>
                      <Text style={[styles.previewMetricLabel, { color: sharePalette.muted }]}>página final</Text>
                    </View>
                  </View>
                  <View style={[styles.previewTrack, { backgroundColor: sharePalette.border }]}>
                    <View style={[styles.previewFill, { backgroundColor: sharePalette.accent, width: `${progressPercent}%` }]} />
                  </View>
                  <Text style={[styles.previewProgressPercent, { color: sharePalette.muted }]}>{progressPercent}% do livro</Text>
                </View>
                {session?.description ? <Text numberOfLines={1} style={[styles.previewDate, { color: shareTextColors.secondary }]}>{session.description}</Text> : null}
                <Text style={[styles.previewWatermark, { color: shareTextColors.secondary }]}>Nookly · Sua biblioteca, no seu ritmo</Text>
              </View>
            )}
          </View>

          <View style={styles.previewBackgroundHeading}>
            <Text style={[styles.previewBackgroundTitle, { color: sharePalette.text }]}>Prévia sobre fotos</Text>
            <Text style={[styles.previewBackgroundHint, { color: sharePalette.muted }]}>Apenas simula a foto ao fundo.</Text>
          </View>
          <View style={styles.previewBackgroundOptions}>
            {(['light', 'dark'] as const).map((tone) => (
              <Pressable
                key={tone}
                accessibilityRole="button"
                accessibilityState={{ selected: previewBackground === tone }}
                onPress={() => setPreviewBackground(tone)}
                style={[styles.previewBackgroundOption, { borderColor: previewBackground === tone ? sharePalette.accent : sharePalette.border }]}
              >
                <View style={[styles.previewBackgroundSwatch, { backgroundColor: tone === 'light' ? colors.softFill : darkTheme.bg }]} />
                <Text style={[styles.previewBackgroundText, { color: sharePalette.text }]}>{tone === 'light' ? 'Foto clara' : 'Foto escura'}</Text>
                {previewBackground === tone ? <Ionicons color={sharePalette.accent} name="checkmark-circle" size={17} /> : null}
              </Pressable>
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={isExporting}
            onPress={() => {
              setShareOptionsOverride(false);
              void shareSessionImage();
            }}
            style={({ pressed }) => [styles.shareButton, { backgroundColor: sharePalette.action }, (pressed || isExporting) && styles.pressed]}
          >
            <Ionicons color={sharePalette.actionText} name="share-outline" size={19} />
            <Text style={[styles.shareButtonText, { color: sharePalette.actionText }]}>Continuar para compartilhar</Text>
          </Pressable>
        </View>
      </LibrarySheet>
    </View>
  );
}

function SessionShareCard({
  session,
  palette,
  progressPercent,
  preview = false,
}: {
  session: ReadingSession;
  palette: ReturnType<typeof getReadingControlsPalette>;
  progressPercent: number;
  preview?: boolean;
}) {
  return (
    <View style={[styles.socialCard, preview ? styles.socialCardPreview : styles.socialCardExport, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.socialCardHeading}>
        <Text numberOfLines={2} style={[styles.socialSessionName, preview && styles.socialSessionNamePreview, { color: palette.text }]}>{session.name}</Text>
        <Text style={[styles.socialDate, preview && styles.socialDatePreview, { color: palette.muted }]}>
          {new Date(readingSessionDate(session)).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}
        </Text>
      </View>

      <View style={[styles.socialBookRow, { backgroundColor: palette.surfaceAlt }]}>
        <BookCover color={session.coverColor} coverUrl={session.coverUrl} style={[styles.socialCover, preview && styles.socialCoverPreview]} />
        <View style={styles.socialBookCopy}>
          <Text numberOfLines={2} style={[styles.socialBookTitle, preview && styles.socialBookTitlePreview, { color: palette.text }]}>{session.bookTitle}</Text>
          <Text numberOfLines={1} style={[styles.socialBookAuthor, preview && styles.socialBookAuthorPreview, { color: palette.muted }]}>{session.bookAuthor}</Text>
        </View>
      </View>

      <View style={[styles.socialStats, { backgroundColor: palette.selection }]}>
        <View style={styles.socialMetric}>
          <Text style={[styles.socialMetricValue, preview && styles.socialMetricValuePreview, { color: palette.accent }]}>{formatReadingDuration(session.durationSeconds)}</Text>
          <Text style={[styles.socialMetricLabel, preview && styles.socialMetricLabelPreview, { color: palette.muted }]}>{readingTimeLabel(session)}</Text>
        </View>
        <View style={[styles.socialDivider, { backgroundColor: palette.border }]} />
        <View style={styles.socialMetric}>
          <Text style={[styles.socialMetricValue, preview && styles.socialMetricValuePreview, { color: palette.accent }]}>{session.pagesRead}</Text>
          <Text style={[styles.socialMetricLabel, preview && styles.socialMetricLabelPreview, { color: palette.muted }]}>páginas lidas</Text>
        </View>
      </View>

      {session.description ? (
        <Text numberOfLines={preview ? 2 : undefined} style={[styles.socialDescription, preview && styles.socialDescriptionPreview, { color: palette.muted }]}>{session.description}</Text>
      ) : null}

      <View style={[styles.socialProgress, { backgroundColor: palette.surfaceAlt }]}>
        <Text style={[styles.socialProgressTitle, preview && styles.socialProgressTitlePreview, { color: palette.text }]}>Seu progresso</Text>
        <View style={styles.socialProgressRow}>
          <Text style={[styles.socialPageRange, preview && styles.socialPageRangePreview, { color: palette.text }]}>{session.startingPage}</Text>
          <Ionicons color={palette.accent} name="arrow-forward" size={preview ? 14 : 17} />
          <Text style={[styles.socialPageRange, preview && styles.socialPageRangePreview, { color: palette.text }]}>{session.endingPage}</Text>
          <Text style={[styles.socialProgressPercent, preview && styles.socialProgressPercentPreview, { color: palette.muted }]}>{progressPercent}%</Text>
        </View>
        <View style={[styles.socialTrack, { backgroundColor: palette.border }]}>
          <View style={[styles.progressFill, { backgroundColor: palette.accent, width: `${progressPercent}%` }]} />
        </View>
      </View>

      <Text style={[styles.socialWatermark, preview && styles.socialWatermarkPreview, { color: palette.muted }]}>Nookly · Sua biblioteca, no seu ritmo</Text>
    </View>
  );
}

function Metric({ label, value, palette }: { label: string; value: string; palette: ReturnType<typeof getReadingSessionPalette> }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, { color: palette.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: palette.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  backButton: { ...controls.iconButton },
  headerTitle: { fontFamily: typography.editorial, fontSize: 23 },
  content: { gap: 16, paddingHorizontal: 22, paddingTop: 12 },
  hero: { alignItems: 'center', gap: 4, paddingBottom: 5 },
  successMark: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', marginBottom: 5, borderRadius: radii.full },
  sessionName: { fontFamily: typography.editorial, fontSize: 25, textAlign: 'center' },
  sessionDate: { fontSize: 14 },
  bookCard: { alignItems: 'center', gap: 6, padding: 18, borderRadius: radii.large },
  cover: { width: 116, height: 174, marginBottom: 5, borderRadius: radii.small },
  bookTitle: { maxWidth: '94%', fontFamily: typography.editorial, fontSize: 20, lineHeight: 26, textAlign: 'center' },
  bookAuthor: { fontSize: 14, textAlign: 'center' },
  statsCard: { minHeight: 94, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderRadius: radii.large },
  metric: { flex: 1, alignItems: 'center', gap: 3 },
  metricValue: { fontFamily: typography.editorial, fontSize: 25, fontVariant: ['tabular-nums'] },
  metricLabel: { fontSize: 13, textAlign: 'center' },
  metricDivider: { width: StyleSheet.hairlineWidth, height: 42 },
  progressCard: { gap: 14, padding: 18, borderRadius: radii.large },
  sectionTitle: { fontFamily: typography.editorial, fontSize: 20 },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  progressPoint: { flex: 1, gap: 1 },
  progressEnd: { alignItems: 'flex-end' },
  pageNumber: { fontFamily: typography.editorial, fontSize: 27, fontVariant: ['tabular-nums'] },
  pageLabel: { fontSize: 12 },
  progressTrack: { height: 5, overflow: 'hidden', borderRadius: radii.full },
  progressFill: { height: '100%', borderRadius: radii.full },
  totalLabel: { alignSelf: 'flex-end', fontSize: 12 },
  descriptionCard: { gap: 8, padding: 18, borderRadius: radii.large },
  description: { fontSize: 15, lineHeight: 23 },
  shareActions: { gap: 10, marginTop: 2 },
  shareSheetContent: { gap: 14, paddingBottom: 8 },
  sharePreview: { justifyContent: 'center', padding: 12, borderRadius: radii.medium },
  sharePreviewClassic: { minHeight: 460 },
  sharePreviewCard: { minHeight: 300 },
  previewClassic: { width: '65%', alignSelf: 'center', gap: 9 },
  previewBackgroundOptions: { flexDirection: 'row', gap: 8 },
  previewBackgroundHeading: { gap: 2 },
  previewBackgroundTitle: { fontSize: 13, fontWeight: '600' },
  previewBackgroundHint: { fontSize: 11 },
  previewBackgroundOption: { minHeight: 46, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderRadius: radii.small },
  previewBackgroundSwatch: { width: 18, height: 18, borderRadius: 9 },
  previewBackgroundText: { fontSize: 12, fontWeight: '600' },
  previewSessionName: { fontFamily: typography.editorial, fontSize: 18, lineHeight: 23, textAlign: 'center' },
  previewDate: { fontSize: 10, lineHeight: 13, textAlign: 'center' },
  previewClassicBook: { alignItems: 'center', gap: 4, padding: 12, borderRadius: 14 },
  previewClassicCover: { width: 78, height: 117, marginBottom: 2, borderRadius: 4 },
  previewClassicBookTitle: { maxWidth: '94%', fontFamily: typography.editorial, fontSize: 14, lineHeight: 17, textAlign: 'center' },
  previewClassicBookAuthor: { fontSize: 10, textAlign: 'center' },
  previewClassicStats: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderRadius: 14 },
  previewClassicMetric: { flex: 1, alignItems: 'center', gap: 2 },
  previewMetricLabel: { fontSize: 8, textAlign: 'center' },
  previewClassicProgress: { gap: 7, padding: 12, borderRadius: 14 },
  previewClassicProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewClassicPage: { flex: 1, gap: 1 },
  previewClassicPageEnd: { alignItems: 'flex-end' },
  previewMetric: { fontFamily: typography.editorial, fontSize: 21, textAlign: 'center', fontVariant: ['tabular-nums'] },
  previewDivider: { width: StyleSheet.hairlineWidth, height: 30 },
  previewProgressTitle: { fontFamily: typography.editorial, fontSize: 12 },
  previewProgressPages: { fontFamily: typography.editorial, fontSize: 17 },
  previewProgressPercent: { alignSelf: 'flex-end', fontSize: 9 },
  previewTrack: { height: 4, overflow: 'hidden', borderRadius: radii.full },
  previewFill: { height: '100%', borderRadius: radii.full },
  previewWatermark: { fontFamily: typography.editorial, fontSize: 10, textAlign: 'center' },
  socialCard: { width: '100%', gap: 10, padding: 14, borderWidth: 1, borderRadius: radii.large },
  socialCardExport: { padding: 18, gap: 13 },
  socialCardPreview: { padding: 12, gap: 9 },
  socialCardHeading: { alignItems: 'center', gap: 2 },
  socialSessionName: { fontFamily: typography.editorial, fontSize: 23, lineHeight: 29, textAlign: 'center' },
  socialSessionNamePreview: { fontSize: 19, lineHeight: 24 },
  socialDate: { fontSize: 12 },
  socialDatePreview: { fontSize: 10 },
  socialBookRow: { minHeight: 94, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: radii.medium },
  socialCover: { width: 72, height: 108, borderRadius: 7 },
  socialCoverPreview: { width: 62, height: 93 },
  socialBookCopy: { flex: 1, gap: 4 },
  socialBookTitle: { fontFamily: typography.editorial, fontSize: 17, lineHeight: 22 },
  socialBookTitlePreview: { fontSize: 14, lineHeight: 18 },
  socialBookAuthor: { fontSize: 12 },
  socialBookAuthorPreview: { fontSize: 10 },
  socialStats: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 8, borderRadius: radii.medium },
  socialMetric: { flex: 1, alignItems: 'center', gap: 2 },
  socialMetricValue: { fontFamily: typography.editorial, fontSize: 26, textAlign: 'center', fontVariant: ['tabular-nums'] },
  socialMetricValuePreview: { fontSize: 22, textAlign: 'center' },
  socialMetricLabel: { fontSize: 10, textAlign: 'center' },
  socialMetricLabelPreview: { fontSize: 9 },
  socialDivider: { width: StyleSheet.hairlineWidth, height: 30 },
  socialDescription: { fontSize: 12, lineHeight: 17 },
  socialDescriptionPreview: { fontSize: 10, lineHeight: 14 },
  socialProgress: { gap: 8, padding: 12, borderRadius: radii.medium },
  socialProgressTitle: { fontFamily: typography.editorial, fontSize: 17, textAlign: 'center' },
  socialProgressTitlePreview: { fontSize: 14 },
  socialProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  socialPageRange: { fontFamily: typography.editorial, fontSize: 18, fontVariant: ['tabular-nums'] },
  socialPageRangePreview: { fontSize: 15 },
  socialProgressPercent: { marginLeft: 'auto', fontSize: 11 },
  socialProgressPercentPreview: { fontSize: 10 },
  socialTrack: { height: 5, overflow: 'hidden', borderRadius: radii.full },
  socialWatermark: { paddingTop: 1, fontFamily: typography.editorial, fontSize: 11, textAlign: 'center' },
  socialWatermarkPreview: { fontSize: 9 },
  shareOptions: { gap: 12, padding: 14, borderRadius: radii.large },
  shareOptionsHeading: { gap: 3 },
  shareOptionsTitle: { fontSize: 15, fontWeight: '700' },
  shareOptionsHint: { fontSize: 12, lineHeight: 17 },
  shareButton: { ...controls.button, flexDirection: 'row', gap: 9 },
  shareButtonText: { ...controls.buttonText, flexShrink: 1, textAlign: 'center' },
  cancelShareButton: { minHeight: controls.iconButton.height, alignItems: 'center', justifyContent: 'center' },
  cancelShareText: { fontSize: 13, fontWeight: '600' },
  homeButton: { ...controls.button, flexDirection: 'row', gap: 9, borderWidth: 1, marginTop: 2 },
  homeButtonText: { ...controls.buttonText,  },
  exportCanvas: { position: 'absolute', top: 0, left: -1000, width: 360, gap: 14, padding: 20, backgroundColor: 'transparent' },
  exportCardCanvas: { gap: 0, padding: 0, backgroundColor: 'transparent' },
  exportSessionName: { fontFamily: typography.editorial, fontSize: 26, lineHeight: 32, textAlign: 'center' },
  exportDate: { marginTop: -11, fontSize: 14, textAlign: 'center' },
  exportBookCard: { alignItems: 'center', gap: 6, padding: 18, borderRadius: radii.large },
  exportCover: { width: 116, height: 174, marginBottom: 5, borderRadius: radii.small },
  exportBookTitle: { maxWidth: '94%', fontFamily: typography.editorial, fontSize: 20, lineHeight: 26, textAlign: 'center' },
  exportBookAuthor: { fontSize: 14, textAlign: 'center' },
  exportStatsCard: { minHeight: 94, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderRadius: radii.large },
  exportProgressCard: { gap: 14, padding: 18, borderRadius: radii.large },
  exportSectionTitle: { fontFamily: typography.editorial, fontSize: 20 },
  exportDescription: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  watermark: { marginTop: 1, fontFamily: typography.editorial, fontSize: 14, textAlign: 'center' },
  pressed: controls.buttonPressed,
  emptyState: { flex: 1, justifyContent: 'center', gap: 18, padding: 24 },
  emptyTitle: { fontFamily: typography.editorial, fontSize: 22, textAlign: 'center' },
});
