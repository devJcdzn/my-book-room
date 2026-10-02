import assert from 'node:assert/strict';
import test from 'node:test';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture } from 'three';
import { retainRoomModel } from '../src/components/room/room-resources';

test('shared GLTF resources are released once after the last model leaves, preserving their data', () => {
  const geometry = new BoxGeometry();
  const texture = new Texture();
  const material = new MeshStandardMaterial({ map: texture });
  const object = new Group();
  object.add(new Mesh(geometry, material), new Mesh(geometry, material));
  const disposals = { geometry: 0, material: 0, texture: 0 };
  geometry.addEventListener('dispose', () => disposals.geometry++);
  material.addEventListener('dispose', () => disposals.material++);
  texture.addEventListener('dispose', () => disposals.texture++);
  const releaseFirst = retainRoomModel(object);
  const releaseSecond = retainRoomModel(object.clone(true));
  releaseFirst();
  assert.deepEqual(disposals, { geometry: 0, material: 0, texture: 0 });
  releaseSecond();
  releaseSecond();
  assert.deepEqual(disposals, { geometry: 1, material: 1, texture: 1 });
  assert.ok(geometry.attributes.position.array.length > 0);
  assert.equal(material.map, texture);
});

test('renderer disposal callbacks cannot accumulate through repeated model mounts', () => {
  const geometry = new BoxGeometry();
  const object = new Mesh(geometry, new MeshStandardMaterial());
  let activeRenderers = 0;
  for (let cycle = 0; cycle < 30; cycle++) {
    const release = retainRoomModel(object);
    const onDispose = () => {
      activeRenderers--;
      geometry.removeEventListener('dispose', onDispose);
    };
    geometry.addEventListener('dispose', onDispose);
    activeRenderers++;
    assert.equal(activeRenderers, 1);
    release();
    assert.equal(activeRenderers, 0);
  }
});
