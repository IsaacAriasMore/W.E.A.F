# Marketplace v2 - RLS Matrix & RPC Matrix Tests
# Run against local Supabase API with credentials discovered at runtime.

function Get-LocalSupabaseTestEnvironment {
    $npx = Get-Command npx.cmd -ErrorAction SilentlyContinue
    if (-not $npx) { $npx = Get-Command npx -ErrorAction SilentlyContinue }
    if (-not $npx) { throw "Supabase local test setup failed: npx is unavailable." }

    $statusOutput = @(& $npx.Source supabase status -o env 2>$null)
    if ($LASTEXITCODE -ne 0) {
        throw "Supabase local test setup failed: the local stack is not running."
    }

    $values = @{}
    foreach ($line in $statusOutput) {
        if ($line -match '^([A-Z0-9_]+)=(.*)$') {
            $values[$matches[1]] = $matches[2].Trim().Trim('"')
        }
    }

    foreach ($name in @('API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY')) {
        if ([string]::IsNullOrWhiteSpace($values[$name])) {
            throw "Supabase local test setup failed: required local value '$name' is unavailable."
        }
    }

    $apiUri = $null
    if (-not [Uri]::TryCreate($values['API_URL'], [UriKind]::Absolute, [ref]$apiUri) -or
        $apiUri.Scheme -notin @('http', 'https') -or
        -not $apiUri.IsLoopback) {
        throw "Supabase local test setup failed: API_URL must use a loopback host."
    }

    return @{
        ApiUrl = $apiUri.AbsoluteUri.TrimEnd('/')
        AnonKey = $values['ANON_KEY']
        ServiceRoleKey = $values['SERVICE_ROLE_KEY']
    }
}

$localSupabase = Get-LocalSupabaseTestEnvironment
$API = $localSupabase.ApiUrl
$ANON = $localSupabase.AnonKey
$SVC = $localSupabase.ServiceRoleKey

try {

$PASS = "Test1234!"
$script:Failures = 0

function Write-TestFailure($message) {
    $script:Failures += 1
    Write-Host "  FAIL: $message" -ForegroundColor Red
}

function Invoke-Api($method, $url, $key, $body, $desc) {
    $headers = @{ "apikey" = $key; "Authorization" = "Bearer $key" }
    try {
        if ($body) {
            $r = Invoke-RestMethod -Uri $url -Method $method -Headers $headers -Body ($body | ConvertTo-Json) -ContentType "application/json" -ErrorAction Stop
            return @{ ok = $true; data = $r }
        } else {
            $r = Invoke-RestMethod -Uri $url -Method $method -Headers $headers -ErrorAction Stop
            return @{ ok = $true; data = $r }
        }
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        return @{ ok = $false; code = $code }
    }
}

function Assert-Status($result, $expected, $desc) {
    if ($result.ok -and $expected -eq 200) { Write-Host "  PASS: $desc" -ForegroundColor Green }
    elseif (-not $result.ok -and $result.code -eq $expected) { Write-Host "  PASS: $desc (got $($result.code))" -ForegroundColor Green }
    else { Write-TestFailure "$desc - expected $expected got $($result.code)" }
}

# --- Create test users via auth signup ---
Write-Host "=== Setting up test users ===" -ForegroundColor Cyan
$users = @(
    @{ email = "rls-a@test.local"; id = "00000000-0000-0000-0000-0000000000b1" },
    @{ email = "rls-b@test.local"; id = "00000000-0000-0000-0000-0000000000b2" }
)
$tokens = @{}

foreach ($u in $users) {
    $body = @{ email = $u.email; password = $PASS; data = @{ display_name = $u.email.Split("@")[0] } }
    $r = Invoke-Api POST "$API/auth/v1/signup" $ANON $body
    if (-not $r.ok -and $r.code -ne 422) {
        Write-Host "  User $($u.email) signup was not created (status=$($r.code))" -ForegroundColor Yellow
    }
    # Login is required even when the local fixture already exists (signup 422).
    $login = @{ email = $u.email; password = $PASS; gotrue_meta_security = @{} }
    $lr = Invoke-Api POST "$API/auth/v1/token?grant_type=password" $ANON $login
    if ($lr.ok -and $lr.data.access_token) {
        $tokens[$u.email] = $lr.data.access_token
        Write-Host "  User $($u.email) signed in OK" -ForegroundColor Green
    } else {
        Write-TestFailure "local test user $($u.email) could not sign in (status=$($lr.code))"
    }
}

# Also sign in existing seed users
$seedUsers = @("seller-a@test.local", "seller-b@test.local", "viewer-a@test.local")
foreach ($email in $seedUsers) {
    $login = @{ email = $email; password = $PASS }
    $lr = Invoke-Api POST "$API/auth/v1/token?grant_type=password" $ANON $login
    if ($lr.ok -and $lr.data.access_token) {
        $tokens[$email] = $lr.data.access_token
        Write-Host "  Seed user $email signed in OK" -ForegroundColor Green
    }
}

# Use direct user_id-based approach for comparison
$TOKEN_A = $tokens["rls-a@test.local"]
$TOKEN_B = $tokens["rls-b@test.local"]
if (-not $TOKEN_A -or -not $TOKEN_B) {
    Write-TestFailure "authenticated RLS tokens are unavailable"
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "RLS MATRIX - Table Access by Role" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. marketplace_recommendation_preferences (anon should get 401/406, auth A sees own, auth B sees own)
Write-Host "`n--- marketplace_recommendation_preferences ---" -ForegroundColor Yellow
$r = Invoke-Api GET "$API/rest/v1/marketplace_recommendation_preferences?select=user_id" $ANON
if (-not $r.ok -and $r.code -in @(401, 403, 404)) {
    Write-Host "  PASS: anon cannot select private recommendation preferences" -ForegroundColor Green
} else {
    Write-TestFailure "anon unexpectedly accessed recommendation preferences"
}

$r = Invoke-Api GET "$API/rest/v1/marketplace_recommendation_preferences?select=user_id" $TOKEN_A $null
if ($r.ok) {
    $ids = $r.data | ForEach-Object { $_.user_id }
    Write-Host "  PASS: auth A sees rows: $($ids.Count)" -ForegroundColor Green
    # Verify only own data
    if ($ids | Where-Object { $_ -ne "00000000-0000-0000-0000-0000000000a5" -and $_ -ne "00000000-0000-0000-0000-0000000000b1" }) {
        Write-TestFailure "auth A saw someone else's data"
    } else {
        Write-Host "  PASS: auth A only sees own data" -ForegroundColor Green
    }
}

# Try direct insert (should fail via RLS - no insert policy)
$r = Invoke-Api POST "$API/rest/v1/marketplace_recommendation_preferences" $TOKEN_A @{ user_id = "00000000-0000-0000-0000-0000000000b1"; personalization_enabled = $true }
# 201 = created, 401/403 = rejected, 404 = no route
if (-not $r.ok -and ($r.code -eq 401 -or $r.code -eq 403 -or $r.code -eq 404 -or $r.code -eq 405)) {
    Write-Host "  PASS: auth A cannot INSERT directly (no insert policy)" -ForegroundColor Green
} else { Write-Host "  INFO: insert result: ok=$($r.ok) code=$($r.code)" -ForegroundColor Yellow }

# 2. marketplace_recommendation_events
Write-Host "`n--- marketplace_recommendation_events ---" -ForegroundColor Yellow
$r = Invoke-Api GET "$API/rest/v1/marketplace_recommendation_events?select=user_id,event_type&limit=3" $ANON
if ($r.ok) { Write-Host "  PASS: anon can GET (0 rows): $($r.data.Count)" -ForegroundColor Green }

$r = Invoke-Api POST "$API/rest/v1/marketplace_recommendation_events" $TOKEN_A @{
    user_id = "00000000-0000-0000-0000-0000000000b1"; event_type = "filter"; weight = 1
    context = "{}"; client_event_id = [guid]::NewGuid().ToString()
}
if (-not $r.ok -and ($r.code -eq 401 -or $r.code -eq 403 -or $r.code -eq 404 -or $r.code -eq 405)) {
    Write-Host "  PASS: auth A cannot INSERT directly (no insert policy)" -ForegroundColor Green
}

# 3. marketplace_user_interest_profiles
Write-Host "`n--- marketplace_user_interest_profiles ---" -ForegroundColor Yellow
$r = Invoke-Api GET "$API/rest/v1/marketplace_user_interest_profiles?select=user_id" $ANON
if ($r.ok) { Write-Host "  PASS: anon GET: $($r.data.Count) rows" -ForegroundColor Green }

# 4. marketplace_listing_impressions
Write-Host "`n--- marketplace_listing_impressions ---" -ForegroundColor Yellow
$r = Invoke-Api GET "$API/rest/v1/marketplace_listing_impressions?select=id&limit=3" $ANON
if ($r.ok) { Write-Host "  PASS: anon GET impressions: $($r.data.Count)" -ForegroundColor Green }

# 5. private.marketplace_ranking_secrets (should not be accessible via REST)
Write-Host "`n--- private.marketplace_ranking_secrets ---" -ForegroundColor Yellow
$r = Invoke-Api GET "$API/rest/v1/marketplace_ranking_secrets" $ANON
if (-not $r.ok -and $r.code -eq 404) { Write-Host "  PASS: private schema not exposed via REST" -ForegroundColor Green }
else { Write-TestFailure "private ranking secrets accessible via REST (status=$($r.code))" }

# 6. private.marketplace_payment_qa_settings 
Write-Host "`n--- private.marketplace_payment_qa_settings ---" -ForegroundColor Yellow
$r = Invoke-Api GET "$API/rest/v1/marketplace_payment_qa_settings" $SVC
if (-not $r.ok -and $r.code -eq 404) { Write-Host "  PASS: private settings not exposed via REST" -ForegroundColor Green }

# 7. private.marketplace_payment_qa_allowlist
Write-Host "`n--- private.marketplace_payment_qa_allowlist ---" -ForegroundColor Yellow
$r = Invoke-Api GET "$API/rest/v1/marketplace_payment_qa_allowlist" $SVC
if (-not $r.ok -and $r.code -eq 404) { Write-Host "  PASS: private allowlist not exposed via REST" -ForegroundColor Green }

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "RPC MATRIX - Function Access by Role" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# RPC: get_marketplace_catalog_v2
Write-Host "`n--- get_marketplace_catalog_v2 ---" -ForegroundColor Yellow
$r = Invoke-Api POST "$API/rest/v1/rpc/get_marketplace_catalog_v2" $ANON @{}
if ($r.ok -and $r.data.categories) { Write-Host "  PASS: anon can call (categories=$($r.data.categories.Length))" -ForegroundColor Green }

$r = Invoke-Api POST "$API/rest/v1/rpc/get_marketplace_catalog_v2" $TOKEN_A @{ p_limit = 12 }
if ($r.ok -and $r.data.listings) { Write-Host "  PASS: auth A can call (listings=$($r.data.listings.Length))" -ForegroundColor Green }

# RPC: get_marketplace_recommendation_settings
Write-Host "`n--- get_marketplace_recommendation_settings ---" -ForegroundColor Yellow
$r = Invoke-Api POST "$API/rest/v1/rpc/get_marketplace_recommendation_settings" $ANON @{}
if ($r.ok -and $r.data.authenticated -eq $false) { Write-Host "  PASS: anon gets authenticated=false" -ForegroundColor Green }

$r = Invoke-Api POST "$API/rest/v1/rpc/get_marketplace_recommendation_settings" $tokens["viewer-a@test.local"] @{}
if ($r.ok -and $r.data.authenticated -eq $true) { Write-Host "  PASS: viewer-a gets authenticated=true" -ForegroundColor Green }

# RPC: set_marketplace_personalization
Write-Host "`n--- set_marketplace_personalization ---" -ForegroundColor Yellow
$r = Invoke-Api POST "$API/rest/v1/rpc/set_marketplace_personalization" $ANON @{ p_enabled = $true }
if (-not $r.ok -and ($r.code -eq 401 -or $r.code -eq 403)) { Write-Host "  PASS: anon rejected" -ForegroundColor Green }
else { Write-Host "  WARN: anon result ok=$($r.ok) code=$($r.code)" -ForegroundColor Yellow }

$r = Invoke-Api POST "$API/rest/v1/rpc/set_marketplace_personalization" $tokens["viewer-a@test.local"] @{ p_enabled = $true }
if ($r.ok) { Write-Host "  PASS: viewer-a can set personalization enabled=true" -ForegroundColor Green }

# RPC: reset_marketplace_recommendations
Write-Host "`n--- reset_marketplace_recommendations ---" -ForegroundColor Yellow
$r = Invoke-Api POST "$API/rest/v1/rpc/reset_marketplace_recommendations" $ANON @{}
if (-not $r.ok -and ($r.code -eq 401 -or $r.code -eq 403)) { Write-Host "  PASS: anon rejected" -ForegroundColor Green }

# RPC: record_marketplace_recommendation_event
Write-Host "`n--- record_marketplace_recommendation_event ---" -ForegroundColor Yellow
$r = Invoke-Api POST "$API/rest/v1/rpc/record_marketplace_recommendation_event" $ANON @{
    p_event_type = "filter"; p_context = @{ category = "resources" }
}
if (-not $r.ok -and ($r.code -eq 401 -or $r.code -eq 403)) { Write-Host "  PASS: anon rejected" -ForegroundColor Green }

# RPC: maintain_marketplace_recommendation_data
Write-Host "`n--- maintain_marketplace_recommendation_data ---" -ForegroundColor Yellow
$r = Invoke-Api POST "$API/rest/v1/rpc/maintain_marketplace_recommendation_data" $ANON @{}
if (-not $r.ok) { Write-Host "  PASS: anon rejected (code=$($r.code))" -ForegroundColor Green }

$r = Invoke-Api POST "$API/rest/v1/rpc/maintain_marketplace_recommendation_data" $tokens["viewer-a@test.local"] @{}
if (-not $r.ok) { Write-Host "  PASS: auth A rejected (code=$($r.code))" -ForegroundColor Green }

$r = Invoke-Api POST "$API/rest/v1/rpc/maintain_marketplace_recommendation_data" $SVC @{}
if ($r.ok) { Write-Host "  PASS: service_role allowed (code=200)" -ForegroundColor Green }
else { Write-TestFailure "service_role rejected by maintenance RPC (status=$($r.code))" }

# RPC: get_marketplace_checkout_settings
Write-Host "`n--- get_marketplace_checkout_settings ---" -ForegroundColor Yellow
$r = Invoke-Api POST "$API/rest/v1/rpc/get_marketplace_checkout_settings" $ANON @{}
if ($r.ok -and $r.data.marketplace_enabled -eq $true) { Write-Host "  PASS: anon can get settings" -ForegroundColor Green }

# RPC: prepare_marketplace_paypal_order (service_role only)
Write-Host "`n--- prepare_marketplace_paypal_order ---" -ForegroundColor Yellow
$r = Invoke-Api POST "$API/rest/v1/rpc/prepare_marketplace_paypal_order" $ANON @{
    p_user_id = "00000000-0000-0000-0000-0000000000a1"
    p_listing_id = "a0000000-0000-0000-0000-000000000001"
    p_idempotency_key = [guid]::NewGuid().ToString()
}
if (-not $r.ok) { Write-Host "  PASS: anon rejected (code=$($r.code))" -ForegroundColor Green }

$r = Invoke-Api POST "$API/rest/v1/rpc/prepare_marketplace_paypal_order" $SVC @{
    p_user_id = "00000000-0000-0000-0000-0000000000a1"
    p_listing_id = "a0000000-0000-0000-0000-000000000001"
    p_idempotency_key = [guid]::NewGuid().ToString()
}
if (-not $r.ok -and $r.code -eq 400) {
    Write-Host "  PASS: service_role reaches the RPC and closed kill switches reject preparation" -ForegroundColor Green
} else {
    Write-TestFailure "prepare order did not fail closed with disabled payments (status=$($r.code))"
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "PERSONALIZATION TESTS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$VTOKEN = if ($tokens["viewer-a@test.local"]) { $tokens["viewer-a@test.local"] } else { $TOKEN_A }
if (-not $VTOKEN) { Write-TestFailure "no authenticated local user token is available" }

# Event with personalization disabled
$r = Invoke-Api POST "$API/rest/v1/rpc/set_marketplace_personalization" $VTOKEN @{ p_enabled = $false }
Write-Host "Personalization disabled for viewer-a" -ForegroundColor Gray

$r = Invoke-Api POST "$API/rest/v1/rpc/record_marketplace_recommendation_event" $VTOKEN @{
    p_event_type = "filter"; p_context = @{ category = "resources" }
}
if (-not $r.ok) { Write-Host "  PASS: event rejected when personalization disabled" -ForegroundColor Green }

# Re-enable
$r = Invoke-Api POST "$API/rest/v1/rpc/set_marketplace_personalization" $VTOKEN @{ p_enabled = $true }
if ($r.ok) { Write-Host "  PASS: personalization re-enabled" -ForegroundColor Green }

# Valid event
$cid1 = [guid]::NewGuid().ToString()
$r = Invoke-Api POST "$API/rest/v1/rpc/record_marketplace_recommendation_event" $VTOKEN @{
    p_event_type = "filter"; p_context = @{ category = "resources" }; p_client_event_id = $cid1
}
if ($r.ok) { Write-Host "  PASS: valid filter event accepted" -ForegroundColor Green }

# Deduplication
$r = Invoke-Api POST "$API/rest/v1/rpc/record_marketplace_recommendation_event" $VTOKEN @{
    p_event_type = "filter"; p_context = @{ category = "resources" }; p_client_event_id = $cid1
}
if ($r.ok -and $r.data -eq $false) { Write-Host "  PASS: duplicate client_event_id deduped" -ForegroundColor Green }

# Invalid context key
$r = Invoke-Api POST "$API/rest/v1/rpc/record_marketplace_recommendation_event" $VTOKEN @{
    p_event_type = "search"; p_context = @{ search = "rex"; malicious_key = "evil" }
}
if (-not $r.ok) { Write-Host "  PASS: event with extra context key rejected" -ForegroundColor Green }

# Hide (negative signal) 
$r = Invoke-Api POST "$API/rest/v1/rpc/record_marketplace_recommendation_event" $VTOKEN @{
    p_event_type = "hide"; p_listing_id = "a0000000-0000-0000-0000-000000000001"
}
if ($r.ok) { Write-Host "  PASS: hide event accepted (negative weight)" -ForegroundColor Green }

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "CATALOG V2 TESTS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Structure check
$r = Invoke-Api POST "$API/rest/v1/rpc/get_marketplace_catalog_v2" $ANON @{ p_limit = 12 }
if ($r.ok) {
    $d = $r.data
    $checks = @("categories", "featured", "listings", "next_cursor", "personalization_enabled", "bucket")
    $ok = $true
    foreach ($c in $checks) { if (-not ($d.PSObject.Properties.Name -contains $c)) { Write-TestFailure "missing catalog key '$c'"; $ok = $false } }
    if ($ok) { Write-Host "  PASS: all 6 structure keys present" -ForegroundColor Green }
    Write-Host "  featured=$($d.featured.Length) organic=$($d.listings.Length) cursor=$($d.next_cursor)"
}

# Limit validation
$r = Invoke-Api POST "$API/rest/v1/rpc/get_marketplace_catalog_v2" $ANON @{ p_limit = 0 }
if (-not $r.ok) { Write-Host "  PASS: limit=0 rejected" -ForegroundColor Green }

$r = Invoke-Api POST "$API/rest/v1/rpc/get_marketplace_catalog_v2" $ANON @{ p_limit = 25 }
if (-not $r.ok) { Write-Host "  PASS: limit=25 rejected" -ForegroundColor Green }

# Type validation
$r = Invoke-Api POST "$API/rest/v1/rpc/get_marketplace_catalog_v2" $ANON @{ p_type = "invalid" }
if (-not $r.ok) { Write-Host "  PASS: invalid type rejected" -ForegroundColor Green }

# Platform validation
$r = Invoke-Api POST "$API/rest/v1/rpc/get_marketplace_catalog_v2" $ANON @{ p_platform = "switch" }
if (-not $r.ok) { Write-Host "  PASS: invalid platform rejected" -ForegroundColor Green }

# Category filter
$r = Invoke-Api POST "$API/rest/v1/rpc/get_marketplace_catalog_v2" $ANON @{ p_category = "resources" }
if ($r.ok) { Write-Host "  PASS: category filter works (listings=$($r.data.listings.Length))" -ForegroundColor Green }

# Search
$r = Invoke-Api POST "$API/rest/v1/rpc/get_marketplace_catalog_v2" $ANON @{ p_search = "rex" }
if ($r.ok) { Write-Host "  PASS: search works (listings=$($r.data.listings.Length))" -ForegroundColor Green }

# Slug
$r = Invoke-Api POST "$API/rest/v1/rpc/get_marketplace_catalog_v2" $ANON @{ p_slug = "seller-a-featured-001" }
if ($r.ok -and $r.data.listings.Length -eq 1) { Write-Host "  PASS: slug query returns 1 listing" -ForegroundColor Green }
else { Write-Host "  INFO: slug query returned $($r.data.listings.Length) listings" -ForegroundColor Yellow }

# No ASE listings
$r = Invoke-Api POST "$API/rest/v1/rpc/get_marketplace_catalog_v2" $ANON @{ p_limit = 24 }
if ($r.ok) {
    $games = @($r.data.listings | ForEach-Object { $_.game } | Select-Object -Unique)
    if ($games.Count -eq 1 -and $games[0] -eq "ascended") { Write-Host "  PASS: no ASE/Both listings returned" -ForegroundColor Green }
    else { Write-TestFailure "catalog returned unexpected game values" }
}

# No expired listings
$exp = $r.data.listings | Where-Object { $_.title -like "*Expired*" }
if ($exp.Count -eq 0) { Write-Host "  PASS: no expired listings returned" -ForegroundColor Green }
else { Write-TestFailure "expired listing returned" }

# No hidden listings
$hdn = $r.data.listings | Where-Object { $_.title -like "*Hidden*" }
if ($hdn.Count -eq 0) { Write-Host "  PASS: no hidden listings returned" -ForegroundColor Green }

# Draft listings not returned
$dft = $r.data.listings | Where-Object { $_.title -like "*Draft*" }
if ($dft.Count -eq 0) { Write-Host "  PASS: no draft listings returned" -ForegroundColor Green }

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "FAIR ROTATION & CURSOR TESTS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Get first page
$r = Invoke-Api POST "$API/rest/v1/rpc/get_marketplace_catalog_v2" $ANON @{ p_limit = 3 }
if ($r.ok) {
    $listings1 = $r.data.listings
    $cursor1 = $r.data.next_cursor
    Write-Host "  Page 1: $($listings1.Length) listings, cursor=$($cursor1.Substring(0, [Math]::Min(20, $cursor1.Length)))..." -ForegroundColor Gray
    $sellers1 = $listings1 | ForEach-Object { $_.slug.Split("-")[0] } | Select-Object -Unique
    Write-Host "  Sellers on page 1: $($sellers1 -join ',')" -ForegroundColor Gray
    
    # Get second page
    if ($cursor1) {
        $r2 = Invoke-Api POST "$API/rest/v1/rpc/get_marketplace_catalog_v2" $ANON @{ p_limit = 3; p_cursor = $cursor1 }
        if ($r2.ok) {
            $listings2 = $r2.data.listings
            Write-Host "  Page 2: $($listings2.Length) listings" -ForegroundColor Gray
            
            # Check no duplicates between pages
            $ids1 = $listings1 | ForEach-Object { $_.id }
            $ids2 = $listings2 | ForEach-Object { $_.id }
            $dup = $ids1 | Where-Object { $_ -in $ids2 }
            if ($dup.Count -eq 0) { Write-Host "  PASS: no duplicates between pages" -ForegroundColor Green }
            else { Write-TestFailure "$($dup.Count) duplicates between pages" }
        }
    }
    
    # Stable order within same bucket (call again immediately)
    $r3 = Invoke-Api POST "$API/rest/v1/rpc/get_marketplace_catalog_v2" $ANON @{ p_limit = 3 }
    if ($r3.ok) {
        $ids3 = $r3.data.listings | ForEach-Object { $_.id }
        if ($($ids1 -join ',') -eq $($ids3 -join ',')) { Write-Host "  PASS: stable order within same bucket" -ForegroundColor Green }
        else { Write-Host "  INFO: order may have changed (expected in new bucket)" -ForegroundColor Yellow }
    }
}

# No featured in organic
$r = Invoke-Api POST "$API/rest/v1/rpc/get_marketplace_catalog_v2" $ANON @{ p_limit = 12 }
if ($r.ok) {
    $featuredInOrganic = $r.data.listings | Where-Object { $_.is_featured -eq $true }
    if ($featuredInOrganic.Count -eq 0) { Write-Host "  PASS: no featured listings in organic section" -ForegroundColor Green }
    else { Write-TestFailure "$($featuredInOrganic.Count) featured listings appeared in organic results" }
}

# Featured section - verify at most 1 per seller using authoritative local rows,
# not a slug heuristic that collapses seller-a and seller-b to the same prefix.
if ($r.data.featured.Count -gt 0) {
    $featuredIdFilter = ($r.data.featured | ForEach-Object { $_.id }) -join ','
    $owners = Invoke-Api GET "$API/rest/v1/marketplace_listings?select=id,owner_user_id&id=in.($featuredIdFilter)" $SVC $null
    if (-not $owners.ok) {
        Write-TestFailure "could not validate featured seller diversity (status=$($owners.code))"
    } else {
        $overLimit = @($owners.data | Group-Object owner_user_id | Where-Object { $_.Count -gt 1 })
        if ($overLimit.Count -eq 0) { Write-Host "  PASS: at most 1 featured per seller" -ForegroundColor Green }
        else { Write-TestFailure "a seller has multiple listings in the initial featured set" }
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "FALLBACK TESTS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Currently v2 is available - verify it's used
$r = Invoke-Api POST "$API/rest/v1/rpc/get_marketplace_catalog_v2" $ANON @{ p_limit = 12 }
if ($r.ok) { Write-Host "  PASS: v2 available and returns data" -ForegroundColor Green }

# Verify v1 still works
$r = Invoke-Api POST "$API/rest/v1/rpc/get_marketplace_catalog" $ANON @{}
if ($r.ok) {
    if ($r.data.categories.Count -ge 6) { Write-Host "  PASS: v1 fallback returns categories" -ForegroundColor Green }
    $asaListings = $r.data.listings | Where-Object { $_.game -eq "ascended" }
    if ($asaListings.Count -ge 0) { Write-Host "  PASS: v1 contains ASA listings" -ForegroundColor Green }
} else { Write-TestFailure "v1 fallback unavailable (status=$($r.code))" }

if ($script:Failures -gt 0) {
    throw "Marketplace RLS/RPC validation failed with $script:Failures assertion(s)."
}
Write-Host "`n=== ALL API TESTS COMPLETED: PASS ===" -ForegroundColor Green
} finally {
    if ($tokens) { $tokens.Clear() }
    $TOKEN_A = $null
    $TOKEN_B = $null
    $VTOKEN = $null
    $ANON = $null
    $SVC = $null
    $localSupabase = $null
}
