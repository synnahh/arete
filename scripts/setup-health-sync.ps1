# setup-health-sync.ps1 - sets up the server half of the Eufy / Fitbit Air health sync.
# Run from the repo folder in PowerShell:   .\scripts\setup-health-sync.ps1
#
# What it does, in order (it pauses and explains each step):
#   1. Copies supabase/health_sync.sql to your clipboard and opens the Supabase SQL editor (you paste and Run).
#   2. supabase login (opens your browser).
#   3. Makes a long random token, stores it as the HEALTH_INGEST_TOKEN secret with your user id, and deploys
#      the health-ingest function with JWT verification off (the phone cannot sign in; the token is its key).
#   4. Tests the live function: a wrong token must be refused, the right token must be accepted.
#   5. Copies the token to your clipboard so you can paste it into Health Auto Export. It is never printed,
#      never written to the repo, and the temporary file used to hand it to Supabase is deleted.
# Nothing here touches your data. Re-running makes a NEW token (the old phone token then stops working).
$ErrorActionPreference = 'Stop'
$ref = 'jwzgxcqapxaomuenleyt'
$base = "https://$ref.supabase.co/functions/v1/health-ingest"
Set-Location (Split-Path $PSScriptRoot -Parent)

function Step($n, $text) { Write-Host ""; Write-Host "== Step $n. $text" -ForegroundColor Cyan }

Step 1 'Create the table'
Get-Content -Raw 'supabase/health_sync.sql' | Set-Clipboard
Write-Host 'The SQL is on your clipboard. In the page that opens: New query, paste (Ctrl+V), Run. It is safe to run twice.'
Start-Process "https://supabase.com/dashboard/project/$ref/sql/new"
Read-Host 'Press Enter when it says Success'

Step 2 'Log in to Supabase'
npx supabase login
if ($LASTEXITCODE -ne 0) { throw 'supabase login failed' }

Step 3 'Secrets and deploy'
Write-Host 'Your user id: Supabase dashboard > Authentication > Users > click your user > copy the UUID.'
$owner = (Read-Host 'Paste your user UUID').Trim()
if ($owner -notmatch '^[0-9a-fA-F-]{36}$') { throw 'That does not look like a UUID (36 characters with dashes).' }

$bytes = New-Object byte[] 32
$rng = New-Object Security.Cryptography.RNGCryptoServiceProvider
$rng.GetBytes($bytes)
$token = ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''

$envFile = Join-Path $env:TEMP ("arete-health-" + [guid]::NewGuid().ToString('N') + '.env')
try {
  Set-Content -Path $envFile -Value @("HEALTH_INGEST_TOKEN=$token", "OWNER_USER_ID=$owner") -Encoding ASCII
  npx supabase secrets set --env-file $envFile --project-ref $ref
  if ($LASTEXITCODE -ne 0) { throw 'Setting the secrets failed' }
} finally {
  if (Test-Path $envFile) { Remove-Item $envFile -Force }
}

npx supabase functions deploy health-ingest --no-verify-jwt --use-api --project-ref $ref
if ($LASTEXITCODE -ne 0) { throw 'Deploy failed' }

Step 4 'Test the live function'
function Post($tok, $body) {
  try {
    $r = Invoke-WebRequest -Uri $base -Method Post -Headers @{ 'x-health-token' = $tok } -Body $body -ContentType 'application/json' -UseBasicParsing
    return @{ code = [int]$r.StatusCode; body = $r.Content }
  } catch {
    $resp = $_.Exception.Response
    $code = if ($resp) { [int]$resp.StatusCode } else { 0 }
    return @{ code = $code; body = '' }
  }
}
Start-Sleep -Seconds 4   # a new deploy can take a moment to answer
$bad = Post 'wrong-token' '{}'
$good = Post $token '{}'
$okBad = ($bad.code -eq 401)
$okGood = ($good.code -eq 200 -and $good.body -match '"ok":true')
Write-Host ("Wrong token refused (expect 401): {0}  -> {1}" -f $bad.code, $(if ($okBad) { 'PASS' } else { 'FAIL' }))
Write-Host ("Right token accepted (expect 200): {0}  -> {1}" -f $good.code, $(if ($okGood) { 'PASS' } else { 'FAIL' }))
if (-not ($okBad -and $okGood)) {
  Write-Host 'A 404 means the deploy did not land; 503 means a secret is missing. Run the script again.' -ForegroundColor Yellow
  exit 1
}

Step 5 'Give the token to the phone'
Set-Clipboard -Value $token
Write-Host 'The token is on your clipboard (not shown here on purpose).'
Write-Host '1. Save it in your password manager NOW (you cannot read it back from Supabase).'
Write-Host '2. In Health Auto Export on the iPhone: Automations > REST API > Headers > x-health-token = paste it.'
Write-Host "3. URL for that automation: $base"
Write-Host 'Then continue at section C in docs/health-ingest-checklist.md (the iPhone apps).'
Read-Host 'Press Enter once the token is saved (this clears your clipboard)'
Set-Clipboard -Value ' '
Write-Host 'Done. Clipboard cleared.' -ForegroundColor Green
