import { useCallback, useSyncExternalStore } from 'react';
import { Texture, TextureLoader } from 'three';

type Consumer = (texture: Texture | null) => void;
type Entry = { texture: Texture | null; pending: Texture | null; consumers: Set<Consumer> };

// Images belong to their mounted consumers, unlike the finite GLTF asset cache.
export function createRoomTextureCache(loader: Pick<TextureLoader, 'load'>) {
  const entries = new Map<string, Entry>();

  return {
    get(url?: string | null) {
      return url ? entries.get(url)?.texture ?? null : null;
    },
    subscribe(url: string, consumer: Consumer) {
      let entry = entries.get(url);
      if (!entry) {
        entry = { texture: null, pending: null, consumers: new Set() };
        entries.set(url, entry);
        const current = entry;
        current.pending = loader.load(url, (texture) => {
          current.pending = null;
          if (entries.get(url) !== current) {
            texture.dispose();
            return;
          }
          current.texture = texture;
          for (const notify of current.consumers) notify(texture);
        }, undefined, () => {
          current.pending?.dispose();
          current.pending = null;
          for (const notify of current.consumers) notify(null);
        });
      }
      entry.consumers.add(consumer);
      consumer(entry.texture);

      return () => {
        entry.consumers.delete(consumer);
        if (entry.consumers.size === 0 && entries.get(url) === entry) {
          entries.delete(url);
          entry.texture?.dispose();
          entry.texture = null;
        }
      };
    },
  };
}

const textures = createRoomTextureCache(new TextureLoader());

export function useRoomTexture(url?: string | null): Texture | null {
  const subscribe = useCallback((notify: () => void) => {
    if (!url) return () => {};
    return textures.subscribe(url, notify);
  }, [url]);
  const getSnapshot = useCallback(() => textures.get(url), [url]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
