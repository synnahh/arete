# ─── VALERIE Release Packager ─────────────────────────────────────────────────
# Produces a clean, versioned release ZIP ready for distribution.
#
# Output:
#   release/
#     VALERIE-v{version}-Windows.zip
#       VALERIE-Setup.exe
#       README.txt
#
# Usage:  powershell -ExecutionPolicy Bypass -File scripts/package-release.ps1

$ErrorActionPreference = 'Stop'

# ── Read version from tauri.conf.json ─────────────────────────────────────────
$conf    = Get-Content 'src-tauri/tauri.conf.json' | ConvertFrom-Json
$version = $conf.version
$name    = $conf.productName

Write-Host ""
Write-Host "  VALERIE Release Packager" -ForegroundColor Cyan
Write-Host "  Packaging $name v$version for Windows..." -ForegroundColor Gray
Write-Host ""

# ── Locate built installer ─────────────────────────────────────────────────────
$installer = "src-tauri/target/release/bundle/nsis/${name}_${version}_x64-setup.exe"
if (-not (Test-Path $installer)) {
    Write-Host "  [ERROR] Installer not found at: $installer" -ForegroundColor Red
    Write-Host "  Run: npm run tauri build -- --bundles nsis" -ForegroundColor Yellow
    exit 1
}

# ── Prepare release directory ──────────────────────────────────────────────────
$releaseDir = "release"
$stagingDir = "$releaseDir\staging"
if (Test-Path $stagingDir) { Remove-Item $stagingDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $stagingDir | Out-Null

# ── Copy installer with clean name ─────────────────────────────────────────────
$cleanInstaller = "$stagingDir\VALERIE-Setup.exe"
Copy-Item $installer $cleanInstaller
Write-Host "  [OK] Installer  -> VALERIE-Setup.exe" -ForegroundColor Green

# ── Write README.txt ───────────────────────────────────────────────────────────
$readme = @"
VALERIE — Personal AI Assistant
v$version  |  Windows x64
────────────────────────────────────────

INSTALL
  1. Run VALERIE-Setup.exe
  2. Follow the installer — no admin rights required
  3. VALERIE launches automatically after install

SYSTEM REQUIREMENTS
  • Windows 10 / 11  (x64)
  • Microsoft Edge WebView2 Runtime (auto-installed if missing)
  • Internet connection for AI and Firebase features

FIRST LAUNCH
  Complete the onboarding to set your name, theme, and voice.
  Your data syncs across devices via your Firebase account.

UNINSTALL
  Settings → Apps → VALERIE → Uninstall
  Or via Control Panel → Programs → VALERIE

────────────────────────────────────────
© 2026 VALERIE
"@

$readme | Out-File -FilePath "$stagingDir\README.txt" -Encoding utf8
Write-Host "  [OK] README.txt written" -ForegroundColor Green

# ── Create ZIP ─────────────────────────────────────────────────────────────────
$zipName = "VALERIE-v${version}-Windows.zip"
$zipPath = "$releaseDir\$zipName"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

Compress-Archive -Path "$stagingDir\*" -DestinationPath $zipPath
Write-Host "  [OK] ZIP created -> $zipName" -ForegroundColor Green

# ── Clean up staging ───────────────────────────────────────────────────────────
Remove-Item $stagingDir -Recurse -Force

# ── Summary ───────────────────────────────────────────────────────────────────
$zipSizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
Write-Host ""
Write-Host "  Done." -ForegroundColor Cyan
Write-Host "  $releaseDir\$zipName  ($zipSizeMB MB)" -ForegroundColor White
Write-Host ""
