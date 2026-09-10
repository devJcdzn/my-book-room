import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/src/components/primary-button';
import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { PROFILE_LIMITS, useLibraryStore } from '@/src/store/library-store';
import { colors, darkTheme, radii, typography } from '@/src/theme';

export default function EditProfileScreen() {
  const profile = useLibraryStore((state) => state.profile);
  const updateProfile = useLibraryStore((state) => state.updateProfile);
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const isNight = resolveAmbience(ambienceMode) === 'night';

  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio);
  const [bioAttribution, setBioAttribution] = useState(profile.bioAttribution);
  const [error, setError] = useState('');

  const handleSave = () => {
    const nextName = name.trim();
    if (!nextName) {
      setError('Digite um nome para continuar.');
      return;
    }

    updateProfile({
      name: nextName,
      bio: bio.trim(),
      bioAttribution: bioAttribution.trim(),
    });
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Editar perfil' }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={[styles.screen, isNight && styles.darkScreen]}
      >
        <View style={styles.header}>
          <View style={styles.headerTitles}>
            <Text selectable style={[styles.title, isNight && styles.darkTitle]}>Editar perfil</Text>
            <Text selectable style={[styles.subtitle, isNight && styles.darkMutedText]}>
              Deixe seu refúgio com a sua voz.
            </Text>
          </View>
          <Pressable
            accessibilityHint="Fecha o editor de perfil"
            accessibilityLabel="Fechar"
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.closeButton, isNight && styles.darkCloseButton, pressed && styles.pressed]}
          >
            <Ionicons color={isNight ? '#FAF4EB' : colors.ink} name="close" size={20} />
          </Pressable>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text selectable style={[styles.label, isNight && styles.darkMutedText]}>Nome</Text>
            <TextInput
              accessibilityLabel="Nome do perfil"
              autoCapitalize="words"
              maxLength={PROFILE_LIMITS.name}
              onChangeText={(value) => {
                setName(value);
                if (error) setError('');
              }}
              placeholder="Como quer ser chamado?"
              placeholderTextColor={isNight ? darkTheme.textSubtle : colors.muted}
              returnKeyType="done"
              style={[styles.input, isNight && styles.darkInput]}
              value={name}
            />
            <Text selectable style={[styles.counter, isNight && styles.darkSubtleText]}>
              {name.length}/{PROFILE_LIMITS.name}
            </Text>
          </View>

          <View style={styles.field}>
            <Text selectable style={[styles.label, isNight && styles.darkMutedText]}>Bio ou citação</Text>
            <TextInput
              accessibilityLabel="Bio ou citação do perfil"
              maxLength={PROFILE_LIMITS.bio}
              multiline
              onChangeText={setBio}
              placeholder="Uma frase para acompanhar suas leituras"
              placeholderTextColor={isNight ? darkTheme.textSubtle : colors.muted}
              scrollEnabled={false}
              style={[styles.input, styles.bioInput, isNight && styles.darkInput]}
              textAlignVertical="top"
              value={bio}
            />
            <Text selectable style={[styles.counter, isNight && styles.darkSubtleText]}>
              {bio.length}/{PROFILE_LIMITS.bio}
            </Text>
          </View>

          <View style={styles.field}>
            <Text selectable style={[styles.label, isNight && styles.darkMutedText]}>Autoria ou fonte (opcional)</Text>
            <TextInput
              accessibilityLabel="Autoria ou fonte da bio"
              maxLength={PROFILE_LIMITS.bioAttribution}
              onChangeText={setBioAttribution}
              placeholder="Ex.: Jorge Luis Borges"
              placeholderTextColor={isNight ? darkTheme.textSubtle : colors.muted}
              style={[styles.input, isNight && styles.darkInput]}
              value={bioAttribution}
            />
            <Text selectable style={[styles.counter, isNight && styles.darkSubtleText]}>
              {bioAttribution.length}/{PROFILE_LIMITS.bioAttribution}
            </Text>
          </View>
        </View>

        {error ? <Text selectable style={styles.error}>{error}</Text> : null}
        <PrimaryButton label="Salvar perfil" onPress={handleSave} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  darkScreen: { backgroundColor: darkTheme.bg },
  content: { gap: 24, padding: 20, paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  headerTitles: { flex: 1, gap: 4 },
  title: { color: colors.ink, fontFamily: typography.editorial, fontSize: 24, fontWeight: '600' },
  subtitle: { color: colors.muted, fontFamily: typography.ui, fontSize: 13, lineHeight: 19 },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  darkCloseButton: { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  form: { gap: 18 },
  field: { gap: 8 },
  label: { color: colors.muted, fontFamily: typography.ui, fontSize: 12, fontWeight: '700' },
  input: {
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radii.medium,
    borderCurve: 'continuous',
    backgroundColor: colors.softFill,
    color: colors.ink,
    fontFamily: typography.ui,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.lineSubtle,
  },
  darkInput: { backgroundColor: darkTheme.surfaceElevated, borderColor: darkTheme.borderSubtle, color: darkTheme.text },
  bioInput: { minHeight: 116, lineHeight: 22 },
  counter: { alignSelf: 'flex-end', color: colors.mutedLight, fontSize: 11, fontVariant: ['tabular-nums'] },
  error: { color: '#B73E35', fontSize: 13, fontWeight: '600' },
  darkTitle: { color: darkTheme.text },
  darkMutedText: { color: darkTheme.textMuted },
  darkSubtleText: { color: darkTheme.textSubtle },
});
