import { MediaFileField } from './ui/file-picker';
import { OutputLinks, OutputToolbar } from './output-controls';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button, Card, Input, Badge } from './ui';
import { Field, Toggle } from './fields';
import { useStudio } from '../hooks/use-studio';
import { commandsOutputPath, commandsListOutputPath, validateCommands } from '../../../modules/commands/config';
import { EditorViewSwitch } from './editor-view-switch';
import './editor-workspace.css';
import './commands.css';
import './commands-editor.css';

function CommandImagePreview({ src }) {
  const [status, setStatus] = useState('loading');
  return <div className="command-image-preview">
    <div className="command-image-preview-stage">
      {status !== 'error' && <img src={src} alt="Vista previa del comando" onLoad={() => setStatus('ready')} onError={() => setStatus('error')}/>}
      {status === 'loading' && <span role="status">Cargando imagen…</span>}
      {status === 'error' && <span role="alert">No se pudo abrir esta imagen. Si pegaste un enlace de Tenor, guarda el comando para resolver la imagen.</span>}
    </div>
  </div>;
}

export function CommandsStudio({ tool, api, notice, online, connected }) {
  const [config, setConfig] = useState(tool.config), [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false);
  const [expanded, setExpanded] = useState(tool.config.commands[0]?.id ?? null);
  const [mobileView, setMobileView] = useState('editor');
  const [view, setView] = useState(() => { try { return localStorage.getItem('studio.commands.view') === 'list' ? 'list' : 'grid'; } catch { return 'grid'; } });
  const changeView = value => { setView(value); try { localStorage.setItem('studio.commands.view', value); } catch {} };
  const update = fn => { setConfig(fn); setDirty(true); };
  const edit = (id, key, value) => update(old => ({ ...old, commands: old.commands.map(row => row.id === id ? { ...row, [key]: value } : row) }));
  const editMedia = (id, kind, value) => update(old => ({ ...old, commands: old.commands.map(row => {
    if (row.id !== id) return row;
    const next = { ...row, [kind]: value };
    if (value && kind === 'image') next.video = '';
    if (value && kind === 'video') { next.image = ''; next.duration = Math.min(row.duration, 30); }
    return next;
  }) }));
  const selected = config.commands.find(row => row.id === expanded);
  const listCommand = config.listCommand ?? '!comandos';
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
      if (file.size > (kind === 'video' ? 30 : kind === 'image' ? 20 : 5) * 1024 * 1024) throw new Error(kind === 'video' ? 'El video supera 30 MB' : kind === 'image' ? 'La imagen supera 20 MB' : 'El audio supera 5 MB');
      const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('No se pudo leer el archivo')); reader.readAsDataURL(file); });
      const result = await api('notifications/upload', { kind, data });
      if (result?.[kind]) editMedia(id, kind, result[kind]);
    } catch (e) { notice(e.message); }
    finally { setBusy(false); }
  }
  return <div className="commands-editor editor-workspace">
    <header className="editor-workspace-header">
      <h1 className="editor-workspace-title">Comandos de chat</h1>
      <OutputToolbar connected={connected} description={connected ? "Recibiendo mensajes del LIVE." : "Conecta TikTok para recibir comandos."}>
        <OutputLinks notice={notice} url={url} message="Salida de comandos copiada." fallback="Salida" size="sm" iconSize={15}/>
        <Button variant="outline" size="sm" disabled={!online} onClick={() => api("commands/clear")}>Detener salida</Button>
      </OutputToolbar>
    </header>
    {tool.error && <p className="error" role="alert">{tool.error}</p>}
    <EditorViewSwitch view={mobileView} change={setMobileView} editorLabel="Comandos" monitorLabel="Vista previa y lista"/>
    <div className="editor-workspace-grid" data-view={mobileView}>
      <Card className="commands-settings editor-workspace-settings">
        <div className="commands-panel-heading"><h2>Comandos</h2><Toggle name="enabled" label="Activar comandos de chat" disabled={busy || !online} settings={config} update={(_, enabled) => update(old => ({ ...old, enabled }))}/></div>
        <div className="commands-panel-heading commands-actions">
          <div className="actions" role="group" aria-label="Vista de comandos">
            <Button size="sm" variant={view === "list" ? "default" : "outline"} aria-pressed={view === "list"} onClick={() => changeView("list")}>Lista</Button>
            <Button size="sm" variant={view === "grid" ? "default" : "outline"} aria-pressed={view === "grid"} onClick={() => changeView("grid")}>Cuadrícula</Button>
          </div>
          <Button variant="outline" size="sm" disabled={busy || !online || config.commands.length >= 100} onClick={() => { const id = crypto.randomUUID(); setExpanded(id); update(old => ({ ...old, commands: [...old.commands, { id, command: '!nuevo' + (old.commands.length + 1), description: '', enabled: false, image: '', audio: '', text: '', duration: 5, volume: 80 }] })); }}>Añadir comando</Button>
        </div>
        <div className="save-bar"><span className={dirty ? "unsaved" : "help"} role="status">{busy ? "Procesando…" : dirty ? "Cambios sin guardar" : "Guardado en este equipo"}</span>
          <Button size="sm" disabled={busy || !online || !dirty} onClick={save}>Guardar comandos</Button>
        </div>
        <fieldset disabled={busy || !online}>
        <div className={'commands-list commands-view-' + view}>{config.commands.map(row => <section className="command-card" data-expanded={expanded === row.id} key={row.id}>
          <button type="button" className="command-summary" aria-expanded={expanded === row.id} aria-controls={'command-fields-' + row.id} onClick={() => setExpanded(current => current === row.id ? null : row.id)}>
            <span className="command-summary-copy"><strong>{row.command}</strong><span>{row.description || 'Sin descripción'}</span></span>
            <Badge className={row.enabled ? 'success' : ''}>{row.enabled ? 'Activo' : 'Inactivo'}</Badge>
            <ChevronDown size={18} aria-hidden="true"/>
          </button>
          <div id={'command-fields-' + row.id} className="command-fields" hidden={expanded !== row.id}>
          <div className="form-row"><Field label="Comando">{id => <Input id={id} value={row.command} maxLength={41} onChange={e => edit(row.id, 'command', e.target.value)}/>}</Field><Toggle name="enabled" label="Activo" settings={row} update={(_, value) => edit(row.id, 'enabled', value)}/></div>
          <Field label="Descripción corta" hint={'Los usuarios la verán al escribir ' + (config.listCommand ?? '!comandos') + '.'}>{id => <Input id={id} value={row.description ?? ''} maxLength={100} placeholder="Ej.: Reproduce el sonido de la definitiva de Sion" onChange={e => edit(row.id, 'description', e.target.value)}/>}</Field>
          <div className="command-media-grid">{[['image', 'Imagen o GIF'], ['video', 'Clip corto'], ['audio', 'Sonido']].map(([kind, label]) => <MediaFileField key={kind} kind={kind} title={label} src={row[kind]} hint={kind === 'video' ? 'máximo 30 segundos' : undefined} onRemove={() => edit(row.id, kind, '')} removeLabel={'Quitar ' + label.toLowerCase()} compact disabled={busy || !online} onFile={file => upload(row.id, kind, file)}><details className="command-file-url"><summary>Usar enlace</summary><Field label={'Enlace de ' + label.toLowerCase()} hint={kind === 'image' ? 'Enlace directo o de Tenor.' : 'Enlace directo al archivo.'}>{id => <Input id={id} value={row[kind] ?? ''} placeholder="https://..." onChange={e => editMedia(row.id, kind, e.target.value)}/>}</Field></details></MediaFileField>)}</div>
          <details className="command-options"><summary>Ajustes de reproducción</summary><Field label="Texto de notificación (opcional)">{id => <Input id={id} maxLength={200} value={row.text} onChange={e => edit(row.id, 'text', e.target.value)}/>}</Field>
          <div className="form-row"><Field label="Duración visual · segundos">{id => <Input id={id} type="number" min="1" max="120" value={row.duration} onChange={e => edit(row.id, 'duration', e.target.value === '' ? '' : Number(e.target.value))}/>}</Field><Field label="Volumen · %">{id => <Input id={id} type="number" min="0" max="100" value={row.volume} onChange={e => edit(row.id, 'volume', e.target.value === '' ? '' : Number(e.target.value))}/>}</Field></div>
          <Field label="Cooldown (segundos por usuario)" hint="0 desactiva la espera. Cada comando tiene su propio cooldown.">{id => <Input id={id} type="number" min="0" max="3600" value={row.cooldown ?? 0} onChange={e => edit(row.id, 'cooldown', e.target.value === '' ? '' : Number(e.target.value))}/>}</Field>
          </details><div className="actions"><Button variant="ghost" size="sm" onClick={() => update(old => ({ ...old, commands: old.commands.filter(item => item.id !== row.id) }))}>Eliminar comando</Button></div>
          </div>
        </section>)}</div>
        </fieldset>
      </Card>
      <div className="commands-monitor editor-workspace-monitor">
        <Card>
          <div className="commands-panel-heading"><h2>Vista previa</h2>{selected && <Badge>{selected.command}</Badge>}</div>
          {selected?.image ? <CommandImagePreview key={selected.image} src={selected.image}/> : selected?.video ? <video key={selected.video} src={selected.video} controls preload="metadata" className="command-clip-preview"/> : <p className="help">{selected ? "Añade una imagen o un video para verlo aquí." : "Selecciona un comando para previsualizarlo."}</p>}
          {selected?.text && <p>{selected.text}</p>}
          {selected && <Button size="sm" variant="outline" disabled={busy || !online} onClick={() => testOutput(selected.id)}>Probar en salida</Button>}
        </Card>
        <OutputToolbar className="commands-list-toolbar" title="Lista en el directo" description={<>Escribe {listCommand} para mostrar los comandos activos.</>}>
          <OutputLinks notice={notice} url={listUrl} message="Salida de la lista copiada." fallback="Salida de la lista" copyLabel="Copiar lista" openLabel="Abrir lista" size="sm"/>
          <Button variant="outline" size="sm" disabled={busy || !online} onClick={() => testOutput("!comandos")}>Probar {listCommand}</Button>
        </OutputToolbar>
        <Card><details className="command-options"><summary>Ajustes de la lista</summary><fieldset disabled={busy || !online}>
          <Field label="Palabra para mostrar la lista">{id => <Input id={id} maxLength={41} value={config.listCommand ?? '!comandos'} onChange={e => update(old => ({ ...old, listCommand: e.target.value }))}/>}</Field>
          <Field label="Cooldown de la lista (segundos por usuario)" hint="0 desactiva la espera.">{id => <Input id={id} type="number" min="0" max="3600" value={config.listCooldown ?? 20} onChange={e => update(old => ({ ...old, listCooldown: e.target.value === '' ? '' : Number(e.target.value) }))}/>}</Field>
        </fieldset></details></Card>
      </div>
    </div>
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
  const { state, online } = useStudio('commands'), [error, setError] = useState(''), [now, setNow] = useState(Date.now());
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
  const page = Math.min(pages - 1, Math.max(0, visual?.page != null ? visual.page - 1 : Math.floor((now - (visual?.startedAt || now)) / 8000)));
  return <div className="commands-stage">
    {visual && <div className="command-visual" key={'visual-' + visual.id}>{visual.help && <section className="commands-help"><h2>Comandos disponibles</h2>{visual.help.length ? <dl>{visual.help.slice(page * 6, page * 6 + 6).map(entry => <div key={entry.command}><dt>{entry.command}</dt><dd>{entry.description}</dd></div>)}</dl> : <p>No hay comandos activos por ahora.</p>}<footer>{tool?.config?.listCommand ?? '!comandos'} · Ver esta lista{pages > 1 && <span> · {page + 1} / {pages}</span>}</footer></section>}{visual.video && <CommandVideo key={visual.id} event={visual} muted={!!tool?.audio?.src || tool?.audio?.id !== visual.id} onError={setError}/>} {!visual.video && visual.image && <img src={visual.image} alt="" onError={() => setError('No se pudo cargar la imagen del comando.')}/>} {visual.text && <p>{visual.text}</p>}</div>}
    {audio?.src && <CommandAudio key={'audio-' + audio.id} event={audio} onError={setError}/>}
    {error && <button className="command-output-error" onClick={() => location.reload()}>{error} Pulsa para reintentar.</button>}
  </div>;
}

function CommandVideo({ event, muted, onError }) {
  const ref = useRef(null);
  useEffect(() => {
    const video = ref.current;
    video.volume = event.volume / 100;
    video.play()?.catch(() => onError('No se pudo reproducir el clip. Permite la reproduccion automatica.'));
    return () => { video.pause(); video.removeAttribute('src'); video.load(); };
  }, [event.id]);
  return <video ref={ref} src={event.video} muted={muted} playsInline onEnded={e => { e.currentTarget.style.visibility = 'hidden'; }} onError={() => onError('No se pudo cargar el clip. Usa MP4 o WebM.')}/>;
}
