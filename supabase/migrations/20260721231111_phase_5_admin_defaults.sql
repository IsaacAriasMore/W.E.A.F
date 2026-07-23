-- Safe disabled defaults make every Phase 5 governance control visible without
-- activating future monetization or marketplace phases.

insert into public.feature_flags (key, description, enabled, configuration)
values
  ('discord_notifications', 'Avisos de breeding por Discord', true, '{}'::jsonb),
  ('server_marketplace', 'Publicación comercial de servidores, prevista para Fase 6', false, '{}'::jsonb),
  ('stripe_payments', 'Checkout y webhooks Stripe, previstos para Fase 7', false, '{}'::jsonb),
  ('community_ads', 'Placements publicitarios globales', false, '{}'::jsonb)
on conflict (key) do nothing;

insert into public.ads_settings (placement, enabled, provider, configuration)
values
  ('home_hero_secondary', false, 'internal', '{}'::jsonb),
  ('inis_sidebar', false, 'internal', '{}'::jsonb),
  ('bosses_footer', false, 'internal', '{}'::jsonb),
  ('dashboard_carousel', false, 'internal', '{}'::jsonb),
  ('servers_featured', false, 'internal', '{}'::jsonb)
on conflict (placement) do nothing;

insert into public.plans (code, name, price_usd_cents, duration_months, features, is_active)
values
  ('normal', 'Normal', 0, 1, '["Listado estándar"]'::jsonb, true),
  ('plus', 'Plus', 0, 1, '["Mayor visibilidad", "Métricas del listing"]'::jsonb, false),
  ('manual', 'Manual', 0, null, '["Alta asistida por administrador"]'::jsonb, false)
on conflict (code) do nothing;
