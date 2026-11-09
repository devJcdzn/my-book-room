import assert from 'node:assert/strict';
import test from 'node:test';
import { getBookDetailsPalette } from '../src/utils/book-details-palette';

const luminance = (hex: string) => hex.slice(1).match(/../g)!.reduce((sum, channel, index) => {
  const value = parseInt(channel, 16) / 255;
  return sum + (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][index];
}, 0);
const contrast = (a: string, b: string) => {
  const values = [luminance(a), luminance(b)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
};

test('cover palettes preserve readable text across bright, dark and saturated covers', () => {
  for (const cover of ['#000000', '#FFFFFF', '#777777', '#FF0000', '#00FF00', '#0000FF', '#5E9997', '#FF6600']) {
    for (const isNight of [false, true]) {
      const palette = getBookDetailsPalette(cover, isNight);
      for (const background of [palette.background, palette.surface, palette.surfaceStrong]) {
        for (const foreground of [palette.text, palette.muted, palette.accent]) {
          assert.ok(contrast(background, foreground) >= 4.5, `${cover}: ${foreground} on ${background}`);
        }
      }
      assert.ok(contrast(palette.fill, palette.actionText) >= 4.5);
      assert.ok(contrast(palette.background, palette.text) >= 7);
    }
  }
});

test('light and dark covers select matching text and status bar appearance', () => {
  assert.equal(getBookDetailsPalette('#FFFFFF', false).isDark, false);
  assert.equal(getBookDetailsPalette('#000000', false).isDark, true);
  assert.notEqual(getBookDetailsPalette('#5E9997', false).background, getBookDetailsPalette('#FF6600', false).background);
});

test('missing or invalid cover colors use the default page color', () => {
  assert.deepEqual(getBookDetailsPalette(undefined, false), getBookDetailsPalette('#F6EFE5', false));
  assert.deepEqual(getBookDetailsPalette('invalid', true), getBookDetailsPalette('#F6EFE5', true));
});
