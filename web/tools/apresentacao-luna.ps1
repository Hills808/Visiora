# Apresentacao temporaria do Luna em notebook/celular, mantendo a chave no PC.
# Requisitos: cloudflared >= 2026.9.3, Node 24 e .env/ledger existentes.
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[^\s@]+@[^\s@]+\.[^\s@]+$')]
  [string]$Email
)

$ErrorActionPreference = 'Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

if (-not (Test-Path '.env')) { throw 'Arquivo privado .env ausente. Configure o Luna neste computador antes de usar o tunel.' }
if (-not (Test-Path '.runtime\luna-budget.sqlite')) { throw 'Registro de orcamento ausente. Nao inicie com ledger novo sem reconciliar gastos do dia.' }
if (-not (Test-Path 'dist\index.html')) { throw 'Build ausente. Execute npm run build antes de iniciar.' }
if (Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue) {
  throw 'Porta 8080 ocupada. Encerre o gateway Luna anterior com Ctrl+C, preservando o ledger.'
}
$cloudflared = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $cloudflared) { throw 'Instale o cloudflared: winget install --id Cloudflare.cloudflared -e; depois reabra o PowerShell.' }
$cloudflaredHelp = (& $cloudflared tunnel --help 2>&1 | Out-String)
if ($cloudflaredHelp -notmatch '--allowed-mail') {
  throw 'Atualize o cloudflared para a versao 2026.9.3 ou superior, com autenticacao por e-mail.'
}

Write-Host ''
Write-Host 'Abrindo tunel HTTPS temporario com login por e-mail...' -ForegroundColor Cyan
Write-Host 'Copie o endereco https://...trycloudflare.com da NOVA janela e cole abaixo.'
Write-Host 'Somente o e-mail autorizado podera acessar o tunel.'
$cloudflaredProcess = Start-Process -FilePath $cloudflared -PassThru -ArgumentList @(
  'tunnel', '--url', 'http://127.0.0.1:8080',
  '--http-host-header', '127.0.0.1:8080',
  '--allowed-mail', $Email
)

try {
  $publicUrl = (Read-Host 'Cole aqui a URL HTTPS gerada').Trim().TrimEnd('/')
  if ($publicUrl -cnotmatch '^https://[a-z0-9-]+\.trycloudflare\.com$') {
    throw 'URL invalida. Use exatamente o endereco HTTPS exibido pelo cloudflared.'
  }
  if ($cloudflaredProcess.HasExited) { throw 'O tunel encerrou antes de iniciar o Luna.' }

  $env:VISIORA_PUBLIC_ORIGIN = $publicUrl
  Write-Host ''
  Write-Host "Visiora Luna: $publicUrl" -ForegroundColor Green
  Write-Host 'Mantenha este PowerShell e a janela do tunel abertos durante a apresentacao.'
  Write-Host 'Na pagina HTTPS, autorize a camera e o envio de imagens ao Luna.'
  Write-Host 'Para encerrar, pressione Ctrl+C. O tunel sera interrompido.'
  & npm run dev:luna
}
finally {
  if ($cloudflaredProcess -and -not $cloudflaredProcess.HasExited) {
    Stop-Process -Id $cloudflaredProcess.Id -ErrorAction SilentlyContinue
  }
  Remove-Item Env:VISIORA_PUBLIC_ORIGIN -ErrorAction SilentlyContinue
}
