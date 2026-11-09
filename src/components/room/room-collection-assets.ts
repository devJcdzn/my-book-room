/* eslint-disable @typescript-eslint/no-require-imports */
// Static requires let Metro include assets; the scene loads models only on demand.
export const BOTANIC_ASSETS = {
  'botanic-window': require('@/output/room-collections/botanic-window.glb'),
  'botanic-bookcase': require('@/output/room-collections/botanic-bookcase.glb'),
  'botanic-desk': require('@/output/room-collections/botanic-desk.glb'),
  'botanic-seat': require('@/output/room-collections/botanic-seat.glb'),
  'botanic-lamp': require('@/output/room-collections/botanic-lamp.glb'),
  'botanic-rug': require('@/output/room-collections/botanic-rug.glb'),
  'botanic-pillow': require('@/output/room-collections/botanic-pillow.glb'),
} as const;
export const BOTANIC_PREVIEWS: Record<string, number> = {
  'botanic-window': require('@/output/room-collections/botanic-window.png'),
  'botanic-bookcase': require('@/output/room-collections/botanic-bookcase.png'),
  'botanic-desk': require('@/output/room-collections/botanic-desk.png'),
  'botanic-seat': require('@/output/room-collections/botanic-seat.png'),
  'botanic-lamp': require('@/output/room-collections/botanic-lamp.png'),
  'botanic-rug': require('@/output/room-collections/botanic-rug.png'),
  'botanic-pillow': require('@/output/room-collections/botanic-pillow.png'),
};

export const LIBRARY_ASSETS = {
  'library-desk': require('@/output/room-collections/library-desk.glb'),
  'library-seat': require('@/output/room-collections/library-seat.glb'),
  'library-bookcase': require('@/output/room-collections/library-bookcase.glb'),
  'library-lamp': require('@/output/room-collections/library-lamp.glb'),
  'library-pillow': require('@/output/room-collections/library-pillow.glb'),
  'library-window': require('@/output/room-collections/library-window.glb'),

  'library-round-rug': require('@/output/room-collections/library-round-rug.glb'),
  'library-oval-rug': require('@/output/room-collections/library-oval-rug.glb'),
  'library-runner-rug': require('@/output/room-collections/library-runner-rug.glb'),
} as const;
export const ATELIER_ASSETS = {
  'atelier-desk': require('@/output/room-collections/atelier-desk.glb'),
  'atelier-seat': require('@/output/room-collections/atelier-seat.glb'),
  'atelier-bookcase': require('@/output/room-collections/atelier-bookcase.glb'),
  'atelier-lamp': require('@/output/room-collections/atelier-lamp.glb'),
  'atelier-pillow': require('@/output/room-collections/atelier-pillow.glb'),
  'atelier-window': require('@/output/room-collections/atelier-window.glb'),
  'atelier-frame': require('@/output/room-collections/atelier-frame.glb'),
} as const;
const ATELIER_PREVIEWS: Record<string, number> = {
  'atelier-desk': require('@/output/room-collections/atelier-desk.png'),
  'atelier-seat': require('@/output/room-collections/atelier-seat.png'),
  'atelier-bookcase': require('@/output/room-collections/atelier-bookcase.png'),
  'atelier-lamp': require('@/output/room-collections/atelier-lamp.png'),
  'atelier-pillow': require('@/output/room-collections/atelier-pillow.png'),
  'atelier-window': require('@/output/room-collections/atelier-window.png'),
  'atelier-frame': require('@/output/room-collections/atelier-frame.png'),
};
export const PLANT_ASSETS = {
  'succulent-plant': require('@/output/room-collections/succulent-plant.glb'),
  'cactus-plant': require('@/output/room-collections/cactus-plant.glb'),
  'zz-plant': require('@/output/room-collections/zz-plant.glb'),
  'monstera-plant': require('@/output/room-collections/monstera-plant.glb'),
  'snake-plant': require('@/output/room-collections/snake-plant.glb'),
  'ficus-plant': require('@/output/room-collections/ficus-plant.glb'),
} as const;
export const PLANT_PREVIEWS: Record<string, number> = {
  'succulent-plant': require('@/output/room-collections/succulent-plant.png'),
  'cactus-plant': require('@/output/room-collections/cactus-plant.png'),
  'zz-plant': require('@/output/room-collections/zz-plant.png'),
  'monstera-plant': require('@/output/room-collections/monstera-plant.png'),
  'snake-plant': require('@/output/room-collections/snake-plant.png'),
  'ficus-plant': require('@/output/room-collections/ficus-plant.png'),
};
export const OBSERVATORY_ASSETS = {
  'observatory-desk': require('@/output/room-collections/observatory-desk.glb'),
  'observatory-seat': require('@/output/room-collections/observatory-seat.glb'),
  'observatory-bookcase': require('@/output/room-collections/observatory-bookcase.glb'),
  'observatory-lamp': require('@/output/room-collections/observatory-lamp.glb'),
  'observatory-window': require('@/output/room-collections/observatory-window.glb'),
  'observatory-frame': require('@/output/room-collections/observatory-frame.glb'),
  'observatory-pillow': require('@/output/room-collections/observatory-pillow.glb'),
  'observatory-rug': require('@/output/room-collections/observatory-rug.glb'),
  'observatory-round-rug': require('@/output/room-collections/observatory-round-rug.glb'),
  'observatory-oval-rug': require('@/output/room-collections/observatory-oval-rug.glb'),
  'observatory-runner-rug': require('@/output/room-collections/observatory-runner-rug.glb'),
} as const;
const OBSERVATORY_PREVIEWS: Record<string, number> = {
  'observatory-desk': require('@/output/room-collections/observatory-desk.png'),
  'observatory-seat': require('@/output/room-collections/observatory-seat.png'),
  'observatory-bookcase': require('@/output/room-collections/observatory-bookcase.png'),
  'observatory-lamp': require('@/output/room-collections/observatory-lamp.png'),
  'observatory-window': require('@/output/room-collections/observatory-window.png'),
  'observatory-frame': require('@/output/room-collections/observatory-frame.png'),
  'observatory-pillow': require('@/output/room-collections/observatory-pillow.png'),
  'observatory-rug': require('@/output/room-collections/observatory-rug.png'),
  'observatory-round-rug': require('@/output/room-collections/observatory-round-rug.png'),
  'observatory-oval-rug': require('@/output/room-collections/observatory-oval-rug.png'),
  'observatory-runner-rug': require('@/output/room-collections/observatory-runner-rug.png'),
};
export const TEAHOUSE_ASSETS = {
  'teahouse-desk': require('@/output/room-collections/teahouse-desk.glb'),
  'teahouse-seat': require('@/output/room-collections/teahouse-seat.glb'),
  'teahouse-bookcase': require('@/output/room-collections/teahouse-bookcase.glb'),
  'teahouse-lamp': require('@/output/room-collections/teahouse-lamp.glb'),
  'teahouse-window': require('@/output/room-collections/teahouse-window.glb'),
  'teahouse-frame': require('@/output/room-collections/teahouse-frame.glb'),
  'teahouse-pillow': require('@/output/room-collections/teahouse-pillow.glb'),
  'teahouse-rug': require('@/output/room-collections/teahouse-rug.glb'),
  'teahouse-round-rug': require('@/output/room-collections/teahouse-round-rug.glb'),
  'teahouse-oval-rug': require('@/output/room-collections/teahouse-oval-rug.glb'),
  'teahouse-runner-rug': require('@/output/room-collections/teahouse-runner-rug.glb'),
} as const;
const TEAHOUSE_PREVIEWS: Record<string, number> = {
  'teahouse-desk': require('@/output/room-collections/teahouse-desk.png'),
  'teahouse-seat': require('@/output/room-collections/teahouse-seat.png'),
  'teahouse-bookcase': require('@/output/room-collections/teahouse-bookcase.png'),
  'teahouse-lamp': require('@/output/room-collections/teahouse-lamp.png'),
  'teahouse-window': require('@/output/room-collections/teahouse-window.png'),
  'teahouse-frame': require('@/output/room-collections/teahouse-frame.png'),
  'teahouse-pillow': require('@/output/room-collections/teahouse-pillow.png'),
  'teahouse-rug': require('@/output/room-collections/teahouse-rug.png'),
  'teahouse-round-rug': require('@/output/room-collections/teahouse-round-rug.png'),
  'teahouse-oval-rug': require('@/output/room-collections/teahouse-oval-rug.png'),
  'teahouse-runner-rug': require('@/output/room-collections/teahouse-runner-rug.png'),
};
export const COLLECTION_ASSETS = { ...BOTANIC_ASSETS, ...LIBRARY_ASSETS, ...ATELIER_ASSETS, ...OBSERVATORY_ASSETS, ...TEAHOUSE_ASSETS, ...PLANT_ASSETS } as const;
const BASE_PREVIEWS: Record<string, number> = {
  ...BOTANIC_PREVIEWS,
  ...ATELIER_PREVIEWS,
  'library-desk': require('@/output/room-collections/library-desk.png'),
  'library-seat': require('@/output/room-collections/library-seat.png'),
  'library-bookcase': require('@/output/room-collections/library-bookcase.png'),
  'library-lamp': require('@/output/room-collections/library-lamp.png'),
  'library-pillow': require('@/output/room-collections/library-pillow.png'),
  'library-window': require('@/output/room-collections/library-window.png'),

  'library-round-rug': require('@/output/room-collections/library-round-rug.png'),
  'library-oval-rug': require('@/output/room-collections/library-oval-rug.png'),
  'library-runner-rug': require('@/output/room-collections/library-runner-rug.png'),
};
// Theme variants share the GLB for their shape; only previews are distinct.
export const RUG_PREVIEWS: Record<string, number> = {
  'teahouse-rug': TEAHOUSE_PREVIEWS['teahouse-rug'],
  'teahouse-round-rug': TEAHOUSE_PREVIEWS['teahouse-round-rug'],
  'teahouse-oval-rug': TEAHOUSE_PREVIEWS['teahouse-oval-rug'],
  'teahouse-runner-rug': TEAHOUSE_PREVIEWS['teahouse-runner-rug'],

  'observatory-rug': OBSERVATORY_PREVIEWS['observatory-rug'],
  'observatory-round-rug': OBSERVATORY_PREVIEWS['observatory-round-rug'],
  'observatory-oval-rug': OBSERVATORY_PREVIEWS['observatory-oval-rug'],
  'observatory-runner-rug': OBSERVATORY_PREVIEWS['observatory-runner-rug'],

  'atelier-rug': require('@/output/room-collections/atelier-rug.png'),
  'atelier-round-rug': require('@/output/room-collections/atelier-round-rug.png'),
  'atelier-oval-rug': require('@/output/room-collections/atelier-oval-rug.png'),
  'atelier-runner-rug': require('@/output/room-collections/atelier-runner-rug.png'),

  'isometric-rug': require('@/output/room-collections/isometric-rug.png'),
  'botanic-rug': BOTANIC_PREVIEWS['botanic-rug'],
  'library-rug': require('@/output/room-collections/library-rug.png'),
  'isometric-round-rug': require('@/output/room-collections/isometric-round-rug.png'),
  'isometric-oval-rug': require('@/output/room-collections/isometric-oval-rug.png'),
  'isometric-runner-rug': require('@/output/room-collections/isometric-runner-rug.png'),
  'botanic-round-rug': require('@/output/room-collections/botanic-round-rug.png'),
  'botanic-oval-rug': require('@/output/room-collections/botanic-oval-rug.png'),
  'botanic-runner-rug': require('@/output/room-collections/botanic-runner-rug.png'),
  'library-round-rug': BASE_PREVIEWS['library-round-rug'],
  'library-oval-rug': BASE_PREVIEWS['library-oval-rug'],
  'library-runner-rug': BASE_PREVIEWS['library-runner-rug'],
};

export const COLLECTION_PREVIEWS: Record<string, number> = { ...BASE_PREVIEWS, ...OBSERVATORY_PREVIEWS, ...TEAHOUSE_PREVIEWS, ...RUG_PREVIEWS, ...PLANT_PREVIEWS };

// Presentation images load only when their cards or gallery are displayed.
export const COLLECTION_SHOWCASES: Record<string, readonly number[]> = {
  'isometric': [
    require('@/output/collection-showcase/original-complete.webp'),
    require('@/output/collection-showcase/original-portrait.webp'),
    require('@/output/collection-showcase/original-detail.webp'),
  ],
  'botanic': [
    require('@/output/collection-showcase/botanic-complete.webp'),
    require('@/output/collection-showcase/botanic-portrait.webp'),
    require('@/output/collection-showcase/botanic-detail.webp'),
  ],
  'atelier': [
    require('@/output/collection-showcase/atelier-complete.webp'),
    require('@/output/collection-showcase/atelier-portrait.webp'),
    require('@/output/collection-showcase/atelier-detail.webp'),
  ],
  'library': [
    require('@/output/collection-showcase/library-complete.webp'),
    require('@/output/collection-showcase/library-portrait.webp'),
    require('@/output/collection-showcase/library-detail.webp'),
  ],
  'observatory': [
    require('@/output/collection-showcase/observatory-complete.webp'),
    require('@/output/collection-showcase/observatory-portrait.webp'),
    require('@/output/collection-showcase/observatory-detail.webp'),
  ],
  'teahouse': [
    require('@/output/collection-showcase/teahouse-complete.webp'),
    require('@/output/collection-showcase/teahouse-portrait.webp'),
    require('@/output/collection-showcase/teahouse-detail.webp'),
  ],
};
