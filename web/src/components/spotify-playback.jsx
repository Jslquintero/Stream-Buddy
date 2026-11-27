import { useEffect, useRef, useState } from 'react';
import { Play, Square } from 'lucide-react';
import { Badge, Button } from './ui';
import { useStudio } from '../hooks/use-studio';
import { spotifySize } from '../../../shared/spotify';
import { spotifyVisibility } from '../../../shared/spotify-visibility';
import { SpotifyPresence, demoPlayback } from './spotify-visual';
import { SpotifySurface } from './spotify-surface';
import './spotify-output.css';

export function SpotifyPreview({ config, playback, dimensions }) {
  const [entry, setEntry] = useState(() => ({ key: 0, time: Date.now() }));
  const [visible, setVisible] = useState(true);
  const sample = { ...demoPlayback, updatedAt: entry.time };

  function replayEntry() {
    setEntry(previous => ({ key: previous.key + 1, time: Date.now() }));
    setVisible(true);
  }

  return <div className="spotify-preview-content">
    <div className="spotify-preview-heading">
      <h2>Vista previa</h2>
      <span className="spotify-dimensions">{dimensions}</span>
    </div>
    <div className="spotify-preview">
      <SpotifySurface config={config} preview>
        <SpotifyPresence key={entry.key} playback={visible ? playback || sample : null} config={config}/>
      </SpotifySurface>
    </div>
    <div className="spotify-preview-controls">
      <div className="actions">
        <Button size="sm" variant="outline" onClick={replayEntry}><Play size={14} aria-hidden="true"/>Probar entrada</Button>
        <Button size="sm" variant="outline" disabled={!visible} onClick={() => setVisible(false)}><Square size={14} aria-hidden="true"/>Probar salida</Button>
      </div>
      <Badge role="status">{!visible ? 'Vista previa oculta' : playback ? 'Reproducción detectada' : 'Canción de ejemplo'}</Badge>
    </div>
  </div>;
}

export function SpotifyOutput() {
  const { state, online } = useStudio('spotify');
  const tool = state?.tools.spotify;
  const visibility = useRef({ key: null });
  const [, tick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => tick(count => count + 1), 200);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    document.documentElement.classList.add('spotify-output');
    return () => document.documentElement.classList.remove('spotify-output');
  }, []);

  const available = online && tool?.connected && !tool.error;
  const config = tool?.config || {};
  const track = available ? tool.playback : null;
  visibility.current = spotifyVisibility(visibility.current, track, config, Date.now());
  const idle = available && !track && !config.songChangeOnly && config.idleCover
    ? { ...demoPlayback, title: 'Nada reproduciéndose', artist: '', playing: false, progress: 0, image: config.idleCover, idle: true }
    : null;
  const playback = visibility.current.visible ? track : idle;
  const [width, height] = spotifySize(config.playerStyle, config);

  return <div className="spotify-stage" style={{ width, height }}>
    <SpotifySurface config={config}>
      {available && <SpotifyPresence playback={playback} config={config}/>}
    </SpotifySurface>
  </div>;
}
