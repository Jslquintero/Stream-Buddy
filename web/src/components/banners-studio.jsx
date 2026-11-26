import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  GalleryHorizontal,
  ImageOff,
  ImagePlus,
  Pencil,
  Plus,
  RotateCcw,
  SkipBack,
  SkipForward,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Badge, Button, Card, Dialog, Input, Select, Switch, Textarea } from './ui';
import { Field, NumberSettings, OverlayColors, Toggle } from './fields';
import { OutputLinks, OutputToolbar } from './output-controls';
import { EditorViewSwitch } from './editor-view-switch';
import { useNotificationSettings } from '../hooks/use-notification-settings';
import { useStudio } from '../hooks/use-studio';
import {
  defaultBanners,
  migrateBanners,
  validateBanners,
  bannersOutputPath,
  bannerPositions,
  bannerAnimations,
  bannerExits,
  bannerLayouts,
  bannerStyles,
  bannerFits,
} from '../../../modules/banners/config';
import './editor-workspace.css';
import './banner.css';
import './banner-editor.css';

const storage = { key: 'live-studio.banners.pending.v1', validate: validateBanners, migrate: migrateBanners, action: 'banners/save' };
const positionLabel = id => bannerPositions.find(([value]) => value === id)?.[1] ?? 'Abajo · centro';
const animationLabel = (id, list) => list.find(([value]) => value === id)?.[1] ?? 'Elevar suave';
const layoutLabel = id => bannerLayouts.find(([value]) => value === id)?.[1] ?? 'Marco corporativo';
const styleLabel = id => bannerStyles.find(([value]) => value === id)?.[1] ?? 'Corporativo';
const maxAds = 24;
const maxImageBytes = 10 * 1024 * 1024;
const acceptedTypes = /^image\/(png|jpeg|webp|gif|svg\+xml)$/i;
const acceptedExtension = /\.(png|jpe?g|webp|gif|svg)$/i;
const imageAccept = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.png,.jpg,.jpeg,.webp,.gif,.svg';

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

function fileBaseName(name) {
  return name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim().slice(0, 60) || 'Anuncio';
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer ' + file.name));
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

export function useBannerRotation(config, { auto = true } = {}) {
  const settings = config ?? defaultBanners;
  const ads = (settings.ads ?? []).filter(ad => ad && ad.enabled && ad.image);
  const signature = JSON.stringify(ads.map(ad => ad.id + ':' + ad.image));
  const interval = Math.max(3, Number(settings.interval) || 8) * 1000;
  const duration = Math.max(150, Math.min(2000, Number(settings.transition) || 650));
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState('enter');
  const [cycle, setCycle] = useState(0);
  const [epoch, setEpoch] = useState(0);
  const mode = useRef('next');

  useEffect(() => {
    setIndex(0);
    setPhase('enter');
    setCycle(value => value + 1);
  }, [signature]);

  useEffect(() => {
    if (!auto || phase !== 'enter' || ads.length < 2) return;
    const timer = setTimeout(() => {
      mode.current = 'auto';
      setPhase('exit');
    }, interval);
    return () => clearTimeout(timer);
  }, [auto, phase, ads.length, interval, index, epoch, signature]);

  useEffect(() => {
    if (phase !== 'exit') return;
    const timer = setTimeout(() => {
      setIndex(previous => {
        if (!ads.length) return 0;
        if (mode.current === 'replay' || ads.length < 2) return previous;
        if (mode.current === 'previous') return (previous - 1 + ads.length) % ads.length;
        if (settings.random) return randomStep(previous, ads.length);
        return (previous + 1) % ads.length;
      });
      setCycle(value => value + 1);
      setPhase('enter');
      mode.current = 'next';
    }, duration);
    return () => clearTimeout(timer);
  }, [phase, ads.length, duration, settings.random, signature]);

  const step = useCallback(direction => {
    if (phase === 'exit' || ads.length < 2) return;
    mode.current = direction > 0 ? 'next' : 'previous';
    setPhase('exit');
    setEpoch(value => value + 1);
  }, [phase, ads.length]);

  const replay = useCallback(() => {
    if (phase === 'exit') return;
    mode.current = 'replay';
    setPhase('exit');
    setEpoch(value => value + 1);
  }, [phase]);

  const select = useCallback(id => {
    const next = ads.findIndex(ad => ad.id === id);
    if (next < 0) return false;
    mode.current = 'next';
    setIndex(next);
    setCycle(value => value + 1);
    setPhase('enter');
    setEpoch(value => value + 1);
    return true;
  }, [signature]);

  return {
    ad: ads.length ? ads[index % ads.length] : null,
    index,
    count: ads.length,
    phase,
    cycle,
    next: () => step(1),
    previous: () => step(-1),
    replay,
    select,
  };
}

export function BannerCard({ ad, config, phase = 'enter', cycle = 0, total = 1, preview = false }) {
  const settings = { ...defaultBanners, ...config };
  const [broken, setBroken] = useState(false);
  const [natural, setNatural] = useState(null);
  const imageRef = useRef(null);
  useEffect(() => {
    setBroken(false);
    setNatural(null);
  }, [ad?.image]);
  useEffect(() => {
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth > 0) setNatural({ width: image.naturalWidth, height: image.naturalHeight });
  }, [ad?.image]);
  if (!ad) return null;
  const background = safeColor(settings.background, '#0b1524');
  const accent = safeColor(settings.accent, '#3b82f6');
  const flat = Math.max(0, Number(settings.opacity) || 0) <= 0;
  const animation = phase === 'exit' ? 'bn-exit-' + settings.exitAnimation : 'bn-enter-' + settings.animation;
  const hasInfo = (settings.showAdvertiser && ad.advertiser) || (settings.showCaption && ad.caption);
  const autoSize = settings.fitToCreative !== false;
  const framePad = settings.layout === 'frame' ? (Number(settings.padding) || 0) : 0;
  const ratio = natural && natural.height > 0 ? natural.width / natural.height : 3;
  const style = {
    '--bn-width': (Number(settings.width) || 728) + 'px',
    '--bn-height': (Number(settings.height) || 90) + 'px',
    '--bn-bg': alpha(background, (Number(settings.opacity) || 0) / 100),
    '--bn-color': safeColor(settings.color, '#f8fafc'),
    '--bn-accent': accent,
    '--bn-border': alpha(accent, Math.min(100, Math.max(0, Number(settings.borderOpacity ?? 100))) / 100),
    '--bn-border-width': (Number(settings.borderWidth) || 0) + 'px',
    '--bn-radius': (Number(settings.radius) || 0) + 'px',
    '--bn-pad': framePad + 'px',
    '--bn-fit': settings.fit || 'contain',
    '--bn-duration': (Number(settings.transition) || 650) + 'ms',
    '--bn-hold': (Number(settings.interval) || 8) + 's',
    '--bn-ratio': String(ratio),
    '--bn-natural-w': (natural?.width ?? 420) + 'px',
  };
  return <article
    className={['bn-card', 'bn-layout-' + (settings.layout || 'frame'), 'bn-style-' + (settings.style || 'corporate'), animation,
      preview ? 'bn-card-preview' : '', autoSize ? 'bn-autosize' : '', flat ? 'bn-flat' : '', hasInfo ? 'bn-has-info' : '', broken ? 'bn-is-broken' : ''].filter(Boolean).join(' ')}
    style={style} data-cycle={cycle} data-phase={phase}
    aria-label={[ad.name, ad.advertiser, settings.showLabel ? settings.labelText : ''].filter(Boolean).join(', ')}>
    <span className="bn-media">
      {broken
        ? <span className="bn-broken"><ImageOff size={18} aria-hidden="true"/><span>Imagen no disponible</span></span>
        : <img ref={imageRef} className={'bn-image' + (settings.imageMotion ? ' bn-image-motion' : '')} src={ad.image}
          alt={ad.alt || ad.name || 'Anuncio'} draggable="false" decoding="async"
          onLoad={event => {
            const image = event.currentTarget;
            if (image.naturalWidth > 0 && image.naturalHeight > 0) setNatural({ width: image.naturalWidth, height: image.naturalHeight });
          }}
          onError={() => setBroken(true)}/>}
      {settings.showLabel && settings.labelText && <span className="bn-tag">{settings.labelText}</span>}
      {hasInfo && <span className="bn-caption">
        {settings.showAdvertiser && ad.advertiser && <strong>{ad.advertiser}</strong>}
        {settings.showCaption && ad.caption && <span>{ad.caption}</span>}
      </span>}
      {settings.showProgress && total > 1 && phase === 'enter' && <span className="bn-progress" aria-hidden="true"><i/></span>}
    </span>
  </article>;
}

export function BannersOutput() {
  const { state, online } = useStudio('banners');
  const tool = state?.tools.banners;
  const config = tool?.config;
  const rotation = useBannerRotation(config, { auto: true });

  useEffect(() => {
    document.documentElement.classList.add('banners-output');
    document.documentElement.style.colorScheme = 'normal';
    return () => {
      document.documentElement.classList.remove('banners-output');
      document.documentElement.style.removeProperty('color-scheme');
    };
  }, []);

  return <>
    <CustomCss value={config?.customCss}/>
    <div className={'bn-stage ' + (config?.position || 'bottom-center')}>
      {online && config?.enabled && rotation.ad && <BannerCard key={rotation.ad.id + '-' + rotation.cycle}
        ad={rotation.ad} config={config} phase={rotation.phase} cycle={rotation.cycle} total={rotation.count}/>}
    </div>
  </>;
}

function CustomCss({ value }) {
  return value ? <style>{value}</style> : null;
}

function AdRow({ ad, index, count, active, onPreview, onEdit, onMove, onRemove, onToggle }) {
  return <article className="bn-ad-row" data-active={active ? 'true' : 'false'} data-disabled={ad.enabled ? 'false' : 'true'}>
    <span className="bn-ad-order" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
    <button type="button" className="bn-ad-main" onClick={() => onPreview(ad)} aria-label={'Seleccionar ' + ad.name + ' en la vista previa'}>
      <span className="bn-ad-thumb">{ad.image ? <img src={ad.image} alt=""/> : <ImagePlus size={18}/>}</span>
      <span className="bn-ad-copy">
        <span className="bn-ad-title">
          <strong>{ad.name}</strong>
          {!ad.enabled && <Badge>Oculto</Badge>}
        </span>
        <span className="bn-ad-meta">
          <span>{ad.advertiser || 'Sin anunciante'}</span>
          {ad.caption && <><span aria-hidden="true">·</span><span>{ad.caption}</span></>}
        </span>
      </span>
    </button>
    <div className="bn-ad-actions">
      <span className="bn-order-buttons">
        <Button variant="ghost" size="icon" aria-label={'Subir ' + ad.name} title="Subir"
          disabled={index === 0} onClick={() => onMove(ad.id, -1)}><ArrowUp size={14}/></Button>
        <Button variant="ghost" size="icon" aria-label={'Bajar ' + ad.name} title="Bajar"
          disabled={index === count - 1} onClick={() => onMove(ad.id, 1)}><ArrowDown size={14}/></Button>
      </span>
      <Switch checked={ad.enabled} aria-label={'Mostrar ' + ad.name + ' en el directo'}
        onCheckedChange={value => onToggle(ad.id, value)}/>
      <Button variant="ghost" size="icon" aria-label={'Editar ' + ad.name} title="Editar" onClick={() => onEdit(ad.id)}><Pencil size={15}/></Button>
      <Button variant="ghost" size="icon" aria-label={'Eliminar ' + ad.name} title="Eliminar"
        onClick={() => onRemove(ad.id)}><Trash2 size={15}/></Button>
    </div>
  </article>;
}

function AdEditorDialog({ open, ad, config, index, count, locked, busy, saving, dirty, error, onClose, onEdit, onDelete, onDuplicate, onReplace }) {
  useDialogDismiss(open, onClose);
  const first = useRef(null);
  const file = useRef(null);
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => first.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [open, ad?.id]);
  if (!ad) return null;
  return <Dialog open={open} onClose={onClose} className="bn-dialog" backdropClassName="bn-dialog-backdrop" aria-labelledby="bn-ad-title">
    <header className="bn-dialog-header">
      <div className="bn-dialog-heading">
        <span className="bn-dialog-icon"><GalleryHorizontal size={18}/></span>
        <div>
          <h2 id="bn-ad-title">{ad.name || 'Editar anuncio'}</h2>
          <p className="help">Personaliza el contenido de este anuncio. La imagen se puede cambiar cuando quieras.</p>
        </div>
      </div>
      <div className="bn-dialog-header-actions">
        <Badge className={ad.enabled ? 'success' : ''}>{ad.enabled ? 'Visible' : 'Oculto'}</Badge>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar editor de anuncio"><X size={18}/></Button>
      </div>
    </header>
    <div className="bn-dialog-body">
      <fieldset className="bn-dialog-form" disabled={locked}>
        <section className="bn-dialog-section">
          <div className="bn-dialog-section-heading">
            <h3>Creatividad</h3>
            <Toggle name="enabled" label={ad.enabled ? 'Visible' : 'Oculto'} settings={ad} update={(_, value) => onEdit(ad.id, { enabled: value })}/>
          </div>
          <div className="bn-ad-image-field">
            <div className="bn-ad-image-preview">
              {ad.image ? <img src={ad.image} alt={'Vista previa de ' + (ad.name || 'anuncio')}/> : <ImagePlus size={22}/>}
            </div>
            <div className="bn-ad-image-actions">
              <input ref={file} type="file" hidden accept={imageAccept} aria-label={'Cambiar imagen de ' + (ad.name || 'anuncio')}
                onChange={event => {
                  const picked = event.target.files?.[0];
                  event.target.value = '';
                  if (picked) onReplace(ad.id, picked);
                }}/>
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => file.current.click()}>
                <Upload size={14}/>{busy || 'Cambiar imagen'}
              </Button>
              <p className="help">PNG, JPG, WebP, GIF o SVG. Las animaciones internas del SVG se conservan.</p>
            </div>
          </div>
          <Field label="Nombre interno" hint="Solo aparece en el editor.">{id => <Input ref={first} id={id} value={ad.name ?? ''} maxLength={60}
            onChange={event => onEdit(ad.id, { name: event.target.value })}/>}</Field>
          <Field label="Texto alternativo" hint="Describe la imagen para accesibilidad.">{id => <Input id={id} value={ad.alt ?? ''} maxLength={160}
            placeholder="Ej.: Oferta de temporada de la tienda"
            onChange={event => onEdit(ad.id, { alt: event.target.value })}/>}</Field>
          <div className="bn-dialog-fields">
            <Field label="Anunciante" hint="Se muestra si activas la opción en el diseño.">{id => <Input id={id} value={ad.advertiser ?? ''} maxLength={60}
              placeholder="Nombre de la marca"
              onChange={event => onEdit(ad.id, { advertiser: event.target.value })}/>}</Field>
            <Field label="Mensaje corto" hint="Llamada a la acción o texto de campaña.">{id => <Input id={id} value={ad.caption ?? ''} maxLength={120}
              placeholder="Visita la tienda"
              onChange={event => onEdit(ad.id, { caption: event.target.value })}/>}</Field>
          </div>
        </section>
        <div className="bn-dialog-note">
          <span className="bn-dialog-note-index">{index + 1}<small>/{count}</small></span>
          <p className="help">Es la posición de este anuncio en la rotación. Usa las flechas de la lista para cambiarla.</p>
        </div>
      </fieldset>
      <aside className="bn-dialog-preview">
        <div className="bn-dialog-section-heading"><h3>Vista previa</h3></div>
        <div className="bn-dialog-preview-stage">
          <BannerCard ad={ad} config={config} preview phase="enter" total={1}/>
        </div>
        <p className="help">Usa el nombre del anunciante y el mensaje para reforzar la campaña sin recargar la imagen.</p>
      </aside>
    </div>
    <footer className="bn-dialog-footer">
      <Button variant="ghost" disabled={locked} onClick={() => onDelete(ad.id)}><Trash2 size={15}/>Eliminar</Button>
      <div className="actions">
        <Button variant="ghost" disabled={locked || count >= maxAds} onClick={() => onDuplicate(ad.id)}><Copy size={15}/>Duplicar</Button>
        <span className={error ? 'bn-save-error' : 'help'} role="status">
          {error || (saving ? 'Guardando…' : dirty ? 'Guardando cambios…' : 'Cambios guardados')}
        </span>
        <Button onClick={onClose}>Listo</Button>
      </div>
    </footer>
  </Dialog>;
}

function DeleteAdDialog({ ad, locked, onCancel, onConfirm }) {
  useDialogDismiss(Boolean(ad), onCancel);
  if (!ad) return null;
  return <Dialog open onClose={onCancel} className="bn-dialog bn-dialog-confirm" backdropClassName="bn-dialog-backdrop" aria-labelledby="bn-delete-title">
    <span className="bn-confirm-icon"><Trash2 size={20}/></span>
    <h2 id="bn-delete-title">Eliminar {ad.name || 'anuncio'}</h2>
    <p>El anuncio saldrá de la rotación. La imagen seguirá guardada en el equipo por si la vuelves a usar.</p>
    <div className="bn-confirm-actions">
      <Button variant="outline" onClick={onCancel}>Cancelar</Button>
      <Button variant="destructive" disabled={locked} onClick={onConfirm}>Eliminar anuncio</Button>
    </div>
  </Dialog>;
}

export function BannersStudio({ tool, api, notice, online }) {
  const { config, setConfig, dirty, saving, error, save } = useNotificationSettings(tool.config ?? defaultBanners, tool.revision, api, online, storage);
  const [mobileView, setMobileView] = useState('editor');
  const [autoRotate, setAutoRotate] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [uploadBusy, setUploadBusy] = useState('');
  const [dragging, setDragging] = useState(false);
  const file = useRef(null);
  const rotation = useBannerRotation(config, { auto: autoRotate });
  const update = (key, value) => setConfig(previous => ({ ...previous, [key]: value }));
  const editAd = (id, patch) => setConfig(previous => ({
    ...previous,
    ads: previous.ads.map(ad => ad.id === id ? { ...ad, ...patch } : ad),
  }));
  const url = new URL(bannersOutputPath, location.origin).href;
  const ads = config.ads;
  const active = ads.filter(ad => ad.enabled).length;
  const selected = rotation.count ? (rotation.index % rotation.count) + 1 : 0;
  const editing = ads.find(ad => ad.id === editingId) ?? null;
  const removing = ads.find(ad => ad.id === removingId) ?? null;
  const interval = Number(config.interval) || 8;

  const setDimension = (key, value) => setConfig(previous => ({ ...previous, [key]: value }));

  async function uploadFiles(files, replaceId) {
    if (!online) {
      notice('Conecta con el centro para subir archivos.', { type: 'warning' });
      return;
    }
    const list = [...(files ?? [])];
    if (!list.length) return;
    const available = replaceId ? 1 : maxAds - ads.length;
    if (!replaceId && available <= 0) {
      notice('Puedes guardar hasta ' + maxAds + ' anuncios.', { type: 'warning' });
      return;
    }
    const accepted = [];
    for (const picked of list.slice(0, available)) {
      if ((!acceptedTypes.test(picked.type) && !acceptedExtension.test(picked.name)) || picked.size > maxImageBytes) {
        notice(picked.name + ': elige una imagen PNG, JPG, WebP, GIF o SVG de hasta 10 MB.', { type: 'warning' });
        continue;
      }
      accepted.push(picked);
    }
    if (!accepted.length) return;
    setUploadBusy('Preparando…');
    let saved = 0;
    for (let index = 0; index < accepted.length; index++) {
      const picked = accepted[index];
      setUploadBusy('Subiendo ' + (index + 1) + ' de ' + accepted.length + '…');
      try {
        const data = await readAsDataUrl(picked);
        const result = await api('banners/upload', { data, kind: 'image' }, { throwOnError: true });
        if (!result?.image) throw new Error('No se pudo guardar ' + picked.name);
        if (replaceId) {
          setConfig(previous => ({
            ...previous,
            ads: previous.ads.map(ad => ad.id === replaceId ? { ...ad, image: result.image } : ad),
          }));
        } else {
          setConfig(previous => ({
            ...previous,
            ads: [...previous.ads, {
              id: crypto.randomUUID(),
              image: result.image,
              name: fileBaseName(picked.name),
              alt: '',
              advertiser: '',
              caption: '',
              enabled: true,
            }],
          }));
        }
        saved++;
      } catch (exception) {
        notice(exception.message, { type: 'error' });
      }
    }
    setUploadBusy('');
    setDragging(false);
    if (!saved) return;
    if (replaceId) notice('Imagen del anuncio actualizada.');
    else notice(saved === 1 ? 'Anuncio añadido a la rotación.' : saved + ' anuncios añadidos a la rotación.');
  }

  function openPicker() {
    if (!online || uploadBusy) return;
    if (ads.length >= maxAds) {
      notice('Puedes guardar hasta ' + maxAds + ' anuncios.', { type: 'warning' });
      return;
    }
    file.current?.click();
  }

  function dropFiles(event) {
    event.preventDefault();
    setDragging(false);
    if (uploadBusy) return;
    if (event.dataTransfer?.files?.length) void uploadFiles(event.dataTransfer.files);
  }

  function moveAd(id, direction) {
    const index = ads.findIndex(ad => ad.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ads.length) return;
    const next = [...ads];
    [next[index], next[target]] = [next[target], next[index]];
    update('ads', next);
  }

  function removeAd(id) {
    if (editingId === id) setEditingId(null);
    update('ads', ads.filter(ad => ad.id !== id));
    setRemovingId(null);
    notice('Anuncio eliminado de la rotación.', { type: 'info' });
  }

  function duplicateAd(id) {
    if (ads.length >= maxAds) {
      notice('Puedes guardar hasta ' + maxAds + ' anuncios.', { type: 'warning' });
      return;
    }
    const source = ads.find(ad => ad.id === id);
    if (!source) return;
    const copy = { ...source, id: crypto.randomUUID(), name: (source.name || 'Anuncio').slice(0, 53) + ' copia', enabled: false };
    update('ads', [...ads, copy]);
    setEditingId(copy.id);
    notice('Anuncio duplicado. Actívalo cuando esté listo.', { type: 'info' });
  }

  function previewAd(ad) {
    if (!ad.enabled) {
      setEditingId(ad.id);
      return;
    }
    rotation.select(ad.id);
    setMobileView('monitor');
  }

  async function saveNow() {
    if (await save()) notice('Espacio publicitario guardado.');
  }

  return <div className="banner-editor editor-workspace">
    <header className="editor-workspace-header banner-header">
      <div className="banner-heading-block">
        <span className="banner-heading-icon"><GalleryHorizontal size={21}/></span>
        <div>
          <h1 className="editor-workspace-title">Ad Banner Rotator</h1>
          <p className="banner-subtitle">Un espacio publicitario con imágenes y SVG, animado con un toque corporativo.</p>
        </div>
      </div>
      <OutputToolbar title="Salida del directo" description="Añade esta fuente de navegador al directo. Funciona con uno o varios anuncios, sin conectar TikTok.">
        <OutputLinks notice={notice} url={url} message="Enlace de Ad Banner Rotator copiado." iconSize={15} size="sm"/>
      </OutputToolbar>
    </header>
    <EditorViewSwitch view={mobileView} change={setMobileView} editorLabel="Anuncios" monitorLabel="Vista previa"/>
    <div className="editor-workspace-grid" data-view={mobileView}>
      <Card className="banner-settings editor-workspace-settings">
        <div className="banner-summary">
          <div className="banner-summary-copy">
            <h2>Anuncios y rotación</h2>
            <p className="help">{rotation.count > 1
              ? 'Pulsa un anuncio para verlo en la vista previa. Cada ' + interval + ' segundos entra uno nuevo.'
              : 'Pulsa un anuncio para verlo en la vista previa. Con un solo anuncio se mantiene fijo.'}</p>
          </div>
          <div className="banner-summary-side">
            <div className="banner-stats" aria-label="Resumen de la rotación">
              <span className="banner-stat"><span className="banner-stat-dot" data-on={active > 0}/><strong>{active}</strong> {active === 1 ? 'activo' : 'activos'}</span>
              <span className="banner-stat"><strong>{ads.length}</strong> en total</span>
            </div>
            <Toggle name="enabled" label="Mostrar en el directo" settings={config} update={update}/>
            <Button size="sm" onClick={openPicker} disabled={!online || ads.length >= maxAds || Boolean(uploadBusy)}><Plus size={15}/>Añadir anuncio</Button>
          </div>
        </div>

        <section className="banner-section">
          <div className="banner-section-heading">
            <div>
              <h3>Anuncios del espacio</h3>
              <p className="help">Cambia el orden con las flechas. Los anuncios ocultos se conservan sin salir al directo.</p>
            </div>
            <Badge>{ads.length} / {maxAds}</Badge>
          </div>
          {ads.length > 0 && <div className="bn-ad-list">
            {ads.map((ad, index) => <AdRow key={ad.id} ad={ad} index={index} count={ads.length}
              active={ad.enabled && rotation.ad?.id === ad.id}
              onPreview={previewAd}
              onEdit={setEditingId}
              onMove={moveAd}
              onRemove={setRemovingId}
              onToggle={(id, value) => editAd(id, { enabled: value })}/>)}
          </div>}
          {ads.length === 0 && <div className="banner-empty-state">
            <GalleryHorizontal size={26}/>
            <strong>Tu espacio publicitario está listo</strong>
            <p>Sube una imagen o un SVG para empezar. Puedes añadir varios y rotarlos automáticamente.</p>
          </div>}
          <section className="bn-dropzone" data-dragging={dragging} data-busy={Boolean(uploadBusy)}
            aria-label="Subir anuncios"
            onDragOver={event => { event.preventDefault(); if (online && !uploadBusy) setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={dropFiles}>
            <input ref={file} type="file" hidden multiple accept={imageAccept} aria-label="Seleccionar imágenes de anuncios"
              onChange={event => {
                const picked = event.target.files;
                event.target.value = '';
                if (picked?.length) void uploadFiles(picked);
              }}/>
            <span className="bn-dropzone-icon"><Upload size={21}/></span>
            <div className="bn-dropzone-copy">
              <strong>{uploadBusy || (ads.length ? 'Añade más creatividades' : 'Arrastra tus anuncios aquí')}</strong>
              <p>PNG, JPG, WebP, GIF o SVG · hasta 10 MB (SVG 3 MB). Las animaciones internas del SVG se conservan.</p>
            </div>
            <Button size="sm" variant="outline" onClick={openPicker} disabled={!online || ads.length >= maxAds || Boolean(uploadBusy)}>
              <ImagePlus size={15}/>Elegir archivos
            </Button>
          </section>
        </section>

        <section className="banner-section">
          <div className="banner-section-heading">
            <div>
              <h3>Ritmo y transición</h3>
              <p className="help">Elige cuánto dura cada anuncio y cómo entra y sale de pantalla.</p>
            </div>
            <Badge>{positionLabel(config.position)}</Badge>
          </div>
          <div className="banner-fields">
            <Field label="Tiempo por anuncio · segundos" hint="Entre 3 y 300 segundos.">{id => <Input id={id} type="number" min="3" max="300" value={config.interval}
              onChange={event => update('interval', event.target.value === '' ? '' : Number(event.target.value))}/>}</Field>
            <Field label="Duración de la animación · ms" hint="Entre 150 y 2000 ms.">{id => <Input id={id} type="number" min="150" max="2000" step="50" value={config.transition}
              onChange={event => update('transition', event.target.value === '' ? '' : Number(event.target.value))}/>}</Field>
            <Field label="Animación de entrada">{id => <Select id={id} value={config.animation} onChange={event => update('animation', event.target.value)}>
              {bannerAnimations.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>}</Field>
            <Field label="Animación de salida">{id => <Select id={id} value={config.exitAnimation} onChange={event => update('exitAnimation', event.target.value)}>
              {bannerExits.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>}</Field>
            <Field label="Posición en pantalla">{id => <Select id={id} value={config.position} onChange={event => update('position', event.target.value)}>
              {bannerPositions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>}</Field>
          </div>
          <div className="banner-toggle-grid">
            <Toggle name="random" label="Orden aleatorio" settings={config} update={update}/>
            <Toggle name="showProgress" label="Barra de progreso" settings={config} update={update}/>
          </div>
        </section>

        <details className="banner-design-section" open>
          <summary>
            <span className="banner-design-summary">
              <span>
                <strong>Espacio y formato</strong>
                <small>{config.fitToCreative ? 'Según el tamaño de cada imagen' : 'Fijo · ' + config.width + ' × ' + config.height + ' px'}</small>
              </span>
            </span>
            <ChevronDown className="banner-design-chevron" size={16} aria-hidden="true"/>
          </summary>
          <div className="banner-design-body">
            <Toggle name="fitToCreative" label="Ajustar al tamaño de cada imagen" description="Sin recortes ni barras: ideal para piezas y SVG hechos a medida." settings={config} update={update}/>
            {config.fitToCreative
              ? <p className="banner-auto-note">La salida muestra cada creatividad con su tamaño y proporción originales, sin recortes ni barras. Si es más grande que el área visible, se escala manteniendo la proporción.</p>
              : <div className="banner-fields">
                  <Field label="Ancho fijo · px" hint="120 a 1920 px.">{id => <Input id={id} type="number" min="120" max="1920" value={config.width}
                    onChange={event => setDimension('width', event.target.value === '' ? '' : Number(event.target.value))}/>}</Field>
                  <Field label="Alto fijo · px" hint="40 a 1080 px.">{id => <Input id={id} type="number" min="40" max="1080" value={config.height}
                    onChange={event => setDimension('height', event.target.value === '' ? '' : Number(event.target.value))}/>}</Field>
                  <Field label="Ajuste de la imagen">{id => <Select id={id} value={config.fit} onChange={event => update('fit', event.target.value)}>
                    {bannerFits.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </Select>}</Field>
                </div>}
            <div className="banner-fields">
              <Field label="Relleno interior · px" hint="Solo en el marco corporativo.">{id => <Input id={id} type="number" min="0" max="48" value={config.padding}
                onChange={event => update('padding', event.target.value === '' ? '' : Number(event.target.value))}/>}</Field>
            </div>
            <fieldset className="banner-choices">
              <legend>Formato del anuncio</legend>
              <div>
                {bannerLayouts.map(([value, label]) => (
                  <button type="button" key={value} aria-pressed={config.layout === value} onClick={() => update('layout', value)}>
                    <span className={'bn-layout-mini bn-layout-mini-' + value} aria-hidden="true"><i/><b/></span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="banner-toggle-grid">
              <Toggle name="showLabel" label="Etiqueta de publicidad" settings={config} update={update}/>
              <Toggle name="imageMotion" label="Movimiento suave de imagen" settings={config} update={update}/>
              <Toggle name="showAdvertiser" label="Mostrar anunciante" settings={config} update={update}/>
              <Toggle name="showCaption" label="Mostrar mensaje" settings={config} update={update}/>
            </div>
            {config.showLabel && <Field label="Texto de la etiqueta" hint="Déjalo vacío para ocultarla. Máximo 24 caracteres.">{id =>
              <Input id={id} value={config.labelText} maxLength={24} placeholder="PUBLICIDAD"
                onChange={event => update('labelText', event.target.value)}/>}</Field>}
          </div>
        </details>

        <details className="banner-design-section">
          <summary>
            <span className="banner-design-summary">
              <span>
                <strong>Diseño</strong>
                <small>{styleLabel(config.style)} · radio {config.radius} px</small>
              </span>
            </span>
            <ChevronDown className="banner-design-chevron" size={16} aria-hidden="true"/>
          </summary>
          <div className="banner-design-body">
            <fieldset className="banner-choices banner-style-choices">
              <legend>Tema visual</legend>
              <div>
                {bannerStyles.map(([value, label]) => (
                  <button type="button" key={value} aria-pressed={config.style === value} onClick={() => update('style', value)}>
                    <span className={'bn-swatch bn-swatch-' + value} aria-hidden="true"><i/><b/></span>
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
              ['radius', 'Bordes redondeados · px', 0, 60],
            ]} settings={config} update={update}/>
          </div>
        </details>

        <details className="banner-design-section">
          <summary>
            <span className="banner-design-summary">
              <span>
                <strong>CSS personalizado</strong>
                <small>{config.customCss ? 'Con reglas propias' : 'Opcional'}</small>
              </span>
            </span>
            <ChevronDown className="banner-design-chevron" size={16} aria-hidden="true"/>
          </summary>
          <div className="banner-design-body">
            <p className="help">Añade reglas que sobreescriban el aspecto del anuncio; se aplican en el directo y en esta vista previa.</p>
            <Field>{id => <Textarea id={id} className="banner-css-input" value={config.customCss ?? ''} rows={8} spellCheck={false}
              placeholder={'.bn-card {\n  box-shadow: 0 0 32px #3b82f655;\n}\n\n.bn-tag {\n  letter-spacing: .18em;\n}'}
              onChange={event => update('customCss', event.target.value)}/>}</Field>
          </div>
        </details>

        <div className={'banner-savebar' + (error ? ' has-error' : '')}>
          <span role="status" className={error ? 'bn-save-error' : dirty ? 'banner-save-dirty' : 'help'}>
            {error || (saving ? 'Guardando…' : dirty ? online ? 'Cambios pendientes de guardar…' : 'Sin conexión: cambios guardados en este navegador' : 'Todos los cambios guardados')}
          </span>
          {dirty && <Button variant="outline" size="sm" disabled={!online || saving} onClick={saveNow}>{saving ? 'Guardando…' : 'Guardar ahora'}</Button>}
        </div>
      </Card>

      <div className="banner-monitor editor-workspace-monitor">
        <Card className="banner-preview-card">
          <div className="banner-panel-heading">
            <div>
              <h2>Vista previa</h2>
              <p className="help">Así se verá el espacio publicitario en la salida del directo.</p>
            </div>
            <Badge className={config.enabled && rotation.count ? 'success' : ''}>{!config.enabled ? 'Oculto en directo' : rotation.count ? selected + ' / ' + rotation.count : 'Sin anuncios'}</Badge>
          </div>
          <div className="banner-preview" data-position={config.position}>
            <CustomCss value={config.customCss}/>
            {rotation.ad
              ? <BannerCard key={rotation.ad.id + '-' + rotation.cycle} ad={rotation.ad} config={config} phase={rotation.phase} cycle={rotation.cycle} total={rotation.count} preview/>
              : <p className="banner-empty">Sube un anuncio para verlo aquí.</p>}
          </div>
          {rotation.count > 0 && <div className="banner-preview-ads" role="group" aria-label="Elegir anuncio en la vista previa">
            {ads.filter(ad => ad.enabled).map(ad => <button type="button" key={ad.id} className="banner-preview-ad" aria-pressed={rotation.ad?.id === ad.id}
              onClick={() => rotation.select(ad.id)}>
              <img src={ad.image} alt=""/>{ad.name}
            </button>)}
          </div>}
          <div className="banner-preview-controls">
            <Button variant="outline" size="sm" disabled={rotation.count < 2} onClick={rotation.previous}><SkipBack size={14}/>Anterior</Button>
            <Button variant="outline" size="sm" disabled={rotation.count < 2} onClick={rotation.next}>Siguiente<SkipForward size={14}/></Button>
            <Button variant="ghost" size="sm" disabled={!rotation.count} onClick={rotation.replay} title="Reproduce la animación de salida y vuelve a entrar"><RotateCcw size={14}/>Repetir animación</Button>
          </div>
          <div className="banner-preview-autoplay">
            <Toggle name="auto" label="Rotación automática en la vista previa" settings={{ auto: autoRotate }} update={(_, value) => setAutoRotate(value)}/>
          </div>
        </Card>

        <Card className="banner-facts-card">
          <div className="banner-panel-heading">
            <div>
              <h2>Resumen</h2>
              <p className="help">La rotación continúa mientras la salida esté abierta.</p>
            </div>
            <Badge className={config.enabled && active > 0 ? 'success' : ''}>{config.enabled && active > 0 ? 'En directo' : 'Oculto'}</Badge>
          </div>
          <dl className="banner-facts">
            <div><dt>Anuncios activos</dt><dd>{active}</dd></div>
            <div><dt>Espacio</dt><dd>{config.fitToCreative ? 'Según la imagen' : config.width + ' × ' + config.height + ' px'}</dd></div>
            <div><dt>Tiempo por anuncio</dt><dd>{interval} s</dd></div>
            <div><dt>Entrada</dt><dd>{animationLabel(config.animation, bannerAnimations)}</dd></div>
            <div><dt>Salida</dt><dd>{animationLabel(config.exitAnimation, bannerExits)}</dd></div>
            <div><dt>Posición</dt><dd>{positionLabel(config.position)}</dd></div>
            <div><dt>Formato</dt><dd>{layoutLabel(config.layout)}</dd></div>
            <div><dt>Tema</dt><dd>{styleLabel(config.style)}</dd></div>
          </dl>
          <p className="help">La etiqueta «PUBLICIDAD» ayuda a identificar el espacio. Los cambios se guardan y se aplican automáticamente.</p>
        </Card>
      </div>

      <AdEditorDialog open={Boolean(editing)} ad={editing} config={config}
        index={editing ? ads.findIndex(ad => ad.id === editing.id) : 0} count={ads.length}
        locked={!online} busy={Boolean(uploadBusy)} saving={saving} dirty={dirty} error={error}
        onClose={() => setEditingId(null)}
        onEdit={editAd}
        onDelete={id => { setEditingId(null); setRemovingId(id); }}
        onDuplicate={duplicateAd}
        onReplace={(id, picked) => void uploadFiles([picked], id)}/>
      <DeleteAdDialog ad={removing} locked={!online}
        onCancel={() => setRemovingId(null)} onConfirm={() => removing && removeAd(removing.id)}/>
    </div>
  </div>;
}
