import { useState } from 'react';
import { ExternalLink, Music2 } from 'lucide-react';
import { Badge, Button, Card, Input, Select, Tabs, TabsContent, TabsList, TabsTrigger } from './ui';
import { CopyLinkButton, OutputLinks } from './output-controls';
import { useNotificationSettings } from '../hooks/use-notification-settings';
import { appearanceDefaults, spotifySize, validateSpotifyConfig } from '../../../shared/spotify';
import { SpotifyCoverSettings, SpotifyDesignSettings } from './spotify-appearance';
import { SpotifyCssEditor } from './spotify-css-editor';
import { SpotifyPreview } from './spotify-playback';
import { SpotifyVisibilitySettings } from './spotify-visibility';
import './spotify-editor.css';
import './spotify-cover-finishes.css';

const spotifyStorage = {
  key: 'live-studio.spotify.pending.v1',
  validate: validateSpotifyConfig,
  migrate: value => value,
  action: 'spotify/save',
};

function sourceStatus(tool, online) {
  if (!online) return 'Estudio sin conexión';
  if (tool.connecting) return 'Esperando autorización';
  if (tool.error) return 'Error de conexión';
  if ((tool.config.mode || 'local') !== 'local') return tool.connected ? 'Cuenta conectada' : 'Cuenta sin conectar';
  if (tool.config.enabled === false) return 'Lectura detenida';
  if (tool.playback) return 'Reproducción detectada';
  return tool.connected ? 'Reproductor detectado' : 'Buscando un reproductor';
}

function SpotifySource({ tool, config, setDraft, online, api, notice, save, saving, dirty }) {
  const [action, setAction] = useState('');
  const local = (config.mode || 'local') === 'local';
  const sameSource = (tool.config.mode || 'local') === (config.mode || 'local');
  const sameAccount = sameSource && (tool.config.clientId || '') === (config.clientId || '');
  const canDisconnect = sameSource && (local ? tool.config.enabled !== false : tool.connected || tool.connecting);
  const disabled = !online || saving || Boolean(action);
  const redirect = window.location.origin + '/api/spotify/callback';

  async function run(nextAction) {
    setAction(nextAction);
    try {
      if ((nextAction === 'connect' || dirty) && !await save()) return;
      const result = await api('spotify/' + nextAction);
      if (result?.authorizationUrl) window.location.assign(result.authorizationUrl);
      else if (result && nextAction === 'connect' && local) notice('Lectura local activada. Reproduce una canción en tu navegador o reproductor.');
    } finally {
      setAction('');
    }
  }

  return <Card className="spotify-source">
    <details>
      <summary>
        <span className="spotify-disclosure"><span>Fuente de música</span>
          <Badge className={online && tool.connected && !tool.error ? 'success' : ''}>{sourceStatus(tool, online)}</Badge>
        </span>
      </summary>
      <div className="spotify-form">
        <label>Obtener la canción desde
          <Select value={config.mode || 'local'} disabled={Boolean(action)} onChange={event => {
            const mode = event.target.value;
            setDraft(previous => ({ ...previous, mode, enabled: true }));
          }}>
            <option value="local">Este PC · Navegador o reproductor</option>
            <option value="api">Cuenta de Spotify · Web API</option>
          </Select>
        </label>
        {local ? <p className="help spotify-local-help">Reproduce una canción en tu navegador o reproductor. También puedes usar Spotify o AIMP.</p> : <>
          <p className="help">Muestra lo que escuchas desde cualquier dispositivo de tu cuenta de Spotify.</p>
          <label>Client ID
            <Input value={config.clientId || ''} disabled={Boolean(action)} maxLength={32} autoComplete="off" spellCheck={false} placeholder="Client ID de tu app de Spotify" onChange={event => {
              const clientId = event.target.value.trim();
              setDraft(previous => ({ ...previous, clientId }));
            }}/>
          </label>
          <details className="spotify-guide">
            <summary>Cómo configurar la Web API</summary>
            <ol>
              <li>Crea una app con Web API en <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer">Spotify for Developers <ExternalLink size={12}/></a>.</li>
              <li>Añade esta dirección en Redirect URIs.
                <code>{redirect}</code>
                <CopyLinkButton url={redirect} notice={notice} size="sm">Copiar Redirect URI</CopyLinkButton>
              </li>
              <li>Pega el Client ID de la app y pulsa Conectar Spotify para autorizar la lectura.</li>
            </ol>
            <p className="help"><a href="https://developer.spotify.com/documentation/web-api/concepts/quota-modes" target="_blank" rel="noopener noreferrer">Consulta los requisitos de Premium y acceso a la app</a>.</p>
          </details>
        </>}
        <div className="actions">
          <Button disabled={disabled || (!local && !/^[a-f0-9]{32}$/i.test(config.clientId || ''))} onClick={() => run('connect')}>
            {action === 'connect' ? 'Preparando…' : local ? 'Activar lectura local' : sameAccount && tool.connected ? 'Volver a conectar' : 'Conectar Spotify'}
          </Button>
          <Button variant="outline" disabled={disabled || !canDisconnect} onClick={() => run('disconnect')}>
            {action === 'disconnect' ? 'Desconectando…' : local ? 'Detener lectura local' : 'Desconectar Spotify'}
          </Button>
        </div>
      </div>
    </details>
    {tool.error && <p className="spotify-error" role="alert">{tool.error}</p>}
  </Card>;
}

export function SpotifyStudio({ tool, api, notice, online }) {
  const { config: draft, setConfig: setDraft, dirty, saving, error, save } = useNotificationSettings(tool.config, undefined, api, online, spotifyStorage);
  const config = { ...appearanceDefaults, ...draft };
  const update = (key, value) => setDraft(previous => ({ ...previous, [key]: value }));
  const output = new URL(tool.url, window.location.origin).href;
  const [width, height] = spotifySize(config.playerStyle, config);
  const saveStatus = saving ? 'Guardando…' : dirty
    ? online ? 'Cambios pendientes' : 'Cambios conservados en este navegador'
    : 'Cambios guardados automáticamente';

  return <div className="spotify-studio">
    <header className="spotify-heading">
      <span className="spotify-heading-icon"><Music2 size={24} aria-hidden="true"/></span>
      <div><h1>Música en directo</h1><p className="muted">Muestra la canción, el artista y la carátula en tu transmisión.</p></div>
    </header>
    <SpotifySource {...{ tool, config, setDraft, online, api, notice, save, saving, dirty }}/>
    <div className="spotify-workspace">
      <Card className="spotify-preview-panel" aria-label="Vista previa y enlace de salida">
        <SpotifyPreview config={config} playback={online && tool.connected && !tool.error ? tool.playback : null} dimensions={`${width} × ${height} px`}/>
        <div className="spotify-broadcast">
          <h3>Enlace para el directo</h3>
          <p className="help">Pega el enlace en una fuente de navegador de OBS o TikTok LIVE Studio y usa las dimensiones de la vista previa.</p>
          <div className="actions"><OutputLinks url={output} notice={notice} iconSize={14}/></div>
          <details>
            <summary>Ver URL</summary>
            <code>{output}</code>
          </details>
        </div>
      </Card>
      <Card className="spotify-settings" aria-label="Ajustes del widget">
        <div className="spotify-settings-heading">
          <h2>Ajustes del widget</h2>
          <div className="spotify-save">
            <p role="status" className={error ? 'spotify-error' : 'help'}>{error || saveStatus}</p>
            {error && <Button variant="outline" size="sm" disabled={!online || saving} onClick={save}>Reintentar guardado</Button>}
          </div>
        </div>
        <Tabs defaultValue="design">
          <TabsList className="tabs-list spotify-tabs" aria-label="Ajustes de música">
            <TabsTrigger value="design">Diseño</TabsTrigger>
            <TabsTrigger value="cover">Carátula</TabsTrigger>
            <TabsTrigger value="visibility">Visibilidad</TabsTrigger>
            <TabsTrigger value="advanced">Avanzado</TabsTrigger>
          </TabsList>
          <TabsContent value="design"><SpotifyDesignSettings config={config} update={update}/></TabsContent>
          <TabsContent value="cover"><SpotifyCoverSettings config={config} update={update} notice={notice}/></TabsContent>
          <TabsContent value="visibility"><SpotifyVisibilitySettings config={config} update={update}/></TabsContent>
          <TabsContent value="advanced"><SpotifyCssEditor config={config} update={update}/></TabsContent>
        </Tabs>
      </Card>
    </div>
  </div>;
}
