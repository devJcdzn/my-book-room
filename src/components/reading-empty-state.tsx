import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, controls, darkTheme, typography } from '@/src/theme';

export function ReadingEmptyState({ isNight, artwork, title, description, label, icon, onPress }: {
  isNight: boolean;
  artwork?: number;
  title: string;
  description: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <View style={styles.content}>
      {artwork ? <Image source={artwork} contentFit="contain" style={styles.artwork} accessible={false} /> : null}
      <Text accessibilityRole="header" style={[styles.title, { color: isNight ? darkTheme.text : colors.ink }]}>{title}</Text>
      <Text style={[styles.description, { color: isNight ? darkTheme.textMuted : colors.muted }]}>{description}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
        style={({ pressed }) => [styles.button, { backgroundColor: isNight ? darkTheme.primary : colors.ink }, pressed && styles.pressed]}>
        <Ionicons name={icon} size={19} color={isNight ? darkTheme.actionText : colors.paper} accessible={false} />
        <Text style={[styles.label, isNight && { color: darkTheme.actionText }]}>{label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 16 },
  artwork: { width: '100%', maxWidth: 180, height: 138 },
  title: { fontFamily: typography.editorial, fontSize: 24, lineHeight: 32, textAlign: 'center' },
  description: { maxWidth: 310, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  button: { ...controls.button, minHeight: 48, flexDirection: 'row', gap: 8, marginTop: 4 },
  label: { ...controls.buttonText, color: colors.paper, flexShrink: 1, textAlign: 'center' },
  pressed: controls.buttonPressed,
});
