import assert from 'node:assert/strict';
import test from 'node:test';
import { Texture, type TextureLoader } from 'three';
import { createRoomTextureCache } from '../src/components/room/use-room-texture';

function setup() {
  const requests: { url: string; texture: Texture; succeed: () => void; fail: () => void; disposals: number }[] = [];
  const loader = {
    load(url, onLoad, _progress, onError) {
      const texture = new Texture<HTMLImageElement>();
      const request = {
        url, texture, disposals: 0,
        succeed: () => onLoad?.(texture),
        fail: () => onError?.(new Error('offline')),
      };
      texture.addEventListener('dispose', () => request.disposals++);
      requests.push(request);
      return texture;
    },
  } satisfies Pick<TextureLoader, 'load'>;
  return { cache: createRoomTextureCache(loader), requests };
}

test('concurrent consumers share one load and release only after the last leaves', () => {
  const { cache, requests } = setup();
  const first: (Texture | null)[] = [], second: (Texture | null)[] = [];
  const releaseFirst = cache.subscribe('cover', texture => first.push(texture));
  const releaseSecond = cache.subscribe('cover', texture => second.push(texture));
  assert.equal(requests.length, 1);
  requests[0].succeed();
  assert.equal(cache.get('cover'), requests[0].texture);
  assert.equal(first.at(-1), requests[0].texture);
  assert.equal(second.at(-1), requests[0].texture);
  releaseFirst();
  assert.equal(requests[0].disposals, 0);
  releaseSecond();
  releaseSecond();
  assert.equal(requests[0].disposals, 1);
  assert.equal(cache.get('cover'), null);
});

test('a late result is disposed and cannot replace a newer request for the same URL', () => {
  const { cache, requests } = setup();
  const values: (Texture | null)[] = [];
  cache.subscribe('cover', () => {})();
  const release = cache.subscribe('cover', texture => values.push(texture));
  requests[0].succeed();
  assert.equal(requests[0].disposals, 1);
  assert.deepEqual(values, [null]);
  requests[1].succeed();
  assert.equal(values.at(-1), requests[1].texture);
  release();
  assert.equal(requests[1].disposals, 1);
});

test('switching URLs ignores the old load and starts the new image with a fallback', () => {
  const { cache, requests } = setup();
  const old: (Texture | null)[] = [], next: (Texture | null)[] = [];
  cache.subscribe('old', texture => old.push(texture))();
  const release = cache.subscribe('next', texture => next.push(texture));
  assert.equal(cache.get('next'), null);
  assert.equal(cache.get(null), null);
  requests[0].succeed();
  assert.deepEqual(old, [null]);
  assert.deepEqual(next, [null]);
  requests[1].succeed();
  assert.equal(next.at(-1), requests[1].texture);
  release();
});

test('failed loads release their texture, retain the fallback and can load on remount', () => {
  const { cache, requests } = setup();
  const values: (Texture | null)[] = [];
  const release = cache.subscribe('broken', texture => values.push(texture));
  requests[0].fail();
  assert.deepEqual(values, [null, null]);
  assert.equal(requests[0].disposals, 1);
  release();
  assert.equal(requests[0].disposals, 1);
  cache.subscribe('broken', () => {})();
  assert.equal(requests.length, 2);
  requests[1].fail();
  assert.equal(requests[1].disposals, 1);
});

test('repeated mounted lifecycles do not retain loaded images', () => {
  const { cache, requests } = setup();
  for (let cycle = 0; cycle < 30; cycle++) {
    const release = cache.subscribe('cover', () => {});
    requests[cycle].succeed();
    release();
  }
  assert.equal(requests.length, 30);
  assert.equal(requests.every(request => request.disposals === 1), true);
});
