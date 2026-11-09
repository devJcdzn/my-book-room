import Ionicons from '@expo/vector-icons/Ionicons';
import { showMenu } from '@/src/components/app-dialog';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { router, Stack, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AMBIENCE_LABELS, resolveAmbience } from '@/src/types/ambience';
import { useLibraryStore } from '@/src/store/library-store';
import { colors, controls, darkTheme, radii, typography } from '@/src/theme';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const setAmbienceMode = useLibraryStore((state) => state.setAmbienceMode);
  const restartOnboarding = useLibraryStore((state) => state.restartOnboarding);
  const isNight = resolveAmbience(ambienceMode) === 'night';
  const palette = {
    background: isNight ? darkTheme.bg : colors.cream,
    surface: isNight ? darkTheme.surface : colors.paper,
    text: isNight ? darkTheme.text : colors.ink,
    muted: isNight ? darkTheme.textMuted : colors.muted,
    border: isNight ? darkTheme.border : colors.line,
    accent: isNight ? darkTheme.selectionText : colors.sageDark,
    selection: isNight ? darkTheme.selection : colors.sageSoft,
  };

  const modeLabel = AMBIENCE_LABELS[ambienceMode];
  const links = [
    { title: 'Editar perfil', description: 'Foto, nome e bio', icon: 'person-outline', route: '/edit-profile' },
    { title: 'Conta e sincronização', description: 'Acesso e dados salvos', icon: 'cloud-outline', route: '/account' },
  ] as const;

  return (
    <ScrollView contentInsetAdjustmentBehavior="never" contentContainerStyle={[styles.content, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false} style={{ flex: 1, backgroundColor: palette.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, { backgroundColor: palette.surface, borderColor: palette.border }, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={22} color={palette.accent} />
        </Pressable>
        <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit style={[styles.headerTitle, { color: palette.text }]}>Configurações</Text>
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: palette.text }]}>Perfil e conta</Text>
        <View style={[styles.group, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          {links.map((link, index) => (
            <View key={link.route}>
              {index > 0 ? <View style={[styles.divider, { backgroundColor: palette.border }]} /> : null}
              <Pressable accessibilityRole="button" onPress={() => router.navigate(link.route)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                <View style={[styles.rowIcon, { backgroundColor: palette.selection }]}><Ionicons name={link.icon} size={19} color={palette.accent} accessible={false} /></View>
                <View style={styles.copy}>
                  <Text style={[styles.label, { color: palette.text }]}>{link.title}</Text>
                  <Text style={[styles.description, { color: palette.muted }]}>{link.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={palette.muted} />
              </Pressable>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: palette.text }]}>Atmosfera da sala</Text>
        <View style={[styles.group, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Modo de iluminação"
            accessibilityValue={{ text: modeLabel }}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => showMenu('Modo de iluminação', (['auto', 'day', 'sunset', 'night'] as const).map(mode => ({
              text: AMBIENCE_LABELS[mode],
              selected: mode === ambienceMode,
              onPress: () => {
                if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
                setAmbienceMode(mode);
              },
            })))}
          >
              <View style={[styles.rowIcon, { backgroundColor: palette.selection }]}>
                <Ionicons name={ambienceMode === 'night' ? 'moon-outline' : ambienceMode === 'auto' ? 'time-outline' : 'sunny-outline'} size={19} color={palette.accent} accessible={false} />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.label, { color: palette.text }]}>Modo de iluminação</Text>
                <Text style={[styles.description, { color: palette.accent }]}>{modeLabel}</Text>
              </View>
              <Ionicons name="chevron-expand" size={18} color={palette.muted} accessible={false} />
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: palette.text }]}>Sobre o Nookly</Text>
        <Pressable accessibilityRole="button" accessibilityHint="Abre novamente a apresentação inicial" onPress={() => {
          if (process.env.EXPO_OS === 'ios') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          restartOnboarding();
          router.push({ pathname: '/onboarding', params: { from: 'profile' } } as Href);
        }} style={({ pressed }) => [styles.group, styles.row, { backgroundColor: palette.surface, borderColor: palette.border }, pressed && styles.pressed]}>
          <View style={[styles.rowIcon, { backgroundColor: palette.selection }]}><Ionicons name="sparkles-outline" size={19} color={palette.accent} accessible={false} /></View>
          <View style={styles.copy}>
            <Text style={[styles.label, { color: palette.text }]}>Conheça o Nookly</Text>
            <Text style={[styles.description, { color: palette.muted }]}>Veja novamente a apresentação inicial.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={palette.muted} />
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', padding: 18, paddingBottom: 36, gap: 26 },
  header: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  backButton: { ...controls.iconButton, position: 'absolute', left: 0, borderWidth: 1 },
  headerTitle: { fontFamily: typography.editorial, fontSize: 26, lineHeight: 36, textAlign: 'center', paddingHorizontal: 52 },
  section: { gap: 10 },
  sectionTitle: { fontFamily: typography.editorial, fontSize: 22, lineHeight: 30 },
  group: { borderRadius: radii.large, borderCurve: 'continuous', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  row: { minHeight: 68, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowIcon: { width: 36, height: 36, borderRadius: radii.small, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 4 },
  label: { fontFamily: typography.ui, fontSize: 15, fontWeight: '600' },
  description: { fontSize: 13, lineHeight: 19 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 64, marginRight: 14 },
  pressed: { opacity: 0.72 },
});
