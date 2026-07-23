-- pgcrypto is installed in the managed `extensions` schema. These functions
-- otherwise keep every relation explicitly schema-qualified.
alter function public.create_tribe_invite(uuid, text, text, public.tribe_role, integer)
  set search_path = 'pg_catalog', 'extensions';
alter function public.accept_tribe_invite(text, text, text)
  set search_path = 'pg_catalog', 'extensions';
