import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useGlobalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/src/components/primary-button';
import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { useLibraryStore, type AmbienceMode } from '@/src/store/library-store';
import { colors, darkTheme, radii, typography } from '@/src/theme';

const TOTAL_STEPS = 4;

const HERO_IMAGE = require('@/assets/images/onboarding-hero.jpg');
const DESK_IMAGE = require('@/assets/images/onboarding-desk.jpg');
const WINDOW_IMAGE = require('@/assets/images/onboarding-window.jpg');

const STARTER_BOOKS = [
  {
    title: 'O Pequeno Príncipe',
    author: 'Antoine de Saint-Exupéry',
    coverColor: '#243A4E',
    totalPages: 96,
  },
  {
    title: 'Dom Casmurro',
    author: 'Machado de Assis',
    coverColor: '#365343',
    totalPages: 256,
  },
  {
    title: '1984',
    author: 'George Orwell',
    coverColor: '#843C28',
    totalPages: 326,
  },
] as const;

const AMBIENCE_OPTIONS: {
  id: AmbienceMode;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    id: 'auto',
    label: 'Automático',
    description: 'Acompanha a luz natural do dia e da noite em tempo real.',
    icon: 'time-outline',
  },
  {
    id: 'day',
    label: 'Dia',
    description: 'Claridade suave e foco para suas manhãs de leitura.',
    icon: 'sunny-outline',
  },
  {
    id: 'sunset',
    label: 'Pôr do sol',
    description: 'Luz dourada e tons acolhedores para desacelerar.',
    icon: 'partly-sunny-outline',
  },
  {
    id: 'night',
    label: 'Noite',
    description: 'Imersão calma com a luminária acesa na sala.',
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
  const { from } = useGlobalSearchParams<{ from?: string }>();
  const profile = useLibraryStore((state) => state.profile);
  const books = useLibraryStore((state) => state.books);
  const onboardingStep = useLibraryStore((state) => state.onboardingStep);
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const setAmbienceMode = useLibraryStore((state) => state.setAmbienceMode);
  const updateProfile = useLibraryStore((state) => state.updateProfile);
  const setOnboardingStep = useLibraryStore((state) => state.setOnboardingStep);
  const completeOnboarding = useLibraryStore((state) => state.completeOnboarding);
  const skipOnboarding = useLibraryStore((state) => state.skipOnboarding);
  const addCustomBook = useLibraryStore((state) => state.addCustomBook);

  const initialBookCount = useRef(books.length);
  const activationStarted = useRef(false);
  const step = Math.min(3, Math.max(0, onboardingStep));
  const [name, setName] = useState(profile.name === 'Leitor(a)' ? '' : profile.name);
  const [isReady, setIsReady] = useState(false);

  const isNight = resolveAmbience(ambienceMode) === 'night';
  const palette = {
    background: isNight ? darkTheme.bg : colors.cream,
    surface: isNight ? darkTheme.surface : colors.paper,
    surfaceSelected: isNight ? darkTheme.surfaceElevated : '#FFFFFF',
    text: isNight ? darkTheme.text : colors.ink,
    textSoft: isNight ? '#D1D6E2' : colors.inkSoft,
    muted: isNight ? darkTheme.textMuted : colors.muted,
    border: isNight ? darkTheme.border : colors.line,
    accent: isNight ? '#FFAE70' : colors.terracotta,
  };

  useEffect(() => {
    if (step === 3 && books.length > initialBookCount.current && !activationStarted.current) {
      activationStarted.current = true;
      completeOnboarding();
      setIsReady(true);
      const timer = setTimeout(() => router.replace('/'), 900);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [books.length, completeOnboarding, step]);

  const goToStep = (nextStep: number) => {
    tapFeedback();
    setOnboardingStep(nextStep);
  };

  const handleNext = () => {
    if (step === 1) {
      const normalizedName = name.trim();
      if (!normalizedName) return;
      updateProfile({ name: normalizedName });
    }

    if (step < 3) {
      goToStep(step + 1);
      return;
    }

    if (books.length > 0) {
      notifySuccess();
      completeOnboarding();
      router.replace('/');
    } else {
      tapFeedback();
      router.push({ pathname: '/add-book', params: { from: 'onboarding' } });
    }
  };

  const handleBack = () => {
    if (step === 0) return;
    goToStep(step - 1);
  };

  const handleSkip = () => {
    const skip = () => {
      skipOnboarding();
      router.replace('/');
    };

    if (step === 3 && books.length === 0) {
      Alert.alert(
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

  const handleQuickAddBook = (book: typeof STARTER_BOOKS[number]) => {
    tapFeedback(Haptics.ImpactFeedbackStyle.Medium);
    addCustomBook({
      title: book.title,
      author: book.author,
      coverColor: book.coverColor,
      totalPages: book.totalPages,
    });
  };

  if (isReady) {
    return (
      <View style={[styles.readyScreen, { backgroundColor: palette.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Animated.View entering={FadeIn.duration(380)} style={styles.readyContent}>
          <View style={[styles.readyIcon, { backgroundColor: palette.accent }]}>
            <Ionicons color={colors.white} name="checkmark" size={36} />
          </View>
          <Text selectable style={[styles.readyTitle, { color: palette.text }]}>
            Sua sala está pronta
          </Text>
          <Text selectable style={[styles.readySubtitle, { color: palette.muted }]}>
            Seu refúgio de leitura foi criado. Bem-vindo ao Bookroom!
          </Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      {/* Top Bar Minimalista */}
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        {step > 0 ? (
          <Pressable
            accessibilityLabel="Voltar uma etapa"
            accessibilityRole="button"
            hitSlop={12}
            onPress={handleBack}
            style={styles.navButton}
          >
            <Ionicons color={palette.text} name="arrow-back" size={22} />
          </Pressable>
        ) : (
          <View style={styles.navButtonPlaceholder} />
        )}

        <View accessibilityLabel={`Etapa ${step + 1} de ${TOTAL_STEPS}`} style={styles.progressRow}>
          {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressTrack,
                {
                  backgroundColor: index <= step ? palette.accent : palette.border,
                  opacity: index === step ? 1 : index < step ? 0.75 : 0.35,
                },
              ]}
            />
          ))}
        </View>

        <Pressable
          accessibilityLabel="Pular onboarding"
          accessibilityRole="button"
          hitSlop={12}
          onPress={handleSkip}
          style={styles.skipButton}
        >
          <Text selectable style={[styles.skipLabel, { color: palette.muted }]}>
            Pular
          </Text>
        </Pressable>
      </View>

      {/* Área Central com Rolagem e Foco */}
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            key={step}
            entering={FadeInRight.duration(200)}
            exiting={FadeOutLeft.duration(140)}
            style={styles.stepContainer}
          >
            {/* ETAPA 0: O REFÚGIO DE LEITURA */}
            {step === 0 && (
              <View style={styles.stepBlock}>
                <View style={[styles.heroImageFrame, { borderColor: palette.border }]}>
                  <Image
                    cachePolicy="memory-disk"
                    contentFit="cover"
                    source={HERO_IMAGE}
                    style={StyleSheet.absoluteFill}
                    transition={180}
                  />
                </View>

                <View style={styles.headerBlock}>
                  <Text selectable style={[styles.title, { color: palette.text }]}>
                    Seu refúgio de leitura
                  </Text>
                  <Text selectable style={[styles.subtitle, { color: palette.muted }]}>
                    Uma biblioteca pessoal silenciosa para organizar livros, registrar páginas e cultivar o hábito com calma.
                  </Text>
                </View>

                {/* Lista Minimalista de Benefícios (Sem cards pesados) */}
                <View style={styles.minimalList}>
                  <View style={[styles.minimalRow, { borderBottomColor: palette.border }]}>
                    <Ionicons color={palette.accent} name="book-outline" size={19} style={styles.minimalIcon} />
                    <View style={styles.minimalCopy}>
                      <Text selectable style={[styles.minimalTitle, { color: palette.text }]}>
                        Biblioteca pessoal
                      </Text>
                      <Text selectable style={[styles.minimalDesc, { color: palette.muted }]}>
                        Guarde leituras atuais, desejadas e concluídas em um só lugar.
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.minimalRow, { borderBottomColor: palette.border }]}>
                    <Ionicons color={palette.accent} name="time-outline" size={19} style={styles.minimalIcon} />
                    <View style={styles.minimalCopy}>
                      <Text selectable style={[styles.minimalTitle, { color: palette.text }]}>
                        Ritmo sem pressa
                      </Text>
                      <Text selectable style={[styles.minimalDesc, { color: palette.muted }]}>
                        Atualize páginas de onde parou e acompanhe seu progresso natural.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.minimalRow}>
                    <Ionicons color={palette.accent} name="cube-outline" size={19} style={styles.minimalIcon} />
                    <View style={styles.minimalCopy}>
                      <Text selectable style={[styles.minimalTitle, { color: palette.text }]}>
                        Sua sala 3D
                      </Text>
                      <Text selectable style={[styles.minimalDesc, { color: palette.muted }]}>
                        Um espaço aconchegante que reflete cada livro lido.
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* ETAPA 1: NOME DO LEITOR */}
            {step === 1 && (
              <View style={styles.stepBlock}>
                <View style={styles.headerBlock}>
                  <Text selectable style={[styles.title, { color: palette.text }]}>
                    Como podemos chamar você?
                  </Text>
                  <Text selectable style={[styles.subtitle, { color: palette.muted }]}>
                    Seu nome aparecerá no seu perfil e no seu espaço de leitura.
                  </Text>
                </View>

                <View style={styles.formGroup}>
                  <Text selectable style={[styles.fieldLabel, { color: palette.text }]}>
                    Seu nome
                  </Text>
                  <View style={[styles.inputWrapper, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                    <TextInput
                      accessibilityLabel="Seu nome"
                      autoCapitalize="words"
                      autoFocus
                      maxLength={40}
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
                  <Text selectable style={[styles.helperCaption, { color: palette.muted }]}>
                    Você poderá mudar isso no seu perfil a qualquer momento.
                  </Text>
                </View>
              </View>
            )}

            {/* ETAPA 2: CLIMA DA SALA */}
            {step === 2 && (
              <View style={styles.stepBlock}>
                <View style={[styles.bannerImageFrame, { borderColor: palette.border }]}>
                  <Image
                    cachePolicy="memory-disk"
                    contentFit="cover"
                    source={WINDOW_IMAGE}
                    style={StyleSheet.absoluteFill}
                    transition={180}
                  />
                </View>

                <View style={styles.headerBlock}>
                  <Text selectable style={[styles.title, { color: palette.text }]}>
                    Escolha o clima da sala
                  </Text>
                  <Text selectable style={[styles.subtitle, { color: palette.muted }]}>
                    A atmosfera define a iluminação e as cores do seu espaço 3D.
                  </Text>
                </View>

                {/* Opções Limpas e Minimalistas */}
                <View style={styles.optionsStack}>
                  {AMBIENCE_OPTIONS.map((opt) => {
                    const isSelected = ambienceMode === opt.id;
                    return (
                      <Pressable
                        key={opt.id}
                        accessibilityLabel={`Atmosfera ${opt.label}`}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => {
                          tapFeedback();
                          setAmbienceMode(opt.id);
                        }}
                        style={({ pressed }) => [
                          styles.optionRow,
                          {
                            backgroundColor: isSelected ? palette.surfaceSelected : palette.surface,
                            borderColor: isSelected ? palette.accent : palette.border,
                          },
                          isSelected && styles.optionRowSelected,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Ionicons
                          color={isSelected ? palette.accent : palette.muted}
                          name={opt.icon}
                          size={20}
                          style={styles.optionIcon}
                        />

                        <View style={styles.optionCopy}>
                          <Text selectable style={[styles.optionTitle, { color: palette.text }]}>
                            {opt.label}
                          </Text>
                          <Text selectable style={[styles.optionDesc, { color: palette.muted }]}>
                            {opt.description}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.radioCircle,
                            {
                              borderColor: isSelected ? palette.accent : palette.border,
                            },
                          ]}
                        >
                          {isSelected && <View style={[styles.radioDot, { backgroundColor: palette.accent }]} />}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ETAPA 3: LEITURA NA MESA */}
            {step === 3 && (
              <View style={styles.stepBlock}>
                <View style={[styles.bannerImageFrame, { borderColor: palette.border }]}>
                  <Image
                    cachePolicy="memory-disk"
                    contentFit="cover"
                    source={DESK_IMAGE}
                    style={StyleSheet.absoluteFill}
                    transition={180}
                  />
                </View>

                <View style={styles.headerBlock}>
                  <Text selectable style={[styles.title, { color: palette.text }]}>
                    Coloque uma leitura na mesa
                  </Text>
                  <Text selectable style={[styles.subtitle, { color: palette.muted }]}>
                    O livro em andamento repousa aberto sobre a mesa da sala 3D.
                  </Text>
                </View>

                {books.length > 0 && books[0] ? (
                  <View style={styles.activeBookContainer}>
                    <View style={[styles.activeBookCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                      <View style={[styles.activeBookCover, { backgroundColor: books[0].coverColor }]}>
                        <Ionicons color="rgba(255,255,255,0.92)" name="book-outline" size={22} />
                      </View>
                      <View style={styles.activeBookCopy}>
                        <Text numberOfLines={1} selectable style={[styles.activeBookTitle, { color: palette.text }]}>
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

                    <Pressable
                      accessibilityLabel="Trocar livro"
                      accessibilityRole="button"
                      hitSlop={10}
                      onPress={() => {
                        tapFeedback();
                        router.push({ pathname: '/add-book', params: { from: 'onboarding' } });
                      }}
                      style={styles.switchBookBtn}
                    >
                      <Ionicons color={palette.accent} name="search-outline" size={16} />
                      <Text selectable style={[styles.switchBookText, { color: palette.accent }]}>
                        Buscar outro livro no catálogo
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.starterContainer}>
                    <Text selectable style={[styles.starterHeading, { color: palette.textSoft }]}>
                      Sugestões para começar com 1 toque:
                    </Text>

                    <View style={styles.starterList}>
                      {STARTER_BOOKS.map((book) => (
                        <Pressable
                          key={book.title}
                          accessibilityLabel={`Adicionar ${book.title}`}
                          accessibilityRole="button"
                          onPress={() => handleQuickAddBook(book)}
                          style={({ pressed }) => [
                            styles.starterRow,
                            { backgroundColor: palette.surface, borderColor: palette.border },
                            pressed && styles.pressed,
                          ]}
                        >
                          <View style={[styles.starterColorDot, { backgroundColor: book.coverColor }]} />
                          <View style={styles.starterCopy}>
                            <Text numberOfLines={1} selectable style={[styles.starterTitle, { color: palette.text }]}>
                              {book.title}
                            </Text>
                            <Text numberOfLines={1} selectable style={[styles.starterAuthor, { color: palette.muted }]}>
                              {book.author} • {book.totalPages} págs.
                            </Text>
                          </View>
                          <Ionicons color={palette.accent} name="add-circle-outline" size={21} />
                        </Pressable>
                      ))}
                    </View>

                    <Pressable
                      accessibilityLabel="Buscar no catálogo"
                      accessibilityRole="button"
                      onPress={() => {
                        tapFeedback();
                        router.push({ pathname: '/add-book', params: { from: 'onboarding' } });
                      }}
                      style={({ pressed }) => [
                        styles.catalogOutlineBtn,
                        { borderColor: palette.border, backgroundColor: palette.surface },
                        pressed && styles.pressed,
                      ]}
                    >
                      <Ionicons color={palette.text} name="search-outline" size={17} />
                      <Text selectable style={[styles.catalogOutlineText, { color: palette.text }]}>
                        Buscar no catálogo ou cadastrar livro
                      </Text>
                    </Pressable>

                    <Pressable
                      accessibilityLabel="Entrar na sala primeiro"
                      accessibilityRole="button"
                      hitSlop={10}
                      onPress={handleSkip}
                      style={styles.skipTextButton}
                    >
                      <Text selectable style={[styles.skipTextLabel, { color: palette.muted }]}>
                        Explorar a sala sem livro por enquanto
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Rodapé Docked Fixo */}
      <View
        style={[
          styles.dockedFooter,
          {
            backgroundColor: palette.background,
            paddingBottom: Math.max(insets.bottom, 16),
          },
        ]}
      >
        <PrimaryButton
          disabled={step === 1 && !name.trim()}
          label={
            step === 0
              ? 'Começar'
              : step === 3
                ? books.length > 0
                  ? 'Entrar no meu refúgio'
                  : 'Buscar no catálogo'
                : 'Continuar'
          }
          onPress={handleNext}
        />
        {from === 'profile' ? (
          <Text selectable style={[styles.replayNote, { color: palette.muted }]}>
            Suas leituras e preferências atuais serão preservadas.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// --- ESTILOS VISUAIS MINIMALISTAS ---

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 6,
    paddingBottom: 24,
  },
  readyScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  readyContent: {
    alignItems: 'center',
    gap: 16,
    maxWidth: 320,
  },
  readyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyTitle: {
    fontFamily: typography.editorial,
    fontSize: 32,
    fontWeight: '600',
    lineHeight: 38,
    textAlign: 'center',
  },
  readySubtitle: {
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
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
  navButton: {
    width: 36,
    height: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  navButtonPlaceholder: {
    width: 36,
    height: 36,
  },
  skipButton: {
    minWidth: 36,
    minHeight: 36,
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
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
  },
  stepContainer: {
    paddingTop: 4,
  },
  stepBlock: {
    gap: 20,
  },
  headerBlock: {
    gap: 6,
  },
  title: {
    fontFamily: typography.editorial,
    fontSize: 30,
    fontWeight: '600',
    lineHeight: 36,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    maxWidth: 340,
  },

  // Imagens Frames
  heroImageFrame: {
    width: '100%',
    height: 164,
    borderRadius: radii.large,
    borderCurve: 'continuous',
    borderWidth: 1,
    overflow: 'hidden',
    boxShadow: '0 6px 20px rgba(50, 37, 31, 0.08)',
  },
  bannerImageFrame: {
    width: '100%',
    height: 124,
    borderRadius: radii.large,
    borderCurve: 'continuous',
    borderWidth: 1,
    overflow: 'hidden',
    boxShadow: '0 6px 18px rgba(50, 37, 31, 0.07)',
  },

  // Etapa 0: Lista Minimalista (Sem cards pesados)
  minimalList: {
    gap: 2,
    paddingTop: 4,
  },
  minimalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  minimalIcon: {
    marginTop: 2,
  },
  minimalCopy: {
    flex: 1,
    gap: 2,
  },
  minimalTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  minimalDesc: {
    fontSize: 13,
    lineHeight: 18,
  },

  // Etapa 1: Formulário Nome
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
    paddingHorizontal: 16,
    minHeight: 52,
  },
  input: {
    flex: 1,
    fontSize: 17,
    paddingVertical: 12,
  },
  clearBtn: {
    padding: 4,
  },
  helperCaption: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },

  // Etapa 2: Clima da Sala
  optionsStack: {
    gap: 9,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 15,
    paddingVertical: 13,
    borderWidth: 1,
    borderRadius: radii.medium,
    borderCurve: 'continuous',
  },
  optionRowSelected: {
    boxShadow: '0 2px 8px rgba(50, 37, 31, 0.05)',
  },
  optionIcon: {
    width: 24,
    textAlign: 'center',
  },
  optionCopy: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  optionDesc: {
    fontSize: 13,
    lineHeight: 17,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

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
    width: 46,
    height: 64,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBookCopy: {
    flex: 1,
    gap: 2,
  },
  activeBookTitle: {
    fontFamily: typography.editorial,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 21,
  },
  activeBookAuthor: {
    fontSize: 13,
  },
  activeBookPages: {
    fontSize: 12,
    marginTop: 1,
  },
  switchBookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  switchBookText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Sugestões Rápidas de Início
  starterContainer: {
    gap: 12,
  },
  starterHeading: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  starterList: {
    gap: 7,
  },
  starterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderRadius: radii.medium,
    borderCurve: 'continuous',
  },
  starterColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  starterCopy: {
    flex: 1,
    gap: 2,
  },
  starterTitle: {
    fontFamily: typography.editorial,
    fontSize: 15,
    fontWeight: '600',
  },
  starterAuthor: {
    fontSize: 12,
  },
  catalogOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderWidth: 1,
    borderRadius: radii.medium,
    borderCurve: 'continuous',
    marginTop: 2,
  },
  catalogOutlineText: {
    fontSize: 14,
    fontWeight: '600',
  },
  skipTextButton: {
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
    paddingTop: 10,
    gap: 8,
  },
  replayNote: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 16,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.985 }],
  },
});
