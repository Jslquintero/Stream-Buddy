import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, RotateCcw, SkipBack, SkipForward, Trash2 } from 'lucide-react';
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

  return {
    channel: channels.length ? channels[index % channels.length] : null,
    index,
    count: channels.length,
    cycle,
    next: () => step(1),
    previous: () => step(-1),
    restart,
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

export function SocialStudio({ tool, api, notice, online }) {
  const { config, setConfig, dirty, saving, error } = useNotificationSettings(tool.config, tool.revision, api, online, storage);
  const [mobileView, setMobileView] = useState('editor');
  const [autoRotate, setAutoRotate] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selection, setSelection] = useState([]);
  const rotation = useSocialRotation(config, { auto: autoRotate });
  const update = (key, value) => setConfig(previous => ({ ...previous, [key]: value }));
  const editChannel = (id, patch) => setConfig(previous => ({
    ...previous,
    channels: previous.channels.map(channel => channel.id === id ? { ...channel, ...patch } : channel),
  }));
  const url = new URL(socialOutputPath, location.origin).href;
  const active = config.channels.filter(channel => channel.enabled).length;
  const selected = rotation.count ? (rotation.index % rotation.count) + 1 : 0;

  const availablePlatforms = socialPlatforms.filter(platform => !config.channels.some(channel => channel.platform === platform.id));

  function addChannel(platformId) {
    if (config.channels.length >= 20) return;
    const meta = socialPlatform(platformId) ?? socialPlatforms[0];
    update('channels', [...config.channels, {
      id: crypto.randomUUID(), platform: meta.id, label: meta.name, handle: '', url: '', color: meta.color, enabled: true,
    }]);
  }

  function togglePlatform(id, checked) {
    setSelection(current => checked ? [...current, id] : current.filter(item => item !== id));
  }

  function confirmPicking() {
    const picked = selection;
    setPickerOpen(false);
    setSelection([]);
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
    update('channels', config.channels.filter(channel => channel.id !== id));
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

  return <div className="social-editor editor-workspace">
    <header className="editor-workspace-header">
      <div>
        <h1 className="editor-workspace-title">Social Media Rotator</h1>
        <p className="social-tagline">Highlight your social channels with eye-catching pop-up rotations.</p>
      </div>
      <OutputToolbar title="Salida del directo" description="Añade esta fuente de navegador al directo. La rotación funciona sin conectar TikTok.">
        <OutputLinks notice={notice} url={url} message="Enlace de Social Media Rotator copiado." iconSize={15} size="sm"/>
      </OutputToolbar>
    </header>
    <EditorViewSwitch view={mobileView} change={setMobileView} editorLabel="Redes" monitorLabel="Vista previa"/>
    <div className="editor-workspace-grid" data-view={mobileView}>
      <Card className="social-settings editor-workspace-settings">
        <div className="social-panel-heading">
          <h2>Redes y rotación</h2>
          <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}><Plus size={15}/>Añadir red</Button>
          <Badge>{config.channels.length} / 20</Badge>
          <Toggle name="enabled" label="Mostrar en el directo" settings={config} update={update}/>
        </div>
        <p className="help">Cada red aparece durante {config.interval} segundos. La salida se actualiza al guardar.</p>
        <div className="social-channel-list">
          {config.channels.map((channel, index) => {
            const meta = socialPlatform(channel.platform);
            return <section className="social-channel-card" key={channel.id} data-enabled={channel.enabled}>
              <div className="social-channel-summary">
                <span className="social-channel-icon" style={{ '--social-channel': safeColor(channel.color, meta.color) }}>
                  <SocialPlatformIcon platform={channel.platform} size={21}/>
                </span>
                <span className="social-channel-copy">
                  <strong>{channel.label || meta.name}</strong>
                  <span>{channel.handle || meta.placeholder}</span>
                </span>
                <Switch checked={channel.enabled} aria-label={'Mostrar ' + (channel.label || meta.name)}
                  onCheckedChange={value => editChannel(channel.id, { enabled: value })}/>
                <span className="social-channel-actions">
                  <Button variant="ghost" size="icon" aria-label={'Subir ' + (channel.label || meta.name)}
                    disabled={index === 0} onClick={() => moveChannel(channel.id, -1)}><ArrowUp size={15}/></Button>
                  <Button variant="ghost" size="icon" aria-label={'Bajar ' + (channel.label || meta.name)}
                    disabled={index === config.channels.length - 1} onClick={() => moveChannel(channel.id, 1)}><ArrowDown size={15}/></Button>
                  <Button variant="ghost" size="icon" aria-label={'Eliminar ' + (channel.label || meta.name)}
                    disabled={config.channels.length <= 1} onClick={() => removeChannel(channel.id)}><Trash2 size={15}/></Button>
                </span>
              </div>
              <div className="social-channel-fields">
                <Field label="Red">{id => <Select id={id} value={channel.platform} onChange={event => changePlatform(channel, event.target.value)}>
                  {socialPlatforms.map(platform => <option key={platform.id} value={platform.id}>{platform.name}</option>)}
                </Select>}</Field>
                <Field label="Nombre visible">{id => <Input id={id} value={channel.label ?? ''} maxLength={50}
                  onChange={event => editChannel(channel.id, { label: event.target.value })}/>}</Field>
                <Field label="Usuario o texto">{id => <Input id={id} value={channel.handle ?? ''} maxLength={80} placeholder={meta.placeholder}
                  onChange={event => editChannel(channel.id, { handle: event.target.value })}/>}</Field>
                <Field label="Color">{id => <Input id={id} type="color" value={safeColor(channel.color, meta.color)}
                  onChange={event => editChannel(channel.id, { color: event.target.value })}/>}</Field>
                <Field label="Enlace (opcional)" hint="Se guarda como referencia; la salida solo muestra la tarjeta.">{id =>
                  <Input id={id} type="url" value={channel.url ?? ''} maxLength={2048} placeholder="https://..."
                    onChange={event => editChannel(channel.id, { url: event.target.value })}/>}</Field>
              </div>
            </section>;
          })}
        </div>
        <details className="social-design-section">
          <summary>Rotación y animación</summary>
          <div className="social-settings-grid">
            <Field label="Cambiar cada · segundos">{id => <Input id={id} type="number" min="2" max="120" value={config.interval}
              onChange={event => update('interval', event.target.value === '' ? '' : Number(event.target.value))}/>}</Field>
            <Field label="Animación">{id => <Select id={id} value={config.animation} onChange={event => update('animation', event.target.value)}>
              {socialAnimations.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>}</Field>
            <Field label="Posición">{id => <Select id={id} value={config.position} onChange={event => update('position', event.target.value)}>
              {socialPositions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>}</Field>
            <Field label="Tamaño del icono · px">{id => <Input id={id} type="number" min="24" max="96" value={config.iconSize}
              onChange={event => update('iconSize', event.target.value === '' ? '' : Number(event.target.value))}/>}</Field>
            <Field label="Texto superior">{id => <Input id={id} value={config.heading} maxLength={40} placeholder="SÍGUEME EN"
              onChange={event => update('heading', event.target.value)}/>}</Field>
          </div>
          <div className="social-toggle-grid">
            <Toggle name="random" label="Orden aleatorio" settings={config} update={update}/>
            <Toggle name="showProgress" label="Barra de progreso" settings={config} update={update}/>
          </div>
        </details>
        <details className="social-design-section">
          <summary>Diseño</summary>
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
        </details>
        <details className="social-design-section">
          <summary>Colores, borde y sombra</summary>
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
          <NumberSettings fields={[
            ['opacity', 'Opacidad del fondo · %', 0, 100],
            ['borderOpacity', 'Opacidad del borde · %', 0, 100],
            ['borderWidth', 'Grosor del borde · px', 0, 8],
          ]} settings={config} update={update}/>
          <Field label="Tipo de borde">{id => <Select id={id} value={config.borderStyle} onChange={event => update('borderStyle', event.target.value)}>
            {socialBorderStyles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>}</Field>
          <OverlayColors settings={config} update={update}/>
          <div className="social-settings-grid">
            <Field label="Color de la sombra">{id => <Input id={id} type="color" value={safeColor(config.shadowColor, '#000000')}
              onChange={event => update('shadowColor', event.target.value)}/>}</Field>
            <Toggle name="textShadow" label="Sombra de texto" settings={config} update={update}/>
          </div>
        </details>
        <details className="social-design-section">
          <summary>Tamaño</summary>
          <NumberSettings fields={[['width', 'Ancho · px', 240, 900], ['radius', 'Bordes redondeados · px', 0, 80]]} settings={config} update={update}/>
        </details>
        <details className="social-design-section">
          <summary>CSS personalizado</summary>
          <p className="help">Añade reglas de estilo que sobreescriban el aspecto del pop-up; se aplican en el directo y en esta vista previa.</p>
          <Field>{id => <Textarea id={id} className="social-css-input" value={config.customCss ?? ''} rows={8} spellCheck={false}
            placeholder={'.social-card {\n  border-radius: 40px;\n}\n\n.social-stage { justify-content: center; }'}
            onChange={event => update('customCss', event.target.value)}/>}</Field>
        </details>
        <p role="status" className={error ? 'error' : 'help'}>{error || (saving ? 'Guardando…' : dirty ? online ? 'Pendiente de autoguardado' : 'Pendiente de conexión' : 'Configuración guardada')}</p>
      </Card>
      <div className="social-monitor editor-workspace-monitor">
        <Card>
          <div className="social-panel-heading">
            <h2>Vista previa</h2>
            <Badge>{rotation.count ? selected + ' / ' + rotation.count : 'Sin redes'}</Badge>
          </div>
          <div className="social-preview" data-position={config.position}>
            <CustomCss value={config.customCss}/>
            {rotation.channel
              ? <SocialCard key={rotation.channel.id + '-' + rotation.cycle} channel={rotation.channel} config={config} cycle={rotation.cycle} progress={rotation.count > 1}/>
              : <p className="social-empty">Añade una red para verla aquí.</p>}
          </div>
          <div className="social-preview-controls">
            <Button variant="outline" size="sm" disabled={!rotation.count} onClick={rotation.previous}><SkipBack size={14}/>Anterior</Button>
            <Button variant="outline" size="sm" disabled={!rotation.count} onClick={rotation.next}>Siguiente<SkipForward size={14}/></Button>
            <Button variant="ghost" size="sm" disabled={!rotation.count} onClick={rotation.restart}><RotateCcw size={14}/>Reiniciar</Button>
          </div>
          <Toggle name="auto" label="Rotación automática en la vista previa" settings={{ auto: autoRotate }} update={(_, value) => setAutoRotate(value)}/>
        </Card>
        <Card>
          <h2>Resumen</h2>
          <ul className="social-output-facts">
            <li><strong>{active}</strong> {active === 1 ? 'red activa' : 'redes activas'}</li>
            <li><strong>{config.interval}s</strong> por red</li>
            <li><strong>{positionLabel(config.position)}</strong></li>
          </ul>
          <p className="help">La rotación continúa mientras la salida esté abierta. Los cambios se aplican al guardar.</p>
        </Card>
      </div>
      <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} className="social-picker">
        <h2 className="social-picker-title">Añadir a la rotación</h2>
        <p className="help">Selecciona las networks que quieras añadir a la lista de canales.</p>
        <div className="social-picker-grid">
          {availablePlatforms.map(platform => (
            <label className="social-picker-item" key={platform.id}>
              <input type="checkbox" checked={selection.includes(platform.id)}
                onChange={event => togglePlatform(platform.id, event.target.checked)}/>
              <span className="social-picker-item-icon" style={{ color: platform.color }}><SocialPlatformIcon platform={platform.id} size={16}/></span>
              <span>{platform.name}</span>
            </label>
          ))}
        </div>
        <div className="social-picker-actions">
          <Button variant="ghost" size="sm" onClick={() => setPickerOpen(false)}>Cancelar</Button>
          <Button size="sm" disabled={!selection.length || !availablePlatforms.length} onClick={confirmPicking}>
            Añadir {selection.length} network{selection.length === 1 ? '' : 's'}
          </Button>
        </div>
      </Dialog>
    </div>
  </div>;
}
