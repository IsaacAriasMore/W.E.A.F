# PayPal Servers Sandbox QA gate

The Servers billing flow is protected by both the global `paypal_payments`
kill switch and a separate private Sandbox QA gate. It is independent from the
Marketplace QA configuration.

## Default state

`private.server_paypal_qa_settings` is seeded with `enabled = false`. The
checkout path therefore fails closed, even if the global switch is temporarily
enabled.

## Exact authorization

The only allowed pair is an active row in
`private.server_paypal_qa_allowlist` whose `user_id` and
`server_listing_id` both match the request. The check runs inside
`public.prepare_paypal_subscription`, after the global switch, Sandbox plan,
ownership, listing and catalog validation, and before a subscription row is
inserted or a retryable checkout can be returned.

The private tables have RLS enabled, no policies, no direct client CRUD grants,
and no direct `service_role` CRUD grants. The internal helper is a
`SECURITY DEFINER` function with `search_path = ''`, is not executable by
client roles, and is called only through the existing service-role-only
subscription preparation RPC.

## Sandbox and Live behavior

The current Servers PayPal implementation accepts only Sandbox plan versions;
the gate rejects any other environment. It cannot authorize Live. A future
Live implementation must use a separately reviewed flow and must not depend on
or repurpose this QA allowlist.

## Controlled QA window

Before a future financial QA window, an authorized administrator must add the
exact QA user/listing pair and explicitly enable the private setting through a
trusted server-side administrative procedure. Keep Marketplace payments off.
Disable the setting and the global switch immediately after the window.

No value in these private tables is exposed to the frontend or the Data API.
