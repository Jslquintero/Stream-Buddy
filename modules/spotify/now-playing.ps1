$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
function Await-WinRT($Operation, $ResultType) {
    $task = $script:asTask.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
    if (-not $task.Wait(4000)) { throw 'Windows media request timed out' }
    return $task.Result
}
function Read-SpotifySession {
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
    $null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]
    $script:asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
    $manager = Await-WinRT ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
    # Only the Spotify desktop app; never capture an unrelated browser/video session.
    $sessions = @($manager.GetSessions() | Where-Object { $_.SourceAppUserModelId -match '^(Spotify\.exe|Spotify|SpotifyAB\.SpotifyMusic_[^!]+!Spotify)$' })
    return $sessions | Sort-Object { if ($_.GetPlaybackInfo().PlaybackStatus.ToString() -eq 'Playing') { 0 } else { 1 } } | Select-Object -First 1
}

function Read-SpotifyPlayback($session, $media, $status) {
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
    $spotifyError = $null
    $session = $null
    $media = $null
    $status = ''
    try {
        $session = Read-SpotifySession
        if ($session) {
            $status = $session.GetPlaybackInfo().PlaybackStatus.ToString()
            if ($status -in @('Playing', 'Paused')) {
                $media = Await-WinRT ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
            }
        }
    } catch { $spotifyError = $_ }

    $hasSpotifyTrack = $media -and $media.Title
    $aimp = $null
    $aimpAvailable = $false
    if (-not ($hasSpotifyTrack -and $status -eq 'Playing')) {
        try {
            Add-Type -Path (Join-Path $PSScriptRoot 'aimp-now-playing.cs') -ReferencedAssemblies 'System.Windows.Forms.dll', 'System.Drawing.dll', 'System.Core.dll'
            $aimpAvailable = [AimpNowPlaying]::IsAvailable()
            if ($aimpAvailable) { $aimp = [AimpNowPlaying]::Read() }
        } catch {
            if (-not $session) { throw }
        }
    }

    $playback = $null
    if ($aimp -and ($aimp.Playing -or -not $hasSpotifyTrack)) {
        $image = ''
        try { $image = [AimpNowPlaying]::ReadAlbumArt($aimp) } catch { }
        $playback = @{ source = 'aimp'; title = $aimp.Title; artist = $aimp.Artist; image = $image; duration = $aimp.Duration; progress = $aimp.Progress; playing = $aimp.Playing }
    } elseif ($hasSpotifyTrack) {
        $playback = Read-SpotifyPlayback $session $media $status
    } elseif ($spotifyError -and -not $aimpAvailable) {
        throw $spotifyError
    }
    @{ available = [bool]($session -or $aimpAvailable); playback = $playback } | ConvertTo-Json -Compress -Depth 4
} catch {
    @{ error = 'No se pudo leer la reproduccion local de Spotify o AIMP.' } | ConvertTo-Json -Compress
    exit 1
}
