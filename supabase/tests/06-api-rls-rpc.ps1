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

$script:Failures = 0

function C($method, $url, $token, $body) {
    $h = @{ apikey = $token; Authorization = "Bearer $token" }
    try {
        if ($body) { $r = Invoke-RestMethod -Uri $url -Method $method -Headers $h -Body ($body|ConvertTo-Json) -ContentType "application/json" -EA Stop }
        else { $r = Invoke-RestMethod -Uri $url -Method $method -Headers $h -EA Stop }
        return @{ ok=$true; st=200; data=$r }
    } catch {
        $s = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
        return @{ ok=$false; st=$s }
    }
}
function T($l, $expOK, $expSt, $r) {
    $p = ($r.ok -eq $expOK) -and ($expSt -eq "any" -or $r.st -in @($expSt))
    if (-not $p) { $script:Failures += 1 }
    Write-Host ("  $(if($p){'PASS'}else{'FAIL'}): $l (st=$($r.st))") -ForegroundColor $(if($p){'Green'}else{'Red'})
}

# Sign in users
$tok = @{}
foreach ($e in @("rls-a@test.local","rls-b@test.local","viewer-a@test.local","seller-a@test.local")) {
    $r = C POST "$API/auth/v1/token?grant_type=password" $ANON @{ email=$e; password="Test1234!" }
    if ($r.ok -and $r.data.access_token) { $tok[$e] = $r.data.access_token; Write-Host "$e signed in" -ForegroundColor Green }
}
$TA = if ($tok["viewer-a@test.local"]) { $tok["viewer-a@test.local"] } else { if ($tok["rls-a@test.local"]) { $tok["rls-a@test.local"] } else { Write-Host "No auth token!" -ForegroundColor Red; return } }

Write-Host "`n=== RLS MATRIX (via REST API) ===" -ForegroundColor Cyan
$tbls = @("marketplace_recommendation_preferences","marketplace_recommendation_events","marketplace_user_interest_profiles","marketplace_listing_impressions")
$updateBodies = @{
    marketplace_recommendation_preferences = @{ personalization_enabled = $true }
    marketplace_recommendation_events = @{ weight = 2 }
    marketplace_user_interest_profiles = @{ affinities = @{} }
    marketplace_listing_impressions = @{ position = 2 }
}
foreach ($t in $tbls) {
    Write-Host "--- $t ---" -ForegroundColor Yellow
    $r = C GET "$API/rest/v1/${t}?select=user_id&limit=1" $ANON; T "anon SELECT denied" $false @(401,403,404) $r
    $r = C GET "$API/rest/v1/${t}?select=user_id&limit=1" $TA; T "auth SELECT own rows" $true "any" $r
    $r = C POST "$API/rest/v1/${t}" $TA @{user_id="00000000-0000-0000-0000-0000000000b1"}; T "auth INSERT (no policy)" $false @(401,403,404,405) $r
    $r = C PATCH "$API/rest/v1/${t}?user_id=eq.00000000-0000-0000-0000-0000000000b1" $TA $updateBodies[$t]; T "auth UPDATE (no policy)" $false @(401,403,404,405) $r
}

Write-Host "--- private.tables (no REST endpoint) ---" -ForegroundColor Yellow
$r = C GET "$API/rest/v1/marketplace_ranking_secrets" $ANON; T "anon GET secrets" $false 404 $r
$r = C GET "$API/rest/v1/marketplace_payment_qa_settings" $ANON; T "anon GET qa_settings" $false 404 $r
$r = C GET "$API/rest/v1/marketplace_payment_qa_allowlist" $ANON; T "anon GET allowlist" $false 404 $r

Write-Host "`n=== RPC MATRIX ===" -ForegroundColor Cyan
Write-Host "--- get_marketplace_catalog_v2 ---" -ForegroundColor Yellow
$r = C POST "$API/rest/v1/rpc/get_marketplace_catalog_v2" $ANON @{}; T "anon" $true "any" $r
$r = C POST "$API/rest/v1/rpc/get_marketplace_catalog_v2" $TA @{p_limit=24}; T "auth" $true "any" $r
$r = C POST "$API/rest/v1/rpc/get_marketplace_catalog_v2" $SVC @{p_limit=12}; T "service role is not granted public catalog" $false 403 $r

Write-Host "--- get_marketplace_recommendation_settings ---" -ForegroundColor Yellow
$r = C POST "$API/rest/v1/rpc/get_marketplace_recommendation_settings" $ANON @{}; T "anon" $true "any" $r
$r = C POST "$API/rest/v1/rpc/get_marketplace_recommendation_settings" $TA @{}; T "auth" $true "any" $r

Write-Host "--- set_marketplace_personalization ---" -ForegroundColor Yellow
$r = C POST "$API/rest/v1/rpc/set_marketplace_personalization" $ANON @{p_enabled=$true}; T "anon" $false @(401,403) $r
$r = C POST "$API/rest/v1/rpc/set_marketplace_personalization" $TA @{p_enabled=$true}; T "auth" $true "any" $r

Write-Host "--- reset_marketplace_recommendations ---" -ForegroundColor Yellow
$r = C POST "$API/rest/v1/rpc/reset_marketplace_recommendations" $ANON @{}; T "anon" $false @(401,403) $r
$r = C POST "$API/rest/v1/rpc/reset_marketplace_recommendations" $TA @{}; T "auth" $true "any" $r

Write-Host "--- record_marketplace_recommendation_event ---" -ForegroundColor Yellow
$r = C POST "$API/rest/v1/rpc/record_marketplace_recommendation_event" $ANON @{p_event_type="filter";p_context=@{category="resources"}}; T "anon" $false @(401,403) $r
# re-enable personalization after reset
C POST "$API/rest/v1/rpc/set_marketplace_personalization" $TA @{p_enabled=$true} | Out-Null
$r = C POST "$API/rest/v1/rpc/record_marketplace_recommendation_event" $TA @{p_event_type="filter";p_context=@{category="resources"}}; T "auth" $true "any" $r

Write-Host "--- maintain_marketplace_recommendation_data ---" -ForegroundColor Yellow
$r = C POST "$API/rest/v1/rpc/maintain_marketplace_recommendation_data" $ANON @{}; T "anon" $false @(401,403) $r
$r = C POST "$API/rest/v1/rpc/maintain_marketplace_recommendation_data" $TA @{}; T "auth" $false @(401,403) $r
$r = C POST "$API/rest/v1/rpc/maintain_marketplace_recommendation_data" $SVC @{}; T "service" $true "any" $r

Write-Host "--- get_marketplace_checkout_settings ---" -ForegroundColor Yellow
$r = C POST "$API/rest/v1/rpc/get_marketplace_checkout_settings" $ANON @{}; T "anon" $true "any" $r
$r = C POST "$API/rest/v1/rpc/get_marketplace_checkout_settings" $TA @{}; T "auth" $true "any" $r

Write-Host "--- prepare_marketplace_paypal_order ---" -ForegroundColor Yellow
# Get viewer-a's actual UUID
$viewerId = (docker exec -i supabase_db_W.E.A.F psql -U postgres -t -A -c "SELECT id FROM auth.users WHERE email='viewer-a@test.local'")
$r = C POST "$API/rest/v1/rpc/prepare_marketplace_paypal_order" $ANON @{p_user_id=$viewerId;p_listing_id="a0000000-0000-0000-0000-000000000001";p_idempotency_key=([guid]::NewGuid().ToString())}
T "anon" $false @(401,403) $r
$r = C POST "$API/rest/v1/rpc/prepare_marketplace_paypal_order" $SVC @{p_user_id=$viewerId;p_listing_id="a0000000-0000-0000-0000-000000000001";p_idempotency_key=([guid]::NewGuid().ToString())}
T "service reaches RPC but disabled payments fail closed" $false 400 $r

if ($script:Failures -gt 0) {
    throw "Marketplace API RLS/RPC validation failed with $script:Failures assertion(s)."
}
Write-Host "`n=== API TESTS COMPLETE: PASS ===" -ForegroundColor Green
} finally {
    if ($tok) { $tok.Clear() }
    $TA = $null
    $ANON = $null
    $SVC = $null
    $localSupabase = $null
}
