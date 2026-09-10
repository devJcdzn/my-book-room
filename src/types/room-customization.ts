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

export type RugPalette = {
  id: string;
  name: string;
  subtitle: string;
  previewColor: string;
  mainColor: string;
  innerColor: string;
};

export const DEFAULT_RUG_PALETTE_ID = 'terracotta-classic';

export const RUG_PALETTES: RugPalette[] = [
  {
    id: 'terracotta-classic',
    name: 'Terracota Clássico',
    subtitle: 'Calor artesanal e aconchego rústico',
    previewColor: '#A65342',
    mainColor: '#A65342',
    innerColor: '#8A4637',
  },
  {
    id: 'sage-botanic',
    name: 'Verde Botânico',
    subtitle: 'Harmonia natural e calma florestal',
    previewColor: '#547059',
    mainColor: '#547059',
    innerColor: '#415745',
  },
  {
    id: 'midnight-navy',
    name: 'Azul Meia-Noite',
    subtitle: 'Sobriedade serena para leituras imersivas',
    previewColor: '#36455A',
    mainColor: '#36455A',
    innerColor: '#283344',
  },
  {
    id: 'warm-mustard',
    name: 'Mostarda Vintage',
    subtitle: 'Toque dourado acolhedor e nostálgico',
    previewColor: '#C48A3C',
    mainColor: '#C48A3C',
    innerColor: '#A8732E',
  },
  {
    id: 'natural-linen',
    name: 'Linho Areia',
    subtitle: 'Neutralidade crua, suave e luminosa',
    previewColor: '#D8C6A5',
    mainColor: '#D8C6A5',
    innerColor: '#BAA989',
  },
  {
    id: 'velvet-burgundy',
    name: 'Vinho Aveludado',
    subtitle: 'Elegância clássica de biblioteca particular',
    previewColor: '#823945',
    mainColor: '#823945',
    innerColor: '#672933',
  },
  {
    id: 'soft-slate',
    name: 'Ardósia Suave',
    subtitle: 'Modernidade minimalista e foco tranquilo',
    previewColor: '#484B58',
    mainColor: '#484B58',
    innerColor: '#353742',
  },
];

export const getRugPalette = (id?: string): RugPalette =>
  RUG_PALETTES.find((palette) => palette.id === id) ?? RUG_PALETTES[0];

export type BookcasePalette = {
  id: string;
  name: string;
  subtitle: string;
  previewColor: string;
  frameColor: string;
  shelfColor: string;
  backColor: string;
  trimColor: string;
  metalColor: string;
};

export const DEFAULT_BOOKCASE_PALETTE_ID = 'rustic-mahogany';

export const BOOKCASE_PALETTES: BookcasePalette[] = [
  {
    id: 'rustic-mahogany',
    name: 'Mogno Rústico',
    subtitle: 'Clássico acolhedor de biblioteca particular',
    previewColor: '#563423',
    frameColor: '#563423',
    shelfColor: '#5E3926',
    backColor: '#3D2216',
    trimColor: '#6E442F',
    metalColor: '#9C773D',
  },
  {
    id: 'golden-oak',
    name: 'Carvalho Dourado',
    subtitle: 'Tons quentes de mel e harmonia acolhedora',
    previewColor: '#8C6239',
    frameColor: '#8C6239',
    shelfColor: '#9E7247',
    backColor: '#6E4924',
    trimColor: '#B38555',
    metalColor: '#C5A059',
  },
  {
    id: 'dark-walnut',
    name: 'Nogueira Escura',
    subtitle: 'Madeira nobre escura e elegância refinada',
    previewColor: '#38261D',
    frameColor: '#38261D',
    shelfColor: '#422E23',
    backColor: '#261812',
    trimColor: '#4D362A',
    metalColor: '#8B7355',
  },
  {
    id: 'nordic-birch',
    name: 'Pinho Nórdico',
    subtitle: 'Luminosidade suave, leve e contemporânea',
    previewColor: '#CBB599',
    frameColor: '#CBB599',
    shelfColor: '#D9C6AD',
    backColor: '#A89073',
    trimColor: '#E5D5C1',
    metalColor: '#8C867D',
  },
  {
    id: 'provencal-white',
    name: 'Branco Provençal',
    subtitle: 'Estilo casa de campo acolhedor e clássico',
    previewColor: '#EAE4DC',
    frameColor: '#EAE4DC',
    shelfColor: '#F4EFEA',
    backColor: '#D8CEBF',
    trimColor: '#FFFFFF',
    metalColor: '#AFA698',
  },
  {
    id: 'nocturne-ebony',
    name: 'Ébano Noturno',
    subtitle: 'Preto aveludado e profundidade intimista',
    previewColor: '#24252A',
    frameColor: '#24252A',
    shelfColor: '#2B2D34',
    backColor: '#18191E',
    trimColor: '#353740',
    metalColor: '#96846B',
  },
  {
    id: 'heritage-green',
    name: 'Verde Biblioteca',
    subtitle: 'Clássico colonial britânico de bibliotecas nobres',
    previewColor: '#2D3E35',
    frameColor: '#2D3E35',
    shelfColor: '#364A40',
    backColor: '#1F2B24',
    trimColor: '#42584C',
    metalColor: '#C4A053',
  },
];

export const getBookcasePalette = (id?: string): BookcasePalette =>
  BOOKCASE_PALETTES.find((palette) => palette.id === id) ?? BOOKCASE_PALETTES[0];

export type CatOption = {
  id: string;
  name: string;
  subtitle: string;
  furColor: string;
  bedColor: string;
};

export const DEFAULT_CAT_ID = 'catnap-orange';

export const CAT_OPTIONS: CatOption[] = [
  {
    id: 'catnap-orange',
    name: 'Gatinho Laranja',
    subtitle: 'Ruivo acolhedor dorminhoco',
    furColor: '#E68037',
    bedColor: '#DFC3A7',
  },
  {
    id: 'black-catnap',
    name: 'Gatinho Preto',
    subtitle: 'Ébano aveludado e elegante',
    furColor: '#2B2B30',
    bedColor: '#A58573',
  },
  {
    id: 'gray-catnap',
    name: 'Gatinho Cinza',
    subtitle: 'Cinza e branco carinhoso',
    furColor: '#7B6F69',
    bedColor: '#C48462',
  },
];

export const getCatOption = (id?: string): CatOption =>
  CAT_OPTIONS.find((cat) => cat.id === id) ?? CAT_OPTIONS[0];

export type LeftWallItemType = 'none' | 'window' | 'poster';
export const DEFAULT_LEFT_WALL_ITEM: LeftWallItemType = 'none';

export type WindowStyleOption = {
  id: string;
  name: string;
  subtitle: string;
  frameColor: string;
  sillColor: string;
  mullionColor: string;
};

export const DEFAULT_WINDOW_STYLE_ID = 'rustic-mahogany';

export const WINDOW_STYLES: WindowStyleOption[] = [
  {
    id: 'rustic-mahogany',
    name: 'Mogno Rústico',
    subtitle: 'Madeira escura e acolhedora de biblioteca',
    frameColor: '#563423',
    sillColor: '#6E432E',
    mullionColor: '#482B1D',
  },
  {
    id: 'golden-oak',
    name: 'Carvalho Dourado',
    subtitle: 'Madeira mel aconchegante com tons quentes',
    frameColor: '#8C6239',
    sillColor: '#A27546',
    mullionColor: '#76522F',
  },
  {
    id: 'nordic-birch',
    name: 'Pinho Nórdico',
    subtitle: 'Madeira clara suave e luminosa',
    frameColor: '#CBB599',
    sillColor: '#DAC6AC',
    mullionColor: '#BBA387',
  },
  {
    id: 'provencal-white',
    name: 'Branco Provençal',
    subtitle: 'Clássico artesanal em branco suave',
    frameColor: '#EAE4DC',
    sillColor: '#F5EFE7',
    mullionColor: '#D9D2C9',
  },
  {
    id: 'nocturne-ebony',
    name: 'Ébano Noturno',
    subtitle: 'Preto acetinado sóbrio e contemporâneo',
    frameColor: '#24252A',
    sillColor: '#2E3036',
    mullionColor: '#1B1C20',
  },
];

export const getWindowStyle = (id?: string): WindowStyleOption =>
  WINDOW_STYLES.find((style) => style.id === id) ?? WINDOW_STYLES[0];

export type PosterFrameOption = {
  id: string;
  name: string;
  subtitle: string;
  frameColor: string;
  matColor: string;
  trimColor: string;
};

export const DEFAULT_POSTER_FRAME_ID = 'gallery-black';

export const POSTER_FRAME_OPTIONS: PosterFrameOption[] = [
  {
    id: 'gallery-black',
    name: 'Preto Galeria',
    subtitle: 'Moldura preta clássica minimalista',
    frameColor: '#1E1F24',
    matColor: '#FAF7F0',
    trimColor: '#15161A',
  },
  {
    id: 'antique-gold',
    name: 'Ouro Envelhecido',
    subtitle: 'Filete dourado clássico de museu',
    frameColor: '#B89648',
    matColor: '#FBF8F2',
    trimColor: '#8C6E2E',
  },
  {
    id: 'classic-walnut',
    name: 'Nogueira Nobre',
    subtitle: 'Madeira nobre escura aristocrática',
    frameColor: '#442F24',
    matColor: '#FAF6EE',
    trimColor: '#332219',
  },
  {
    id: 'natural-oak',
    name: 'Carvalho Claro',
    subtitle: 'Madeira natural escandinava acolhedora',
    frameColor: '#9E7B54',
    matColor: '#FAF7F0',
    trimColor: '#7F603D',
  },
  {
    id: 'studio-white',
    name: 'Branco Estúdio',
    subtitle: 'Moldura clara luminosa e moderna',
    frameColor: '#E8E3DA',
    matColor: '#FFFFFF',
    trimColor: '#D4CEC4',
  },
];

export const getPosterFrame = (id?: string): PosterFrameOption =>
  POSTER_FRAME_OPTIONS.find((frame) => frame.id === id) ?? POSTER_FRAME_OPTIONS[0];

export type PictureFrameSize = 'none' | '1:1' | '2:1';
export const DEFAULT_PICTURE_FRAME_SIZE: PictureFrameSize = '1:1';

export type PictureFrameStyleOption = {
  id: string;
  name: string;
  subtitle: string;
  frameColor: string;
  matColor: string;
  trimColor: string;
};

export const DEFAULT_PICTURE_FRAME_STYLE_ID = 'classic-walnut';

export const PICTURE_FRAME_STYLES: PictureFrameStyleOption[] = [
  {
    id: 'classic-walnut',
    name: 'Nogueira Nobre',
    subtitle: 'Madeira escura nobre e aconchegante',
    frameColor: '#4A3326',
    matColor: '#FAF7F2',
    trimColor: '#362319',
  },
  {
    id: 'natural-oak',
    name: 'Carvalho Claro',
    subtitle: 'Tons de mel claros e acolhedores',
    frameColor: '#A07C55',
    matColor: '#FBF9F5',
    trimColor: '#805F3C',
  },
  {
    id: 'gallery-black',
    name: 'Preto Galeria',
    subtitle: 'Contraste contemporâneo e elegante',
    frameColor: '#202126',
    matColor: '#F6F4EE',
    trimColor: '#17181C',
  },
  {
    id: 'antique-gold',
    name: 'Ouro Envelhecido',
    subtitle: 'Friso dourado requintado de museu',
    frameColor: '#BA984E',
    matColor: '#FAF8F3',
    trimColor: '#8F7132',
  },
  {
    id: 'studio-white',
    name: 'Branco Minimalista',
    subtitle: 'Moldura clara luminosa e delicada',
    frameColor: '#EDE7DE',
    matColor: '#FFFFFF',
    trimColor: '#D8D1C7',
  },
];

export const getPictureFrameStyle = (id?: string): PictureFrameStyleOption =>
  PICTURE_FRAME_STYLES.find((style) => style.id === id) ?? PICTURE_FRAME_STYLES[0];


