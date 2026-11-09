import type { ReadingSession } from '@/src/types/book';
import { colors, darkTheme } from '@/src/theme';

export const getReadingControlsPalette = (isNight: boolean) => ({
  background: isNight ? darkTheme.bg : colors.cream,
  surface: isNight ? darkTheme.surface : colors.paper,
  surfaceAlt: isNight ? darkTheme.surfaceElevated : colors.softFill,
  text: isNight ? darkTheme.text : colors.ink,
  muted: isNight ? darkTheme.textMuted : colors.muted,
  accent: isNight ? darkTheme.selectionText : colors.sageDark,
  selection: isNight ? darkTheme.selection : colors.sageSoft,
  border: isNight ? darkTheme.border : colors.line,
  action: isNight ? darkTheme.primary : colors.ink,
  actionText: isNight ? darkTheme.actionText : colors.paper,
  danger: isNight ? darkTheme.danger : colors.danger,
});

const blendHex = (base: string, tint: string, tintWeight: number) => {
  const baseRgb = base.match(/[\da-f]{2}/gi)?.map((value) => Number.parseInt(value, 16));
  const tintRgb = tint.match(/[\da-f]{2}/gi)?.map((value) => Number.parseInt(value, 16));
  if (!baseRgb || !tintRgb || baseRgb.length !== 3 || tintRgb.length !== 3) return base;
  return `#${baseRgb.map((channel, index) => Math.round(channel * (1 - tintWeight) + tintRgb[index]! * tintWeight)
    .toString(16).padStart(2, '0')).join('')}`;
};

export const getReadingSessionPalette = (coverColor: string, isNight: boolean) => {
  const cover = /^#[\da-f]{6}$/i.test(coverColor) ? coverColor : colors.terracotta;
  return isNight ? {
    background: darkTheme.bg,
    surface: darkTheme.surface,
    surfaceAlt: darkTheme.surfaceElevated,
    text: darkTheme.text,
    muted: darkTheme.textMuted,
    accent: darkTheme.accent,
    border: darkTheme.border,
    actionText: darkTheme.actionText,
  } : {
    background: blendHex(colors.cream, cover, 0.14),
    surface: colors.paper,
    surfaceAlt: '#F0E7D9',
    text: colors.ink,
    muted: colors.muted,
    accent: colors.terracotta,
    border: colors.line,
    actionText: colors.paper,
  };
};

export const formatReadingDuration = (seconds?: number) => {
  if (seconds === undefined) return 'Não informado';
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
};

export const readingTimeLabel = (session: ReadingSession) => session.source === 'timer'
  ? 'Tempo cronometrado' : session.durationSeconds === undefined ? 'Tempo não informado' : 'Tempo informado';
export const readingSessionDate = (session: ReadingSession) => `${session.readingDate}T12:00:00`;
