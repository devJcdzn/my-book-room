import { TransitionModal } from '@/src/components/transition-modal';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { create } from 'zustand';

import { useLibraryStore } from '@/src/store/library-store';
import { colors, controls, darkTheme, typography } from '@/src/theme';
import { resolveAmbience } from '@/src/types/ambience';

type DialogAction = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
  selected?: boolean;
  opensMenu?: boolean;
};

type Dialog = {
  title: string;
  message?: string;
  actions: DialogAction[];
  dismissible: boolean;
  menu?: boolean;
};

const useDialog = create<{ current: Dialog | null }>(() => ({ current: null }));

export function showAlert(
  title: string,
  message?: string,
  actions: DialogAction[] = [{ text: 'OK' }],
  options?: { cancelable?: boolean },
) {
  useDialog.setState({ current: { title, message, actions, dismissible: options?.cancelable ?? false } });
}

export function showMenu(title: string, actions: DialogAction[]) {
  useDialog.setState({ current: {
    title, menu: true, dismissible: true,
    actions: [...actions, { text: 'Fechar', style: 'cancel' }],
  } });
}

export function AppDialog({ enabled = true }: { enabled?: boolean }) {
  const dialog = useDialog(state => state.current);
  const ambience = useLibraryStore(state => state.ambienceMode);
  const isNight = resolveAmbience(ambience) === 'night';
  const paper = isNight ? darkTheme.surface : colors.paper;
  const ink = isNight ? darkTheme.text : colors.ink;
  const muted = isNight ? darkTheme.textMuted : colors.muted;
  const line = isNight ? darkTheme.border : colors.line;
  const accent = isNight ? darkTheme.selectionText : colors.sageDark;
  const danger = isNight ? darkTheme.danger : colors.danger;

  if (!enabled || !dialog) return null;

  const select = (action?: DialogAction) => {
    if (useDialog.getState().current !== dialog) return;
    useDialog.setState({ current: null });
    action?.onPress?.();
  };
  const cancel = () => {
    if (dialog.dismissible) select(dialog.actions.find(action => action.style === 'cancel'));
  };
  const primary = dialog.actions.find(action => !action.style || action.style === 'default')
    ?? dialog.actions.find(action => action.style === 'destructive');
  const actions = [
    ...dialog.actions.filter(action => action.style !== 'cancel'),
    ...dialog.actions.filter(action => action.style === 'cancel'),
  ];

  return (
    <TransitionModal transparent visible onRequestClose={cancel} statusBarTranslucent>
      <View style={styles.overlay} accessibilityViewIsModal>
        <Pressable accessible={false} onPress={cancel} style={StyleSheet.absoluteFill} />
        <View style={[styles.card, { backgroundColor: paper, borderColor: line }]}>
          <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <Text accessibilityRole="header" style={[styles.title, { color: ink }]}>{dialog.title}</Text>
            {dialog.message ? <Text style={[styles.message, { color: muted }]}>{dialog.message}</Text> : null}
            <View style={styles.actions}>
              {actions.map((action, index) => {
                const prominent = !dialog.menu && action === primary;
                const destructive = action.style === 'destructive';
                const quiet = action.style === 'cancel';
                const fill = destructive ? danger : isNight ? darkTheme.primary : colors.ink;
                const labelColor = prominent
                  ? (isNight ? darkTheme.actionText : colors.paper)
                  : destructive ? danger : ink;
                const backgroundColor = prominent
                  ? fill
                  : quiet ? 'transparent' : action.selected ? (isNight ? darkTheme.selection : colors.sageSoft) : isNight ? darkTheme.surfaceElevated : colors.softFill;
                return (
                  <Pressable
                    key={index}
                    accessibilityRole="button"
                    accessibilityState={action.selected === undefined ? undefined : { selected: action.selected }}
                    onPress={() => select(action)}
                    style={({ pressed }) => [styles.action, (!dialog.menu || quiet) && styles.centeredAction, { backgroundColor }, pressed && styles.pressed]}
                  >
                    <Text style={[styles.label, { color: labelColor }]}>{action.text}</Text>
                    {action.selected || action.opensMenu ? (
                      <Ionicons name={action.selected ? 'checkmark' : 'chevron-forward'} size={18} color={accent} accessible={false} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </TransitionModal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(22, 18, 15, 0.46)' },
  card: { width: '100%', maxWidth: 352, maxHeight: '85%', borderRadius: 28, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  content: { padding: 22, gap: 8 },
  title: { fontFamily: typography.editorial, fontSize: 24, lineHeight: 31 },
  message: { fontSize: 15, lineHeight: 22 },
  actions: { marginTop: 14, gap: 8 },
  action: { ...controls.button, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, gap: 8 },
  centeredAction: { justifyContent: 'center' },
  label: { ...controls.buttonText, flexShrink: 1 },
  pressed: controls.buttonPressed,
});
