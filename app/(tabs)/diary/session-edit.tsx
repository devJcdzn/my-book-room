import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useContext, useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { TabBarContext } from '@/src/context/tab-bar-context';
import { useLibraryStore } from '@/src/store/library-store';
import { controls, colors, darkTheme, typography } from '@/src/theme';

export default function EditReadingSessionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const insets = useSafeAreaInsets();
  const sessions = useLibraryStore((state) => state.readingSessions);
  const updateSession = useLibraryStore((state) => state.updateReadingSession);
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const isNight = resolveAmbience(ambienceMode) === 'night';
  const session = sessions.find((item) => item.id === sessionId);
  const [name, setName] = useState(session?.name ?? '');
  const [description, setDescription] = useState(session?.description ?? '');
  const [pagesRead, setPagesRead] = useState(String(session?.pagesRead ?? 0));
  const [error, setError] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const { setIsTabBarHidden } = useContext(TabBarContext);

  useFocusEffect(useCallback(() => {
    setIsTabBarHidden(true);
    return () => setIsTabBarHidden(false);
  }, [setIsTabBarHidden]));

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const palette = isNight
    ? { background: darkTheme.bg, surface: darkTheme.surface, input: darkTheme.inputBg, border: darkTheme.inputBorder, text: darkTheme.text, muted: darkTheme.textMuted, accent: darkTheme.accent }
    : { background: colors.cream, surface: colors.paper, input: colors.softFill, border: colors.line, text: colors.ink, muted: colors.muted, accent: colors.terracotta };

  const save = () => {
    if (!session) return;
    const pages = Number(pagesRead);
    const endingPage = session.startingPage + pages;
    if (!name.trim()) {
      setError('Dê um nome para esta sessão.');
      return;
    }
    if (pagesRead.trim() === '' || !Number.isInteger(pages) || pages < 0 || endingPage > session.totalPages) {
      setError(`Informe um número entre 0 e ${session.totalPages - session.startingPage}.`);
      return;
    }
    updateSession(session.id, { name, description, endingPage });
    Keyboard.dismiss();
    router.back();
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <StatusBar style={isNight ? 'light' : 'dark'} />
      <Stack.Screen
        options={{
          title: 'Editar sessão',
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: palette.background },
          headerTintColor: palette.accent,
          headerTitleStyle: { color: palette.text, fontFamily: typography.editorial, fontSize: 21 },
          contentStyle: { backgroundColor: palette.background },
          headerRight: keyboardVisible ? () => (
            <Pressable accessibilityLabel="Ocultar teclado" accessibilityRole="button" hitSlop={10} onPress={() => Keyboard.dismiss()} style={styles.keyboardButton}>
              <Text style={[styles.keyboardButtonText, { color: palette.accent }]}>Concluir</Text>
            </Pressable>
          ) : undefined,
        }}
      />

      {session ? (
        <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoiding}>
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 26 }]}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.subtitle, { color: palette.muted }]}>{session.bookTitle} · {session.bookAuthor}</Text>

            <View style={styles.field}>
              <Text style={[styles.label, { color: palette.text }]}>Título</Text>
              <TextInput
                accessibilityLabel="Título da sessão"
                maxLength={80}
                onChangeText={(value) => { setName(value); setError(''); }}
                placeholder="Ex.: Leitura antes de dormir"
                placeholderTextColor={palette.muted}
                returnKeyType="next"
                selectionColor={palette.accent}
                style={[styles.input, { backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]}
                value={name}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: palette.text }]}>Descrição <Text style={{ color: palette.muted, fontWeight: '400' }}>Opcional</Text></Text>
              <TextInput
                accessibilityLabel="Descrição da sessão"
                maxLength={500}
                multiline
                onChangeText={setDescription}
                placeholder="O que ficou desta leitura?"
                placeholderTextColor={palette.muted}
                selectionColor={palette.accent}
                style={[styles.input, styles.descriptionInput, { backgroundColor: palette.input, borderColor: palette.border, color: palette.text }]}
                textAlignVertical="top"
                value={description}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: palette.text }]}>Páginas lidas</Text>
              <Text style={[styles.helper, { color: palette.muted }]}>A sessão começou na página {session.startingPage}.</Text>
              <View style={styles.pagesStepper}>
                <Pressable
                  accessibilityLabel="Diminuir páginas lidas"
                  accessibilityRole="button"
                  disabled={Number(pagesRead) <= 0}
                  onPress={() => { setPagesRead(String(Math.max(0, Number(pagesRead) - 1))); setError(''); }}
                  style={[styles.stepperButton, { backgroundColor: palette.input }]}
                >
                  <Ionicons color={Number(pagesRead) <= 0 ? palette.muted : palette.accent} name="remove" size={24} />
                </Pressable>
                <View style={[styles.pageValueGroup, { backgroundColor: palette.input, borderColor: palette.border }]}>
                  <TextInput
                    accessibilityLabel="Páginas lidas"
                    keyboardType="number-pad"
                    maxLength={5}
                    onChangeText={(value) => { setPagesRead(value.replace(/\D/g, '')); setError(''); }}
                    placeholder="0"
                    placeholderTextColor={palette.muted}
                    selectionColor={palette.accent}
                    style={[styles.pagesInput, { color: palette.text }]}
                    value={pagesRead}
                  />
                  <Text style={[styles.pageLimit, { color: palette.muted }]}>/ {session.totalPages - session.startingPage}</Text>
                </View>
                <Pressable
                  accessibilityLabel="Aumentar páginas lidas"
                  accessibilityRole="button"
                  disabled={Number(pagesRead) >= session.totalPages - session.startingPage}
                  onPress={() => { setPagesRead(String(Math.min(session.totalPages - session.startingPage, Number(pagesRead) + 1))); setError(''); }}
                  style={[styles.stepperButton, { backgroundColor: palette.input }]}
                >
                  <Ionicons color={Number(pagesRead) >= session.totalPages - session.startingPage ? palette.muted : palette.accent} name="add" size={24} />
                </Pressable>
              </View>
              <Text style={[styles.helper, { color: palette.muted }]}>Máximo: {session.totalPages - session.startingPage} páginas.</Text>
            </View>

            {error ? <Text accessibilityRole="alert" style={[styles.error, { color: palette.accent }]}>{error}</Text> : null}
            <Pressable accessibilityRole="button" onPress={save} style={({ pressed }) => [styles.saveButton, { backgroundColor: palette.accent }, pressed && styles.pressed]}>
              <Text style={[styles.saveButtonText, { color: isNight ? darkTheme.actionText : colors.white }]}>Salvar alterações</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.missingState}>
          <Text style={[styles.subtitle, { color: palette.muted }]}>Esta sessão não está disponível.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  keyboardAvoiding: { flex: 1 },
  content: { gap: 22, paddingHorizontal: 22, paddingTop: 20 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  field: { gap: 9 },
  label: { fontSize: 15, fontWeight: '600' },
  helper: { fontSize: 12, lineHeight: 17 },
  input: { ...controls.input },
  descriptionInput: { minHeight: 130, paddingTop: 13, lineHeight: 22 },
  pagesStepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pageValueGroup: { flex: 1, minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: controls.input.borderWidth, borderRadius: controls.input.borderRadius },
  stepperButton: { ...controls.iconButton },
  pagesInput: { ...controls.pageValue },
  pageLimit: { fontSize: 14, fontVariant: ['tabular-nums'] },
  error: { fontSize: 13, fontWeight: '600' },
  saveButton: { ...controls.button },
  saveButtonText: { ...controls.buttonText, color: colors.white },
  keyboardButton: { minHeight: controls.iconButton.height, justifyContent: 'center', paddingHorizontal: 8 },
  keyboardButtonText: { fontSize: 14, fontWeight: '600' },
  missingState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  pressed: { opacity: 0.8 },
});
