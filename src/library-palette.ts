import { darkTheme } from '@/src/theme';

export type LibraryPalette = {
  id: string;
  label: string;
  swatch: string;
  light: {
    background: string;
    surface: string;
    mutedSurface: string;
    text: string;
    mutedText: string;
    border: string;
    shelf: string;
  };
  dark: {
    background: string;
    surface: string;
    mutedSurface: string;
    text: string;
    mutedText: string;
    border: string;
    shelf: string;
  };
};

export const LIBRARY_PALETTES: LibraryPalette[] = [
  {
    id: 'paper', label: 'Papel', swatch: '#F6EFE5',
    light: { background: '#F6EFE5', surface: '#FAF5EE', mutedSurface: '#EFE6D8', text: '#32251F', mutedText: '#807267', border: '#E3D7C7', shelf: '#6A4532' },
    dark: { background: darkTheme.bg, surface: darkTheme.surface, mutedSurface: darkTheme.surfaceElevated, text: darkTheme.text, mutedText: darkTheme.textMuted, border: darkTheme.border, shelf: '#76523F' },
  },
  {
    id: 'sage', label: 'Sálvia', swatch: '#DCE4D6',
    light: { background: '#E4E9DF', surface: '#F5F7F1', mutedSurface: '#D5DED0', text: '#293129', mutedText: '#687368', border: '#CBD5C6', shelf: '#58664F' },
    dark: { background: '#20231E', surface: '#2B2F28', mutedSurface: '#353B31', text: darkTheme.text, mutedText: darkTheme.textMuted, border: '#4B5145', shelf: '#59664F' },
  },
  {
    id: 'rose', label: 'Rosa antigo', swatch: '#EBD9D3',
    light: { background: '#F0E2DD', surface: '#FBF5F2', mutedSurface: '#E8D4CE', text: '#352725', mutedText: '#806D68', border: '#E0CAC3', shelf: '#795248' },
    dark: { background: '#261F1D', surface: '#322926', mutedSurface: '#3D322E', text: darkTheme.text, mutedText: darkTheme.textMuted, border: '#53433D', shelf: '#795248' },
  },
  {
    id: 'blue', label: 'Azul névoa', swatch: '#D9E2E6',
    light: { background: '#E5ECEE', surface: '#F6F9F9', mutedSurface: '#D8E2E5', text: '#263033', mutedText: '#657579', border: '#C9D7DA', shelf: '#52666D' },
    dark: { background: '#1E2223', surface: '#282E30', mutedSurface: '#31393B', text: darkTheme.text, mutedText: darkTheme.textMuted, border: '#434E51', shelf: '#52666D' },
  },
  {
    id: 'lavender', label: 'Lavanda', swatch: '#E2DDEC',
    light: { background: '#EBE7F0', surface: '#F8F6FA', mutedSurface: '#DED8E8', text: '#302B36', mutedText: '#766E80', border: '#D3CCDF', shelf: '#65566F' },
    dark: { background: '#231F26', surface: '#2E2932', mutedSurface: '#39323E', text: darkTheme.text, mutedText: darkTheme.textMuted, border: '#4C4354', shelf: '#65566F' },
  },
];

export const DEFAULT_LIBRARY_PALETTE_ID = 'paper';

export const getLibraryPalette = (id: string) =>
  LIBRARY_PALETTES.find((palette) => palette.id === id) ?? LIBRARY_PALETTES[0];
