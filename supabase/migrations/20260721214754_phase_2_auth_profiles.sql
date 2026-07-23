alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text;
  requested_game public.game_mode;
begin
  requested_name := left(
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), 'Survivor'),
    60
  );
  if char_length(requested_name) < 2 then requested_name := 'Survivor'; end if;

  requested_game := case new.raw_user_meta_data ->> 'default_game_mode'
    when 'evolved' then 'evolved'::public.game_mode
    when 'ascended' then 'ascended'::public.game_mode
    else 'both'::public.game_mode
  end;

  insert into public.profiles (id, email, display_name, default_game_mode)
  values (new.id, new.email, requested_name, requested_game)
  on conflict (id) do nothing;

  if new.raw_user_meta_data ->> 'terms_version' = '2026-07-draft'
    and new.raw_user_meta_data ->> 'privacy_version' = '2026-07-draft' then
    insert into public.legal_acceptances (user_id, terms_version, privacy_version, accepted_at)
    values (new.id, '2026-07-draft', '2026-07-draft', coalesce(new.created_at, now()))
    on conflict (user_id, terms_version, privacy_version) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

insert into public.profiles (id, email, display_name, default_game_mode)
select
  user_record.id,
  user_record.email,
  case
    when char_length(left(coalesce(nullif(trim(user_record.raw_user_meta_data ->> 'display_name'), ''), split_part(user_record.email, '@', 1), 'Survivor'), 60)) >= 2
      then left(coalesce(nullif(trim(user_record.raw_user_meta_data ->> 'display_name'), ''), split_part(user_record.email, '@', 1), 'Survivor'), 60)
    else 'Survivor'
  end,
  case user_record.raw_user_meta_data ->> 'default_game_mode'
    when 'evolved' then 'evolved'::public.game_mode
    when 'ascended' then 'ascended'::public.game_mode
    else 'both'::public.game_mode
  end
from auth.users as user_record
where user_record.email is not null
on conflict (id) do nothing;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

revoke insert, update on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, avatar_url, discord_username, default_game_mode, onboarding_completed)
  on public.profiles to authenticated;

create policy profiles_update_own
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);
