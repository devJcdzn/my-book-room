import { showSaveFeedback } from '@/src/components/save-feedback';
import { AppTextInput, FieldError } from '@/src/components/app-text-input';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Host, Picker } from '@expo/ui';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  View,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLibraryStore } from '@/src/store/library-store';
import { controls, colors, radii, typography } from '@/src/theme';
import { resolveAmbience } from '@/src/types/ambience';
import { displayReadingDate, localDateKey, parseReadingDate } from '@/src/utils/reading-days';
import { ScreenHeader } from '@/src/components/screen-header';
import { BookCover } from '@/src/components/book-cover';
import { getBookDetailsPalette } from '@/src/utils/book-details-palette';
import {
  readingTimeLabel,
  formatReadingDuration,
  getReadingControlsPalette,
} from '@/src/utils/reading-session';

const HOURS = Array.from({ length: 100 }, (_, index) => index);
const MINUTES = Array.from({ length: 60 }, (_, index) => index);

export default function EditReadingSessionScreen() {
  const { sessionId, bookId, mode } = useLocalSearchParams<{
    sessionId?: string;
    bookId?: string;
    mode?: string;
  }>();
  const state = useLibraryStore();
  const session = state.readingSessions.find((item) => item.id === sessionId);
  const book = state.books.find((item) => item.id === (session?.bookId ?? bookId));
  const manual = !session || session.source === 'manual';
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const stackPages = width < 340 || fontScale > 1.4;
  const scroll = useRef<ScrollView>(null);
  const durationTop = useRef(0);
  const isNight = resolveAmbience(state.ambienceMode) === 'night';
  const coverColor = session?.coverColor ?? book?.coverColor ?? colors.sageDark;
  const palette = getReadingControlsPalette(isNight);
  const coverUrl = session?.coverUrl ?? book?.coverUrl;
  const title = session?.bookTitle ?? book?.title ?? 'Livro indisponível';
  const author = session?.bookAuthor ?? book?.author;
  const coverInk = getBookDetailsPalette(coverColor, false).text;
  const [name, setName] = useState(session?.name ?? '');
  const [description, setDescription] = useState(session?.description ?? '');
  const [start, setStart] = useState(String(session?.startingPage ?? book?.currentPage ?? 0));
  const [end, setEnd] = useState(String(session?.endingPage ?? book?.currentPage ?? 0));
  const [date, setDate] = useState(
    displayReadingDate(
      (mode === 'completion' ? book?.completedOn : session?.readingDate) ?? localDateKey(new Date()),
    ),
  );
  const [minutes, setMinutes] = useState(
    session?.durationSeconds === undefined ? '' : String(session.durationSeconds / 60),
  );
  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState<'start' | 'end' | 'date' | 'duration' | 'form'>('form');
  const fail = (field: typeof errorField, message: string) => { setErrorField(field); setError(message); };
  const [customDate, setCustomDate] = useState(() => {
    if (!session && mode !== 'completion') return false;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const initial = mode === 'completion' ? book?.completedOn : session?.readingDate;
    return Boolean(initial && initial !== localDateKey(new Date()) && initial !== localDateKey(yesterday));
  });
  const [durationOpen, setDurationOpen] = useState(false);
  useEffect(() => {
    if (durationOpen) scroll.current?.scrollTo({ y: Math.max(0, durationTop.current - 20), animated: true });
  }, [durationOpen]);
  const [detailsOpen, setDetailsOpen] = useState(
    Boolean(session?.description || (session?.name && session.name !== 'Leitura')),
  );
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const saving = useRef(false);
  const [id] = useState(() => `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const timerBlocked = mode !== 'completion' && !session && state.activeReadingTimer?.bookId === bookId;
  const totalPages = book?.totalPages ?? session?.totalPages ?? 0;
  const setRelativeDate = (offset: number) => {
    const day = new Date();
    day.setDate(day.getDate() + offset);
    setCustomDate(false);
    setDate(displayReadingDate(localDateKey(day)));
    setError('');
  };
  const save = () => {
    if (saving.current) return;
    const readingDate = parseReadingDate(date);
    if (mode === 'completion') {
      if (!readingDate || readingDate > localDateKey(new Date()) || !book || book.status !== 'completed')
        return fail('date', 'Informe uma data válida, até hoje.');
      saving.current = true;
      state.updateCompletedOn(book.id, readingDate);
      router.back();
      return;
    }
    const startingPage = Number(start),
      endingPage = Number(end);
    const durationSeconds = minutes.trim() ? Math.round(Number(minutes.replace(',', '.')) * 60) : undefined;
    if (!readingDate || readingDate > localDateKey(new Date()))
      return fail('date', 'Informe uma data válida, até hoje.');
    if (!start.trim() || !Number.isInteger(startingPage) || startingPage < 0 || startingPage > totalPages)
      return fail('start', `Informe uma página entre 0 e ${totalPages}.`);
    if (!end.trim() || !Number.isInteger(endingPage) || endingPage < startingPage || endingPage > totalPages)
      return fail('end', `Informe uma página entre ${startingPage} e ${totalPages}.`);
    if (manual && minutes.trim() && (!Number.isFinite(durationSeconds) || (durationSeconds ?? 0) <= 0))
      return fail('duration', 'Informe minutos positivos ou deixe o tempo em branco.');
    const duration = manual ? durationSeconds : session?.durationSeconds;
    if (endingPage === startingPage && !(duration && duration > 0))
      return fail('end', 'Registre páginas lidas ou um tempo positivo.');
    saving.current = true;
    const input = {
      name: name.trim() || 'Leitura',
      description,
      startingPage,
      endingPage,
      readingDate,
      ...(manual ? { durationSeconds } : {}),
    };
    if (session) {
      const previous = useLibraryStore.getState().readingSessions;
      state.updateReadingSession(session.id, input);
      if (useLibraryStore.getState().readingSessions === previous) {
        saving.current = false;
        return fail('form', 'Não foi possível atualizar a leitura. Confira se o registro ainda existe.');
      }
    }
    else if (!book || !state.addManualReading(book.id, { ...input, id })) {
      saving.current = false;
      return fail('form', 'Não foi possível salvar. Confira o livro e o cronômetro ativo.');
    }
    showSaveFeedback("Leitura salva");
    Keyboard.dismiss();
    router.back();
  };
  const selectedDate = parseReadingDate(date);
  const today = localDateKey(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const pages = Math.max(0, Number(end) - Number(start)) || 0;
  const duration = Number(minutes.replace(',', '.')) || 0;
  const hours = Math.floor(duration / 60);
  const minutePart = Math.floor(duration % 60);
  const hourOptions = hours < HOURS.length ? HOURS : [...HOURS, hours];
  const selectMinutes = (value: number) => {
    setMinutes(value > 0 ? String(value) : '');
    setError('');
  };
  const stepPage = (initial: boolean, amount: number) => {
    const current = Number(initial ? start : end) || 0;
    const next = Math.min(totalPages, Math.max(initial ? 0 : Number(start) || 0, current + amount));
    if (initial) {
      setStart(String(next));
      if (next > Number(end)) setEnd(String(next));
    } else setEnd(String(next));
    setError('');
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
  };
  const pageSelector = (initial: boolean) => {
    const value = initial ? start : end;
    const label = initial ? 'Página inicial' : 'Página final';
    return (
      <View style={styles.pageColumn}>
        <Text style={[styles.controlLabel, { color: palette.muted }]}>
          {initial ? 'Comecei na' : 'Parei na'}
        </Text>
        <AppTextInput
          accessibilityLabel={label}
          value={value}
          selectTextOnFocus
          keyboardType="number-pad"
          keyboardAppearance={isNight ? 'dark' : 'light'}
          maxLength={5}
          onChangeText={(text) => {
            (initial ? setStart : setEnd)(text.replace(/\D/g, ''));
            setError('');
          }}
          selectionColor={palette.accent}
          returnKeyType="done"
          style={[styles.pageNumber, { color: palette.text }]}
        />
        <FieldError isNight={isNight} message={errorField === (initial ? 'start' : 'end') ? error : undefined} />
        <View style={styles.pageSteps}>
          {([-1, 1] as const).map((amount) => {
            const disabled =
              amount < 0 ? Number(value) <= (initial ? 0 : Number(start)) : Number(value) >= totalPages;
            return (
              <Pressable
                key={amount}
                accessibilityRole="button"
                accessibilityLabel={`${amount < 0 ? 'Diminuir' : 'Aumentar'} ${label.toLowerCase()}`}
                disabled={disabled}
                onPress={() => stepPage(initial, amount)}
                style={({ pressed }) => [
                  styles.pageStep,
                  { backgroundColor: palette.surfaceAlt },
                  disabled && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name={amount < 0 ? 'remove' : 'add'} size={21} color={palette.accent} />
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };
  const choice = (
    label: string,
    selected: boolean,
    onPress: () => void,
    icon?: keyof typeof Ionicons.glyphMap,
  ) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        {
          backgroundColor: selected ? palette.selection : palette.surface,
          borderColor: selected ? palette.accent : palette.border,
        },
        pressed && styles.pressed,
      ]}
    >
      {icon ? <Ionicons name={icon} size={17} color={selected ? palette.accent : palette.muted} /> : null}
      <Text style={[styles.choiceText, { color: selected ? palette.accent : palette.text }]}>
        {label}
      </Text>
    </Pressable>
  );
  return (
    <KeyboardAvoidingView
      key={fontScale}
      style={[styles.screen, { backgroundColor: palette.background }]}
      behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.top + 66}
    >
      <Stack.Screen options={{
        title: mode === 'completion' ? 'Data de conclusão' : session ? 'Editar leitura' : 'Registrar leitura',
        header: ({ options }) => (
          <View style={{ backgroundColor: palette.background }}>
            <ScreenHeader
              title={options.title ?? 'Registrar leitura'}
              isNight={isNight}
              onBack={() => router.back()}
              right={keyboardVisible ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ocultar teclado"
                  onPress={Keyboard.dismiss}
                  style={styles.keyboardButton}
                >
                  <Ionicons name="checkmark" size={22} color={palette.accent} />
                </Pressable>
              ) : undefined}
            />
          </View>
        ),
      }} />
      <ScrollView
        ref={scroll}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.bookHero}>
          <BookCover color={coverColor} coverUrl={coverUrl} style={styles.cover}>
            {!coverUrl ? (
              <View style={styles.coverFallback}>
                <View style={[styles.coverSpine, { backgroundColor: coverInk, opacity: 0.15 }]} />
                <Text
                  allowFontScaling={false}
                  numberOfLines={4}
                  style={[styles.coverTitle, { color: coverInk }]}
                >
                  {title}
                </Text>
                <Text
                  allowFontScaling={false}
                  numberOfLines={2}
                  style={[styles.coverAuthor, { color: coverInk }]}
                >
                  {author}
                </Text>
              </View>
            ) : null}
          </BookCover>
          <View style={styles.bookCopy}>
            <Text style={[styles.bookTitle, { color: palette.text }]}>{title}</Text>
            <Text style={[styles.bookAuthor, { color: palette.muted }]}>{author}</Text>
            {book ? (
              <Text style={[styles.bookPage, { color: palette.muted }]}>
                Marcador na página {book.currentPage} de {totalPages}
              </Text>
            ) : null}
          </View>
        </View>
        {timerBlocked ? (
          <View style={styles.section}>
            <Ionicons name="timer-outline" size={30} color={palette.accent} />
            <Text style={[styles.sectionTitle, { color: palette.text }]}>
              Sua leitura já está em andamento
            </Text>
            <Text style={[styles.body, { color: palette.muted }]}>
              Retome ou finalize o cronômetro deste livro antes de registrar outra leitura.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/reading-timer')}
              style={[styles.saveButton, { backgroundColor: palette.action }]}
            >
              <Text style={[styles.saveButtonText, { color: palette.actionText }]}>Retomar sessão</Text>
            </Pressable>
          </View>
        ) : session || book ? (
          <>
            {mode !== 'completion' ? (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Até onde você leu?</Text>
                <View style={[styles.pagePanel, { backgroundColor: palette.surface }]}>
                  <View style={[styles.pageSelectors, stackPages && styles.stackedSelectors]}>
                    {pageSelector(true)}
                    <View
                      style={[
                        styles.pageDivider,
                        stackPages && styles.stackedDivider,
                        { backgroundColor: palette.border },
                      ]}
                    />
                    {pageSelector(false)}
                  </View>
                  <View style={[styles.pageSummary, { borderTopColor: palette.border }]}>
                    <Ionicons name="book-outline" size={17} color={palette.accent} />
                    <Text style={[styles.pageSummaryText, { color: palette.text }]}>
                      {pages} {pages === 1 ? 'página nesta leitura' : 'páginas nesta leitura'}
                    </Text>
                    <Text style={[styles.totalPages, { color: palette.muted }]}>de {totalPages}</Text>
                  </View>
                </View>
              </View>
            ) : null}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>
                {mode === 'completion' ? 'Quando você terminou?' : 'Quando você leu?'}
              </Text>
              <View style={styles.choices}>
                {choice('Hoje', !customDate && selectedDate === today, () => setRelativeDate(0))}
                {choice('Ontem', !customDate && selectedDate === localDateKey(yesterday), () =>
                  setRelativeDate(-1),
                )}
                {choice(
                  'Outra data',
                  customDate,
                  () => {
                    setCustomDate(true);
                    setError('');
                  },
                  'calendar-outline',
                )}
              </View>
              {customDate ? (
                <View
                  style={[
                    styles.dateField,
                    { backgroundColor: palette.surface, borderColor: error && errorField === 'date' ? palette.danger : palette.border },
                  ]}
                >
                  <Ionicons name="calendar-outline" color={palette.accent} size={20} />
                  <AppTextInput
                    accessibilityLabel="Data da leitura"
                    value={date}
                    onChangeText={(text) => {
                      setDate(text);
                      setError('');
                    }}
                    placeholder="DD/MM/AAAA"
                    maxLength={10}
                    selectTextOnFocus
                    keyboardType="numbers-and-punctuation"
                    keyboardAppearance={isNight ? 'dark' : 'light'}
                    selectionColor={palette.accent}
                    placeholderTextColor={palette.muted}
                    style={[styles.dateInput, { color: palette.text }]}
                  />
                </View>
              ) : null}
              <FieldError isNight={isNight} message={errorField === 'date' ? error : undefined} />
            </View>
            {mode !== 'completion' ? (
              <>
                <View
                  style={styles.section}
                  onLayout={(event) => {
                    durationTop.current = event.nativeEvent.layout.y;
                  }}
                >
                  <View style={styles.sectionHeading}>
                    <Text style={[styles.sectionTitle, { color: palette.text }]}>Tempo de leitura</Text>
                    {manual ? (
                      <Text style={[styles.optional, { color: palette.muted }]}>Opcional</Text>
                    ) : null}
                  </View>
                  {manual ? (
                    <>
                      <View style={[styles.durationPanel, { backgroundColor: palette.surface }]}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Escolher duração da leitura"
                          accessibilityState={{ expanded: durationOpen }}
                          onPress={() => {
                            Keyboard.dismiss();
                            setDurationOpen(!durationOpen);
                          }}
                          style={styles.durationHeading}
                        >
                          <Ionicons name="timer-outline" size={25} color={palette.accent} />
                          <View style={styles.durationCopy}>
                            <Text style={[styles.durationValue, { color: palette.text }]}>
                              {minutes
                                ? duration < 1
                                  ? `${Math.round(duration * 60)} s`
                                  : `${hours ? `${hours} h ` : ''}${minutePart} min`
                                : 'Sem tempo informado'}
                            </Text>
                            <Text style={[styles.durationHint, { color: palette.muted }]}>
                              {durationOpen ? 'Deslize para escolher' : 'Toque para escolher horas e minutos'}
                            </Text>
                          </View>
                          <Ionicons
                            name={durationOpen ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color={palette.muted}
                          />
                        </Pressable>
                        {durationOpen ? (
                          <View style={styles.wheels}>
                            <View style={styles.wheelColumn}>
                              <Text style={[styles.controlLabel, { color: palette.muted }]}>Horas</Text>
                              <Host
                                colorScheme={isNight ? 'dark' : 'light'}
                                seedColor={palette.accent}
                                ignoreSafeArea="all"
                                style={styles.wheel}
                              >
                                <Picker
                                  appearance="wheel"
                                  selectedValue={hours}
                                  onValueChange={(value) => selectMinutes(Number(value) * 60 + minutePart)}
                                  testID="reading-hours"
                                >
                                  {hourOptions.map((value) => (
                                    <Picker.Item key={value} label={`${value} h`} value={value} />
                                  ))}
                                </Picker>
                              </Host>
                            </View>
                            <View style={styles.wheelColumn}>
                              <Text style={[styles.controlLabel, { color: palette.muted }]}>Minutos</Text>
                              <Host
                                colorScheme={isNight ? 'dark' : 'light'}
                                seedColor={palette.accent}
                                ignoreSafeArea="all"
                                style={styles.wheel}
                              >
                                <Picker
                                  appearance="wheel"
                                  selectedValue={minutePart}
                                  onValueChange={(value) => selectMinutes(hours * 60 + Number(value))}
                                  testID="reading-minutes"
                                >
                                  {MINUTES.map((value) => (
                                    <Picker.Item key={value} label={`${value} min`} value={value} />
                                  ))}
                                </Picker>
                              </Host>
                            </View>
                          </View>
                        ) : null}
                        <View style={styles.durationPresets}>
                          {[15, 30, 45, 60].map((value) =>
                            choice(
                              value === 60 ? '1 h' : `${value} min`,
                              minutes !== '' && duration === value,
                              () => selectMinutes(value),
                            ),
                          )}
                        </View>
                      </View>
                      {minutes ? (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => {
                            setMinutes('');
                            setDurationOpen(false);
                            setError('');
                          }}
                          accessibilityLabel="Não informar tempo"
                          style={styles.clearDuration}
                        >
                          <Ionicons name="close-circle-outline" size={17} color={palette.muted} />
                          <Text style={[styles.optional, { color: palette.muted }]}>Não informar tempo</Text>
                        </Pressable>
                      ) : null}
                    </>
                  ) : (
                    <View style={[styles.timerReadOnly, { backgroundColor: palette.surface }]}>
                      <Ionicons name="timer-outline" size={24} color={palette.accent} />
                      <Text style={[styles.durationValue, { color: palette.text }]}>
                        {formatReadingDuration(session?.durationSeconds)}
                      </Text>
                      <Text style={[styles.optional, { color: palette.muted }]}>
                        {session && readingTimeLabel(session)}
                      </Text>
                    </View>
                  )}
                </View>
                <FieldError isNight={isNight} message={errorField === 'duration' ? error : undefined} />
                <View style={styles.section}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={detailsOpen ? 'Detalhes da leitura' : 'Adicionar nome e observações'}
                    accessibilityState={{ expanded: detailsOpen }}
                    onPress={() => setDetailsOpen(!detailsOpen)}
                    style={styles.detailsToggle}
                  >
                    <Ionicons name="create-outline" size={20} color={palette.muted} />
                    <Text style={[styles.detailsLabel, { color: palette.text }]}>
                      {detailsOpen ? 'Detalhes da leitura' : 'Adicionar nome e observações'}
                    </Text>
                    <Ionicons name={detailsOpen ? 'chevron-up' : 'add'} size={19} color={palette.muted} />
                  </Pressable>
                  {detailsOpen ? (
                    <>
                      <View style={styles.field}>
                        <Text style={[styles.fieldLabel, { color: palette.muted }]}>Nome da leitura</Text>
                        <AppTextInput
                          accessibilityLabel="Nome da leitura"
                          value={name}
                          onChangeText={setName}
                          maxLength={80}
                          placeholder="Ex.: Antes de dormir"
                          keyboardAppearance={isNight ? 'dark' : 'light'}
                          placeholderTextColor={palette.muted}
                          selectionColor={palette.accent}
                          returnKeyType="done"
                          style={[
                            styles.input,
                            {
                              backgroundColor: palette.surface,
                              borderColor: palette.border,
                              color: palette.text,
                            },
                          ]}
                        />
                      </View>
                      <View style={styles.field}>
                        <Text style={[styles.fieldLabel, { color: palette.muted }]}>
                          O que ficou desta leitura?
                        </Text>
                        <AppTextInput
                          accessibilityLabel="Observações da leitura"
                          value={description}
                          onChangeText={setDescription}
                          maxLength={500}
                          placeholder="Uma ideia, uma sensação, algo para lembrar…"
                          multiline
                          keyboardAppearance={isNight ? 'dark' : 'light'}
                          placeholderTextColor={palette.muted}
                          selectionColor={palette.accent}
                          textAlignVertical="top"
                          style={[
                            styles.input,
                            styles.descriptionInput,
                            {
                              backgroundColor: palette.surface,
                              borderColor: palette.border,
                              color: palette.text,
                            },
                          ]}
                        />
                      </View>
                    </>
                  ) : null}
                </View>
              </>
            ) : null}
          </>
        ) : (
          <Text style={[styles.body, { color: palette.muted }]}>
            Este livro não está mais disponível na biblioteca.
          </Text>
        )}
      </ScrollView>
      {!timerBlocked && (session || book) ? (
        <View
          style={[
            styles.footer,
            {
              backgroundColor: palette.background,
              borderTopColor: palette.border,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          <FieldError isNight={isNight} message={errorField === 'form' ? error : undefined} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              mode === 'completion' ? 'Salvar data' : session ? 'Salvar alterações' : 'Registrar leitura'
            }
            onPress={save}
            style={({ pressed }) => [
              styles.saveButton,
              { backgroundColor: palette.action },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="checkmark" size={21} color={palette.actionText} />
            <Text style={[styles.saveButtonText, { color: palette.actionText }]}>
              {mode === 'completion' ? 'Salvar data' : session ? 'Salvar alterações' : 'Registrar leitura'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 28, paddingHorizontal: 22, paddingTop: 16, paddingBottom: 28 },
  bookHero: { flexDirection: 'row', gap: 20, alignItems: 'center', paddingBottom: 4 },
  cover: { width: 96, height: 144, borderRadius: radii.small, borderCurve: 'continuous' },
  coverFallback: { flex: 1, padding: 12, justifyContent: 'space-between' },
  coverSpine: { position: 'absolute', left: 6, top: 0, bottom: 0, width: 1 },
  coverTitle: { fontFamily: typography.editorial, fontSize: 12, lineHeight: 15 },
  coverAuthor: { fontSize: 8, lineHeight: 11 },
  bookCopy: { flex: 1, gap: 5 },
  bookTitle: { fontFamily: typography.editorial, fontSize: 25, lineHeight: 30 },
  bookAuthor: { fontSize: 14, lineHeight: 20 },
  bookPage: { fontSize: 12, lineHeight: 18, marginTop: 5 },
  section: { gap: 12 },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '600', lineHeight: 25 },
  body: { fontSize: 16, lineHeight: 24 },
  controlLabel: { fontSize: 13, fontWeight: '500', textAlign: 'center' },
  pagePanel: { borderRadius: 18, borderCurve: 'continuous' },
  pageSelectors: { flexDirection: 'row', paddingVertical: 17 },
  stackedSelectors: { flexDirection: 'column', gap: 16 },
  stackedDivider: { width: '100%', height: StyleSheet.hairlineWidth, marginVertical: 0 },
  fieldLabel: { fontSize: 13, fontWeight: '500' },
  pageColumn: { flex: 1, alignItems: 'center', gap: 4 },
  pageNumber: {
    fontSize: 38,
    fontFamily: typography.editorial,
    textAlign: 'center',
    minWidth: 80,
    minHeight: 56,
    paddingVertical: 2,
    fontVariant: ['tabular-nums'],
  },
  pageSteps: { flexDirection: 'row', gap: 20, marginTop: 5 },
  pageStep: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  pageDivider: { width: StyleSheet.hairlineWidth, marginVertical: 10 },
  pageSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7,
    padding: 15,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pageSummaryText: { fontSize: 13, fontWeight: '500' },
  totalPages: { fontSize: 12, marginLeft: 'auto' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    flexGrow: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  choiceText: { fontSize: 14, fontWeight: '500' },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 13,
    paddingHorizontal: 15,
  },
  dateInput: { flex: 1, minHeight: 50, fontSize: 17, paddingVertical: 12, fontVariant: ['tabular-nums'] },
  optional: { fontSize: 12, lineHeight: 18 },
  durationPanel: { padding: 16, borderRadius: 18, gap: 15 },
  durationHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  durationCopy: { flex: 1, gap: 4 },
  durationValue: { fontFamily: typography.editorial, fontSize: 22 },
  durationHint: { fontSize: 12, lineHeight: 18 },
  durationPresets: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  wheels: { flexDirection: 'row', gap: 8 },
  wheelColumn: { flex: 1, gap: 0 },
  wheel: { width: '100%', height: 144 },
  clearDuration: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  timerReadOnly: {
    padding: 18,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailsToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  detailsLabel: { flex: 1, fontSize: 14, fontWeight: '500' },
  field: { gap: 8 },
  input: { ...controls.input },
  descriptionInput: { minHeight: 110, lineHeight: 22 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, paddingHorizontal: 22, gap: 10 },
  saveButton: { ...controls.button, flexDirection: 'row', gap: 8 },
  saveButtonText: { ...controls.buttonText, flexShrink: 1, textAlign: 'center' },
  keyboardButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  disabled: controls.buttonDisabled,
  pressed: controls.buttonPressed,
});
