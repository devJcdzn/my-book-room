import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { controls, colors } from '@/src/theme';

type Props = ComponentProps<typeof Pressable> & {
  label: string;
  loading?: boolean;
  tone?: 'primary' | 'secondary';
};

export function PrimaryButton({ label, loading = false, tone = 'primary', disabled, style, accessibilityLabel, ...props }: Props) {
  const isDisabled = disabled || loading;
  const secondary = tone === 'secondary';
  return (
    <Pressable
      {...props}
      accessible
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ ...props.accessibilityState, disabled: Boolean(isDisabled), busy: loading }}
      disabled={isDisabled}
      style={(state) => [
        styles.base, secondary ? styles.secondary : styles.primary,
        isDisabled && styles.disabled, state.pressed && !isDisabled && styles.pressed,
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      {loading && <ActivityIndicator color={secondary ? colors.ink : colors.white} />}
      <Text style={[styles.label, secondary && styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { ...controls.button, flexDirection: 'row', gap: 8 },
  primary: { backgroundColor: colors.terracotta },
  secondary: { backgroundColor: colors.sageSoft },
  label: { ...controls.buttonText, color: colors.white },
  secondaryLabel: { color: colors.ink },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
