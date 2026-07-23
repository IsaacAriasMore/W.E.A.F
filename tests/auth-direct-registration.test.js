import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('profile creation runs on user insertion without confirmation gates', () => {
  const migration = read('supabase/migrations/20260721214754_phase_2_auth_profiles.sql');
  assert.match(migration, /after insert on auth\.users/i);
  assert.match(migration, /insert into public\.profiles/i);
  assert.doesNotMatch(migration, /email_confirmed|email_verified|confirmed_at/i);
});

test('direct registration keeps tenant and role boundaries intact', () => {
  const schema = read('supabase/schema.sql');
  const rls = read('supabase/rls.sql');
  assert.match(schema, /global_role public\.global_role not null default 'user'/i);
  assert.match(rls, /tribes_read_members[\s\S]*private\.is_tribe_member\(id\)/i);
  assert.match(rls, /tribe_members_read_tribe[\s\S]*private\.is_tribe_member\(tribe_id\)/i);
  assert.match(rls, /profiles_update_own[\s\S]*auth\.uid\(\)\) = id/i);
});

test('local Auth and frontend feature flag default to direct registration', () => {
  assert.match(read('supabase/config.toml'), /\[auth\.email\][\s\S]*enable_confirmations = false/);
  assert.match(read('src/config/auth.js'), /VITE_REQUIRE_EMAIL_CONFIRMATION === 'true'/);
  assert.match(read('.env.example'), /VITE_REQUIRE_EMAIL_CONFIRMATION=false/);
});

test('a signup without a returned session redirects to login with success context', () => {
  const register = read('src/pages/auth/register.js');
  const login = read('src/pages/auth/login.js');
  assert.match(register, /registered=1/);
  assert.match(login, /Cuenta creada correctamente\. Ya puedes entrar a W\.E\.A\.F\./);
});
