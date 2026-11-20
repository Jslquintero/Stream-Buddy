import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button, Card, Input, Badge } from './ui';
import { Field, Toggle } from './fields';
import { useStudio } from '../hooks/use-studio';
import { commandsOutputPath, commandsListOutputPath, validateCommands } from '../../../modules/commands/config';
import './commands.css';

function CommandImagePreview({ src }) {
  const [status, setStatus] = useState('loading');
  return <div className="command-image-preview">
    <strong>Vista previa del archivo</strong>
    <div className="command-image-preview-stage">
      {status !== 'error' && <img src={src} alt="Vista previa del comando" onLoad={() => setStatus('ready')} onError={() => setStatus('error')}/>}
      {status === 'loading' && <span role="status">Cargando imagen…</span>}
      {status === 'error' && <span role="alert">No se pudo abrir esta imagen. Si pegaste un enlace de Tenor, guarda el comando y recarga el panel, o sube el GIF como archivo.</span>}
    </div>
    <p className="help">Esta vista previa permanece visible. En el directo, usa «Probar en salida» con la fuente abierta; la imagen se oculta al terminar la duración configurada.</p>
  </div>;
}

export function CommandsStudio({ tool, api, notice, online, connected }) {
  const [config, setConfig] = useState(tool.config), [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [view, setView] = useState(() => { try { return localStorage.getItem('studio.commands.view') === 'list' ? 'list' : 'grid'; } catch { return 'grid'; } });
  const changeView = value => { setView(value); try { localStorage.setItem('studio.commands.view', value); } catch {} };
  const update = fn => { setConfig(fn); setDirty(true); };
  const edit = (id, key, value) => update(old => ({ ...old, commands: old.commands.map(row => row.id === id ? { ...row, [key]: value } : row) }));
  const url = new URL(commandsOutputPath, location.origin).href;
  const listUrl = new URL(commandsListOutputPath, location.origin).href;
  async function testOutput(id) {
    const output = window.open(id === '!comandos' ? listUrl : url, id === '!comandos' ? 'live-studio-commands-list' : 'live-studio-commands-output');
    if (!output) { notice('Permite las ventanas emergentes para abrir la salida de comandos.'); return; }
    output.focus();
    if (!dirty || await save()) {
      if (await api('commands/test', { id })) notice('Prueba enviada a la ventana de salida.');
    }
  }
  async function save() {
    setBusy(true);
    try {
      const next = validateCommands(config);
      if (!await api('commands/save', next)) return false;
      setConfig(next); setDirty(false); notice('Comandos guardados.'); return true;
    } catch (e) { notice(e.message); return false; }
    finally { setBusy(false); }
  }
  async function upload(id, kind, file) {
    if (!file) return;
    setBusy(true);
    try {
      if (file.size > (kind === 'image' ? 20 : 5) * 1024 * 1024) throw new Error(kind === 'image' ? 'La imagen supera 20 MB' : 'El audio supera 5 MB');
      const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('No se pudo leer el archivo')); reader.readAsDataURL(file); });
      const result = await api('notifications/upload', { kind, data });
      if (result) edit(id, kind, result[kind]);
    } catch (e) { notice(e.message); }
    finally { setBusy(false); }
  }
  return <div className="commands-editor">
    <Card className="notifications-toolbar"><div><h2>Salida de la lista de comandos</h2><p className="help">Añade esta fuente por separado. Muestra la lista cuando alguien escribe !comandos.</p></div><div className="actions"><Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(listUrl); notice('Salida de la lista copiada.'); } catch { notice('Salida de la lista: ' + listUrl); } }}>Copiar lista</Button><Button asChild variant="outline"><a href={listUrl} target="_blank" rel="noopener noreferrer">Abrir lista</a></Button></div></Card>
    <Card className="notifications-toolbar"><div><Badge className={connected ? 'success' : ''}>{connected ? 'TikTok conectado' : 'TikTok sin conectar'}</Badge><p className="help">Añade esta salida como fuente de navegador en tu directo. La imagen aparece centrada. Un nuevo recurso reemplaza al anterior de su tipo, sin cola.</p></div><div className="actions"><Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(url); notice('Salida de comandos copiada.'); } catch { notice('Salida: ' + url); } }}>Copiar notificaciones</Button><Button asChild variant="outline"><a href={url} target="_blank" rel="noopener noreferrer">Abrir notificaciones</a></Button><Button variant="outline" disabled={!online} onClick={() => api('commands/clear')}>Detener salida</Button></div></Card>
    <Card className="commands-settings"><h2>Comandos de chat</h2><p className="help">Se reconoce el mensaje completo, sin distinguir mayúsculas: !Aatrox y !aatrox son iguales. Los comandos ejecutados no se leen por TTS. Los ejemplos necesitan tus archivos antes de activarlos.</p>
      <p className="help">!comandos muestra en pantalla los comandos activos y sus descripciones. La lista cambia de página automáticamente cada ocho segundos si hay más de seis comandos. Tiene su propia salida y no interrumpe los GIF ni los sonidos.</p>
      <div className="actions" role="group" aria-label="Vista de comandos"><Button variant={view === 'list' ? 'default' : 'outline'} aria-pressed={view === 'list'} onClick={() => changeView('list')}>Lista</Button><Button variant={view === 'grid' ? 'default' : 'outline'} aria-pressed={view === 'grid'} onClick={() => changeView('grid')}>Cuadrícula</Button><Button variant="outline" disabled={busy || !online} onClick={() => testOutput('!comandos')}>Probar !comandos</Button></div>
      {tool.error && <p role="alert">{tool.error}</p>}
      <fieldset disabled={busy || !online}>
        <Toggle name="enabled" label="Activar comandos de chat" settings={config} update={(_, enabled) => update(old => ({ ...old, enabled }))}/>
        <div className="actions"><Button onClick={save}>Guardar comandos</Button><Button variant="outline" disabled={config.commands.length >= 100} onClick={() => { const id = crypto.randomUUID(); setExpanded(id); update(old => ({ ...old, commands: [...old.commands, { id, command: '!nuevo' + (old.commands.length + 1), description: '', enabled: false, image: '', audio: '', text: '', duration: 5, volume: 80 }] })); }}>Añadir comando</Button><span role="status">{busy ? 'Procesando…' : dirty ? 'Cambios sin guardar' : 'Guardado en este equipo'}</span></div>
        <div className={'commands-list commands-view-' + view}>{config.commands.map(row => <section className="command-card" key={row.id}>
          <button type="button" className="command-summary" aria-expanded={expanded === row.id} aria-controls={'command-fields-' + row.id} onClick={() => setExpanded(current => current === row.id ? null : row.id)}>
            <span className="command-summary-copy"><strong>{row.command}</strong><span>{row.description || 'Sin descripción'}</span></span>
            <Badge className={row.enabled ? 'success' : ''}>{row.enabled ? 'Activo' : 'Inactivo'}</Badge>
            <ChevronDown size={18} aria-hidden="true"/>
          </button>
          <div id={'command-fields-' + row.id} className="command-fields" hidden={expanded !== row.id}>
          {expanded === row.id && row.image && <CommandImagePreview key={row.image} src={row.image}/>}
          <div className="form-row"><Field label="Comando">{id => <Input id={id} value={row.command} maxLength={41} onChange={e => edit(row.id, 'command', e.target.value)}/>}</Field><Toggle name="enabled" label="Activo" settings={row} update={(_, value) => edit(row.id, 'enabled', value)}/></div>
          <Field label="Descripción corta" hint="Los usuarios la verán al escribir !comandos.">{id => <Input id={id} value={row.description ?? ''} maxLength={100} placeholder="Ej.: Reproduce el sonido de la definitiva de Sion" onChange={e => edit(row.id, 'description', e.target.value)}/>}</Field>
          <div className="form-row">{[['image', 'Imagen o GIF', 'image/png,image/jpeg,image/gif,image/webp'], ['audio', 'Sonido', 'audio/mpeg,audio/wav,audio/ogg']].map(([kind, label, accept]) => <div key={kind}><Field hint={kind === 'image' ? 'Puedes pegar un enlace de Tenor; se convierte al guardar.' : undefined} label={label + ' · enlace directo'}>{id => <Input id={id} value={row[kind]} placeholder="https://…" onChange={e => edit(row.id, kind, e.target.value)}/>}</Field><Field label={'Subir ' + label.toLowerCase()}>{id => <input id={id} type="file" accept={accept} onChange={e => { void upload(row.id, kind, e.target.files[0]); e.target.value = ''; }}/>}</Field></div>)}</div>
          <Field label="Texto de notificación (opcional)">{id => <Input id={id} maxLength={200} value={row.text} onChange={e => edit(row.id, 'text', e.target.value)}/>}</Field>
          <div className="form-row"><Field label="Duración visual · segundos">{id => <Input id={id} type="number" min="1" max="120" value={row.duration} onChange={e => edit(row.id, 'duration', e.target.value === '' ? '' : Number(e.target.value))}/>}</Field><Field label="Volumen · %">{id => <Input id={id} type="number" min="0" max="100" value={row.volume} onChange={e => edit(row.id, 'volume', e.target.value === '' ? '' : Number(e.target.value))}/>}</Field></div>
          <div className="actions"><Button variant="outline" onClick={() => testOutput(row.id)}>Probar en salida</Button><Button variant="ghost" onClick={() => update(old => ({ ...old, commands: old.commands.filter(item => item.id !== row.id) }))}>Eliminar comando</Button></div>
          </div>
        </section>)}</div>
      </fieldset>
    </Card>
  </div>;
}

export function CommandAudio({ event, onError }) {
  const ref = useRef(null);
  useEffect(() => {
    const audio = ref.current;
    audio.src = event.src;
    audio.volume = event.volume / 100;
    let active = true;
    const fail = () => { if (active) onError('No se pudo reproducir el audio. Comprueba el archivo y permite reproducción automática en esta fuente.'); };
    audio.addEventListener('error', fail);
    audio.play()?.catch(fail);
    return () => { active = false; audio.removeEventListener('error', fail); audio.pause(); audio.removeAttribute('src'); audio.load(); };
  }, [event.id]);
  return <audio ref={ref} src={event.src}/>;
}

export function CommandsOutput({ listOnly = false }) {
  const { state, online } = useStudio(), [error, setError] = useState(''), [now, setNow] = useState(Date.now());
  const tool = state?.tools.commands;
  useEffect(() => {
    document.documentElement.classList.add('commands-output');
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => { clearInterval(timer); document.documentElement.classList.remove('commands-output'); };
  }, []);
  useEffect(() => setError(''), [tool?.visual?.id, tool?.audio?.id]);
  const current = listOnly ? tool?.list : tool?.visual;
  const visual = online && current?.expiresAt > now ? current : null;
  const audio = !listOnly && online && tool?.audio?.expiresAt > now ? tool.audio : null;
  const pages = Math.max(1, Math.ceil((visual?.help?.length || 0) / 6));
  const page = Math.min(pages - 1, Math.max(0, Math.floor((now - (visual?.startedAt || now)) / 8000)));
  return <div className="commands-stage">
    {visual && <div className="command-visual" key={'visual-' + visual.id}>{visual.help && <section className="commands-help"><h2>Comandos disponibles</h2>{visual.help.length ? <dl>{visual.help.slice(page * 6, page * 6 + 6).map(entry => <div key={entry.command}><dt>{entry.command}</dt><dd>{entry.description}</dd></div>)}</dl> : <p>No hay comandos activos por ahora.</p>}<footer>!comandos · Ver esta lista{pages > 1 && <span> · {page + 1} / {pages}</span>}</footer></section>}{visual.image && <img src={visual.image} alt="" onError={() => setError('No se pudo cargar la imagen del comando.')}/>} {visual.text && <p>{visual.text}</p>}</div>}
    {audio && <CommandAudio key={'audio-' + audio.id} event={audio} onError={setError}/>}
    {error && <button className="command-output-error" onClick={() => location.reload()}>{error} Pulsa para reintentar.</button>}
  </div>;
}
