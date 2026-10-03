import * as ImagePicker from 'expo-image-picker';
import { AuthActions } from '@/src/components/auth-actions';
import { ProfileAvatar } from '@/src/components/profile-avatar';
import { prepareAvatar, removeLocalAvatar } from '@/src/services/profile-avatar';
import { useAuth } from '@/src/providers/auth-provider';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/src/components/primary-button';
import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { PROFILE_LIMITS, useLibraryStore } from '@/src/store/library-store';
import { controls, colors, darkTheme, typography } from '@/src/theme';

export default function EditProfileScreen() {
  const { user, isLoading, hasConflict } = useAuth();
  return <EditProfileForm key={`${user?.id ?? 'guest'}:${isLoading}:${hasConflict}`} />;
}

function EditProfileForm() {
  const insets = useSafeAreaInsets();
  const profile = useLibraryStore((state) => state.profile);
  const updateProfile = useLibraryStore((state) => state.updateProfile);
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const isNight = resolveAmbience(ambienceMode) === 'night';

  const { user, isLoading, hasConflict } = useAuth();
  const avatar = profile.avatar;
  const [photoDraft, setPhotoDraft] = useState<string | null>();
  const [saving, setSaving] = useState(false);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const actionInProgress = useRef(false);
  const scope = user?.id ?? 'guest';

  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio);
  const [bioAttribution, setBioAttribution] = useState(profile.bioAttribution);
  const [error, setError] = useState('');

  const handlePickPhoto = async () => {
    if (actionInProgress.current || isLoading || hasConflict) return;
    actionInProgress.current = true;
    setPickingPhoto(true);
    setError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
      if (!result.canceled) setPhotoDraft(result.assets[0].uri);
    } catch {
      setError('Não foi possível abrir sua galeria.');
    } finally {
      actionInProgress.current = false;
      setPickingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (actionInProgress.current || isLoading || hasConflict) return;
    const nextName = name.trim();
    if (!nextName) {
      setError('Digite um nome para continuar.');
      return;
    }

    actionInProgress.current = true;
    setSaving(true);
    const storageName = useLibraryStore.persist.getOptions().name;
    try {
      let nextAvatar = avatar;
      if (photoDraft === null) nextAvatar = { source: 'none', version: `${Date.now()}`, previousPath: avatar?.storagePath ?? avatar?.previousPath, pending: Boolean(user) };
      else if (photoDraft) nextAvatar = await prepareAvatar(photoDraft, scope, avatar);
      if (storageName !== useLibraryStore.persist.getOptions().name) return;
      updateProfile({ name: nextName, bio: bio.trim(), bioAttribution: bioAttribution.trim(), avatar: nextAvatar });
      if (photoDraft !== undefined && avatar?.localUri !== nextAvatar?.localUri) {
        try { removeLocalAvatar(avatar, scope); } catch { /* A cached old file must not block saving. */ }
      }
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a foto. Tente novamente.');
    } finally { actionInProgress.current = false; setSaving(false); }
  };

  const inputStyle = [styles.input, isNight && styles.nightInput];
  const placeholderColor = isNight ? darkTheme.textSubtle : colors.muted;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }]}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={[styles.screen, isNight && styles.nightScreen]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable accessibilityLabel="Voltar" accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, isNight && styles.nightBackButton, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" color={isNight ? darkTheme.text : colors.ink} size={22} />
        </Pressable>
        <View style={styles.headingCopy}>
          <Text accessibilityRole="header" style={[styles.title, isNight && styles.nightText]}>Editar perfil</Text>
          <Text style={[styles.subtitle, isNight && styles.nightMuted]}>Conte um pouco sobre você e sua jornada de leitura.</Text>
        </View>
      </View>
      <AuthActions isNight={isNight} />
      <View style={styles.identityHero}>
        <Image source={require('@/assets/images/profile-books-art.png')} contentFit="contain" accessible={false} pointerEvents="none" style={[styles.headerArtwork, isNight && styles.nightArtwork]} />
        <ProfileAvatar avatar={photoDraft === null ? undefined : photoDraft ? { source: 'custom', version: photoDraft, localUri: photoDraft } : avatar} name={name} size={104} />
        <View style={styles.identityCopy}>
          <Text style={[styles.identityName, isNight && styles.nightText]} numberOfLines={2}>{name.trim() || 'Leitor(a)'}</Text>
          <Text style={[styles.description, isNight && styles.nightMuted]}>Seu cantinho de leitura</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: pickingPhoto, disabled: saving || pickingPhoto || isLoading || hasConflict }}
          style={[styles.photoButton, isNight && styles.nightPhotoButton]}
          disabled={saving || pickingPhoto || isLoading || hasConflict}
          onPress={() => { void handlePickPhoto(); }}
        >
          {pickingPhoto ? <ActivityIndicator size="small" color={isNight ? darkTheme.accent : colors.terracottaDark} /> : <Ionicons name="image-outline" size={18} color={isNight ? darkTheme.accent : colors.terracottaDark} />}
          <Text style={[styles.photoButtonText, { color: isNight ? darkTheme.accent : colors.terracottaDark }]}>{pickingPhoto ? 'Abrindo galeria…' : 'Escolher foto'}</Text>
        </Pressable>
        {(photoDraft || (photoDraft !== null && avatar?.source !== 'none' && avatar)) && <Pressable
          accessibilityRole="button"
          style={[styles.photoButton, styles.removePhotoButton, isNight && styles.nightRemovePhotoButton]}
          disabled={saving || pickingPhoto || isLoading || hasConflict}
          onPress={() => setPhotoDraft(null)}
        >
          <Ionicons name="trash-outline" size={18} color={isNight ? '#F0A298' : '#B64135'} />
          <Text style={[styles.photoButtonText, { color: isNight ? '#F0A298' : '#B64135' }]}>Remover foto</Text>
        </Pressable>}
      </View>
      <View style={[styles.form, isNight && styles.nightCard]}>
        <View style={styles.field}>
          <FieldLabel label="Nome" isNight={isNight} />
          <TextInput
            accessibilityLabel="Nome do perfil"
            autoCapitalize="words"
            maxLength={PROFILE_LIMITS.name}
            onChangeText={(value) => {
              setName(value);
              if (error) setError('');
            }}
            placeholder="Como quer ser chamado?"
            placeholderTextColor={placeholderColor}
            returnKeyType="done"
            style={inputStyle}
            value={name}
          />
          <Counter value={name.length} max={PROFILE_LIMITS.name} isNight={isNight} />
        </View>

        <View style={styles.field}>
          <FieldLabel label="Bio ou citação" optional isNight={isNight} />
          <TextInput
            accessibilityLabel="Bio ou citação do perfil"
            maxLength={PROFILE_LIMITS.bio}
            multiline
            onChangeText={setBio}
            placeholder="Uma frase para acompanhar suas leituras"
            placeholderTextColor={placeholderColor}
            scrollEnabled={false}
            style={[...inputStyle, styles.bioInput]}
            textAlignVertical="top"
            value={bio}
          />
          <Counter value={bio.length} max={PROFILE_LIMITS.bio} isNight={isNight} />
        </View>

        <View style={styles.field}>
          <FieldLabel label="Autoria ou fonte" optional isNight={isNight} />
          <TextInput
            accessibilityLabel="Autoria ou fonte da bio"
            maxLength={PROFILE_LIMITS.bioAttribution}
            onChangeText={setBioAttribution}
            placeholder="Ex.: Jorge Luis Borges"
            placeholderTextColor={placeholderColor}
            style={inputStyle}
            value={bioAttribution}
          />
          <Counter value={bioAttribution.length} max={PROFILE_LIMITS.bioAttribution} isNight={isNight} />
        </View>
      </View>

      <View style={[styles.preview, isNight && styles.nightPreview]}>
        <View style={styles.previewHeading}>
          <Text style={[styles.previewTitle, isNight && styles.nightText]}>Prévia</Text>
          <Text style={[styles.description, isNight && styles.nightMuted]}>Assim seu perfil será exibido.</Text>
        </View>
        <View style={[styles.previewCard, isNight && styles.nightCard]}>
          <Image source={require('@/assets/images/profile-books-art.png')} contentFit="contain" accessible={false} pointerEvents="none" style={[styles.previewArtwork, isNight && styles.nightArtwork]} />
          <View style={styles.identity}>
            <ProfileAvatar avatar={photoDraft === null ? undefined : photoDraft ? { source: 'custom', version: photoDraft, localUri: photoDraft } : avatar} name={name} size={50} />
            <Text style={[styles.previewName, isNight && styles.nightText]}>{name.trim() || 'Leitor(a)'}</Text>
          </View>
          {bio.trim() ? (
            <View style={[styles.previewQuote, isNight && styles.nightDivider]}>
              <Text selectable style={[styles.quote, isNight && styles.nightText]}>“{bio.trim()}”</Text>
              {bioAttribution.trim() ? <Text selectable style={[styles.description, isNight && styles.nightMuted]}>— {bioAttribution.trim()}</Text> : null}
            </View>
          ) : null}
        </View>
      </View>

      {error ? <Text accessibilityRole="alert" selectable style={styles.error}>{error}</Text> : null}
      <PrimaryButton
        label={saving ? "Salvando…" : "Salvar perfil"}
        loading={saving}
        disabled={pickingPhoto || isLoading || hasConflict}
        onPress={() => { void handleSave(); }}
        style={[styles.saveButton, isNight && styles.nightSaveButton]}
      />
    </ScrollView>
  );
}

function FieldLabel({ label, optional, isNight }: { label: string; optional?: boolean; isNight: boolean }) {
  return (
    <View style={styles.labelRow}>
      <Text selectable style={[styles.label, isNight && styles.nightText]}>{label}</Text>
      {optional ? <Text style={[styles.optional, isNight && styles.nightMuted]}>Opcional</Text> : null}
    </View>
  );
}

function Counter({ value, max, isNight }: { value: number; max: number; isNight: boolean }) {
  return (
    <Text selectable style={[styles.counter, isNight && styles.nightMuted]}>
      {value}/{max}
    </Text>
  );
}

const styles = StyleSheet.create({
  photoButton: { minHeight: 44, paddingHorizontal: 14, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.softFill },
  removePhotoButton: { backgroundColor: 'rgba(182,65,53,0.08)' },
  nightRemovePhotoButton: { backgroundColor: 'rgba(240,162,152,0.12)' },
  nightPhotoButton: { backgroundColor: darkTheme.surfaceElevated },
  photoButtonText: { fontFamily: typography.ui, fontSize: 14, fontWeight: '600' },
  screen: { flex: 1, backgroundColor: colors.cream },
  nightScreen: { backgroundColor: darkTheme.bg },
  content: { width: '100%', maxWidth: 600, alignSelf: 'center', gap: 18, paddingHorizontal: 18 },
  header: { minHeight: 94, alignItems: 'center', justifyContent: 'center' },
  headingCopy: { maxWidth: 250, paddingHorizontal: 18, alignItems: 'center', gap: 5 },
  title: { color: colors.ink, fontFamily: typography.editorial, fontSize: 25, lineHeight: 34 },
  subtitle: { color: colors.inkSoft, fontFamily: typography.ui, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  backButton: { ...controls.iconButton, position: 'absolute', left: 0, top: 2, backgroundColor: '#F3D7C6' },
  nightBackButton: { backgroundColor: darkTheme.surfaceElevated },
  pressed: { opacity: 0.7 },
  identityHero: { minHeight: 122, flexDirection: 'row', alignItems: 'center', gap: 18, paddingLeft: 10, paddingRight: 76 },
  headerArtwork: { position: 'absolute', width: 112, height: 140, right: -36, top: -40 },
  previewArtwork: { position: 'absolute', width: 84, height: 96, right: -8, bottom: -4 },
  nightArtwork: { opacity: 0.75 },
  optional: { color: colors.muted, fontFamily: typography.ui, fontSize: 12 },
  description: { color: colors.muted, fontFamily: typography.ui, fontSize: 14, lineHeight: 21 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  identityCopy: { flex: 1, gap: 4 },
  identityName: { color: colors.ink, fontFamily: typography.editorial, fontSize: 23, lineHeight: 31 },
  avatar: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.terracotta },
  avatarText: { color: colors.paper, fontFamily: typography.editorial, fontSize: 46 },
  preview: { gap: 14, padding: 14, borderRadius: 24, borderCurve: 'continuous', backgroundColor: colors.sageSoft },
  previewHeading: { gap: 2, paddingHorizontal: 4 },
  previewTitle: { color: colors.ink, fontFamily: typography.editorial, fontSize: 22, lineHeight: 30 },
  previewCard: { gap: 16, padding: 18, overflow: 'hidden', borderRadius: 20, borderCurve: 'continuous', backgroundColor: colors.paper },
  previewAvatar: { width: 50, height: 50, borderRadius: 25 },
  previewAvatarText: { fontSize: 24 },
  previewName: { flex: 1, color: colors.ink, fontFamily: typography.editorial, fontSize: 24, lineHeight: 32 },
  previewQuote: { gap: 8, paddingTop: 14, paddingRight: 60, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  quote: { color: colors.ink, fontFamily: typography.editorial, fontSize: 17, lineHeight: 26 },
  nightCard: { backgroundColor: darkTheme.surface },
  nightPreview: { backgroundColor: '#293526' },
  nightDivider: { borderTopColor: darkTheme.border },
  form: { gap: 18, padding: 18, borderRadius: 24, borderCurve: 'continuous', backgroundColor: colors.paper },
  field: { gap: 8 },
  labelRow: { minHeight: 22, flexDirection: 'row', alignItems: 'baseline', gap: 7 },
  label: { color: colors.ink, fontFamily: typography.ui, fontSize: 16, fontWeight: '600' },
  input: { ...controls.input, backgroundColor: colors.cream, color: colors.ink, fontFamily: typography.ui, borderColor: colors.line },
  nightInput: {
    backgroundColor: darkTheme.inputBg,
    borderColor: darkTheme.inputBorder,
    color: darkTheme.text,
  },
  bioInput: { minHeight: 94, lineHeight: 22 },
  counter: { alignSelf: 'flex-end', color: colors.muted, fontSize: 12, fontVariant: ['tabular-nums'] },
  error: { color: colors.terracotta, fontSize: 14, fontWeight: '600' },
  nightText: { color: darkTheme.text },
  nightMuted: { color: darkTheme.textMuted },
  saveButton: { ...controls.button, backgroundColor: colors.terracotta },
  nightSaveButton: { backgroundColor: colors.terracotta },
});
