$ErrorActionPreference = 'Stop'
$repository = Split-Path -Parent $PSScriptRoot
$destination = Join-Path $repository '.tools/ngrok'
$executable = Join-Path $destination 'ngrok.exe'
if (Test-Path -LiteralPath $executable) {
    & $executable version
    exit $LASTEXITCODE
}
$architecture = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') { 'arm64' } else { 'amd64' }
New-Item -ItemType Directory -Path $destination -Force | Out-Null
$archive = Join-Path $destination 'ngrok.zip'
Invoke-WebRequest -Uri "https://bin.ngrok.com/c/bNyj1mQVY4c/ngrok-v3-stable-windows-$architecture.zip" -OutFile $archive
Expand-Archive -LiteralPath $archive -DestinationPath $destination
Remove-Item -LiteralPath $archive
& $executable version
exit $LASTEXITCODE
