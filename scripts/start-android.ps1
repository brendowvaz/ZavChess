$ErrorActionPreference = 'Stop'
$repoPath = Split-Path $PSScriptRoot -Parent
$sdkPath = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$env:ANDROID_HOME = $sdkPath
$env:Path = "$sdkPath\platform-tools;$sdkPath\emulator;$env:Path"
& "$sdkPath\emulator\emulator.exe" -accel-check
if ($LASTEXITCODE -ne 0) { throw 'Hipervisor indisponível. Confira docs/ANDROID.md antes de iniciar.' }
$devices = & "$sdkPath\platform-tools\adb.exe" devices
if (!($devices -match 'emulator-\d+\s+device')) {
    Start-Process -FilePath "$sdkPath\emulator\emulator.exe" -ArgumentList '-avd','Zav_Chess_API_36','-memory','2048','-cores','2' -WindowStyle Hidden
}
Set-Location -LiteralPath $repoPath
npm.cmd run android -w @zav/mobile
