import { READING_NOTE_COLORS } from '@/src/utils/reading-note';

import { Platform, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

export const colors = {
  ink: '#32251F',
  inkSoft: '#504138',
  muted: '#807267',
  mutedLight: '#A3968B',
  cream: '#F6EFE5',
  paper: '#FAF5EE',
  softFill: '#EFE6D8',
  line: '#E3D7C7',
  lineSubtle: 'rgba(50, 37, 31, 0.07)',
  terracotta: '#B65A3D',
  terracottaDark: '#8C3F2B',
  terracottaSoft: 'rgba(182, 90, 61, 0.09)',
  sage: '#657457',
  sageSoft: '#E0E5DA',
  white: '#FFFFFF',
};

export const darkTheme = {
  bg: '#201E1C',
  surface: '#2B2825',
  surfaceElevated: '#35312D',
  border: '#4B443D',
  borderSubtle: 'rgba(238, 229, 216, 0.08)',
  text: '#EEE5D8',
  textMuted: '#BEB3A5',
  textSubtle: '#A99C8D',
  inputBg: '#35312D',
  inputBorder: '#4B443D',
  accent: '#D99573',
  accentDark: '#8F543F',
  actionText: '#211C18',
};

export const typography = {
  // Playfair Display é incorporada ao build pelo plugin expo-font.
  editorial: 'Playfair Display',
  // Tipografia de interface limpa, calorosa e sem ruído visual
  ui: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'sans-serif',
  }),
};

export const radii = { small: 10, medium: 16, large: 22, full: 999 };

// Mesma geometria em todos os modos de cor; a paleta fica a cargo de cada tela.
export const controls = {
  input: { minHeight: 50, borderRadius: radii.small, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, borderWidth: StyleSheet.hairlineWidth },
  button: { minHeight: 56, borderRadius: radii.medium, paddingHorizontal: 20, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700' },
  iconButton: { width: 44, height: 44, borderRadius: 22, borderCurve: 'circular', alignItems: 'center', justifyContent: 'center' },
  timerButton: { width: 56, height: 56, borderRadius: 28, borderCurve: 'circular', alignItems: 'center', justifyContent: 'center' },
  pageValue: { minWidth: 54, paddingVertical: 0, fontSize: 20, fontWeight: '700', textAlign: 'center', fontVariant: ['tabular-nums'] },
} satisfies Record<string, ViewStyle | TextStyle>;

const NIGHT_NOTE_COLORS = [
  { surface: '#383329', border: '#5C5039' },
  { surface: '#352C34', border: '#594652' },
  { surface: '#3B3028', border: '#604C3B' },
  { surface: '#2E352B', border: '#4A5841' },
  { surface: '#3B2D2A', border: '#614840' },
  { surface: '#2B3537', border: '#46595C' },
];

export function getReadingNotePalette(color: string, isNight: boolean) {
  const index = READING_NOTE_COLORS.findIndex((value) => value === color);
  const night = NIGHT_NOTE_COLORS[index < 0 ? 0 : index];
  return {
    surface: isNight ? night.surface : color,
    border: isNight ? night.border : 'rgba(50,37,31,0.12)',
    text: isNight ? darkTheme.text : colors.ink,
    muted: isNight ? darkTheme.textMuted : colors.inkSoft,
  };
}
