const BASE_83 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~';
const MAX_COLORS = 50;

type BlurhashGenerator = (url: string) => Promise<string | null>;

const generateBlurhash: BlurhashGenerator = async (url) => {
  const { Image } = await import('expo-image');
  return Image.generateBlurhashAsync(url, [1, 1]);
};

const generateCoverSample: BlurhashGenerator = async (url) => {
  const { Image } = await import('expo-image');
  const image = await Image.loadAsync(url, { maxWidth: 96, maxHeight: 96 });
  return Image.generateBlurhashAsync(image, [4, 4]);
};

const decode83 = (value: string) => {
  let result = 0;
  for (const character of value) {
    const digit = BASE_83.indexOf(character);
    if (digit < 0) return undefined;
    result = result * 83 + digit;
  }
  return result;
};

const channelHex = (value: number) => Math.round(value).toString(16).padStart(2, '0').toUpperCase();

export const decodeBlurhashColor = (blurhash: string) => {
  if (blurhash.length < 6) return undefined;
  const value = decode83(blurhash.slice(2, 6));
  if (value === undefined || value > 0xFFFFFF) return undefined;

  let red = value >> 16;
  let green = (value >> 8) & 255;
  let blue = value & 255;
  const luminance = red * 0.299 + green * 0.587 + blue * 0.114;

  if (luminance === 0) {
    red = green = blue = 48;
  } else if (luminance < 48 || luminance > 210) {
    const target = luminance < 48 ? 48 : 210;
    const factor = target / luminance;
    red = Math.min(255, red * factor);
    green = Math.min(255, green * factor);
    blue = Math.min(255, blue * factor);
  }

  return `#${channelHex(red)}${channelHex(green)}${channelHex(blue)}`;
};

// Sample the low-frequency image and select the most represented color family.
export function decodeDominantCoverColor(hash: string) {
  if (hash.length < 6) return;
  const size = decode83(hash.slice(0, 1));
  const scale = decode83(hash.slice(1, 2));
  const dc = decode83(hash.slice(2, 6));
  if (size === undefined || scale === undefined || dc === undefined || dc > 0xffffff) return;
  const columns = size % 9 + 1;
  const rows = Math.floor(size / 9) + 1;
  if (rows > 9 || hash.length !== 4 + 2 * columns * rows) return;
  const linear = (channel: number) => channel <= 10
    ? channel / 3294.6 : ((channel / 255 + 0.055) / 1.055) ** 2.4;
  const srgb = (channel: number) => {
    const value = Math.max(0, Math.min(1, channel));
    return 255 * (value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055);
  };
  const coefficients = [[linear(dc >> 16), linear((dc >> 8) & 255), linear(dc & 255)]];
  const amplitude = (scale + 1) / 166;
  const ac = (digit: number) => {
    const value = (digit - 9) / 9;
    return value * Math.abs(value) * amplitude;
  };
  for (let index = 1; index < columns * rows; index++) {
    const value = decode83(hash.slice(4 + index * 2, 6 + index * 2));
    if (value === undefined || value >= 19 ** 3) return;
    coefficients.push([ac(Math.floor(value / 361)), ac(Math.floor(value / 19) % 19), ac(value % 19)]);
  }

  const buckets = new Map<string, { weight: number; rgb: number[] }>();
  const samples = 12;
  for (let y = 0; y < samples; y++) {
    for (let x = 0; x < samples; x++) {
      const rgb = [0, 0, 0];
      coefficients.forEach((coefficient, index) => {
        const basis = Math.cos(Math.PI * (x + 0.5) * (index % columns) / samples)
          * Math.cos(Math.PI * (y + 0.5) * Math.floor(index / columns) / samples);
        coefficient.forEach((channel, i) => { rgb[i] += channel * basis; });
      });
      const pixel = rgb.map(srgb);
      const chroma = Math.max(...pixel) - Math.min(...pixel);
      const weight = 1 + chroma / 255;
      const key = pixel.map(channel => Math.round(channel / 64)).join(',');
      const bucket = buckets.get(key) ?? { weight: 0, rgb: [0, 0, 0] };
      bucket.weight += weight;
      pixel.forEach((channel, i) => { bucket.rgb[i] += channel * weight; });
      buckets.set(key, bucket);
    }
  }

  const dominant = [...buckets.values()].sort((a, b) => b.weight - a.weight)[0];
  return '#' + dominant.rgb.map(channel => channelHex(channel / dominant.weight)).join('');
}

export const createCoverColorExtractor = (
  generator: BlurhashGenerator = generateBlurhash,
  timeoutMs = 10_000,
  decode = decodeBlurhashColor,
) => {
  const cache = new Map<string, string | null>();
  const inFlight = new Map<string, Promise<string | undefined>>();

  const remember = (url: string, color?: string) => {
    cache.delete(url);
    cache.set(url, color ?? null);
    while (cache.size > MAX_COLORS) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  };

  return (url?: string): Promise<string | undefined> => {
    if (!url) return Promise.resolve(undefined);
    if (cache.has(url)) {
      const cached = cache.get(url);
      cache.delete(url);
      cache.set(url, cached ?? null);
      return Promise.resolve(cached ?? undefined);
    }
    const pending = inFlight.get(url);
    if (pending) return pending;

    const request = (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Cover color timeout')), timeoutMs);
        });
        const blurhash = await Promise.race([generator(url), timeout]);
        const color = blurhash ? decode(blurhash) : undefined;
        remember(url, color);
        return color;
      } catch {
        remember(url);
        return undefined;
      } finally {
        if (timer) clearTimeout(timer);
      }
    })().finally(() => inFlight.delete(url));

    inFlight.set(url, request);
    return request;
  };
};

export const extractCoverColor = createCoverColorExtractor();

export const extractDominantCoverColor = createCoverColorExtractor(generateCoverSample, 10_000, decodeDominantCoverColor);
