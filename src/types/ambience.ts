export type AmbienceMode = 'auto' | 'day' | 'sunset' | 'night';
export const AMBIENCE_LABELS: Record<AmbienceMode, string> = {
  auto: 'Automático',
  day: 'Dia',
  sunset: 'Ocaso',
  night: 'Noite',
};

export type ResolvedAmbience = 'day' | 'night';

export const AMBIENCE_THEMES: Record<ResolvedAmbience, { bgColor: string }> = {
  day: { bgColor: '#8CA57A' },
  night: { bgColor: '#303342' },
};

export function resolveAmbience(mode: AmbienceMode, date = new Date()): ResolvedAmbience {
  const hour = date.getHours();
  if (mode === 'sunset') return 'day';
  return mode === 'auto' ? (hour >= 18 || hour < 6 ? 'night' : 'day') : mode;
}

export function isSunsetAmbience(mode: AmbienceMode, date = new Date()): boolean {
  const hour = date.getHours();
  return mode === 'sunset' || (mode === 'auto' && hour >= 15 && hour < 18);
}
