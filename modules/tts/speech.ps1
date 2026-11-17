param([string]$JobFile)
$ErrorActionPreference = 'Stop'
try {
    . "$PSScriptRoot\core.ps1"
    if ([string]::IsNullOrWhiteSpace($JobFile)) { throw 'No se recibio el archivo del mensaje de voz.' }
    $job = Get-Content -LiteralPath $JobFile -Raw -Encoding UTF8 | ConvertFrom-Json
    Assert-SpeechSettings $job
    $speaker = New-Object -ComObject SAPI.SpVoice
    if ($job.AudioDevice) {
        $output = @($speaker.GetAudioOutputs() | Where-Object { $_.Id -eq $job.AudioDevice }) | Select-Object -First 1
        if (-not $output) { throw 'La salida de audio seleccionada no esta disponible. Actualiza los dispositivos en el panel.' }
        $speaker.AudioOutput = $output
    }
    'Generando voz...' | Set-Content -LiteralPath "$JobFile.status" -Encoding UTF8
    if ($job.Engine -eq 'Piper') {
        if (-not (Test-Path -LiteralPath $job.PiperExe) -or -not (Test-Path -LiteralPath $job.Model)) { throw 'Revisa la ruta del ejecutable Piper y del modelo ONNX.' }
        $wav = "$JobFile.wav"
        if (Test-Path -LiteralPath $wav) { Remove-Item -LiteralPath $wav -Force }
        $info = New-Object Diagnostics.ProcessStartInfo
        $info.FileName = $job.PiperExe
        $scale = (1 / [double]$job.Speed).ToString([Globalization.CultureInfo]::InvariantCulture)
        $info.Arguments = '--model "' + $job.Model + '" --output_file "' + $wav + '" --length_scale ' + $scale
        if ($job.PiperConfig) { $info.Arguments += ' --config "' + $job.PiperConfig + '"' }
        if ($null -ne $job.Speaker) { $info.Arguments += ' --speaker ' + [int]$job.Speaker }
        $info.UseShellExecute = $false; $info.CreateNoWindow = $true
        $info.RedirectStandardInput = $true; $info.RedirectStandardError = $true
        $info.StandardErrorEncoding = [Text.UTF8Encoding]::new($false)
        $process = [Diagnostics.Process]::Start($info)
        $errorTask = $process.StandardError.ReadToEndAsync()
        $inputBytes = [Text.Encoding]::UTF8.GetBytes((Get-PiperText ([string]$job.Text)) + "`n")
        $process.StandardInput.BaseStream.Write($inputBytes, 0, $inputBytes.Length)
        $process.StandardInput.BaseStream.Flush()
        $process.StandardInput.Close()
        if (-not $process.WaitForExit(120000)) { $process.Kill(); throw 'Piper excedio el tiempo de generacion.' }
        if ($process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $wav)) { throw "Piper no pudo generar audio: $($errorTask.Result)" }
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
