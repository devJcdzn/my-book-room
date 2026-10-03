import Ionicons from '@expo/vector-icons/Ionicons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ACCOUNT_SYNC_ENABLED, GOOGLE_SIGN_IN_VISIBLE } from '@/src/config/features';
import { useAuth } from '@/src/providers/auth-provider';
import { useLibraryStore } from '@/src/store/library-store';
import { colors, darkTheme, typography } from '@/src/theme';

export function AuthActions({ isNight, showDescription = true }: { isNight: boolean; showDescription?: boolean }) {
  const { user, isAuthenticating, isLoading, errorMessage, signInWithApple, signInWithGoogle, syncStatus, retrySync } = useAuth();
  const pending = useLibraryStore(state => Boolean(state.profile.avatar?.pending || state.roomLayout.pieces.some(piece => piece.photo?.pending)));
  const [appleAvailable, setAppleAvailable] = useState(false);
  useEffect(() => {
    if (process.env.EXPO_OS === 'ios') void AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => undefined);
  }, []);
  if (!ACCOUNT_SYNC_ENABLED) return null;
  const textColor = isNight ? darkTheme.text : colors.ink;
  const mutedColor = isNight ? darkTheme.textMuted : colors.muted;
  const busy = isAuthenticating || isLoading;
  if (user) return (
    <View style={[styles.panel, styles.connectedPanel, isNight && styles.nightPanel]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Gerenciar sua conta"
        accessibilityHint="Abre os detalhes da conta e do salvamento da sua sala"
        onPress={() => router.navigate('/account')}
        style={({ pressed }) => [styles.accountLink, pressed && { backgroundColor: isNight ? darkTheme.surfaceElevated : colors.softFill }]}
      >
        <View style={[styles.accountIcon, { backgroundColor: isNight ? darkTheme.surfaceElevated : colors.terracottaSoft }]}>
          <Ionicons name="person-circle-outline" size={25} color={isNight ? darkTheme.accent : colors.terracottaDark} />
        </View>
        <View style={styles.accountCopy}>
          <Text numberOfLines={1} style={[styles.accountLabel, { color: textColor }]}>{user.email || 'Sua conta'}</Text>
          <Text style={[styles.accountStatus, { color: mutedColor }]}>{pending ? 'Fotos aguardando envio' : syncStatus === 'synced' ? 'Sala salva na conta' : syncStatus === 'conflict' ? 'Escolha qual sala manter' : syncStatus === 'syncing' ? 'Salvando sua sala…' : 'Gerenciar sua conta'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={isNight ? darkTheme.accent : colors.terracottaDark} />
      </Pressable>
      {(pending || syncStatus === 'error' || syncStatus === 'offline') && <Pressable style={styles.retryLink} accessibilityRole="button" disabled={syncStatus === 'syncing'} onPress={() => { void retrySync(); }}><Text style={{ color: isNight ? darkTheme.accent : colors.terracotta }}>Tentar sincronizar</Text></Pressable>}
      {errorMessage && <Text accessibilityRole="alert" style={[styles.connectedError, { color: isNight ? '#EE9B8D' : '#B64135' }]}>{errorMessage}</Text>}
    </View>
  );
  return (
    <View style={[styles.panel, isNight && styles.nightPanel]}>
      {showDescription && <Text style={[styles.description, { color: mutedColor }]}>Entre para manter sua sala salva e acessá-la em outros aparelhos.</Text>}
      <View style={styles.buttons}>
        {appleAvailable && <View pointerEvents={busy ? 'none' : 'auto'} style={{ opacity: busy ? 0.5 : 1 }} accessibilityState={{ disabled: busy }}>
          <AppleAuthentication.AppleAuthenticationButton buttonStyle={isNight ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK} buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE} cornerRadius={12} style={styles.appleButton} onPress={() => { void signInWithApple(); }} />
        </View>}
        {GOOGLE_SIGN_IN_VISIBLE && <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void signInWithGoogle(); }} style={[styles.googleButton, { backgroundColor: isNight ? darkTheme.surfaceElevated : colors.paper, borderColor: isNight ? darkTheme.border : colors.line, opacity: busy ? 0.5 : 1 }]}>
          <Ionicons name="logo-google" size={18} color={textColor} /><Text style={[styles.buttonText, { color: textColor }]}>Continuar com Google</Text>
        </Pressable>}
      </View>
      {busy && <ActivityIndicator color={colors.terracotta} />}
      {errorMessage && <Text accessibilityRole="alert" style={{ color: isNight ? '#EE9B8D' : '#B64135' }}>{errorMessage}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 12, padding: 16, borderRadius: 24, borderCurve: 'continuous', backgroundColor: colors.paper, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSubtle },
  nightPanel: { backgroundColor: darkTheme.surface, borderColor: darkTheme.borderSubtle },
  connectedPanel: { padding: 0, gap: 0, overflow: 'hidden', borderColor: colors.line },
  accountLink: { minHeight: 84, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  accountIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  accountCopy: { flex: 1, gap: 4 },
  accountLabel: { fontFamily: typography.ui, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  accountStatus: { fontFamily: typography.ui, fontSize: 13, lineHeight: 19 },
  retryLink: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center' },
  connectedError: { paddingHorizontal: 16, paddingBottom: 16, fontFamily: typography.ui, fontSize: 13, lineHeight: 19 },
  description: { fontFamily: typography.ui, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  buttons: { width: '100%', maxWidth: 320, alignSelf: 'center', gap: 8 },
  appleButton: { width: '100%', height: 44 },
  googleButton: { minHeight: 44, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderCurve: 'continuous', borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonText: { fontFamily: typography.ui, fontSize: 15, fontWeight: '600' },
});
