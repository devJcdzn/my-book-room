import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { resolveAmbience } from '@/src/components/room/isometric-scene';
import { getLibraryPalette, LIBRARY_PALETTES } from '@/src/library-palette';
import { useLibraryStore } from '@/src/store/library-store';
import { colors, darkTheme, typography } from '@/src/theme';

const paletteRows = Array.from({ length: Math.ceil(LIBRARY_PALETTES.length / 3) }, (_, index) =>
  LIBRARY_PALETTES.slice(index * 3, index * 3 + 3),
);

export default function LibraryAppearanceScreen() {
  const selectedId = useLibraryStore((state) => state.libraryBackgroundId);
  const setSelectedId = useLibraryStore((state) => state.setLibraryBackgroundId);
  const ambienceMode = useLibraryStore((state) => state.ambienceMode);
  const isNight = resolveAmbience(ambienceMode) === 'night';
  const palette = getLibraryPalette(selectedId)[isNight ? 'dark' : 'light'];

  return (
    <>
      <Stack.Screen options={{
        title: 'Aparência',
        headerBackButtonDisplayMode: 'minimal',
        headerTintColor: isNight ? darkTheme.accent : colors.terracotta,
        headerStyle: { backgroundColor: palette.background },
        contentStyle: { backgroundColor: palette.background },
      }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        style={{ backgroundColor: palette.background }}
      >
        <View style={styles.intro}>
          <Text style={[styles.title, { color: palette.text }]}>Cor de fundo</Text>
          <Text style={[styles.subtitle, { color: palette.mutedText }]}>Personaliza apenas a Biblioteca.</Text>
        </View>
        <View style={styles.options}>
          {paletteRows.map((row, rowIndex) => (
            <View key={`palette-row-${rowIndex}`} style={styles.optionRow}>
              {row.map((option) => {
                const selected = option.id === selectedId;
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
                    style={({ pressed }) => [styles.option, { backgroundColor: getLibraryPalette(option.id)[isNight ? 'dark' : 'light'].background, borderColor: selected ? (isNight ? darkTheme.accent : colors.terracotta) : palette.border }, selected && styles.selectedOption, pressed && styles.pressed]}
                  >
                    {selected ? <Ionicons color={isNight ? darkTheme.accent : colors.terracotta} name="checkmark-circle" size={24} /> : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 36, gap: 20 },
  intro: { gap: 4 },
  title: { fontFamily: typography.ui, fontSize: 16, fontWeight: '600', lineHeight: 22 },
  subtitle: { fontSize: 13, lineHeight: 18 },
  options: { gap: 12 },
  optionRow: { flexDirection: 'row', justifyContent: 'flex-start', columnGap: 12 },
  option: { width: '31%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 16, borderCurve: 'continuous' },
  selectedOption: { borderWidth: 2 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
});
