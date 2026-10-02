import type { ReadingEntry } from '@/src/types/book';

export const READING_NOTE_COLORS = ['#E8D8A5', '#DABECF', '#E7C7A7', '#C8D6BE', '#E6BDB2', '#C9D7D8'] as const;

export const READING_FOLDER_COLORS = [
  { id: 'blue', name: 'Azul', light: '#D7E8EC', dark: '#294852', text: '#294852', darkText: '#EAF4F5' },
  { id: 'green', name: 'Verde', light: '#DCE8D5', dark: '#354B37', text: '#354B37', darkText: '#EEF5E9' },
  { id: 'plum', name: 'Ameixa', light: '#E6DCEE', dark: '#493752', text: '#493752', darkText: '#F4ECF8' },
  { id: 'rose', name: 'Rosa', light: '#F0DCDD', dark: '#5D383D', text: '#5D383D', darkText: '#F9EEEE' },
  { id: 'ochre', name: 'Ocre', light: '#F0E3C8', dark: '#5A4728', text: '#5A4728', darkText: '#FAF1DE' },
  { id: 'slate', name: 'Ardósia', light: '#DDE3E8', dark: '#3D4852', text: '#3D4852', darkText: '#EDF1F5' },
] as const;

// Títulos antigos passam a fazer parte do texto, sem criar novos títulos.
export function getReadingNoteText(entry?: Pick<ReadingEntry, 'title' | 'text'>) {
  return [entry?.title?.trim(), entry?.text.trim()].filter(Boolean).join('\n\n');
}
