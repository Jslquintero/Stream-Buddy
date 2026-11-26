import { useEffect, useState } from 'react';
import { ArrowUpRight, Check, Copy } from 'lucide-react';
import { layoutOutputURL } from '../../../shared/layout-url';
import { Badge, Button, Card } from './ui';
import { CopyLinkButton } from './output-controls';
import './home.css';

export function adQueueOutputURL(base = 'http://127.0.0.1:17843') {
  return new URL('/output#tiktok.studio', base).href;
}

export function Home({ widgets, state, online, open }) {
  const active = widgets.filter(({ id }) => state?.tools[id]?.running).length;

  return <div className="home">
    <header className="home-heading">
      <h1>Vista general</h1>
      {online && <Badge className="success"><span className="online-dot"/>{active} de {widgets.length} widgets activos</Badge>}
    </header>
    <section className="home-widgets" aria-labelledby="home-widget-title">
      <div className="home-panel-heading">
        <h2 id="home-widget-title">Enlaces de widgets</h2>
        <p>Pega la URL en una fuente de enlace de TikTok LIVE Studio o de navegador en OBS.</p>
      </div>
      <Card className="home-widget-list">
        {widgets.map(module => <WidgetRow key={module.id} module={module} tool={state?.tools[module.id]}
          ready={!!state} online={online} open={open}/>)}
      </Card>
    </section>
  </div>;
}

function WidgetRow({ module, tool, ready, online, open }) {
  const { id, title, description, action, color, icon: Icon } = module;
  const [compositionId, setCompositionId] = useState('');
  const compositions = tool?.compositions ?? [];
  const composition = compositions.find(item => item.id === compositionId);
  const output = id === 'layout' ? layoutOutputURL(window.location.href, composition?.id)
    : id === 'ads' ? adQueueOutputURL(tool?.url)
    : tool?.url && new URL(tool.url, window.location.origin).href;
  const listOutput = tool?.listUrl && new URL(tool.listUrl, window.location.origin).href;
  const status = tool?.error ? 'Revisar actividad'
    : tool?.starting ? 'Iniciando'
    : tool?.available && !tool.running ? 'Detenido'
    : ready && !tool?.running && !tool?.available ? 'No disponible'
    : '';

  return <article className="home-widget-row">
    <div className="home-widget-info">
      <span className={`module-icon ${color}`} aria-hidden="true"><Icon size={20}/></span>
      <div>
        <div className="home-widget-title">
          <h3>{title}</h3>
          {online && status && <Badge>{status}</Badge>}
        </div>
        <p>{description}</p>
      </div>
    </div>
    <div className="home-widget-controls">
      <Button className="home-configure" variant="ghost" size="sm" disabled={!online} onClick={() => open(id)}>
        {action}<ArrowUpRight size={14}/>
      </Button>
      {output && <WidgetLinks output={output} listOutput={listOutput} title={composition?.name ?? title}>
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

function WidgetLinks({ output, listOutput, title, children }) {
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
    return <CopyLinkButton url={url} notice={text => setFeedback({ url, text })} message={copiedMessage}
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


