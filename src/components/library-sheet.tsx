import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';

import { typography } from '@/src/theme';

export function LibrarySheet({
  children,
  description,
  height,
  onClose,
  title,
  visible,
  backgroundColor,
  textColor,
  mutedColor,
}: {
  children: ReactNode;
  description: string;
  height: number;
  onClose: () => void;
  title: string;
  visible: boolean;
  backgroundColor: string;
  textColor: string;
  mutedColor: string;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal animationType="fade" onRequestClose={onClose} statusBarTranslucent transparent visible={visible}>
      <View style={styles.overlay}>
        <Pressable accessibilityLabel="Fechar" onPress={onClose} style={StyleSheet.absoluteFill} />
        <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoiding}>
          <View style={[styles.sheet, { backgroundColor, height, paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.grabber} />
            <Text style={[styles.title, { color: textColor }]}>{title}</Text>
            <Text style={[styles.description, { color: mutedColor }]}>{description}</Text>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={styles.scroll}>
              {children}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(22, 18, 15, 0.42)' },
  keyboardAvoiding: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '88%',
    paddingTop: 10,
    paddingHorizontal: 22,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderCurve: 'continuous',
  },
  grabber: { width: 44, height: 5, alignSelf: 'center', marginBottom: 14, borderRadius: 3, backgroundColor: 'rgba(120, 108, 98, 0.36)' },
  title: { marginBottom: 5, fontFamily: typography.editorial, fontSize: 25, fontWeight: '600', lineHeight: 32 },
  description: { marginBottom: 18, fontSize: 14, lineHeight: 20 },
  scroll: { flex: 1, flexShrink: 1 },
  scrollContent: { paddingBottom: 8 },
});
