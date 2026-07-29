import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  beginMarketplaceLoad,
  canSaveMarketplace,
  completeMarketplaceLoad,
  createMarketplaceState,
} from '../src/utils/adminMarketplaceState.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Admin Marketplace never enables writes before a trustworthy load', () => {
  const initial = createMarketplaceState();
  assert.equal(initial.status, 'loading');
  assert.equal(initial.data, null);
  assert.equal(canSaveMarketplace(initial), false);

  const loaded = completeMarketplaceLoad(initial, {
    data: { setting: { marketplace_enabled: false, payments_enabled: false }, reports: [] },
    error: null,
  });
  assert.equal(loaded.status, 'loaded');
  assert.equal(canSaveMarketplace(loaded), true);
});

test('Admin Marketplace preserves previous data but locks mutations on loading and error', () => {
  const validData = { setting: { marketplace_enabled: false, payments_enabled: false }, reports: [{ id: 'r1' }] };
  const loaded = completeMarketplaceLoad(createMarketplaceState(), { data: validData, error: null });
  const loading = beginMarketplaceLoad(loaded);
  assert.equal(loading.data, validData);
  assert.equal(canSaveMarketplace(loading), false);

  const failed = completeMarketplaceLoad(loading, { data: null, error: 'network_failed' });
  assert.equal(failed.status, 'error');
  assert.equal(failed.data, validData);
  assert.equal(failed.error, 'network_failed');
  assert.equal(canSaveMarketplace(failed), false);

  const retrying = beginMarketplaceLoad(failed);
  const recovered = completeMarketplaceLoad(retrying, {
    data: { ...validData, reports: [{ id: 'r1' }, { id: 'r2' }] },
    error: null,
  });
  assert.equal(recovered.status, 'loaded');
  assert.equal(recovered.data.reports.length, 2);
  assert.equal(canSaveMarketplace(recovered), true);
});

test('Admin Marketplace exposes an initial error without inventing settings', () => {
  const failed = completeMarketplaceLoad(createMarketplaceState(), { data: null, error: 'initial_failure' });
  assert.equal(failed.status, 'error');
  assert.equal(failed.data, null);
  assert.equal(failed.error, 'initial_failure');
  assert.equal(canSaveMarketplace(failed), false);
});

test('Admin Marketplace rejects incomplete responses instead of inventing settings', () => {
  const failed = completeMarketplaceLoad(createMarketplaceState(), { data: { reports: [] }, error: null });
  assert.equal(failed.status, 'error');
  assert.equal(failed.data, null);
});

test('Admin Marketplace exposes loading, retry and guarded report actions', () => {
  const page = read('src/pages/admin/adminDashboard.js');
  assert.match(page, /Consultando la configuración real/);
  assert.match(page, /data-marketplace-retry/);
  assert.match(page, /canSaveMarketplace\(marketplaceState\)/);
  assert.match(page, /data-market-report-status/);
  assert.match(page, /\['reviewing', 'Revisar'\]/);
  assert.match(page, /\['resolved', 'Resolver'\]/);
  assert.match(page, /\['dismissed', 'Descartar'\]/);
  assert.match(page, /row\.outerHTML = marketplaceReportRow\(updated\)/);
  const settingsSubmit = page.slice(page.indexOf("event.target.matches('[data-marketplace-settings]')"));
  assert.ok(settingsSubmit.indexOf('!canSaveMarketplace(marketplaceState)') < settingsSubmit.indexOf('service.setMarketplaceSettings'));
});

test('Admin layout contains desktop, tablet and mobile containment rules', () => {
  const css = read('src/css/admin.css');
  assert.match(css, /body\[data-route-kind="admin"\]\s*\{[^}]*overflow-x:\s*clip/);
  assert.match(css, /\.admin-table-wrap\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(css, /\.admin-action\s*\{[^}]*min-height:\s*44px/);
  assert.match(css, /@media \(max-width: 1120px\)/);
  assert.match(css, /@media \(max-width: 780px\)/);
  assert.match(css, /@media \(max-width: 620px\)/);
});

test('Marketplace report RPC is global-admin-only, constrained and audited', () => {
  const migration = read('supabase/migrations/20260729060503_admin_marketplace_report_status.sql');
  assert.match(migration, /security definer[\s\S]*set search_path = ''/);
  assert.match(migration, /if not private\.is_global_admin\(\)[\s\S]*global_admin_required/);
  assert.match(migration, /p_report_id is null[\s\S]*invalid_marketplace_report_id/);
  assert.match(migration, /not in \('reviewing', 'resolved', 'dismissed'\)/);
  assert.match(migration, /insert into public\.marketplace_audit_log/);
  assert.match(migration, /'report_status_updated'/);
  assert.match(migration, /revoke all[\s\S]*from public, anon, authenticated, service_role/);
  assert.match(migration, /grant execute[\s\S]*to authenticated/);
  assert.doesNotMatch(migration, /grant execute[\s\S]*to anon/);
});
