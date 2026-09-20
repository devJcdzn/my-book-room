import Ionicons from '@expo/vector-icons/Ionicons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { useAuth, type SyncStatus } from '@/src/providers/auth-provider';
import { useLibraryStore } from '@/src/store/library-store';
import { colors, darkTheme, radii, typography } from '@/src/theme';

const STATUS_COPY: Record<SyncStatus, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  idle: { label: 'Somente neste aparelho', icon: 'phone-portrait-outline' },
  syncing: { label: 'Sincronizando…', icon: 'sync-outline' },
  synced: { label: 'Sincronizado', icon: 'cloud-done-outline' },
  offline: { label: 'Aguardando conexão', icon: 'cloud-offline-outline' },
  conflict: { label: 'Escolha necessária', icon: 'git-compare-outline' },
  error: { label: 'Não foi possível sincronizar', icon: 'alert-circle-outline' },
};

export default function AccountScreen() {
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const isNight = resolveAmbience(ambienceMode) === 'night';
  const [isDeleting, setIsDeleting] = useState(false);
  const {
    user, provider, isLoading, isAuthenticating, errorMessage, syncStatus, lastSyncedAt,
    hasConflict, purchasesLinked, signInWithApple, signInWithGoogle, resolveConflict,
    retrySync, signOut, deleteAccount,
  } = useAuth();
  const status = STATUS_COPY[syncStatus];

  const confirmDelete = () => {
    Alert.alert(
      'Excluir conta?',
      'O backup na nuvem será apagado. Sua biblioteca continuará disponível somente neste aparelho.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir conta',
          style: 'destructive',
          onPress: () => {
            setIsDeleting(true);
            void deleteAccount()
              .catch(() => Alert.alert('Não foi possível excluir', 'Tente novamente quando estiver conectado.'))
              .finally(() => setIsDeleting(false));
          },
        },
      ],
    );
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content} style={[styles.screen, isNight && styles.darkScreen]}>
      <Stack.Screen options={{ title: 'Conta e sincronização' }} />
      {!user ? (
        <>
          <View style={[styles.hero, isNight && styles.darkCard]}>
            <View style={[styles.iconCircle, isNight && styles.darkIconCircle]}>
              <Ionicons color={isNight ? '#FFAE70' : colors.terracotta} name="cloud-outline" size={25} />
            </View>
            <Text selectable style={[styles.title, isNight && styles.darkTitle]}>Seu Bookroom, em qualquer aparelho</Text>
            <Text selectable style={[styles.body, isNight && styles.darkMuted]}>A conta é opcional. Use o Bookroom sem entrar ou conecte uma conta para proteger sua biblioteca.</Text>
          </View>
          <View style={[styles.card, isNight && styles.darkCard]}>
            <Benefit icon="library-outline" text="Backup da biblioteca e do progresso" isNight={isNight} />
            <Benefit icon="phone-portrait-outline" text="Continuidade entre iPhone e Android" isNight={isNight} />
            <Benefit icon="bag-check-outline" text="Recuperação do acesso Unlimited" isNight={isNight} />
          </View>
          <View style={styles.actions}>
            {process.env.EXPO_OS === 'ios' ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonStyle={isNight ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                cornerRadius={12}
                onPress={() => { void signInWithApple(); }}
                style={styles.appleButton}
              />
            ) : <AuthButton icon="logo-apple" label="Continuar com Apple" onPress={signInWithApple} isNight={isNight} />}
            <AuthButton icon="logo-google" label="Continuar com Google" onPress={signInWithGoogle} isNight={isNight} />
          </View>
          {(isAuthenticating || isLoading) ? <ActivityIndicator color={colors.terracotta} /> : null}
          {errorMessage ? <Text selectable style={styles.error}>{errorMessage}</Text> : null}
          <Text selectable style={[styles.note, isNight && styles.darkMuted]}>Fotos escolhidas da galeria permanecem somente no aparelho em que foram adicionadas.</Text>
        </>
      ) : (
        <>
          <View style={[styles.card, isNight && styles.darkCard]}>
            <View style={styles.accountHeader}>
              <View style={[styles.iconCircle, isNight && styles.darkIconCircle]}><Ionicons color={isNight ? '#FFAE70' : colors.terracotta} name="person-outline" size={23} /></View>
              <View style={styles.accountIdentity}>
                <Text selectable style={[styles.accountProvider, isNight && styles.darkTitle]}>Conectado com {provider === 'apple' ? 'Apple' : 'Google'}</Text>
                {user.email ? <Text selectable style={[styles.email, isNight && styles.darkMuted]}>{user.email}</Text> : null}
              </View>
            </View>
          </View>
          <View style={[styles.card, isNight && styles.darkCard]}>
            <View style={styles.statusRow}>
              <Ionicons color={isNight ? '#FFAE70' : colors.terracotta} name={status.icon} size={20} />
              <View style={styles.statusCopy}>
                <Text selectable style={[styles.statusTitle, isNight && styles.darkTitle]}>{status.label}</Text>
                {lastSyncedAt ? <Text selectable style={[styles.statusDetail, isNight && styles.darkMuted]}>Última sincronização {new Date(lastSyncedAt).toLocaleString('pt-BR')}</Text> : null}
              </View>
            </View>
            <View style={[styles.divider, isNight && styles.darkDivider]} />
            <StatusLine label="Compras vinculadas" value={purchasesLinked ? 'Sim' : 'Pendente'} isNight={isNight} />
            <StatusLine label="Foto personalizada" value="Somente neste aparelho" isNight={isNight} />
          </View>
          {hasConflict ? (
            <View style={[styles.card, styles.conflictCard, isNight && styles.darkCard]}>
              <Text selectable style={[styles.statusTitle, isNight && styles.darkTitle]}>Qual biblioteca deseja manter?</Text>
              <Text selectable style={[styles.body, isNight && styles.darkMuted]}>Este aparelho e a nuvem foram alterados. Nada será substituído até você escolher.</Text>
              <View style={styles.choiceRow}>
                <Pressable style={styles.secondaryButton} onPress={() => { void resolveConflict('cloud'); }}><Text style={styles.secondaryButtonText}>Usar nuvem</Text></Pressable>
                <Pressable style={styles.primaryButton} onPress={() => { void resolveConflict('device'); }}><Text style={styles.primaryButtonText}>Usar aparelho</Text></Pressable>
              </View>
            </View>
          ) : null}
          {(syncStatus === 'offline' || syncStatus === 'error' || !purchasesLinked) ? (
            <Pressable style={styles.primaryButton} onPress={() => { void retrySync(); }}><Text style={styles.primaryButtonText}>Tentar novamente</Text></Pressable>
          ) : null}
          {errorMessage ? <Text selectable style={styles.error}>{errorMessage}</Text> : null}
          <View style={[styles.card, isNight && styles.darkCard]}>
            <Pressable style={styles.menuRow} onPress={() => { void signOut(); }}><Text style={[styles.menuText, isNight && styles.darkTitle]}>Sair da conta</Text><Ionicons color={isNight ? darkTheme.textMuted : colors.muted} name="log-out-outline" size={19} /></Pressable>
            <View style={[styles.divider, isNight && styles.darkDivider]} />
            <Pressable disabled={isDeleting} style={styles.menuRow} onPress={confirmDelete}><Text style={styles.deleteText}>{isDeleting ? 'Excluindo…' : 'Excluir conta'}</Text>{isDeleting ? <ActivityIndicator color="#B64135" size="small" /> : <Ionicons color="#B64135" name="trash-outline" size={18} />}</Pressable>
          </View>
        </>
      )}
    </ScrollView>
  );
}

function Benefit({ icon, text, isNight }: { icon: keyof typeof Ionicons.glyphMap; text: string; isNight: boolean }) {
  return <View style={styles.benefit}><Ionicons color={isNight ? '#FFAE70' : colors.terracotta} name={icon} size={19} /><Text selectable style={[styles.benefitText, isNight && styles.darkTitle]}>{text}</Text></View>;
}

function AuthButton({ icon, label, onPress, isNight }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => Promise<void>; isNight: boolean }) {
  return <Pressable accessibilityRole="button" style={[styles.authButton, isNight && styles.darkAuthButton]} onPress={() => { void onPress(); }}><Ionicons color={isNight ? darkTheme.text : colors.ink} name={icon} size={20} /><Text style={[styles.authButtonText, isNight && styles.darkTitle]}>{label}</Text></Pressable>;
}

function StatusLine({ label, value, isNight }: { label: string; value: string; isNight: boolean }) {
  return <View style={styles.statusLine}><Text selectable style={[styles.statusDetail, isNight && styles.darkMuted]}>{label}</Text><Text selectable style={[styles.statusValue, isNight && styles.darkTitle]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream }, darkScreen: { backgroundColor: darkTheme.bg }, content: { padding: 18, paddingBottom: 48, gap: 14 },
  hero: { alignItems: 'center', gap: 9, padding: 20, backgroundColor: colors.paper, borderRadius: radii.large, borderCurve: 'continuous' },
  card: { padding: 16, gap: 14, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.lineSubtle, borderRadius: radii.large, borderCurve: 'continuous' }, darkCard: { backgroundColor: darkTheme.surface, borderColor: darkTheme.borderSubtle },
  iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.terracottaSoft }, darkIconCircle: { backgroundColor: 'rgba(255,174,112,0.14)' },
  title: { color: colors.ink, fontFamily: typography.editorial, fontSize: 23, fontWeight: '600', textAlign: 'center' }, body: { color: colors.muted, fontFamily: typography.ui, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  benefit: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 12 }, benefitText: { flex: 1, color: colors.ink, fontFamily: typography.ui, fontSize: 14, fontWeight: '500' },
  actions: { gap: 10 }, appleButton: { width: '100%', height: 50 }, authButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 12, borderCurve: 'continuous' }, darkAuthButton: { backgroundColor: darkTheme.surface, borderColor: darkTheme.borderSubtle }, authButtonText: { color: colors.ink, fontFamily: typography.ui, fontSize: 15, fontWeight: '600' },
  note: { color: colors.muted, fontFamily: typography.ui, fontSize: 12, lineHeight: 18, textAlign: 'center', paddingHorizontal: 10 }, error: { color: '#B64135', fontFamily: typography.ui, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  accountHeader: { flexDirection: 'row', alignItems: 'center', gap: 13 }, accountIdentity: { flex: 1, gap: 3 }, accountProvider: { color: colors.ink, fontFamily: typography.ui, fontSize: 15, fontWeight: '700' }, email: { color: colors.muted, fontFamily: typography.ui, fontSize: 13 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, statusCopy: { flex: 1, gap: 3 }, statusTitle: { color: colors.ink, fontFamily: typography.ui, fontSize: 14, fontWeight: '700' }, statusDetail: { color: colors.muted, fontFamily: typography.ui, fontSize: 12, lineHeight: 17 }, statusLine: { minHeight: 30, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 }, statusValue: { color: colors.ink, fontFamily: typography.ui, fontSize: 12, fontWeight: '600', textAlign: 'right' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.lineSubtle }, darkDivider: { backgroundColor: darkTheme.borderSubtle }, conflictCard: { borderColor: 'rgba(182,90,61,0.35)' }, choiceRow: { flexDirection: 'row', gap: 10 },
  primaryButton: { minHeight: 48, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 12, borderCurve: 'continuous', backgroundColor: colors.terracotta }, primaryButtonText: { color: '#FFF', fontFamily: typography.ui, fontSize: 14, fontWeight: '700' }, secondaryButton: { minHeight: 48, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 12, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper }, secondaryButtonText: { color: colors.ink, fontFamily: typography.ui, fontSize: 14, fontWeight: '700' },
  menuRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, menuText: { color: colors.ink, fontFamily: typography.ui, fontSize: 14, fontWeight: '600' }, deleteText: { color: '#B64135', fontFamily: typography.ui, fontSize: 14, fontWeight: '600' }, darkTitle: { color: darkTheme.text }, darkMuted: { color: darkTheme.textMuted },
});
