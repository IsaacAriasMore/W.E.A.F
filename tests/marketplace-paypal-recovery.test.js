import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { approvalUrl, getPayPalConfig, PayPalError } from '../supabase/functions/_shared/paypal.ts';
import { resolveMarketplacePayPalOrder } from '../supabase/functions/_shared/paypalOrderFlow.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const edge = read('../supabase/functions/create-marketplace-paypal-order/index.ts');
const flow = read('../supabase/functions/_shared/paypalOrderFlow.ts');
const paypalShared = read('../supabase/functions/_shared/paypal.ts');
const migration = read('../supabase/migrations/20260731110000_marketplace_paypal_order_creation_recovery.sql');

const payerAction = { rel: 'payer-action', href: 'https://sandbox.paypal.com/checkoutnow?token=abc' };
const approve = { rel: 'approve', href: 'https://sandbox.paypal.com/approve?token=def' };
const selfLink = { rel: 'self', href: 'https://sandbox.paypal.com/v2/checkout/orders/ORDER123' };

test('approvalUrl returns payer-action when it exists', () => {
  assert.equal(approvalUrl([selfLink, payerAction]), payerAction.href);
});

test('approvalUrl returns approve as fallback', () => {
  assert.equal(approvalUrl([selfLink, approve]), approve.href);
});

test('approvalUrl prefers payer-action when both exist', () => {
  assert.equal(approvalUrl([approve, payerAction]), payerAction.href);
});

test('approvalUrl ignores self and other non-approval rels', () => {
  assert.equal(approvalUrl([selfLink, { rel: 'capture', href: 'https://capture' }, { rel: 'authorize', href: 'https://authorize' }]), '');
});

test('approvalUrl ignores links without href', () => {
  assert.equal(approvalUrl([{ rel: 'approve' }]), '');
  assert.equal(approvalUrl([{ rel: 'payer-action' }]), '');
  assert.equal(approvalUrl([{ rel: 'approve' }, approve]), approve.href);
});

test('approvalUrl returns empty string without an allowed link', () => {
  assert.equal(approvalUrl([]), '');
  assert.equal(approvalUrl([{ rel: 'self' }]), '');
});

test('approvalUrl accepts https://www.sandbox.paypal.com', () => {
  const href = 'https://www.sandbox.paypal.com/checkoutnow?token=abc';
  assert.equal(approvalUrl([{ rel: 'payer-action', href }]), href);
});

test('approvalUrl accepts https://sandbox.paypal.com', () => {
  const href = 'https://sandbox.paypal.com/checkoutnow?token=abc';
  assert.equal(approvalUrl([{ rel: 'payer-action', href }]), href);
});

test('approvalUrl rejects http://www.sandbox.paypal.com', () => {
  assert.equal(approvalUrl([{ rel: 'payer-action', href: 'http://www.sandbox.paypal.com/checkoutnow' }]), '');
});

test('approvalUrl rejects non-sandbox PayPal domains', () => {
  assert.equal(approvalUrl([{ rel: 'payer-action', href: 'https://www.paypal.com/checkoutnow' }]), '');
  assert.equal(approvalUrl([{ rel: 'payer-action', href: 'https://paypal.com/checkoutnow' }]), '');
  assert.equal(approvalUrl([{ rel: 'payer-action', href: 'https://api-m.sandbox.paypal.com/v2/checkout/orders/x' }]), '');
});

test('approvalUrl rejects external domains', () => {
  assert.equal(approvalUrl([{ rel: 'payer-action', href: 'https://evil.example/checkoutnow' }]), '');
  assert.equal(approvalUrl([{ rel: 'payer-action', href: 'https://sandbox-paypal.com/checkoutnow' }]), '');
});

test('approvalUrl rejects deceptive subdomains', () => {
  assert.equal(approvalUrl([{ rel: 'payer-action', href: 'https://www.sandbox.paypal.com.evil.example/checkoutnow' }]), '');
  assert.equal(approvalUrl([{ rel: 'payer-action', href: 'https://sandbox.paypal.com.attacker.test/checkoutnow' }]), '');
});

test('approvalUrl rejects invalid URLs', () => {
  assert.equal(approvalUrl([{ rel: 'payer-action', href: 'not a url' }]), '');
  assert.equal(approvalUrl([{ rel: 'payer-action', href: 'https://' }]), '');
});

test('approvalUrl rejects URLs with embedded credentials', () => {
  assert.equal(approvalUrl([{ rel: 'payer-action', href: 'https://user:pass@www.sandbox.paypal.com/checkoutnow' }]), '');
  assert.equal(approvalUrl([{ rel: 'payer-action', href: 'https://attacker@www.sandbox.paypal.com/checkoutnow' }]), '');
});

test('approvalUrl uses approve when payer-action is invalid', () => {
  const outcome = approvalUrl([
    { rel: 'payer-action', href: 'https://evil.example/checkoutnow' },
    approve,
  ]);
  assert.equal(outcome, approve.href);
});

test('approvalUrl returns empty string when both links are invalid', () => {
  assert.equal(approvalUrl([
    { rel: 'payer-action', href: 'http://www.sandbox.paypal.com/checkoutnow' },
    { rel: 'approve', href: 'https://evil.example/approve' },
  ]), '');
});

const makeDeps = (overrides = {}) => ({
  prepared: {
    payment_id: 'p1',
    amount_minor: 300,
    currency: 'USD',
    custom_id: 'weaf_marketplace:p1',
    paypal_order_id: null,
    existing: false,
    idempotency_key: 'ik1',
  },
  createOrder: async () => ({ id: 'ORDER123', status: 'PAYER_ACTION_REQUIRED', links: [selfLink, payerAction] }),
  getOrder: async () => ({ id: 'ORDER123', status: 'PAYER_ACTION_REQUIRED', links: [selfLink, payerAction] }),
  attachOrder: async () => {},
  closeCreation: async () => true,
  ...overrides,
});

test('creation flow returns the payer-action URL', async () => {
  const outcome = await resolveMarketplacePayPalOrder(makeDeps());
  assert.ok(outcome.ok);
  assert.equal(outcome.url, payerAction.href);
  assert.equal(outcome.reused, false);
});

test('creation flow still works with an approve link', async () => {
  const outcome = await resolveMarketplacePayPalOrder(
    makeDeps({ createOrder: async () => ({ id: 'ORDER123', status: 'CREATED', links: [selfLink, approve] }) }),
  );
  assert.ok(outcome.ok);
  assert.equal(outcome.url, approve.href);
});

test('failure before an order id closes the prepared payment to failed', async () => {
  const closeCalls = [];
  const outcome = await resolveMarketplacePayPalOrder(
    makeDeps({
      createOrder: async () => ({}),
      closeCreation: async (paymentId, reason) => { closeCalls.push([paymentId, reason]); return true; },
    }),
  );
  assert.ok(!outcome.ok);
  assert.equal(outcome.code, 'paypal_approval_url_missing');
  assert.equal(outcome.status, 502);
  assert.deepEqual(closeCalls, [['p1', 'paypal_approval_url_missing']]);
  assert.equal(outcome.sanitized.order_id_present, false);
});

test('OAuth failure closes the prepared payment to failed', async () => {
  const closeCalls = [];
  const outcome = await resolveMarketplacePayPalOrder(
    makeDeps({
      createOrder: async () => { throw new PayPalError('paypal_oauth_failed', 502); },
      closeCreation: async (paymentId, reason) => { closeCalls.push([paymentId, reason]); return true; },
    }),
  );
  assert.ok(!outcome.ok);
  assert.equal(outcome.code, 'paypal_oauth_failed');
  assert.equal(outcome.status, 502);
  assert.deepEqual(closeCalls, [['p1', 'paypal_oauth_failed']]);
});

test('paypal_api_error before the order id closes the prepared payment', async () => {
  const closeCalls = [];
  const outcome = await resolveMarketplacePayPalOrder(
    makeDeps({
      createOrder: async () => { throw new PayPalError('paypal_api_error', 422); },
      closeCreation: async (paymentId, reason) => { closeCalls.push([paymentId, reason]); return true; },
    }),
  );
  assert.ok(!outcome.ok);
  assert.equal(outcome.code, 'paypal_api_error');
  assert.equal(outcome.status, 422);
  assert.deepEqual(closeCalls, [['p1', 'paypal_api_error']]);
});

test('if an order id exists and attach fails, the payment is not marked failed', async () => {
  const closeCalls = [];
  const outcome = await resolveMarketplacePayPalOrder(
    makeDeps({
      createOrder: async () => ({ id: 'ORDER123', links: [payerAction] }),
      attachOrder: async () => { throw new PayPalError('marketplace_order_reconciliation_failed', 500); },
      closeCreation: async (paymentId, reason) => { closeCalls.push([paymentId, reason]); return true; },
    }),
  );
  assert.ok(!outcome.ok);
  assert.equal(outcome.code, 'marketplace_order_reconciliation_failed');
  assert.equal(outcome.status, 500);
  assert.equal(closeCalls.length, 0);
});

test('if an order id exists but the URL is missing, the id stays attached and the payment is preserved', async () => {
  const attachCalls = [];
  const closeCalls = [];
  const outcome = await resolveMarketplacePayPalOrder(
    makeDeps({
      createOrder: async () => ({ id: 'ORDER123', status: 'PAYER_ACTION_REQUIRED', links: [selfLink] }),
      attachOrder: async (paymentId, orderId) => { attachCalls.push([paymentId, orderId]); },
      closeCreation: async (paymentId, reason) => { closeCalls.push([paymentId, reason]); return true; },
    }),
  );
  assert.deepEqual(attachCalls, [['p1', 'ORDER123']]);
  assert.equal(closeCalls.length, 0);
  assert.ok(!outcome.ok);
  assert.equal(outcome.code, 'paypal_approval_url_missing');
  assert.equal(outcome.status, 502);
  assert.equal(outcome.sanitized.order_id_present, true);
});

test('sanitized approval-missing details expose no ids, hrefs or secrets', async () => {
  const outcome = await resolveMarketplacePayPalOrder(
    makeDeps({ createOrder: async () => ({ id: 'ORDER123', status: 'PAYER_ACTION_REQUIRED', links: [selfLink, { rel: 'payer-action' }] }) }),
  );
  assert.ok(!outcome.ok);
  const sanitized = outcome.sanitized;
  assert.equal(sanitized.order_id_present, true);
  assert.equal(sanitized.status, 'PAYER_ACTION_REQUIRED');
  assert.deepEqual(sanitized.link_rels, ['self', 'payer-action']);
  assert.ok(!('id' in sanitized));
  assert.ok(!('href' in sanitized));
  assert.ok(sanitized.link_rels.every((rel) => typeof rel === 'string' && !rel.includes('http')));
});

test('closeCreation true keeps the original PayPal error', async () => {
  const outcome = await resolveMarketplacePayPalOrder(
    makeDeps({
      createOrder: async () => { throw new PayPalError('paypal_oauth_failed', 502); },
      closeCreation: async () => true,
    }),
  );
  assert.ok(!outcome.ok);
  assert.equal(outcome.code, 'paypal_oauth_failed');
  assert.equal(outcome.status, 502);
  assert.equal(outcome.sanitized, undefined);
});

test('closeCreation false returns marketplace_order_reconciliation_failed', async () => {
  const outcome = await resolveMarketplacePayPalOrder(
    makeDeps({
      createOrder: async () => { throw new PayPalError('paypal_network_error', 502); },
      closeCreation: async () => false,
    }),
  );
  assert.ok(!outcome.ok);
  assert.equal(outcome.code, 'marketplace_order_reconciliation_failed');
  assert.equal(outcome.status, 500);
});

test('closeCreation throwing returns marketplace_order_reconciliation_failed', async () => {
  const outcome = await resolveMarketplacePayPalOrder(
    makeDeps({
      createOrder: async () => { throw new PayPalError('paypal_approval_url_missing', 502); },
      closeCreation: async () => { throw new Error('rpc unavailable'); },
    }),
  );
  assert.ok(!outcome.ok);
  assert.equal(outcome.code, 'marketplace_order_reconciliation_failed');
  assert.equal(outcome.status, 500);
});

test('sanitized recovery failure keeps original_error_code', async () => {
  const outcome = await resolveMarketplacePayPalOrder(
    makeDeps({
      createOrder: async () => { throw new PayPalError('paypal_network_error', 502); },
      closeCreation: async () => false,
    }),
  );
  assert.deepEqual(outcome.sanitized, { original_error_code: 'paypal_network_error', recovery_failed: true, status: 500 });
});

test('sanitized recovery failure exposes no ids, urls or secrets', async () => {
  const outcome = await resolveMarketplacePayPalOrder(
    makeDeps({
      createOrder: async () => { throw new PayPalError('paypal_approval_url_missing', 502); },
      closeCreation: async () => false,
    }),
  );
  const sanitized = outcome.sanitized;
  assert.deepEqual(Object.keys(sanitized).sort(), ['original_error_code', 'recovery_failed', 'status']);
  for (const key of ['payment_id', 'user_id', 'idempotency_key', 'url', 'href', 'id', 'reason']) {
    assert.ok(!(key in sanitized), `sanitized must not expose ${key}`);
  }
  const dumped = JSON.stringify(sanitized);
  assert.ok(!dumped.includes('p1'));
  assert.ok(!dumped.includes('ik1'));
  assert.ok(!dumped.includes('http'));
});

test('when a remote order id exists, closeCreation is never called', async () => {
  const closeCalls = [];
  const okOutcome = await resolveMarketplacePayPalOrder(
    makeDeps({
      createOrder: async () => ({ id: 'ORDER123', links: [payerAction] }),
      closeCreation: async (paymentId, reason) => { closeCalls.push([paymentId, reason]); return true; },
    }),
  );
  assert.ok(okOutcome.ok);
  assert.equal(closeCalls.length, 0);
  const failOutcome = await resolveMarketplacePayPalOrder(
    makeDeps({
      createOrder: async () => ({ id: 'ORDER123', links: [payerAction] }),
      attachOrder: async () => { throw new PayPalError('marketplace_order_reconciliation_failed', 500); },
      closeCreation: async (paymentId, reason) => { closeCalls.push([paymentId, reason]); return true; },
    }),
  );
  assert.ok(!failOutcome.ok);
  assert.equal(failOutcome.code, 'marketplace_order_reconciliation_failed');
  assert.equal(closeCalls.length, 0);
});

test('prepared payment keeps the 300/USD server price', () => {
  assert.match(edge, /Number\(prepared\.amount_minor\) !== 300/);
  assert.match(edge, /prepared\.currency !== "USD"/);
  assert.doesNotMatch(edge, /body\.(amount|price|currency)/);
});

test('live mode stays rejected', () => {
  assert.match(edge, /PAYPAL_MODE"\) !== "sandbox"/);
  assert.doesNotMatch(edge, /api-m\.paypal\.com/);
  globalThis.Deno = {
    env: { get: (key) => ({ PAYPAL_MODE: 'live', PAYPAL_CLIENT_ID: 'c', PAYPAL_CLIENT_SECRET: 's', PAYPAL_API_BASE: 'https://api-m.sandbox.paypal.com', PAYPAL_WEBHOOK_ID: 'w' }[key] ?? '') },
  };
  let threw = null;
  try { getPayPalConfig(); } catch (error) { threw = error; }
  assert.ok(threw instanceof PayPalError);
  assert.equal(threw.code, 'paypal_live_disabled');
});

test('edge function wires the recovery RPC, the flow and sanitized logging', () => {
  assert.match(edge, /fail_marketplace_paypal_order_creation/);
  assert.match(edge, /resolveMarketplacePayPalOrder/);
  assert.match(edge, /create_marketplace_paypal_order_failed/);
  assert.match(paypalShared, /payer-action/);
  assert.match(paypalShared, /approve/);
  assert.match(paypalShared, /isSafePayPalApprovalUrl/);
  assert.match(paypalShared, /APPROVAL_HOSTS/);
  assert.match(flow, /remotePayPalOrderId/);
  assert.match(flow, /attachOrder/);
  assert.match(flow, /closeCreation/);
  assert.match(flow, /recovery_failed/);
  assert.match(flow, /original_error_code/);
  assert.match(flow, /marketplace_order_reconciliation_failed/);
  assert.match(edge, /if \(error\) throw new PayPalError/);
  assert.match(edge, /return closed === true/);
  assert.match(migration, /create or replace function public\.fail_marketplace_paypal_order_creation\(\s*p_payment_id uuid,\s*p_user_id uuid,\s*p_reason text\s*\)/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /revoke all on function public\.fail_marketplace_paypal_order_creation\(uuid, uuid, text\)\s+from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.fail_marketplace_paypal_order_creation\(uuid, uuid, text\)\s+to service_role/);
  assert.match(migration, /paypal_order_creation_failed/);
  assert.match(migration, /status = 'failed'/);
  assert.doesNotMatch(migration, /password|authorization/i);
});
