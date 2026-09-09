import { Platform } from 'react-native';

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
  bg: '#131520',
  surface: '#1A1C28',
  surfaceElevated: '#222536',
  border: '#2A2E42',
  borderSubtle: 'rgba(255, 255, 255, 0.06)',
  text: '#FAF4EB',
  textMuted: '#A3AAB8',
  textSubtle: '#72788D',
  inputBg: '#1E2130',
  inputBorder: '#2D3247',
  accent: '#FFAE70',
  accentDark: '#B95F3B',
};

export const typography = {
  // Tipografia literária elegante (Baskerville no iOS, Serif moderno no Android)
  editorial: Platform.select({
    ios: 'Baskerville',
    android: 'serif',
    default: 'serif',
  }),
  // Tipografia de interface limpa, calorosa e sem ruído visual
  ui: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'sans-serif',
  }),
};

export const radii = { small: 10, medium: 16, large: 22, full: 999 };
