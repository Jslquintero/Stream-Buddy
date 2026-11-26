import { MediaFileField } from './ui/file-picker';
import { OutputLinks, OutputToolbar } from './output-controls';
import { useEffect, useRef, useState } from 'react';
import {
  Copy,
  Film,
  ImagePlus,
  LayoutGrid,
  List,
  ListChecks,
  Music2,
  Pencil,
  Play,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import { Button, Card, Dialog, Input, Badge, Switch } from './ui';
import { Field, Toggle } from './fields';
import { useStudio } from '../hooks/use-studio';
import { commandsOutputPath, commandsListOutputPath, validateCommands } from '../../../modules/commands/config';
import { EditorViewSwitch } from './editor-view-switch';
import './editor-workspace.css';
import './commands.css';
import './commands-editor.css';

const mediaFields = [
  { kind: 'image', label: 'Imagen o GIF' },
  { kind: 'video', label: 'Clip corto' },
  { kind: 'audio', label: 'Sonido' },
];

const filters = [
  { id: 'all', label: 'Todos' },
  { id: 'active', label: 'Activos' },
  { id: 'inactive', label: 'Inactivos' },
];

function mediaChips(row) {
  return [
    row?.image && { key: 'image', label: 'Imagen', icon: ImagePlus },
    row?.video && { key: 'video', label: 'Clip', icon: Film },
    row?.audio && { key: 'audio', label: 'Sonido', icon: Music2 },
    row?.text && { key: 'text', label: 'Texto', icon: Type },
  ].filter(Boolean);
}

function nextCommandName(commands) {
  const used = new Set(['!comandos', ...commands.map(row => String(row.command ?? '').trim().toLowerCase())]);
  let index = 1;
  while (used.has('!comando' + index)) index += 1;
  return '!comando' + index;
}

function useDialogDismiss(open, onClose) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const key = event => { if (event.key === 'Escape') close.current(); };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [open]);
}

function CommandThumb({ row }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [row.image]);
  const fallback = row.video ? <Film size={17}/> : row.audio ? <Music2 size={17}/> : row.text ? <Type size={17}/> : <ImagePlus size={17}/>;
  return <span className="command-row-thumb" data-kind={row.video ? 'video' : row.image && !failed ? 'image' : row.audio ? 'audio' : row.text ? 'text' : 'empty'}>
    {row.image && !failed ? <img src={row.image} alt="" loading="lazy" onError={() => setFailed(true)}/> : fallback}
  </span>;
}

function CommandPreview({ row }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [row?.image]);
  if (!row) return <div className="command-preview"><div className="command-preview-stage is-empty"><div className="command-preview-empty"><ImagePlus size={22}/><strong>Sin comando seleccionado</strong><span>Selecciona un comando para ver su vista previa.</span></div></div></div>;
  const chips = mediaChips(row);
  const hasMedia = row.image || row.video || row.audio;
  return <div className="command-preview">
    <div className="command-preview-stage" data-filled={hasMedia ? 'true' : 'false'}>
      {row.video
        ? <video key={row.video} src={row.video} controls playsInline preload="metadata" className="command-preview-video"/>
        : row.image
          ? failed
            ? <p className="command-preview-error" role="alert">No se pudo abrir esta imagen. Si es un enlace de Tenor, guarda el comando para resolverla.</p>
            : <img key={row.image} src={row.image} alt={'Vista previa de ' + row.command} onError={() => setFailed(true)}/>
          : row.audio
            ? <div className="command-preview-audio"><span className="command-preview-audio-icon"><Music2 size={18}/></span><audio key={row.audio} src={row.audio} controls preload="metadata"/></div>
            : <div className="command-preview-empty">
              <Type size={22}/>
              <strong>{row.text ? 'Solo texto' : 'Sin multimedia'}</strong>
              <span>{row.text ? 'El mensaje se mostrará sobre el directo.' : 'Añade una imagen, un clip o un sonido.'}</span>
            </div>}
    </div>
    {row.text && <p className="command-preview-text">{row.text}</p>}
    {chips.length
      ? <div className="command-preview-chips">{chips.map(({ key, label, icon: Icon }) => <span className="command-chip" key={key}><Icon size={11}/>{label}</span>)}</div>
      : <p className="help command-preview-hint">Este comando todavía no tiene ningún recurso.</p>}
  </div>;
}

function CommandRow({ row, locked, onEdit, onToggle, onDuplicate, onDelete }) {
  const chips = mediaChips(row);
  return <article className="command-row" data-active={row.enabled ? 'true' : 'false'}>
    <button type="button" className="command-row-main" onClick={() => onEdit(row.id)} aria-label={'Editar ' + row.command}>
      <CommandThumb row={row}/>
      <span className="command-row-copy">
        <span className="command-row-title">
          <strong>{row.command}</strong>
          <Badge className={row.enabled ? 'success' : ''}>{row.enabled ? 'Activo' : 'Inactivo'}</Badge>
        </span>
        <span className="command-row-description">{row.description || 'Sin descripción'}</span>
        {chips.length > 0 && <span className="command-row-chips">{chips.map(({ key, label, icon: Icon }) => <span className="command-chip" key={key}><Icon size={10}/>{label}</span>)}</span>}
      </span>
    </button>
    <div className="command-row-actions">
      <Switch checked={Boolean(row.enabled)} disabled={locked} aria-label={(row.enabled ? 'Desactivar ' : 'Activar ') + row.command} onCheckedChange={value => onToggle(row.id, value)}/>
      <Button variant="ghost" size="icon" onClick={() => onEdit(row.id)} aria-label={'Editar ' + row.command} title="Editar"><Pencil size={15}/></Button>
      <Button variant="ghost" size="icon" disabled={locked} onClick={() => onDuplicate(row.id)} aria-label={'Duplicar ' + row.command} title="Duplicar"><Copy size={15}/></Button>
      <Button variant="ghost" size="icon" disabled={locked} onClick={() => onDelete(row.id)} aria-label={'Eliminar ' + row.command} title="Eliminar"><Trash2 size={15}/></Button>
    </div>
  </article>;
}

function CommandEditorDialog({ open, row, locked, busy, dirty, onClose, onEdit, onMedia, onUpload, onDuplicate, onDelete, onTest, onSave }) {
  useDialogDismiss(open, onClose);
  const first = useRef(null);
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      if (window.matchMedia && window.matchMedia('(min-width: 900px)').matches) first.current?.focus();
    }, 40);
    return () => window.clearTimeout(timer);
  }, [open]);
  if (!row) return null;
  return <Dialog open={open} onClose={onClose} className="commands-dialog commands-dialog-editor" backdropClassName="commands-dialog-backdrop" aria-labelledby="commands-editor-title">
    <header className="commands-dialog-header">
      <div className="commands-dialog-heading">
        <span className="commands-dialog-icon"><Sparkles size={18}/></span>
        <div>
          <h2 id="commands-editor-title">{row.command || 'Nuevo comando'}</h2>
          <p className="help">Configura qué ocurre cuando alguien escribe la palabra en el chat.</p>
        </div>
      </div>
      <div className="commands-dialog-header-actions">
        <Badge className={row.enabled ? 'success' : ''}>{row.enabled ? 'Activo' : 'Inactivo'}</Badge>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar editor"><X size={18}/></Button>
      </div>
    </header>
    <div className="commands-dialog-body">
      <fieldset className="commands-dialog-fieldset" disabled={locked}>
        <div className="commands-dialog-form">
          <section className="commands-dialog-section">
            <div className="commands-dialog-section-heading">
              <h3>Comando</h3>
              <Toggle name="enabled" label={row.enabled ? 'Activo' : 'Inactivo'} settings={row} update={(_, value) => onEdit(row.id, 'enabled', value)} disabled={locked}/>
            </div>
            <div className="commands-dialog-fields">
              <Field label="Palabra del comando" hint="Debe empezar por ! y no tener espacios.">{id => <Input ref={first} id={id} value={row.command} maxLength={41} onChange={event => onEdit(row.id, 'command', event.target.value)}/>}</Field>
              <Field label="Descripción corta" hint="Se muestra junto al comando en la lista.">{id => <Input id={id} value={row.description ?? ''} maxLength={100} placeholder="Ej.: Reproduce el sonido de la definitiva de Sion" onChange={event => onEdit(row.id, 'description', event.target.value)}/>}</Field>
            </div>
          </section>
          <section className="commands-dialog-section">
            <div className="commands-dialog-section-heading">
              <div><h3>Multimedia</h3><p className="help">Una imagen o un clip, con sonido opcional.</p></div>
            </div>
            <div className="commands-dialog-media">
              {mediaFields.map(({ kind, label }) => <MediaFileField key={kind} kind={kind} title={label} src={row[kind]} hint={kind === 'video' ? 'máximo 30 segundos' : undefined} onRemove={() => onMedia(row.id, kind, '')} removeLabel={'Quitar ' + label.toLowerCase()} compact disabled={locked} onFile={file => onUpload(row.id, kind, file)}>
                <details className="command-file-url">
                  <summary>Usar enlace</summary>
                  <Field label={'Enlace de ' + label.toLowerCase()} hint={kind === 'image' ? 'Enlace directo o de Tenor.' : 'Enlace directo al archivo.'}>{id => <Input id={id} value={row[kind] ?? ''} placeholder="https://..." onChange={event => onMedia(row.id, kind, event.target.value)}/>}</Field>
                </details>
              </MediaFileField>)}
            </div>
          </section>
          <section className="commands-dialog-section">
            <div className="commands-dialog-section-heading">
              <div><h3>Reproducción</h3><p className="help">Ajusta el mensaje y cuánto tiempo permanece en pantalla.</p></div>
            </div>
            <Field label="Texto de notificación (opcional)" hint="Se muestra debajo de la imagen o el clip.">{id => <Input id={id} maxLength={200} value={row.text ?? ''} onChange={event => onEdit(row.id, 'text', event.target.value)}/>}</Field>
            <div className="commands-dialog-fields is-three">
              <Field label="Duración visual · s">{id => <Input id={id} type="number" min="1" max="120" value={row.duration} onChange={event => onEdit(row.id, 'duration', event.target.value === '' ? '' : Number(event.target.value))}/>}</Field>
              <Field label="Volumen · %">{id => <Input id={id} type="number" min="0" max="100" value={row.volume} onChange={event => onEdit(row.id, 'volume', event.target.value === '' ? '' : Number(event.target.value))}/>}</Field>
              <Field label="Cooldown · s/usuario" hint="0 desactiva la espera.">{id => <Input id={id} type="number" min="0" max="3600" value={row.cooldown ?? 0} onChange={event => onEdit(row.id, 'cooldown', event.target.value === '' ? '' : Number(event.target.value))}/>}</Field>
            </div>
          </section>
        </div>
      </fieldset>
      <aside className="commands-dialog-preview">
        <div className="commands-dialog-section-heading"><h3>Vista previa</h3></div>
        <CommandPreview row={row}/>
        <Button variant="outline" size="sm" disabled={locked} onClick={() => onTest(row.id)}><Play size={15}/>Probar en salida</Button>
        <p className="help">La prueba abre la ventana de salida y envía el comando.</p>
      </aside>
    </div>
    <footer className="commands-dialog-footer">
      <Button variant="ghost" onClick={() => onDelete(row.id)} disabled={locked}><Trash2 size={15}/>Eliminar</Button>
      <div className="actions">
        <Button variant="ghost" onClick={() => onDuplicate(row.id)} disabled={locked}><Copy size={15}/>Duplicar</Button>
        <Button variant="outline" onClick={onClose}>Listo</Button>
        <Button onClick={onSave} disabled={locked || !dirty}>{busy ? 'Guardando…' : 'Guardar comandos'}</Button>
      </div>
    </footer>
  </Dialog>;
}

function DeleteCommandDialog({ row, locked, onCancel, onConfirm }) {
  useDialogDismiss(Boolean(row), onCancel);
  return <Dialog open={Boolean(row)} onClose={onCancel} className="commands-dialog commands-dialog-confirm" backdropClassName="commands-dialog-backdrop" aria-labelledby="commands-delete-title">
    <span className="commands-confirm-icon"><Trash2 size={20}/></span>
    <h2 id="commands-delete-title">{row ? 'Eliminar ' + row.command : 'Eliminar comando'}</h2>
    <p>{row ? 'El comando se quitará de la lista. Guarda los cambios para aplicarlo; aún puedes descartarlos antes de guardar.' : ''}</p>
    <div className="commands-confirm-actions">
      <Button variant="outline" onClick={onCancel}>Cancelar</Button>
      <Button variant="destructive" onClick={onConfirm} disabled={locked}>Eliminar comando</Button>
    </div>
  </Dialog>;
}

function ListSettingsDialog({ open, onClose, config, update, locked, busy, dirty, listCommand, activeCount, onSave }) {
  useDialogDismiss(open, onClose);
  const cooldown = modelCooldown(config.listCooldown);
  return <Dialog open={open} onClose={onClose} className="commands-dialog commands-dialog-settings" backdropClassName="commands-dialog-backdrop" aria-labelledby="commands-list-title">
    <header className="commands-dialog-header">
      <div className="commands-dialog-heading">
        <span className="commands-dialog-icon"><ListChecks size={18}/></span>
        <div>
          <h2 id="commands-list-title">Lista en el directo</h2>
          <p className="help">La lista reúne los comandos activos y se muestra en la salida del directo.</p>
        </div>
      </div>
      <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar ajustes de la lista"><X size={18}/></Button>
    </header>
    <div className="commands-dialog-body is-single">
      <fieldset className="commands-dialog-fieldset" disabled={locked}>
        <Toggle name="listAlwaysVisible" label="Mantener la lista visible siempre" description="Si lo desactivas, se oculta a los 12 segundos." settings={config} update={(_, value) => update(old => ({ ...old, listAlwaysVisible: value }))}/>
        <div className="commands-dialog-fields">
          <Field label="Palabra para mostrar la lista" hint="Sin espacios. Ej.: !comandos.">{id => <Input id={id} maxLength={41} value={config.listCommand ?? '!comandos'} onChange={event => update(old => ({ ...old, listCommand: event.target.value }))}/>}</Field>
          <Field label="Cooldown de la lista · s/usuario" hint="0 desactiva la espera.">{id => <Input id={id} type="number" min="0" max="3600" value={config.listCooldown ?? 20} onChange={event => update(old => ({ ...old, listCooldown: event.target.value === '' ? '' : Number(event.target.value) }))}/>}</Field>
        </div>
      </fieldset>
      <div className="commands-dialog-note">
        <span className="commands-live-keyword-code">{listCommand}</span>
        <span className="help">{activeCount === 1 ? '1 comando activo' : activeCount + ' comandos activos'} · hasta 6 por página. Añade un número al final para abrir otra página.</span>
      </div>
      <p className="help">Cooldown actual: {cooldown === 0 ? 'sin espera' : cooldown + ' segundos por usuario'}.</p>
    </div>
    <footer className="commands-dialog-footer">
      <p className="help">{dirty ? 'Cambios sin guardar.' : 'Los cambios se aplican al guardar los comandos.'}</p>
      <div className="actions">
        <Button variant="outline" onClick={onClose}>Listo</Button>
        <Button onClick={onSave} disabled={locked || !dirty}>{busy ? 'Guardando…' : 'Guardar comandos'}</Button>
      </div>
    </footer>
  </Dialog>;
}

function modelCooldown(value) {
  if (value === '' || value === null || value === undefined) return 20;
  const number = Number(value);
  return Number.isFinite(number) ? number : 20;
}

export function CommandsStudio({ tool, api, notice, online, connected }) {
  const [config, setConfig] = useState(tool.config);
  const [saved, setSaved] = useState(tool.config);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [selectedId, setSelectedId] = useState(tool.config.commands[0]?.id ?? null);
  const [editorId, setEditorId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [listOpen, setListOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [mobileView, setMobileView] = useState('editor');
  const [view, setView] = useState(() => { try { return localStorage.getItem('studio.commands.view') === 'grid' ? 'grid' : 'list'; } catch { return 'list'; } });
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
  const commands = config.commands ?? [];
  const selected = commands.find(row => row.id === selectedId) ?? commands[0] ?? null;
  const editorRow = commands.find(row => row.id === editorId) ?? null;
  const deleteRow = commands.find(row => row.id === deleteId) ?? null;
  const listCommand = config.listCommand ?? '!comandos';
  const activeCount = commands.filter(row => row.enabled).length;
  const listCooldown = modelCooldown(config.listCooldown);
  const locked = busy || !online;
  const url = new URL(commandsOutputPath, location.origin).href;
  const listUrl = new URL(commandsListOutputPath, location.origin).href;
  const normalizedQuery = query.trim().toLowerCase();
  const visible = commands.filter(row => {
    if (filter === 'active' && !row.enabled) return false;
    if (filter === 'inactive' && row.enabled) return false;
    if (!normalizedQuery) return true;
    return [row.command, row.description, row.text].some(value => String(value ?? '').toLowerCase().includes(normalizedQuery));
  });
  const filterCount = id => id === 'active' ? activeCount : id === 'inactive' ? commands.length - activeCount : commands.length;

  function openEditor(id) { setSelectedId(id); setEditorId(id); setMobileView('editor'); }
  function addCommand() {
    if (commands.length >= 100) { notice('Puedes guardar hasta 100 comandos.', { type: 'warning' }); return; }
    const id = crypto.randomUUID();
    const next = { id, command: nextCommandName(commands), description: '', enabled: false, image: '', audio: '', video: '', text: '', duration: 5, volume: 80, cooldown: 0 };
    update(old => ({ ...old, commands: [...old.commands, next] }));
    openEditor(id);
  }
  function duplicateCommand(id) {
    const source = commands.find(row => row.id === id);
    if (!source) return;
    if (commands.length >= 100) { notice('Puedes guardar hasta 100 comandos.', { type: 'warning' }); return; }
    const copy = { ...source, id: crypto.randomUUID(), command: nextCommandName(commands), enabled: false };
    update(old => ({ ...old, commands: [...old.commands, copy] }));
    openEditor(copy.id);
    notice('Comando duplicado. Ajusta la palabra y actívalo cuando esté listo.', { type: 'info' });
  }
  function confirmDelete() {
    if (!deleteId) return;
    update(old => ({ ...old, commands: old.commands.filter(row => row.id !== deleteId) }));
    setEditorId(null);
    setDeleteId(null);
  }
  function discardChanges() {
    setConfig(saved);
    setDirty(false);
    setEditorId(null);
    setSelectedId(saved.commands[0]?.id ?? null);
    notice('Cambios descartados.', { type: 'info' });
  }
  async function testOutput(id) {
    const output = window.open(id === '!comandos' ? listUrl : url, id === '!comandos' ? 'live-studio-commands-list' : 'live-studio-commands-output');
    if (!output) { notice('Permite las ventanas emergentes para abrir la salida de comandos.', { type: 'warning' }); return; }
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
      setConfig(next); setSaved(next); setDirty(false); notice('Comandos guardados.'); return true;
    } catch (e) { notice(e.message, { type: 'error' }); return false; }
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
    } catch (e) { notice(e.message, { type: 'error' }); }
    finally { setBusy(false); }
  }

  return <div className="commands-editor editor-workspace">
    <header className="editor-workspace-header commands-header">
      <div className="commands-heading">
        <span className="commands-heading-icon"><Sparkles size={21}/></span>
        <div>
          <h1 className="editor-workspace-title">Comandos de chat</h1>
          <p className="commands-subtitle">GIF, clips y sonidos que tu comunidad activa con una palabra.</p>
        </div>
      </div>
      <OutputToolbar connected={connected} description={connected ? 'Recibiendo mensajes del LIVE.' : 'Conecta TikTok para recibir comandos.'}>
        <OutputLinks notice={notice} url={url} message="Salida de comandos copiada." fallback="Salida" size="sm" iconSize={15}/>
        <Button variant="outline" size="sm" disabled={!online} onClick={async () => { if (await api('commands/clear')) notice('Salida de comandos detenida.', { type: 'info' }); }}>Detener salida</Button>
      </OutputToolbar>
    </header>
    {tool.error && <p className="error" role="alert">{tool.error}</p>}
    <EditorViewSwitch view={mobileView} change={setMobileView} editorLabel="Comandos" monitorLabel="Vista previa y lista"/>
    <div className="editor-workspace-grid" data-view={mobileView}>
      <Card className="commands-settings editor-workspace-settings">
        <div className="commands-summary">
          <div className="commands-summary-copy">
            <h2>Comandos</h2>
            <p className="help">Pulsa un comando para editarlo o usa el interruptor para activarlo.</p>
          </div>
          <div className="commands-summary-side">
            <div className="commands-stats" aria-label="Resumen de comandos">
              <span className="commands-stat"><span className="commands-stat-dot" data-on={activeCount > 0}/><strong>{activeCount}</strong> activos</span>
              <span className="commands-stat"><strong>{commands.length}</strong> en total</span>
            </div>
            <Toggle name="enabled" label="Comandos activos" settings={config} update={(_, enabled) => update(old => ({ ...old, enabled }))} disabled={locked}/>
          </div>
        </div>

        <div className="commands-toolbar">
          <div className="commands-search">
            <Search size={15} aria-hidden="true"/>
            <Input type="search" value={query} placeholder="Buscar comando o descripción…" aria-label="Buscar comandos" onChange={event => setQuery(event.target.value)}/>
            {query && <button type="button" className="commands-search-clear" onClick={() => setQuery('')} aria-label="Limpiar búsqueda"><X size={14}/></button>}
          </div>
          <div className="commands-filters" role="group" aria-label="Filtrar comandos">
            {filters.map(item => <button type="button" key={item.id} className="commands-filter" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>
              {item.label}<span>{filterCount(item.id)}</span>
            </button>)}
          </div>
          <div className="commands-toolbar-actions">
            <div className="commands-view-toggle" role="group" aria-label="Vista de comandos">
              <Button variant="ghost" size="icon" aria-pressed={view === 'grid'} aria-label="Vista de cuadrícula" title="Cuadrícula" onClick={() => changeView('grid')}><LayoutGrid size={15}/></Button>
              <Button variant="ghost" size="icon" aria-pressed={view === 'list'} aria-label="Vista de lista" title="Lista" onClick={() => changeView('list')}><List size={15}/></Button>
            </div>
            <Button onClick={addCommand} disabled={locked || commands.length >= 100}><Plus size={15}/>Nuevo comando</Button>
          </div>
        </div>

        {commands.length === 0
          ? <div className="commands-empty">
            <Sparkles size={24}/>
            <strong>Tu primer comando</strong>
            <p>Crea un comando con una imagen, un clip o un sonido. Tu comunidad lo activará escribiéndolo en el chat.</p>
            <Button size="sm" onClick={addCommand} disabled={locked}><Plus size={14}/>Crear comando</Button>
          </div>
          : visible.length === 0
            ? <div className="commands-empty">
              <Search size={24}/>
              <strong>Sin resultados</strong>
              <p>No hay comandos que coincidan con “{query || (filter === 'active' ? 'activos' : 'inactivos')}”.</p>
              <Button size="sm" variant="outline" onClick={() => { setQuery(''); setFilter('all'); }}>Limpiar filtros</Button>
            </div>
            : <div className={'commands-list commands-view-' + view}>
              {visible.map(row => <CommandRow key={row.id} row={row} locked={locked}
                onEdit={openEditor}
                onToggle={(id, value) => edit(id, 'enabled', value)}
                onDuplicate={duplicateCommand}
                onDelete={id => { setSelectedId(id); setDeleteId(id); }}/>)}
            </div>}

        <div className="commands-savebar">
          <span className={busy ? 'help' : dirty ? 'unsaved' : 'help'} role="status">{busy ? 'Procesando…' : dirty ? 'Cambios sin guardar' : 'Guardado en este equipo'}</span>
          <div className="commands-savebar-actions">
            {dirty && <Button variant="ghost" size="sm" disabled={busy} onClick={discardChanges}>Descartar</Button>}
            <Button size="sm" disabled={locked || !dirty} onClick={save}>{busy ? 'Guardando…' : 'Guardar comandos'}</Button>
          </div>
        </div>
      </Card>

      <div className="commands-monitor editor-workspace-monitor">
        <Card className="commands-preview-card">
          <div className="commands-panel-heading">
            <div>
              <h2>Vista previa</h2>
              <p className="help">{selected ? 'Así se verá en la salida del directo.' : 'Selecciona un comando para previsualizarlo.'}</p>
            </div>
            {selected && <Badge className={selected.enabled ? 'success' : ''}>{selected.enabled ? 'Activo' : 'Inactivo'}</Badge>}
          </div>
          {selected
            ? <>
              <div className="commands-preview-command">
                <strong>{selected.command}</strong>
                <span>{selected.description || 'Sin descripción'}</span>
              </div>
              <CommandPreview row={selected}/>
              <div className="commands-preview-actions">
                <Button size="sm" variant="outline" disabled={locked} onClick={() => testOutput(selected.id)}><Play size={14}/>Probar en salida</Button>
                <Button size="sm" variant="ghost" onClick={() => openEditor(selected.id)}><Pencil size={14}/>Editar</Button>
              </div>
            </>
            : <div className="commands-empty is-compact">
              <Sparkles size={22}/>
              <strong>Aún no hay comandos</strong>
              <p>Crea tu primer comando para probarlo aquí.</p>
              <Button size="sm" onClick={addCommand} disabled={locked}><Plus size={14}/>Crear comando</Button>
            </div>}
        </Card>

        <Card className="commands-live-card">
          <div className="commands-panel-heading">
            <div>
              <h2>Lista en el directo</h2>
              <p className="help">Escribe la palabra para mostrar los comandos activos.</p>
            </div>
            <Badge className={config.listAlwaysVisible ? 'success' : ''}>{config.listAlwaysVisible ? 'Siempre visible' : 'Bajo demanda'}</Badge>
          </div>
          <div className="commands-live-keyword">
            <div>
              <span>Palabra clave</span>
              <code>{listCommand}</code>
            </div>
            <Button variant="outline" size="sm" onClick={() => setListOpen(true)}><Settings2 size={14}/>Ajustes</Button>
          </div>
          <dl className="commands-live-meta">
            <div><dt>Cooldown</dt><dd>{listCooldown === 0 ? 'Sin espera' : listCooldown + ' s'}</dd></div>
            <div><dt>Comandos activos</dt><dd>{activeCount}</dd></div>
          </dl>
          <p className="help">La lista muestra 6 comandos por página. Añade un número al final para abrir otra página.</p>
          <div className="actions commands-live-actions">
            <OutputLinks notice={notice} url={listUrl} message="Salida de la lista copiada." fallback="Salida de la lista" copyLabel="Copiar lista" openLabel="Abrir lista" size="sm"/>
            <Button variant="outline" size="sm" disabled={locked} onClick={() => testOutput('!comandos')}>Probar {listCommand}</Button>
          </div>
        </Card>
      </div>
    </div>

    <CommandEditorDialog open={Boolean(editorRow)} row={editorRow} locked={locked} busy={busy} dirty={dirty}
      onClose={() => setEditorId(null)} onEdit={edit} onMedia={editMedia} onUpload={upload}
      onDuplicate={duplicateCommand}
      onDelete={id => { setEditorId(null); setDeleteId(id); }}
      onTest={testOutput} onSave={save}/>
    <DeleteCommandDialog row={deleteRow} locked={busy} onCancel={() => setDeleteId(null)} onConfirm={confirmDelete}/>
    <ListSettingsDialog open={listOpen} onClose={() => setListOpen(false)} config={config} update={update} locked={locked} busy={busy} dirty={dirty} listCommand={listCommand} activeCount={activeCount} onSave={save}/>
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
  const visual = online && current && (current.expiresAt == null || current.expiresAt > now) ? current : null;
  const audio = !listOnly && online && tool?.audio?.expiresAt > now ? tool.audio : null;
  const pages = Math.max(1, Math.ceil((visual?.help?.length || 0) / 6));
  const page = visual?.page != null
    ? Math.min(pages - 1, Math.max(0, visual.page - 1))
    : Math.floor(Math.max(0, now - (visual?.startedAt || now)) / 8000) % pages;
  return <div className="commands-stage">
    {visual?.help && <section className="commands-help" lang="en">
      <h2>Commands:</h2>
      {visual.help.length ? <ul role="list">
        {visual.help.slice(page * 6, page * 6 + 6).map(({ command }) => <li key={command}>{command}</li>)}
      </ul> : <p lang="es">No hay comandos activos.</p>}
    </section>}
    {visual && !visual.help && <div className="command-visual" key={'visual-' + visual.id}>
      {visual.video && <CommandVideo key={visual.id} event={visual} muted={!!tool?.audio?.src || tool?.audio?.id !== visual.id} onError={setError}/>}
      {!visual.video && visual.image && <img src={visual.image} alt="" onError={() => setError('No se pudo cargar la imagen del comando.')}/>}
      {visual.text && <p>{visual.text}</p>}
    </div>}
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
