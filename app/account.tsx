import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AuthActions } from '@/src/components/auth-actions';
import { PrimaryButton } from '@/src/components/primary-button';
import { ProfileAvatar } from '@/src/components/profile-avatar';
import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { ACCOUNT_SYNC_ENABLED } from '@/src/config/features';
import { useAuth, type SyncStatus } from '@/src/providers/auth-provider';
import { useLibraryStore } from '@/src/store/library-store';
import { colors, darkTheme, radii, typography } from '@/src/theme';

const STATUS_COPY: Record<SyncStatus, { title: string; description: string; icon: keyof typeof Ionicons.glyphMap }> = {
  idle: { title: 'Sua sala neste aparelho', description: 'Suas alterações ficam salvas aqui enquanto preparamos o envio para sua conta.', icon: 'phone-portrait-outline' },
  syncing: { title: 'Salvando sua sala…', description: 'Estamos guardando suas últimas alterações e fotos na sua conta.', icon: 'cloud-upload-outline' },
  synced: { title: 'Sua sala está salva', description: 'Sua sala, livros, leituras e fotos estão salvos para você continuar em outro aparelho.', icon: 'cloud-done-outline' },
  offline: { title: 'Aguardando conexão', description: 'Continue usando sua sala. Enviaremos suas alterações quando a conexão voltar.', icon: 'cloud-offline-outline' },
  conflict: { title: 'Qual sala deseja manter?', description: 'Encontramos alterações neste aparelho e na sua conta. Escolha abaixo qual versão usar.', icon: 'git-compare-outline' },
  error: { title: 'O envio não foi concluído', description: 'Suas alterações continuam neste aparelho. Tente novamente para salvá-las na sua conta.', icon: 'alert-circle-outline' },
};

type AccountAction = 'retry' | 'cloud' | 'device' | 'signout' | 'delete';

export default function AccountScreen() {
  const profile = useLibraryStore(state => state.profile);
  const ambienceMode = useLibraryStore(state => state.ambienceMode);
  const isNight = resolveAmbience(ambienceMode) === 'night';
  const [action, setAction] = useState<AccountAction | null>(null);
  const actionInProgress = useRef(false);
  const { user, provider, errorMessage, syncStatus, lastSyncedAt, hasConflict, resolveConflict,
    retrySync, signOut, deleteAccount, isLoading, isAuthenticating } = useAuth();
  const busy = Boolean(action) || isLoading || isAuthenticating;
  const status = STATUS_COPY[syncStatus];
  const accent = isNight ? darkTheme.accent : colors.terracotta;
  const muted = isNight ? darkTheme.textMuted : colors.muted;
  const destructive = isNight ? '#EE9B8D' : '#B64135';
  const saved = syncStatus === 'synced';
  const statusColor = saved ? (isNight ? '#B5C6A4' : colors.sage) : accent;
  const updatedAt = lastSyncedAt ? new Date(lastSyncedAt) : null;
  const updatedLabel = updatedAt && !Number.isNaN(updatedAt.getTime())
    ? `${updatedAt.toDateString() === new Date().toDateString() ? 'Hoje' : updatedAt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}, às ${updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    : null;

  const runAction = async (kind: AccountAction, operation: () => Promise<void>) => {
    if (actionInProgress.current || isLoading || isAuthenticating) return;
    actionInProgress.current = true;
    setAction(kind);
    try {
      await operation();
    } catch (error) {
      console.warn('Não foi possível concluir a ação da conta.', error);
      Alert.alert(kind === 'delete' ? 'Não foi possível excluir' : 'Não foi possível concluir', 'Tente novamente em alguns instantes.');
    } finally {
      actionInProgress.current = false;
      setAction(null);
    }
  };

  const confirmDelete = () => Alert.alert(
    'Excluir sua conta?',
    'Sua conta e tudo que está salvo nela serão apagados. Sua sala, biblioteca e fotos atuais continuarão neste aparelho.',
    [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir conta', style: 'destructive', onPress: () => { void runAction('delete', deleteAccount); } },
    ],
  );

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} style={[styles.screen, isNight && styles.darkScreen]}>
      <Stack.Screen options={{ title: 'Sua conta', headerTitleStyle: { fontFamily: typography.editorial, fontSize: 22, fontWeight: '400' } }} />
      {!ACCOUNT_SYNC_ENABLED ? (
        <View style={[styles.hero, isNight && styles.darkCard]}>
          <Ionicons color={accent} name="phone-portrait-outline" size={28} />
          <Text style={[styles.title, isNight && styles.darkTitle]}>Seu cantinho, neste aparelho</Text>
          <Text style={[styles.body, styles.centered, isNight && styles.darkMuted]}>A conta ainda não está disponível nesta versão. Você pode continuar usando o Nookly como convidado.</Text>
        </View>
      ) : !user ? (
        <>
          <View style={[styles.hero, isNight && styles.darkCard]}>
            <View style={[styles.iconCircle, isNight && styles.darkIconCircle]}><Ionicons color={accent} name="cloud-outline" size={26} /></View>
            <Text style={[styles.title, styles.centered, isNight && styles.darkTitle]}>Sua sala, onde você estiver</Text>
            <Text style={[styles.body, styles.centered, isNight && styles.darkMuted]}>Entre para manter sua sala salva e continuar sua leitura em outros aparelhos.</Text>
          </View>
          <View style={[styles.card, isNight && styles.darkCard]}>
            <View style={styles.benefit}><Ionicons color={accent} name="library-outline" size={20} /><Text style={[styles.body, styles.flexible, isNight && styles.darkTitle]}>Sua sala, livros, notas e fotos juntos</Text></View>
            <View style={styles.benefit}><Ionicons color={accent} name="phone-portrait-outline" size={20} /><Text style={[styles.body, styles.flexible, isNight && styles.darkTitle]}>Continue em outro iPhone ou Android</Text></View>
          </View>
          <AuthActions isNight={isNight} showDescription={false} />
          <Text style={[styles.note, isNight && styles.darkMuted]}>Entrar é opcional. Seu cantinho também funciona sem uma conta.</Text>
        </>
      ) : (
        <>
          <View style={[styles.card, isNight && styles.darkCard]}>
            <View style={styles.accountHeader}>
              <ProfileAvatar avatar={profile.avatar} name={profile.name} size={64} />
              <View style={styles.accountIdentity}>
                <Text selectable style={[styles.profileName, isNight && styles.darkTitle]}>{profile.name}</Text>
                <View style={styles.providerRow}>
                  <Ionicons color={muted} name={provider === 'apple' ? 'logo-apple' : 'logo-google'} size={14} />
                  <Text style={[styles.detail, isNight && styles.darkMuted]}>Conectado com {provider === 'apple' ? 'Apple' : 'Google'}</Text>
                </View>
              </View>
            </View>
            {user.email ? <Text selectable style={[styles.email, isNight && styles.darkMuted]}>{user.email}</Text> : null}
          </View>

          <View style={[styles.card, isNight && styles.darkCard]}>
            <View style={styles.statusRow}>
              <View style={[styles.statusIcon, saved ? styles.savedIcon : styles.iconCircle, isNight && styles.darkIconCircle]}>
                {syncStatus === 'syncing' ? <ActivityIndicator color={statusColor} /> : <Ionicons color={statusColor} name={status.icon} size={24} />}
              </View>
              <Text accessibilityLiveRegion="polite" style={[styles.sectionTitle, styles.flexible, isNight && styles.darkTitle]}>{status.title}</Text>
            </View>
            <Text style={[styles.body, isNight && styles.darkMuted]}>{status.description}</Text>
            {updatedLabel ? <Text selectable style={[styles.detail, isNight && styles.darkMuted]}>Último envio: {updatedLabel}</Text> : null}
            <View style={[styles.divider, isNight && styles.darkDivider]} />
            <View style={styles.photoStatus}>
              <Ionicons color={muted} name="image-outline" size={17} />
              <Text style={[styles.detail, styles.flexible, isNight && styles.darkMuted]}>Foto de perfil</Text>
              <Text style={[styles.photoValue, isNight && styles.darkTitle]}>{profile.avatar?.pending ? 'Envio pendente' : profile.avatar?.source && profile.avatar.source !== 'none' ? saved ? 'Salva na conta' : 'Adicionada' : 'Sem foto'}</Text>
            </View>
            {errorMessage ? <Text style={[styles.error, { color: destructive }]}>{errorMessage}</Text> : null}
            {syncStatus === 'offline' || syncStatus === 'error' ? <PrimaryButton label={action === 'retry' ? 'Tentando novamente…' : 'Tentar novamente'} loading={action === 'retry'} disabled={busy} onPress={() => { void runAction('retry', retrySync); }} /> : null}
          </View>

          {hasConflict ? (
            <View style={[styles.card, isNight && styles.darkCard]}>
              <Text style={[styles.body, isNight && styles.darkMuted]}>A versão escolhida substituirá a outra. Confira qual delas tem as alterações que você deseja manter.</Text>
              <PrimaryButton label="Manter a sala deste aparelho" loading={action === 'device'} disabled={busy} onPress={() => { void runAction('device', () => resolveConflict('device')); }} />
              <PrimaryButton label="Usar a sala salva na conta" tone="secondary" loading={action === 'cloud'} disabled={busy} onPress={() => { void runAction('cloud', () => resolveConflict('cloud')); }} />
            </View>
          ) : null}

          <View style={[styles.actions, isNight && styles.darkCard]}>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy, busy: action === 'signout' }} disabled={busy} onPress={() => { void runAction('signout', signOut); }} style={({ pressed }) => [styles.menuRow, pressed && styles.pressed, busy && styles.disabled]}>
              <View style={styles.actionCopy}>
                <Text style={[styles.menuText, isNight && styles.darkTitle]}>{action === 'signout' ? 'Saindo…' : 'Sair da conta'}</Text>
                <Text style={[styles.detail, isNight && styles.darkMuted]}>Você voltará ao perfil de convidado deste aparelho.</Text>
              </View>
              {action === 'signout' ? <ActivityIndicator color={muted} /> : <Ionicons color={muted} name="log-out-outline" size={21} />}
            </Pressable>
            <View style={[styles.divider, styles.actionDivider, isNight && styles.darkDivider]} />
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy, busy: action === 'delete' }} disabled={busy} onPress={confirmDelete} style={({ pressed }) => [styles.menuRow, pressed && styles.pressed, busy && styles.disabled]}>
              <View style={styles.actionCopy}>
                <Text style={[styles.menuText, { color: destructive }]}>{action === 'delete' ? 'Excluindo…' : 'Excluir conta'}</Text>
                <Text style={[styles.detail, isNight && styles.darkMuted]}>Apaga a conta e os dados salvos nela. Seus dados atuais ficam neste aparelho.</Text>
              </View>
              {action === 'delete' ? <ActivityIndicator color={destructive} /> : <Ionicons color={destructive} name="trash-outline" size={21} />}
            </Pressable>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  darkScreen: { backgroundColor: darkTheme.bg },
  content: { padding: 18, paddingTop: 22, paddingBottom: 36, gap: 18, width: '100%', maxWidth: 520, alignSelf: 'center' },
  card: { padding: 20, gap: 14, backgroundColor: colors.paper, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSubtle, borderRadius: radii.large, borderCurve: 'continuous' },
  darkCard: { backgroundColor: darkTheme.surface, borderColor: darkTheme.borderSubtle },
  hero: { alignItems: 'center', gap: 16, padding: 24, backgroundColor: colors.paper, borderRadius: radii.large, borderCurve: 'continuous' },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.terracottaSoft },
  darkIconCircle: { backgroundColor: darkTheme.surfaceElevated },
  title: { color: colors.ink, fontFamily: typography.editorial, fontSize: 26, lineHeight: 34 },
  body: { color: colors.muted, fontFamily: typography.ui, fontSize: 14, lineHeight: 21 },
  centered: { textAlign: 'center' },
  flexible: { flex: 1 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  note: { color: colors.muted, fontFamily: typography.ui, fontSize: 12, lineHeight: 18, textAlign: 'center', paddingHorizontal: 12 },
  error: { fontFamily: typography.ui, fontSize: 13, lineHeight: 20 },
  accountHeader: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  accountIdentity: { flex: 1, gap: 6 },
  profileName: { color: colors.ink, fontFamily: typography.editorial, fontSize: 28, lineHeight: 36 },
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  email: { color: colors.muted, fontFamily: typography.ui, fontSize: 13, lineHeight: 19 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  savedIcon: { backgroundColor: colors.sageSoft },
  sectionTitle: { color: colors.ink, fontFamily: typography.editorial, fontSize: 22, lineHeight: 29 },
  detail: { color: colors.muted, fontFamily: typography.ui, fontSize: 12, lineHeight: 18, flexShrink: 1 },
  photoStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  photoValue: { color: colors.inkSoft, fontFamily: typography.ui, fontSize: 12, lineHeight: 18, fontWeight: '600', flexShrink: 1 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.lineSubtle },
  darkDivider: { backgroundColor: darkTheme.borderSubtle },
  actions: { backgroundColor: colors.paper, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSubtle, borderRadius: radii.large, borderCurve: 'continuous', overflow: 'hidden' },
  menuRow: { minHeight: 76, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 18 },
  actionCopy: { flex: 1, gap: 5 },
  menuText: { color: colors.ink, fontFamily: typography.ui, fontSize: 14, fontWeight: '600' },
  actionDivider: { marginHorizontal: 20 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
  darkTitle: { color: darkTheme.text },
  darkMuted: { color: darkTheme.textMuted },
});
