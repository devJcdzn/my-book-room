import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_FLOOR_PALETTE_ID,
  DEFAULT_WALL_PALETTE_ID,
  FLOOR_PALETTES,
  WALL_PALETTES,
  getFloorPalette,
  getWallPalette,
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

test('store gerencia e atualiza wallPaletteId e floorPaletteId de forma reativa', () => {
  const store = useLibraryStore.getState();

  assert.equal(store.wallPaletteId, DEFAULT_WALL_PALETTE_ID);
  assert.equal(store.floorPaletteId, DEFAULT_FLOOR_PALETTE_ID);

  store.setWallPaletteId('sage-green');
  assert.equal(useLibraryStore.getState().wallPaletteId, 'sage-green');

  store.setFloorPaletteId('dark-walnut');
  assert.equal(useLibraryStore.getState().floorPaletteId, 'dark-walnut');

  // Restaura padrões
  store.setWallPaletteId(DEFAULT_WALL_PALETTE_ID);
  store.setFloorPaletteId(DEFAULT_FLOOR_PALETTE_ID);
  assert.equal(useLibraryStore.getState().wallPaletteId, DEFAULT_WALL_PALETTE_ID);
  assert.equal(useLibraryStore.getState().floorPaletteId, DEFAULT_FLOOR_PALETTE_ID);
});
