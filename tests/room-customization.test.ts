import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BOOKCASE_PALETTES,
  CAT_OPTIONS,
  DEFAULT_BOOKCASE_PALETTE_ID,
  DEFAULT_CAT_ID,
  DEFAULT_FLOOR_PALETTE_ID,
  DEFAULT_LEFT_WALL_ITEM,
  DEFAULT_PICTURE_FRAME_SIZE,
  DEFAULT_PICTURE_FRAME_STYLE_ID,
  DEFAULT_POSTER_FRAME_ID,
  DEFAULT_RUG_PALETTE_ID,
  DEFAULT_WALL_PALETTE_ID,
  DEFAULT_WINDOW_STYLE_ID,
  FLOOR_PALETTES,
  getBookcasePalette,
  getCatOption,
  getFloorPalette,
  getPictureFrameStyle,
  getPosterFrame,
  getRugPalette,
  getWallPalette,
  getWindowStyle,
  PICTURE_FRAME_STYLES,
  POSTER_FRAME_OPTIONS,
  RUG_PALETTES,
  WALL_PALETTES,
  WINDOW_STYLES,
} from '../src/types/room-customization';
import { useLibraryStore } from '../src/store/library-store';

test('paletas de parede possuem metadados válidos e recuperam por id com fallback seguro', () => {
  assert.ok(WALL_PALETTES.length >= 6);

  for (const palette of WALL_PALETTES) {
    assert.ok(palette.id.length > 0);
    assert.ok(palette.name.length > 0);
    assert.ok(palette.subtitle.length > 0);
    assert.match(palette.previewColor, /^#[0-9A-Fa-f]{6}$/);
    assert.match(palette.backWallColor, /^#[0-9A-Fa-f]{6}$/);
    assert.match(palette.leftWallColor, /^#[0-9A-Fa-f]{6}$/);
    assert.match(palette.cornerColor, /^#[0-9A-Fa-f]{6}$/);
  }

  const defaultPalette = getWallPalette(DEFAULT_WALL_PALETTE_ID);
  assert.equal(defaultPalette.id, DEFAULT_WALL_PALETTE_ID);

  const fallbackUndefined = getWallPalette(undefined);
  assert.equal(fallbackUndefined.id, WALL_PALETTES[0].id);

  const fallbackUnknown = getWallPalette('id-inexistente');
  assert.equal(fallbackUnknown.id, WALL_PALETTES[0].id);
});

test('paletas de piso de madeira possuem metadados válidos e recuperam por id com fallback seguro', () => {
  assert.ok(FLOOR_PALETTES.length >= 6);

  for (const palette of FLOOR_PALETTES) {
    assert.ok(palette.id.length > 0);
    assert.ok(palette.name.length > 0);
    assert.ok(palette.subtitle.length > 0);
    assert.match(palette.plankColor, /^#[0-9A-Fa-f]{6}$/);
    assert.match(palette.grooveColor, /^#[0-9A-Fa-f]{6}$/);
    assert.match(palette.baseColor, /^#[0-9A-Fa-f]{6}$/);
  }

  const defaultFloor = getFloorPalette(DEFAULT_FLOOR_PALETTE_ID);
  assert.equal(defaultFloor.id, DEFAULT_FLOOR_PALETTE_ID);

  const fallbackUndefined = getFloorPalette(undefined);
  assert.equal(fallbackUndefined.id, FLOOR_PALETTES[0].id);

  const fallbackUnknown = getFloorPalette('piso-inexistente');
  assert.equal(fallbackUnknown.id, FLOOR_PALETTES[0].id);
});

test('paletas de tapete possuem metadados válidos e recuperam por id com fallback seguro', () => {
  assert.ok(RUG_PALETTES.length >= 6);

  for (const palette of RUG_PALETTES) {
    assert.ok(palette.id.length > 0);
    assert.ok(palette.name.length > 0);
    assert.ok(palette.subtitle.length > 0);
    assert.match(palette.previewColor, /^#[0-9A-Fa-f]{6}$/);
    assert.match(palette.mainColor, /^#[0-9A-Fa-f]{6}$/);
    assert.match(palette.innerColor, /^#[0-9A-Fa-f]{6}$/);
  }

  const defaultRug = getRugPalette(DEFAULT_RUG_PALETTE_ID);
  assert.equal(defaultRug.id, DEFAULT_RUG_PALETTE_ID);

  const fallbackUndefined = getRugPalette(undefined);
  assert.equal(fallbackUndefined.id, RUG_PALETTES[0].id);

  const fallbackUnknown = getRugPalette('tapete-inexistente');
  assert.equal(fallbackUnknown.id, RUG_PALETTES[0].id);
});

test('paletas de estante de marcenaria possuem metadados válidos e recuperam por id com fallback seguro', () => {
  assert.ok(BOOKCASE_PALETTES.length >= 6);

  for (const palette of BOOKCASE_PALETTES) {
    assert.ok(palette.id.length > 0);
    assert.ok(palette.name.length > 0);
    assert.ok(palette.subtitle.length > 0);
    assert.match(palette.frameColor, /^#[0-9A-Fa-f]{6}$/);
    assert.match(palette.shelfColor, /^#[0-9A-Fa-f]{6}$/);
    assert.match(palette.backColor, /^#[0-9A-Fa-f]{6}$/);
    assert.match(palette.trimColor, /^#[0-9A-Fa-f]{6}$/);
    assert.match(palette.metalColor, /^#[0-9A-Fa-f]{6}$/);
  }

  const defaultBookcase = getBookcasePalette(DEFAULT_BOOKCASE_PALETTE_ID);
  assert.equal(defaultBookcase.id, DEFAULT_BOOKCASE_PALETTE_ID);

  const fallbackUndefined = getBookcasePalette(undefined);
  assert.equal(fallbackUndefined.id, BOOKCASE_PALETTES[0].id);

  const fallbackUnknown = getBookcasePalette('estante-inexistente');
  assert.equal(fallbackUnknown.id, BOOKCASE_PALETTES[0].id);
});

test('opções de gatinho possuem metadados válidos e recuperam por id com fallback seguro', () => {
  assert.equal(CAT_OPTIONS.length, 3);

  for (const cat of CAT_OPTIONS) {
    assert.ok(cat.id.length > 0);
    assert.ok(cat.name.length > 0);
    assert.ok(cat.subtitle.length > 0);
    assert.match(cat.furColor, /^#[0-9A-Fa-f]{6}$/);
    assert.match(cat.bedColor, /^#[0-9A-Fa-f]{6}$/);
  }

  const defaultCat = getCatOption(DEFAULT_CAT_ID);
  assert.equal(defaultCat.id, DEFAULT_CAT_ID);
  assert.equal(defaultCat.id, 'catnap-orange');

  const grayCat = getCatOption('gray-catnap');
  assert.equal(grayCat.id, 'gray-catnap');
  assert.equal(grayCat.name, 'Gatinho Cinza');

  const fallbackUndefined = getCatOption(undefined);
  assert.equal(fallbackUndefined.id, CAT_OPTIONS[0].id);

  const fallbackUnknown = getCatOption('gato-inexistente');
  assert.equal(fallbackUnknown.id, CAT_OPTIONS[0].id);
});

test('store gerencia e atualiza wallPaletteId, floorPaletteId, bookcasePaletteId, rugPaletteId e catId de forma reativa', () => {
  const store = useLibraryStore.getState();

  assert.equal(store.wallPaletteId, DEFAULT_WALL_PALETTE_ID);
  assert.equal(store.floorPaletteId, DEFAULT_FLOOR_PALETTE_ID);
  assert.equal(store.bookcasePaletteId, DEFAULT_BOOKCASE_PALETTE_ID);
  assert.equal(store.rugPaletteId, DEFAULT_RUG_PALETTE_ID);
  assert.equal(store.catId, DEFAULT_CAT_ID);

  store.setWallPaletteId('sage-green');
  assert.equal(useLibraryStore.getState().wallPaletteId, 'sage-green');

  store.setFloorPaletteId('dark-walnut');
  assert.equal(useLibraryStore.getState().floorPaletteId, 'dark-walnut');

  store.setBookcasePaletteId('golden-oak');
  assert.equal(useLibraryStore.getState().bookcasePaletteId, 'golden-oak');

  store.setRugPaletteId('sage-botanic');
  assert.equal(useLibraryStore.getState().rugPaletteId, 'sage-botanic');

  store.setCatId('black-catnap');
  assert.equal(useLibraryStore.getState().catId, 'black-catnap');

  store.setCatId('gray-catnap');
  assert.equal(useLibraryStore.getState().catId, 'gray-catnap');

  // Restaura padrões
  store.setWallPaletteId(DEFAULT_WALL_PALETTE_ID);
  store.setFloorPaletteId(DEFAULT_FLOOR_PALETTE_ID);
  store.setBookcasePaletteId(DEFAULT_BOOKCASE_PALETTE_ID);
  store.setRugPaletteId(DEFAULT_RUG_PALETTE_ID);
  store.setCatId(DEFAULT_CAT_ID);
  assert.equal(useLibraryStore.getState().wallPaletteId, DEFAULT_WALL_PALETTE_ID);
  assert.equal(useLibraryStore.getState().floorPaletteId, DEFAULT_FLOOR_PALETTE_ID);
  assert.equal(useLibraryStore.getState().bookcasePaletteId, DEFAULT_BOOKCASE_PALETTE_ID);
  assert.equal(useLibraryStore.getState().rugPaletteId, DEFAULT_RUG_PALETTE_ID);
  assert.equal(useLibraryStore.getState().catId, DEFAULT_CAT_ID);
});

test('estilos de janela possuem metadados válidos e recuperam por id com fallback seguro', () => {
  assert.equal(WINDOW_STYLES.length, 5);

  for (const style of WINDOW_STYLES) {
    assert.ok(style.id.length > 0);
    assert.ok(style.name.length > 0);
    assert.ok(style.subtitle.length > 0);
    assert.match(style.frameColor, /^#[0-9A-Fa-f]{6}$/);
    assert.match(style.sillColor, /^#[0-9A-Fa-f]{6}$/);
    assert.match(style.mullionColor, /^#[0-9A-Fa-f]{6}$/);
  }

  const defaultWindow = getWindowStyle(DEFAULT_WINDOW_STYLE_ID);
  assert.equal(defaultWindow.id, DEFAULT_WINDOW_STYLE_ID);

  const fallbackUndefined = getWindowStyle(undefined);
  assert.equal(fallbackUndefined.id, WINDOW_STYLES[0].id);

  const fallbackUnknown = getWindowStyle('janela-inexistente');
  assert.equal(fallbackUnknown.id, WINDOW_STYLES[0].id);
});

test('opções de moldura de pôster possuem metadados válidos e recuperam por id com fallback seguro', () => {
  assert.equal(POSTER_FRAME_OPTIONS.length, 5);

  for (const frame of POSTER_FRAME_OPTIONS) {
    assert.ok(frame.id.length > 0);
    assert.ok(frame.name.length > 0);
    assert.ok(frame.subtitle.length > 0);
    assert.match(frame.frameColor, /^#[0-9A-Fa-f]{6}$/);
    assert.match(frame.matColor, /^#[0-9A-Fa-f]{6}$/);
    assert.match(frame.trimColor, /^#[0-9A-Fa-f]{6}$/);
  }

  const defaultFrame = getPosterFrame(DEFAULT_POSTER_FRAME_ID);
  assert.equal(defaultFrame.id, DEFAULT_POSTER_FRAME_ID);

  const fallbackUndefined = getPosterFrame(undefined);
  assert.equal(fallbackUndefined.id, POSTER_FRAME_OPTIONS[0].id);

  const fallbackUnknown = getPosterFrame('moldura-inexistente');
  assert.equal(fallbackUnknown.id, POSTER_FRAME_OPTIONS[0].id);
});

test('store gerencia e atualiza leftWallItem, leftWallPosterBookId, leftWallWindowStyle e leftWallFrameColor', () => {
  const store = useLibraryStore.getState();

  assert.equal(store.leftWallItem, DEFAULT_LEFT_WALL_ITEM);
  assert.equal(store.leftWallPosterBookId, undefined);
  assert.equal(store.leftWallWindowStyle, DEFAULT_WINDOW_STYLE_ID);
  assert.equal(store.leftWallFrameColor, DEFAULT_POSTER_FRAME_ID);

  store.setLeftWallItem('window');
  assert.equal(useLibraryStore.getState().leftWallItem, 'window');

  store.setLeftWallWindowStyle('golden-oak');
  assert.equal(useLibraryStore.getState().leftWallWindowStyle, 'golden-oak');

  store.setLeftWallItem('poster');
  assert.equal(useLibraryStore.getState().leftWallItem, 'poster');

  store.setLeftWallPosterBookId('livro-123');
  assert.equal(useLibraryStore.getState().leftWallPosterBookId, 'livro-123');

  store.setLeftWallFrameColor('antique-gold');
  assert.equal(useLibraryStore.getState().leftWallFrameColor, 'antique-gold');

  // Restaura padrões
  store.setLeftWallItem(DEFAULT_LEFT_WALL_ITEM);
  store.setLeftWallPosterBookId(undefined);
  store.setLeftWallWindowStyle(DEFAULT_WINDOW_STYLE_ID);
  store.setLeftWallFrameColor(DEFAULT_POSTER_FRAME_ID);
  assert.equal(useLibraryStore.getState().leftWallItem, DEFAULT_LEFT_WALL_ITEM);
  assert.equal(useLibraryStore.getState().leftWallPosterBookId, undefined);
  assert.equal(useLibraryStore.getState().leftWallWindowStyle, DEFAULT_WINDOW_STYLE_ID);
  assert.equal(useLibraryStore.getState().leftWallFrameColor, DEFAULT_POSTER_FRAME_ID);
});

test('opções de moldura de quadro possuem metadados válidos e recuperam por id com fallback seguro', () => {
  assert.equal(PICTURE_FRAME_STYLES.length, 5);

  for (const style of PICTURE_FRAME_STYLES) {
    assert.ok(style.id.length > 0);
    assert.ok(style.name.length > 0);
    assert.ok(style.subtitle.length > 0);
    assert.match(style.frameColor, /^#[0-9A-Fa-f]{6}$/);
    assert.match(style.matColor, /^#[0-9A-Fa-f]{6}$/);
    assert.match(style.trimColor, /^#[0-9A-Fa-f]{6}$/);
  }

  const defaultStyle = getPictureFrameStyle(DEFAULT_PICTURE_FRAME_STYLE_ID);
  assert.equal(defaultStyle.id, DEFAULT_PICTURE_FRAME_STYLE_ID);

  const fallbackUndefined = getPictureFrameStyle(undefined);
  assert.equal(fallbackUndefined.id, PICTURE_FRAME_STYLES[0].id);

  const fallbackUnknown = getPictureFrameStyle('estilo-inexistente');
  assert.equal(fallbackUnknown.id, PICTURE_FRAME_STYLES[0].id);
});

test('store gerencia e atualiza pictureFrameSize, pictureFrameStyleId e pictureFramePhotoUri', () => {
  const store = useLibraryStore.getState();

  assert.equal(store.pictureFrameSize, DEFAULT_PICTURE_FRAME_SIZE);
  assert.equal(store.pictureFrameStyleId, DEFAULT_PICTURE_FRAME_STYLE_ID);
  assert.equal(store.pictureFramePhotoUri, null);

  store.setPictureFrameSize('2:1');
  assert.equal(useLibraryStore.getState().pictureFrameSize, '2:1');

  store.setPictureFrameStyleId('natural-oak');
  assert.equal(useLibraryStore.getState().pictureFrameStyleId, 'natural-oak');

  store.setPictureFramePhotoUri('data:image/jpeg;base64,mockImageData');
  assert.equal(useLibraryStore.getState().pictureFramePhotoUri, 'data:image/jpeg;base64,mockImageData');

  store.setPictureFrameSize('none');
  assert.equal(useLibraryStore.getState().pictureFrameSize, 'none');

  // Restaura padrões
  store.setPictureFrameSize(DEFAULT_PICTURE_FRAME_SIZE);
  store.setPictureFrameStyleId(DEFAULT_PICTURE_FRAME_STYLE_ID);
  store.setPictureFramePhotoUri(null);
  assert.equal(useLibraryStore.getState().pictureFrameSize, DEFAULT_PICTURE_FRAME_SIZE);
  assert.equal(useLibraryStore.getState().pictureFrameStyleId, DEFAULT_PICTURE_FRAME_STYLE_ID);
  assert.equal(useLibraryStore.getState().pictureFramePhotoUri, null);
});
