import { AuthActions } from '@/src/components/auth-actions';
import { BookCover } from '@/src/components/book-cover';
import { LibrarySheet } from '@/src/components/library-sheet';
import { ProfileAvatar } from '@/src/components/profile-avatar';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { resolveAmbience } from '@/src/types/ambience';
import { ShareRoomModal } from '@/src/components/room/share-room-modal';
import { captureRoomSnapshot, getLastCapturedRoomUri } from '@/src/services/room-snapshot-service';
import { useLibraryStore } from '@/src/store/library-store';
import { controls, colors, darkTheme, radii, typography } from '@/src/theme';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const books = useLibraryStore((state) => state.books);
  const favoriteBookIds = useLibraryStore((state) => state.favoriteBookIds);
  const toggleFavoriteBook = useLibraryStore((state) => state.toggleFavoriteBook);
  const favoriteBooks = favoriteBookIds.flatMap((id) => books.find((book) => book.id === id) ?? []);
  const [favoritePickerOpen, setFavoritePickerOpen] = useState(false);
  const profile = useLibraryStore((state) => state.profile);
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);

  const completedBooks = books.filter((book) => book.status === 'completed').length;
  const totalPagesRead = books.reduce((sum, book) => sum + book.currentPage, 0);
  const noteCount = books.reduce((sum, book) => sum + (book.readingEntries?.length ?? 0), 0);
  const isNight = resolveAmbience(ambienceMode) === 'night';
  const accent = isNight ? darkTheme.selectionText : colors.sageDark;
  const selection = isNight ? darkTheme.selection : colors.sageSoft;
  const pageBackground = isNight ? darkTheme.bg : colors.cream;
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const handleOpenShare = () => {
    if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsShareModalOpen(true);
  };

  return (
    <>
      <StatusBar style={isNight ? 'light' : 'dark'} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        style={[styles.screen, { backgroundColor: pageBackground }]}
      >
        <View style={[styles.hero, { paddingTop: process.env.EXPO_OS === 'ios' ? 18 : insets.top + 18 }]}>
          <Image source={require('@/assets/images/profile-header.png')} contentFit="cover" contentPosition="bottom" style={StyleSheet.absoluteFill} />
          {isNight ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.heroNightOverlay]} /> : null}
          <View style={styles.heroHeading}>
            <View style={styles.heroCopy}>
              <Text accessibilityRole="header" style={[styles.heroTitle, isNight && styles.darkTitle]}>Perfil</Text>
              <Text style={[styles.heroSubtitle, isNight && styles.darkMutedText]}>Seu cantinho de leitura</Text>
            </View>
            <Pressable accessibilityLabel="Configurações" accessibilityRole="button" onPress={() => router.navigate('/settings')} style={({ pressed }) => [styles.gearButton, isNight && styles.nightCard, pressed && styles.pressed]}>
              <Ionicons name="settings-outline" size={25} color={accent} />
            </Pressable>
          </View>
        </View>
        <View style={styles.body}>
          <View style={[styles.profileCard, isNight && styles.nightCard]}>
            <View style={styles.profileRow}>
              <ProfileAvatar avatar={profile.avatar} name={profile.name} fallbackColor={selection} fallbackTextColor={accent} />
              <View style={styles.profileInfo}>
                <Text numberOfLines={2} selectable style={[styles.name, isNight && styles.darkTitle]}>{profile.name}</Text>
              </View>
              <Pressable accessibilityLabel="Editar perfil" accessibilityRole="button" onPress={() => router.navigate('/edit-profile')} style={({ pressed }) => [styles.editButton, isNight && styles.editButtonNight, pressed && styles.pressed]}>
                <Ionicons name="pencil-outline" size={20} color={accent} />
              </Pressable>
            </View>

            {profile.bio ? (
              <View style={[styles.quoteWrap, isNight && styles.darkDividerTop]}>
                <Text selectable style={[styles.quoteText, isNight && styles.darkTitle]}>“{profile.bio}”</Text>
                {profile.bioAttribution ? (
                  <Text selectable style={[styles.quoteAuthor, isNight && styles.darkMutedText]}>— {profile.bioAttribution}</Text>
                ) : null}
              </View>
            ) : null}
          </View>

          <AuthActions isNight={isNight} accentColor={accent} />

          <View style={[styles.journeySection, isNight && styles.journeySectionNight]}>
            <View style={styles.journeyHeading}>
              <Text style={[styles.sectionTitle, styles.journeyTitle, isNight && styles.journeyTitleNight]}>Minha jornada</Text>
              <Text style={[styles.sectionDescription, styles.journeyDescription, isNight && styles.journeyDescriptionNight]}>Seu progresso de leitura até agora.</Text>
            </View>
            <View style={styles.journeyCard}>
              <View style={[styles.pagesCard, { backgroundColor: selection }]}>
                <View style={[styles.pagesIcon, { backgroundColor: isNight ? darkTheme.surface : colors.paper }]}>
                  <Ionicons color={accent} name="book-outline" size={20} />
                </View>
                <View style={styles.pagesCopy}>
                  <Text style={[styles.pagesLabel, isNight && styles.journeyMutedNight]}>Páginas lidas</Text>
                  <Text selectable style={[styles.pagesValue, isNight && styles.journeyValueNight]}>{totalPagesRead.toLocaleString('pt-BR')}</Text>
                </View>
              </View>

              <View style={[styles.metricsRow, fontScale > 1.3 && styles.metricsStack]}>
                <Metric icon="checkmark-done-outline" isNight={isNight} label="livros concluídos" value={completedBooks} />

                <Metric icon="library-outline" isNight={isNight} label="no acervo" value={books.length} />

                <Metric icon="journal-outline" isNight={isNight} label="notas" value={noteCount} />
              </View>
            </View>
          </View>

          <View style={styles.favoritesSection}>
            <Text style={[styles.sectionTitle, isNight && styles.darkTitle]}>Livros favoritos</Text>
            <View style={styles.favoriteSlots}>
              {Array.from({ length: 3 }, (_, index) => {
                const book = favoriteBooks[index];
                return (
                  <View key={index} style={styles.favoriteSlotWrap}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={book ? `Abrir ${book.title}` : `Adicionar livro favorito ${index + 1}`}
                      onPress={() => book ? router.navigate({ pathname: '/book-progress', params: { bookId: book.id } }) : setFavoritePickerOpen(true)}
                      style={({ pressed }) => [styles.favoriteSlot, !book && { borderWidth: 1, borderStyle: 'dashed', borderColor: isNight ? darkTheme.border : colors.line, backgroundColor: isNight ? darkTheme.surface : colors.paper }, pressed && styles.pressed]}
                    >
                      {book ? <BookCover color={book.coverColor} coverUrl={book.coverUrl} style={styles.favoriteCover} /> : <Ionicons name="add" size={26} color={accent} />}
                    </Pressable>
                    {book ? (
                      <Pressable accessibilityRole="button" accessibilityLabel={`Remover ${book.title} dos favoritos`} hitSlop={6} onPress={() => toggleFavoriteBook(book.id)} style={[styles.removeFavorite, { backgroundColor: isNight ? darkTheme.surface : colors.paper }]}>
                        <Ionicons name="close" size={16} color={isNight ? darkTheme.text : colors.ink} />
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
            <View style={styles.favoriteShelf}>
              <Image source={require('@/assets/images/library-shelf.png')} contentFit="fill" style={[styles.favoriteWood, isNight && { opacity: 0.72 }]} accessibilityIgnoresInvertColors />
            </View>
          </View>

          <Pressable
            accessibilityHint="Gera uma imagem da sala e do progresso de leitura para compartilhar"
            accessibilityLabel="Compartilhar Refúgio"
            accessibilityRole="button"
            onPress={handleOpenShare}
            style={({ pressed }) => [styles.shareCard, isNight && styles.shareCardNight, pressed && styles.pressed]}
          >
            <View pointerEvents="none" style={styles.shareArtwork}>
              <Image source={require('@/assets/images/profile-share-art.png')} contentFit="contain" style={styles.shareImage} />
            </View>
            <View style={styles.shareTextWrap}>
              <Text style={styles.shareTitle}>Compartilhar Refúgio</Text>
              <Text style={styles.shareSubtitle}>Sua sala, seus livros e seu progresso.</Text>
            </View>
            <View style={styles.shareArrow}>
              <Ionicons color={colors.paper} name="chevron-forward" size={22} />
            </View>
          </Pressable>

          <Text style={[styles.footer, isNight && styles.darkMutedText]}>Nookly · Sua biblioteca, no seu ritmo</Text>
        </View>
      </ScrollView>

      <LibrarySheet
        title="Adicionar favorito"
        description="Escolha até três livros do seu acervo."
        height={520}
        visible={favoritePickerOpen}
        onClose={() => setFavoritePickerOpen(false)}
        backgroundColor={isNight ? darkTheme.surface : colors.paper}
        textColor={isNight ? darkTheme.text : colors.ink}
        mutedColor={isNight ? darkTheme.textMuted : colors.muted}
      >
        {books.filter((book) => !favoriteBookIds.includes(book.id)).map((book) => (
          <Pressable key={book.id} accessibilityRole="button" accessibilityLabel={`Favoritar ${book.title}`} onPress={() => { toggleFavoriteBook(book.id); setFavoritePickerOpen(false); }} style={({ pressed }) => [styles.favoriteOption, pressed && styles.pressed]}>
            <BookCover color={book.coverColor} coverUrl={book.coverUrl} style={styles.favoriteOptionCover} />
            <View style={styles.favoriteOptionCopy}>
              <Text numberOfLines={2} style={[styles.favoriteOptionTitle, isNight && styles.darkTitle]}>{book.title}</Text>
              <Text numberOfLines={1} style={[styles.favoriteOptionAuthor, isNight && styles.darkMutedText]}>{book.author}</Text>
            </View>
            <Ionicons name="add" size={22} color={accent} />
          </Pressable>
        ))}
        {books.length === 0 ? (
          <Pressable accessibilityRole="button" onPress={() => { setFavoritePickerOpen(false); router.navigate('/books/catalog'); }} style={styles.favoriteOption}>
            <Text style={[styles.favoriteOptionTitle, isNight && styles.darkTitle]}>Adicione seu primeiro livro ao acervo</Text>
            <Ionicons name="chevron-forward" size={20} color={accent} />
          </Pressable>
        ) : null}
      </LibrarySheet>

      <ShareRoomModal
        onCaptureSnapshot={captureRoomSnapshot}
        onClose={() => setIsShareModalOpen(false)}
        roomSnapshotUri={getLastCapturedRoomUri()}
        visible={isShareModalOpen}
      />
    </>
  );
}

function Metric({ icon, isNight, label, value }: { icon: keyof typeof Ionicons.glyphMap; isNight: boolean; label: string; value: number }) {
  return (
    <View style={[styles.metric, { backgroundColor: isNight ? darkTheme.surfaceElevated : colors.softFill }]}>
      <View style={styles.metricHeading}>
        <Ionicons color={isNight ? darkTheme.selectionText : colors.sageDark} name={icon} size={18} />
        <Text selectable adjustsFontSizeToFit numberOfLines={1} style={[styles.metricValue, isNight && styles.journeyValueNight]}>{value.toLocaleString('pt-BR')}</Text>
      </View>
      <Text style={[styles.metricLabel, isNight && styles.journeyMutedNight]}>{label}</Text>
    </View>
  );
}

const PROFILE_SURFACE = colors.paper;
const PROFILE_NIGHT_SURFACE = darkTheme.surface;

const styles = StyleSheet.create({
  favoritesSection: { gap: 12, paddingTop: 4 },
  favoriteSlots: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-evenly', gap: 12, paddingHorizontal: 14, paddingTop: 10 },
  favoriteSlotWrap: { flex: 1, maxWidth: 96 },
  favoriteSlot: { width: '100%', aspectRatio: 2 / 3, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  favoriteCover: { width: '100%', height: '100%', borderRadius: 6 },
  removeFavorite: { position: 'absolute', top: -12, right: -10, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  favoriteShelf: { height: 28, overflow: 'hidden', borderRadius: 3, marginTop: -13 },
  favoriteWood: { position: 'absolute', width: '104%', left: '-2%', height: 330, top: -153 },
  favoriteOption: { minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  favoriteOptionCover: { width: 42, height: 63, borderRadius: 4 },
  favoriteOptionCopy: { flex: 1, gap: 4 },
  favoriteOptionTitle: { color: colors.ink, fontSize: 15, fontWeight: '600', flexShrink: 1 },
  favoriteOptionAuthor: { color: colors.muted, fontSize: 13 },
  screen: { flex: 1 },
  hero: { minHeight: 226, paddingBottom: 60, paddingHorizontal: 24 },
  heroNightOverlay: { backgroundColor: 'rgba(32,30,28,0.64)' },
  heroHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heroCopy: { flex: 1, gap: 4 },
  heroTitle: { fontFamily: typography.editorial, fontSize: 32, color: colors.ink },
  heroSubtitle: { fontFamily: typography.ui, fontSize: 15, color: colors.inkSoft },
  gearButton: { ...controls.iconButton, backgroundColor: colors.paper, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  body: { width: '100%', maxWidth: 600, alignSelf: 'center', gap: 16, paddingHorizontal: 18, marginTop: -36 },
  editButton: { ...controls.iconButton, alignSelf: 'flex-start', backgroundColor: colors.softFill },
  editButtonNight: { backgroundColor: darkTheme.surfaceElevated },
  shareArtwork: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 108, justifyContent: 'center' },
  shareImage: { width: 108, height: 108 },
  shareArrow: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink },
  profileCard: { gap: 16, padding: 20, borderRadius: 26, borderCurve: 'continuous', backgroundColor: PROFILE_SURFACE, borderWidth: 1, borderColor: colors.lineSubtle },
  nightCard: { backgroundColor: PROFILE_NIGHT_SURFACE, borderColor: darkTheme.border },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  profileInfo: { flex: 1, gap: 3 },
  name: { color: colors.ink, fontFamily: typography.editorial, fontSize: 26, lineHeight: 34 },
  quoteWrap: { gap: 8, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  darkDividerTop: { borderTopColor: darkTheme.borderSubtle },
  quoteText: { color: colors.ink, fontFamily: typography.editorial, fontSize: 18, lineHeight: 27 },
  quoteAuthor: { color: colors.muted, fontFamily: typography.ui, fontSize: 13 },
  journeySection: { gap: 16, padding: 16, borderRadius: 26, borderCurve: 'continuous', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.lineSubtle },
  journeySectionNight: { backgroundColor: darkTheme.surface, borderColor: darkTheme.border },
  journeyHeading: { gap: 3 },
  journeyCard: { gap: 10 },
  pagesCard: { minHeight: 100, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radii.medium, borderCurve: 'continuous' },
  pagesIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  pagesCopy: { flex: 1, gap: 1 },
  pagesLabel: { color: colors.inkSoft, fontFamily: typography.ui, fontSize: 13, fontWeight: '600' },
  pagesValue: { color: colors.ink, fontFamily: typography.editorial, fontSize: 36, lineHeight: 46, fontVariant: ['tabular-nums'] },
  journeyMutedNight: { color: darkTheme.textMuted },
  journeyValueNight: { color: darkTheme.text },
  metricsRow: { flexDirection: 'row', gap: 8 },
  metricsStack: { flexDirection: 'column' },
  metric: { flexGrow: 1, flexBasis: 0, minWidth: 0, padding: 12, borderRadius: radii.medium, borderCurve: 'continuous', gap: 8 },
  metricHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  metricValue: { color: colors.ink, fontFamily: typography.editorial, fontSize: 28, lineHeight: 36, fontVariant: ['tabular-nums'] },
  metricLabel: { color: colors.inkSoft, fontFamily: typography.ui, fontSize: 12, lineHeight: 17 },
  darkDivider: { backgroundColor: darkTheme.border },
  journeyTitle: { color: colors.ink },
  journeyTitleNight: { color: darkTheme.text },
  journeyDescription: { color: colors.inkSoft },
  journeyDescriptionNight: { color: darkTheme.textMuted },
  shareCard: { minHeight: 116, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, paddingLeft: 112, overflow: 'hidden', borderRadius: 26, borderCurve: 'continuous', backgroundColor: colors.sageDark },
  shareCardNight: { backgroundColor: darkTheme.surfaceElevated },
  shareTextWrap: { flex: 1, gap: 3 },
  shareTitle: { color: colors.paper, fontFamily: typography.editorial, fontSize: 18, lineHeight: 24 },
  shareSubtitle: { color: colors.cream, fontFamily: typography.ui, fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.72 },
  sectionTitle: { color: colors.ink, fontFamily: typography.editorial, fontSize: 22, lineHeight: 30 },
  sectionDescription: { color: colors.muted, fontFamily: typography.ui, fontSize: 14, lineHeight: 20 },
  footer: { alignSelf: 'center', color: colors.muted, fontFamily: typography.ui, fontSize: 12, textAlign: 'center', paddingVertical: 8 },
  darkTitle: { color: darkTheme.text },
  darkMutedText: { color: darkTheme.textMuted },
});
