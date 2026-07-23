-- Consolidate the initial owner-read policies into the Phase 7 owner/admin rules.
drop policy if exists payments_read_own on public.payments;
drop policy if exists subscriptions_read_own on public.subscriptions;
