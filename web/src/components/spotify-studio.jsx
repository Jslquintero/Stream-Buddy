import { CopyLinkButton, OutputLinks } from './output-controls';
import { useEffect, useRef, useState } from 'react';
import {ExternalLink, Music2 } from 'lucide-react';
import { Badge, Button, Card, Input, Select } from './ui';
import { useStudio } from '../hooks/use-studio';
import './spotify.css';
import './spotify-editor.css';
import './spotify-cover-finishes.css';
import { SpotifyAppearance, SpotifyVisual, SpotifyPresence, demoPlayback } from './spotify-appearance';
import { spotifySize, validateSpotifyConfig } from '../../../shared/spotify';
import { SpotifySurface } from './spotify-surface';
import { SpotifyVisibilitySettings } from './spotify-visibility';
import { spotifyVisibility } from '../../../shared/spotify-visibility';
import { useNotificationSettings } from '../hooks/use-notification-settings';

const spotifyStorage = {key:'live-studio.spotify.pending.v1', validate:validateSpotifyConfig, migrate:value=>value, action:'spotify/save'};

export function SpotifyStudio({ tool, api, notice, online }) {
  const {config:draft, setConfig:setDraft, dirty, saving, error:saveError, save} = useNotificationSettings(tool.config, undefined, api, online, spotifyStorage);
  const [busy, setBusy] = useState(false);
  const [previewKey, setPreviewKey] = useState(0), [previewVisible, setPreviewVisible] = useState(true);
  const dimensions = spotifySize(draft.playerStyle, draft);
  const local = (draft.mode || 'local') === 'local';
  const output = new URL(tool.url, window.location.origin).href;
  const redirect = window.location.origin + '/api/spotify/callback';
  const connect = async () => {
    setBusy(true);
    try {
      if (!await save()) return;
      const result = await api('spotify/connect');
      if (result?.authorizationUrl) window.location.assign(result.authorizationUrl);
      else if (result) notice('Lectura local activada. Abre Spotify de escritorio y reproduce una canción.');
    } finally { setBusy(false); }
  };
  return <div className="spotify-studio">
    <Card className="spotify-settings">
      <div className="section-heading"><h2>Spotify</h2><Badge className={tool.connected ? 'success' : ''}>{tool.connecting ? 'Esperando autorización' : tool.connected ? tool.config.mode === 'local' ? 'Spotify detectado' : 'Cuenta conectada' : tool.config.mode === 'local' ? tool.config.enabled ? 'Esperando Spotify' : 'Lectura detenida' : 'Sin conectar'}</Badge></div>
      <label>Cómo obtener la canción<Select value={draft.mode || 'local'} onChange={e => setDraft({ ...draft, mode: e.target.value, enabled: true })}><option value="local">Desde Windows · sin Premium</option><option value="api">Cuenta de Spotify · API oficial</option></Select></label>
      {local ? <div className="spotify-local-help"><h3>Escucha en este PC</h3><p className="muted">Abre la aplicación de escritorio de Spotify y reproduce una canción. Live Studio lee automáticamente la información que Spotify comparte con Windows.</p><p className="help">No necesitas Premium, Client ID ni iniciar sesión aquí. Mantén Spotify abierto en este equipo. Este modo no lee Spotify Web ni la reproducción únicamente en tu móvil. La carátula y el progreso dependen de lo que entregue Spotify a Windows.</p></div> : <>
      <p className="muted">Muestra lo que escuchas en Spotify desde cualquier dispositivo de tu cuenta.</p>
      <details open={!tool.connected}>
        <summary>Configuración inicial</summary>
        <ol>
          <li>Abre <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer">Spotify for Developers <ExternalLink size={12}/></a> y crea una app con Web API.</li>
          <li>En Redirect URIs, añade exactamente este enlace:<code>{redirect}</code><CopyLinkButton url={redirect} notice={notice} size="sm">Copiar Redirect URI</CopyLinkButton></li>
          <li>Copia el Client ID, pégalo abajo y pulsa Conectar Spotify. Autoriza la lectura de lo que estás escuchando.</li>
        </ol>
        <p className="help">Spotify exige Premium al propietario de una app en modo desarrollo. Si usas otra cuenta, añádela en Usuarios y acceso de la app. <a href="https://developer.spotify.com/documentation/web-api/concepts/quota-modes" target="_blank" rel="noopener noreferrer">Ver requisitos de Spotify</a>.</p>
      </details>
      <label>Client ID<Input value={draft.clientId} maxLength={32} autoComplete="off" spellCheck={false} placeholder="Client ID de tu app de Spotify" onChange={e => setDraft({ ...draft, clientId: e.target.value.trim() })}/></label>
      <p className="help">Solo necesitas el Client ID. La sesión se conserva localmente en este equipo.</p>
      </>}
      <div className="actions"><Button disabled={!online || busy || saving || (!local && !draft.clientId)} onClick={connect}>{busy ? 'Preparando…' : local ? 'Activar lectura local' : tool.connected ? 'Volver a conectar' : 'Conectar Spotify'}</Button><Button variant="outline" disabled={!online || busy || saving || (tool.config.mode === 'local' ? !tool.config.enabled : !tool.connected && !tool.connecting)} onClick={async () => { if (dirty && !await save()) return; await api('spotify/disconnect'); }}>{tool.config.mode === 'local' ? 'Detener lectura local' : 'Desconectar Spotify'}</Button></div>
      {tool.error && <p className="spotify-error" role="alert">{tool.error}</p>}
      <hr/>
      <h2>Diseño de la salida</h2>
      <p className="help">Autoguardado activo para diseño, carátula, brillo, fondo, colores, animaciones y CSS.</p>
      <p role="status" className={saveError ? 'spotify-error' : 'help'}>{saveError || (saving ? 'Guardando automáticamente…' : dirty ? online ? 'Cambios pendientes de guardar…' : 'Sin conexión. Cambios conservados en este navegador.' : 'Todos los cambios guardados automáticamente.')}</p>
      {saveError && <Button variant="outline" disabled={!online || busy || saving} onClick={save}>Reintentar guardado</Button>}
      <SpotifyAppearance draft={draft} setDraft={setDraft} notice={notice}/>
      <SpotifyVisibilitySettings draft={draft} setDraft={setDraft}/>
    </Card>
    <Card className="spotify-preview-panel">
      <div className="section-heading"><h2>Ahora escuchando</h2><Music2 size={20}/></div>
      <div className="spotify-preview"><SpotifySurface config={draft} preview><SpotifyPresence key={previewKey} playback={previewVisible ? (online && tool.playback ? tool.playback : demoPlayback) : null} config={draft}/></SpotifySurface></div>
      <div className="actions"><Button variant="outline" onClick={() => { setPreviewVisible(true); setPreviewKey(k => k + 1); }}>Probar entrada</Button><Button variant="outline" onClick={() => setPreviewVisible(false)}>Probar salida</Button></div>
      <p className="help">La vista previa usa una canción de ejemplo si no hay música. Cada cambio se guarda automáticamente y se aplica al directo.</p>
      <h3>En tu directo</h3>
      <p className="muted">Añade una fuente de navegador en LIVE Studio u OBS de <strong>{dimensions[0]} × {dimensions[1]} px</strong> y pega este enlace. El fondo es transparente.</p>
      <code>{output}</code>
      <div className="actions"><OutputLinks url={output} notice={notice} copyLabel="Copiar salida de Spotify" openLabel="Ver salida de Spotify" iconSize={15}/></div>
      <p className="help">Muestra la información de la canción; el audio sigue reproduciéndose en Spotify.</p>
    </Card>
  </div>;
}

export function SpotifyCard(props) { return <SpotifyVisual {...props}/>; }

export function SpotifyOutput() {
  const { state, online } = useStudio();
  const tool = state?.tools.spotify;
  const visibility = useRef({key:null});
  const [,tick] = useState(0);
  useEffect(()=>{const timer=setInterval(()=>tick(n=>n+1),200);return()=>clearInterval(timer);},[]);
  useEffect(() => { document.documentElement.classList.add('spotify-output'); return () => document.documentElement.classList.remove('spotify-output'); }, []);
  const available = online && tool?.connected && !tool.error;
  visibility.current = spotifyVisibility(visibility.current, available ? tool.playback : null, tool?.config || {}, Date.now());
  const playback = visibility.current.visible ? tool.playback : null;
  const idle = available && !tool.playback && !tool.config.songChangeOnly && tool.config.idleCover ? { ...demoPlayback, title:'Nada reproduciéndose', artist:'', playing:false, progress:0, image:tool.config.idleCover, idle:true } : null;
  const size = spotifySize(tool?.config.playerStyle, tool?.config);
  return <div className="spotify-stage" style={{width:size[0],height:size[1],padding:0}}><SpotifySurface config={tool?.config}>{online && tool?.connected && !tool.error && <SpotifyPresence playback={playback || idle} config={tool?.config || {}}/>}</SpotifySurface></div>;
}
