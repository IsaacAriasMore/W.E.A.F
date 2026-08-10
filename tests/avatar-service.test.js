import test from 'node:test';
import assert from 'node:assert/strict';
import { createAvatarService, validateAvatarFile } from '../src/services/avatarService.js';

test('avatar files accept only bounded raster image formats', () => {
  assert.equal(validateAvatarFile({ type: 'image/jpeg', size: 1024 }), null);
  assert.match(validateAvatarFile({ type: 'image/svg+xml', size: 1024 }), /JPG, PNG o WebP/);
  assert.match(validateAvatarFile({ type: 'image/webp', size: 6 * 1024 * 1024 }), /5 MiB/);
});

test('avatar upload uses one actor-owned path and a raster content type', async () => {
  let upload;
  const client = { storage: { from: () => ({
    async upload(...args) { upload = args; return { error: null }; },
    getPublicUrl: () => ({ data: { publicUrl: 'https://project.supabase.co/storage/v1/object/public/avatars/user-1/avatar' } }),
    async remove() { return { error: null }; },
  }) } };
  const result = await createAvatarService(client).uploadAvatar('user-1', { type: 'image/webp', size: 1024 });
  assert.equal(upload[0], 'user-1/avatar');
  assert.deepEqual(upload[2], { cacheControl: '3600', contentType: 'image/webp', upsert: true });
  assert.match(result.url, /avatars\/user-1\/avatar\?v=/);
});
