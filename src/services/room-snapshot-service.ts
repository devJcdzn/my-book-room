export type SnapshotOptions = {
  ambience?: 'day' | 'night';
};

type SnapshotFn = (options?: SnapshotOptions) => Promise<string | null>;

let activeSnapshotFn: SnapshotFn | null = null;
let lastCapturedUri: string | null = null;
const cachedAmbienceUris: { day?: string | null; night?: string | null } = {};

export const registerRoomSnapshotHandler = (fn: SnapshotFn | null) => {
  activeSnapshotFn = fn;
};

export const setLastCapturedRoomUri = (uri: string | null, ambience?: 'day' | 'night') => {
  lastCapturedUri = uri;
  if (ambience) {
    cachedAmbienceUris[ambience] = uri;
  }
};

export const getLastCapturedRoomUri = (ambience?: 'day' | 'night') => {
  if (ambience) {
    return cachedAmbienceUris[ambience] ?? null;
  }
  return lastCapturedUri;
};

export const clearRoomSnapshotCache = () => {
  lastCapturedUri = null;
  cachedAmbienceUris.day = null;
  cachedAmbienceUris.night = null;
};

export const captureRoomSnapshot = async (options?: SnapshotOptions): Promise<string | null> => {
  if (options?.ambience && cachedAmbienceUris[options.ambience]) {
    return cachedAmbienceUris[options.ambience]!;
  }

  if (activeSnapshotFn) {
    try {
      const uri = await activeSnapshotFn(options);
      if (uri) {
        lastCapturedUri = uri;
        if (options?.ambience) {
          cachedAmbienceUris[options.ambience] = uri;
        }
        return uri;
      }
    } catch (err) {
      console.warn('Erro ao capturar snapshot 3D da sala:', err);
    }
  }

  return options?.ambience
    ? (cachedAmbienceUris[options.ambience] ?? null)
    : lastCapturedUri;
};
