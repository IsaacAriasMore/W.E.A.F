-- Phase 1: non-destructive security hardening for user-controlled server URLs.
-- NOT VALID preserves historical rows while enforcing the rule for new or changed rows.

alter table public.server_listings
  add constraint server_listings_discord_https_check
  check (
    discord_invite_url ~ '^https://(discord[.]gg|discord[.]com/invite)/[A-Za-z0-9_-]+/?$'
    and char_length(discord_invite_url) <= 500
  ) not valid,
  add constraint server_listings_website_https_check
  check (
    website_url is null
    or (website_url ~ '^https://[^[:space:]<>]+$' and char_length(website_url) <= 2048)
  ) not valid,
  add constraint server_listings_banner_https_check
  check (
    banner_url is null
    or (banner_url ~ '^https://[^[:space:]<>]+$' and char_length(banner_url) <= 2048)
  ) not valid;

comment on constraint server_listings_website_https_check on public.server_listings is
  'Blocks executable, insecure, whitespace and oversized user-controlled website URLs.';

comment on constraint server_listings_banner_https_check on public.server_listings is
  'Blocks non-HTTPS, whitespace and oversized user-controlled banner URLs.';
