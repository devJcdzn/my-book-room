import { useState, type Ref } from 'react';
import { StyleSheet, Text, TextInput, type TextInputProps } from 'react-native';

import { useLibraryStore } from '@/src/store/library-store';
import { colors, darkTheme, typography } from '@/src/theme';
import { resolveAmbience } from '@/src/types/ambience';

export function AppTextInput({
  invalid = false, ref, style, onFocus, onBlur, editable = true, accessibilityState,
  keyboardAppearance, selectionColor, placeholderTextColor, ...props
}: TextInputProps & { ref?: Ref<TextInput>; invalid?: boolean }) {
  const [focused, setFocused] = useState(false);
  const ambience = useLibraryStore(state => state.ambienceMode);
  const isNight = keyboardAppearance === 'dark' ||
    (keyboardAppearance !== 'light' && resolveAmbience(ambience) === 'night');
  const accent = isNight ? darkTheme.selectionText : colors.sageDark;
  const frame = StyleSheet.flatten(style);
  const hasBorder = Boolean(frame?.borderWidth || frame?.borderBottomWidth);

  return (
    <TextInput
      {...props}
      ref={ref}
      editable={editable}
      accessibilityState={{ ...accessibilityState, disabled: !editable || accessibilityState?.disabled }}
      keyboardAppearance={keyboardAppearance ?? (isNight ? 'dark' : 'light')}
      placeholderTextColor={placeholderTextColor ?? (isNight ? darkTheme.textMuted : colors.muted)}
      selectionColor={selectionColor ?? accent}
      onFocus={event => { setFocused(true); onFocus?.(event); }}
      onBlur={event => { setFocused(false); onBlur?.(event); }}
      style={[
        { fontFamily: typography.ui, color: isNight ? darkTheme.text : colors.ink },
        style,
        hasBorder && styles.frame,
        hasBorder && (invalid || (focused && editable)) && { borderColor: invalid ? (isNight ? darkTheme.danger : colors.danger) : accent },
        !editable && styles.readOnly,
      ]}
    />
  );
}

export function FieldError({ message, isNight }: { message?: string; isNight: boolean }) {
  if (!message) return null;
  return (
    <Text accessibilityRole="alert" accessibilityLiveRegion="polite"
      style={[styles.error, { color: isNight ? darkTheme.danger : colors.danger }]}>
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  error: { fontSize: 13, marginTop: 4 },
  frame: { borderCurve: 'continuous' },
  readOnly: { opacity: 0.65 },
});
