// Metadata updates and seeking within a song must not restart its visibility window.
export function spotifyVisibility(previous, playback, config, now) {
  if (!playback) return {key:null, visible:false};
  const key = JSON.stringify([playback.source || 'spotify',playback.url || '',playback.title,playback.artist,playback.duration]);
  const changed = previous.key !== key;
  const since = changed || (config.songChangeOnly && !previous.songChangeOnly) ? now : previous.since;
  const pausedAt = playback.playing ? null : changed || previous.pausedAt == null ? now : previous.pausedAt;
  const pauseExpired = config.hideWhenPaused && pausedAt != null && now-pausedAt >= (config.hideDelay || 0)*1000;
  const songExpired = config.songChangeOnly && now-since >= (config.visibleDuration || 5)*1000;
  return {key,since,pausedAt,songChangeOnly:config.songChangeOnly,visible:!pauseExpired && !songExpired};
}
