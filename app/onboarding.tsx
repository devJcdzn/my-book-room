import { AppTextInput, FieldError } from '@/src/components/app-text-input';
import { showAlert } from '@/src/components/app-dialog';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useGlobalSearchParams, usePathname, useNavigation, type NativeStackNavigationProp } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthActions } from '@/src/components/auth-actions';
import { ACCOUNT_SYNC_ENABLED } from '@/src/config/features';
import { useAuth } from '@/src/providers/auth-provider';
import { ProfileAvatar } from '@/src/components/profile-avatar';
import { READING_NOTE_COLORS } from '@/src/utils/reading-note';
import { BookCover } from '@/src/components/book-cover';
import { resolveAmbience } from '@/src/types/ambience';
import { PROFILE_LIMITS, useLibraryStore, type AmbienceMode } from '@/src/store/library-store';
import { controls, colors, darkTheme, getReadingNotePalette, radii, typography } from '@/src/theme';

import { HABIT_QUESTIONS, ONBOARDING_STEPS, getOnboardingMessage } from '@/src/utils/onboarding';

function OnboardingButton({ label, color, backgroundColor, disabled, icon, onPress, compact }: {
  label: string;
  color: string;
  backgroundColor: string;
  disabled?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.actionButton, compact && styles.flexAction,
        { backgroundColor }, disabled && controls.buttonDisabled, pressed && controls.buttonPressed]}>
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
      <Ionicons name={icon} size={19} color={color} accessible={false} />
    </Pressable>
  );
}

const TOTAL_STEPS = ONBOARDING_STEPS;
const NIKO_IMAGES = [
  require('@/assets/onboarding/niko-welcome.webp'),
  require('@/assets/onboarding/niko-rhythm.webp'),
  require('@/assets/onboarding/niko-intention.webp'),
  require('@/assets/onboarding/niko-moment.webp'),
  require('@/assets/onboarding/niko-reading.webp'),
];

const BOOK_IMAGE = require('@/assets/onboarding/book-stack.webp');
const FEATURE_STEPS = [
  {
    image: require('@/assets/onboarding/reading-timer.webp'),
    title: 'Um tempo só para ler',
    body: 'Abra seu livro e inicie o timer. Pause quando precisar e, ao terminar, registre até onde leu.',
  },
  {
    image: require('@/assets/onboarding/reading-journal.webp'),
    title: 'Guarde o que fica da leitura',
    body: 'Ideias, trechos e impressões ficam ligados ao livro e reunidos no Diário.',
  },
  {
    image: require('@/assets/onboarding/niko-frame.webp'),
    title: 'Uma leitura que fica na sala',
    body: 'Ao marcar um livro como concluído, sua capa fica disponível para os pôsteres da sala.',
    hint: 'Na personalização, adicione um pôster e selecione a capa de um livro concluído.',
  },
  {
    image: require('@/assets/onboarding/niko-room-cozy.webp'),
    title: 'Seu espaço de leitura',
    body: 'Escolha os móveis, encontre um lugar para cada peça e deixe seu cantinho com a sua cara.',
  },
];
const LAMP_IMAGE = require('@/assets/onboarding/reading-lamp.webp');

const HABIT_ICONS: Record<string, (keyof typeof Ionicons.glyphMap)[]> = {
  frequency: ['book-outline', 'bookmarks-outline', 'refresh-outline'],
  intention: ['leaf-outline', 'bulb-outline', 'calendar-outline'],
  moment: ['sunny-outline', 'cafe-outline', 'moon-outline', 'time-outline'],
};

const AMBIENCE_OPTIONS: {
  id: AmbienceMode;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    id: 'auto',
    label: 'Automático',
    description: 'Alterna entre dia e noite conforme o horário.',
    icon: 'time-outline',
  },
  {
    id: 'day',
    label: 'Dia',
    description: 'Mantém a sala e o app em tons claros.',
    icon: 'sunny-outline',
  },
  {
    id: 'night',
    label: 'Noite',
    description: 'Mantém a sala e o app em tons escuros.',
    icon: 'moon-outline',
  },
];

const tapFeedback = (style = Haptics.ImpactFeedbackStyle.Light) => {
  if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(style);
};

const notifySuccess = () => {
  if (process.env.EXPO_OS === 'ios') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
};

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { user, isAuthenticating, isLoading, syncStatus } = useAuth();
  const { from } = useGlobalSearchParams<{ from?: string }>();
  const navigation = useNavigation<NativeStackNavigationProp<{ '(tabs)': undefined }>>('/');
  const enterRoom = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: '(tabs)', state: { index: 0, routes: [{ name: 'index' }] } }],
    });
  }, [navigation]);
  const profile = useLibraryStore((state) => state.profile);
  const books = useLibraryStore((state) => state.books);
  const onboardingStep = useLibraryStore((state) => state.onboardingStep);
  const savedAnswers = useLibraryStore((state) => state.onboardingAnswers);
  const setOnboardingAnswers = useLibraryStore((state) => state.setOnboardingAnswers);
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const setAmbienceMode = useLibraryStore((state) => state.setAmbienceMode);
  const updateProfile = useLibraryStore((state) => state.updateProfile);
  const setOnboardingStep = useLibraryStore((state) => state.setOnboardingStep);
  const completeOnboarding = useLibraryStore((state) => state.completeOnboarding);
  const skipOnboarding = useLibraryStore((state) => state.skipOnboarding);

  const pathname = usePathname();
  useEffect(() => {
    if (useLibraryStore.getState().onboardingStatus === 'not_started') setOnboardingStep(0);
  }, [setOnboardingStep]);
  const step = Math.min(TOTAL_STEPS - 1, Math.max(0, onboardingStep));
  const [name, setName] = useState(profile.name === 'Leitor(a)' ? '' : profile.name);
  const [answers, setAnswers] = useState(savedAnswers);
  const [focusedField, setFocusedField] = useState<'name' | 'book'>();
  const [bookQuery, setBookQuery] = useState('');
  const [nameChecked, setNameChecked] = useState(false);
  const nameError = nameChecked && !name.trim() ? 'Digite seu nome para continuar.' : undefined;
  const bookQueryError = bookQuery.trim().length === 1 ? 'Digite pelo menos dois caracteres para buscar.' : undefined;
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerElapsed = useRef(0);
  useEffect(() => { timerElapsed.current = timerSeconds; }, [timerSeconds]);
  const [noteDraft, setNoteDraft] = useState('');
  const [notePreview, setNotePreview] = useState(false);
  const [noteColor, setNoteColor] = useState<string>(READING_NOTE_COLORS[0]);
  const question = step >= 1 && step <= 3 ? HABIT_QUESTIONS[step - 1] : undefined;
  const message = getOnboardingMessage(answers);
  const reducedMotion = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);
  const nikoScale = useSharedValue(1);
  const progress = useSharedValue((step + 1) / TOTAL_STEPS * 100);
  const nikoMotion = useAnimatedStyle(() => ({ transform: [{ scale: nikoScale.value }] }));
  const progressMotion = useAnimatedStyle(() => ({ width: `${progress.value}%` as `${number}%` }));

  useEffect(() => {
    progress.value = withTiming((step + 1) / TOTAL_STEPS * 100, { duration: reducedMotion ? 0 : 220 });
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [progress, reducedMotion, step]);

  const isNight = resolveAmbience(ambienceMode) === 'night';
  const palette = {
    background: isNight ? darkTheme.bg : colors.cream,
    surface: isNight ? darkTheme.surface : colors.paper,
    surfaceSelected: isNight ? darkTheme.selection : colors.sageSoft,
    text: isNight ? darkTheme.text : colors.ink,
    textSoft: isNight ? darkTheme.textMuted : colors.inkSoft,
    muted: isNight ? darkTheme.textMuted : colors.muted,
    border: isNight ? darkTheme.border : colors.line,
    accent: isNight ? darkTheme.selectionText : colors.sageDark,
    action: isNight ? darkTheme.primary : colors.ink,
  };

  useEffect(() => {
    if (!timerRunning || step !== 7 || pathname !== '/onboarding') return;
    const startedAt = Date.now() - timerElapsed.current * 1000;
    const interval = setInterval(() => setTimerSeconds(Math.floor((Date.now() - startedAt) / 1000)), 250);
    return () => clearInterval(interval);
  }, [pathname, step, timerRunning]);

  const notePalette = getReadingNotePalette(noteColor, isNight);
  const examplePalette = getReadingNotePalette(READING_NOTE_COLORS[5], isNight);

  const searchFirstBook = (query = bookQuery) => {
    if (query.trim().length === 1) return;
    tapFeedback();
    Keyboard.dismiss();
    router.push({ pathname: '/books/catalog', params: { from: 'onboarding', query: query.trim() } });
  };

  const goToStep = (nextStep: number) => {
    setTimerRunning(false);
    tapFeedback();
    Keyboard.dismiss();
    setOnboardingStep(nextStep);
  };

  const authBusy = step === TOTAL_STEPS - 1 && (isAuthenticating || isLoading);

  const handleNext = () => {
    if (authBusy) return;
    if (step === 0) {
      const normalizedName = name.trim();
      setNameChecked(true);
      if (!normalizedName) return;
      updateProfile({ name: normalizedName });
    }

    if (question) {
      if (!answers[question.key]) return;
      setOnboardingAnswers(answers);
    }

    if (step === 6 && books.length === 0) {
      searchFirstBook();
      return;
    }

    if (step < TOTAL_STEPS - 1) {
      goToStep(step + 1);
      return;
    }

    notifySuccess();
    completeOnboarding();
    enterRoom();
  };

  const handleBack = () => {
    if (authBusy || step === 0) return;
    goToStep(step - 1);
  };

  const handleSkip = () => {
    if (authBusy) return;
    const skip = () => {
      skipOnboarding();
      enterRoom();
    };

    if (step === 6 && books.length === 0) {
      showAlert(
        'Entrar sem livro na mesa?',
        'Você poderá adicionar ou buscar livros a qualquer momento dentro da sua sala.',
        [
          { text: 'Continuar escolhendo', style: 'cancel' },
          { text: 'Entrar na sala', onPress: skip },
        ],
      );
      return;
    }
    skip();
  };


  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        {step > 0 ? (
          <Pressable
            accessibilityLabel="Voltar uma etapa"
            accessibilityRole="button"
            hitSlop={12}
            disabled={authBusy}
            onPress={handleBack}
            style={styles.navButton}
          >
            <Ionicons color={palette.text} name="arrow-back" size={22} />
          </Pressable>
        ) : (
          <View style={styles.navButtonPlaceholder} />
        )}

        <View accessible accessibilityRole="progressbar" accessibilityLabel={`Etapa ${step + 1} de ${TOTAL_STEPS}`} accessibilityValue={{ min: 0, max: TOTAL_STEPS, now: step + 1 }} style={styles.progressRow}>
          <View style={[styles.progressTrack, { backgroundColor: palette.border }]}>
            <Animated.View style={[styles.progressFill, { backgroundColor: palette.accent }, progressMotion]} />
          </View>
        </View>

        <Pressable
          accessibilityLabel="Pular onboarding"
          accessibilityRole="button"
          hitSlop={12}
          disabled={authBusy}
          onPress={handleSkip}
          style={styles.skipButton}
        >
          <Text selectable style={[styles.skipLabel, { color: palette.muted }]}>
            Pular
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView
          key={step}
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            key={step}
            entering={reducedMotion ? undefined : FadeIn.duration(180)}
            style={styles.stepContainer}
          >
            {step < 5 && (
              <Animated.View style={[styles.mascot, step === 0 && styles.mascotWelcome, step === 4 && styles.mascotLarge, nikoMotion]}>
                <Image priority="high" transition={0} source={NIKO_IMAGES[step]} contentFit="contain" style={styles.mascotImage} accessible={false} />
              </Animated.View>
            )}
            {question && (
              <View style={styles.stepBlock}>
                <View style={styles.headerBlock}>
                  <Text style={[styles.title, styles.questionTitle, { color: palette.text }]}>{question.title}</Text>
                  <Text style={[styles.subtitle, { color: palette.muted }]}>{question.subtitle}</Text>
                </View>
                <View style={[styles.optionsStack, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                  {question.options.map((option, index) => {
                    const selected = answers[question.key] === option.id;
                    return (
                      <Pressable
                        key={option.id}
                        accessibilityRole="button"
                        accessibilityLabel={option.label}
                        accessibilityState={{ selected }}
                        onPress={() => {
                          tapFeedback();
                          setAnswers((current) => ({ ...current, [question.key]: option.id }));
                          if (!reducedMotion) nikoScale.value = withSequence(withTiming(1.04, { duration: 110 }), withTiming(1, { duration: 160 }));
                        }}
                        style={({ pressed }) => [styles.optionCard, {
                          backgroundColor: selected || pressed ? palette.surfaceSelected : palette.surface,
                          borderTopWidth: index ? StyleSheet.hairlineWidth : 0,
                          borderColor: palette.border,
                        }, pressed && styles.pressed]}
                      >
                        <Ionicons name={HABIT_ICONS[question.key][index]} size={22} color={selected ? palette.accent : palette.muted} />
                        <Text style={[styles.habitLabel, { color: palette.text }]}>{option.label}</Text>
                        <View style={styles.selectionMark}>
                          {selected && <Ionicons name="checkmark" size={22} color={palette.accent} accessible={false} />}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
            {step === 4 && (
              <View style={[styles.stepBlock, styles.personalMessage]}>
                <Text style={[styles.personalName, { color: palette.accent }]}>{name.trim() || profile.name},</Text>
                <Text style={[styles.title, styles.centered, { color: palette.text }]}>{message.title}</Text>
                <Text style={[styles.subtitle, styles.centered, { color: palette.muted }]}>{message.body}</Text>
              </View>
            )}
            {step === 0 && (
              <View style={styles.stepBlock}>
                <View style={styles.headerBlock}>
                  <Text selectable style={[styles.title, { color: palette.text }]}>
                    Seu cantinho de leitura
                  </Text>
                  <Text selectable style={[styles.subtitle, { color: palette.muted }]}>
                    Um lugar para seus livros, suas leituras e as ideias que ficam.
                  </Text>
                </View>

                <View style={styles.formGroup}>
                  <Text selectable style={[styles.fieldLabel, { color: palette.text }]}>
                    Seu nome
                  </Text>
                  <View style={[styles.inputWrapper, {
                    backgroundColor: palette.surface,
                    borderColor: nameError ? (isNight ? darkTheme.danger : colors.danger) : focusedField === 'name' ? palette.accent : palette.border,
                  }]}>
                    <Ionicons name="person-outline" size={20} color={palette.muted} accessible={false} />
                    <AppTextInput
                      accessibilityLabel="Seu nome"
                      onFocus={() => setFocusedField('name')}
                      onBlur={() => setFocusedField(undefined)}
                      keyboardAppearance={isNight ? 'dark' : 'light'}
                      selectionColor={palette.accent}
                      autoCapitalize="words"
                      maxLength={PROFILE_LIMITS.name}
                      onChangeText={setName}
                      onSubmitEditing={handleNext}
                      placeholder="Ex.: Clara ou Jean"
                      placeholderTextColor={palette.muted}
                      returnKeyType="next"
                      style={[styles.input, { color: palette.text }]}
                      value={name}
                    />
                    {name.length > 0 && (
                      <Pressable
                        accessibilityLabel="Limpar texto"
                        accessibilityRole="button"
                        hitSlop={8}
                        onPress={() => setName('')}
                        style={styles.clearBtn}
                      >
                        <Ionicons color={palette.muted} name="close-circle" size={18} />
                      </Pressable>
                    )}
                  </View>
                  <FieldError isNight={isNight} message={nameError} />
                  <Text selectable style={[styles.helperCaption, { color: palette.muted }]}>
                    Você poderá mudar isso no seu perfil a qualquer momento.
                  </Text>
                </View>
              </View>
            )}
            {step === 5 && (
              <View style={styles.stepBlock}>
                <View style={[styles.ambienceArtwork, { backgroundColor: isNight ? darkTheme.surfaceElevated : colors.softFill }]}>
                  <Image source={LAMP_IMAGE} contentFit="contain" style={styles.mascotImage} accessible={false} transition={0} />
                </View>
                <View style={styles.headerBlock}>
                  <Text selectable style={[styles.title, { color: palette.text }]}>
                    Escolha o clima da sala
                  </Text>
                  <Text selectable style={[styles.subtitle, { color: palette.textSoft }]}>
                    Você pode mudar essa escolha depois.
                  </Text>
                </View>

                <View style={[styles.optionsStack, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                  {AMBIENCE_OPTIONS.map((option, index) => {
                    const selected = ambienceMode === option.id;
                    const selectedColor = palette.accent;
                    return (
                      <Pressable
                        key={option.id}
                        accessibilityLabel={`Atmosfera ${option.label}`}
                        accessibilityHint={option.description}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => {
                          tapFeedback();
                          setAmbienceMode(option.id);
                        }}
                        style={({ pressed }) => [
                          styles.optionCard,
                          {
                            backgroundColor: selected || pressed ? palette.surfaceSelected : palette.surface,
                            borderTopWidth: index ? StyleSheet.hairlineWidth : 0,
                            borderColor: palette.border,
                          },
                          pressed && styles.pressed,
                        ]}
                      >
                        <Ionicons color={selected ? selectedColor : palette.muted} name={option.icon} size={24} />
                        <View style={styles.optionCopy}>
                          <Text style={[styles.optionTitle, { color: palette.text }]}>
                            {option.label}
                          </Text>
                          <Text style={[styles.optionDesc, { color: palette.textSoft }]}>
                            {option.description}
                          </Text>
                        </View>
                        <View style={styles.selectionMark}>
                          {selected && <Ionicons name="checkmark" size={22} color={palette.accent} accessible={false} />}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
            {step === 6 && (
              <View style={styles.stepBlock}>
                <View style={styles.featureMascot}>
                  <Image source={BOOK_IMAGE} transition={0} contentFit="contain" style={styles.mascotImage} accessible={false} />
                </View>

                <View style={styles.headerBlock}>
                  <Text selectable style={[styles.title, { color: palette.text }]}>
                    Seu primeiro livro na estante
                  </Text>
                  <Text selectable style={[styles.subtitle, { color: palette.muted }]}>
                    {books.length ? 'Seu livro já faz parte da sua biblioteca.' : 'Busque por título ou autor para adicionar um livro.'}
                  </Text>
                </View>

                <View style={styles.formGroup}>
                  <View style={[styles.inputWrapper, {
                    backgroundColor: palette.surface,
                    borderColor: bookQueryError ? (isNight ? darkTheme.danger : colors.danger) : focusedField === 'book' ? palette.accent : palette.border,
                  }]}>
                    <AppTextInput
                      accessibilityLabel="Buscar seu primeiro livro"
                      onFocus={() => setFocusedField('book')}
                      onBlur={() => setFocusedField(undefined)}
                      keyboardAppearance={isNight ? 'dark' : 'light'}
                      selectionColor={palette.accent}
                      placeholder="Título ou autor"
                      placeholderTextColor={palette.muted}
                      value={bookQuery}
                      onChangeText={setBookQuery}
                      onSubmitEditing={() => searchFirstBook()}
                      returnKeyType="search"
                      autoCorrect={false}
                      maxLength={120}
                      style={[styles.input, { color: palette.text }]}
                    />
                    <Pressable accessibilityRole="button" accessibilityLabel="Buscar livro no catálogo" onPress={() => searchFirstBook()} style={styles.navButton}>
                      <Ionicons name="search-outline" size={22} color={palette.accent} />
                    </Pressable>
                  </View>
                  <FieldError isNight={isNight} message={bookQueryError} />
                  <Text style={[styles.helperCaption, { color: palette.muted }]}>Experimente uma busca:</Text>
                  <View style={styles.previewChoices}>
                    {['O Pequeno Príncipe', 'Dom Casmurro', '1984'].map((title) => (
                      <Pressable key={title} accessibilityRole="button" onPress={() => { setBookQuery(title); searchFirstBook(title); }} style={[styles.previewChip, { borderColor: palette.border, backgroundColor: palette.surface }]}>
                        <Text style={[styles.previewChipText, { color: palette.text }]}>{title}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                {books.length > 0 && books[0] ? (
                  <View style={styles.activeBookContainer}>
                    <View style={[styles.activeBookCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                      <BookCover style={styles.activeBookCover} color={books[0].coverColor} coverUrl={books[0].coverUrl}>
                        {!books[0].coverUrl && <Ionicons color={colors.paper} name="book-outline" size={22} />}
                      </BookCover>
                      <View style={styles.activeBookCopy}>
                        <Text selectable style={[styles.activeBookTitle, { color: palette.text }]}>
                          {books[0].title}
                        </Text>
                        <Text numberOfLines={1} selectable style={[styles.activeBookAuthor, { color: palette.muted }]}>
                          {books[0].author || 'Autor registrado'}
                        </Text>
                        {books[0].totalPages > 0 && (
                          <Text selectable style={[styles.activeBookPages, { color: palette.muted }]}>
                            {books[0].totalPages} páginas
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={styles.starterContainer}>
                    <Pressable
                      accessibilityLabel="Cadastrar livro manualmente"
                      accessibilityRole="button"
                      onPress={() => router.push({ pathname: '/add-book', params: { from: 'onboarding' } })}
                      style={styles.skipTextButton}
                    >
                      <Text style={[styles.switchBookText, { color: palette.accent }]}>Cadastrar meu livro manualmente</Text>
                    </Pressable>
                    <Pressable
                      accessibilityLabel="Adicionar um livro depois"
                      accessibilityRole="button"
                      hitSlop={10}
                      onPress={() => goToStep(7)}
                      style={styles.skipTextButton}
                    >
                      <Text selectable style={[styles.skipTextLabel, { color: palette.muted }]}>
                        Adicionar um livro depois
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
            {step >= 7 && FEATURE_STEPS[step - 7] && (
              <View style={styles.stepBlock}>
                {step === 9 && (
                  <View style={[styles.featureMascot, styles.interactiveMascot]}>
                    <Image source={FEATURE_STEPS[step - 7].image} transition={0} contentFit="contain" style={styles.mascotImage} accessible={false} />
                  </View>
                )}
                <View style={styles.headerBlock}>
                  <Text style={[styles.title, { color: palette.text }]}>{FEATURE_STEPS[step - 7].title}</Text>
                  <Text style={[styles.subtitle, { color: palette.textSoft }]}>{FEATURE_STEPS[step - 7].body}</Text>
                </View>
                {step === 7 && (
                  <View style={[styles.timerPreview, { backgroundColor: palette.surface }]}>
                    <Text style={[styles.timerCaption, { color: palette.muted }]}>{timerRunning ? 'Leitura em andamento' : 'Experimente o timer'}</Text>
                    <Text accessibilityLabel={`${timerSeconds} segundos de demonstração`} style={[styles.timerValue, { color: palette.text }]}>
                      {`${String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:${String(timerSeconds % 60).padStart(2, '0')}`}
                    </Text>
                    <View style={styles.demoActions}>
                      <OnboardingButton compact color={palette.accent} backgroundColor={palette.surfaceSelected} icon={timerRunning ? "pause" : "play"} label={timerRunning ? 'Pausar' : timerSeconds ? 'Continuar' : 'Iniciar'} onPress={() => { tapFeedback(); setTimerRunning((value) => !value); }} />
                      <Pressable accessibilityRole="button" accessibilityLabel="Reiniciar demonstração do timer" onPress={() => { setTimerRunning(false); setTimerSeconds(0); }} style={[styles.demoReset, { borderColor: palette.border }]}>
                        <Ionicons name="refresh-outline" size={22} color={palette.accent} />
                      </Pressable>
                    </View>
                    <Text style={[styles.helperCaption, { color: palette.muted }]}>Demonstração · não registra uma sessão.</Text>
                  </View>
                )}
                {step === 8 && (
                  <View style={styles.notesDemo}>
                    <View style={[styles.sampleNote, { backgroundColor: examplePalette.surface, borderColor: examplePalette.border }]}>
                      <Text style={[styles.noteText, { color: examplePalette.text }]}>Um detalhe pequeno mudou minha forma de enxergar a história.</Text>
                      <View style={[styles.noteDivider, { backgroundColor: examplePalette.border }]} />
                      <Text style={[styles.helperCaption, { color: examplePalette.muted }]}>Uma impressão de leitura · exemplo</Text>
                    </View>
                    <View style={[styles.sampleNote, { backgroundColor: notePalette.surface, borderColor: notePalette.border }]}>
                      {notePreview ? <Text selectable style={[styles.noteText, { color: notePalette.text }]}>{noteDraft.trim()}</Text> : (
                        <AppTextInput
                          accessibilityLabel="Experimentar uma nota de leitura"
                          multiline maxLength={500} value={noteDraft} onChangeText={setNoteDraft}
                          placeholder="Escreva uma ideia ou impressão sua…" placeholderTextColor={notePalette.muted}
                          style={[styles.demoNoteInput, { color: notePalette.text }]}
                        />
                      )}
                      <View style={[styles.noteDivider, { backgroundColor: notePalette.border }]} />
                      <Text style={[styles.helperCaption, { color: notePalette.muted }]}>Sua nota de exemplo{notePreview ? '' : ` · ${noteDraft.length}/500`}</Text>
                    </View>
                    <View style={styles.noteColors}>
                      {READING_NOTE_COLORS.map((color, index) => {
                        const swatch = getReadingNotePalette(color, isNight);
                        return <Pressable key={color} accessibilityRole="button" accessibilityLabel={`Cor da nota: ${['Amarelo', 'Lavanda', 'Pêssego', 'Verde', 'Rosa', 'Azul'][index]}`} accessibilityState={{ selected: color === noteColor }} onPress={() => { tapFeedback(); setNoteColor(color); }} style={[styles.noteSwatch, { backgroundColor: swatch.surface, borderColor: color === noteColor ? palette.accent : swatch.border }]}>
                          {color === noteColor && <Ionicons name="checkmark" size={20} color={swatch.text} />}
                        </Pressable>;
                      })}
                    </View>
                    <OnboardingButton color={palette.accent} backgroundColor={palette.surfaceSelected} icon={notePreview ? "pencil-outline" : "checkmark"} disabled={!noteDraft.trim()} label={notePreview ? 'Editar exemplo' : 'Criar nota de exemplo'} onPress={() => { Keyboard.dismiss(); tapFeedback(); setNotePreview((value) => !value); }} />
                    <Text style={[styles.helperCaption, { color: palette.muted }]}>Só para experimentar. Esta nota não é salva no Diário.</Text>
                  </View>
                )}
                {step === 10 && (
                  <View style={styles.roomStory}>
                    <Image source={FEATURE_STEPS[3].image} transition={0} contentFit="contain" style={styles.roomIllustration} accessible={false} />
                    <View style={[styles.roomInstructions, { borderColor: palette.border }]}>
                      <Text style={[styles.accountBenefitTitle, { color: palette.text }]}>Móveis que combinam com você</Text>
                      <Text style={[styles.subtitle, { color: palette.textSoft }]}>Misture coleções e mova seus móveis na personalização da sala.</Text>
                    </View>
                    <Text style={[styles.helperCaption, { color: palette.muted }]}>Você pode mudar tudo depois, no seu ritmo.</Text>
                  </View>
                )}

                {step === 9 && <Text style={[styles.subtitle, { color: palette.muted }]}>{FEATURE_STEPS[step - 7].hint}</Text>}
              </View>
            )}
            {step === TOTAL_STEPS - 1 && (
              <View style={styles.accountStep}>
                <View style={styles.accountHero}>
                  <Image
                    source={user ? FEATURE_STEPS[3].image : NIKO_IMAGES[0]}
                    contentFit="contain"
                    transition={0}
                    style={styles.accountArtwork}
                    accessible={false}
                  />
                  <Text style={[styles.title, styles.centered, { color: palette.text }]}>{user ? 'Seu cantinho está pronto' : 'Seu cantinho de leitura'}</Text>
                  <Text style={[styles.subtitle, styles.centered, { color: palette.textSoft }]}>{user ? 'Você já pode entrar na sua sala.' : ACCOUNT_SYNC_ENABLED ? 'Conecte sua conta para levar suas leituras e sua sala a outros aparelhos.' : 'Suas leituras ficam salvas neste aparelho.'}</Text>
                </View>
                {user ? (
                  <View style={[styles.connectedAccount, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                    <View style={styles.accountIdentity}>
                      <ProfileAvatar avatar={profile.avatar} name={profile.name} size={48}
                        fallbackColor={palette.surfaceSelected} fallbackTextColor={palette.accent} />
                      <View style={styles.flexAction}>
                        <Text style={[styles.accountBenefitTitle, { color: palette.text }]}>{profile.name}</Text>
                        {user.email && <Text selectable style={[styles.accountBenefitCopy, { color: palette.textSoft }]}>{user.email}</Text>}
                      </View>
                      <Ionicons name="checkmark-circle" size={23} color={palette.accent} accessible={false} />
                    </View>
                    <View style={[styles.noteDivider, { backgroundColor: palette.border }]} />
                    <Text accessibilityLiveRegion="polite" style={[styles.accountBenefitCopy, { color: palette.textSoft }]}>
                      {syncStatus === 'conflict' ? 'Há duas versões da sala. Escolha qual manter em Perfil → Conta.' : syncStatus === 'synced' ? 'Sua sala está salva na conta.' : syncStatus === 'syncing' ? 'Salvando sua sala na conta…' : 'Acompanhe o salvamento da sua sala em Perfil → Conta.'}
                    </Text>
                  </View>
                ) : ACCOUNT_SYNC_ENABLED ? (
                  <AuthActions isNight={isNight} showDescription={false} indicatorColor={palette.accent} />
                ) : null}
              </View>
            )}
          </Animated.View>
        </ScrollView>

        <View
          style={[
            styles.dockedFooter,
            {
              backgroundColor: palette.background,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          {step === TOTAL_STEPS - 1 && !user && ACCOUNT_SYNC_ENABLED && (
            <Text style={[styles.helperCaption, styles.centered, { color: palette.muted }]}>
              Sem conta, seus dados ficam neste aparelho. Você pode entrar depois pelo Perfil.
            </Text>
          )}
          <OnboardingButton
            color={isNight ? darkTheme.actionText : colors.paper}
            backgroundColor={palette.action}
            icon={step === TOTAL_STEPS - 1 ? "arrow-forward" : "chevron-forward"}
            disabled={authBusy || Boolean(question && !answers[question.key])}
            label={step === TOTAL_STEPS - 1 ? (user ? 'Entrar na minha sala' : 'Continuar sem conta') : step === 6 && books.length === 0 ? 'Buscar no catálogo' : 'Continuar'}
            onPress={handleNext}
          />
          {from === 'profile' ? (
            <Text selectable style={[styles.replayNote, { color: palette.muted }]}>
              Suas leituras e preferências atuais serão preservadas.
            </Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    flexGrow: 1,
  },
  topBar: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  navButton: { ...controls.iconButton },
  navButtonPlaceholder: {
    width: controls.iconButton.width,
    height: controls.iconButton.height,
  },
  skipButton: {
    minWidth: controls.iconButton.width,
    minHeight: controls.iconButton.height,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  skipLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  progressTrack: { width: '100%', height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  stepContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  stepBlock: {
    gap: 20,
  },
  headerBlock: {
    gap: 6,
  },
  title: {
    fontSize: 30,
    fontFamily: typography.editorial,
    lineHeight: 36,
    letterSpacing: -0.4,
  },
  questionTitle: { fontFamily: typography.ui, fontWeight: '600', fontSize: 27, lineHeight: 34 },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },

  ambienceArtwork: {
    width: '100%',
    height: 154,
    padding: 8,
    borderRadius: radii.large,
    borderCurve: 'continuous',
  },

  featureMascot: { width: '100%', height: 230 },
  timerPreview: { borderRadius: radii.large, padding: 22, alignItems: 'center', gap: 10 },
  timerCaption: { fontSize: 14, lineHeight: 20 },
  timerValue: { fontFamily: typography.editorial, fontSize: 64, lineHeight: 76, fontVariant: ['tabular-nums'] },
  notesDemo: { gap: 14 },
  sampleNote: { padding: 16, borderRadius: 20, borderWidth: 1, gap: 12 },
  noteDivider: { height: StyleSheet.hairlineWidth },
  noteColors: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 4 },
  noteSwatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  interactiveMascot: { height: 148 },
  demoActions: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10 },
  flexAction: { flex: 1 },
  demoReset: { ...controls.iconButton, borderWidth: 1 },
  demoNoteInput: { minHeight: 80, fontSize: 17, lineHeight: 25, padding: 0, textAlignVertical: 'top' },
  accountStep: { gap: 22 },
  accountHero: { alignItems: 'center', gap: 12 },
  accountArtwork: { height: 148, width: '100%' },
  connectedAccount: { borderWidth: 1, borderRadius: radii.large, padding: 20, gap: 10 },
  accountIdentity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  accountBenefitCopy: { fontSize: 14, lineHeight: 21 },
  accountBenefitTitle: { fontSize: 16, lineHeight: 22, fontWeight: '600', marginTop: 4 },
  roomStory: { gap: 16 },
  roomIllustration: { width: '100%', height: 230 },
  roomInstructions: { gap: 6, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth },
  previewChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  previewChip: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, borderRadius: controls.input.borderRadius, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  previewChipText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  noteText: { fontSize: 18, lineHeight: 27 },
  mascot: { height: 148, width: '100%', marginBottom: 24 },
  mascotWelcome: { height: 180 },
  mascotLarge: { height: 220, marginBottom: 20 },
  mascotImage: { width: '100%', height: '100%' },
  habitLabel: { fontSize: 17, lineHeight: 24, fontWeight: '600', flex: 1 },
  personalMessage: { alignItems: 'center', gap: 12 },
  personalName: { fontFamily: typography.editorial, fontSize: 32, lineHeight: 40, textAlign: 'center' },
  centered: { textAlign: 'center' },

  formGroup: {
    gap: 8,
    paddingTop: 4,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radii.medium,
    borderCurve: 'continuous',
    gap: 10,
    paddingHorizontal: controls.input.paddingHorizontal,
    minHeight: controls.input.minHeight,
  },
  input: {
    flex: 1,
    fontSize: controls.input.fontSize,
    paddingVertical: controls.input.paddingVertical,
  },
  clearBtn: { ...controls.iconButton },
  helperCaption: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },

  optionsStack: { borderRadius: radii.large, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  optionCard: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  optionCopy: {
    flex: 1,
    gap: 4,
  },
  optionTitle: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '600',
  },
  optionDesc: {
    fontSize: 14,
    lineHeight: 21,
  },
  selectionMark: { width: 24, alignItems: 'center' },

  actionButton: {
    ...controls.button,
    flexDirection: 'row',
    gap: 10,
  },
  actionLabel: { ...controls.buttonText, flexShrink: 1, textAlign: 'center', fontFamily: typography.ui },

  // Etapa 3: Livro na Mesa
  activeBookContainer: {
    gap: 14,
  },
  activeBookCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderWidth: 1,
    borderRadius: radii.medium,
    borderCurve: 'continuous',
  },
  activeBookCover: {
    width: 56,
    height: 80,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBookCopy: {
    flex: 1,
    gap: 2,
  },
  activeBookTitle: {
    fontSize: 17,
    fontFamily: typography.editorial,
    lineHeight: 21,
  },
  activeBookAuthor: {
    fontSize: 13,
  },
  activeBookPages: {
    fontSize: 12,
    marginTop: 1,
  },
  switchBookText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Sugestões Rápidas de Início
  starterContainer: {
    gap: 12,
  },
  skipTextButton: {
    minHeight: controls.iconButton.height,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
  },
  skipTextLabel: {
    fontSize: 13,
    textDecorationLine: 'underline',
  },

  // Rodapé Docked
  dockedFooter: {
    paddingHorizontal: 24,
    paddingTop: 12,
    width: '100%',
    maxWidth: 528,
    alignSelf: 'center',
    gap: 8,
  },
  replayNote: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 16,
  },
  pressed: controls.buttonPressed,
});
