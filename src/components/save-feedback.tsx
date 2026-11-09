import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { useLibraryStore } from '@/src/store/library-store';
import { colors, controls, darkTheme, radii } from '@/src/theme';
import { resolveAmbience } from '@/src/types/ambience';

const useSaveFeedback = create<{ current: { message: string; retry?: () => void; error?: boolean } | null }>(() => ({ current: null }));

export function showSaveFeedback(message: string) {
  useSaveFeedback.setState({ current: { message } });
}

export function showSaveFailure(message: string, retry?: () => void) {
  useSaveFeedback.setState({ current: { message, retry, error: true } });
}

export function SaveFeedback() {
  const current = useSaveFeedback(state => state.current);
  const ambience = useLibraryStore(state => state.ambienceMode);
  const isNight = resolveAmbience(ambience) === 'night';
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!current) return;
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(current.message);
    if (current.retry) return;
    const timeout = setTimeout(() => {
      if (useSaveFeedback.getState().current === current) useSaveFeedback.setState({ current: null });
    }, 2800);
    return () => clearTimeout(timeout);
  }, [current]);

  if (!current) return null;

  const dismiss = () => {
    if (useSaveFeedback.getState().current !== current) return;
    useSaveFeedback.setState({ current: null });
  };

  return (
    <View pointerEvents={current.retry ? 'box-none' : 'none'} style={[styles.overlay, { top: insets.top + 8 }]}>
      <View style={[styles.badge, {
        backgroundColor: isNight ? darkTheme.surface : colors.paper,
        borderColor: isNight ? darkTheme.border : colors.line,
      }]}>
        <Ionicons name={current.error ? 'alert-circle' : 'checkmark-circle'} size={19}
          color={current.error ? (isNight ? darkTheme.danger : colors.danger) : (isNight ? darkTheme.selectionText : colors.sageDark)}
          accessible={false} />
        <Text accessibilityLiveRegion="polite" style={[styles.label, { color: isNight ? darkTheme.text : colors.ink }]}>
          {current.message}
        </Text>
        {current.retry ? (
          <>
            <Pressable accessibilityRole="button" onPress={() => { dismiss(); current.retry?.(); }}
              style={({ pressed }) => [styles.retry, pressed && controls.buttonPressed]}>
              <Text style={{ color: isNight ? darkTheme.selectionText : colors.sageDark }}>Tentar novamente</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar aviso" onPress={dismiss}
              style={({ pressed }) => [controls.iconButton, pressed && controls.buttonPressed]}>
              <Ionicons name="close" size={18} color={isNight ? darkTheme.text : colors.ink} />
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', left: 18, right: 18, alignItems: 'center', zIndex: 1 },
  badge: { flexWrap: 'wrap', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radii.large, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth },
  retry: { minHeight: 44, justifyContent: 'center' },
  label: { flexShrink: 1, fontSize: 14, fontWeight: '500' },
});
