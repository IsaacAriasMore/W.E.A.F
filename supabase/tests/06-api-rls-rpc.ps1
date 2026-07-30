$API = "http://127.0.0.1:54321"
$ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
$SVC = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

function C($method, $url, $token, $body) {
    $h = @{ apikey = $token; Authorization = "Bearer $token" }
    try {
        if ($body) { $r = Invoke-RestMethod -Uri $url -Method $method -Headers $h -Body ($body|ConvertTo-Json) -ContentType "application/json" -EA Stop }
        else { $r = Invoke-RestMethod -Uri $url -Method $method -Headers $h -EA Stop }
        return @{ ok=$true; st=200; data=$r }
    } catch {
        $s = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
        return @{ ok=$false; st=$s; err=$_|Out-String }
    }
}
function T($l, $expOK, $expSt, $r) {
    $p = ($r.ok -eq $expOK) -and ($expSt -eq "any" -or $r.st -in @($expSt))
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
foreach ($t in $tbls) {
    Write-Host "--- $t ---" -ForegroundColor Yellow
    $r = C GET "$API/rest/v1/$t?select=count" $ANON; T "anon SELECT" $true "any" $r
    $r = C GET "$API/rest/v1/$t?select=user_id&limit=1" $TA; T "auth SELECT" $true "any" $r
    $r = C POST "$API/rest/v1/$t" $TA @{user_id="00000000-0000-0000-0000-0000000000b1"}; T "auth INSERT (no policy)" $false @(401,403,404,405) $r
    $r = C PATCH "$API/rest/v1/$t?user_id=eq.00000000-0000-0000-0000-0000000000b1" $TA @{personalization_enabled=$true}; T "auth UPDATE (no policy)" $false @(401,403,404,405) $r
}

Write-Host "--- private.tables (no REST endpoint) ---" -ForegroundColor Yellow
$r = C GET "$API/rest/v1/marketplace_ranking_secrets" $ANON; T "anon GET secrets" $false 404 $r
$r = C GET "$API/rest/v1/marketplace_payment_qa_settings" $ANON; T "anon GET qa_settings" $false 404 $r
$r = C GET "$API/rest/v1/marketplace_payment_qa_allowlist" $ANON; T "anon GET allowlist" $false 404 $r

Write-Host "`n=== RPC MATRIX ===" -ForegroundColor Cyan
Write-Host "--- get_marketplace_catalog_v2 ---" -ForegroundColor Yellow
$r = C POST "$API/rest/v1/rpc/get_marketplace_catalog_v2" $ANON @{}; T "anon" $true "any" $r
$r = C POST "$API/rest/v1/rpc/get_marketplace_catalog_v2" $TA @{p_limit=24}; T "auth" $true "any" $r
$r = C POST "$API/rest/v1/rpc/get_marketplace_catalog_v2" $SVC @{p_limit=12}; T "service" $true "any" $r

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
T "service" $true "any" $r

Write-Host "`n=== API TESTS COMPLETE ===" -ForegroundColor Green
