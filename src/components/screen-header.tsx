import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, controls, darkTheme, typography } from '@/src/theme';

export function ScreenHeader({ title, isNight, onBack, right, compactTop = false }: {
  title: string;
  isNight: boolean;
  onBack: () => void;
  right?: ReactNode;
  compactTop?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: (compactTop ? 0 : insets.top) + 8 }]}>
      <ScreenBackButton isNight={isNight} onPress={onBack} />
      <Text accessibilityRole="header" numberOfLines={1} style={[styles.title, isNight && styles.nightText]}>{title}</Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

export function ScreenBackButton({ isNight, onPress }: { isNight: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Voltar"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.back, isNight && styles.nightBack, pressed && styles.pressed]}
    >
      <Ionicons color={isNight ? darkTheme.text : colors.ink} name="chevron-back" size={24} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14 },
  back: { ...controls.iconButton, backgroundColor: colors.paper, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  nightBack: { backgroundColor: darkTheme.surface, borderColor: darkTheme.border },
  title: { flex: 1, fontFamily: typography.editorial, fontSize: 24, lineHeight: 32, textAlign: 'center', color: colors.ink },
  nightText: { color: darkTheme.text },
  right: { width: controls.iconButton.width, height: controls.iconButton.height, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
});
