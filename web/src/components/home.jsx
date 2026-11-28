import { useOutputOrigin } from '../hooks/use-output-origin';
import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronDown, Copy, Wifi } from 'lucide-react';
import { layoutOutputURL } from '../../../shared/layout-url';
import { Switch } from './ui';
import { CopyLinkButton } from './output-controls';
import { FirstRun } from './first-run';
import { widgetStatus, widgetSummary } from '../lib/widget-status';
import { readOnboarding, writeOnboarding } from '../lib/onboarding';
import './home.css';

export function adQueueOutputURL(base = 'http://127.0.0.1:17843') {
  return new URL('/output#tiktok.studio', base).href;
}

function useNow(interval = 10000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(timer);
  }, [interval]);
  return now;
}

export function Home({ api, widgets, state, online, open, notice }) {
  const outputOrigin = useOutputOrigin();
  const now = useNow();
  const connected = online && !!state?.tts?.connected;
  const [onboarding, setOnboarding] = useState(readOnboarding);
  const updateOnboarding = useCallback(patch => setOnboarding(previous => {
    const next = { ...previous, ...patch };
    writeOnboarding(next);
    return next;
  }), []);
  const notificationUrl = state?.tools?.notifications?.url;
  const copyTarget = notificationUrl
    ? { name: 'Notificaciones', url: new URL(notificationUrl, outputOrigin).href }
    : { name: 'Escenas', url: layoutOutputURL(outputOrigin) };
  const guideDone = (connected ? 1 : 0) + ((state?.tts?.connector || connected) ? 1 : 0) + (onboarding.copied ? 1 : 0) + (onboarding.added ? 1 : 0);
  const guideOpen = guideDone < 4 && !onboarding.dismissed && !onboarding.completed;

  useEffect(() => {
    if (guideDone >= 4 && !onboarding.completed) updateOnboarding({ completed: true });
  }, [guideDone, onboarding.completed, updateOnboarding]);

  async function copyFirstOutput() {
    try {
      await navigator.clipboard.writeText(copyTarget.url);
      updateOnboarding({ copied: true });
      notice?.('Enlace de ' + copyTarget.name + ' copiado.');
    } catch {
      notice?.('Copia este enlace manualmente: ' + copyTarget.url, { type: 'warning', sticky: true });
    }
  }

  function openTikTok() {
    window.dispatchEvent(new CustomEvent('live-studio:connect'));
  }

  function markAdded() {
    updateOnboarding({ added: true });
    notice?.('Paso completado. La salida está lista para añadirla al directo.');
  }

  const network = state?.network;
  const legacyNetwork = Array.isArray(network?.addresses);
  const networkOrigin = network?.address ? outputOrigin : '';
  function shareWidgets(enabled) {
    if (legacyNetwork && enabled && !network.addresses.length) {
      notice('Conecta el equipo a una red Wi-Fi o Ethernet.', { type: 'error' });
      return;
    }
    const body = legacyNetwork ? { address: enabled ? network.addresses[0] : '' } : { enabled };
    return api('network/share', body);
  }
  return <div className="home home-dashboard">
    {guideOpen && <details className="home-banner">
      <summary><strong>Prepara tu primer directo</strong><span>{guideDone} de 4 pasos</span><ChevronDown size={16} aria-hidden="true"/></summary>
      <FirstRun state={state} online={online} copied={onboarding.copied} added={onboarding.added}
            copyName={copyTarget.name} dismissed={onboarding.dismissed}
            onDismiss={() => updateOnboarding({ dismissed: true })}
            onConnect={openTikTok} onCopy={online ? copyFirstOutput : null} onAdded={markAdded}/>
    </details>}
    <section aria-labelledby="outputs-heading">
      <div className="home-panel-heading">
        <h2 id="outputs-heading">Salidas del directo</h2>
        <p>Copia una URL para usarla en OBS o TikTok LIVE Studio.</p>
      </div>
      <div className="home-widget-list">
      {widgets.map(module => <WidgetRow networkOrigin={networkOrigin} key={module.id} module={module} tool={state?.tools[module.id]}
        online={online} open={open} state={state} now={now} onCopied={() => updateOnboarding({ copied: true })}/>)}
      </div>
    </section>
    {network && <div className="home-network">
      <Wifi size={20} aria-hidden="true"/>
      <div><label htmlFor="share-widgets">Acceso desde otros equipos</label>
        <p>{networkOrigin ? (legacyNetwork ? 'Copia la URL del widget que quieras usar en el otro equipo.' : 'Abre este enlace en otro equipo para elegir un widget.') : 'Comparte tus widgets con equipos de la misma red.'}</p>
      </div>
      <Switch id="share-widgets" aria-label="Acceso desde otros equipos" disabled={!online} checked={!!networkOrigin}
        onCheckedChange={shareWidgets}/>
      {networkOrigin && !legacyNetwork && <div className="home-network-link">
        <a href={networkOrigin} target="_blank" rel="noopener noreferrer">{networkOrigin}</a>
        <CopyLinkButton url={networkOrigin} notice={notice} size="sm"><Copy size={14}/>Copiar enlace</CopyLinkButton>
      </div>}
    </div>}
  </div>;
}

function WidgetRow({ networkOrigin, module, tool, online, open, state, now, onCopied }) {
  const { id, title, color, icon: Icon } = module;
  const [compositionId, setCompositionId] = useState('');
  const compositions = tool?.compositions ?? [];
  const composition = compositions.find(item => item.id === compositionId);
  const base = useOutputOrigin();
  const output = networkOrigin && id === 'ads' ? null : id === 'layout' ? layoutOutputURL(base, composition?.id)
    : id === 'ads' ? adQueueOutputURL(tool?.url)
    : tool?.url && new URL(tool.url, base).href;
  const listOutput = tool?.listUrl && new URL(tool.listUrl, base).href;
  const status = widgetStatus({ id, tool, state, online });
  const meta = tool && online ? widgetSummary({ id, tool, state, now }) : '';

  return <article className="home-widget-row">
    <div className="home-widget-info">
      <span className={`module-icon ${color}`} aria-hidden="true"><Icon size={20}/></span>
      <div>
        <div className="home-widget-title">
          <h3><button type="button" className="home-widget-open" onClick={() => open(id)}>{title}</button></h3>
          {online && <span className={'home-status home-status-' + status.tone}>{status.label}</span>}
        </div>
        {meta && <p className="home-widget-meta">{meta}</p>}
      </div>
    </div>
    <div className="home-widget-controls">
      {networkOrigin && id === 'ads' && <span>AdQueue solo admite salida local.</span>}
      {output && <WidgetLinks output={output} listOutput={listOutput} title={composition?.name ?? title} onCopied={onCopied}>
        {id === 'layout' && compositions.length > 0 && <select aria-label={`Composición de ${title}`}
          value={composition?.id ?? ''} onChange={event => setCompositionId(event.target.value)}>
          <option value="">Layout principal</option>
          {compositions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>}
      </WidgetLinks>}
    </div>
  </article>;
}

const copiedMessage = 'URL copiada.';

function WidgetLinks({ output, listOutput, title, children, onCopied }) {
  const [feedback, setFeedback] = useState(null);
  const current = feedback && [output, listOutput].includes(feedback.url) ? feedback : null;
  const copied = current?.text === copiedMessage;

  useEffect(() => {
    if (feedback?.text !== copiedMessage) return;
    const timer = window.setTimeout(() => setFeedback(null), 2200);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  function copyButton(url, label, accessibleLabel) {
    const confirmed = copied && current.url === url;
    return <CopyLinkButton url={url} notice={text => {
      setFeedback({ url, text });
      if (text === copiedMessage) onCopied?.();
    }} message={copiedMessage}
      aria-label={accessibleLabel} size="sm">
      {confirmed ? <Check size={14}/> : <Copy size={14}/>}
      {confirmed ? 'Copiada' : label}
    </CopyLinkButton>;
  }

  return <div className="home-widget-links">
    <div className="home-copy-actions">
      {children}
      {copyButton(output, 'Copiar URL', `Copiar URL de ${title}`)}
      {listOutput && copyButton(listOutput, 'Copiar lista', 'Copiar URL de la lista de comandos')}
    </div>
    <span className="home-copy-announcement" role="status">{copied ? copiedMessage : ''}</span>
    {current && !copied && <div className="home-copy-fallback" role="status">
      Copia este enlace manualmente
      <code>{current.url}</code>
    </div>}
  </div>;
}


