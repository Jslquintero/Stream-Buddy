param([string]$Destination)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ProgressPreference = 'SilentlyContinue'
[void][IO.Directory]::CreateDirectory($Destination)
$zip = Join-Path $Destination 'piper_windows_amd64.zip'
try {
    Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip' -OutFile "$zip.download"
    Move-Item -LiteralPath "$zip.download" -Destination $zip -Force
    Expand-Archive -LiteralPath $zip -DestinationPath $Destination -Force
    if (-not (Test-Path -LiteralPath (Join-Path $Destination 'piper\piper.exe'))) { throw 'El paquete no contiene piper.exe' }
} finally {
    if (Test-Path -LiteralPath "$zip.download") { Remove-Item -LiteralPath "$zip.download" -Force }
}
