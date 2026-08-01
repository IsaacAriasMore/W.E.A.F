begin;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'marketplace_favorites',
    'marketplace_user_blocks',
    'marketplace_notifications',
    'frontend_error_events'
  ] loop
    if not exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=table_name and c.relrowsecurity
    ) then raise exception 'RLS missing for %', table_name; end if;
  end loop;

  if has_function_privilege('anon', 'public.set_marketplace_favorite(uuid,boolean)', 'EXECUTE') then
    raise exception 'anon may execute favorite mutation';
  end if;
  if has_function_privilege('authenticated', 'public.set_marketplace_user_block(uuid,boolean)', 'EXECUTE') then
    raise exception 'unsafe UUID block RPC is exposed';
  end if;
  if not has_function_privilege('authenticated', 'public.block_marketplace_seller(text)', 'EXECUTE') then
    raise exception 'safe seller block RPC is unavailable';
  end if;
  if has_table_privilege('anon', 'public.frontend_error_events', 'SELECT') then
    raise exception 'frontend errors are exposed to anon';
  end if;
end;
$$;

rollback;
