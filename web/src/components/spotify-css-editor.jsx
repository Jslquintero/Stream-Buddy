import { ToggleRow } from './fields';
import { Button, Input } from './ui';
import { spotifyLabels } from './spotify-labels';

const starter = `/* Este CSS se aplica únicamente a este diseño. */
.spotify-now {
  --card-radius: 24px;
  --card-background: linear-gradient(135deg, #202635, #101219);
  --card-border: rgba(255, 255, 255, .14);
  --card-text: #f7f8fc;
  --card-muted: #a8b1c5;
}

.spotify-title { font-size: 24px; }
.spotify-art { border-radius: 14px; }
.spotify-progress { height: 4px; }
`;
export function SpotifyCssEditor({ config, update }) {
  const style = config.playerStyle;
  const css = config.customCss?.[style] || '';
  const change = value => update('customCss', { ...config.customCss, [style]: value });
  return <div className="spotify-form">
    <h3>Tamaño del lienzo</h3>
    <div className="spotify-canvas-fields">{[['outputWidth', 'Ancho (px)'], ['outputHeight', 'Alto (px)']].map(([key, label]) =>
      <label key={key}>{label}
        <Input type="number" min="0" max="2560" step="1" value={config[key]} onChange={event => update(key, Number(event.target.value))}/>
      </label>)}
    </div>
    <p className="help">Usa 0 para el tamaño automático del formato. El tamaño personalizado se aplica a todos los formatos.</p>
    <section className="spotify-form spotify-divider">
      <h3>CSS personalizado</h3>
      <ToggleRow label="Aplicar CSS personalizado" checked={config.cssEnabled} onCheckedChange={value => update('cssEnabled', value)}/>
      <label className="spotify-code-label">Estilos de {spotifyLabels[style]}
        <textarea aria-label="CSS personalizado" value={css} maxLength={12000} spellCheck={false} autoCapitalize="off"
          autoComplete="off" placeholder={starter} onChange={event => change(event.target.value)}/>
      </label>
      <div className="spotify-editor-actions">
        <Button variant="outline" size="sm" disabled={!!css} onClick={() => change(starter)}>Insertar ejemplo</Button>
        <Button variant="outline" size="sm" disabled={!css} onClick={() => change('')}>Restaurar CSS de este diseño</Button>
        <span>{css.length.toLocaleString()} / 12 000</span>
      </div>
      <details>
        <summary>Selectores y variables disponibles</summary>
        <p>Usa <code>.spotify-now</code> para la tarjeta, <code>.spotify-art</code> para el contenedor de carátula, <code>.spotify-cover</code> para la imagen o video, <code>.spotify-title</code>, <code>.spotify-artist</code>, <code>.spotify-brand</code>, <code>.spotify-progress</code> y <code>.spotify-time</code>.</p>
        <p>Puedes usar las variables <code>--card-background</code>, <code>--card-text</code>, <code>--card-muted</code>, <code>--card-border</code> y <code>--card-radius</code>. Para cambiar el acento, usa <code>.spotify-now {'{ --spotify-accent: #b28aff !important; }'}</code>.</p>
        <p>Se admiten animaciones CSS. Los estilos quedan aislados del panel. Si cambias el tamaño de la tarjeta, ajusta también el lienzo de salida.</p>
      </details>
    </section>
  </div>;
}
