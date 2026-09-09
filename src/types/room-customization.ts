export type WallPalette = {
  id: string;
  name: string;
  subtitle: string;
  previewColor: string;
  backWallColor: string;
  leftWallColor: string;
  cornerColor: string;
};

export const DEFAULT_WALL_PALETTE_ID = 'warm-sand';

export const WALL_PALETTES: WallPalette[] = [
  {
    id: 'warm-sand',
    name: 'Areia Quente',
    subtitle: 'Acolhedor e neutro clássico',
    previewColor: '#E8D6BC',
    backWallColor: '#E8D6BC',
    leftWallColor: '#D6BE9D',
    cornerColor: '#D0BEA2',
  },
  {
    id: 'sage-green',
    name: 'Verde Sálvia',
    subtitle: 'Serenidade botânica e frescor',
    previewColor: '#CFD9C7',
    backWallColor: '#CFD9C7',
    leftWallColor: '#BDC8B4',
    cornerColor: '#B6C1AD',
  },
  {
    id: 'warm-terracotta',
    name: 'Terracota Aveludada',
    subtitle: 'Calor e aconchego artesanal',
    previewColor: '#DDBEAF',
    backWallColor: '#DDBEAF',
    leftWallColor: '#CCA998',
    cornerColor: '#C4A08F',
  },
  {
    id: 'mist-blue',
    name: 'Azul Névoa',
    subtitle: 'Foco sereno e atmosfera calma',
    previewColor: '#CCD6DD',
    backWallColor: '#CCD6DD',
    leftWallColor: '#B8C4CC',
    cornerColor: '#B0BCC5',
  },
  {
    id: 'antique-parchment',
    name: 'Pergaminho Antigo',
    subtitle: 'Textura suave de papel amarelado',
    previewColor: '#F2EAD8',
    backWallColor: '#F2EAD8',
    leftWallColor: '#DFD5C0',
    cornerColor: '#D7CCB7',
  },
  {
    id: 'clay-rose',
    name: 'Argila Rosa',
    subtitle: 'Delicadeza suave e intimista',
    previewColor: '#E5D0CA',
    backWallColor: '#E5D0CA',
    leftWallColor: '#D2B9B2',
    cornerColor: '#CBB1AA',
  },
  {
    id: 'nocturne-slate',
    name: 'Noite Literária',
    subtitle: 'Profundidade noturna e imersão',
    previewColor: '#2B3044',
    backWallColor: '#2B3044',
    leftWallColor: '#202434',
    cornerColor: '#1A1E2C',
  },
];

export const getWallPalette = (id?: string): WallPalette =>
  WALL_PALETTES.find((palette) => palette.id === id) ?? WALL_PALETTES[0];

export type FloorPalette = {
  id: string;
  name: string;
  subtitle: string;
  plankColor: string;
  grooveColor: string;
  baseColor: string;
};

export const DEFAULT_FLOOR_PALETTE_ID = 'golden-oak';

export const FLOOR_PALETTES: FloorPalette[] = [
  {
    id: 'golden-oak',
    name: 'Carvalho Dourado',
    subtitle: 'Clássico acolhedor com tons de mel',
    plankColor: '#B99467',
    grooveColor: '#6B4B2F',
    baseColor: '#4A2E1F',
  },
  {
    id: 'dark-walnut',
    name: 'Nogueira Escura',
    subtitle: 'Madeira nobre escura e intimista',
    plankColor: '#5C4033',
    grooveColor: '#3B281F',
    baseColor: '#2C1B13',
  },
  {
    id: 'nordic-birch',
    name: 'Pinho Nórdico',
    subtitle: 'Luminoso, leve e contemporâneo',
    plankColor: '#DFCEB7',
    grooveColor: '#B59F85',
    baseColor: '#8C775D',
  },
  {
    id: 'warm-cherry',
    name: 'Cerejeira Quente',
    subtitle: 'Nuances avermelhadas artesanais',
    plankColor: '#9E563E',
    grooveColor: '#633120',
    baseColor: '#472013',
  },
  {
    id: 'ash-wood',
    name: 'Freixo Acinzentado',
    subtitle: 'Tom rústico suave e equilibrado',
    plankColor: '#A49C90',
    grooveColor: '#696257',
    baseColor: '#4D473D',
  },
  {
    id: 'smoked-ebony',
    name: 'Ébano Fumê',
    subtitle: 'Profundidade sóbria e elegante',
    plankColor: '#383533',
    grooveColor: '#201E1D',
    baseColor: '#181615',
  },
];

export const getFloorPalette = (id?: string): FloorPalette =>
  FLOOR_PALETTES.find((palette) => palette.id === id) ?? FLOOR_PALETTES[0];

