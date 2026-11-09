import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ROOM_COLOR_CATEGORIES,
  roomPaletteCategory,
  DEFAULT_BOOKCASE_PALETTE_ID,
  DEFAULT_FLOOR_PALETTE_ID,
  DEFAULT_RUG_PALETTE_ID,
  DEFAULT_WALL_PALETTE_ID,
  migrateLegacyRoomPaletteSelection,
} from '../src/types/room-customization';

test('only migrates the unchanged legacy room palette defaults', () => {
  const legacyDefaults = {
    wallPaletteId: 'warm-sand',
    floorPaletteId: 'golden-oak',
    rugPaletteId: 'terracotta-classic',
    bookcasePaletteId: 'rustic-mahogany',
  };
  assert.deepEqual(migrateLegacyRoomPaletteSelection(legacyDefaults), {
    wallPaletteId: DEFAULT_WALL_PALETTE_ID,
    floorPaletteId: DEFAULT_FLOOR_PALETTE_ID,
    rugPaletteId: DEFAULT_RUG_PALETTE_ID,
    bookcasePaletteId: DEFAULT_BOOKCASE_PALETTE_ID,
  });

  const customized = { ...legacyDefaults, wallPaletteId: 'mist-blue' };
  assert.deepEqual(migrateLegacyRoomPaletteSelection(customized), customized);
});


test('base colors are separate from collection colors and palette categories are stable', () => {
  const base = ROOM_COLOR_CATEGORIES[0];
  assert.equal(base.id, 'base');
  for (const collection of ROOM_COLOR_CATEGORIES.slice(1)) {
    for (const color of collection.colors) assert.ok(!new Set<string>(base.colors).has(color));
    assert.equal(roomPaletteCategory(`${collection.id}-palette`), collection.id);
  }
  assert.equal(roomPaletteCategory('mist-blue'), 'base');
  assert.equal(roomPaletteCategory('ash-wood'), 'base');
});
