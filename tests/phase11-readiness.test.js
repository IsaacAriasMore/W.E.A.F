import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('CI validates pull requests and main without deploying or requiring secrets', () => {
  const workflow = read('.github/workflows/ci.yml');
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /push:[\s\S]*branches:[\s\S]*- main/);
  for (const command of ['npm ci', 'npm run check', 'npm run test:unit', 'npm run build']) {
    assert.match(workflow, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(workflow, /permissions:[\s\S]*contents: read/);
  assert.doesNotMatch(workflow, /secrets\.|vercel deploy|supabase db push|supabase functions deploy/i);
});

test('Stripe checkout is authenticated, owner-scoped and uses server-side plan prices', () => {
  const checkout = read('supabase/functions/create-server-listing-checkout/index.ts');
  assert.match(checkout, /withSupabase\(\{ auth: "user" \}/);
  assert.match(checkout, /ownedListing\.owner_user_id !== userId/);
  assert.match(checkout, /planType === "normal" \? normalPrice : plusPrice/);
  assert.match(checkout, /mode: "subscription"/);
  assert.match(checkout, /success_url: `\$\{publicSite\}\/servers\/success/);
  assert.match(checkout, /cancel_url: `\$\{publicSite\}\/servers\/cancel/);
  assert.match(checkout, /metadata = \{ user_id: userId, server_listing_id: serverListingId, plan_type: planType \}/);
  assert.doesNotMatch(checkout, /sk_(test|live)_/);
});

test('Stripe webhook verifies signatures and fails closed for cancellation and payment failure', () => {
  const webhook = read('supabase/functions/stripe-webhook/index.ts');
  const billing = read('supabase/migrations/20260722052913_stripe_listing_billing_flow.sql');
  const visibility = read('supabase/migrations/20260722162000_production_server_listing_fixes.sql');
  assert.match(webhook, /constructEventAsync\(rawBody, signature, webhookSecret\)/);
  assert.match(webhook, /invoice\.payment_failed/);
  assert.match(billing, /invoice\.payment_failed[\s\S]*status = 'paused'[\s\S]*payment_status = 'failed'[\s\S]*is_featured = false/i);
  assert.match(visibility, /customer\.subscription\.updated' and cancel_at_end[\s\S]*status = 'canceled'[\s\S]*is_featured = false/i);
});

test('Phase 11 documentation records manual gates and avoids external ads', () => {
  const productionQa = read('docs/phase-11-production-qa.md');
  const manual = read('docs/phase-11-manual-checklist.md');
  const cleanup = read('docs/phase-11-test-data-cleanup.md');
  assert.match(productionQa, /No activar Stripe live/);
  assert.match(productionQa, /No integrar AdSense ni publicidad externa/);
  assert.match(manual, /Stripe test/);
  assert.match(manual, /Lighthouse/);
  assert.match(cleanup, /No se borró, pausó ni modificó ninguna fila/);
});

test('Phase 10 closure remains explicit and does not overstate editorial coverage', () => {
  const closure = read('docs/phase-10-content-bosses-inis.md');
  assert.match(closure, /Fase 10 implementada y desplegada/);
  assert.match(closure, /contenido verificado inicial cubre The Island y 3 INIs editoriales/);
  assert.match(closure, /trabajo editorial progresivo/);
  assert.match(closure, /No se inventan cantidades/);
});
