import { Toggle } from './fields';
import { Select } from './ui';
import { animationStyles } from '../../../shared/spotify';
import { spotifyLabels } from './spotify-labels';

const durations = [1, 3, 5, 10, 15, 30, 60];

function DurationField({ label, value, allowZero = false, disabled, onChange }) {
  const options = allowZero ? [0, ...durations] : durations;
  const values = options.includes(value) ? options : [...options, value].sort((a, b) => a - b);
  return <label>{label}
    <Select value={value} disabled={disabled} onChange={event => onChange(Number(event.target.value))}>
      {values.map(seconds => <option key={seconds} value={seconds}>{seconds === 0 ? 'Inmediatamente' : seconds === 1 ? '1 segundo' : seconds + ' segundos'}</option>)}
    </Select>
  </label>;
}

export function SpotifyVisibilitySettings({ config, update }) {
  return <div className="spotify-form">
    <Toggle name="hideWhenPaused" label="Ocultar al pausar" settings={config} update={update}/>
    <DurationField label="Retraso al ocultar" allowZero disabled={!config.hideWhenPaused}
      value={config.hideDelay} onChange={value => update('hideDelay', value)}/>
    <Toggle name="songChangeOnly" label="Mostrar solo al cambiar de canción"
      description="Pausar y reanudar la misma canción mantiene el tiempo restante." settings={config} update={update}/>
    <DurationField label="Duración visible" disabled={!config.songChangeOnly}
      value={config.visibleDuration} onChange={value => update('visibleDuration', value)}/>
    <Toggle name="hideVisualizer" label="Ocultar visualizador" description="Oculta las barras animadas de la tarjeta." settings={config} update={update}/>
    <div className="spotify-form spotify-divider">
      <h3>Animaciones</h3>
      <div className="spotify-canvas-fields">
        {[['revealAnimation', 'Animación de entrada'], ['exitAnimation', 'Animación de salida']].map(([key, label]) =>
          <label key={key}>{label}
            <Select value={config[key]} onChange={event => update(key, event.target.value)}>
              {animationStyles.map(value => <option key={value} value={value}>{spotifyLabels[value]}</option>)}
            </Select>
          </label>)}
      </div>
    </div>
  </div>;
}
