$ErrorActionPreference = 'Stop'
$repoPath = Split-Path $PSScriptRoot -Parent
$sdkPath = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$avdName = 'Zav_Chess_API_36'
$adbPath = Join-Path $sdkPath 'platform-tools\adb.exe'
$emulatorPath = Join-Path $sdkPath 'emulator\emulator.exe'
$env:ANDROID_HOME = $sdkPath
$env:ANDROID_AVD_HOME = Join-Path $env:USERPROFILE '.android\avd'
$env:Path = "$sdkPath\platform-tools;$sdkPath\emulator;$env:Path"
$env:NODE_OPTIONS = "--dns-result-order=ipv4first $env:NODE_OPTIONS".Trim()
& $emulatorPath -accel-check
if ($LASTEXITCODE -ne 0) { throw 'Hipervisor indisponível. Confira docs/ANDROID.md antes de iniciar.' }

function Find-ZavEmulator {
    $serials = & $adbPath devices | Select-String '^emulator-\d+\s+device$' | ForEach-Object { ($_ -split '\s+')[0] }
    foreach ($serial in $serials) {
        $runningAvd = (& $adbPath -s $serial emu avd name 2>$null | Select-Object -First 1).Trim()
        if ($runningAvd -eq $avdName) { return $serial }
    }
    return $null
}

$serial = Find-ZavEmulator
if (!$serial) {
    Start-Process -FilePath $emulatorPath -ArgumentList '-avd', $avdName, '-memory', '2048', '-cores', '4', '-no-boot-anim'
}

$deadline = (Get-Date).AddMinutes(6)
do {
    if (!$serial) { $serial = Find-ZavEmulator }
    $booted = if ($serial) { (& $adbPath -s $serial shell getprop sys.boot_completed 2>$null).Trim() } else { '' }
    if ($booted -eq '1') { break }
    Start-Sleep -Seconds 2
} while ((Get-Date) -lt $deadline)
if (!$serial -or $booted -ne '1') { throw "O AVD $avdName não concluiu a inicialização em 6 minutos." }

$metroPort = 8081
while ($metroPort -le 8090) {
    $listener = $null
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $metroPort)
        $listener.Start()
        break
    } catch { $metroPort++ } finally { if ($listener) { $listener.Stop() } }
}
if ($metroPort -gt 8090) { throw 'Nenhuma porta livre entre 8081 e 8090 para o Metro.' }

$env:ANDROID_SERIAL = $serial
& $adbPath -s $serial reverse tcp:3001 tcp:3001
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível conectar o emulador à API local.' }
& $adbPath -s $serial reverse "tcp:$metroPort" "tcp:$metroPort"
if ($LASTEXITCODE -ne 0) { throw 'Não foi possível conectar o emulador ao Metro.' }
Write-Host "AVD: $avdName ($serial) · Metro: $metroPort · API: 3001"
Set-Location -LiteralPath $repoPath
npm.cmd exec -w @zav/mobile expo start -- --android --localhost --port $metroPort
