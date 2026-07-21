-- W.E.A.F reference schema for a fresh Supabase project.
-- Phase 0 artifact. Apply first to a development branch, then generate a migration.

create extension if not exists pgcrypto;
create schema if not exists private;

create type public.game_mode as enum ('evolved', 'ascended', 'both');
create type public.global_role as enum ('user', 'admin');
create type public.tribe_role as enum ('owner', 'admin', 'member');
create type public.membership_status as enum ('active', 'pending', 'removed');
create type public.breed_status as enum ('active', 'paused', 'completed');
create type public.invite_status as enum ('pending', 'accepted', 'expired', 'revoked');
create type public.listing_plan as enum ('normal', 'plus', 'manual');
create type public.listing_status as enum ('pending_payment', 'active', 'expired', 'canceled', 'paused', 'rejected');
create type public.server_type as enum ('pvp', 'pve', 'pvpve');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded', 'canceled');
create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null check (char_length(display_name) between 2 and 60),
  avatar_url text,
  discord_username text,
  global_role public.global_role not null default 'user',
  default_game_mode public.game_mode not null default 'both',
  is_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_email_lower_idx on public.profiles (lower(email));

create table public.tribes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  game_mode public.game_mode not null default 'both',
  uses_propagators boolean not null default false,
  propagator_cooldown_hours numeric(8,2),
  breeding_speed_multiplier numeric(10,3),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tribes_breeding_settings_check check (
    (uses_propagators and propagator_cooldown_hours > 0 and breeding_speed_multiplier is null)
    or
    (not uses_propagators and breeding_speed_multiplier > 0 and propagator_cooldown_hours is null)
  )
);

create index tribes_owner_idx on public.tribes(owner_user_id);

create table public.tribe_members (
  id uuid primary key default gen_random_uuid(),
  tribe_id uuid not null references public.tribes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.tribe_role not null default 'member',
  character_name text,
  steam_id text,
  notes text check (char_length(notes) <= 1000),
  status public.membership_status not null default 'pending',
  joined_at timestamptz,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tribe_id, user_id)
);

create index tribe_members_user_active_idx on public.tribe_members(user_id, status);
create index tribe_members_tribe_role_idx on public.tribe_members(tribe_id, role, status);

create table public.tribe_invites (
  id uuid primary key default gen_random_uuid(),
  tribe_id uuid not null references public.tribes(id) on delete cascade,
  invited_email text,
  invited_user_id uuid references auth.users(id) on delete cascade,
  invited_steam_id text,
  token_hash text not null unique,
  role public.tribe_role not null default 'member' check (role <> 'owner'),
  status public.invite_status not null default 'pending',
  expires_at timestamptz not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint tribe_invites_target_check check (
    num_nonnulls(invited_email, invited_user_id, invited_steam_id) >= 1
  )
);

create index tribe_invites_tribe_status_idx on public.tribe_invites(tribe_id, status, expires_at);

create table private.tribe_discord_webhooks (
  id uuid primary key default gen_random_uuid(),
  tribe_id uuid not null unique references public.tribes(id) on delete cascade,
  webhook_url_ciphertext text not null,
  webhook_last4 text not null check (char_length(webhook_last4) = 4),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz,
  last_error text
);

create table public.species (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  game_availability public.game_mode not null,
  image_url text,
  category text not null,
  vanilla_mating_cooldown_hours numeric(10,3) check (vanilla_mating_cooldown_hours > 0),
  stats jsonb not null default '[]'::jsonb check (jsonb_typeof(stats) = 'array'),
  notes text,
  is_public boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index species_public_sort_idx on public.species(is_public, is_active, sort_order);
create index species_game_idx on public.species(game_availability);

create table public.breeds (
  id uuid primary key default gen_random_uuid(),
  tribe_id uuid not null references public.tribes(id) on delete cascade,
  species_id uuid not null references public.species(id) on delete restrict,
  title text not null check (char_length(title) between 2 and 120),
  status public.breed_status not null default 'active',
  target_stats jsonb not null default '{}'::jsonb check (jsonb_typeof(target_stats) = 'object'),
  current_mutations jsonb not null default '{}'::jsonb check (jsonb_typeof(current_mutations) = 'object'),
  notes text check (char_length(notes) <= 5000),
  image_url text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index breeds_tribe_status_idx on public.breeds(tribe_id, status, updated_at desc);

create table public.mutations (
  id uuid primary key default gen_random_uuid(),
  tribe_id uuid not null references public.tribes(id) on delete cascade,
  breed_id uuid not null references public.breeds(id) on delete cascade,
  species_id uuid not null references public.species(id) on delete restrict,
  stats jsonb not null default '{}'::jsonb check (jsonb_typeof(stats) = 'object'),
  notes text check (char_length(notes) <= 2000),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index mutations_tribe_created_idx on public.mutations(tribe_id, created_at desc);
create index mutations_breed_created_idx on public.mutations(breed_id, created_at desc);

create table public.propagator_alerts (
  id uuid primary key default gen_random_uuid(),
  tribe_id uuid not null references public.tribes(id) on delete cascade,
  breed_id uuid not null references public.breeds(id) on delete cascade,
  available_at timestamptz not null,
  sent_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'sent', 'failed', 'canceled')),
  created_at timestamptz not null default now()
);

create index propagator_alerts_due_idx on public.propagator_alerts(status, available_at);

create table public.ini_presets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  category text not null check (category in ('farming', 'pvp', 'hard', 'fps', 'visibility', 'clean', 'general')),
  description text not null,
  content text not null,
  image_url text,
  game_availability public.game_mode not null default 'both',
  is_public boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  copy_count bigint not null default 0 check (copy_count >= 0),
  download_count bigint not null default 0 check (download_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ini_presets_public_category_idx on public.ini_presets(is_public, category);

create table public.maps (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  game_availability public.game_mode not null default 'both',
  image_url text,
  description text,
  is_public boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bosses (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.maps(id) on delete cascade,
  name text not null,
  slug text not null unique,
  image_url text,
  notes text,
  is_public boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bosses_map_sort_idx on public.bosses(map_id, sort_order);

create table public.boss_requirements (
  id uuid primary key default gen_random_uuid(),
  boss_id uuid not null references public.bosses(id) on delete cascade,
  difficulty text not null check (difficulty in ('gamma', 'beta', 'alpha')),
  item_name text not null,
  quantity integer not null check (quantity > 0),
  notes text,
  sort_order integer not null default 0,
  unique (boss_id, difficulty, item_name)
);

create table public.server_listings (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete set null,
  created_by_admin uuid references auth.users(id) on delete set null,
  plan public.listing_plan not null,
  status public.listing_status not null default 'pending_payment',
  title text not null,
  slug text not null unique,
  game public.game_mode not null,
  server_type public.server_type not null,
  platforms text[] not null default '{}',
  has_mods boolean not null default false,
  mods text[] not null default '{}',
  maps text[] not null default '{}',
  rates jsonb not null default '{}'::jsonb check (jsonb_typeof(rates) = 'object'),
  region text not null,
  language text not null,
  description text not null,
  discord_invite_url text not null check (discord_invite_url ~ '^https://(discord\.gg|discord\.com/invite)/'),
  website_url text,
  banner_url text,
  gallery_urls text[] not null default '{}',
  is_featured boolean not null default false,
  is_verified boolean not null default false,
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint server_listing_creator_check check (num_nonnulls(owner_user_id, created_by_admin) >= 1),
  constraint server_listing_window_check check (expires_at is null or starts_at is null or expires_at > starts_at)
);

create index server_listings_public_idx on public.server_listings(status, is_featured desc, starts_at desc, expires_at);
create index server_listings_owner_idx on public.server_listings(owner_user_id, status);

create table public.server_listing_clicks (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.server_listings(id) on delete cascade,
  clicked_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  ip_hash text,
  referrer text
);

create index server_listing_clicks_listing_idx on public.server_listing_clicks(listing_id, clicked_at desc);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  price_usd_cents integer not null check (price_usd_cents >= 0),
  duration_months integer check (duration_months > 0),
  stripe_price_id text,
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  listing_id uuid references public.server_listings(id) on delete set null,
  plan_id uuid not null references public.plans(id) on delete restrict,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  amount_usd_cents integer not null check (amount_usd_cents >= 0),
  status public.payment_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payments_user_created_idx on public.payments(user_id, created_at desc);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  listing_id uuid references public.server_listings(id) on delete cascade,
  stripe_subscription_id text unique,
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.stripe_events (
  id text primary key,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create table public.ads_settings (
  id uuid primary key default gen_random_uuid(),
  placement text not null unique check (placement in ('home_hero_secondary', 'inis_sidebar', 'bosses_footer', 'dashboard_carousel', 'servers_featured')),
  enabled boolean not null default false,
  provider text not null default 'internal' check (provider in ('internal', 'external')),
  configuration jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  document_type text not null,
  version text not null,
  title text not null,
  content text not null,
  published_at timestamptz,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_type, version)
);

create table public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  accepted_at timestamptz not null default now(),
  ip_hash text,
  user_agent text,
  unique (user_id, terms_version, privacy_version)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  reason text not null,
  details text,
  status public.report_status not null default 'open',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index reports_status_created_idx on public.reports(status, created_at);

create table public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text,
  enabled boolean not null default false,
  configuration jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  tribe_id uuid references public.tribes(id) on delete set null,
  event_name text not null,
  properties jsonb not null default '{}'::jsonb,
  session_hash text,
  created_at timestamptz not null default now()
);

create index analytics_events_name_created_idx on public.analytics_events(event_name, created_at desc);

create table private.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  tribe_id uuid references public.tribes(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index audit_logs_actor_created_idx on private.audit_logs(actor_user_id, created_at desc);
create index audit_logs_tribe_created_idx on private.audit_logs(tribe_id, created_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'tribes', 'tribe_members', 'species', 'breeds', 'ini_presets',
    'maps', 'bosses', 'server_listings', 'plans', 'payments', 'subscriptions',
    'legal_documents'
  ]
  loop
    execute format(
      'create trigger set_%1$s_updated_at before update on public.%1$I for each row execute function private.set_updated_at()',
      table_name
    );
  end loop;
end;
$$;

create trigger set_discord_webhooks_updated_at
before update on private.tribe_discord_webhooks
for each row execute function private.set_updated_at();

revoke all on schema private from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
