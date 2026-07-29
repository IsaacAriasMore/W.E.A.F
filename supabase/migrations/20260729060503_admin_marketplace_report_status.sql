-- Hotfix: allow only authenticated global admins to moderate Marketplace reports.
-- Rollback: drop function public.admin_update_marketplace_report_status(uuid, text).

create or replace function public.admin_update_marketplace_report_status(
  p_report_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_status text := lower(trim(coalesce(p_status, '')));
  updated_report public.marketplace_reports%rowtype;
begin
  if not private.is_global_admin() then
    raise exception 'global_admin_required';
  end if;

  if p_report_id is null then
    raise exception 'invalid_marketplace_report_id';
  end if;

  if normalized_status not in ('reviewing', 'resolved', 'dismissed') then
    raise exception 'invalid_marketplace_report_status';
  end if;

  update public.marketplace_reports
  set status = normalized_status,
      updated_at = now()
  where id = p_report_id
  returning * into updated_report;

  if not found then
    raise exception 'marketplace_report_not_found';
  end if;

  insert into public.marketplace_audit_log (
    listing_id,
    actor_user_id,
    action,
    details
  ) values (
    updated_report.listing_id,
    (select auth.uid()),
    'report_status_updated',
    jsonb_build_object(
      'report_id', updated_report.id,
      'status', updated_report.status
    )
  );

  return to_jsonb(updated_report);
end;
$$;

revoke all on function public.admin_update_marketplace_report_status(uuid, text)
from public, anon, authenticated, service_role;

grant execute on function public.admin_update_marketplace_report_status(uuid, text)
to authenticated;

comment on function public.admin_update_marketplace_report_status(uuid, text) is
'Updates a Marketplace report after an internal global-admin authorization check and records an audit event.';
