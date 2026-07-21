create index if not exists tribe_members_invited_by_idx
  on public.tribe_members(invited_by)
  where invited_by is not null;
