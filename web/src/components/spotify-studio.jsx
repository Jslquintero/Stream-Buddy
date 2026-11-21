import { useEffect, useState } from 'react';
import { Copy, ExternalLink, Music2 } from 'lucide-react';
import { Badge, Button, Card, Input } from './ui';
import { useStudio } from '../hooks/use-studio';
import './spotify.css';

export function SpotifyStudio({ tool, api, notice, online }) {
  const [draft, setDraft] = useState(tool.config), [busy, setBusy] = useState(false);
  const local = (draft.mode || 'local') === 'local';
  const output = new URL(tool.url, window.location.origin).href;
  const redirect = window.location.origin + '/api/spotify/callback';
  const save = async () => {
    setBusy(true);
    try { const ok = await api('spotify/save', draft); if (ok) notice('Ajustes de Spotify guardados.'); return ok; }
    finally { setBusy(false); }
  };
  const connect = async () => {
    setBusy(true);
    try {
      if (!await api('spotify/save', draft)) return;
      const result = await api('spotify/connect');
      if (result?.authorizationUrl) window.location.assign(result.authorizationUrl);
      else if (result) notice('Lectura local activada. Abre Spotify de escritorio y reproduce una canción.');
    } finally { setBusy(false); }
  };
  const copy = async text => { try { await navigator.clipboard.writeText(text); notice('Enlace copiado.'); } catch { notice('Enlace: ' + text); } };
  return <div className="spotify-studio">
    <Card className="spotify-settings">
      <div className="section-heading"><h2>Spotify</h2><Badge className={tool.connected ? 'success' : ''}>{tool.connecting ? 'Esperando autorización' : tool.connected ? tool.config.mode === 'local' ? 'Spotify detectado' : 'Cuenta conectada' : tool.config.mode === 'local' ? tool.config.enabled ? 'Esperando Spotify' : 'Lectura detenida' : 'Sin conectar'}</Badge></div>
      <label>Cómo obtener la canción<select className="input" value={draft.mode || 'local'} onChange={e => setDraft({ ...draft, mode: e.target.value, enabled: true })}><option value="local">Desde Windows · sin Premium</option><option value="api">Cuenta de Spotify · API oficial</option></select></label>
      {local ? <div className="spotify-local-help"><h3>Escucha en este PC</h3><p className="muted">Abre la aplicación de escritorio de Spotify y reproduce una canción. Live Studio lee automáticamente la información que Spotify comparte con Windows.</p><p className="help">No necesitas Premium, Client ID ni iniciar sesión aquí. Mantén Spotify abierto en este equipo. Este modo no lee Spotify Web ni la reproducción únicamente en tu móvil. La carátula y el progreso dependen de lo que entregue Spotify a Windows.</p></div> : <>
      <p className="muted">Muestra lo que escuchas en Spotify desde cualquier dispositivo de tu cuenta.</p>
      <details open={!tool.connected}>
        <summary>Configuración inicial</summary>
        <ol>
          <li>Abre <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer">Spotify for Developers <ExternalLink size={12}/></a> y crea una app con Web API.</li>
          <li>En Redirect URIs, añade exactamente este enlace:<code>{redirect}</code><Button variant="outline" size="sm" onClick={() => copy(redirect)}>Copiar Redirect URI</Button></li>
          <li>Copia el Client ID, pégalo abajo y pulsa Conectar Spotify. Autoriza la lectura de lo que estás escuchando.</li>
        </ol>
        <p className="help">Spotify exige Premium al propietario de una app en modo desarrollo. Si usas otra cuenta, añádela en Usuarios y acceso de la app. <a href="https://developer.spotify.com/documentation/web-api/concepts/quota-modes" target="_blank" rel="noopener noreferrer">Ver requisitos de Spotify</a>.</p>
      </details>
      <label>Client ID<Input value={draft.clientId} maxLength={32} autoComplete="off" spellCheck={false} placeholder="Client ID de tu app de Spotify" onChange={e => setDraft({ ...draft, clientId: e.target.value.trim() })}/></label>
      <p className="help">Solo necesitas el Client ID. La sesión se conserva localmente en este equipo.</p>
      </>}
      <div className="actions"><Button disabled={!online || busy || (!local && !draft.clientId)} onClick={connect}>{busy ? 'Preparando…' : local ? 'Activar lectura local' : tool.connected ? 'Volver a conectar' : 'Conectar Spotify'}</Button><Button variant="outline" disabled={!online || busy || (tool.config.mode === 'local' ? !tool.config.enabled : !tool.connected && !tool.connecting)} onClick={() => api('spotify/disconnect')}>{tool.config.mode === 'local' ? 'Detener lectura local' : 'Desconectar Spotify'}</Button></div>
      {tool.error && <p className="spotify-error" role="alert">{tool.error}</p>}
      <hr/>
      <h2>Diseño de la salida</h2>
      <label>Estilo<select className="input" value={draft.theme} onChange={e => setDraft({ ...draft, theme: e.target.value })}><option value="dark">Oscuro</option><option value="light">Claro</option></select></label>
      <label className="spotify-check"><input type="checkbox" checked={draft.hideWhenPaused} onChange={e => setDraft({ ...draft, hideWhenPaused: e.target.checked })}/>Ocultar cuando la música esté pausada</label>
      <Button variant="outline" disabled={!online || busy} onClick={save}>Guardar ajustes de Spotify</Button>
    </Card>
    <Card className="spotify-preview-panel">
      <div className="section-heading"><h2>Ahora escuchando</h2><Music2 size={20}/></div>
      <div className="spotify-preview"><SpotifyCard playback={online ? tool.playback : null} theme={draft.theme}/>{(!online || !tool.playback) && <div className="spotify-empty"><Music2 size={36}/><p>{!online ? 'Esperando conexión con Live Studio.' : tool.config.mode === 'local' ? tool.config.enabled ? 'Abre Spotify de escritorio en este PC y reproduce una canción.' : 'Activa la lectura local para mostrar tu canción.' : tool.connected ? 'Reproduce una canción en Spotify para verla aquí.' : 'Conecta Spotify para ver tu canción aquí.'}</p></div>}</div>
      <p className="help">La vista previa muestra también las canciones pausadas. La salida aplica los ajustes guardados y se oculta si no hay una canción disponible.</p>
      <h3>En tu directo</h3>
      <p className="muted">Añade una fuente de navegador en LIVE Studio u OBS de <strong>600 × 160 px</strong> y pega este enlace. El fondo es transparente.</p>
      <code>{output}</code>
      <div className="actions"><Button variant="outline" onClick={() => copy(output)}><Copy size={15}/>Copiar salida de Spotify</Button><Button variant="outline" asChild><a href={output} target="_blank" rel="noopener noreferrer">Ver salida de Spotify<ExternalLink size={15}/></a></Button></div>
      <p className="help">Muestra la información de la canción; el audio sigue reproduciéndose en Spotify.</p>
    </Card>
  </div>;
}

export function SpotifyCard({ playback, theme = 'dark' }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  if (!playback) return null;
  const progress = Math.min(playback.duration, playback.progress + (playback.playing ? Math.max(0, now - playback.updatedAt) : 0));
  return <article className={'spotify-now spotify-' + theme}>
    {playback.image ? <img className="spotify-cover" src={playback.image} alt="Carátula del álbum"/> : <div className="spotify-cover spotify-placeholder"><Music2 size={38}/></div>}
    <div className="spotify-track"><span className="spotify-brand">Spotify <span>· {playback.playing ? 'ESCUCHANDO AHORA' : 'EN PAUSA'}</span></span><a className="spotify-title" href={playback.url || 'https://open.spotify.com'} target="_blank" rel="noopener noreferrer">{playback.title}</a><p className="spotify-artist">{playback.artist}</p><div className="spotify-progress" role="progressbar" aria-label="Progreso de la canción" aria-valuemin={0} aria-valuemax={playback.duration} aria-valuenow={progress}><span style={{ width: `${playback.duration ? progress / playback.duration * 100 : 0}%` }}/></div></div>
  </article>;
}

export function SpotifyOutput() {
  const { state, online } = useStudio();
  const tool = state?.tools.spotify;
  useEffect(() => { document.documentElement.classList.add('spotify-output'); return () => document.documentElement.classList.remove('spotify-output'); }, []);
  const playback = online && tool?.connected && !tool.error && (tool.playback?.playing || !tool.config.hideWhenPaused) ? tool.playback : null;
  return <div className="spotify-stage"><SpotifyCard playback={playback} theme={tool?.config.theme}/></div>;
}
