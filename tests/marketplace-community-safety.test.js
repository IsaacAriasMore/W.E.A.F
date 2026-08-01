import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  parseSafeHttpsUrl,
  safeDiscordInviteUrl,
  safeImageUrl,
  trustedPayPalSandboxApprovalUrl,
} from '../src/utils/safeUrl.js';
import { sanitizeFrontendErrorMessage } from '../src/services/frontendErrorMonitor.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const migration = read('supabase/migrations/20260801184631_marketplace_community_safety.sql');

test('external URLs require HTTPS, public hosts and no embedded credentials', () => {
  assert.equal(parseSafeHttpsUrl('javascript:alert(1)'), null);
  assert.equal(parseSafeHttpsUrl('https://user:pass@example.com/path'), null);
  assert.equal(parseSafeHttpsUrl('https://127.0.0.1/image.png'), null);
  assert.equal(parseSafeHttpsUrl('https://192.168.1.4/image.png'), null);
  assert.equal(parseSafeHttpsUrl('https://example.com/\u0000bad'), null);
  assert.equal(safeImageUrl('data:image/svg+xml,<svg/>'), null);
  assert.equal(safeImageUrl('https://images.example.com/card.webp'), 'https://images.example.com/card.webp');
});

test('Discord and PayPal use exact allowlists rather than suffix matching', () => {
  assert.equal(safeDiscordInviteUrl('https://discord.gg/Weaf_123'), 'https://discord.gg/Weaf_123');
  assert.equal(safeDiscordInviteUrl('https://discord.com/invite/Weaf-123'), 'https://discord.com/invite/Weaf-123');
  assert.equal(safeDiscordInviteUrl('https://discord.gg.evil.example/Weaf'), null);
  assert.equal(safeDiscordInviteUrl('https://discord.com/channels/1'), null);
  assert.equal(trustedPayPalSandboxApprovalUrl('https://www.sandbox.paypal.com/checkoutnow?token=test')?.startsWith('https://www.sandbox.paypal.com/'), true);
  assert.equal(trustedPayPalSandboxApprovalUrl('https://sandbox.paypal.com.evil.example/checkout'), null);
  assert.equal(trustedPayPalSandboxApprovalUrl('https://www.paypal.com/checkout'), null);
});

test('community tables use RLS, ownership and minimal grants', () => {
  for (const table of ['marketplace_favorites', 'marketplace_user_blocks', 'marketplace_notifications', 'frontend_error_events']) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(migration, /primary key \(user_id, listing_id\)/);
  assert.match(migration, /primary key \(blocker_user_id, blocked_user_id\)/);
  assert.match(migration, /auth\.uid\(\)\) = user_id/);
  assert.match(migration, /auth\.uid\(\)\) = blocker_user_id/);
  assert.match(migration, /revoke all on public\.marketplace_favorites[\s\S]*from public, anon, authenticated/);
  assert.doesNotMatch(migration, /grant execute on function public\.set_marketplace_user_block\(uuid,boolean\)[\s\S]*to authenticated/);
});

test('reports enforce a closed reason set, dedupe and layered rate limits', () => {
  assert.match(migration, /'fraud','duplicate','prohibited_content','false_information',[\s\S]*'dangerous_link','harassment','other'/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, />= 5 then[\s\S]{0,30}raise exception 'marketplace_report_hourly_limit'/);
  assert.match(migration, />= 20 then[\s\S]{0,30}raise exception 'marketplace_report_daily_limit'/);
  assert.match(migration, />= 25 then[\s\S]{0,30}raise exception 'marketplace_listing_report_limit'/);
  assert.match(migration, /marketplace_report_duplicate/);
});

test('moderation and suspension are admin-only, audited and preserve history', () => {
  assert.match(migration, /admin_moderate_marketplace_listing[\s\S]*private\.is_global_admin\(\)/);
  assert.match(migration, /p_status not in \('active','hidden','rejected'\)/);
  assert.match(migration, /admin_set_marketplace_user_suspension[\s\S]*p_action not in \('suspend','reactivate'\)/);
  assert.match(migration, /insert into public\.marketplace_audit_log/);
  assert.doesNotMatch(migration, /delete from public\.marketplace_payments/);
  assert.doesNotMatch(migration, /delete from public\.marketplace_audit_log/);
});

test('frontend error messages redact credentials and cap payload length', () => {
  const sanitized = sanitizeFrontendErrorMessage(`Authorization Bearer-secret password=hunter2 token=abc ${'x'.repeat(700)}`);
  assert.doesNotMatch(sanitized, /hunter2|Bearer-secret|token=abc/);
  assert.ok(sanitized.length <= 500);
  assert.equal(sanitizeFrontendErrorMessage('bad\u0000value'), 'bad value');
  assert.match(migration, /record_frontend_error[\s\S]*>= 30 then return false/);
  assert.match(migration, /maintain_frontend_error_events[\s\S]*interval '30 days'[\s\S]*limit 5000/);
  assert.match(migration, /cron\.schedule\([\s\S]*maintain-frontend-error-events/);
  assert.match(migration, /Retain for 30 days/);
});

test('listing expiration creates one owned internal notification', () => {
  assert.match(migration, /notify_marketplace_listing_expired/);
  assert.match(migration, /new\.owner_user_id,'expired','listing'/);
  assert.match(migration, /on conflict \(user_id,dedupe_key\) do nothing/);
});

test('admin moderation UI exposes filters, pagination and required reasons', () => {
  const page = read('src/pages/admin/adminDashboard.js');
  assert.match(page, /data-marketplace-filters/);
  assert.match(page, /data-market-page="previous"/);
  assert.match(page, /data-market-suspend/);
  assert.match(page, /Motivo de moderación \(obligatorio\)/);
  assert.doesNotMatch(page, /escapeHtml\(item\.owner_user_id\)/);
});
