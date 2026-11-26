import { useRef, useState } from 'react';
import { Film, ImagePlus, Music2, Trash2, Upload } from 'lucide-react';
import { Button } from './button';
import './file-picker.css';

export function FilePickerButton({ children, icon: Icon = Upload, ...props }) {
  return <Button variant="outline" size="sm" {...props}><Icon size={15}/>{children}</Button>;
}

export function FilePicker({ label, inputLabel = label, accept, disabled, onFile, preview, icon, title }) {
  const input = useRef(null);
  const open = () => input.current.click();
  function select(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file && !disabled) onFile(file);
  }
  return <>
    <input ref={input} type="file" hidden aria-label={inputLabel} accept={accept} disabled={disabled} onChange={select}/>
    {preview && <button className="file-preview" type="button" aria-label={inputLabel} disabled={disabled} onClick={open}>
      <img src={preview} alt="Vista previa del archivo seleccionado"/>
    </button>}
    <FilePickerButton icon={icon} title={title} disabled={disabled} onClick={open}>{label}</FilePickerButton>
  </>;
}

const mediaTypes = {
  image: { icon: ImagePlus, accept: 'image/png,image/jpeg,image/webp,image/gif,.gif,.png,.jpg,.jpeg,.webp', formats: 'PNG, JPG, WebP o GIF · hasta 20 MB' },
  video: { icon: Film, accept: 'video/mp4,video/webm,.mp4,.webm', formats: 'MP4 o WebM · hasta 30 MB' },
  audio: { icon: Music2, accept: 'audio/mpeg,audio/wav,audio/ogg,.mp3,.wav,.ogg', formats: 'MP3, WAV u OGG · hasta 5 MB' },
};

export function MediaFileField({ kind, title, src, name, disabled, busy, onFile, children, compact = false, compactPreview = false, hint, onRemove, removeLabel, className = '' }) {
  const [dragging, setDragging] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const videoPreview = useRef(null);
  const { icon: Icon, accept, formats } = mediaTypes[kind];
  const label = compact && !compactPreview ? title : src ? 'Cambiar archivo' : 'Elegir archivo';
  const toggleVideo = () => {
    const player = videoPreview.current;
    if (!player) return;
    if (player.paused) player.play().catch(() => {});
    else player.pause();
  };
  function drop(event) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file && !disabled) onFile(file);
  }
  return <section className={`media-file-field ${className}`} data-dragging={dragging} aria-label={title}
    onDragOver={event => { event.preventDefault(); setDragging(!disabled); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
    {compactPreview && <div className="media-file-compact-heading"><Icon size={16}/><strong>{title}</strong><span>{src ? 'Cargado' : 'Opcional'}</span></div>}
    {!compact && <><div className="media-file-heading"><Icon size={18}/><strong>{title}</strong><span>{src ? 'Cargado' : 'Opcional'}</span></div>
    <p className="help">{formats}{hint && ` · ${hint}`} · Puedes arrastrar el archivo aquí.</p></>}
    {compactPreview && <div className={'media-file-preview' + (src ? ' has-media' : '')}>
      {src ? kind === 'image'
        ? <img src={src} alt={'Vista previa de ' + title}/>
        : kind === 'video'
          ? <><video ref={videoPreview} src={src} muted playsInline preload="metadata" aria-label={'Vista previa de ' + title} title="Reproducir vista previa" onClick={toggleVideo} onPlay={()=>setVideoPlaying(true)} onPause={()=>setVideoPlaying(false)} onEnded={()=>setVideoPlaying(false)}/><span className={'media-file-play' + (videoPlaying ? ' is-playing' : '')} aria-hidden="true"/></>
          : <audio src={src} controls controlsList="nodownload noplaybackrate" preload="metadata" aria-label={'Escuchar ' + title}/>
        : <div className="media-file-empty"><Icon size={20}/><span>Arrastra o elige un archivo</span></div>}
    </div>}
    <FilePicker label={busy ? 'Procesando…' : label} inputLabel={`Seleccionar ${title}`} icon={compact && !compactPreview ? Icon : undefined} title={formats}
      accept={accept} disabled={disabled} onFile={onFile} preview={!compact && kind === 'image' ? src : undefined}/>
    {name && src && <small title={name}>{name}</small>}
    {src && onRemove && <Button variant="ghost" size="sm" disabled={disabled} onClick={onRemove}><Trash2 size={14}/>{removeLabel}</Button>}
    {children}
  </section>;
}
