const BASE_83 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~';
const MAX_COLORS = 50;

type BlurhashGenerator = (url: string) => Promise<string | null>;

const generateBlurhash: BlurhashGenerator = async (url) => {
  const { Image } = await import('expo-image');
  return Image.generateBlurhashAsync(url, [1, 1]);
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

export const createCoverColorExtractor = (
  generator: BlurhashGenerator = generateBlurhash,
  timeoutMs = 10_000,
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
        const color = blurhash ? decodeBlurhashColor(blurhash) : undefined;
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
