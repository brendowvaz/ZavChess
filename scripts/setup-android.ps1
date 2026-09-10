param([switch]$Install, [switch]$PersistEnvironment)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$sdkPath = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$repoPath = Split-Path $PSScriptRoot -Parent
$cachePath = Join-Path $repoPath '.local\android-setup'
New-Item -ItemType Directory -Force -Path $cachePath | Out-Null
$env:ANDROID_HOME = $sdkPath
$studioJava = 'C:\Program Files\Android\Android Studio\jbr'
if (Test-Path "$studioJava\bin\java.exe") { $env:JAVA_HOME = $studioJava }
$env:Path = "$sdkPath\platform-tools;$sdkPath\emulator;$env:JAVA_HOME\bin;$env:Path"

if ($Install) {
    $sdkManager = Join-Path $sdkPath 'cmdline-tools\latest\bin\sdkmanager.bat'
    if (!(Test-Path -LiteralPath $sdkManager)) {
        # Read Google's manifest instead of guessing a download URL.
        [xml]$manifest = (Invoke-WebRequest -UseBasicParsing 'https://dl.google.com/android/repository/repository2-3.xml').Content
        $package = $manifest.SelectSingleNode("//*[local-name()='remotePackage'][@path='cmdline-tools;latest']")
        $archive = $package.archives.archive | Where-Object { $_.'host-os' -eq 'windows' }
        $zipPath = Join-Path $cachePath $archive.complete.url
        if (!(Test-Path -LiteralPath $zipPath) -or (Get-Item -LiteralPath $zipPath).Length -ne [long]$archive.complete.size) {
            & curl.exe --fail --location --retry 2 --max-time 600 --silent --show-error ("https://dl.google.com/android/repository/" + $archive.complete.url) --output $zipPath
            if ($LASTEXITCODE -ne 0) { throw 'Falha no download das ferramentas Android. Execute novamente para tentar de novo.' }
        }
        $expectedHash = $archive.complete.checksum.InnerText
        if ((Get-FileHash -LiteralPath $zipPath -Algorithm SHA1).Hash -ne $expectedHash) { throw 'Checksum das ferramentas Android divergente.' }
        $extractPath = Join-Path $cachePath 'extracted'
        Expand-Archive -LiteralPath $zipPath -DestinationPath $extractPath -Force
        New-Item -ItemType Directory -Force -Path "$sdkPath\cmdline-tools\latest" | Out-Null
        Copy-Item -Path "$extractPath\cmdline-tools\*" -Destination "$sdkPath\cmdline-tools\latest" -Recurse -Force
    }
    1..20 | ForEach-Object { 'y' } | & $sdkManager "--sdk_root=$sdkPath" --licenses
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao aceitar licenças Android.' }
    $androidCli = Join-Path $sdkPath 'cmdline-tools\latest\bin\android.exe'
    if (Test-Path -LiteralPath $androidCli) {
        foreach ($component in @('platform-tools','platforms/android-36','build-tools/36.0.0','emulator','system-images/android-36/google_apis/x86_64')) {
            $packageMarker = Join-Path $sdkPath "$component/package.xml"
            if (Test-Path -LiteralPath $packageMarker) { continue }
            & $androidCli sdk install $component
            # Android CLI 1.x may exit with a Windows crash code after a successful unzip.
            if (!(Test-Path -LiteralPath $packageMarker)) { throw "Falha ao instalar $component." }
        }
    } else {
        $packageList = Join-Path $cachePath 'packages.txt'
        @('platform-tools','platforms;android-36','build-tools;36.0.0','emulator','system-images;android-36;google_apis;x86_64') | Set-Content -LiteralPath $packageList
        & $sdkManager "--sdk_root=$sdkPath" "--package_file=$packageList"
        if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar componentes Android.' }
    }
    $avdManager = Join-Path $sdkPath 'cmdline-tools\latest\bin\avdmanager.bat'
    $existing = & "$sdkPath\emulator\emulator.exe" -list-avds
    if ($existing -notcontains 'Zav_Chess_API_36') {
        'no' | & $avdManager create avd --name 'Zav_Chess_API_36' --package 'system-images;android-36;google_apis;x86_64' --device 'pixel_6' --force
        if ($LASTEXITCODE -ne 0) { throw 'Falha ao criar dispositivo virtual.' }
        $configPath = Join-Path $env:USERPROFILE '.android\avd\Zav_Chess_API_36.avd\config.ini'
        $config = Get-Content -LiteralPath $configPath -Raw
        $config = $config -replace '(?m)^hw.ramSize=.*$', 'hw.ramSize=2048'
        $config = $config -replace '(?m)^hw.cpu.ncore=.*$', 'hw.cpu.ncore=2'
        Set-Content -LiteralPath $configPath -Value $config -Encoding utf8
    }
}
if ($PersistEnvironment) {
    [Environment]::SetEnvironmentVariable('ANDROID_HOME', $sdkPath, 'User')
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    foreach ($addition in @("$sdkPath\platform-tools", "$sdkPath\emulator", "$sdkPath\cmdline-tools\latest\bin")) {
        if (($userPath -split ';') -notcontains $addition) { $userPath = "$userPath;$addition" }
    }
    [Environment]::SetEnvironmentVariable('Path', $userPath, 'User')
}
& "$sdkPath\platform-tools\adb.exe" version
& "$sdkPath\emulator\emulator.exe" -list-avds
& "$sdkPath\emulator\emulator.exe" -accel-check
if ($LASTEXITCODE -ne 0) { Write-Warning 'O Windows ainda precisa reiniciar para ativar o hipervisor.' }
