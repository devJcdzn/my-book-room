import { AuthActions } from '@/src/components/auth-actions';
import { ProfileAvatar } from '@/src/components/profile-avatar';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { ShareRoomModal } from '@/src/components/room/share-room-modal';
import AmbienceModePicker from '@/src/components/ambience-mode-picker';
import { captureRoomSnapshot, getLastCapturedRoomUri } from '@/src/services/room-snapshot-service';
import { type AmbienceMode, useLibraryStore } from '@/src/store/library-store';
import { controls, colors, darkTheme, radii, typography } from '@/src/theme';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const books = useLibraryStore((state) => state.books);
  const profile = useLibraryStore((state) => state.profile);
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const setAmbienceMode = useLibraryStore((state) => state.setAmbienceMode);
  const restartOnboarding = useLibraryStore((state) => state.restartOnboarding);

  const completedBooks = books.filter((book) => book.status === 'completed').length;
  const totalPagesRead = books.reduce((sum, book) => sum + book.currentPage, 0);
  const noteCount = books.reduce((sum, book) => sum + (book.readingEntries?.length ?? 0), 0);
  const isNight = resolveAmbience(ambienceMode) === 'night';
  const pageBackground = isNight ? darkTheme.bg : colors.cream;
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const handleSelectAmbience = (mode: string | number) => {
    if (mode !== 'auto' && mode !== 'day' && mode !== 'night') return;
    if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
    setAmbienceMode(mode as AmbienceMode);
  };

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
            <Pressable accessibilityLabel="Editar perfil" accessibilityRole="button" onPress={() => router.navigate('/edit-profile')} style={({ pressed }) => [styles.gearButton, isNight && styles.nightCard, pressed && styles.pressed]}>
              <Ionicons name="settings-outline" size={25} color={isNight ? darkTheme.accent : colors.terracottaDark} />
            </Pressable>
          </View>
        </View>
        <View style={styles.body}>
          <View style={[styles.profileCard, isNight && styles.nightCard]}>
            <View style={styles.profileRow}>
              <ProfileAvatar avatar={profile.avatar} name={profile.name} />
              <View style={styles.profileInfo}>
                <Text numberOfLines={2} selectable style={[styles.name, isNight && styles.darkTitle]}>{profile.name}</Text>
              </View>
              <Pressable accessibilityLabel="Editar perfil" accessibilityRole="button" onPress={() => router.navigate('/edit-profile')} style={({ pressed }) => [styles.editButton, isNight && styles.editButtonNight, pressed && styles.pressed]}>
                <Ionicons name="pencil-outline" size={20} color={isNight ? darkTheme.accent : colors.terracottaDark} />
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

          <AuthActions isNight={isNight} />

          <View style={[styles.journeySection, isNight && styles.journeySectionNight]}>
            <View style={styles.journeyHeading}>
              <Text style={[styles.sectionTitle, styles.journeyTitle, isNight && styles.journeyTitleNight]}>Minha jornada</Text>
              <Text style={[styles.sectionDescription, styles.journeyDescription, isNight && styles.journeyDescriptionNight]}>Seu progresso de leitura até agora.</Text>
            </View>
            <View style={styles.journeyCard}>
              <View style={styles.pagesCard}>
                <View style={styles.pagesIcon}>
                  <Ionicons color={isNight ? darkTheme.accent : colors.terracottaDark} name="book-outline" size={20} />
                </View>
                <View style={styles.pagesCopy}>
                  <Text style={[styles.pagesLabel, isNight && styles.journeyMutedNight]}>Páginas lidas</Text>
                  <Text selectable style={[styles.pagesValue, isNight && styles.journeyValueNight]}>{totalPagesRead.toLocaleString('pt-BR')}</Text>
                </View>
              </View>

              <View style={styles.metricsRow}>
                <Metric icon="checkmark-done-outline" isNight={isNight} label="livros concluídos" value={completedBooks} />

                <Metric icon="library-outline" isNight={isNight} label="no acervo" value={books.length} />

                <Metric icon="journal-outline" isNight={isNight} label="notas" value={noteCount} />
              </View>
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

          <View style={[styles.settingsCard, isNight && styles.settingsCardNight]}>
            <View style={styles.settingHeading}>
              <Text style={[styles.sectionTitle, isNight && styles.darkTitle]}>Atmosfera da sala</Text>
              <Text style={[styles.sectionDescription, isNight && styles.darkMutedText]}>Escolha como a sala acompanha sua leitura.</Text>
            </View>
            <View style={styles.pickerCard}>
              <View style={styles.pickerHeading}>
                <View style={styles.pickerIcon}>
                  <Ionicons color={isNight ? darkTheme.accent : colors.terracottaDark} name="sunny-outline" size={20} />
                </View>
                <View style={styles.pickerCopy}>
                  <Text style={[styles.pickerLabel, isNight && styles.darkTitle]}>Modo de iluminação</Text>
                  <Text style={[styles.pickerDescription, isNight && styles.darkMutedText]}>Automático, dia ou noite</Text>
                </View>
              </View>
              <View style={styles.pickerControl}>
                <AmbienceModePicker isNight={isNight} onChange={handleSelectAmbience} value={ambienceMode} />
              </View>
            </View>

            <View style={[styles.settingDivider, isNight && styles.darkDivider]} />

            <Pressable
              accessibilityHint="Abre novamente a apresentação inicial do Nookly"
              accessibilityLabel="Conheça o Nookly. Veja novamente a apresentação inicial."
              accessibilityRole="button"
              onPress={() => {
                if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                restartOnboarding();
                router.push({ pathname: '/onboarding', params: { from: 'profile' } } as unknown as Href);
              }}
              style={({ pressed }) => [styles.settingLink, pressed && styles.pressed]}
            >
              <View style={styles.settingLinkCopy}>
                <View style={styles.settingLinkIcon}>
                  <Ionicons color={isNight ? darkTheme.accent : colors.terracottaDark} name="sparkles-outline" size={20} />
                </View>
                <View style={styles.settingLinkText}>
                  <Text style={[styles.settingLinkTitle, isNight && styles.darkTitle]}>Conheça o Nookly</Text>
                  <Text style={[styles.settingLinkDescription, isNight && styles.darkMutedText]}>Veja novamente a apresentação inicial.</Text>
                </View>
              </View>
              <Ionicons color={isNight ? darkTheme.accent : colors.terracottaDark} name="chevron-forward" size={18} />
            </Pressable>


          </View>

          <Text style={[styles.footer, isNight && styles.darkMutedText]}>Nookly · Sua biblioteca, no seu ritmo</Text>
        </View>
      </ScrollView>

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
    <View style={[styles.metric, { backgroundColor: isNight ? darkTheme.surface : icon === 'checkmark-done-outline' ? '#E8EBDD' : icon === 'library-outline' ? '#F3E7D5' : '#F5E4DB' }]}>
      <Ionicons color={isNight ? darkTheme.accent : colors.terracottaDark} name={icon} size={18} />
      <Text selectable style={[styles.metricValue, isNight && styles.journeyValueNight]}>{value.toLocaleString('pt-BR')}</Text>
      <Text style={[styles.metricLabel, isNight && styles.journeyMutedNight]}>{label}</Text>
    </View>
  );
}

const PROFILE_SURFACE = colors.paper;
const PROFILE_NIGHT_SURFACE = darkTheme.surface;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hero: { height: 300, paddingHorizontal: 24 },
  heroNightOverlay: { backgroundColor: 'rgba(32,30,28,0.64)' },
  heroHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heroCopy: { flex: 1, gap: 4 },
  heroTitle: { fontFamily: typography.editorial, fontSize: 32, color: colors.ink },
  heroSubtitle: { fontFamily: typography.ui, fontSize: 15, color: colors.inkSoft },
  gearButton: { ...controls.iconButton, backgroundColor: colors.paper },
  body: { width: '100%', maxWidth: 600, alignSelf: 'center', gap: 16, paddingHorizontal: 18, marginTop: -36 },
  editButton: { ...controls.iconButton, alignSelf: 'flex-start', backgroundColor: colors.softFill },
  editButtonNight: { backgroundColor: darkTheme.surfaceElevated },
  shareArtwork: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 108, justifyContent: 'center' },
  shareImage: { width: 108, height: 108 },
  shareArrow: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.terracotta },
  profileCard: { gap: 16, padding: 20, borderRadius: 26, borderCurve: 'continuous', backgroundColor: PROFILE_SURFACE, borderWidth: 1, borderColor: colors.lineSubtle },
  nightCard: { backgroundColor: PROFILE_NIGHT_SURFACE, borderColor: darkTheme.border },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.terracotta },
  darkAvatar: { backgroundColor: colors.terracottaDark },
  avatarText: { color: colors.paper, fontFamily: typography.editorial, fontSize: 27 },
  darkAccentText: { color: darkTheme.accent },
  profileInfo: { flex: 1, gap: 3 },
  name: { color: colors.ink, fontFamily: typography.editorial, fontSize: 26, lineHeight: 34 },
  quoteWrap: { gap: 8, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  darkDividerTop: { borderTopColor: darkTheme.borderSubtle },
  quoteText: { color: colors.ink, fontFamily: typography.editorial, fontSize: 18, lineHeight: 27 },
  quoteAuthor: { color: colors.muted, fontFamily: typography.ui, fontSize: 13 },
  journeySection: { gap: 16, padding: 16, borderRadius: 26, borderCurve: 'continuous', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.lineSubtle },
  journeySectionNight: { backgroundColor: darkTheme.surfaceElevated, borderColor: darkTheme.border },
  journeyHeading: { gap: 3 },
  journeyCard: { gap: 10 },
  pagesCard: { minHeight: 100, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 20, backgroundColor: 'rgba(182,90,61,0.08)' },
  pagesIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(182,90,61,0.12)' },
  pagesCopy: { flex: 1, gap: 1 },
  pagesLabel: { color: colors.inkSoft, fontFamily: typography.ui, fontSize: 13, fontWeight: '600' },
  pagesValue: { color: colors.ink, fontFamily: typography.editorial, fontSize: 36, lineHeight: 46, fontVariant: ['tabular-nums'] },
  journeyMutedNight: { color: darkTheme.textMuted },
  journeyValueNight: { color: darkTheme.text },
  metricsRow: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, minWidth: 0, alignItems: 'flex-start', padding: 12, borderRadius: 18, gap: 5 },
  metricValue: { color: colors.ink, fontFamily: typography.editorial, fontSize: 28, lineHeight: 36, fontVariant: ['tabular-nums'] },
  metricLabel: { color: colors.inkSoft, fontFamily: typography.ui, fontSize: 12, lineHeight: 17 },
  darkDivider: { backgroundColor: darkTheme.border },
  journeyTitle: { color: colors.ink },
  journeyTitleNight: { color: darkTheme.text },
  journeyDescription: { color: colors.inkSoft },
  journeyDescriptionNight: { color: darkTheme.textMuted },
  shareCard: { minHeight: 116, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, paddingLeft: 112, overflow: 'hidden', borderRadius: 26, borderCurve: 'continuous', backgroundColor: '#455238' },
  shareCardNight: { backgroundColor: '#293526' },
  shareTextWrap: { flex: 1, gap: 3 },
  shareTitle: { color: colors.paper, fontFamily: typography.editorial, fontSize: 18, lineHeight: 24 },
  shareSubtitle: { color: '#EEE8DA', fontFamily: typography.ui, fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.72 },
  settingsCard: { gap: 16, padding: 18, borderRadius: radii.large, borderCurve: 'continuous', backgroundColor: PROFILE_SURFACE, borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)' },
  settingsCardNight: { backgroundColor: PROFILE_NIGHT_SURFACE, borderColor: darkTheme.border },
  settingHeading: { gap: 5 },
  sectionTitle: { color: colors.ink, fontFamily: typography.editorial, fontSize: 22, lineHeight: 30 },
  sectionDescription: { color: colors.muted, fontFamily: typography.ui, fontSize: 14, lineHeight: 20 },
  pickerCard: { gap: 14, paddingVertical: 2 },
  pickerHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pickerCopy: { gap: 2 },
  pickerIcon: { width: 32, alignItems: 'center' },
  pickerLabel: { color: colors.inkSoft, fontFamily: typography.ui, fontSize: 15, fontWeight: '700' },
  pickerDescription: { color: colors.muted, fontFamily: typography.ui, fontSize: 13, lineHeight: 18 },
  pickerControl: { minHeight: controls.input.minHeight, justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: controls.input.borderRadius, paddingHorizontal: controls.input.paddingHorizontal },
  settingDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  settingLink: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  settingLinkCopy: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  settingLinkIcon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  settingLinkText: { flex: 1, gap: 3 },
  settingLinkTitle: { color: colors.inkSoft, fontFamily: typography.ui, fontSize: 15, fontWeight: '700' },
  settingLinkDescription: { color: colors.muted, fontFamily: typography.ui, fontSize: 13, lineHeight: 18 },
  footer: { alignSelf: 'center', color: colors.muted, fontFamily: typography.ui, fontSize: 12, textAlign: 'center', paddingVertical: 8 },
  darkTitle: { color: darkTheme.text },
  darkMutedText: { color: darkTheme.textMuted },
});
