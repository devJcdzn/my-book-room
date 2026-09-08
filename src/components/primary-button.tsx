import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, radii } from '@/src/theme';

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
      disabled={isDisabled}
      style={(state) => [
        styles.base, secondary ? styles.secondary : styles.primary,
        isDisabled && styles.disabled, state.pressed && !isDisabled && styles.pressed,
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      {loading ? <ActivityIndicator color={colors.white} /> : (
        <Text style={[styles.label, secondary && styles.secondaryLabel]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, borderRadius: radii.medium, borderCurve: 'continuous' },
  primary: { backgroundColor: colors.terracotta },
  secondary: { backgroundColor: colors.sageSoft },
  label: { color: colors.white, fontSize: 16, fontWeight: '700' },
  secondaryLabel: { color: colors.ink },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
