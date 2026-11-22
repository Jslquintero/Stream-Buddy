param([string]$JobFile)
$ErrorActionPreference = 'Stop'


try {
    . "$PSScriptRoot\core.ps1"
    if ([string]::IsNullOrWhiteSpace($JobFile)) { throw 'No se recibio el archivo del mensaje de voz.' }
    $job = Get-Content -LiteralPath $JobFile -Raw -Encoding UTF8 | ConvertFrom-Json
    $speaker = New-Object -ComObject SAPI.SpVoice
    if ($job.AudioDevice) {
        $output = @($speaker.GetAudioOutputs() | Where-Object { $_.Id -eq $job.AudioDevice }) | Select-Object -First 1
        if (-not $output) { throw 'La salida de audio seleccionada no esta disponible. Actualiza los dispositivos en el panel.' }
        $speaker.AudioOutput = $output
    }
    'Generando voz...' | Set-Content -LiteralPath "$JobFile.status" -Encoding UTF8
    if ($job.Engine -eq 'PocketTTS') {
        $wav = "$JobFile.wav"
        $voice = $job.PocketVoice
        if (-not $voice) { $voice = 'lola' }
        Invoke-PocketSpeech -Executable $job.PocketExe -Voice $voice -Text $job.Text -Wav $wav
        # Give the audio output time to open before the first syllable starts.
        Add-WavPlaybackPadding $wav ([int]$job.Volume)
        'Reproduciendo audio...' | Set-Content -LiteralPath "$JobFile.status" -Encoding UTF8
        $stream = New-Object -ComObject SAPI.SpFileStream
        try { $stream.Open($wav, 0, $false); $speaker.Volume=100; $speaker.Rate=0; [void]$speaker.SpeakStream($stream, 0) }
        finally { $stream.Close(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($stream) }
    } else {
        if ($job.Voice) {
            $voice = @($speaker.GetVoices() | Where-Object { $_.Id -eq $job.Voice -or $_.GetDescription() -eq $job.Voice -or $_.GetDescription().StartsWith($job.Voice + ' - ') }) | Select-Object -First 1
            if (-not $voice) { throw 'La voz seleccionada no esta instalada. Actualiza las voces desde el panel.' }
            $speaker.Voice = $voice
        }
        $speaker.Rate = [Math]::Max(-10, [Math]::Min(10, [int](([double]$job.Speed - 1) * 5)))
        $speaker.Volume = [int]$job.Volume
        [void]$speaker.Speak([string]$job.Text, 16)
    }
} catch {
    $_.Exception.Message | Set-Content -LiteralPath "$JobFile.error" -Encoding UTF8
    exit 1
} finally { if ($speaker) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($speaker) } }
