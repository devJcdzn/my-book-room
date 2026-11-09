import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenHeader } from '@/src/components/screen-header';
import { resolveAmbience } from '@/src/types/ambience';
import { getLibraryPalette, LIBRARY_PALETTES } from '@/src/library-palette';
import { useLibraryStore } from '@/src/store/library-store';
import { colors, darkTheme, radii, typography } from '@/src/theme';

const paletteRows = Array.from({ length: Math.ceil(LIBRARY_PALETTES.length / 3) }, (_, index) =>
  LIBRARY_PALETTES.slice(index * 3, index * 3 + 3),
);

export default function LibraryAppearanceScreen() {
  const selectedId = useLibraryStore((state) => state.libraryBackgroundId);
  const setSelectedId = useLibraryStore((state) => state.setLibraryBackgroundId);
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const isNight = resolveAmbience(ambienceMode) === 'night';
  const accent = isNight ? darkTheme.selectionText : colors.sageDark;
  const palette = getLibraryPalette(selectedId)[isNight ? 'dark' : 'light'];

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <Stack.Screen options={{ title: 'Aparência', contentStyle: { backgroundColor: palette.background } }} />
      <ScreenHeader
        title="Aparência"
        isNight={isNight}
        onBack={() => router.canGoBack() ? router.back() : router.replace('/books')}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        style={{ backgroundColor: palette.background }}
      >
        <Text accessibilityRole="header" style={[styles.title, { color: palette.text }]}>Fundos da Biblioteca</Text>
        <View style={styles.options}>
          {paletteRows.map((row, rowIndex) => (
            <View key={`palette-row-${rowIndex}`} style={styles.optionRow}>
              {row.map((option) => {
                const selected = option.id === selectedId;
                const preview = getLibraryPalette(option.id)[isNight ? 'dark' : 'light'];
                return (
                  <Pressable
                    key={option.id}
                    accessibilityLabel={`Selecionar fundo ${option.label}`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      if (process.env.EXPO_OS === 'ios') void Haptics.selectionAsync();
                      setSelectedId(option.id);
                    }}
                    style={({ pressed }) => [styles.option, pressed && styles.pressed]}
                  >
                    <View style={[styles.preview, {
                      backgroundColor: preview.background,
                      borderColor: selected ? accent : palette.border,
                    }, selected && styles.selectedOption]}>
                      <View style={styles.shelf}>
                        <Image source={require('@/assets/images/library-shelf.png')} contentFit="fill"
                          style={[styles.wood, isNight && styles.nightWood]} accessible={false} />
                      </View>
                      {selected ? (
                        <View style={[styles.check, { backgroundColor: accent }]}>
                          <Ionicons name="checkmark" size={15} color={isNight ? darkTheme.bg : colors.paper} accessible={false} />
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.label, { color: selected ? accent : palette.mutedText }]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 36, gap: 20 },
  title: { fontFamily: typography.editorial, fontSize: 22, lineHeight: 29 },
  options: { gap: 16 },
  optionRow: { flexDirection: 'row', gap: 10 },
  option: { width: '31%', gap: 5 },
  preview: { aspectRatio: 1.2, borderWidth: 1, borderRadius: radii.medium, borderCurve: 'continuous', overflow: 'hidden' },
  selectedOption: { borderWidth: 2 },
  shelf: { position: 'absolute', left: 5, right: 5, bottom: '24%', height: 10, overflow: 'hidden', borderRadius: 2 },
  wood: { position: 'absolute', width: '104%', left: '-2%', height: 118, top: -55 },
  nightWood: { opacity: 0.72 },
  check: { position: 'absolute', top: 5, right: 5, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  pressed: { opacity: 0.75 },
});
