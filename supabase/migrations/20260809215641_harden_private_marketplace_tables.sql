-- Defense in depth for server-only Marketplace state. These tables have no
-- client CRUD grants and are accessed only through tightly scoped SECURITY
-- DEFINER functions. Enabling RLS without policies preserves that model while
-- protecting against a future accidental grant or API exposure change.
--
-- Do not FORCE RLS: the owner-backed SECURITY DEFINER functions below remain
-- the deliberate privileged boundary. Do not revoke private schema USAGE in
-- this migration: its compatibility has not been expanded beyond the existing
-- no-table-grant design.

alter table private.marketplace_ranking_secrets enable row level security;
alter table private.marketplace_payment_qa_settings enable row level security;
alter table private.marketplace_payment_qa_allowlist enable row level security;

-- Keep all direct client CRUD unavailable even if default grants change later.
revoke all on table
  private.marketplace_ranking_secrets,
  private.marketplace_payment_qa_settings,
  private.marketplace_payment_qa_allowlist
from public, anon, authenticated;
