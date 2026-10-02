import { colors, darkTheme } from '@/src/theme';

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

export const formatReadingDuration = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
};
