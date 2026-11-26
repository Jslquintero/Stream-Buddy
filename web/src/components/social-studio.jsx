import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Share2,
  SkipBack,
  SkipForward,
  Trash2,
  X,
} from 'lucide-react';
import { Badge, Button, Card, Dialog, Input, Select, Switch, Textarea } from './ui';
import { Field, NumberSettings, OverlayColors, Toggle } from './fields';
import { OutputLinks, OutputToolbar } from './output-controls';
import { EditorViewSwitch } from './editor-view-switch';
import { useNotificationSettings } from '../hooks/use-notification-settings';
import { useStudio } from '../hooks/use-studio';
import {
  defaultSocial,
  validateSocial,
  socialOutputPath,
  socialPlatforms,
  socialPlatform,
  socialAnimations,
  socialPositions,
  socialLayouts,
  socialStyles,
  socialBorderStyles,
} from '../../../modules/social/config';
import { SocialPlatformIcon } from './social-icons';
import './editor-workspace.css';
import './social.css';
import './social-editor.css';

const storage = { key: 'live-studio.social.pending.v1', validate: validateSocial, migrate: validateSocial, action: 'social/save' };
const positionLabel = id => socialPositions.find(([value]) => value === id)?.[1] ?? 'Abajo · izquierda';
const layoutLabel = id => socialLayouts.find(([value]) => value === id)?.[1] ?? 'Tarjeta · completa';
const styleLabel = id => socialStyles.find(([value]) => value === id)?.[1] ?? 'Limpio';

function safeColor(value, fallback) {
  return typeof value === 'string' && /^#[a-f0-9]{6}$/i.test(value) ? value : fallback;
}

function alpha(value, opacity) {
  return value + Math.round(Math.max(0, Math.min(1, opacity)) * 255).toString(16).padStart(2, '0');
}

function randomStep(previous, length) {
  if (length < 2) return 0;
  let next = previous;
  while (next === previous) next = Math.floor(Math.random() * length);
  return next;
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

export function useSocialRotation(config, { auto = true } = {}) {
  const settings = config ?? defaultSocial;
  const channels = (settings.channels ?? []).filter(channel => channel && channel.enabled);
  const signature = JSON.stringify(channels.map(channel => channel.id));
  const [index, setIndex] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [signature]);

  useEffect(() => {
    if (!auto || channels.length < 2) return;
    const interval = Math.max(2, Number(settings.interval) || 6) * 1000;
    const timer = setInterval(() => {
      setIndex(previous => settings.random ? randomStep(previous, channels.length) : (previous + 1) % channels.length);
      setCycle(value => value + 1);
    }, interval);
    return () => clearInterval(timer);
  }, [auto, channels.length, settings.interval, settings.random, signature, epoch]);

  const step = useCallback(delta => {
    setIndex(previous => {
      const length = channels.length;
      if (!length) return 0;
      if (delta > 0 && settings.random) return randomStep(previous, length);
      return (previous + delta + length) % length;
    });
    setCycle(value => value + 1);
    setEpoch(value => value + 1);
  }, [channels.length, settings.random]);

  const restart = useCallback(() => {
    setIndex(0);
    setCycle(value => value + 1);
    setEpoch(value => value + 1);
  }, []);

  const select = useCallback(id => {
    const next = channels.findIndex(channel => channel.id === id);
    if (next < 0) return false;
    setIndex(next);
    setCycle(value => value + 1);
    setEpoch(value => value + 1);
    return true;
  }, [signature]);

  return {
    channel: channels.length ? channels[index % channels.length] : null,
    index,
    count: channels.length,
    cycle,
    next: () => step(1),
    previous: () => step(-1),
    restart,
    select,
  };
}

export function SocialCard({ channel, config, cycle = 0, progress = true }) {
  const settings = { ...defaultSocial, ...config };
  const meta = socialPlatform(channel.platform);
  const channelColor = safeColor(channel.color, meta.color);
  const background = safeColor(settings.background, '#0f1218');
  const accent = safeColor(settings.accent, '#b9f678');
  const shadowColor = safeColor(settings.shadowColor, '#000000');
  const flat = Math.max(0, Number(settings.opacity) || 0) <= 0;
  const label = channel.label || meta.name;
  const style = {
    '--social-width': (Number(settings.width) || 460) + 'px',
    '--social-bg': alpha(background, (Number(settings.opacity) || 0) / 100),
    '--social-border': alpha(accent, Math.min(100, Math.max(0, Number(settings.borderOpacity ?? 100))) / 100),
    '--social-border-width': (Number(settings.borderWidth) || 0) + 'px',
    '--social-border-style': settings.borderStyle || 'solid',
    '--social-color': safeColor(settings.color, '#ffffff'),
    '--social-text-shadow': settings.textShadow ? `0 0.1em 0.4em ${alpha(shadowColor, 0.65)}` : 'none',
    '--social-accent': accent,
    '--social-channel': channelColor,
    '--social-channel-bg': alpha(channelColor, 0.16),
    '--social-channel-border': alpha(channelColor, 0.5),
    '--social-channel-glow': alpha(channelColor, 0.24),
    '--social-radius': (Number(settings.radius) || 0) + 'px',
    '--social-interval': (Number(settings.interval) || 6) + 's',
    '--social-icon-size': (Number(settings.iconSize) || 56) + 'px',
  };
  return <article className={'social-card social-layout-' + (settings.layout || 'card') + ' social-style-' + (settings.style || 'clean') + ' social-animation-' + (settings.animation || 'pop') + (flat ? ' social-flat' : '')} style={style}
    aria-label={[label, channel.handle].filter(Boolean).join(', ')} data-cycle={cycle}>
    <span className="social-glow" aria-hidden="true"/>
    {settings.showIcon && <span className="social-icon"><SocialPlatformIcon platform={channel.platform} size={38}/></span>}
    <span className="social-copy">
      {settings.heading && <span className="social-heading">{settings.heading}</span>}
      {settings.showLabel && <strong className="social-label">{label}</strong>}
      {settings.showHandle && channel.handle && <span className="social-handle">{channel.handle}</span>}
    </span>
    {settings.showProgress && progress && <span className="social-progress" aria-hidden="true"><i/></span>}
  </article>;
}

export function SocialOutput() {
  const { state, online } = useStudio('social');
  const tool = state?.tools.social;
  const config = tool?.config;
  const rotation = useSocialRotation(config, { auto: true });

  useEffect(() => {
    document.documentElement.classList.add('social-output');
    document.documentElement.style.colorScheme = 'normal';
    return () => {
      document.documentElement.classList.remove('social-output');
      document.documentElement.style.removeProperty('color-scheme');
    };
  }, []);

  return <>
    <CustomCss value={config?.customCss}/>
    <div className={'social-stage ' + (config?.position || 'bottom-left')}>
      {online && config?.enabled && rotation.channel && <SocialCard key={rotation.channel.id + '-' + rotation.cycle}
        channel={rotation.channel} config={config} cycle={rotation.cycle} progress={rotation.count > 1}/>}
    </div>
  </>;
}

function CustomCss({ value }) {
  return value ? <style>{value}</style> : null;
}

function ChannelRow({ channel, index, count, active, onPreview, onEdit, onMove, onRemove, onToggle }) {
  const meta = socialPlatform(channel.platform);
  const label = channel.label || meta.name;
  const showPlatform = label.trim().toLowerCase() !== meta.name.toLowerCase();
  return <article className="social-channel-row" data-active={active ? 'true' : 'false'} data-disabled={channel.enabled ? 'false' : 'true'}>
    <span className="social-channel-order" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
    <button type="button" className="social-channel-main" onClick={() => onPreview(channel)} aria-label={'Seleccionar ' + label + ' en la vista previa'}>
      <span className="social-channel-icon" style={{ '--social-channel': safeColor(channel.color, meta.color) }}>
        <SocialPlatformIcon platform={channel.platform} size={19}/>
      </span>
      <span className="social-channel-copy">
        <span className="social-channel-title">
          <strong>{label}</strong>
          {!channel.enabled && <Badge>Oculta</Badge>}
        </span>
        <span className="social-channel-meta">
          <span>{channel.handle || meta.placeholder}</span>
          {showPlatform && <span aria-hidden="true">·</span>}
          {showPlatform && <span>{meta.name}</span>}
        </span>
      </span>
    </button>
    <div className="social-channel-actions">
      <span className="social-order-buttons">
        <Button variant="ghost" size="icon" aria-label={'Subir ' + label} title="Subir"
          disabled={index === 0} onClick={() => onMove(channel.id, -1)}><ArrowUp size={14}/></Button>
        <Button variant="ghost" size="icon" aria-label={'Bajar ' + label} title="Bajar"
          disabled={index === count - 1} onClick={() => onMove(channel.id, 1)}><ArrowDown size={14}/></Button>
      </span>
      <Switch checked={channel.enabled} aria-label={'Mostrar ' + label + ' en el directo'}
        onCheckedChange={value => onToggle(channel.id, value)}/>
      <Button variant="ghost" size="icon" aria-label={'Editar ' + label} title="Editar" onClick={() => onEdit(channel.id)}><Pencil size={15}/></Button>
      <Button variant="ghost" size="icon" aria-label={'Eliminar ' + label} title={count <= 1 ? 'La rotación necesita al menos una red' : 'Eliminar'}
        disabled={count <= 1} onClick={() => onRemove(channel.id)}><Trash2 size={15}/></Button>
    </div>
  </article>;
}

function ChannelEditorDialog({ open, channel, config, index, count, locked, saving, dirty, error, onClose, onEdit, onDelete, onDuplicate }) {
  useDialogDismiss(open, onClose);
  const first = useRef(null);
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => first.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [open, channel?.id]);
  if (!channel) return null;
  const meta = socialPlatform(channel.platform);
  const label = channel.label || meta.name;
  const color = safeColor(channel.color, meta.color);
  return <Dialog open={open} onClose={onClose} className="social-dialog social-dialog-editor" backdropClassName="social-dialog-backdrop" aria-labelledby="social-channel-title">
    <header className="social-dialog-header">
      <div className="social-dialog-heading">
        <span className="social-dialog-icon" style={{ '--social-channel': color }}><SocialPlatformIcon platform={channel.platform} size={18}/></span>
        <div>
          <h2 id="social-channel-title">{label || 'Editar red'}</h2>
          <p className="help">Personaliza cómo aparece esta red cuando le toca el turno.</p>
        </div>
      </div>
      <div className="social-dialog-header-actions">
        <Badge className={channel.enabled ? 'success' : ''}>{channel.enabled ? 'Visible' : 'Oculta'}</Badge>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar editor de red"><X size={18}/></Button>
      </div>
    </header>
    <div className="social-dialog-body">
      <fieldset className="social-dialog-form" disabled={locked}>
        <section className="social-dialog-section">
          <div className="social-dialog-section-heading">
            <h3>Red social</h3>
            <Toggle name="enabled" label={channel.enabled ? 'Visible' : 'Oculta'} settings={channel} update={(_, value) => onEdit(channel.id, { enabled: value })}/>
          </div>
          <div className="social-dialog-fields">
            <Field label="Plataforma">{id => <Select id={id} value={channel.platform} onChange={event => onEdit(channel.id, { platform: event.target.value })}>
              {socialPlatforms.map(platform => <option key={platform.id} value={platform.id}>{platform.name}</option>)}
            </Select>}</Field>
            <Field label="Color">{id => <span className="social-color-field">
              <Input id={id} type="color" value={color} onChange={event => onEdit(channel.id, { color: event.target.value })}/>
              <code>{color.toUpperCase()}</code>
              <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(channel.id, { color: meta.color })}>Restablecer</Button>
            </span>}</Field>
          </div>
          <Field label="Nombre visible" hint="Aparece como título principal de la tarjeta.">{id => <Input ref={first} id={id} value={channel.label ?? ''} maxLength={50}
            onChange={event => onEdit(channel.id, { label: event.target.value })}/>}</Field>
          <div className="social-dialog-fields">
            <Field label="Usuario o texto" hint={'Ej.: ' + meta.placeholder}>{id => <Input id={id} value={channel.handle ?? ''} maxLength={80} placeholder={meta.placeholder}
              onChange={event => onEdit(channel.id, { handle: event.target.value })}/>}</Field>
            <Field label="Enlace (opcional)" hint="Solo como referencia; la tarjeta no lo muestra.">{id =>
              <Input id={id} type="url" value={channel.url ?? ''} maxLength={2048} placeholder="https://..."
                onChange={event => onEdit(channel.id, { url: event.target.value })}/>}</Field>
          </div>
        </section>
        <div className="social-dialog-note">
          <span className="social-dialog-note-index">{index + 1}<small>/{count}</small></span>
          <p className="help">Es la posición de esta red en la rotación. Usa las flechas de la lista para cambiarla.</p>
        </div>
      </fieldset>
      <aside className="social-dialog-preview">
        <div className="social-dialog-section-heading"><h3>Vista previa</h3></div>
        <div className="social-dialog-preview-stage">
          <SocialCard channel={channel} config={config} cycle={0} progress={false}/>
        </div>
        <p className="help">La salida del directo usa el tamaño y la posición configurados en el panel principal.</p>
      </aside>
    </div>
    <footer className="social-dialog-footer">
      <Button variant="ghost" disabled={locked || count <= 1} title={count <= 1 ? 'La rotación necesita al menos una red' : 'Eliminar red'} onClick={() => onDelete(channel.id)}><Trash2 size={15}/>Eliminar</Button>
      <div className="actions">
        <Button variant="ghost" disabled={locked || count >= 20} onClick={() => onDuplicate(channel.id)}><Copy size={15}/>Duplicar</Button>
        <span className={error ? 'social-save-error' : 'help'} role="status">
          {error || (saving ? 'Guardando…' : dirty ? 'Guardando cambios…' : 'Cambios guardados')}
        </span>
        <Button onClick={onClose}>Listo</Button>
      </div>
    </footer>
  </Dialog>;
}

function DeleteChannelDialog({ channel, count, locked, onCancel, onConfirm }) {
  useDialogDismiss(Boolean(channel), onCancel);
  if (!channel) return null;
  const meta = socialPlatform(channel.platform);
  return <Dialog open onClose={onCancel} className="social-dialog social-dialog-confirm" backdropClassName="social-dialog-backdrop" aria-labelledby="social-delete-title">
    <span className="social-confirm-icon"><Trash2 size={20}/></span>
    <h2 id="social-delete-title">{'Eliminar ' + (channel.label || meta.name)}</h2>
    <p>La red dejará de aparecer en la rotación. El cambio se aplicará automáticamente.</p>
    <div className="social-confirm-actions">
      <Button variant="outline" onClick={onCancel}>Cancelar</Button>
      <Button variant="destructive" disabled={locked || count <= 1} onClick={onConfirm}>Eliminar red</Button>
    </div>
  </Dialog>;
}

function NetworkPickerDialog({ open, available, selection, query, locked, onQuery, onToggle, onClose, onConfirm }) {
  useDialogDismiss(open, onClose);
  const normalized = query.trim().toLowerCase();
  const visible = available.filter(platform => platform.name.toLowerCase().includes(normalized));
  return <Dialog open={open} onClose={onClose} className="social-dialog social-picker" backdropClassName="social-dialog-backdrop" aria-labelledby="social-picker-title">
    <header className="social-dialog-header">
      <div className="social-dialog-heading">
        <span className="social-dialog-icon social-dialog-icon-neutral"><Plus size={18}/></span>
        <div>
          <h2 id="social-picker-title">Añadir redes</h2>
          <p className="help">Elige una o varias redes para sumarlas a la rotación.</p>
        </div>
      </div>
      <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar selector de redes"><X size={18}/></Button>
    </header>
    <div className="social-dialog-body is-single">
      {available.length > 0 && <div className="social-picker-search">
        <Search size={15} aria-hidden="true"/>
        <Input type="search" value={query} placeholder="Buscar red social…" aria-label="Buscar red social" onChange={event => onQuery(event.target.value)}/>
        {query && <button type="button" className="social-picker-search-clear" onClick={() => onQuery('')} aria-label="Limpiar búsqueda"><X size={14}/></button>}
      </div>}
      {available.length === 0
        ? <div className="social-picker-empty"><Check size={24}/><strong>Ya están todas</strong><p>Has añadido las 20 redes disponibles a la rotación.</p></div>
        : visible.length === 0
          ? <div className="social-picker-empty"><Search size={24}/><strong>Sin resultados</strong><p>No hay redes que coincidan con “{query}”.</p></div>
          : <div className="social-picker-grid">
            {visible.map(platform => {
              const checked = selection.includes(platform.id);
              return <label className="social-picker-item" key={platform.id} data-selected={checked ? 'true' : 'false'}>
                <input type="checkbox" checked={checked} disabled={locked} onChange={event => onToggle(platform.id, event.target.checked)}/>
                <span className="social-picker-item-icon" style={{ color: platform.color }}><SocialPlatformIcon platform={platform.id} size={17}/></span>
                <span className="social-picker-item-copy">
                  <strong>{platform.name}</strong>
                  <small>{platform.placeholder}</small>
                </span>
                <span className="social-picker-check" aria-hidden="true"><Check size={12}/></span>
              </label>;
            })}
          </div>}
    </div>
    <footer className="social-dialog-footer">
      <p className="help">{selection.length ? selection.length + (selection.length === 1 ? ' red seleccionada' : ' redes seleccionadas') : 'Toca las redes que quieras añadir.'}</p>
      <div className="actions">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button disabled={locked || !selection.length} onClick={onConfirm}>
          <Plus size={15}/>{selection.length ? 'Añadir ' + selection.length + (selection.length === 1 ? ' red' : ' redes') : 'Añadir redes'}
        </Button>
      </div>
    </footer>
  </Dialog>;
}

export function SocialStudio({ tool, api, notice, online }) {
  const { config, setConfig, dirty, saving, error, save } = useNotificationSettings(tool.config, tool.revision, api, online, storage);
  const [mobileView, setMobileView] = useState('editor');
  const [autoRotate, setAutoRotate] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [selection, setSelection] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const rotation = useSocialRotation(config, { auto: autoRotate });
  const update = (key, value) => setConfig(previous => ({ ...previous, [key]: value }));
  const editChannel = (id, patch) => setConfig(previous => ({
    ...previous,
    channels: previous.channels.map(channel => channel.id === id ? { ...channel, ...patch } : channel),
  }));
  const url = new URL(socialOutputPath, location.origin).href;
  const active = config.channels.filter(channel => channel.enabled).length;
  const selected = rotation.count ? (rotation.index % rotation.count) + 1 : 0;
  const interval = Number(config.interval) || 6;
  const editing = config.channels.find(channel => channel.id === editingId) ?? null;
  const removing = config.channels.find(channel => channel.id === removingId) ?? null;

  const availablePlatforms = socialPlatforms.filter(platform => !config.channels.some(channel => channel.platform === platform.id));

  function addChannel(platformId) {
    const meta = socialPlatform(platformId) ?? socialPlatforms[0];
    setConfig(previous => previous.channels.length >= 20 ? previous : {
      ...previous,
      channels: [...previous.channels, {
        id: crypto.randomUUID(), platform: meta.id, label: meta.name, handle: '', url: '', color: meta.color, enabled: true,
      }],
    });
  }

  function togglePlatform(id, checked) {
    setSelection(current => checked ? [...current, id] : current.filter(item => item !== id));
  }

  function openPicker() {
    setSelection([]);
    setPickerQuery('');
    setPickerOpen(true);
  }

  function closePicker() {
    setPickerOpen(false);
    setSelection([]);
    setPickerQuery('');
  }

  function confirmPicking() {
    const picked = selection;
    closePicker();
    picked.forEach(id => addChannel(id));
  }

  function moveChannel(id, direction) {
    const index = config.channels.findIndex(channel => channel.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= config.channels.length) return;
    const next = [...config.channels];
    [next[index], next[target]] = [next[target], next[index]];
    update('channels', next);
  }

  function removeChannel(id) {
    if (config.channels.length <= 1) {
      notice('La rotación necesita al menos una red.', { type: 'warning' });
      return;
    }
    if (editingId === id) setEditingId(null);
    update('channels', config.channels.filter(channel => channel.id !== id));
    setRemovingId(null);
    notice('Red eliminada de la rotación.', { type: 'info' });
  }

  function duplicateChannel(id) {
    if (config.channels.length >= 20) {
      notice('Puedes añadir hasta 20 redes.', { type: 'warning' });
      return;
    }
    const source = config.channels.find(channel => channel.id === id);
    if (!source) return;
    const copy = { ...source, id: crypto.randomUUID(), enabled: false, label: (source.label || socialPlatform(source.platform).name).slice(0, 43) + ' copia' };
    update('channels', [...config.channels, copy]);
    setEditingId(copy.id);
    notice('Red duplicada. Ajusta el nombre y actívala cuando esté lista.', { type: 'info' });
  }

  function changePlatform(channel, platformId) {
    const previous = socialPlatform(channel.platform);
    const meta = socialPlatform(platformId);
    editChannel(channel.id, {
      platform: meta.id,
      color: meta.color,
      label: !channel.label || channel.label === previous.name ? meta.name : channel.label,
    });
  }

  function previewChannel(channel) {
    if (!channel.enabled) {
      setEditingId(channel.id);
      return;
    }
    rotation.select(channel.id);
    setMobileView('monitor');
  }

  async function saveNow() {
    if (await save()) notice('Configuración de redes guardada.');
  }

  return <div className="social-editor editor-workspace">
    <header className="editor-workspace-header social-header">
      <div className="social-heading-block">
        <span className="social-heading-icon"><Share2 size={21}/></span>
        <div>
          <h1 className="editor-workspace-title">Social Media Rotator</h1>
          <p className="social-subtitle">Tus redes se turnan en pantalla con un pop-up animado.</p>
        </div>
      </div>
      <OutputToolbar title="Salida del directo" description="Añade esta fuente de navegador al directo. La rotación funciona sin conectar TikTok.">
        <OutputLinks notice={notice} url={url} message="Enlace de Social Media Rotator copiado." iconSize={15} size="sm"/>
      </OutputToolbar>
    </header>
    <EditorViewSwitch view={mobileView} change={setMobileView} editorLabel="Redes" monitorLabel="Vista previa"/>
    <div className="editor-workspace-grid" data-view={mobileView}>
      <Card className="social-settings editor-workspace-settings">
        <div className="social-summary">
          <div className="social-summary-copy">
            <h2>Redes y rotación</h2>
            <p className="help">Pulsa una red para verla en la vista previa. Cada {interval} segundos cambia el turno.</p>
          </div>
          <div className="social-summary-side">
            <div className="social-stats" aria-label="Resumen de la rotación">
              <span className="social-stat"><span className="social-stat-dot" data-on={active > 0}/><strong>{active}</strong> {active === 1 ? 'activa' : 'activas'}</span>
              <span className="social-stat"><strong>{config.channels.length}</strong> en total</span>
            </div>
            <Toggle name="enabled" label="Mostrar en el directo" settings={config} update={update}/>
            <Button size="sm" onClick={openPicker} disabled={config.channels.length >= 20}><Plus size={15}/>Añadir red</Button>
          </div>
        </div>

        <section className="social-section">
          <div className="social-section-heading">
            <div>
              <h3>Redes en la rotación</h3>
              <p className="help">Cambia el orden con las flechas. Las redes ocultas se conservan sin salir al directo.</p>
            </div>
            <Badge>{config.channels.length} / 20</Badge>
          </div>
          <div className="social-channel-list">
            {config.channels.map((channel, index) => <ChannelRow key={channel.id} channel={channel} index={index} count={config.channels.length}
              active={channel.enabled && rotation.channel?.id === channel.id}
              onPreview={previewChannel}
              onEdit={setEditingId}
              onMove={moveChannel}
              onRemove={setRemovingId}
              onToggle={(id, value) => editChannel(id, { enabled: value })}/>)}
          </div>
          {config.channels.length === 0 && <div className="social-empty-state">
            <Share2 size={24}/>
            <strong>Añade tu primera red</strong>
            <p>Elige una red social para empezar la rotación.</p>
            <Button size="sm" onClick={openPicker}><Plus size={14}/>Añadir red</Button>
          </div>}
        </section>

        <section className="social-section">
          <div className="social-section-heading">
            <div>
              <h3>Ritmo y posición</h3>
              <p className="help">Controla cuánto dura cada red y dónde aparece la tarjeta.</p>
            </div>
            <Badge>{positionLabel(config.position)}</Badge>
          </div>
          <div className="social-fields">
            <Field label="Cambiar cada · segundos" hint="Entre 2 y 120 segundos.">{id => <Input id={id} type="number" min="2" max="120" value={config.interval}
              onChange={event => update('interval', event.target.value === '' ? '' : Number(event.target.value))}/>}</Field>
            <Field label="Animación de entrada">{id => <Select id={id} value={config.animation} onChange={event => update('animation', event.target.value)}>
              {socialAnimations.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>}</Field>
            <Field label="Posición en pantalla">{id => <Select id={id} value={config.position} onChange={event => update('position', event.target.value)}>
              {socialPositions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>}</Field>
            <Field label="Tamaño del icono · px">{id => <Input id={id} type="number" min="24" max="96" value={config.iconSize}
              onChange={event => update('iconSize', event.target.value === '' ? '' : Number(event.target.value))}/>}</Field>
            <Field label="Texto superior" hint="Déjalo vacío para ocultarlo.">{id => <Input id={id} value={config.heading} maxLength={40} placeholder="SÍGUEME EN"
              onChange={event => update('heading', event.target.value)}/>}</Field>
          </div>
          <div className="social-toggle-grid">
            <Toggle name="random" label="Orden aleatorio" settings={config} update={update}/>
            <Toggle name="showProgress" label="Barra de progreso" settings={config} update={update}/>
          </div>
        </section>

        <details className="social-design-section" open>
          <summary>
            <span className="social-design-summary">
              <span>
                <strong>Formato y contenido</strong>
                <small>{layoutLabel(config.layout)}</small>
              </span>
            </span>
            <ChevronDown className="social-design-chevron" size={16} aria-hidden="true"/>
          </summary>
          <div className="social-design-body">
            <fieldset className="social-choices">
              <legend>Formato de la tarjeta</legend>
              <div>
                {socialLayouts.map(([value, label]) => (
                  <button type="button" key={value} aria-pressed={config.layout === value} onClick={() => update('layout', value)}>
                    <span className={'social-mini social-mini-' + value} aria-hidden="true"><i/><b/><em/></span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="social-toggle-grid">
              <Toggle name="showIcon" label="Mostrar icono" settings={config} update={update}/>
              <Toggle name="showLabel" label="Mostrar nombre" settings={config} update={update}/>
              <Toggle name="showHandle" label="Mostrar usuario" settings={config} update={update}/>
            </div>
          </div>
        </details>

        <details className="social-design-section">
          <summary>
            <span className="social-design-summary">
              <span>
                <strong>Diseño</strong>
                <small>{styleLabel(config.style)} · {config.width} px</small>
              </span>
            </span>
            <ChevronDown className="social-design-chevron" size={16} aria-hidden="true"/>
          </summary>
          <div className="social-design-body">
            <fieldset className="social-choices social-style-choices">
              <legend>Tema visual</legend>
              <div>
                {socialStyles.map(([value, label]) => (
                  <button type="button" key={value} aria-pressed={config.style === value} onClick={() => update('style', value)}>
                    <span className={'social-swatch social-swatch-' + value} aria-hidden="true"><i/><b/></span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <OverlayColors settings={config} update={update}/>
            <NumberSettings fields={[
              ['opacity', 'Opacidad del fondo · %', 0, 100],
              ['borderOpacity', 'Opacidad del borde · %', 0, 100],
              ['borderWidth', 'Grosor del borde · px', 0, 8],
              ['radius', 'Bordes redondeados · px', 0, 80],
              ['width', 'Ancho · px', 240, 900],
            ]} settings={config} update={update}/>
            <div className="social-fields">
              <Field label="Tipo de borde">{id => <Select id={id} value={config.borderStyle} onChange={event => update('borderStyle', event.target.value)}>
                {socialBorderStyles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>}</Field>
              <Field label="Color de la sombra">{id => <Input id={id} type="color" value={safeColor(config.shadowColor, '#000000')}
                onChange={event => update('shadowColor', event.target.value)}/>}</Field>
            </div>
            <div className="social-toggle-grid">
              <Toggle name="textShadow" label="Sombra de texto" settings={config} update={update}/>
            </div>
          </div>
        </details>

        <details className="social-design-section">
          <summary>
            <span className="social-design-summary">
              <span>
                <strong>CSS personalizado</strong>
                <small>{config.customCss ? 'Con reglas propias' : 'Opcional'}</small>
              </span>
            </span>
            <ChevronDown className="social-design-chevron" size={16} aria-hidden="true"/>
          </summary>
          <div className="social-design-body">
            <p className="help">Añade reglas que sobreescriban el aspecto del pop-up; se aplican en el directo y en esta vista previa.</p>
            <Field>{id => <Textarea id={id} className="social-css-input" value={config.customCss ?? ''} rows={8} spellCheck={false}
              placeholder={'.social-card {\n  border-radius: 40px;\n}\n\n.social-stage { justify-content: center; }'}
              onChange={event => update('customCss', event.target.value)}/>}</Field>
          </div>
        </details>

        <div className={'social-savebar' + (error ? ' has-error' : '')}>
          <span role="status" className={error ? 'social-save-error' : dirty ? 'social-save-dirty' : 'help'}>
            {error || (saving ? 'Guardando…' : dirty ? online ? 'Cambios pendientes de guardar…' : 'Sin conexión: cambios guardados en este navegador' : 'Todos los cambios guardados')}
          </span>
          {dirty && <Button variant="outline" size="sm" disabled={!online || saving} onClick={saveNow}>{saving ? 'Guardando…' : 'Guardar ahora'}</Button>}
        </div>
      </Card>

      <div className="social-monitor editor-workspace-monitor">
        <Card className="social-preview-card">
          <div className="social-panel-heading">
            <div>
              <h2>Vista previa</h2>
              <p className="help">Así se verá la tarjeta en la salida del directo.</p>
            </div>
            <Badge className={config.enabled && rotation.count ? 'success' : ''}>{!config.enabled ? 'Oculta en directo' : rotation.count ? selected + ' / ' + rotation.count : 'Sin activas'}</Badge>
          </div>
          <div className="social-preview" data-position={config.position}>
            <CustomCss value={config.customCss}/>
            {rotation.channel
              ? <SocialCard key={rotation.channel.id + '-' + rotation.cycle} channel={rotation.channel} config={config} cycle={rotation.cycle} progress={rotation.count > 1}/>
              : <p className="social-empty">Activa una red para verla aquí.</p>}
          </div>
          {rotation.count > 0 && <div className="social-preview-channels" role="group" aria-label="Elegir red en la vista previa">
            {config.channels.filter(channel => channel.enabled).map(channel => {
              const meta = socialPlatform(channel.platform);
              const activeChannel = rotation.channel?.id === channel.id;
              return <button type="button" key={channel.id} className="social-preview-channel" aria-pressed={activeChannel}
                style={{ '--social-channel': safeColor(channel.color, meta.color) }} onClick={() => rotation.select(channel.id)}>
                <SocialPlatformIcon platform={channel.platform} size={13}/>{channel.label || meta.name}
              </button>;
            })}
          </div>}
          <div className="social-preview-controls">
            <Button variant="outline" size="sm" disabled={!rotation.count} onClick={rotation.previous}><SkipBack size={14}/>Anterior</Button>
            <Button variant="outline" size="sm" disabled={!rotation.count} onClick={rotation.next}>Siguiente<SkipForward size={14}/></Button>
            <Button variant="ghost" size="sm" disabled={!rotation.count} onClick={rotation.restart}><RotateCcw size={14}/>Reiniciar</Button>
          </div>
          <div className="social-preview-autoplay">
            <Toggle name="auto" label="Rotación automática en la vista previa" settings={{ auto: autoRotate }} update={(_, value) => setAutoRotate(value)}/>
          </div>
        </Card>

        <Card className="social-facts-card">
          <div className="social-panel-heading">
            <div>
              <h2>Resumen</h2>
              <p className="help">La rotación continúa mientras la salida esté abierta.</p>
            </div>
            <Badge className={config.enabled && active > 0 ? 'success' : ''}>{config.enabled && active > 0 ? 'En directo' : 'Oculta'}</Badge>
          </div>
          <dl className="social-facts">
            <div><dt>Redes activas</dt><dd>{active}</dd></div>
            <div><dt>Tiempo por red</dt><dd>{interval} s</dd></div>
            <div><dt>Posición</dt><dd>{positionLabel(config.position)}</dd></div>
            <div><dt>Formato</dt><dd>{layoutLabel(config.layout)}</dd></div>
            <div><dt>Tema</dt><dd>{styleLabel(config.style)}</dd></div>
            <div><dt>Orden</dt><dd>{config.random ? 'Aleatorio' : 'En lista'}</dd></div>
          </dl>
          <p className="help">Los cambios se guardan y se aplican automáticamente. Si editas el CSS, comprueba la vista previa antes de salir al directo.</p>
        </Card>
      </div>

      <ChannelEditorDialog open={Boolean(editing)} channel={editing} config={config} index={editing ? config.channels.findIndex(channel => channel.id === editing.id) : 0}
        count={config.channels.length} locked={!online} saving={saving} dirty={dirty} error={error}
        onClose={() => setEditingId(null)}
        onEdit={(id, patch) => patch.platform ? changePlatform(config.channels.find(channel => channel.id === id), patch.platform) : editChannel(id, patch)}
        onDelete={id => { setEditingId(null); setRemovingId(id); }}
        onDuplicate={duplicateChannel}/>
      <DeleteChannelDialog channel={removing} count={config.channels.length} locked={!online}
        onCancel={() => setRemovingId(null)} onConfirm={() => removing && removeChannel(removing.id)}/>
      <NetworkPickerDialog open={pickerOpen} available={availablePlatforms} selection={selection} query={pickerQuery} locked={!online}
        onQuery={setPickerQuery}
        onToggle={togglePlatform}
        onClose={closePicker}
        onConfirm={confirmPicking}/>
    </div>
  </div>;
}
