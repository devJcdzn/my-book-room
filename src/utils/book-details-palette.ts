const rgb = (hex: string) => hex.slice(1).match(/../g)!.map((channel) => parseInt(channel, 16));

const mix = (base: string, tint: string, weight: number) => {
  const target = rgb(tint);
  return `#${rgb(base).map((channel, index) => Math.round(channel * (1 - weight) + target[index] * weight).toString(16).padStart(2, '0')).join('')}`;
};

const luminance = (hex: string) => rgb(hex).reduce((sum, channel, index) => {
  const value = channel / 255;
  return sum + (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][index];
}, 0);

const contrast = (a: string, b: string) => {
  const values = [luminance(a), luminance(b)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
};

export function getBookDetailsPalette(coverColor: string | undefined, isNight: boolean) {
  const cover = coverColor && /^#[\da-f]{6}$/i.test(coverColor) ? coverColor : '#F6EFE5';
  let background = isNight ? mix(cover, '#201E1C', 0.55) : cover;
  const isDark = contrast(background, '#FFFFFF') > contrast(background, '#000000');
  const text = isDark ? '#FFFFFF' : '#000000';
  const opposite = isDark ? '#000000' : '#FFFFFF';
  // Leave extra contrast for the cover image visible behind the header.
  while (contrast(text, background) < 7) background = mix(background, opposite, 0.08);
  const surface = mix(background, opposite, 0.18);
  const surfaceStrong = mix(background, opposite, 0.32);
  const backgrounds = [background, surface, surfaceStrong];
  let muted = text;
  // Soften secondary text only as far as its contrast allows on every surface.
  for (let weight = 0.05; weight <= 0.35; weight += 0.05) {
    const candidate = mix(text, background, weight);
    if (backgrounds.some((color) => contrast(candidate, color) < 4.5)) break;
    muted = candidate;
  }
  const brandAccent = isDark ? '#D99573' : '#8C3F2B';
  const accent = backgrounds.every((color) => contrast(brandAccent, color) >= 4.5) ? brandAccent : text;
  return {
    background, isDark, text, muted, surface, surfaceStrong, accent,
    border: mix(surface, text, 0.25),
    fill: isDark ? '#D99573' : '#8C3F2B',
    actionText: isDark ? '#211C18' : '#FFFFFF',
  };
}
