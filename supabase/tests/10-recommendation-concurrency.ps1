# Local-only two-request concurrency regression for recommendation quotas.
$ErrorActionPreference = 'Stop'
$db = 'supabase_db_W.E.A.F'
$actor = '00000000-0000-0000-0000-0000000000a5'
$listing = 'b0000000-0000-0000-0000-000000000001'

$setup = @"
delete from public.marketplace_recommendation_events where user_id='$actor';
insert into public.marketplace_recommendation_preferences(user_id,personalization_enabled)
values('$actor',true) on conflict(user_id) do update set personalization_enabled=true;
insert into public.marketplace_recommendation_events(user_id,listing_id,event_type,weight,context,client_event_id,created_at)
select '$actor', '$listing', 'detail', 0, '{}', gen_random_uuid(), now()
from generate_series(1,119);
"@
$setup | docker exec -i $db psql -U postgres -v ON_ERROR_STOP=1 | Out-Null

$jobs = 1..2 | ForEach-Object {
  $eventId = [guid]::NewGuid().ToString()
  Start-Job -ArgumentList $db,$actor,$listing,$eventId -ScriptBlock {
    param($dbName,$actorId,$listingId,$clientEventId)
    $query = "select set_config('request.jwt.claim.sub','$actorId',false); select public.record_marketplace_recommendation_event('detail','$listingId','{}','$clientEventId');"
    $output = $query | docker exec -i $dbName psql -U postgres -v ON_ERROR_STOP=1 -t -A 2>&1
    [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = ($output -join [Environment]::NewLine) }
  }
}
$results = $jobs | Wait-Job | Receive-Job
$jobs | Remove-Job -Force
$successes = @($results | Where-Object ExitCode -eq 0).Count
$limited = @($results | Where-Object { $_.Output -match 'marketplace_recommendation_rate_limit' }).Count
if ($successes -ne 1 -or $limited -ne 1) {
  throw "Expected one accepted request and one rate-limited request; accepted=$successes limited=$limited"
}
Write-Host 'PASS: concurrent requests serialized; exactly one event crossed the hourly boundary.'
