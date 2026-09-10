$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$repoPath = Split-Path $PSScriptRoot -Parent
$targetPath = Join-Path $repoPath '.local\stockfish'
New-Item -ItemType Directory -Force -Path $targetPath | Out-Null
$release = Invoke-RestMethod 'https://api.github.com/repos/official-stockfish/Stockfish/releases/latest'
# Baseline x86-64 also runs on AMD CPUs without assuming AVX512/BMI2 support.
$asset = $release.assets | Where-Object { $_.name -in @('stockfish-windows-x86-64-universal.zip','stockfish-windows-x86-64.zip') } | Select-Object -First 1
if (!$asset) { throw 'Release oficial sem pacote x86-64 esperado. Consulte stockfishchess.org/download.' }
$zipPath = Join-Path $targetPath $asset.name
& curl.exe --fail --location --retry 2 --max-time 600 --silent --show-error $asset.browser_download_url --output $zipPath
if ($LASTEXITCODE -ne 0) { throw 'Falha no download do Stockfish.' }
if ($asset.digest -and $asset.digest.StartsWith('sha256:')) {
    if ((Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash -ne $asset.digest.Substring(7)) { throw 'Checksum do Stockfish divergente.' }
}
$extractPath = Join-Path $targetPath 'release'
Expand-Archive -LiteralPath $zipPath -DestinationPath $extractPath -Force
$binary = Get-ChildItem -LiteralPath $extractPath -Filter 'stockfish*.exe' -Recurse | Select-Object -First 1
if (!$binary) { throw 'Executável Stockfish não encontrado no pacote.' }
Copy-Item -LiteralPath $binary.FullName -Destination (Join-Path $targetPath 'stockfish.exe') -Force
[pscustomobject]@{version=$release.tag_name;url=$asset.browser_download_url;sha256=(Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash;downloadedAt=(Get-Date).ToUniversalTime().ToString('o');source=$release.html_url;license='GPL-3.0'} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $targetPath 'source.json')
Write-Host "Stockfish $($release.tag_name) instalado localmente. Licença e fontes acompanham o pacote original."
