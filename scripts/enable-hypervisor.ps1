# Executar como administrador. Não reinicia o computador automaticamente.
$ErrorActionPreference = 'Stop'
$logPath = Join-Path (Split-Path $PSScriptRoot -Parent) '.local\hypervisor-result.txt'
try {
    $result = Enable-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform -All -NoRestart
    $result | Format-List | Out-String | Set-Content -LiteralPath $logPath
    Write-Host 'Windows Hypervisor Platform habilitado. Reinicie o Windows para ativar o emulador.'
} catch {
    $_.Exception.Message | Set-Content -LiteralPath $logPath
    throw
}
