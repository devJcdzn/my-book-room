import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { controls, colors, darkTheme, typography } from '@/src/theme';

type Props = ComponentProps<typeof Pressable> & {
  label: string;
  loading?: boolean;
  isNight?: boolean;
  tone?: 'primary' | 'secondary';
};

export function PrimaryButton({ label, loading = false, tone = 'primary', isNight = false, disabled, style, accessibilityLabel, ...props }: Props) {
  const isDisabled = disabled || loading;
  const secondary = tone === 'secondary';
  const backgroundColor = secondary ? (isNight ? darkTheme.selection : colors.sageSoft) : (isNight ? darkTheme.primary : colors.ink);
  const color = secondary ? (isNight ? darkTheme.selectionText : colors.ink) : (isNight ? darkTheme.actionText : colors.white);
  return (
    <Pressable
      {...props}
      accessible
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ ...props.accessibilityState, disabled: Boolean(isDisabled), busy: loading }}
      disabled={isDisabled}
      style={(state) => [
        styles.base, { backgroundColor },
        disabled && !loading && styles.disabled, state.pressed && !isDisabled && styles.pressed,
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      {loading && <ActivityIndicator size="small" accessible={false} color={color} />}
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { ...controls.button, flexDirection: 'row', gap: 8 },
  label: { ...controls.buttonText, flexShrink: 1, textAlign: 'center', fontFamily: typography.ui, color: colors.white },
  disabled: controls.buttonDisabled,
  pressed: controls.buttonPressed,
});
