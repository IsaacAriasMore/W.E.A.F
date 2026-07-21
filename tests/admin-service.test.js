import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminService } from '../src/services/adminService.js';

test('admin workspace is loaded through one protected RPC', async () => {
  let call;
  const service = createAdminService({
    async rpc(name, params) {
      call = { name, params };
      return { data: { metrics: {}, users: [] }, error: null };
    },
  });

  const result = await service.getWorkspace();
  assert.deepEqual(call, { name: 'get_admin_workspace', params: {} });
  assert.deepEqual(result.data.users, []);
});

test('user suspension sends reason and target only to the admin RPC', async () => {
  let call;
  const service = createAdminService({
    async rpc(name, params) {
      call = { name, params };
      return { data: null, error: null };
    },
  });

  await service.setUserSuspension('user-id', true, 'Moderation review');
  assert.deepEqual(call, {
    name: 'admin_set_user_suspension',
    params: { p_user_id: 'user-id', p_suspended: true, p_reason: 'Moderation review' },
  });
});

test('content writes use an explicit entity and a structured payload', async () => {
  let call;
  const service = createAdminService({
    async rpc(name, params) {
      call = { name, params };
      return { data: 'species-id', error: null };
    },
  });

  await service.upsertContent('species', null, { name: 'Rex', is_public: true });
  assert.deepEqual(call, {
    name: 'admin_upsert_content',
    params: { p_entity: 'species', p_id: null, p_payload: { name: 'Rex', is_public: true } },
  });
});

test('manual server publication is scoped to the protected admin RPC', async () => {
  let call;
  const service = createAdminService({ async rpc(name, params) { call = { name, params }; return { data: 'server-id', error: null }; } });
  const payload = { title: 'Cluster Norte', plan: 'manual' };
  await service.upsertServerListing({ payload, durationMonths: 3 });
  assert.deepEqual(call, { name: 'admin_upsert_server_listing', params: { p_listing_id: null, p_payload: payload, p_duration_months: 3 } });
});
