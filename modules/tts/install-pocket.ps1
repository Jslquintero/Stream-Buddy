param(
    [Parameter(Mandatory=$true)][string]$Destination,
    [Parameter(Mandatory=$true)][string]$Staging,
    [Parameter(Mandatory=$true)][string]$Voice
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)

try {
    . "$PSScriptRoot\core.ps1"
    $asset = 'pocket-tts-3.3.0-x86_64-pc-windows-msvc'
    $archiveHash = '98753041f2e65744b989776f87bccb93f1f574a08afe1890c5427ec94cd6309c'
    $executableHash = '813cabfc2f8fc7a4e5310deda6025426b3164610dd9f3c3098a6078e5cc1895a'
    $executable = Join-Path $Destination 'pocket-tts.exe'
    if (-not (Test-Path -LiteralPath $executable -PathType Leaf) -or
        (Get-FileHash -LiteralPath $executable -Algorithm SHA256).Hash -ne $executableHash) {
        Write-Output 'download'
        $archive = Join-Path $Staging "$asset.zip"
        curl.exe --fail --location --silent --show-error --max-time 120 --output $archive "https://github.com/kyutai-labs/pocket-tts/releases/download/v4.0.1/$asset.zip"
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo descargar Pocket TTS desde GitHub. Vuelve a intentar.' }
        if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $archiveHash) { throw 'La descarga de Pocket TTS no coincide con el paquete oficial.' }
        Expand-Archive -LiteralPath $archive -DestinationPath $Staging
        $package = Join-Path $Staging $asset
        Move-Item -LiteralPath (Join-Path $package 'pocket-tts.exe'),(Join-Path $package 'LICENSE') -Destination $Staging
        $executable = Join-Path $Staging 'pocket-tts.exe'
    }
    Write-Output 'model'
    $wav = Join-Path $Staging 'preview.wav'
    Invoke-PocketSpeech -Executable $executable -Voice $Voice -Text 'Hola, Pocket TTS esta listo.' -Wav $wav
    Add-WavPlaybackPadding -Path $wav
} catch {
    Write-Output ('error:' + $_.Exception.Message)
    exit 1
}
