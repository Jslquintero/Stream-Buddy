import { boardStyle } from '../lib/widget-css';
import { WidgetCssEditor } from './css-reference';
import { downloadFile } from '../lib/download-file';
import { DownloadButton } from './ui/download-button';
import { OutputLinks, OutputToolbar } from './output-controls';
import { createPortal } from 'react-dom';
import boardCSS from './auction.css?raw';
import { validateThemeCSS } from '../../../shared/custom-themes';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Crown, Gavel, Play, RotateCcw, SkipForward, Square, Timer, Trophy } from 'lucide-react';
import { Badge, Button, Card, Input, Select } from './ui';
import { Field, NumberSettings, OverlayColors, Toggle } from './fields';
import { useStudio } from '../hooks/use-studio';
import { useNotificationSettings } from '../hooks/use-notification-settings';
import { defaultAuction, validateAuction, auctionOutputPath, safeAvatar, auctionStyles, auctionPresets } from '../../../modules/auction/config';
import './auction.css';
import { EditorViewSwitch } from './editor-view-switch';
import { AutoFitPreview } from './auto-fit-preview';
import './editor-workspace.css';
import './auction-editor.css';
import { AuctionAmount, useAuctionClock, useAuctionMotion, useAuctionDemo } from './auction-motion';

const storage = { key: 'live-studio.auction.pending.v1', validate: validateAuction, migrate: validateAuction, action: 'auction/save' };
const sample = [
  { id: 'a', name: 'María', diamonds: 2500, gifts: 6 },
  { id: 'b', name: 'Carlos', diamonds: 1800, gifts: 4 },
  { id: 'c', name: 'Ana', diamonds: 950, gifts: 3 },
  { id: 'd', name: 'José', diamonds: 830, gifts: 2 },
  { id: 'e', name: 'Sofía', diamonds: 420, gifts: 1 },
];
const statusText = { idle: 'Sin iniciar', live: 'En vivo', ended: 'Cerrada' };
const number = value => Number(value || 0).toLocaleString('es');

function AuctionAvatar({ user }) {
  const [failed, setFailed] = useState('');
  const src = safeAvatar(user.avatar);
  return <span className="auction-avatar">{src && failed !== src ? <img src={src} alt={'Foto de ' + user.name} referrerPolicy="no-referrer" onError={() => setFailed(src)}/> : <span aria-label={'Sin foto de ' + user.name}>{Array.from(user.name || '?')[0].toUpperCase()}</span>}</span>;
}

function AuctionCSSSurface({ css, children }) {
  const host = useRef(null), [root, setRoot] = useState(null);
  useLayoutEffect(() => setRoot(host.current.shadowRoot || host.current.attachShadow({ mode: 'open' })), []);
  return <div className="auction-css-surface" ref={host}>{root && createPortal(<><style>{boardCSS}</style><style>{css}</style>{children}</>, root)}</div>;
}

export function AuctionBoard(props) {
  const config = { ...defaultAuction, ...props.config };
  let css = ''; try { if (config.cssEnabled) css = validateThemeCSS(config.customCss); } catch {}
  const board = <AuctionBoardContent {...props} config={config}/>;
  return css ? <AuctionCSSSurface css={css}>{board}</AuctionCSSSurface> : board;
}

function AuctionBoardContent({ config, ranking = [], total = 0, participants = 0, leader, winner, status = 'idle', round = 0, itemTitle, endsAt, preview = false }) {
  const clock = useAuctionClock(status, endsAt);
  const list = useAuctionMotion(JSON.stringify([config.enabled, config.limit, config.width, config.fontSize, config.style, status, round, ranking.map(user => [user.id, user.name, user.diamonds])]));
  if (!config.enabled && !preview) return null;
  const rows = ranking.slice(0, config.limit), top = leader || rows[0] || null;
  return <section className={'auction-board auction-style-' + config.style + (config.rgbNames ? ' auction-rgb-names' : '') + (config.pulseLeader ? ' auction-pulse-leader' : '')} aria-label="Subasta en directo"
    style={boardStyle('auction', config)}>
    {config.showTitle && <header className="auction-head">
      <Gavel aria-hidden="true"/>
      <div><strong className="auction-title">{config.title}</strong><span className="auction-round">{round > 0 ? 'Ronda ' + round : 'Subasta'}</span></div>
      <span className={'auction-status auction-status-' + status}>{statusText[status]}</span>
    </header>}
    {config.showItem && <div className="auction-lot"><span className="auction-lot-label">{round > 0 ? 'Lote ' + round : 'Lote'}</span><strong className="auction-lot-name">{itemTitle || config.itemTitle}</strong></div>}
    <div className={'auction-current' + (top ? ' has-leader' : '')}>
      {top && <Crown className="auction-current-crown" role="img" aria-label="Mejor puja"/>}
      {top ? <>
        <AuctionAvatar user={top}/>
        <span><span className="auction-current-label">Mejor puja</span><strong className="auction-winner">{top.name}</strong></span>
        <strong className="auction-value"><AuctionAmount value={top.diamonds}/><small>◆</small></strong>
      </> : <p className="auction-empty">{status === 'ended' ? 'La subasta terminó sin pujas.' : 'Esperando la primera puja…'}</p>}
    </div>
    {config.showTimer && <div className={'auction-clock' + (clock.over ? ' is-over' : '')}>
      <Timer aria-hidden="true"/><span>{status === 'live' ? 'Tiempo restante' : status === 'ended' ? 'Subasta cerrada' : 'Inicia la subasta'}</span><strong>{clock.label}</strong>
    </div>}
    {status === 'ended' && winner && <p className="auction-sold"><Trophy aria-hidden="true"/>Gana {winner.name} con {number(winner.diamonds)} ◆</p>}
    {config.showRanking && rows.length > 0 && <ol ref={list}>{rows.map((user, index) => <li key={user.id} data-user-id={user.id} className={index === 0 ? 'is-leader' : ''}>
      <span className="auction-rank">{index + 1}</span>
      <AuctionAvatar user={user}/>
      <span className="auction-name">{user.name}</span>
      <strong className="auction-bid">{number(user.diamonds)} ◆</strong>
    </li>)}</ol>}
    {config.showTotal && <footer className="auction-total">{number(total)} diamantes · {number(participants)} pujas</footer>}
  </section>;
}

export function AuctionOutput() {
  const { state, online } = useStudio('auction');
  const tool = state?.tools?.auction;
  useEffect(() => { document.documentElement.classList.add('auction-output'); document.documentElement.style.colorScheme = 'normal'; return () => { document.documentElement.classList.remove('auction-output'); document.documentElement.style.removeProperty('color-scheme'); }; }, []);
  return <div className={'auction-stage ' + (tool?.config?.position || 'top-right')}>{online && tool && <AuctionBoard {...tool}/>}</div>;
}

export function AuctionStudio({ tool, api, notice, online, connected }) {
  const { config, setConfig, dirty, saving, error } = useNotificationSettings(tool.config, tool.revision, api, online, storage);
  const [demo, setDemo] = useState(false), [reset, setReset] = useState(false), [mobileView, setMobileView] = useState('editor');
  const demoRows = useAuctionDemo(demo, sample);
  const [previewEndsAt, setPreviewEndsAt] = useState(0);
  useEffect(() => {
    if (demo) setPreviewEndsAt(Number(config.duration) > 0 ? Date.now() + Number(config.duration) * 1000 : 0);
  }, [demo, config.duration]);
  const demoTotal = demoRows.reduce((sum, row) => sum + Number(row.diamonds || 0), 0);
  const status = tool.status || 'idle';
  const update = (key, value) => setConfig(current => ({ ...current, [key]: value }));
  const act = async (action, message) => { if (await api(action)) notice(message); };
  const url = new URL(auctionOutputPath, location.origin).href;
  const ranking = demo ? demoRows : tool.ranking || [];
  const leader = demo ? demoRows[0] : tool.leader;
  const total = demo ? demoTotal : tool.total || 0;
  const participants = demo ? demoRows.length : tool.participants || 0;

  return <div className="auction-editor editor-workspace">
    <header className="editor-workspace-header">
      <h1 className="editor-workspace-title">Subasta</h1>
      <OutputToolbar connected={connected} description={connected ? 'Recibiendo pujas del LIVE.' : 'Conecta TikTok para recibir pujas.'}>
        <OutputLinks notice={notice} url={url} message="Enlace de Subasta copiado." iconSize={15} size="sm"/>
      </OutputToolbar>
    </header>
    <EditorViewSwitch view={mobileView} change={setMobileView} editorLabel="Diseño" monitorLabel="Vista previa y control"/>
    <div className="editor-workspace-grid" data-view={mobileView}>
      <Card className="auction-settings editor-workspace-settings">
        <div className="auction-editor-heading"><h2>Diseño de la subasta</h2><Toggle name="enabled" label="Mostrar subasta en el directo" settings={config} update={update}/></div>
        <div className="auction-editor-fields">
          <Field label="Estilo">{id => <Select id={id} value={config.style || 'classic'} onChange={event => { const style = event.target.value; setConfig(current => ({ ...current, ...auctionPresets[style], style })); }}>{auctionStyles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>}</Field>
          <Field label="Posición">{id => <Select id={id} value={config.position} onChange={event => update('position', event.target.value)}>{[['top-left', 'Arriba · izquierda'], ['top-center', 'Arriba · centro'], ['top-right', 'Arriba · derecha'], ['bottom-left', 'Abajo · izquierda'], ['bottom-center', 'Abajo · centro'], ['bottom-right', 'Abajo · derecha']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>}</Field>
          <Field label="Título">{id => <Input id={id} value={config.title} maxLength={80} onChange={event => update('title', event.target.value)}/>}</Field>
          <Field label="Título del lote">{id => <Input id={id} value={config.itemTitle} maxLength={80} onChange={event => update('itemTitle', event.target.value)}/>}</Field>
          <NumberSettings fields={[['duration', 'Duración · segundos', 0, 7200], ['limit', 'Pujas visibles', 1, 10]]} settings={config} update={update}/>
          <p className="help" style={{ gridColumn: '1 / -1', margin: 0 }}>Duración 0 significa sin límite. Al iniciar una ronda se borran las pujas anteriores.</p>
        </div>
        <div className="auction-editor-fields auction-display-options">
          <Toggle name="showTitle" label="Mostrar título" settings={{ ...defaultAuction, ...config }} update={update}/>
          <Toggle name="showItem" label="Mostrar lote" settings={{ ...defaultAuction, ...config }} update={update}/>
          <Toggle name="showTimer" label="Mostrar tiempo restante" settings={{ ...defaultAuction, ...config }} update={update}/>
          <Toggle name="showRanking" label="Mostrar lista de pujas" settings={{ ...defaultAuction, ...config }} update={update}/>
          <Toggle name="showTotal" label="Mostrar total de diamantes" settings={{ ...defaultAuction, ...config }} update={update}/>
        </div>
        <OverlayColors settings={config} update={update}/>
        <details className="auction-design-section"><summary>Tamaño, opacidad y bordes</summary>
          <NumberSettings fields={[['width', 'Ancho · px', 280, 1600], ['fontSize', 'Tamaño de texto · px', 16, 96], ['opacity', 'Opacidad del fondo · %', 0, 100], ['borderOpacity', 'Opacidad del borde · %', 0, 100], ['radius', 'Bordes redondeados · px', 0, 80]]} settings={config} update={update}/>
          <Button variant="outline" size="sm" onClick={() => setConfig(current => ({ ...current, fontSize: Math.max(30, Number(current.fontSize) || 30), width: Math.max(420, Number(current.width) || 420), color: '#ffffff' }))}>Mejorar lectura en móvil</Button>
        </details>
        <details className="auction-design-section"><summary>Efectos</summary><div className="auction-editor-fields auction-display-options">
          <Toggle name="rgbNames" label="Reflejo RGB en el título y el ganador" settings={{ ...defaultAuction, ...config }} update={update}/>
          <Toggle name="pulseLeader" label="Corona animada del líder" settings={{ ...defaultAuction, ...config }} update={update}/>
        </div></details>
        <details className="auction-css-editor auction-design-section">
          <summary>CSS personalizado</summary>
          <WidgetCssEditor css={config.customCss} change={value => update('customCss', value)}
            enabled={config.cssEnabled} onEnabledChange={value => update('cssEnabled', value)}
            selector=".auction-board" properties={boardStyle('auction', config)}
            selectors={['head', 'title', 'round', 'status', 'lot', 'lot-label', 'lot-name', 'current', 'current-crown', 'current-label', 'winner', 'value', 'empty', 'clock', 'sold', 'rank', 'avatar', 'name', 'bid', 'total'].map(name => '.auction-' + name).concat('.auction-board > ol > li')}/>
        </details>
        <p role="status" className={error ? 'error' : 'help'}>{error || (saving ? 'Guardando…' : dirty ? online ? 'Pendiente de autoguardado' : 'Pendiente de conexión' : 'Configuración guardada')}</p>
      </Card>
      <div className="auction-monitor editor-workspace-monitor">
        <Card>
          <div className="auction-editor-heading"><h2>Vista previa</h2><Toggle name="demo" label="Ver ejemplo (solo vista previa)" settings={{ demo }} update={(_, value) => setDemo(value)}/></div>
          <AutoFitPreview width={config.width} className={'auction-preview auction-preview-' + config.position.split('-')[1]}>
            <AuctionBoard key={demo ? 'demo' : 'live'} config={config} ranking={ranking} total={total} participants={participants} leader={leader}
              winner={demo ? demoRows[0] : tool.winner} status={demo ? 'live' : status} round={demo ? 1 : tool.round} itemTitle={demo ? config.itemTitle : tool.itemTitle} endsAt={demo ? previewEndsAt : tool.endsAt} preview/>
          </AutoFitPreview>
        </Card>
        <Card>
          <div className="auction-editor-heading"><h2>Control de la subasta</h2><Badge className={status === 'live' ? 'success' : ''}>{statusText[status]}</Badge></div>
          <p className="auction-totals"><strong>Ronda {tool.round || 0}</strong><span>{tool.channel && '@' + tool.channel}</span><span><strong>{number(tool.total)}</strong> diamantes</span><span><strong>{number(tool.participants)}</strong> pujas</span></p>
          <p className="help">{tool.updatedAt ? 'Última puja a las ' + new Date(tool.updatedAt).toLocaleTimeString('es') : 'Esperando la primera puja'}</p>
          {status === 'ended' && tool.winner && <p className="help">Ganador: <strong>{tool.winner.name}</strong> con {number(tool.winner.diamonds)} diamantes.</p>}
          {tool.error && <p className="error">{tool.error}</p>}
          <div className="actions auction-controls">
            {status === 'live'
              ? <Button disabled={!online} onClick={() => act('auction/end', 'Subasta cerrada.')}><Square size={15}/>Cerrar subasta</Button>
              : <Button disabled={!online} onClick={() => act('auction/start', 'Subasta iniciada.')}><Play size={15}/>{status === 'ended' ? 'Nueva ronda' : 'Iniciar subasta'}</Button>}
            <Button variant="outline" size="sm" disabled={!online} onClick={() => act('auction/next', 'Nueva ronda iniciada.')}><SkipForward size={15}/>Siguiente ronda</Button>
            <DownloadButton disabled={!online} onClick={async () => { const data = await api('auction/export'); if (data) downloadFile('subasta-ronda-' + (tool.round || 0) + '.json', JSON.stringify(data, null, 2), 'application/json'); }}>Descargar resultados</DownloadButton>
          </div>
          {reset ? <div className="auction-reset-confirm" role="alert"><p>¿Reiniciar la subasta? Se borrarán las pujas y los ganadores; el diseño se conservará.</p><div className="actions"><Button disabled={!online} onClick={async () => { if (await api('auction/reset')) { setReset(false); notice('Subasta reiniciada.'); } }}>Confirmar reinicio</Button><Button variant="outline" onClick={() => setReset(false)}>Cancelar</Button></div></div>
            : <Button variant="outline" size="sm" disabled={!online} onClick={() => setReset(true)}><RotateCcw size={16}/>Reiniciar subasta</Button>}
          <p className="help">Los regalos recibidos con TikTok conectado suman su valor en diamantes como pujas. El líder es quien más diamantes acumula en la ronda.</p>
        </Card>
      </div>
    </div>
  </div>;
}
