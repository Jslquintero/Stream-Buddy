import { useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Button, Input, Select } from './ui';
import { FilePicker } from './ui/file-picker';
import { Field, NumberSettings, OverlayColors, Toggle } from './fields';
import { googleFontOptions, NotificationFonts } from './notification-fonts';
import {
  socialAnimations, socialTextAnimations, socialPositions, socialLayouts, socialStyles,
  socialBorderStyles, socialCornerStyles, socialBorderEffects, socialImageFits, socialImageCorners, socialQrPalettes, socialQrShapes,
  socialIconShapes, socialIconBackdropStyles,
} from '../../../modules/social/config';

const socialImageAccept = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.png,.jpg,.jpeg,.webp,.gif,.svg';
export const socialPhotoCovers = ['photo-cover', 'photo-caption'];
export const socialPhotoLayouts = ['photo-left', 'photo-right', 'photo-top', 'custom', ...socialPhotoCovers];

const qrPaletteOptions = socialQrPalettes.map(({ id, name }) => [id, name]);

function DesignSelect({ name, label, options, design, update }) {
  return <Field label={label}>{id => <Select id={id} value={design[name]} onChange={event => update(name, event.target.value)}>
    {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
  </Select>}</Field>;
}

function RangeSetting({ name, label, min, max, step, unit, design, update }) {
  return <Field label={label}>{id => <div className="social-range">
    <input id={id} type="range" min={min} max={max} step={step} value={design[name]}
      onChange={event => update(name, Number(event.target.value))}/>
    <output htmlFor={id}>{design[name]}{unit}</output>
  </div>}</Field>;
}

const corners = [
  ['TL', 'Superior izquierda'],
  ['TR', 'Superior derecha'],
  ['BR', 'Inferior derecha'],
  ['BL', 'Inferior izquierda'],
];

function CornerSettings({ prefix, max, design, update }) {
  return <NumberSettings fields={corners.map(([corner, label]) => [prefix + corner, label + ' · px', 0, max])}
    settings={design} update={update}/>;
}

export function SocialFormatSettings({ design, update, openImage }) {
  return <>
    <fieldset className="social-choices">
      <legend>Formato de la tarjeta</legend>
      <div>
        {socialLayouts.map(([value, label]) => (
          <button type="button" key={value} aria-pressed={design.layout === value} onClick={() => update('layout', value)}>
            <span className={'social-mini social-mini-' + value} aria-hidden="true"><i/><b/><em/></span>
            <span>{label}</span>
          </button>
        ))}
      </div>
    </fieldset>
    {socialPhotoLayouts.includes(design.layout) && <div className="social-format-actions">
      <Button type="button" variant="outline" size="sm" onClick={openImage}>
        <ImagePlus size={15}/>Configurar imagen
      </Button>
    </div>}
    <div className="social-fields">
      <DesignSelect name="position" label="Posición en pantalla" options={socialPositions} design={design} update={update}/>
      <DesignSelect name="animation" label="Animación de entrada de la tarjeta" options={socialAnimations} design={design} update={update}/>
    </div>
    <div className="social-toggle-grid">
      <Toggle name="showIcon" label="Mostrar icono" settings={design} update={update}/>
      <Toggle name="showLabel" label="Mostrar nombre" settings={design} update={update}/>
      <Toggle name="showHandle" label="Mostrar usuario" settings={design} update={update}/>
    </div>
    {design.showIcon && <NumberSettings fields={[[ 'iconSize', 'Tamaño del icono · px', 24, 96 ]]} settings={design} update={update}/>}
  </>;
}

export function SocialQrSettings({ design, update }) {
  return <>
    <div className="social-dialog-fields">
      <DesignSelect name="qrPalette" label="Colores del QR" options={qrPaletteOptions} design={design} update={update}/>
      <DesignSelect name="qrShape" label="Forma de los módulos" options={socialQrShapes} design={design} update={update}/>
    </div>
    <RangeSetting name="qrSize" label="Tamaño del QR" min={120} max={360} unit=" px" design={design} update={update}/>
    <p className="help">El tamaño se ajusta al espacio de la tarjeta y a la longitud del enlace.</p>
  </>;
}

export function SocialIconSettings({ channel, uploading, onUpload, onRemove }) {
  const isUploading = uploading?.field === 'icon' && uploading.id === channel.id;
  return <section className="social-channel-media-actions">
    <h3 className="social-settings-subheading">Icono de la red</h3>
    <FilePicker label={isUploading ? 'Subiendo…' : channel.icon ? 'Cambiar icono' : 'Subir icono'} inputLabel="Seleccionar imagen para el icono"
      accept={socialImageAccept} disabled={Boolean(uploading)} onFile={file => onUpload(file, channel.id, 'icon')}/>
    {channel.icon && <Button type="button" variant="ghost" size="sm" disabled={isUploading} onClick={onRemove}>
      <Trash2 size={14}/>Quitar icono
    </Button>}
    <p className="help">PNG, JPG, WebP, GIF o SVG · hasta 10 MB (SVG 3 MB).</p>
  </section>;
}

export function SocialImageSettings({ design, channel, label, update, editChannel, updateShared, uploading, onUpload, online, chooseFormat }) {
  const [source, setSource] = useState('channel');
  const shared = source === 'shared';
  const image = shared ? design.image : channel.image;
  const isUploading = uploading?.field === 'image' && uploading.id === (shared ? null : channel.id);
  const photoLayout = socialPhotoLayouts.includes(design.layout);
  const cover = socialPhotoCovers.includes(design.layout);
  const custom = design.layout === 'custom';
  return <>
    <Field label="Archivo de imagen para" hint={shared ? 'Se usa como respaldo en las redes sin imagen propia.' : undefined}>{id => (
      <Select id={id} value={source} onChange={event => setSource(event.target.value)}>
        <option value="channel">Esta red</option>
        <option value="shared">Todas las redes · imagen de respaldo</option>
      </Select>
    )}</Field>
    <div className="social-channel-media">
      <span className={'social-channel-media-preview' + (image ? ' has-image' : '')}>
        {image ? <img src={image} alt={shared ? 'Imagen de respaldo' : 'Imagen de ' + label}/> : <ImagePlus size={22} aria-hidden="true"/>}
      </span>
      <div className="social-channel-media-actions">
        <FilePicker label={isUploading ? 'Subiendo…' : image ? 'Cambiar imagen' : 'Subir imagen o SVG'}
          inputLabel={shared ? 'Seleccionar imagen compartida o SVG' : 'Seleccionar foto o SVG de ' + label}
          accept={socialImageAccept} disabled={!online || Boolean(uploading)} onFile={file => onUpload(file, shared ? null : channel.id)}/>
        {image && <Button type="button" variant="ghost" size="sm" disabled={isUploading}
          onClick={() => shared ? updateShared('image', '') : editChannel(channel.id, { image: '' })}>
          <Trash2 size={14}/>Quitar imagen
        </Button>}
        <p className="help">PNG, JPG, WebP, GIF o SVG · hasta 10 MB (SVG 3 MB).</p>
        {!shared && !image && design.image && <p className="help">Esta red usa la imagen de respaldo.</p>}
      </div>
    </div>
    {photoLayout ? <>
      <h3 className="social-settings-subheading">Encuadre y esquinas</h3>
      {custom && <>
        <NumberSettings fields={[[ 'customHeight', 'Alto de la tarjeta · px', 80, 900 ]]} settings={design} update={update}/>
        <div className="social-fields">
          <RangeSetting name="imagePositionX" label="Posición horizontal en la tarjeta" min={0} max={100} unit="%" design={design} update={update}/>
          <RangeSetting name="imagePositionY" label="Posición vertical en la tarjeta" min={0} max={100} unit="%" design={design} update={update}/>
        </div>
      </>}
      <NumberSettings fields={[
        ...(cover ? [] : [['imageWidth', 'Ancho de la foto · px', 80, 900]]),
        ['imageHeight', cover ? 'Alto de la tarjeta · px' : 'Alto de la foto · px', 80, 900],
        ...(cover || custom ? [] : [['imageGap', 'Separación foto-texto · px', 0, 64]]),
        ['imageOffsetX', 'Encuadre horizontal · %', -50, 50],
        ['imageOffsetY', 'Encuadre vertical · %', -50, 50],
        ['imageZoom', 'Zoom de la foto · %', 100, 200],
      ]} settings={design} update={update}/>
      <div className="social-fields">
        <DesignSelect name="imageFit" label="Encuadre de la foto" options={socialImageFits} design={design} update={update}/>
        <DesignSelect name="imageCorners" label="Esquinas de la foto" options={socialImageCorners} design={design} update={update}/>
      </div>
      {design.imageCorners === 'custom'
        ? <CornerSettings prefix="imageRadius" max={120} design={design} update={update}/>
        : design.imageCorners !== 'none' && <NumberSettings fields={[[ 'imageRadius', 'Radio de la foto · px', 0, 120 ]]} settings={design} update={update}/>}
      <Toggle name="imageShadow" label="Sombra de la foto" settings={design} update={update}/>
    </> : <div className="social-image-format-hint">
      <p className="help">Elige un lower third con foto o la tarjeta personalizada para mostrar la imagen.</p>
      <Button type="button" variant="outline" size="sm" onClick={chooseFormat}>Elegir formato</Button>
    </div>}
  </>;
}

export function SocialTextSettings({ design, update, fonts, api, online }) {
  return <>
    <Field label="Texto superior" hint="Déjalo vacío para ocultarlo.">{id => <Input id={id} value={design.heading} maxLength={40}
      onChange={event => update('heading', event.target.value)}/>}</Field>
    <div className="social-fields">
      <DesignSelect name="fontFamily" label="Tipografía" options={[[ 'theme', 'Fuente del tema' ], ...googleFontOptions(fonts, design.fontFamily)]} design={design} update={update}/>
      <DesignSelect name="textAnimation" label="Animación de entrada del texto" options={socialTextAnimations} design={design} update={update}/>
    </div>
    {design.textAnimation !== 'none' && <RangeSetting name="textAnimationDuration" label="Duración de la animación del texto · ms"
      min={100} max={2000} step={50} unit=" ms" design={design} update={update}/>}
    <NotificationFonts fonts={fonts} api={api} online={online} select={value => update('fontFamily', value)}/>
  </>;
}

export function SocialStyleSettings({ design, update }) {
  return <>
    <fieldset className="social-choices social-style-choices">
      <legend>Tema visual</legend>
      <div>
        {socialStyles.map(([value, label]) => (
          <button type="button" key={value} aria-pressed={design.style === value} onClick={() => update('style', value)}>
            <span className={'social-swatch social-swatch-' + value} aria-hidden="true"><i/><b/></span>
            <span>{label}</span>
          </button>
        ))}
      </div>
    </fieldset>
    <h3 className="social-settings-subheading">Estilo del icono</h3>
    <Toggle name="showIconBackdrop" label="Mostrar fondo del icono" settings={design} update={update}/>
    {design.showIconBackdrop && <div className="social-dialog-fields">
      <DesignSelect name="iconShape" label="Forma del fondo del icono" options={socialIconShapes} design={design} update={update}/>
      <DesignSelect name="iconBackdropStyle" label="Color del fondo del icono" options={socialIconBackdropStyles} design={design} update={update}/>
    </div>}
    <OverlayColors settings={design} update={update}/>
    <fieldset className="social-choices social-corner-choices">
      <legend>Esquinas de la tarjeta</legend>
      <div>
        {socialCornerStyles.map(([value, label]) => (
          <button type="button" key={value} aria-pressed={design.cornerStyle === value} onClick={() => update('cornerStyle', value)}>
            <span className={'social-corner-preview social-corner-preview-' + value} aria-hidden="true"/>
            <span>{label}</span>
          </button>
        ))}
      </div>
    </fieldset>
    <NumberSettings fields={[
      ['opacity', 'Opacidad del fondo · %', 0, 100],
      ['borderOpacity', 'Opacidad del borde · %', 0, 100],
      ['borderWidth', 'Grosor del borde · px', 0, 8],
      ...(design.cornerStyle === 'custom' ? [] : [['radius', 'Radio de las esquinas · px', 0, 80]]),
      ['width', 'Ancho · px', 240, 900],
    ]} settings={design} update={update}/>
    {design.cornerStyle === 'custom' && <CornerSettings prefix="radius" max={80} design={design} update={update}/>}
    <div className="social-fields">
      <DesignSelect name="borderStyle" label="Tipo de borde" options={socialBorderStyles} design={design} update={update}/>
      <DesignSelect name="borderEffect" label="Efecto del borde" options={socialBorderEffects} design={design} update={update}/>
    </div>
    <Toggle name="textShadow" label="Sombra de texto" settings={design} update={update}/>
    <Field label="Color de la sombra">{id => <Input id={id} type="color" value={design.shadowColor}
      onChange={event => update('shadowColor', event.target.value)}/>}</Field>
  </>;
}
