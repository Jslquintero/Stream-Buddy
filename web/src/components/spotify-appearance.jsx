import { Toggle } from './fields';
import { FilePicker } from './ui/file-picker';
import { Select, Input, Button } from './ui';
import { playerStyles, coverFinishes, coverStyles } from '../../../shared/spotify';
import { spotifyLabels } from './spotify-labels';

const themeGroups = {
  Básicos: { dark: 'Oscuro', light: 'Claro', tinted: 'Color sólido', gradient: 'Degradado de color', transparent: 'Transparente' },
  Naturaleza: { lagoon: 'Laguna', plum: 'Ciruela' },
  Retro: { orbital: 'Orbital', 'cd-retro': spotifyLabels['cd-retro'], ...coverFinishes },
};
const swatches = ['#267493', '#21857e', '#777b25', '#a4832b', '#b56829', '#aa4830', '#a93645', '#a25476', '#7944a1'];

function StyleChoices({ title, field, values, config, update }) {
  return <fieldset className="spotify-choices">
    <legend>{title}</legend>
    <div>{values.map(value => <button type="button" key={value} aria-pressed={config[field] === value} onClick={() => update(field, value)}>
      {field === 'coverStyle' && coverFinishes[value]
        ? <span className={'cover-sample cover-' + value} aria-hidden="true"><span className="music-art"><i className="music-cover"/></span></span>
        : <span className={'spotify-mini mini-' + value} aria-hidden="true"><i/><b/><em/></span>}
      <span>{spotifyLabels[value]}</span>
    </button>)}</div>
  </fieldset>;
}

export function SpotifyDesignSettings({ config, update }) {
  return <div className="spotify-form">
    <StyleChoices title="Formato del reproductor" field="playerStyle" values={playerStyles} config={config} update={update}/>
    <div className="spotify-form spotify-divider">
      <h3>Colores</h3>
      <label>Tema
        <Select value={config.theme || 'dark'} onChange={event => update('theme', event.target.value)}>
          {Object.entries(themeGroups).map(([group, themes]) => <optgroup key={group} label={group}>
            {Object.entries(themes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </optgroup>)}
        </Select>
      </label>
      <Toggle name="magicColors" label="Colores de la carátula" description="Adapta el color a cada canción." settings={config} update={update}/>
      <div className="spotify-palette">
        <label>Color de acento<Input type="color" value={config.tintColor} onChange={event => update('tintColor', event.target.value)}/></label>
        <div className="spotify-swatches" role="group" aria-label="Colores predefinidos">
          {swatches.map(color => <button type="button" key={color} aria-label={'Color ' + color} aria-pressed={config.tintColor === color}
            style={{ background: color }} onClick={() => update('tintColor', color)}/>)}
        </div>
        <p className="help">Los temas Color sólido y Degradado de color también usan este color en el fondo.</p>
      </div>
    </div>
  </div>;
}

export function SpotifyCoverSettings({ config, update, notice }) {
  async function upload(file) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 500000) {
      notice('Elige un PNG, JPG o WebP de hasta 500 KB.', { type: 'warning' });
      return;
    }
    try {
      const image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      update('idleCover', image);
    } catch {
      notice('No se pudo leer la imagen.', { type: 'error' });
    }
  }

  return <div className="spotify-form">
    <StyleChoices title="Estilo de carátula" field="coverStyle" values={coverStyles} config={config} update={update}/>
    {config.coverStyle === 'canvas' && <label>URL del video
      <Input type="url" placeholder="https://…" value={config.canvasUrl} onChange={event => update('canvasUrl', event.target.value)}/>
      <small className="help">Usa un MP4 o WebM en bucle. Si el video falla, se muestra la carátula.</small>
    </label>}
    <div className="spotify-form spotify-divider">
      <h3>Efectos de carátula</h3>
      <Toggle name="coverGlow" label="Brillo alrededor de la carátula" settings={config} update={update}/>
      <Toggle name="coverBlur" label="Carátula desenfocada como fondo" settings={config} update={update}/>
    </div>
    <div className="spotify-form spotify-divider">
      <FilePicker label="Imagen cuando no hay música" accept="image/png,image/jpeg,image/webp" onFile={upload}/>
      <p className="help">PNG, JPG o WebP de hasta 500 KB. Se muestra con la fuente conectada y sin una canción activa.</p>
      {config.idleCover && <div className="spotify-idle-upload">
        <img src={config.idleCover} alt="Carátula en reposo"/>
        <Button variant="ghost" size="sm" onClick={() => update('idleCover', '')}>Quitar imagen</Button>
      </div>}
    </div>
  </div>;
}
