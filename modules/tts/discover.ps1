$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$speaker = New-Object -ComObject SAPI.SpVoice
try {
    $voices = @(); $outputs = @(); $warnings = @()
    try { foreach ($token in $speaker.GetVoices()) { $voices += @{ id=$token.Id; name=$token.GetDescription() } } }
    catch { $warnings += 'No se pudieron consultar las voces de Windows: ' + $_.Exception.Message }
    try { foreach ($token in $speaker.GetAudioOutputs()) { $outputs += @{ id=$token.Id; name=$token.GetDescription() } } }
    catch { $warnings += 'No se pudieron consultar las salidas de audio: ' + $_.Exception.Message }
    @{ voices=@($voices); devices=@($outputs); warnings=@($warnings) } | ConvertTo-Json -Depth 5 -Compress
} finally { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($speaker) }
