-- Phase 7: marketplace gratuito, moderable y preparado para PayPal Orders Sandbox.
-- Rollback seguro: deshabilitar marketplace en marketplace_settings y retirar rutas.
-- No eliminar tablas de pagos/auditoría sin exportación y periodo de retención aprobado.

create table public.marketplace_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name_es text not null check (char_length(name_es) between 2 and 60),
  name_en text not null check (char_length(name_en) between 2 and 60),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.marketplace_settings (
  key text primary key check (key = 'featured_listing'),
  marketplace_enabled boolean not null default true,
  payments_enabled boolean not null default false,
  price_minor integer check (price_minor is null or price_minor > 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  environment text not null default 'sandbox' check (environment = 'sandbox'),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (payments_enabled = false or price_minor is not null)
);

create table public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete restrict,
  category_id uuid not null references public.marketplace_categories(id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  listing_type text not null check (listing_type in ('buy','sell','trade')),
  title text not null check (char_length(title) between 8 and 100),
  description text not null check (char_length(description) between 30 and 2000),
  game text not null check (game in ('evolved','ascended','both')),
  resource_name text not null check (char_length(resource_name) between 2 and 80),
  quantity integer check (quantity is null or quantity between 1 and 1000000000),
  trade_terms text not null check (char_length(trade_terms) between 5 and 500),
  server_name text check (server_name is null or char_length(server_name) <= 100),
  region text not null check (char_length(region) between 2 and 40),
  platform text not null check (platform in ('steam','epic','xbox','playstation','windows','crossplay','other')),
  language text not null check (char_length(language) between 2 and 30),
  discord_invite_url text not null check (discord_invite_url ~ '^https://(discord[.]gg|discord[.]com/invite)/[A-Za-z0-9_-]+/?$'),
  image_url text check (image_url is null or (image_url ~ '^https://[^[:space:]]+$' and char_length(image_url) <= 500)),
  status text not null default 'draft' check (status in ('draft','pending_payment','active','expired','hidden','rejected','removed','payment_failed','refunded','reversed')),
  is_featured boolean not null default false,
  rules_accepted_at timestamptz not null,
  published_at timestamptz,
  expires_at timestamptz,
  moderated_at timestamptz,
  moderation_reason text check (moderation_reason is null or char_length(moderation_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status <> 'active') or (published_at is not null and expires_at = published_at + interval '7 days')),
  check ((is_featured = false) or status in ('pending_payment','active','expired','hidden','refunded','reversed'))
);

create table public.marketplace_payments (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  provider text not null default 'paypal' check (provider = 'paypal'),
  environment text not null default 'sandbox' check (environment = 'sandbox'),
  status text not null default 'created' check (status in ('created','approved','captured','failed','refunded','reversed')),
  amount_minor integer not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  paypal_order_id text unique,
  paypal_capture_id text unique,
  idempotency_key uuid not null unique,
  external_event_id text,
  paid_at timestamptz,
  raw_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_summary) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.marketplace_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete restrict,
  reporter_user_id uuid not null references public.profiles(id) on delete restrict,
  reason text not null check (reason in ('fraud','prohibited','malicious_link','personal_data','spam','other')),
  details text not null check (char_length(details) between 10 and 1000),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, reporter_user_id)
);

create table public.marketplace_audit_log (
  id bigint generated always as identity primary key,
  listing_id uuid references public.marketplace_listings(id) on delete restrict,
  payment_id uuid references public.marketplace_payments(id) on delete restrict,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null check (char_length(action) between 3 and 80),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

create unique index marketplace_payments_external_event_unique
on public.marketplace_payments(external_event_id) where external_event_id is not null;
create index marketplace_active_order_idx on public.marketplace_listings(is_featured desc, published_at desc)
where status = 'active';
create index marketplace_owner_idx on public.marketplace_listings(owner_user_id, created_at desc);
create index marketplace_expiration_idx on public.marketplace_listings(expires_at)
where status = 'active';
create index marketplace_reports_status_idx on public.marketplace_reports(status, created_at desc);

create trigger set_marketplace_categories_updated_at before update on public.marketplace_categories
for each row execute function private.set_updated_at();
create trigger set_marketplace_settings_updated_at before update on public.marketplace_settings
for each row execute function private.set_updated_at();
create trigger set_marketplace_listings_updated_at before update on public.marketplace_listings
for each row execute function private.set_updated_at();
create trigger set_marketplace_payments_updated_at before update on public.marketplace_payments
for each row execute function private.set_updated_at();
create trigger set_marketplace_reports_updated_at before update on public.marketplace_reports
for each row execute function private.set_updated_at();

insert into public.marketplace_categories (slug,name_es,name_en,sort_order) values
('resources','Recursos','Resources',10),
('creatures','Criaturas','Creatures',20),
('equipment','Equipamiento','Equipment',30),
('blueprints','Planos','Blueprints',40),
('services','Servicios permitidos','Allowed services',50),
('other','Otros','Other',60);

insert into public.marketplace_settings (key) values ('featured_listing');

alter table public.marketplace_categories enable row level security;
alter table public.marketplace_settings enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.marketplace_payments enable row level security;
alter table public.marketplace_reports enable row level security;
alter table public.marketplace_audit_log enable row level security;

create policy marketplace_categories_public_read on public.marketplace_categories
for select to anon,authenticated using (is_active or private.is_global_admin());
create policy marketplace_settings_admin_read on public.marketplace_settings
for select to authenticated using (private.is_global_admin());
create policy marketplace_listings_owner_admin_read on public.marketplace_listings
for select to authenticated using (owner_user_id = (select auth.uid()) or private.is_global_admin());
create policy marketplace_payments_owner_admin_read on public.marketplace_payments
for select to authenticated using (user_id = (select auth.uid()) or private.is_global_admin());
create policy marketplace_reports_owner_admin_read on public.marketplace_reports
for select to authenticated using (reporter_user_id = (select auth.uid()) or private.is_global_admin());
create policy marketplace_audit_admin_read on public.marketplace_audit_log
for select to authenticated using (private.is_global_admin());

create or replace function private.marketplace_slug(p_title text, p_id uuid)
returns text language sql immutable set search_path = '' as $$
  select trim(both '-' from left(regexp_replace(lower(p_title), '[^a-z0-9]+', '-', 'g'), 72)) || '-' || left(replace(p_id::text, '-', ''), 10)
$$;

create or replace function private.validate_marketplace_payload(p_payload jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare clean jsonb;
begin
  if jsonb_typeof(p_payload) <> 'object' then raise exception 'invalid_marketplace_payload'; end if;
  clean := jsonb_build_object(
    'category_id',nullif(p_payload->>'category_id','')::uuid,
    'listing_type',p_payload->>'listing_type',
    'title',trim(p_payload->>'title'),
    'description',trim(p_payload->>'description'),
    'game',p_payload->>'game',
    'resource_name',trim(p_payload->>'resource_name'),
    'quantity',nullif(p_payload->>'quantity','')::integer,
    'trade_terms',trim(p_payload->>'trade_terms'),
    'server_name',nullif(trim(p_payload->>'server_name'),''),
    'region',trim(p_payload->>'region'),
    'platform',p_payload->>'platform',
    'language',trim(p_payload->>'language'),
    'discord_invite_url',trim(p_payload->>'discord_invite_url'),
    'image_url',nullif(trim(p_payload->>'image_url'),'')
  );
  if coalesce(clean->>'title','') ~* '<[a-z!/]' or coalesce(clean->>'description','') ~* '<[a-z!/]' or coalesce(clean->>'trade_terms','') ~* '<[a-z!/]' then
    raise exception 'html_not_allowed';
  end if;
  if coalesce(clean->>'description','') ~* '(password|contraseña|token|secret|cookie|cuenta robada|stolen account|cheat|exploit)' then
    raise exception 'prohibited_marketplace_content';
  end if;
  return clean;
exception when invalid_text_representation then
  raise exception 'invalid_marketplace_payload';
end;
$$;

create or replace function public.get_marketplace_catalog(p_slug text default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'categories',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'slug',c.slug,'name_es',c.name_es,'name_en',c.name_en) order by c.sort_order) from public.marketplace_categories c where c.is_active),'[]'::jsonb),
    'listings',coalesce((select jsonb_agg(jsonb_build_object(
      'id',l.id,'category_id',l.category_id,'slug',l.slug,'listing_type',l.listing_type,'title',l.title,
      'description',l.description,'game',l.game,'resource_name',l.resource_name,'quantity',l.quantity,
      'trade_terms',l.trade_terms,'server_name',l.server_name,'region',l.region,'platform',l.platform,
      'language',l.language,'discord_invite_url',l.discord_invite_url,'image_url',l.image_url,
      'is_featured',l.is_featured,'published_at',l.published_at,'expires_at',l.expires_at
    ) order by l.is_featured desc,l.published_at desc)
      from public.marketplace_listings l
      where l.status='active' and l.expires_at>now() and (p_slug is null or l.slug=p_slug)),'[]'::jsonb)
  );
$$;

create or replace function public.get_marketplace_checkout_settings()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'marketplace_enabled',s.marketplace_enabled,
    'featured_enabled',s.payments_enabled and s.price_minor is not null and s.environment='sandbox',
    'price_minor',s.price_minor,
    'currency',s.currency,
    'environment',s.environment
  ) from public.marketplace_settings s where s.key='featured_listing'
$$;

create or replace function public.create_free_marketplace_listing(p_payload jsonb, p_accept_rules boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare clean jsonb; new_id uuid := gen_random_uuid(); active_count integer;
begin
  if (select auth.uid()) is null then raise exception 'authentication_required'; end if;
  if not coalesce(p_accept_rules,false) then raise exception 'marketplace_rules_required'; end if;
  if not coalesce((select marketplace_enabled from public.marketplace_settings where key='featured_listing'),false) then raise exception 'marketplace_disabled'; end if;
  select count(*) into active_count from public.marketplace_listings
  where owner_user_id=(select auth.uid()) and status in ('active','draft','pending_payment') and (expires_at is null or expires_at>now());
  if active_count>=5 then raise exception 'marketplace_active_limit'; end if;
  if (select count(*) from public.marketplace_listings where owner_user_id=(select auth.uid()) and created_at>now()-interval '24 hours')>=5 then
    raise exception 'marketplace_rate_limit';
  end if;
  clean := private.validate_marketplace_payload(p_payload);
  insert into public.marketplace_listings (
    id,owner_user_id,category_id,slug,listing_type,title,description,game,resource_name,quantity,
    trade_terms,server_name,region,platform,language,discord_invite_url,image_url,status,is_featured,
    rules_accepted_at,published_at,expires_at
  ) values (
    new_id,(select auth.uid()),(clean->>'category_id')::uuid,private.marketplace_slug(clean->>'title',new_id),
    clean->>'listing_type',clean->>'title',clean->>'description',clean->>'game',clean->>'resource_name',(clean->>'quantity')::integer,
    clean->>'trade_terms',clean->>'server_name',clean->>'region',clean->>'platform',clean->>'language',
    clean->>'discord_invite_url',clean->>'image_url','active',false,now(),now(),now()+interval '7 days'
  );
  insert into public.marketplace_audit_log(listing_id,actor_user_id,action,details)
  values(new_id,(select auth.uid()),'free_listing_published',jsonb_build_object('duration_days',7));
  return new_id;
end;
$$;

create or replace function public.update_my_marketplace_listing(p_listing_id uuid,p_payload jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare clean jsonb;
begin
  if not exists(select 1 from public.marketplace_listings where id=p_listing_id and owner_user_id=(select auth.uid())) then raise exception 'listing_not_owned'; end if;
  if exists(select 1 from public.marketplace_listings where id=p_listing_id and (status not in ('active','draft') or (expires_at is not null and expires_at<=now()))) then raise exception 'listing_not_editable'; end if;
  clean := private.validate_marketplace_payload(p_payload);
  update public.marketplace_listings set
    category_id=(clean->>'category_id')::uuid,listing_type=clean->>'listing_type',title=clean->>'title',
    description=clean->>'description',game=clean->>'game',resource_name=clean->>'resource_name',quantity=(clean->>'quantity')::integer,
    trade_terms=clean->>'trade_terms',server_name=clean->>'server_name',region=clean->>'region',platform=clean->>'platform',
    language=clean->>'language',discord_invite_url=clean->>'discord_invite_url',image_url=clean->>'image_url'
  where id=p_listing_id;
  insert into public.marketplace_audit_log(listing_id,actor_user_id,action) values(p_listing_id,(select auth.uid()),'listing_updated');
end;
$$;

create or replace function public.hide_my_marketplace_listing(p_listing_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.marketplace_listings set status='hidden',is_featured=false
  where id=p_listing_id and owner_user_id=(select auth.uid()) and status in ('active','draft','pending_payment');
  if not found then raise exception 'listing_not_owned_or_hidden'; end if;
  insert into public.marketplace_audit_log(listing_id,actor_user_id,action) values(p_listing_id,(select auth.uid()),'listing_hidden');
end;
$$;

create or replace function public.get_my_marketplace_workspace()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'listings',coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at desc) from public.marketplace_listings l where l.owner_user_id=(select auth.uid())),'[]'::jsonb),
    'payments',coalesce((select jsonb_agg(to_jsonb(p) - 'raw_summary' order by p.created_at desc) from public.marketplace_payments p where p.user_id=(select auth.uid())),'[]'::jsonb)
  ) where (select auth.uid()) is not null
$$;

create or replace function public.report_marketplace_listing(p_listing_id uuid,p_reason text,p_details text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare report_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'authentication_required'; end if;
  if not exists(select 1 from public.marketplace_listings where id=p_listing_id and status='active' and expires_at>now()) then raise exception 'listing_not_available'; end if;
  insert into public.marketplace_reports(listing_id,reporter_user_id,reason,details)
  values(p_listing_id,(select auth.uid()),p_reason,trim(p_details)) returning id into report_id;
  return report_id;
end;
$$;

create or replace function public.expire_marketplace_listings()
returns integer language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
  if (select auth.uid()) is not null and (select auth.role()) <> 'service_role' and not private.is_global_admin() then raise exception 'service_role_or_admin_required'; end if;
  update public.marketplace_listings set status='expired',is_featured=false
  where status='active' and expires_at<=now();
  get diagnostics affected = row_count;
  insert into public.marketplace_audit_log(action,details) values('expiration_job',jsonb_build_object('expired',affected));
  return affected;
end;
$$;

create or replace function public.get_admin_marketplace_workspace()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_global_admin() then raise exception 'global_admin_required'; end if;
  return jsonb_build_object(
    'listings',coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at desc) from public.marketplace_listings l),'[]'::jsonb),
    'reports',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.marketplace_reports r),'[]'::jsonb),
    'payments',coalesce((select jsonb_agg(to_jsonb(p)-'raw_summary' order by p.created_at desc) from public.marketplace_payments p),'[]'::jsonb),
    'setting',(select to_jsonb(s) from public.marketplace_settings s where s.key='featured_listing'),
    'audit',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from (select * from public.marketplace_audit_log order by created_at desc limit 100) a),'[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_set_marketplace_setting(p_marketplace_enabled boolean,p_payments_enabled boolean,p_price_minor integer,p_currency text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_global_admin() then raise exception 'global_admin_required'; end if;
  if p_payments_enabled and (p_price_minor is null or p_price_minor<=0) then raise exception 'marketplace_price_required'; end if;
  update public.marketplace_settings set marketplace_enabled=p_marketplace_enabled,payments_enabled=p_payments_enabled,
    price_minor=p_price_minor,currency=upper(p_currency),environment='sandbox',updated_by=(select auth.uid()) where key='featured_listing';
  insert into public.marketplace_audit_log(actor_user_id,action,details)
  values((select auth.uid()),'settings_updated',jsonb_build_object('marketplace_enabled',p_marketplace_enabled,'payments_enabled',p_payments_enabled,'price_minor',p_price_minor,'currency',upper(p_currency)));
end;
$$;

create or replace function public.admin_moderate_marketplace_listing(p_listing_id uuid,p_status text,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_global_admin() then raise exception 'global_admin_required'; end if;
  if p_status not in ('active','hidden','rejected','removed') then raise exception 'invalid_moderation_status'; end if;
  if p_status='active' and exists(select 1 from public.marketplace_listings where id=p_listing_id and expires_at<=now()) then raise exception 'expired_listing_cannot_activate'; end if;
  update public.marketplace_listings set status=p_status,is_featured=case when p_status='active' then is_featured else false end,
    moderated_at=now(),moderation_reason=nullif(trim(p_reason),'') where id=p_listing_id;
  if not found then raise exception 'listing_not_available'; end if;
  insert into public.marketplace_audit_log(listing_id,actor_user_id,action,details)
  values(p_listing_id,(select auth.uid()),'listing_moderated',jsonb_build_object('status',p_status,'reason',nullif(trim(p_reason),'')));
end;
$$;

do $$ begin
  if exists(select 1 from cron.job where jobname='expire-marketplace-listings') then perform cron.unschedule('expire-marketplace-listings'); end if;
  perform cron.schedule('expire-marketplace-listings','*/15 * * * *','select public.expire_marketplace_listings();');
end $$;

revoke all on public.marketplace_categories,public.marketplace_settings,public.marketplace_listings,public.marketplace_payments,public.marketplace_reports,public.marketplace_audit_log from public,anon,authenticated;
grant select on public.marketplace_categories to anon,authenticated;
grant select on public.marketplace_listings,public.marketplace_payments,public.marketplace_reports to authenticated;

revoke all on function private.marketplace_slug(text,uuid),private.validate_marketplace_payload(jsonb) from public,anon,authenticated;
revoke all on function public.get_marketplace_catalog(text),public.get_marketplace_checkout_settings(),public.create_free_marketplace_listing(jsonb,boolean),public.update_my_marketplace_listing(uuid,jsonb),public.hide_my_marketplace_listing(uuid),public.get_my_marketplace_workspace(),public.report_marketplace_listing(uuid,text,text),public.expire_marketplace_listings(),public.get_admin_marketplace_workspace(),public.admin_set_marketplace_setting(boolean,boolean,integer,text),public.admin_moderate_marketplace_listing(uuid,text,text) from public,anon,authenticated;
grant execute on function public.get_marketplace_catalog(text),public.get_marketplace_checkout_settings() to anon,authenticated;
grant execute on function public.create_free_marketplace_listing(jsonb,boolean),public.update_my_marketplace_listing(uuid,jsonb),public.hide_my_marketplace_listing(uuid),public.get_my_marketplace_workspace(),public.report_marketplace_listing(uuid,text,text) to authenticated;
grant execute on function public.get_admin_marketplace_workspace(),public.admin_set_marketplace_setting(boolean,boolean,integer,text),public.admin_moderate_marketplace_listing(uuid,text,text) to authenticated;
grant execute on function public.expire_marketplace_listings() to authenticated,service_role;
