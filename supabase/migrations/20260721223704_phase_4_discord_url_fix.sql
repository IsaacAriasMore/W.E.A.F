create or replace function public.configure_tribe_discord_webhook(
  p_tribe_id uuid,
  p_webhook_url text,
  p_enabled boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog', 'vault'
as $$
declare
  actor_id uuid := (select auth.uid());
  clean_url text := trim(coalesce(p_webhook_url, ''));
  secret_id uuid;
  last_four text;
begin
  if actor_id is null or not private.is_tribe_owner(p_tribe_id) then
    raise exception 'owner_required';
  end if;
  if clean_url !~ '^https://(canary[.]|ptb[.])?discord[.]com/api/webhooks/[0-9]{5,30}/[A-Za-z0-9_-]{20,200}$' then
    raise exception 'invalid_discord_webhook';
  end if;
  last_four := right(clean_url, 4);

  select vault_secret_id into secret_id
  from private.tribe_discord_webhooks
  where tribe_id = p_tribe_id
  for update;

  if secret_id is null then
    secret_id := vault.create_secret(
      clean_url,
      'weaf_discord_' || replace(p_tribe_id::text, '-', ''),
      'W.E.A.F tribe Discord webhook',
      null
    );
    insert into private.tribe_discord_webhooks(
      tribe_id, webhook_url_ciphertext, webhook_last4, enabled, vault_secret_id
    ) values (p_tribe_id, null, last_four, p_enabled, secret_id)
    on conflict (tribe_id) do update
      set webhook_url_ciphertext = null, webhook_last4 = excluded.webhook_last4,
          enabled = excluded.enabled, vault_secret_id = excluded.vault_secret_id,
          last_error = null;
  else
    perform vault.update_secret(
      secret_id, clean_url, 'weaf_discord_' || replace(p_tribe_id::text, '-', ''),
      'W.E.A.F tribe Discord webhook', null
    );
    update private.tribe_discord_webhooks
    set webhook_last4 = last_four, enabled = p_enabled, last_error = null
    where tribe_id = p_tribe_id;
  end if;

  insert into private.audit_logs(actor_user_id, tribe_id, action, entity_type, entity_id)
  values (actor_id, p_tribe_id, 'discord.configured', 'tribe', p_tribe_id);
  return jsonb_build_object('configured', true, 'enabled', p_enabled, 'last4', last_four);
end;
$$;
