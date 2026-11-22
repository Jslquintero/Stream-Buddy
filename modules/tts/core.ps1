function Get-MessageText {
    param([string]$Text, [string]$Command, [bool]$ReadAll, [int]$MaxLength, [string[]]$Blocked)
    $value = $Text.Trim()
    $matched = $false
    if (-not [string]::IsNullOrWhiteSpace($Command) -and $value.StartsWith($Command, [StringComparison]::OrdinalIgnoreCase)) {
        # Symbol prefixes such as ! can touch the text; named commands keep a word boundary.
        $matched = $Command -match '^[^\p{L}\p{N}\s]+$' -or $value.Length -eq $Command.Length -or [char]::IsWhiteSpace($value[$Command.Length])
    }
    if (-not $ReadAll -and -not $matched) { return $null }
    if ($matched) {
        $value = $value.Substring($Command.Length).Trim()
    }
    if (-not $value -or $value.Length -gt $MaxLength -or $value -match '(?i)(https?://|www\.)') { return $null }
    foreach ($word in $Blocked) {
        if ($word.Trim() -and $value.IndexOf($word.Trim(), [StringComparison]::OrdinalIgnoreCase) -ge 0) { return $null }
    }
    return $value
}

function Quote-NativeArgument([string]$Value) {
    # Windows native arguments escape quotes and double trailing backslashes.
    '"' + ($Value -replace '(\\*)"', '$1$1\"' -replace '(\\+)$', '$1$1') + '"'
}

function Invoke-PocketSpeech {
    param([string]$Executable, [string]$Voice = 'lola', [string]$Text, [string]$Wav)
    if (Test-Path -LiteralPath $Wav) { Remove-Item -LiteralPath $Wav -Force }
    $info = New-Object Diagnostics.ProcessStartInfo
    $info.FileName = $Executable
    $info.Arguments = 'generate --quiet --language spanish ' +
        (Quote-NativeArgument "--voice=$Voice") + ' ' +
        (Quote-NativeArgument "--text=$Text") + ' ' +
        (Quote-NativeArgument "--output-path=$Wav")
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardError = $true
    $info.StandardErrorEncoding = [Text.UTF8Encoding]::new($false)
    $process = [Diagnostics.Process]::Start($info)
    try {
        $errorTask = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(120000)) { $process.Kill(); throw 'Pocket TTS excedio el tiempo de generacion.' }
        if ($process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $Wav -PathType Leaf)) {
            throw "Pocket TTS no pudo generar audio: $($errorTask.Result)"
        }
    } finally {
        $process.Dispose()
    }
}

function Add-WavPlaybackPadding {
    param([string]$Path, [int]$Volume = 100)
    $bytes = [IO.File]::ReadAllBytes($Path)
    $dataOffset = -1; $byteRate = 0; $alignment = 0; $bits = 0; $format = 0
    if ($bytes.Length -lt 44 -or [Text.Encoding]::ASCII.GetString($bytes,0,4) -ne 'RIFF' -or [Text.Encoding]::ASCII.GetString($bytes,8,4) -ne 'WAVE') { throw 'El audio generado no es un WAV valido.' }
    $offset = 12
    while ($offset + 8 -le $bytes.Length) {
        $tag = [Text.Encoding]::ASCII.GetString($bytes,$offset,4)
        $length = [BitConverter]::ToUInt32($bytes,$offset+4)
        if ($offset + 8L + $length -gt $bytes.Length) { throw 'El WAV esta incompleto.' }
        if ($tag -eq 'fmt ' -and $length -ge 16) {
            $format = [BitConverter]::ToUInt16($bytes,$offset+8)
            $byteRate = [BitConverter]::ToUInt32($bytes,$offset+16)
            $alignment = [BitConverter]::ToUInt16($bytes,$offset+20)
            $bits = [BitConverter]::ToUInt16($bytes,$offset+22)
        }
        if ($tag -eq 'data') { $dataOffset=$offset; $dataLength=[int]$length; break }
        $offset += 8 + $length + ($length % 2)
    }
    if ($dataOffset -lt 0 -or $format -ne 1 -or $bits -ne 16 -or $alignment -le 0) { throw 'Se esperaba un WAV PCM de 16 bits.' }
    $gain = [Math]::Max(0, [Math]::Min(100, $Volume)) / 100.0
    if ($gain -lt 1) {
        for ($i = $dataOffset + 8; $i + 1 -lt $dataOffset + 8 + $dataLength; $i += 2) {
            $sample = [int16]([BitConverter]::ToInt16($bytes,$i) * $gain)
            $sampleBytes = [BitConverter]::GetBytes($sample)
            $bytes[$i] = $sampleBytes[0]; $bytes[$i+1] = $sampleBytes[1]
        }
    }
    $lead = [int]([Math]::Ceiling($byteRate * 0.35 / $alignment) * $alignment)
    $tail = [int]([Math]::Ceiling($byteRate * 0.12 / $alignment) * $alignment)
    $padded = New-Object byte[] ($bytes.Length + $lead + $tail)
    [Buffer]::BlockCopy($bytes,0,$padded,0,$dataOffset+8)
    [Buffer]::BlockCopy($bytes,$dataOffset+8,$padded,$dataOffset+8+$lead,$dataLength)
    $after = $dataOffset + 8 + $dataLength
    [Buffer]::BlockCopy($bytes,$after,$padded,$after+$lead+$tail,$bytes.Length-$after)
    [Buffer]::BlockCopy([BitConverter]::GetBytes([uint32]($padded.Length-8)),0,$padded,4,4)
    [Buffer]::BlockCopy([BitConverter]::GetBytes([uint32]($dataLength+$lead+$tail)),0,$padded,$dataOffset+4,4)
    [IO.File]::WriteAllBytes($Path,$padded)
}
