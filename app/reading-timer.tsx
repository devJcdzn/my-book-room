import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BookCover } from '@/src/components/book-cover';
import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { useLibraryStore, getReadingTimerElapsedMs } from '@/src/store/library-store';
import { controls, colors, radii, typography } from '@/src/theme';
import { formatReadingDuration, getReadingSessionPalette } from '@/src/utils/reading-session';

export default function ReadingTimerScreen() {
  const insets = useSafeAreaInsets();
  const timer = useLibraryStore((state) => state.activeReadingTimer);
  const books = useLibraryStore((state) => state.books);
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const pauseTimer = useLibraryStore((state) => state.pauseReadingTimer);
  const resumeTimer = useLibraryStore((state) => state.resumeReadingTimer);
  const finishTimer = useLibraryStore((state) => state.finishReadingTimer);
  const discardTimer = useLibraryStore((state) => state.discardReadingTimer);
  const addReadingEntry = useLibraryStore((state) => state.addReadingEntry);
  const saveSession = useLibraryStore((state) => state.saveReadingSession);
  const isNight = resolveAmbience(ambienceMode) === 'night';
  const palette = useMemo(() => getReadingSessionPalette(timer?.coverColor ?? colors.terracotta, isNight), [timer?.coverColor, isNight]);
  const fieldBackground = isNight ? palette.surfaceAlt : palette.surface;
  const fieldBorder = isNight ? palette.border : 'rgba(50, 37, 31, 0.24)';
  const fieldPlaceholder = isNight ? palette.muted : '#88766B';
  const [now, setNow] = useState(0);
  const [isNoteVisible, setNoteVisible] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [description, setDescription] = useState('');
  const [isEditingEndingPage, setEditingEndingPage] = useState(false);
  const [endingPageDraft, setEndingPageDraft] = useState<{ timerId: string; value: string }>();
  const [savedSessionId, setSavedSessionId] = useState<string>();
  const [isDiscardingSession, setIsDiscardingSession] = useState(false);
  const pendingExit = useRef<(() => void) | undefined>(undefined);
  const navigation = useNavigation();
  const endingPage = timer?.phase === 'review'
    ? endingPageDraft?.timerId === timer.id ? endingPageDraft.value : String(timer.startingPage)
    : '';
  const timerPhase = timer?.phase;
  const timerId = timer?.id;
  const timerSegmentStartedAt = timer?.segmentStartedAt;
  const returnToTimer = () => {
    setEditingEndingPage(false);
    pauseTimer();
  };

  const confirmDiscardSession = (onDiscard: () => void) => {
    Alert.alert(
      'Leitura em andamento',
      'Se sair agora, sua sessão atual e o tempo registrado serão apagados.',
      [
        { text: 'Continuar lendo', style: 'cancel', onPress: resumeTimer },
        {
          text: 'Excluir sessão',
          style: 'destructive',
          onPress: () => {
            pendingExit.current = onDiscard;
            discardTimer();
            setIsDiscardingSession(true);
          },
        },
      ],
      { cancelable: true },
    );
  };

  usePreventRemove(Boolean(timer) && !isDiscardingSession, ({ data }) => {
    if (timer?.phase === 'review') {
      returnToTimer();
      return;
    }
    confirmDiscardSession(() => navigation.dispatch(data.action));
  });

  useEffect(() => {
    if (!timerId || timerPhase !== 'running') return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [timerId, timerPhase, timerSegmentStartedAt]);

  useEffect(() => {
    if (savedSessionId) {
      router.replace({ pathname: '/reading-session', params: { sessionId: savedSessionId } });
      return;
    }
    if (!timer) {
      if (isDiscardingSession) {
        const exit = pendingExit.current;
        pendingExit.current = undefined;
        exit?.();
        return;
      }
      router.replace('/');
      return;
    }
  }, [isDiscardingSession, savedSessionId, timer]);

  if (!timer) return <View style={styles.loading} />;

  const book = books.find((item) => item.id === timer.bookId);
  const totalPages = timer.totalPages;
  const parsedEndingPage = endingPage.trim() ? Number(endingPage) : Number.NaN;
  const isPageValid = Number.isInteger(parsedEndingPage)
    && parsedEndingPage >= timer.startingPage && parsedEndingPage <= totalPages;
  const canDecrementPage = Number.isInteger(parsedEndingPage) && parsedEndingPage > timer.startingPage;
  const canIncrementPage = Number.isInteger(parsedEndingPage) && parsedEndingPage < totalPages;
  const pagesRead = isPageValid ? parsedEndingPage - timer.startingPage : 0;
  const elapsedMilliseconds = timer.phase === 'running' && now > 0
    ? getReadingTimerElapsedMs(timer, now)
    : timer.elapsedMs;
  const elapsedSeconds = Math.floor(elapsedMilliseconds / 1000);
  const progress = totalPages > 0 ? timer.startingPage / totalPages : 0;

  const saveQuickNote = () => {
    const text = noteText.trim();
    if (!text) return;
    if (!book) {
      Alert.alert('Livro indisponível', 'Este livro foi removido da biblioteca e não pode receber novas notas.');
      return;
    }
    addReadingEntry(book.id, {
      text,
    });
    setNoteText('');
    setNoteVisible(false);
    if (Platform.OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const saveReading = () => {
    if (!isPageValid || !sessionName.trim()) return;
    const session = saveSession({ name: sessionName, description, endingPage: parsedEndingPage });
    if (!session) return;
    if (Platform.OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSavedSessionId(session.id);
  };

  const closeTimer = () => {
    if (timer.phase === 'review') {
      returnToTimer();
      return;
    }
    confirmDiscardSession(() => {
      if (navigation.canGoBack()) router.back();
      else router.replace('/');
    });
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.background, paddingTop: insets.top + 10 }]}>
      {timer.coverUrl ? (
        <View pointerEvents="none" style={[styles.coverBackdrop, timer.phase === 'review' && { height: insets.top + 280 }]}>
          <Image source={{ uri: timer.coverUrl }} contentFit="cover" style={[StyleSheet.absoluteFill, { opacity: isNight ? 0.34 : 0.46 }]} />
          <View style={[styles.backdropFade, { experimental_backgroundImage: `linear-gradient(to bottom, ${palette.background}00, ${palette.background})` }]} />
        </View>
      ) : null}
      <StatusBar style={isNight ? 'light' : 'dark'} />
      <View style={styles.header}>
        <Pressable accessibilityLabel="Voltar" accessibilityRole="button" hitSlop={10} onPress={closeTimer} style={styles.backButton}>
          <Ionicons color={palette.text} name="chevron-back" size={24} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>{timer.phase === 'review' ? 'Salvar sessão' : ''}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {timer.phase === 'review' ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'android' ? 'height' : undefined} style={styles.reviewKeyboard}>
          <ScrollView
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            contentContainerStyle={[styles.reviewContent, { paddingBottom: insets.bottom + 24 }]}
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <BookIdentity timer={timer} palette={palette} compact />
            <View style={[styles.bookStats, { backgroundColor: palette.surface }]}>
              {([
                ['Progresso', `${Math.round(progress * 100)}%`],
                ['Última página', String(timer.startingPage)],
              ] as const).map(([label, value], index) => (
                <View key={label} style={[styles.bookStat, index > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: palette.border }]}>
                  <Text style={[styles.statLabel, { color: palette.muted }]}>{label}</Text>
                  <Text style={[styles.statValue, { color: palette.text }]}>{value}</Text>
                </View>
              ))}
            </View>
            <View style={[styles.durationCard, { backgroundColor: palette.surface }]}>
              <Text style={[styles.fieldLabel, { color: palette.text }]}>Tempo de leitura</Text>
              <View style={[styles.durationDisplay, { backgroundColor: palette.surfaceAlt }]}>
                <Text style={[styles.durationValue, { color: palette.text }]}>{formatReadingDuration(elapsedSeconds)}</Text>
                <Ionicons name="timer-outline" size={19} color={palette.muted} />
              </View>
            </View>

            <View style={[styles.fieldGroup, { backgroundColor: palette.surface }]}>
              <Text style={[styles.fieldLabel, { color: palette.text }]}>Nome da sessão</Text>
              <TextInput
                accessibilityLabel="Nome da sessão"
                keyboardAppearance={isNight ? 'dark' : 'light'}
                maxLength={80}
                onChangeText={setSessionName}
                onSubmitEditing={() => Keyboard.dismiss()}
                placeholder="Ex.: Antes de dormir"
                placeholderTextColor={fieldPlaceholder}
                returnKeyType="done"
                style={[styles.input, { backgroundColor: palette.surfaceAlt, borderColor: palette.border, color: palette.text }]}
                value={sessionName}
              />
            </View>

            <View style={[styles.fieldGroup, { backgroundColor: palette.surface }]}>
              <View style={styles.pageHeading}>
                <Text style={[styles.fieldLabel, { color: palette.text }]}>Página final</Text>
                <Text style={[styles.pageRange, { color: palette.muted }]}>Começou na {timer.startingPage}</Text>
              </View>
              <View style={styles.pageInputRow}>
                <Pressable
                  accessibilityLabel="Diminuir página final"
                  accessibilityRole="button"
                  disabled={!canDecrementPage}
                  onPress={() => setEndingPageDraft({ timerId: timer.id, value: String(Math.max(timer.startingPage, parsedEndingPage - 1)) })}
                  style={({ pressed }) => [styles.pageStep, { backgroundColor: palette.surfaceAlt }, pressed && styles.pressed, !canDecrementPage && styles.disabled]}
                >
                  <Ionicons color={palette.accent} name="remove" size={22} />
                </Pressable>
                <View style={[styles.pageValueGroup, { backgroundColor: palette.surfaceAlt, borderColor: palette.border }]}>
                  {isEditingEndingPage ? (
                    <TextInput
                      accessibilityLabel="Página final"
                      autoFocus
                      keyboardAppearance={isNight ? 'dark' : 'light'}
                      keyboardType="number-pad"
                      maxLength={String(totalPages).length}
                      onBlur={() => setEditingEndingPage(false)}
                      onChangeText={(value) => setEndingPageDraft({ timerId: timer.id, value: value.replace(/\D/g, '') })}
                      onSubmitEditing={() => setEditingEndingPage(false)}
                      selectTextOnFocus
                      style={[styles.pageInput, { color: palette.text, width: Math.max(54, String(totalPages).length * 14) }]}
                      value={endingPage}
                    />
                  ) : (
                    <Pressable
                      accessibilityHint="Abre o teclado para informar a página final"
                      accessibilityLabel={`Página final ${endingPage}. Editar`}
                      accessibilityRole="button"
                      style={styles.pageEdit}
                      onPress={() => setEditingEndingPage(true)}
                    >
                      <Text style={[styles.pageValue, { color: palette.text }]}>{endingPage}</Text>
                    </Pressable>
                  )}
                  <Text style={[styles.pageTotal, { color: palette.muted }]}>/ {totalPages}</Text>
                </View>
                <Pressable
                  accessibilityLabel="Aumentar página final"
                  accessibilityRole="button"
                  disabled={!canIncrementPage}
                  onPress={() => setEndingPageDraft({ timerId: timer.id, value: String(Math.min(totalPages, parsedEndingPage + 1)) })}
                  style={({ pressed }) => [styles.pageStep, { backgroundColor: palette.surfaceAlt }, pressed && styles.pressed, !canIncrementPage && styles.disabled]}
                >
                  <Ionicons color={palette.accent} name="add" size={22} />
                </Pressable>
              </View>
              {!isPageValid ? <Text style={[styles.errorText, { color: palette.accent }]}>Use uma página entre {timer.startingPage} e {totalPages}.</Text> : null}
              <Text style={[styles.pagesRead, { color: palette.muted }]}>{pagesRead} {pagesRead === 1 ? 'página lida' : 'páginas lidas'}</Text>
            </View>

            <View style={[styles.fieldGroup, { backgroundColor: palette.surface }]}>
              <View style={styles.pageHeading}>
                <Text style={[styles.fieldLabel, { color: palette.text }]}>Sobre esta leitura</Text>
                <Text style={[styles.pageRange, { color: palette.muted }]}>Opcional</Text>
              </View>
              <TextInput
                accessibilityLabel="Descrição opcional da sessão"
                keyboardAppearance={isNight ? 'dark' : 'light'}
                maxLength={500}
                multiline
                onChangeText={setDescription}
                placeholder="Uma impressão sobre esta sessão…"
                placeholderTextColor={fieldPlaceholder}
                style={[styles.input, styles.descriptionInput, { backgroundColor: palette.surfaceAlt, borderColor: palette.border, color: palette.text }]}
                textAlignVertical="top"
                value={description}
              />
              <Text style={[styles.characterCount, { color: palette.muted }]}>{description.length}/500</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={!sessionName.trim() || !isPageValid}
              onPress={saveReading}
              style={({ pressed }) => [styles.primaryButton, { backgroundColor: palette.accent }, (!sessionName.trim() || !isPageValid) && styles.disabled, pressed && styles.pressed]}
            >
              <Text style={[styles.primaryButtonText, { color: palette.actionText }]}>Salvar sessão</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.timerContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.bookProgressSection}>
            <BookIdentity timer={timer} palette={palette} />
            <View style={[styles.progressSection, { backgroundColor: palette.surface }]}>
              <View style={[styles.progressTrack, { backgroundColor: fieldBorder }]}>
                <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: palette.accent }]} />
              </View>
              <View style={styles.progressInfo}>
                <Text style={[styles.progressPercent, { color: palette.accent }]}>{Math.round(progress * 100)}%</Text>
                <Text style={[styles.progressPages, { color: palette.muted }]}>{timer.startingPage} de {totalPages} páginas</Text>
              </View>
            </View>
          </View>

          <View style={styles.timerDisplay}>
            <Text style={[styles.timerCaption, { color: palette.muted }]}>
              {timer.phase === 'paused' ? 'Leitura pausada' : 'Seu tempo de leitura'}
            </Text>
            <Text adjustsFontSizeToFit minimumFontScale={0.5} numberOfLines={1} style={[styles.timerValue, { color: palette.text }]}>{formatReadingDuration(elapsedSeconds)}</Text>
          </View>

          <View style={styles.timerActions}>
            <Pressable
              accessibilityLabel="Adicionar nota rápida"
              accessibilityRole="button"
              disabled={!book}
              onPress={() => setNoteVisible(true)}
              style={({ pressed }) => [styles.noteButton, { backgroundColor: fieldBackground, borderColor: fieldBorder }, !book && styles.disabled, pressed && styles.pressed]}
            >
              <Ionicons color={palette.accent} name="create-outline" size={21} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={timer.phase === 'running' ? pauseTimer : resumeTimer}
              style={({ pressed }) => [styles.primaryButton, styles.timerActionButton, { backgroundColor: palette.accent }, pressed && styles.pressed]}
            >
              <Ionicons color={palette.actionText} name={timer.phase === 'running' ? 'pause' : 'play'} size={18} />
              <Text style={[styles.primaryButtonText, styles.timerActionText, { color: palette.actionText }]}>{timer.phase === 'running' ? 'Pausar' : 'Continuar'}</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Encerrar leitura e revisar sessão"
              accessibilityRole="button"
              onPress={finishTimer}
              style={({ pressed }) => [styles.finishButton, { backgroundColor: palette.surface, borderColor: fieldBorder }, pressed && styles.pressed]}
            >
              <Ionicons name="stop" size={21} color={palette.accent} />
            </Pressable>
          </View>
        </ScrollView>
      )}

      <Modal animationType="slide" onRequestClose={() => setNoteVisible(false)} statusBarTranslucent transparent visible={isNoteVisible}>
        <View style={styles.modalOverlay}>
          <Pressable accessibilityLabel="Fechar nota rápida" onPress={() => setNoteVisible(false)} style={StyleSheet.absoluteFill} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalKeyboard}>
            <View style={[styles.noteSheet, { backgroundColor: palette.surface, paddingBottom: Math.max(insets.bottom, 20) }]}>
              <View style={[styles.grabber, { backgroundColor: palette.border }]} />
              <Text style={[styles.sheetTitle, { color: palette.text }]}>Nova nota</Text>
              <Text style={[styles.sheetDescription, { color: palette.muted }]}>Ela ficará vinculada a este livro e poderá ser editada nas suas Notas.</Text>
              <TextInput
                accessibilityLabel="Texto da nota rápida"
                autoFocus
                maxLength={1000}
                multiline
                onChangeText={setNoteText}
                placeholder="O que você quer guardar desta leitura?"
                placeholderTextColor={palette.muted}
                style={[styles.quickNoteInput, { backgroundColor: palette.surfaceAlt, borderColor: palette.border, color: palette.text }]}
                textAlignVertical="top"
                value={noteText}
              />
              <Pressable
                accessibilityRole="button"
                disabled={!noteText.trim()}
                onPress={saveQuickNote}
                style={({ pressed }) => [styles.primaryButton, { backgroundColor: palette.accent }, !noteText.trim() && styles.disabled, pressed && styles.pressed]}
              >
                <Text style={[styles.primaryButtonText, { color: palette.actionText }]}>Salvar nota</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

function BookIdentity({ timer, palette, compact = false }: {
  timer: NonNullable<ReturnType<typeof useLibraryStore.getState>['activeReadingTimer']>;
  palette: ReturnType<typeof getReadingSessionPalette>;
  compact?: boolean;
}) {
  return (
    <View style={[styles.bookIdentity, compact && styles.compactIdentity]}>
      <BookCover color={timer.coverColor} coverUrl={timer.coverUrl} style={[styles.cover, compact && styles.compactCover]} />
      <View style={[styles.identityCopy, compact && styles.compactIdentityCopy]}>
        <Text numberOfLines={compact ? 3 : 2} style={[styles.bookTitle, { color: palette.text }, compact && styles.compactBookTitle]}>{timer.bookTitle}</Text>
        <Text numberOfLines={1} style={[styles.bookAuthor, { color: palette.muted }, compact && styles.compactAuthor]}>{timer.bookAuthor}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  coverBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, height: '65%' },
  backdropFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%' },
  loading: { flex: 1, backgroundColor: colors.cream },
  header: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  backButton: { ...controls.iconButton },
  headerTitle: { fontFamily: typography.editorial, fontSize: 22 },
  headerSpacer: { width: 42 },
  timerContent: { flexGrow: 1, justifyContent: 'space-between', gap: 18, paddingHorizontal: 24, paddingTop: 18 },
  bookProgressSection: { alignItems: 'center', gap: 23 },
  bookIdentity: { alignItems: 'center', gap: 7 },
  compactIdentity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  identityCopy: { alignItems: 'center', gap: 5 },
  compactIdentityCopy: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  compactAuthor: { textAlign: 'left', fontSize: 13 },
  cover: { width: 96, height: 144, marginBottom: 3, borderRadius: 8, boxShadow: '0 5px 14px rgba(30, 22, 18, 0.18)' },
  compactCover: { width: 64, height: 96 },
  bookTitle: { maxWidth: '90%', fontFamily: typography.editorial, fontSize: 20, lineHeight: 26, textAlign: 'center' },
  compactBookTitle: { maxWidth: '100%', fontSize: 17, lineHeight: 23, textAlign: 'left' },
  bookAuthor: { fontSize: 13, textAlign: 'center' },
  progressSection: { width: '100%', gap: 12, padding: 16, borderRadius: 18 },
  progressTrack: { height: 10, overflow: 'hidden', borderRadius: radii.full },
  progressFill: { height: '100%', borderRadius: radii.full },
  progressInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressPercent: { fontSize: 22, fontWeight: '700', fontVariant: ['tabular-nums'] },
  progressPages: { fontSize: 14 },
  timerDisplay: { flex: 1, minHeight: 190, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 20 },
  timerValue: { width: '100%', textAlign: 'center', fontFamily: typography.editorial, fontSize: 96, lineHeight: 120, fontVariant: ['tabular-nums'], letterSpacing: -3 },
  timerCaption: { fontSize: 14, fontWeight: '600' },
  timerActions: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 10 },
  noteButton: { ...controls.timerButton, borderWidth: 1 },
  timerActionButton: { minHeight: 58, flex: 1, flexDirection: 'row', gap: 8, paddingHorizontal: 8 },
  timerActionText: { fontSize: 15 },
  finishButton: { ...controls.timerButton, borderWidth: 1 },
  primaryButton: { ...controls.button },
  primaryButtonText: { ...controls.buttonText },
  reviewContent: { gap: 16, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 },
  reviewKeyboard: { flex: 1 },
  bookStats: { flexDirection: 'row', borderRadius: 18, paddingVertical: 14 },
  bookStat: { flex: 1, alignItems: 'center', gap: 5, paddingHorizontal: 4 },
  statLabel: { fontSize: 11, textAlign: 'center' },
  statValue: { fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
  characterCount: { fontSize: 11, textAlign: 'right' },
  durationCard: { alignItems: 'center', gap: 12, padding: 16, borderRadius: 20 },
  durationDisplay: { minHeight: controls.input.minHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 18, borderRadius: 10 },
  durationValue: { fontSize: 24, fontVariant: ['tabular-nums'], fontWeight: '600' },
  fieldGroup: { gap: 12, padding: 16, borderRadius: 20 },
  fieldLabel: { fontFamily: typography.editorial, fontSize: 18, lineHeight: 24 },
  input: { ...controls.input },
  descriptionInput: { minHeight: 100, lineHeight: 23 },
  pageHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  pageRange: { fontSize: 12 },
  pageInputRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pageStep: { ...controls.iconButton },
  pageValueGroup: { flex: 1, minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10 },
  pageEdit: { minHeight: 44, minWidth: 54, alignItems: 'center', justifyContent: 'center' },
  pageValue: { ...controls.pageValue },
  pageInput: { ...controls.pageValue },
  pageTotal: { fontSize: 15 },
  pagesRead: { fontSize: 13 },
  errorText: { fontSize: 12 },
  disabled: { opacity: 0.62 },
  pressed: { opacity: 0.78 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20, 14, 12, 0.44)' },
  modalKeyboard: { flex: 1, justifyContent: 'flex-end' },
  noteSheet: { maxHeight: '82%', paddingHorizontal: 22, paddingTop: 10, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderCurve: 'continuous' },
  grabber: { width: 44, height: 5, alignSelf: 'center', marginBottom: 15, borderRadius: 3 },
  sheetTitle: { marginBottom: 5, fontFamily: typography.editorial, fontSize: 25, lineHeight: 32 },
  sheetDescription: { marginBottom: 16, fontSize: 14, lineHeight: 20 },
  quickNoteInput: { ...controls.input, minHeight: 132, marginBottom: 14, lineHeight: 23 },
});
