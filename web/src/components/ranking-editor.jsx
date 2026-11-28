import { useState } from 'react';
import { boardStyle } from '../lib/widget-css';
import { WidgetCssEditor } from './css-reference';
import { AutoFitPreview } from './auto-fit-preview';
import { ChevronDown, Gift, Heart, MapPin, RotateCcw } from 'lucide-react';
import { downloadFile } from '../lib/download-file';
import { DownloadButton } from './ui/download-button';
import { OutputLinks, OutputToolbar } from './output-controls';
import { EditorViewSwitch } from './editor-view-switch';
import { Badge, Button, Card, Input, Select } from './ui';
import { Field, NumberSettings, OverlayColors, Toggle } from './fields';
import {
  defaultLikes,
  likesOutputPath,
  likesPresets,
  likesStyles,
} from '../../../modules/likes/config';
import {
  defaultGifters,
  giftersMetrics,
  giftersOutputPath,
  giftersPresets,
  giftersStyles,
} from '../../../modules/gifters/config';
import './editor-workspace.css';
import './ranking-editor.css';

const positions = [
  ['top-left', 'Arriba · izquierda'],
  ['top-center', 'Arriba · centro'],
  ['top-right', 'Arriba · derecha'],
  ['bottom-left', 'Abajo · izquierda'],
  ['bottom-center', 'Abajo · centro'],
  ['bottom-right', 'Abajo · derecha'],
];

const variants = {
  likes: {
    title: 'Top likes',
    subtitle: 'Muestra en el directo a quienes más likes han dado.',
    icon: Heart,
    outputPath: likesOutputPath,
    styles: likesStyles,
    presets: likesPresets,
    defaults: defaultLikes,
    metrics: null,
    effects: [
      ['rgbNames', 'Reflejo RGB en los nombres'],
      ['animateNames', 'Movimiento suave en los nombres'],
      ['pulseHearts', 'Corazones con latido'],
    ],
    connectedText: 'Recibiendo likes del LIVE.',
    offlineText: 'Conecta TikTok para recibir likes.',
    copyMessage: 'Enlace de Top likes copiado.',
    exportAction: 'likes/export',
    exportFile: 'scoreboard-likes.json',
    resetAction: 'likes/reset',
    resetNotice: 'Conteo de likes reiniciado.',
    eventLabel: 'like',
    eventPlural: 'likes',
  },
  gifters: {
    title: 'Top gifters',
    subtitle: 'Reconoce a quienes más regalan durante el directo.',
    icon: Gift,
    outputPath: giftersOutputPath,
    styles: giftersStyles,
    presets: giftersPresets,
    defaults: defaultGifters,
    metrics: giftersMetrics,
    effects: [
      ['rgbNames', 'Reflejo RGB en los nombres'],
      ['animateNames', 'Movimiento suave en los nombres'],
      ['pulseGifts', 'Regalos con movimiento'],
    ],
    connectedText: 'Recibiendo regalos del LIVE.',
    offlineText: 'Conecta TikTok para recibir regalos.',
    copyMessage: 'Enlace de Top gifters copiado.',
    exportAction: 'gifters/export',
    exportFile: 'scoreboard-gifters.json',
    resetAction: 'gifters/reset',
    resetNotice: 'Conteo de regalos reiniciado.',
    eventLabel: 'regalo',
    eventPlural: 'regalos',
  },
};

const number = value => Number(value || 0).toLocaleString('es');
const positionLabel = value => positions.find(([id]) => id === value)?.[1] ?? 'Arriba · derecha';

export function RankingEditor({
  variant,
  tool,
  api,
  notice,
  online,
  connected,
  config,
  setConfig,
  dirty,
  saving,
  error,
  demo,
  setDemo,
  stats,
  preview,
}) {
  const meta = variants[variant];
  const Icon = meta.icon;
  const [mobileView, setMobileView] = useState('editor');
  const [reset, setReset] = useState(false);
  const update = (key, value) => setConfig(current => ({ ...current, [key]: value }));
  const url = new URL(meta.outputPath, location.origin).href;
  const side = (config.position || 'top-right').split('-')[1];
  const defaults = { ...meta.defaults, ...config };
  const styleLabel = meta.styles.find(([id]) => id === config.style)?.[1] ?? '';

  return <div className={`${variant}-editor editor-workspace ranking-editor`} style={{ '--ranking-accent': config.accent }}>
    <header className="editor-workspace-header ranking-header">
      <div className="ranking-heading">
        <span className={`ranking-heading-icon ranking-heading-icon-${variant}`}><Icon size={21}/></span>
        <div>
          <h1 className="editor-workspace-title">{meta.title}</h1>
          <p className="ranking-subtitle">{meta.subtitle}</p>
        </div>
      </div>
      <OutputToolbar connected={connected} description={connected ? meta.connectedText : meta.offlineText}>
        <OutputLinks notice={notice} url={url} message={meta.copyMessage} iconSize={15} size="sm"/>
      </OutputToolbar>
    </header>

    <EditorViewSwitch view={mobileView} change={setMobileView} editorLabel="Diseño" monitorLabel="Vista previa y conteo"/>

    <div className="editor-workspace-grid" data-view={mobileView}>
      <Card className={`${variant}-settings editor-workspace-settings ranking-settings`}>
        <div className="ranking-section ranking-intro">
          <div className="ranking-section-heading">
            <div>
              <h2>Clasificación</h2>
              <p className="help">Elige cómo se ve el ranking en tu directo.</p>
            </div>
            <Toggle name="enabled" label="Mostrar en el directo" settings={defaults} update={update}/>
          </div>
        </div>

        <div className="ranking-section">
          <div className="ranking-section-heading">
            <div>
              <h3>Estilo visual</h3>
              <p className="help">Aplica un acabado distinto; después puedes ajustar colores y medidas.</p>
            </div>
            {styleLabel && <Badge>{styleLabel}</Badge>}
          </div>
          <div className="ranking-style-grid" role="group" aria-label="Estilo visual">
            {meta.styles.map(([value, label]) => <button type="button" key={value} className="ranking-style-option"
              aria-pressed={config.style === value} onClick={() => setConfig(current => ({ ...current, ...meta.presets[value], style: value }))}>
              <span className={`ranking-style-mini ranking-style-mini-${value}`} aria-hidden="true"><i/><i/><i/></span>
              <span>{label}</span>
            </button>)}
          </div>
        </div>

        <div className="ranking-section">
          <div className="ranking-section-heading">
            <h3>Contenido</h3>
          </div>
          <div className="ranking-fields">
            <div className="ranking-field-full">
              <Field label="Título">{id => <Input id={id} value={config.title} maxLength={80} onChange={event => update('title', event.target.value)}/>}</Field>
            </div>
            {meta.metrics && <Field label="Métrica">{id => <Select id={id} value={config.metric} onChange={event => update('metric', event.target.value)}>
              {meta.metrics.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>}</Field>}
            <NumberSettings fields={[['limit', 'Usuarios visibles', 1, 20]]} settings={config} update={update}/>
          </div>
          <div className="ranking-toggles">
            <Toggle name="showTitle" label="Mostrar título" settings={defaults} update={update}/>
            <Toggle name="showTotal" label="Mostrar total recibido" settings={config} update={update}/>
          </div>
        </div>

        <div className="ranking-section">
          <div className="ranking-section-heading">
            <div>
              <h3>Posición en pantalla</h3>
              <p className="help">Se aplica también a la fuente del directo.</p>
            </div>
            <span className="ranking-position-label">{positionLabel(config.position)}</span>
          </div>
          <div className="ranking-position-grid" role="group" aria-label="Posición en pantalla">
            {positions.map(([value, label]) => <button type="button" key={value} className="ranking-position-option"
              aria-pressed={config.position === value} aria-label={label} title={label} onClick={() => update('position', value)}>
              <span className={`ranking-position-frame ranking-position-${value}`} aria-hidden="true"><i/></span>
            </button>)}
          </div>
        </div>

        <div className="ranking-section">
          <div className="ranking-section-heading">
            <h3>Colores</h3>
          </div>
          <OverlayColors settings={config} update={update}/>
        </div>

        <details className="ranking-details">
          <summary><span>Dimensiones y bordes</span><ChevronDown size={15} aria-hidden="true"/></summary>
          <div className="ranking-details-body">
            <NumberSettings fields={[
              ['width', 'Ancho · px', 280, 1600],
              ['fontSize', 'Tamaño de texto · px', 16, 96],
              ['opacity', 'Opacidad del fondo · %', 0, 100],
              ['borderOpacity', 'Opacidad del borde · %', 0, 100],
              ['radius', 'Bordes redondeados · px', 0, 80],
            ]} settings={config} update={update}/>
            <Button variant="outline" size="sm" onClick={() => setConfig(current => ({
              ...current,
              fontSize: Math.max(30, Number(current.fontSize) || 30),
              width: Math.max(400, Number(current.width) || 400),
              color: '#ffffff',
            }))}>Mejorar lectura en móvil</Button>
          </div>
        </details>

        <details className="ranking-details">
          <summary><span>Efectos</span><ChevronDown size={15} aria-hidden="true"/></summary>
          <div className="ranking-details-body ranking-toggles">
            {meta.effects.map(([name, label]) => <Toggle key={name} name={name} label={label} settings={defaults} update={update}/>)}
          </div>
        </details>

        <details className={`ranking-details ranking-css-editor ${variant}-css-editor`}>
          <summary><span>CSS personalizado</span><ChevronDown size={15} aria-hidden="true"/></summary>
          <div className="ranking-details-body">
            <WidgetCssEditor css={config.customCss} change={value => update('customCss', value)}
              enabled={config.cssEnabled} onEnabledChange={value => update('cssEnabled', value)}
              selector={`.${variant}-board`} properties={boardStyle(variant, config)}
              selectors={['rank', 'portrait', 'avatar', 'crown', 'name', 'score', 'empty', variant === 'likes' ? 'heart' : 'gift'].map(name => `.${variant}-${name}`).concat([`.${variant}-board > header`, `.${variant}-board > ol > li`, `.${variant}-board > footer`])}
              extraVariables={['share', 'name-color', 'name-motion'].map(name => `--${variant}-${name}`)}/>
          </div>
        </details>

        <p role="status" className={`ranking-status ${error ? 'error' : 'help'}`}>{error || (saving ? 'Guardando…' : dirty ? online ? 'Pendiente de autoguardado' : 'Pendiente de conexión' : 'Configuración guardada')}</p>
      </Card>

      <div className={`${variant}-monitor editor-workspace-monitor ranking-monitor`}>
        <Card className="ranking-preview-card">
          <div className="ranking-panel-heading">
            <div>
              <h2>Vista previa</h2>
              <p className="help">Así se verá en el directo.</p>
            </div>
            <Toggle name="demo" label="Ver ejemplo (solo vista previa)" settings={{ demo }} update={(_, value) => setDemo(value)}/>
          </div>
          <AutoFitPreview width={Number(config.width) || 420}
            className={`${variant}-preview ${variant}-preview-${side} ranking-preview ranking-preview-${side}`}>
            {preview}
          </AutoFitPreview>
          <div className="ranking-preview-meta">
            <span className="ranking-position-chip"><MapPin size={13} aria-hidden="true"/>{positionLabel(config.position)}</span>
            <span className="help">{Number(config.opacity) === 0 ? 'Fondo transparente: se verá el video detrás.' : 'La vista previa se ajusta al panel.'}</span>
          </div>
        </Card>

        <Card className="ranking-live-card">
          <div className="ranking-panel-heading">
            <div>
              <h2>Conteo local</h2>
              <p className="help">Datos guardados de tu directo.</p>
            </div>
            <Badge className={connected ? 'success' : ''}>{connected ? 'En vivo' : 'Conteo guardado'}</Badge>
          </div>
          <div className="ranking-stats">
            {stats.map(stat => {
              const StatIcon = stat.icon;
              return <div className="ranking-stat" key={stat.label}>
                <span className="ranking-stat-label">{StatIcon && <StatIcon size={12} aria-hidden="true"/>}{stat.label}</span>
                <strong>{number(stat.value)}</strong>
              </div>;
            })}
          </div>
          <p className="ranking-live-line">{tool.channel && '@' + tool.channel + ' · '}{tool.updatedAt ? 'Último ' + meta.eventLabel + ' a las ' + new Date(tool.updatedAt).toLocaleTimeString('es') : 'Esperando ' + meta.eventPlural}</p>
          {tool.error && <p className="error">{tool.error}</p>}
          <div className="actions ranking-actions">
            <DownloadButton disabled={!online} onClick={async () => {
              const data = await api(meta.exportAction);
              if (data) downloadFile(meta.exportFile, JSON.stringify(data, null, 2), 'application/json');
            }}>Descargar scoreboard</DownloadButton>
            {reset
              ? <div className="ranking-confirm" role="alert">
                <p>¿Borrar el conteo actual? El diseño se conservará.</p>
                <div className="actions">
                  <Button disabled={!online} onClick={async () => { if (await api(meta.resetAction)) { setReset(false); notice(meta.resetNotice); } }}>Confirmar reinicio</Button>
                  <Button variant="outline" onClick={() => setReset(false)}>Cancelar</Button>
                </div>
              </div>
              : <Button variant="outline" size="sm" disabled={!online} onClick={() => setReset(true)}><RotateCcw size={16}/>Reiniciar conteo</Button>}
          </div>
        </Card>
      </div>
    </div>
  </div>;
}
