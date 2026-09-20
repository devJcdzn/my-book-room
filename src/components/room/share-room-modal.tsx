import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { BookCover } from '@/src/components/book-cover';
import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { coverUrlForId } from '@/src/services/open-library';
import { getLastCapturedRoomUri } from '@/src/services/room-snapshot-service';
import {
  computeReadingStats,
  formatReadingStatsSummary,
  shareToInstagramOrSystem,
} from '@/src/services/share-room';
import { useLibraryStore } from '@/src/store/library-store';
import { colors, darkTheme, typography } from '@/src/theme';
import type { Book } from '@/src/types/book';

type Props = {
  visible: boolean;
  onClose: () => void;
  roomSnapshotUri?: string | null;
  onCaptureSnapshot?: (options?: { ambience?: 'day' | 'night' }) => Promise<string | null>;
};

type PendingShare = {
  imageUri?: string;
  message: string;
};

const tapFeedback = (style = Haptics.ImpactFeedbackStyle.Light) => {
  if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(style);
};

const getBookCoverUrl = (book?: Book | null): string | undefined => {
  if (!book) return undefined;
  if (book.coverUrl) return book.coverUrl;
  if (book.coverId) return coverUrlForId(book.coverId);
  return undefined;
};

export function ShareRoomModal({
  visible,
  onClose,
  roomSnapshotUri,
  onCaptureSnapshot,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const books = useLibraryStore((state) => state.books);
  const activeBookId = useLibraryStore((state) => state.activeBookId);
  const profile = useLibraryStore((state) => state.profile);
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);

  const isNightAmbience = resolveAmbience(ambienceMode) === 'night';
  const [cardTheme, setCardTheme] = useState<'day' | 'night'>(isNightAmbience ? 'night' : 'day');
  const [ambienceSnapshots, setAmbienceSnapshots] = useState<{ day?: string | null; night?: string | null }>(() => {
    const initialAmbience = isNightAmbience ? 'night' : 'day';
    const cached = getLastCapturedRoomUri(initialAmbience);
    return cached ? { [initialAmbience]: cached } : {};
  });
  const [isSharing, setIsSharing] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);
  const pendingShareRef = useRef<PendingShare | null>(null);
  const cardRef = useRef<View>(null);

  const activeSnapshotUri =
    getLastCapturedRoomUri(cardTheme) ??
    ambienceSnapshots[cardTheme] ??
    roomSnapshotUri ??
    null;
  const isGeneratingSnapshot = !activeSnapshotUri;

  // Sincroniza a imagem da sala com o tema selecionado (Claro com sol / Noturno com abajur aceso)
  useEffect(() => {
    if (!visible) return;

    const targetAmbience = cardTheme;
    const cached = getLastCapturedRoomUri(targetAmbience) ?? ambienceSnapshots[targetAmbience];

    if (cached || !onCaptureSnapshot) {
      return;
    }

    let isMounted = true;
    onCaptureSnapshot({ ambience: targetAmbience })
      .then((uri) => {
        if (isMounted && uri) {
          setAmbienceSnapshots((prev) => ({ ...prev, [targetAmbience]: uri }));
        }
      })
      .catch((err) => {
        console.warn('Erro ao gerar snapshot do tema da sala:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [visible, cardTheme, onCaptureSnapshot, ambienceSnapshots]);

  const isModalNight = isNightAmbience;
  const modalPalette = {
    background: isModalNight ? darkTheme.bg : colors.cream,
    surface: isModalNight ? darkTheme.surface : colors.paper,
    surfaceElevated: isModalNight ? darkTheme.surfaceElevated : '#FFFFFF',
    text: isModalNight ? darkTheme.text : colors.ink,
    muted: isModalNight ? darkTheme.textMuted : colors.muted,
    border: isModalNight ? darkTheme.border : colors.line,
  };

  const isCardNight = cardTheme === 'night';
  const cardPalette = {
    bg: isCardNight ? '#141622' : '#FAF6EE',
    roomBg: isCardNight ? '#0F111A' : '#EDE4D5',
    border: isCardNight ? 'rgba(255, 255, 255, 0.08)' : 'rgba(50, 37, 31, 0.08)',
    trackBg: isCardNight ? 'rgba(255, 255, 255, 0.10)' : 'rgba(50, 37, 31, 0.08)',
    pulseBg: isCardNight ? 'rgba(255, 174, 112, 0.12)' : 'rgba(182, 90, 61, 0.08)',
    text: isCardNight ? '#FAF4EB' : '#221915',
    muted: isCardNight ? '#989FB3' : '#7C6F64',
    accent: isCardNight ? '#FFAE70' : '#B65A3D',
    shadow: isCardNight
      ? '0 16px 40px rgba(0, 0, 0, 0.55)'
      : '0 16px 40px rgba(50, 37, 31, 0.09)',
  };

  const stats = computeReadingStats(books, profile.name, activeBookId);
  const activeBook = stats.activeBook;
  const readingBooks = stats.readingBooks.length > 0
    ? stats.readingBooks
    : activeBook
      ? [activeBook]
      : [];
  const displayBooks = readingBooks.slice(0, 2);
  const cardWidth = Math.min(324, windowWidth - 44);

  const runPendingShare = async () => {
    const pendingShare = pendingShareRef.current;
    pendingShareRef.current = null;
    if (!pendingShare) return;

    await shareToInstagramOrSystem(pendingShare);
  };

  const shareAfterModalDismiss = (pendingShare: PendingShare) => {
    pendingShareRef.current = pendingShare;
    onClose();

    if (Platform.OS !== 'ios') {
      setTimeout(() => void runPendingShare(), 400);
    }
  };

  const captureCardImage = async (): Promise<string | null> => {
    if (!cardRef.current) return null;
    try {
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 1.0,
        result: 'tmpfile',
      });
      return uri;
    } catch (err) {
      console.warn('Erro ao capturar card de leitura completo via react-native-view-shot:', err);
      return null;
    }
  };

  const handleShareInstagram = async () => {
    tapFeedback(Haptics.ImpactFeedbackStyle.Medium);
    setIsSharing(true);

    try {
      // 1. Tenta capturar o card editorial completo (com stats, capa do livro e sala 3D)
      let imageUri = await captureCardImage();

      // 2. Fallback seguro caso o snapshot do card não esteja disponível
      if (!imageUri) {
        imageUri = activeSnapshotUri ?? getLastCapturedRoomUri(cardTheme);
        if (!imageUri && onCaptureSnapshot) {
          imageUri = await onCaptureSnapshot({ ambience: cardTheme });
          if (imageUri) {
            setAmbienceSnapshots((prev) => ({ ...prev, [cardTheme]: imageUri }));
          }
        }
      }

      const summary = formatReadingStatsSummary(stats);

      shareAfterModalDismiss({
        imageUri: imageUri ?? undefined,
        message: summary,
      });
    } catch (err) {
      console.warn('Erro ao compartilhar nos Stories:', err);
    } finally {
      setIsSharing(false);
    }
  };

  const handleShareOther = async () => {
    tapFeedback();
    setIsSharing(true);
    try {
      // 1. Tenta capturar o card editorial completo (com stats, capa do livro e sala 3D)
      let imageUri = await captureCardImage();

      // 2. Fallback seguro caso o snapshot do card não esteja disponível
      if (!imageUri) {
        imageUri = activeSnapshotUri ?? getLastCapturedRoomUri(cardTheme);
        if (!imageUri && onCaptureSnapshot) {
          imageUri = await onCaptureSnapshot({ ambience: cardTheme });
          if (imageUri) {
            setAmbienceSnapshots((prev) => ({ ...prev, [cardTheme]: imageUri }));
          }
        }
      }

      const summary = formatReadingStatsSummary(stats);

      shareAfterModalDismiss({
        imageUri: imageUri ?? undefined,
        message: summary,
      });
    } catch (err) {
      console.warn('Erro ao compartilhar imagem:', err);
    } finally {
      setIsSharing(false);
    }
  };

  const handleShareSummaryOnly = async () => {
    tapFeedback();
    const summary = formatReadingStatsSummary(stats);
    try {
      const { Clipboard } = await import('react-native');
      Clipboard.setString(summary);
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2500);
    } catch {
      onClose();
      setTimeout(async () => {
        await shareToInstagramOrSystem({ message: summary });
      }, 400);
    }
  };

  return (
    <Modal
      animationType="slide"
      onDismiss={() => void runPendingShare()}
      presentationStyle="pageSheet"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: modalPalette.background }]}>
        {/* Cabeçalho do Modal */}
        <View style={[styles.header, { paddingTop: insets.top > 0 ? insets.top + 6 : 20 }]}>
          <View style={styles.headerLeft}>
            <Text selectable style={[styles.headerTitle, { color: modalPalette.text }]}>
              Compartilhar Refúgio
            </Text>
            <Text selectable style={[styles.headerSubtitle, { color: modalPalette.muted }]}>
              Stories do Instagram & Redes Sociais
            </Text>
          </View>

          <Pressable
            accessibilityLabel="Fechar modal"
            accessibilityRole="button"
            hitSlop={10}
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeBtn,
              { backgroundColor: modalPalette.surface, borderColor: modalPalette.border },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons color={modalPalette.text} name="close" size={20} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 24) + 40 }]}
          showsVerticalScrollIndicator={false}
          bounces={true}
        >
          {/* Seletor de Tema do Card (Claro / Noturno) */}
          <View
            style={[
              styles.themeToggleContainer,
              { backgroundColor: modalPalette.surface, borderColor: modalPalette.border },
            ]}
          >
            <Pressable
              accessibilityHint="Altera visual do card para tema claro com luz do dia"
              accessibilityLabel="Tema claro"
              accessibilityRole="button"
              onPress={() => {
                tapFeedback();
                setCardTheme('day');
              }}
              style={[
                styles.themeToggleBtn,
                cardTheme === 'day' && styles.themeToggleBtnActiveDay,
              ]}
            >
              <Ionicons
                color={cardTheme === 'day' ? colors.ink : modalPalette.muted}
                name="sunny-outline"
                size={14}
              />
              <Text
                style={[
                  styles.themeToggleLabel,
                  { color: cardTheme === 'day' ? colors.ink : modalPalette.muted },
                  cardTheme === 'day' && styles.themeToggleLabelActive,
                ]}
              >
                Claro
              </Text>
            </Pressable>

            <Pressable
              accessibilityHint="Altera visual do card para tema noturno com a luminária acesa"
              accessibilityLabel="Tema noturno"
              accessibilityRole="button"
              onPress={() => {
                tapFeedback();
                setCardTheme('night');
              }}
              style={[
                styles.themeToggleBtn,
                cardTheme === 'night' && styles.themeToggleBtnActiveNight,
              ]}
            >
              <Ionicons
                color={cardTheme === 'night' ? '#FFAE70' : modalPalette.muted}
                name="moon-outline"
                size={14}
              />
              <Text
                style={[
                  styles.themeToggleLabel,
                  { color: cardTheme === 'night' ? '#FAF4EB' : modalPalette.muted },
                  cardTheme === 'night' && styles.themeToggleLabelActive,
                ]}
              >
                Noturno
              </Text>
            </Pressable>
          </View>

          {/* Card Proporcional de Story */}
          <Animated.View
            entering={FadeInDown.duration(340)}
            style={[
              styles.storyCardShadowWrapper,
              {
                boxShadow: cardPalette.shadow,
              },
            ]}
          >
            <View
              ref={cardRef}
              collapsable={false}
              style={[
                styles.storyFrame,
                {
                  width: cardWidth,
                  backgroundColor: cardPalette.bg,
                  borderColor: cardPalette.border,
                },
              ]}
            >
              {/* Topo do Story: Tipografia Editorial Pura */}
            <View style={styles.storyHeader}>
              <Text selectable style={[styles.storyKicker, { color: cardPalette.accent }]}>
                REFÚGIO DE LEITURA
              </Text>
              <Text numberOfLines={1} selectable style={[styles.storyReaderName, { color: cardPalette.text }]}>
                {stats.readerName}
              </Text>
            </View>

            {/* Imagem Completa da Sala 3D com Estado de Carregamento Informativo */}
            <View
              style={[
                styles.storyRoomFrame,
                {
                  backgroundColor: cardPalette.roomBg,
                  borderColor: cardPalette.border,
                },
              ]}
            >
              {isGeneratingSnapshot || !activeSnapshotUri ? (
                <View style={styles.loadingContainer}>
                  <View style={[styles.loadingIconPulse, { backgroundColor: cardPalette.pulseBg }]}>
                    <Ionicons
                      color={cardPalette.accent}
                      name={cardTheme === 'night' ? 'moon' : 'sparkles'}
                      size={22}
                    />
                  </View>
                  <Text style={[styles.loadingTitle, { color: cardPalette.text }]}>
                    {cardTheme === 'night' ? 'Compondo atmosfera noturna...' : 'Renderizando seu refúgio 3D...'}
                  </Text>
                  <Text style={[styles.loadingSubtitle, { color: cardPalette.muted }]}>
                    {cardTheme === 'night'
                      ? 'Acendendo a luminária e harmonizando luzes'
                      : 'Enquadrando estante, mesa e decorações'}
                  </Text>
                  <ActivityIndicator color={cardPalette.accent} style={{ marginTop: 4 }} size="small" />
                </View>
              ) : (
                <Image
                  cachePolicy="memory-disk"
                  contentFit="contain"
                  source={{ uri: activeSnapshotUri }}
                  style={StyleSheet.absoluteFill}
                  transition={250}
                />
              )}
            </View>

            {/* Estatísticas do Leitor (Editorial Minimalista, sem caixas soltas) */}
            <View style={styles.storyStatsRow}>
              <View style={styles.storyStatCol}>
                <Text selectable style={[styles.storyStatNumber, { color: cardPalette.accent }]}>
                  {stats.totalPagesRead.toLocaleString('pt-BR')}
                </Text>
                <Text selectable style={[styles.storyStatLabel, { color: cardPalette.muted }]}>
                  páginas lidas
                </Text>
              </View>

              <View style={[styles.storyStatDivider, { backgroundColor: cardPalette.border }]} />

              <View style={styles.storyStatCol}>
                <Text selectable style={[styles.storyStatNumber, { color: cardPalette.accent }]}>
                  {stats.completedCount}
                </Text>
                <Text selectable style={[styles.storyStatLabel, { color: cardPalette.muted }]}>
                  {stats.completedCount === 1 ? 'livro lido' : 'livros lidos'}
                </Text>
              </View>
            </View>

            {/* Livros em Leitura (Tipografia Limpa Integrada, sem containers pesados) */}
            {displayBooks.length > 0 ? (
              <View style={[styles.storyBooksList, { borderTopColor: cardPalette.border }]}>
                {displayBooks.map((book) => {
                  const coverUrl = getBookCoverUrl(book);
                  const bookProgress = book.totalPages > 0
                    ? (book.status === 'completed'
                      ? 100
                      : Math.min(100, Math.max(0, Math.round((book.currentPage / book.totalPages) * 100))))
                    : 0;

                  return (
                    <View key={book.id} style={styles.storyActiveBook}>
                      <BookCover
                        color={book.coverColor}
                        coverUrl={coverUrl}
                        style={styles.miniCover}
                      >
                        {!coverUrl ? (
                          <Ionicons color="rgba(255,255,255,0.92)" name="book-outline" size={14} />
                        ) : null}
                      </BookCover>

                      <View style={styles.storyBookCopy}>
                        <View style={styles.storyBookHeaderRow}>
                          <Text numberOfLines={1} selectable style={[styles.storyBookTitle, { color: cardPalette.text }]}>
                            {book.title}
                          </Text>
                          <Text style={[styles.storyBookPercent, { color: cardPalette.accent }]}>
                            {bookProgress}%
                          </Text>
                        </View>

                        <Text numberOfLines={1} selectable style={[styles.storyBookAuthor, { color: cardPalette.muted }]}>
                          {book.author || 'Autor registrado'}
                        </Text>

                        <View style={[styles.miniProgressBarTrack, { backgroundColor: cardPalette.trackBg }]}>
                          <View
                            style={[
                              styles.miniProgressBarFill,
                              {
                                width: `${Math.max(4, bookProgress)}%`,
                                backgroundColor: cardPalette.accent,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    </View>
                  );
                })}
                {readingBooks.length > 2 ? (
                  <Text style={[styles.extraReadingText, { color: cardPalette.muted }]}>
                    +{readingBooks.length - 2} outro{readingBooks.length - 2 > 1 ? 's' : ''} em leitura
                  </Text>
                ) : null}
              </View>
            ) : null}

            {/* Assinatura Tipográfica Minimalista */}
            <View style={styles.storyFooter}>
              <Text selectable style={[styles.storyFooterBrand, { color: cardPalette.muted }]}>
                BOOKROOM
              </Text>
            </View>
          </View>
        </Animated.View>

          {/* Botões de Ação */}
          <View style={[styles.actionsContainer, { width: cardWidth }]}>
            {/* Botão Primário Instagram Stories */}
            <Pressable
              accessibilityHint="Abre o Instagram para postar diretamente nos Stories"
              accessibilityLabel="Compartilhar nos Stories"
              accessibilityRole="button"
              disabled={isSharing || isGeneratingSnapshot}
              onPress={handleShareInstagram}
              style={({ pressed }) => [
                styles.instagramBtn,
                pressed && styles.pressed,
                (isSharing || isGeneratingSnapshot) && styles.btnDisabled,
              ]}
            >
              {isSharing ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <>
                  <Ionicons color={colors.white} name="logo-instagram" size={20} />
                  <Text selectable style={styles.instagramBtnText}>
                    Compartilhar nos Stories
                  </Text>
                </>
              )}
            </Pressable>

            {/* Botão Secundário: Outros Apps */}
            <Pressable
              accessibilityHint="Salva a imagem na galeria ou compartilha em outros apps como WhatsApp"
              accessibilityLabel="Salvar imagem ou outros apps"
              accessibilityRole="button"
              disabled={isSharing || isGeneratingSnapshot}
              onPress={handleShareOther}
              style={({ pressed }) => [
                styles.outlineBtn,
                {
                  borderColor: modalPalette.border,
                  backgroundColor: modalPalette.surfaceElevated,
                },
                pressed && styles.pressed,
                (isSharing || isGeneratingSnapshot) && styles.btnDisabled,
              ]}
            >
              <Ionicons color={modalPalette.text} name="share-outline" size={18} />
              <Text selectable style={[styles.outlineBtnText, { color: modalPalette.text }]}>
                Salvar Imagem / Outros Apps
              </Text>
            </Pressable>

            {/* Ação Terciária: Copiar Texto */}
            <Pressable
              accessibilityHint="Copia as estatísticas formatadas em texto"
              accessibilityLabel="Copiar resumo de leitura"
              accessibilityRole="button"
              onPress={handleShareSummaryOnly}
              style={styles.copyTextBtn}
            >
              <Ionicons
                color={copiedNotification ? '#3C8A52' : modalPalette.muted}
                name={copiedNotification ? 'checkmark-circle' : 'copy-outline'}
                size={16}
              />
              <Text
                selectable
                style={[
                  styles.copyTextLabel,
                  { color: copiedNotification ? '#3C8A52' : modalPalette.muted },
                ]}
              >
                {copiedNotification ? 'Resumo copiado com sucesso!' : 'Copiar resumo de leitura em texto'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingBottom: 10,
  },
  headerLeft: {
    gap: 2,
  },
  headerTitle: {
    fontFamily: typography.editorial,
    fontSize: 24,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 13,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 18,
    gap: 12,
  },

  // Seletor de Tema do Story (Claro / Noturno)
  themeToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: 20,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  themeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
    borderCurve: 'continuous',
  },
  themeToggleBtnActiveDay: {
    backgroundColor: '#FFFFFF',
    boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
  },
  themeToggleBtnActiveNight: {
    backgroundColor: '#262A3E',
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
  },
  themeToggleLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  themeToggleLabelActive: {
    fontWeight: '700',
  },

  // Story Card Proporcional - Design Minimalista Editorial
  storyCardShadowWrapper: {
    borderRadius: 24,
    borderCurve: 'continuous',
  },
  storyFrame: {
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: 16,
    gap: 12,
    overflow: 'hidden',
  },
  storyHeader: {
    alignItems: 'center',
    gap: 3,
    paddingTop: 2,
  },
  storyKicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  storyReaderName: {
    fontFamily: typography.editorial,
    fontSize: 21,
    fontWeight: '700',
  },

  // Frame Central da Sala 3D
  storyRoomFrame: {
    width: '100%',
    aspectRatio: 1.14,
    borderRadius: 16,
    borderCurve: 'continuous',
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },

  // Loading Informativo
  loadingContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 5,
  },
  loadingIconPulse: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  loadingTitle: {
    fontFamily: typography.editorial,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
  },

  // Estatísticas em Colunas Abertas (Zero Caixas/AI Slop)
  storyStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  storyStatCol: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
  },
  storyStatDivider: {
    width: 1,
    height: 26,
    opacity: 0.7,
  },
  storyStatNumber: {
    fontFamily: typography.editorial,
    fontSize: 22,
    fontWeight: '700',
  },
  storyStatLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.2,
  },

  // Leitura Ativa (Design Editorial Integrado)
  storyBooksList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    gap: 8,
  },
  storyActiveBook: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 2,
  },
  extraReadingText: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 2,
  },
  miniCover: {
    width: 32,
    height: 44,
    borderRadius: 4,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
  },
  storyBookCopy: {
    flex: 1,
    gap: 2,
  },
  storyBookHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  storyBookTitle: {
    flex: 1,
    fontFamily: typography.editorial,
    fontSize: 13,
    fontWeight: '600',
  },
  storyBookPercent: {
    fontSize: 11,
    fontWeight: '700',
  },
  storyBookAuthor: {
    fontSize: 11,
  },
  miniProgressBarTrack: {
    width: '100%',
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
    marginTop: 3,
  },
  miniProgressBarFill: {
    height: '100%',
    borderRadius: 1.5,
  },

  // Rodapé do Story (Assinatura Editorial)
  storyFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
  },
  storyFooterBrand: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2.8,
    opacity: 0.75,
  },

  // Ações no Final do Scroll
  actionsContainer: {
    gap: 10,
    marginTop: 4,
  },
  instagramBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E1306C',
    height: 50,
    borderRadius: 25,
    borderCurve: 'continuous',
    boxShadow: '0 6px 20px rgba(225, 48, 108, 0.30)',
  },
  instagramBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  outlineBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  outlineBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  copyTextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 2,
  },
  copyTextLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.65,
  },
  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.985 }],
  },
});
