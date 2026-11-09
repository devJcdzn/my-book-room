import assert from 'node:assert/strict';
import test from 'node:test';
import { IAP_ENABLED } from '../src/config/features';
import { accessibleRoomLayout, newlyUnlockedCollections, ownedCollections, lockedCollection, useCollectionPurchases } from '../src/services/collection-access';
import { ROOM_COLOR_CATEGORIES } from '../src/types/room-customization';
import { createDefaultRoomLayout } from '../src/types/room-layout';
import { useRoomEditor } from '../src/store/room-editor-store';

test('only the two paid collections lock, including all models, palettes and object colors', () => {
  for (const collection of ['observatory', 'teahouse']) {
    for (const category of ['desk', 'seat', 'bookcase', 'lamp', 'window', 'frame', 'rug', 'pillow']) {
      assert.equal(lockedCollection(`${collection}-${category}`, [], true), collection);
    }
    for (const color of ROOM_COLOR_CATEGORIES.find(category => category.id === collection)!.colors) {
      assert.equal(lockedCollection(color, [], true), collection);
    }
    assert.equal(lockedCollection(`${collection}-floor`, [], true), collection);
    assert.equal(lockedCollection(`${collection}-wall`, [], true), collection);
    assert.equal(lockedCollection(collection, [collection], true), null);
    assert.equal(lockedCollection(collection, [], false), null);
  }
  for (const id of ['isometric-desk', 'botanic-desk', 'atelier-seat', 'library-window', '#778DAF']) {
    assert.equal(lockedCollection(id, [], true), null);
  }
  assert.equal(lockedCollection('teahouse', ['observatory'], true), 'teahouse');
});

test('saved paid choices are hidden without access, restored with access, and never overwritten', () => {
  const layout = createDefaultRoomLayout();
  const desk = layout.pieces.find(piece => piece.category === 'desk')!;
  desk.modelId = 'observatory-desk';
  desk.color = '#34465E';
  const snapshot = JSON.stringify(layout);
  const locked = accessibleRoomLayout(layout, [], true);
  assert.equal(locked.pieces.find(piece => piece.id === desk.id)?.modelId, 'isometric-desk');
  assert.equal(locked.pieces.find(piece => piece.id === desk.id)?.color, undefined);
  assert.equal(JSON.stringify(layout), snapshot);
  assert.deepEqual(accessibleRoomLayout(layout, ['observatory'], true), layout);
  assert.equal(accessibleRoomLayout(layout, [], false), layout);
  assert.deepEqual(accessibleRoomLayout(layout, [], true), locked);
});

test('editor rejects locked changes and accepts only the owned collection', { skip: !IAP_ENABLED }, () => {
  const editor = useRoomEditor.getState();
  const layout = createDefaultRoomLayout();
  const desk = layout.pieces.find(piece => piece.category === 'desk')!;
  useCollectionPurchases.setState({ owned: [], ready: true });
  editor.begin(layout, { wallPaletteId: 'mist-blue', floorPaletteId: 'ash-wood', rugPaletteId: 'soft-slate', catId: 'catnap-orange' });
  assert.equal(editor.update({ ...desk, modelId: 'observatory-desk' }), false);
  assert.equal(editor.update({ ...desk, color: '#8C9275' }), false);
  assert.equal(editor.add({ ...desk, id: 'paid-copy', modelId: 'teahouse-desk' }), false);
  editor.setAppearance({ wallPaletteId: 'teahouse-sand' });
  assert.equal(useRoomEditor.getState().appearance?.wallPaletteId, 'mist-blue');
  useCollectionPurchases.setState({ owned: ['observatory'] });
  assert.equal(editor.update({ ...desk, modelId: 'observatory-desk' }), true);
  assert.equal(editor.update({ ...desk, modelId: 'teahouse-desk' }), false);
  editor.setAppearance({ wallPaletteId: 'observatory-blue' });
  assert.equal(useRoomEditor.getState().appearance?.wallPaletteId, 'observatory-blue');
  useCollectionPurchases.setState({ owned: [] });
  assert.equal(editor.update({ ...desk, modelId: 'observatory-desk' }), false);
  editor.close();
});


test('access comes only from each active collection entitlement, never Plus or another product', () => {
  assert.deepEqual(ownedCollections({ entitlements: { active: {} } }), []);
  assert.deepEqual(ownedCollections({ entitlements: { active: { 'Nookly Pro': { isActive: true } } } }), []);
  assert.deepEqual(ownedCollections({ entitlements: { active: { 'nookly.collection.observatory': { isActive: true }, 'nookly.collection.teahouse': { isActive: false } } } }), ['observatory']);
  assert.deepEqual(ownedCollections({ entitlements: { active: { 'nookly.collection.observatory': { isActive: true }, 'nookly.collection.teahouse': { isActive: true } } } }), ['observatory', 'teahouse']);
});

test('unlock celebration includes only newly confirmed collections', () => {
  assert.deepEqual(newlyUnlockedCollections([], []), []);
  assert.deepEqual(newlyUnlockedCollections(['observatory'], ['observatory']), []);
  assert.deepEqual(newlyUnlockedCollections([], ['observatory']), ['observatory']);
  assert.deepEqual(newlyUnlockedCollections(['observatory'], ['observatory', 'teahouse']), ['teahouse']);
  assert.deepEqual(newlyUnlockedCollections(['observatory'], []), []);
});
