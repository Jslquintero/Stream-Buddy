$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
function Await-WinRT($Operation, $ResultType) {
    $task = $script:asTask.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
    if (-not $task.Wait(4000)) { throw 'Windows media request timed out' }
    return $task.Result
}
function Get-MediaSessions {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
    $null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]
    $script:asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
    $manager = Await-WinRT ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
    return $manager.GetSessions()
}

function Read-SessionPlayback($session, $media, $status) {
    $timeline = $session.GetTimelineProperties()
    $image = ''
    if ($media.Thumbnail) {
        $stream = $null; $reader = $null
        try {
            $stream = Await-WinRT ($media.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
            $streamSize = [Windows.Storage.Streams.IRandomAccessStream].GetProperty('Size').GetValue($stream)
            $contentType = [Windows.Storage.Streams.IContentTypeProvider].GetProperty('ContentType').GetValue($stream)
            if ($streamSize -gt 0 -and $streamSize -le 524288 -and $contentType -in @('image/jpeg', 'image/png', 'image/webp')) {
                $inputStream = [Windows.Storage.Streams.IRandomAccessStream].GetMethod('GetInputStreamAt').Invoke($stream, @([uint64]0))
                $reader = [Windows.Storage.Streams.DataReader]::new($inputStream)
                $length = Await-WinRT ($reader.LoadAsync([uint32]$streamSize)) ([uint32])
                $bytes = New-Object byte[] $length
                $reader.ReadBytes($bytes)
                $image = 'data:' + $contentType + ';base64,' + [Convert]::ToBase64String($bytes)
            }
        } catch { $image = '' }
        finally {
            # WinRT streams are COM wrappers: invoke IDisposable through its interface.
            # A thumbnail cleanup failure must never discard the song metadata.
            foreach ($resource in @($reader, $stream)) {
                if ($resource) {
                    try { $null = [System.IDisposable].GetMethod('Dispose').Invoke($resource, $null) }
                    catch { }
                }
            }
        }
    }
    $duration = [Math]::Max(0, ($timeline.EndTime - $timeline.StartTime).TotalMilliseconds)
    $progress = [Math]::Max(0, ($timeline.Position - $timeline.StartTime).TotalMilliseconds)
    if ($status -eq 'Playing' -and $timeline.LastUpdatedTime) {
        $progress += [Math]::Max(0, ([DateTimeOffset]::Now - $timeline.LastUpdatedTime).TotalMilliseconds)
    }
    return @{ title = $media.Title; artist = $media.Artist; image = $image; duration = $duration; progress = [Math]::Min($duration, $progress); playing = ($status -eq 'Playing') }
}

try {
    $sessionError = $null
    $session = $null
    $media = $null
    $status = ''
    try {
        $sessions = @(Get-MediaSessions)
        $candidates = foreach ($item in $sessions) {
            try {
                $state = $item.GetPlaybackInfo().PlaybackStatus.ToString()
                if ($state -in @('Playing', 'Paused')) {
                    $spotify = $item.SourceAppUserModelId -match '^(Spotify\.exe|Spotify|SpotifyAB\.SpotifyMusic_[^!]+!Spotify)$'
                    [pscustomobject]@{ Session = $item; Status = $state; Spotify = $spotify; Playing = ($state -eq 'Playing') }
                }
            } catch { continue }
        }
        foreach ($candidate in ($candidates | Sort-Object Playing, Spotify -Descending)) {
            if (-not $candidate) { continue }
            try {
                $properties = Await-WinRT ($candidate.Session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
                if (![string]::IsNullOrWhiteSpace($properties.Title)) {
                    $session = $candidate.Session
                    $media = $properties
                    $status = $candidate.Status
                    $isSpotify = $candidate.Spotify
                    break
                }
            } catch { continue }
        }
    } catch { $sessionError = $_ }

    $hasSessionTrack = $media -and $media.Title
    $aimp = $null
    $aimpAvailable = $false
    if (-not ($hasSessionTrack -and $status -eq 'Playing')) {
        try {
            Add-Type -Path (Join-Path $PSScriptRoot 'aimp-now-playing.cs') -ReferencedAssemblies 'System.Windows.Forms.dll', 'System.Drawing.dll', 'System.Core.dll'
            $aimpAvailable = [AimpNowPlaying]::IsAvailable()
            if ($aimpAvailable) { $aimp = [AimpNowPlaying]::Read() }
        } catch {
            if (-not $session) { throw }
        }
    }

    $playback = $null
    if ($aimp -and ($aimp.Playing -or -not $hasSessionTrack)) {
        $image = ''
        try { $image = [AimpNowPlaying]::ReadAlbumArt($aimp) } catch { }
        $playback = @{ source = 'aimp'; title = $aimp.Title; artist = $aimp.Artist; image = $image; duration = $aimp.Duration; progress = $aimp.Progress; playing = $aimp.Playing }
    } elseif ($hasSessionTrack) {
        $playback = Read-SessionPlayback $session $media $status
        if (-not $isSpotify) { $playback.source = 'windows' }
    } elseif ($sessionError -and -not $aimpAvailable) {
        throw $sessionError
    }
    @{ available = [bool]($sessions.Count -or $aimpAvailable); playback = $playback } | ConvertTo-Json -Compress -Depth 4
} catch {
    @{ error = 'No se pudo leer la reproduccion multimedia de Windows.' } | ConvertTo-Json -Compress
    exit 1
}
