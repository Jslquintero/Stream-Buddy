import { useOutputOrigin } from '../hooks/use-output-origin';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import qrcode from 'qrcode-generator';
import {
  ArrowDown,
  ArrowUp,
  Check,
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
import { Badge, Button, Card, Dialog, Input, Select, Switch, Tabs, TabsContent, TabsList, TabsTrigger } from './ui';
import { Field, Toggle } from './fields';
import { OutputLinks, OutputToolbar } from './output-controls';
import { EditorViewSwitch } from './editor-view-switch';
import { useNotificationSettings } from '../hooks/use-notification-settings';
import { useStudio } from '../hooks/use-studio';
import { NotificationFontResource } from './notification-fonts';
import {
  defaultSocial,
  validateSocial,
  validateSocialQrUrl,
  migrateSocial,
  socialOutputPath,
  socialPlatforms,
  socialPlatform,
  socialQrPalettes,
  socialLayouts,
  resolveSocialLayout,
  resolveSocialDesign,
} from '../../../modules/social/config';
import { socialCardProperties, socialCustomCss } from '../../../modules/social/css';
import { SocialCssEditor } from './social-css-editor';
import { SocialFormatSettings, SocialIconSettings, SocialImageSettings, SocialQrSettings, SocialStyleSettings, SocialTextSettings, socialPhotoCovers, socialPhotoLayouts } from './social-channel-design';
import { SocialPlatformIcon } from './social-icons';
import './editor-workspace.css';
import './social-editor.css';

const storage = { key: 'live-studio.social.pending.v1', validate: validateSocial, migrate: migrateSocial, action: 'social/save' };
const layoutLabel = id => socialLayouts.find(([value]) => value === id)?.[1] ?? 'Tarjeta · completa';

function safeColor(value, fallback) {
  return typeof value === 'string' && /^#[a-f0-9]{6}$/i.test(value) ? value : fallback;
}

function randomStep(previous, length) {
  if (length < 2) return 0;
  let next = previous;
  while (next === previous) next = Math.floor(Math.random() * length);
  return next;
}

const maxSocialImageBytes = 10 * 1024 * 1024;
const maxSocialSvgBytes = 3 * 1024 * 1024;

function imageMime(file) {
  if (/^image\/(png|jpe?g|webp|gif|svg\+xml)$/i.test(file.type)) return file.type;
  const extension = /\.(png|jpe?g|webp|gif|svg)$/i.exec(file.name)?.[1].toLowerCase();
  if (!extension) return '';
  return 'image/' + ({ svg: 'svg+xml', jpg: 'jpeg' }[extension] ?? extension);
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(file);
  });
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

function qrUrl(channel) {
  try {
    return validateSocialQrUrl(channel.url);
  } catch {
    return '';
  }
}

function SocialQr({ url, palette, shape, preferredSize }) {
  const { modules, squarePath, roundedPath } = useMemo(() => {
    const code = qrcode(0, 'M');
    code.addData(url);
    code.make();
    const count = code.getModuleCount();
    const squares = [];
    const rounded = [];
    for (let row = 0; row < count; row++) {
      for (let column = 0; column < count; column++) {
        if (!code.isDark(row, column)) continue;
        const inFinder = (row < 7 && (column < 7 || column >= count - 7)) || (column < 7 && row >= count - 7);
        const x = column + 4;
        const y = row + 4;
        if (shape === 'rounded' && !inFinder) {
          rounded.push(`M${x}.12 ${y}.12h.76v.76h-.76Z`);
        } else {
          squares.push(`M${x} ${y}h1v1h-1Z`);
        }
      }
    }
    return { modules: count + 8, squarePath: squares.join(''), roundedPath: rounded.join('') };
  }, [url, shape]);
  const { foreground, background } = socialQrPalettes.find(({ id }) => id === palette) ?? socialQrPalettes[0];
  const src = useMemo(() => {
    const rounded = roundedPath ? `<path d="${roundedPath}" fill="${foreground}" stroke="${foreground}" stroke-width=".24" stroke-linejoin="round"/>` : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${modules} ${modules}"><rect width="100%" height="100%" fill="${background}"/><path d="${squarePath}" fill="${foreground}" shape-rendering="crispEdges"/>${rounded}</svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }, [modules, squarePath, roundedPath, foreground, background]);
  const size = Math.max(preferredSize, modules * 2);
  return <img className="social-qr" src={src} width={size} height={size} alt="Código QR para abrir el enlace"/>;
}

export function useSocialRotation(config, { auto = true, requireQrUrl = false } = {}) {
  const settings = config ?? defaultSocial;
  const channels = (settings.channels ?? []).filter(channel =>
    channel?.enabled && (!requireQrUrl || channel.platform !== 'qr' || qrUrl(channel)));
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

export function SocialCard({ channel, config, cycle = 0, progress = true, textCycle = 0 }) {
  const settings = resolveSocialDesign(config, channel);
  const layout = settings.layout;
  const flat = Math.max(0, Number(settings.opacity) || 0) <= 0;
  const imageCover = socialPhotoCovers.includes(layout);
  const image = socialPhotoLayouts.includes(layout) && (channel.image || settings.image);
  const label = channel.label?.trim();
  const qr = channel.platform === 'qr' ? qrUrl(channel) : '';
  const style = Object.fromEntries(Object.entries(socialCardProperties(settings, channel))
    .map(([name, value]) => [name.replace('--social-', '--social-config-'), value]));
  return <article className={'social-card social-layout-' + layout + ' social-style-' + (settings.style || 'clean') + ' social-corners-' + (settings.cornerStyle || 'auto') + ' social-border-' + (settings.borderEffect || 'none') + ' social-image-corners-' + (settings.imageCorners || 'all') + (settings.imageShadow ? ' social-image-shadow' : '') + ' social-animation-' + (settings.animation || 'pop') + (flat ? ' social-flat' : '')} style={style}
    aria-label={[label, channel.handle].filter(Boolean).join(', ') || undefined} data-cycle={cycle} data-border-style={settings.borderStyle}>
    <NotificationFontResource family={settings.fontFamily}/>
    {image && <span className={'social-media' + (imageCover ? ' social-media-background' : '')} aria-hidden="true">
      <img className={imageCover ? 'social-media-cover' : undefined} src={image} alt="" loading="eager"/>
      {imageCover && <span className="social-media-scrim"/>}
    </span>}
    <span className="social-glow" aria-hidden="true"/>
    {qr && <SocialQr url={qr} palette={settings.qrPalette} shape={settings.qrShape} preferredSize={settings.qrSize}/>}
    {settings.showIcon && (!qr || channel.icon) && <span className="social-icon" data-shape={settings.iconShape}
      data-backdrop={settings.showIconBackdrop ? settings.iconBackdropStyle : 'none'}>
      <SocialPlatformIcon platform={channel.platform} icon={channel.icon} url={channel.url} size={38}/>
    </span>}
    <span className={'social-copy social-animation-' + settings.textAnimation} key={textCycle}>
      {settings.heading && <span className="social-heading">{settings.heading}</span>}
      {settings.showLabel && label && <strong className="social-label">{label}</strong>}
      {settings.showHandle && channel.handle && <span className="social-handle">{channel.handle}</span>}
    </span>
    {settings.showProgress && progress && <span className="social-progress" aria-hidden="true"><i/></span>}
  </article>;
}

export function SocialOutput() {
  const { state, online } = useStudio('social');
  const tool = state?.tools.social;
  const config = tool?.config;
  const rotation = useSocialRotation(config, { requireQrUrl: true });
  const design = resolveSocialDesign(config, rotation.channel);

  useEffect(() => {
    document.documentElement.classList.add('social-output');
    document.documentElement.style.colorScheme = 'normal';
    return () => {
      document.documentElement.classList.remove('social-output');
      document.documentElement.style.removeProperty('color-scheme');
    };
  }, []);

  return <>
    <CustomCss value={design.cssEnabled ? socialCustomCss(design) : ''}/>
    <div className={'social-stage ' + design.position}>
      {online && config?.enabled && rotation.channel && <SocialCard key={rotation.channel.id + '-' + rotation.cycle}
        channel={rotation.channel} config={config} cycle={rotation.cycle} progress={rotation.count > 1}/>}
    </div>
  </>;
}

function CustomCss({ value, scope }) {
  if (!value) return null;
  return <style>{scope ? `@scope (${scope}) {\n${value}\n}` : value}</style>;
}

function SocialPreview({ channel, config, cycle, progress, textCycle }) {
  const frame = useRef(null);
  const previewId = useId();
  const design = resolveSocialDesign(config, channel);
  const position = design.position;
  const cardWidth = Number(design.width) || defaultSocial.width;
  const previewWidth = Math.max(540, cardWidth + 40);

  useLayoutEffect(() => {
    const element = frame.current;
    const resize = () => {
      if (!element.clientWidth) return;
      element.style.setProperty('--social-preview-scale', Math.min(1, element.clientWidth / previewWidth));
    };
    resize();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [previewWidth]);

  return <div ref={frame} className="social-preview" data-preview={previewId} style={{ '--social-preview-width': previewWidth + 'px' }}>
    <CustomCss value={design.cssEnabled ? socialCustomCss(design) : ''} scope={`.social-preview[data-preview="${previewId}"]`}/>
    <div className={'social-stage ' + position}>
      {channel
        ? <SocialCard key={channel.id + '-' + cycle} channel={channel} config={config} cycle={cycle} progress={progress} textCycle={textCycle}/>
        : <p className="social-empty">Activa una red para verla aquí.</p>}
    </div>
  </div>;
}

function ChannelRow({ channel, format, index, count, active, online, onPreview, onEdit, onMove, onToggle, onDelete }) {
  const meta = socialPlatform(channel.platform);
  const label = channel.label || meta.name;
  const showPlatform = label.trim().toLowerCase() !== meta.name.toLowerCase();
  return <article className="social-channel-row" data-active={active ? 'true' : 'false'} data-disabled={channel.enabled ? 'false' : 'true'}>
    <span className="social-channel-order" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
    <button type="button" className="social-channel-main" onClick={() => onPreview(channel)} aria-label={'Seleccionar ' + label + ' en la vista previa'}>
      <span className="social-channel-icon" style={{ '--social-channel': safeColor(channel.color, meta.color) }}>
        <SocialPlatformIcon platform={channel.platform} icon={channel.icon} url={channel.url} size={19}/>
      </span>
      <span className="social-channel-copy">
        <span className="social-channel-title">
          <strong>{label}</strong>
          {!channel.enabled && <Badge>Oculta</Badge>}
        </span>
        <span className="social-channel-meta">
          <span>{(channel.platform === 'qr' ? channel.url : channel.handle) || meta.placeholder}</span>
          {showPlatform && <span aria-hidden="true">·</span>}
          {showPlatform && <span>{meta.name}</span>}
          {format && <span className="social-channel-format">{format}</span>}
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
      <Button variant="outline" size="sm" aria-label={'Editar ' + label} onClick={() => onEdit(channel.id)}><Pencil size={14}/>Editar</Button>
      <Button variant="destructive" size="icon" aria-label={'Eliminar ' + label} disabled={!online || count <= 1}
        title={count <= 1 ? 'La rotación necesita al menos una red' : 'Eliminar red'}
        onClick={() => onDelete(channel.id)}><Trash2 size={14}/></Button>
    </div>
  </article>;
}

function ChannelEditorDialog({ open, channel, config, count, cycle, progress, fonts, api, notice, online,
  saving, dirty, error, uploading, onClose, onEdit, onDuplicate, onUpload, updateShared, updateDesign }) {
  useDialogDismiss(open, onClose);
  const first = useRef(null);
  const [tab, setTab] = useState('network');
  const [replay, setReplay] = useState(0);
  const [textReplay, setTextReplay] = useState(0);
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => first.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [open, channel?.id]);
  if (!channel) return null;
  const meta = socialPlatform(channel.platform);
  const label = channel.label || meta.name;
  const isQr = channel.platform === 'qr';
  const isWebsite = channel.platform === 'website';
  const urlLabel = isQr ? 'URL del código QR' : isWebsite ? 'URL del sitio web' : 'Enlace (opcional)';
  const urlHint = isQr ? 'Introduce una URL con https:// o http:// para generar el código.'
    : isWebsite ? 'Favicon.im busca el icono a partir del dominio. Si subes tu propio icono, se usará ese.'
    : 'Solo como referencia; la tarjeta no lo muestra.';
  const color = safeColor(channel.color, meta.color);
  const design = resolveSocialDesign(config, channel);
  const update = (key, value) => updateDesign(channel.id, key, value);
  return <Dialog open={open} className="social-dialog social-dialog-editor" backdropClassName="social-dialog-backdrop" aria-labelledby="social-channel-title">
    <header className="social-dialog-header">
      <div className="social-dialog-heading">
        <span className="social-dialog-icon" style={{ '--social-channel': color }}><SocialPlatformIcon platform={channel.platform} icon={channel.icon} url={channel.url} size={18}/></span>
        <div>
          <h2 id="social-channel-title">Editar {label}</h2>
        </div>
      </div>
      <div className="social-dialog-header-actions">
        <Badge className={channel.enabled ? 'success' : ''}>{channel.enabled ? 'Visible' : 'Oculta'}</Badge>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar editor de red"><X size={18}/></Button>
      </div>
    </header>
    <div className="social-dialog-body">
      <Tabs value={tab} onValueChange={setTab} className="social-dialog-tabs" data-qr={isQr || undefined}>
        <TabsList aria-label="Ajustes de la red">
          {[
            ['network', 'Red'], ...(isQr ? [['qr', 'QR']] : []), ['format', 'Formato'], ['image', 'Imagen'],
            ['text', 'Texto'], ['style', 'Estilo'], ['css', 'CSS'],
          ].map(([value, name]) => <TabsTrigger key={value} value={value}>{name}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="network">
          <fieldset className="social-dialog-form" disabled={!online}>
            <div className="social-dialog-section-heading">
              <h3>Red social</h3>
              <Toggle name="enabled" label="Mostrar esta red" settings={channel} update={(_, value) => onEdit(channel.id, { enabled: value })}/>
            </div>
            <div className="social-dialog-fields">
              <Field label="Plataforma">{id => <Select id={id} value={channel.platform} onChange={event => onEdit(channel.id, { platform: event.target.value })}>
                {socialPlatforms.map(platform => <option key={platform.id} value={platform.id}>{platform.name}</option>)}
              </Select>}</Field>
              <Field label="Color de la red">{id => <span className="social-color-field">
                <Input id={id} type="color" value={color} onChange={event => onEdit(channel.id, { color: event.target.value })}/>
                <code>{color.toUpperCase()}</code>
                <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(channel.id, { color: meta.color })}>Restablecer</Button>
              </span>}</Field>
            </div>
            <Field label="Nombre visible" hint="Déjalo vacío para ocultar el título de la tarjeta.">{id => <Input ref={first} id={id} value={channel.label ?? ''} maxLength={50}
              onChange={event => onEdit(channel.id, { label: event.target.value })}/>}</Field>
            <div className="social-dialog-fields">
              <Field label={isQr ? 'Texto adicional' : 'Usuario o texto'} hint={isQr ? undefined : 'Ej.: ' + meta.placeholder}>{id => <Input id={id} value={channel.handle ?? ''} maxLength={80} placeholder={isQr ? undefined : meta.placeholder}
                onChange={event => onEdit(channel.id, { handle: event.target.value })}/>}</Field>
              <Field label={urlLabel} hint={urlHint}>{id =>
                <Input id={id} type={isWebsite ? 'text' : 'url'} inputMode="url" value={channel.url ?? ''} maxLength={2048} placeholder={isQr || isWebsite ? meta.placeholder : 'https://...'}
                  onChange={event => onEdit(channel.id, { url: event.target.value })}/>}</Field>
            </div>
            <SocialIconSettings channel={channel} uploading={uploading} onUpload={onUpload}
              onRemove={() => onEdit(channel.id, { icon: '' })}/>
          </fieldset>
        </TabsContent>
        {isQr && <TabsContent value="qr">
          <SocialQrSettings design={design} update={update}/>
        </TabsContent>}
        <TabsContent value="format">
          <SocialFormatSettings design={design} update={update} openImage={() => setTab('image')}/>
        </TabsContent>
        <TabsContent value="image">
          <SocialImageSettings design={design} channel={channel} label={label} update={update} editChannel={onEdit}
            updateShared={updateShared} uploading={uploading} onUpload={onUpload} online={online} chooseFormat={() => setTab('format')}/>
        </TabsContent>
        <TabsContent value="text">
          <SocialTextSettings design={design} update={update} fonts={fonts} api={api} online={online}/>
        </TabsContent>
        <TabsContent value="style">
          <SocialStyleSettings design={design} update={update}/>
        </TabsContent>
        <TabsContent value="css">
          <SocialCssEditor config={config} channel={channel} update={update} notice={notice}/>
        </TabsContent>
      </Tabs>
      <aside className="social-dialog-preview">
        <div className="social-dialog-section-heading"><h3>Vista previa</h3></div>
        <SocialPreview key={replay} channel={channel} config={config} cycle={cycle} progress={progress} textCycle={textReplay}/>
        <div className="social-dialog-preview-actions">
          <Button type="button" size="sm" variant="ghost" onClick={() => setReplay(value => value + 1)}><RotateCcw size={14}/>Repetir entrada</Button>
          {design.textAnimation !== 'none' && <Button type="button" size="sm" variant="ghost" onClick={() => setTextReplay(value => value + 1)}>
            Repetir animación del texto
          </Button>}
        </div>
      </aside>
    </div>
    <footer className="social-dialog-footer">
      <div className="actions">
        <Button variant="ghost" disabled={!online || count >= 20} onClick={() => onDuplicate(channel.id)}><Copy size={15}/>Duplicar</Button>
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

function NetworkPickerDialog({ open, available, selection, query, remaining, locked, onQuery, onToggle, onClose, onConfirm }) {
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
        ? <div className="social-picker-empty"><Check size={24}/><strong>Ya están todas</strong><p>Has añadido todas las plataformas disponibles a la rotación.</p></div>
        : visible.length === 0
          ? <div className="social-picker-empty"><Search size={24}/><strong>Sin resultados</strong><p>No hay redes que coincidan con “{query}”.</p></div>
          : <div className="social-picker-grid">
            {visible.map(platform => {
              const checked = selection.includes(platform.id);
              return <label className="social-picker-item" key={platform.id} data-selected={checked ? 'true' : 'false'}>
                <input type="checkbox" checked={checked} disabled={locked || (!checked && selection.length >= remaining)} onChange={event => onToggle(platform.id, event.target.checked)}/>
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

export function SocialStudio({ tool, fonts, api, notice, online }) {
  const outputOrigin = useOutputOrigin();
  const { config, setConfig, dirty, saving, error, save } = useNotificationSettings(tool.config, tool.revision, api, online, storage);
  const [mobileView, setMobileView] = useState('editor');
  const [autoRotate, setAutoRotate] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [selection, setSelection] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [uploading, setUploading] = useState(null);
  const uploadInFlight = useRef(false);
  const rotation = useSocialRotation(config, { auto: autoRotate && !editingId });
  const update = (key, value) => setConfig(previous => ({ ...previous, [key]: value }));
  const editChannel = (id, patch) => setConfig(previous => ({
    ...previous,
    channels: previous.channels.map(channel => channel.id === id ? { ...channel, ...patch } : channel),
  }));
  function updateDesign(id, key, value) {
    if (key === 'cssTemplates') {
      update(key, value);
      return;
    }
    if (key === 'layout') {
      editChannel(id, { layout: value });
      return;
    }
    setConfig(previous => ({
      ...previous,
      channels: previous.channels.map(channel => channel.id === id
        ? { ...channel, design: { ...channel.design, [key]: value } }
        : channel),
    }));
  }
  const url = new URL(socialOutputPath, outputOrigin).href;
  const active = config.channels.filter(channel => channel.enabled).length;
  const selected = rotation.count ? (rotation.index % rotation.count) + 1 : 0;
  const editing = config.channels.find(channel => channel.id === editingId) ?? null;
  const previewed = editing ?? rotation.channel;
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
    const label = source.label?.trim();
    const copy = { ...source, id: crypto.randomUUID(), enabled: false, label: label ? label.slice(0, 43) + ' copia' : '' };
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
      label: channel.label === previous.name ? meta.name : channel.label,
    });
  }

  function openChannelEditor(id) {
    rotation.select(id);
    setEditingId(id);
  }

  function closeChannelEditor() {
    if (rotation.channel?.id !== editingId) rotation.select(editingId);
    setEditingId(null);
  }

  function previewChannel(channel) {
    if (!channel.enabled) {
      openChannelEditor(channel.id);
      return;
    }
    rotation.select(channel.id);
    setMobileView('monitor');
  }

  async function uploadImage(file, id = null, field = 'image') {
    if (!online || !file || uploadInFlight.current) return;
    const mime = imageMime(file);
    if (!mime) {
      notice('Elige una imagen PNG, JPG, WebP, GIF o SVG.', { type: 'warning' });
      return;
    }
    const isSvg = mime === 'image/svg+xml';
    if (file.size > (isSvg ? maxSocialSvgBytes : maxSocialImageBytes)) {
      notice(file.name + ' supera ' + (isSvg ? '3 MB.' : '10 MB.'), { type: 'warning' });
      return;
    }
    uploadInFlight.current = true;
    setUploading({ id, field });
    try {
      const data = await readAsDataUrl(file.slice(0, file.size, mime));
      const result = await api('social/upload', { data }, { throwOnError: true });
      if (!result?.image) throw new Error('No se pudo guardar la imagen');
      if (id === null) update('image', result.image);
      else editChannel(id, { [field]: result.image });
      notice(field === 'icon' ? 'Icono añadido a la red.' : id === null ? 'Imagen compartida cargada.' : 'Foto añadida a la red.');
    } catch (error) {
      notice(error.message || 'No se pudo subir la imagen.', { type: 'error' });
    } finally {
      uploadInFlight.current = false;
      setUploading(null);
    }
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
            <h2>Redes</h2>
            <p className="help">Selecciona una red para verla. Usa Editar para cambiar su tarjeta.</p>
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
          <div className="social-channel-list">
            {config.channels.map((channel, index) => <ChannelRow key={channel.id} channel={channel} index={index} count={config.channels.length}
              format={layoutLabel(resolveSocialLayout(config, channel))}
              active={previewed?.id === channel.id}
              online={online}
              onPreview={previewChannel}
              onEdit={openChannelEditor}
              onDelete={setRemovingId}
              onMove={moveChannel}
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
          <div className="social-section-heading"><h3>Rotación</h3></div>
          <div className="social-rotation-controls">
            <Field label="Intervalo · segundos">{id => <Input id={id} type="number" min="2" max="120" value={config.interval}
              onChange={event => update('interval', event.target.value === '' ? '' : Number(event.target.value))}/>}</Field>
            <Toggle name="random" label="Orden aleatorio" settings={config} update={update}/>
            <Toggle name="showProgress" label="Barra de progreso" settings={config} update={update}/>
          </div>
        </section>

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
          <SocialPreview channel={previewed} config={config} cycle={rotation.cycle} progress={rotation.count > 1}/>
          <div className="social-preview-controls">
            <Button variant="outline" size="sm" disabled={!rotation.count} onClick={rotation.previous}><SkipBack size={14}/>Anterior</Button>
            <Button variant="outline" size="sm" disabled={!rotation.count} onClick={rotation.next}>Siguiente<SkipForward size={14}/></Button>
            <Button variant="ghost" size="sm" disabled={!rotation.count} onClick={rotation.restart}><RotateCcw size={14}/>Reiniciar</Button>
          </div>
          <div className="social-preview-autoplay">
            <Toggle name="auto" label="Rotación automática en la vista previa" settings={{ auto: autoRotate }} update={(_, value) => setAutoRotate(value)}/>
          </div>
        </Card>
      </div>

      <ChannelEditorDialog key={editingId} open={Boolean(editing)} channel={editing} config={config}
        count={config.channels.length} cycle={rotation.cycle} progress={rotation.count > 1} fonts={fonts} api={api} notice={notice} online={online}
        saving={saving} dirty={dirty} error={error} uploading={uploading} updateShared={update} updateDesign={updateDesign}
        onClose={closeChannelEditor}
        onEdit={(id, patch) => patch.platform ? changePlatform(config.channels.find(channel => channel.id === id), patch.platform) : editChannel(id, patch)}
        onDuplicate={duplicateChannel}
        onUpload={uploadImage}/>
      <DeleteChannelDialog channel={removing} count={config.channels.length} locked={!online}
        onCancel={() => setRemovingId(null)} onConfirm={() => removing && removeChannel(removing.id)}/>
      <NetworkPickerDialog open={pickerOpen} available={availablePlatforms} selection={selection} query={pickerQuery} remaining={20 - config.channels.length} locked={!online}
        onQuery={setPickerQuery}
        onToggle={togglePlatform}
        onClose={closePicker}
        onConfirm={confirmPicking}/>
    </div>
  </div>;
}
