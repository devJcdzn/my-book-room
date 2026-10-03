import assert from 'node:assert/strict';
import test from 'node:test';
import { cloudAvatar, normalizeAvatar } from '../src/types/profile-avatar';

test('perfis antigos continuam sem foto e remoção explícita é preservada', () => {
  assert.equal(normalizeAvatar(undefined), undefined);
  assert.deepEqual(cloudAvatar(normalizeAvatar({ source: 'none', version: 'removed', pending: true })), { source: 'none', version: 'removed' });
});

test('backup de avatar exclui arquivo local, fila e referência anterior', () => {
  const remote = cloudAvatar({ source: 'custom', version: 'new', localUri: 'file:///private/avatar.jpg', storagePath: 'user/new.jpg', pending: true, previousPath: 'user/old.jpg' });
  assert.deepEqual(remote, { source: 'custom', version: 'new', storagePath: 'user/new.jpg' });
  assert.equal(JSON.stringify(remote).includes('file://'), false);
});

test('foto de provedor HTTPS entra no backup sem cache local', () => {
  assert.deepEqual(cloudAvatar({ source: 'provider', version: 'google', providerUrl: 'https://example.com/avatar.jpg', localUri: 'file:///cache/avatar.jpg' }), { source: 'provider', version: 'google', providerUrl: 'https://example.com/avatar.jpg' });
  assert.equal(normalizeAvatar({ source: 'provider', version: 'unsafe', providerUrl: 'file:///private/avatar.jpg' })?.providerUrl, undefined);
});

test('normalização rejeita fontes desconhecidas e preserva upload pendente', () => {
  assert.equal(normalizeAvatar({ source: 'invalid', version: '1' }), undefined);
  assert.equal(normalizeAvatar({ source: 'custom', version: '../guest/photo' }), undefined);
  const avatar = normalizeAvatar({ source: 'custom', version: 'new', localUri: 'file:///avatar.jpg', pending: true, storagePath: '../another-user/photo.jpg' });
  assert.equal(avatar?.pending, true);
  assert.equal(avatar?.storagePath, undefined);
});

test('recupera fotos por versão e após mudança da pasta de documentos', async (t) => {
  const module = require('node:module') as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const originalLoad = module._load;
  const files = new Map<string, Uint8Array>();
  class Directory {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map(part => typeof part === 'string' ? part : part.uri).join('/');
    }
    create() {}
  }
  class File extends Directory {
    get exists() { return files.has(this.uri); }
    get size() { return files.get(this.uri)?.length ?? 0; }
    copy(destination: File) { files.set(destination.uri, files.get(this.uri)!); }
    async arrayBuffer() { return files.get(this.uri)!.buffer; }
  }
  t.mock.method(module, '_load', function (request: string, parent: unknown, isMain: boolean) {
    if (request === 'expo-file-system') return { Directory, File, Paths: { document: new Directory('file:///current/Documents') } };
    if (request === 'expo-image-manipulator') return {};
    return originalLoad(request, parent, isMain);
  });
  const { adoptAvatar, uploadAvatar, cacheAvatar } = require('../src/services/profile-avatar') as typeof import('../src/services/profile-avatar');
  const owner = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  files.set('file:///current/Documents/room-photos/guest/recovered.jpg', new Uint8Array([1, 2, 3]));
  const recovered = adoptAvatar({ source: 'custom', version: 'recovered', pending: true }, owner, 'room-photos');
  assert.equal(recovered.localUri, `file:///current/Documents/room-photos/${owner}/recovered.jpg`);

  const requests: string[] = [];
  const client = { storage: { from: () => ({ upload: async (path: string, bytes: ArrayBuffer) => {
    requests.push(path);
    assert.deepEqual([...new Uint8Array(bytes)], [1, 2, 3]);
    return { error: null };
  } }) } } as unknown as import('@supabase/supabase-js').SupabaseClient;
  const uploaded = await uploadAvatar(client, owner, recovered, 'room-photos');
  assert.equal(uploaded?.pending, false);
  assert.deepEqual(requests, [`${owner}/recovered.jpg`]);

  files.set('file:///current/Documents/old-photos/frame.jpg', new Uint8Array([1, 2, 3]));
  const relocated = adoptAvatar({ source: 'custom', version: 'relocated', localUri: 'file:///previous/Documents/old-photos/frame.jpg' }, owner, 'room-photos');
  assert.equal(await cacheAvatar(undefined, owner, relocated, 'room-photos'), relocated.localUri);
  assert.ok(relocated.localUri?.includes('/current/Documents/'));

  const missing = adoptAvatar({ source: 'custom', version: 'missing', localUri: 'file:///missing.jpg' }, owner, 'room-photos');
  assert.equal(missing.localUri, 'file:///missing.jpg');
  await assert.rejects(uploadAvatar(client, owner, missing, 'room-photos'), /Escolha novamente/);
  assert.equal(requests.length, 1);
});
