import { ToggleRow } from './fields';
import { Button, Input } from './ui';
import { spotifyLabels } from './spotify-labels';
import { CssReference } from './css-reference';
import { spotifyCurrentCss } from './spotify-style';

export function SpotifyCssEditor({ config, update }) {
  const style = config.playerStyle || 'compact';
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
          autoComplete="off" onChange={event => change(event.target.value)}/>
      </label>
      <div className="spotify-editor-actions">
        <Button variant="outline" size="sm" disabled={!!css} onClick={() => change(spotifyCurrentCss(config))}>Insertar CSS actual</Button>
        <Button variant="outline" size="sm" disabled={!css} onClick={() => change('')}>Restaurar CSS de este diseño</Button>
        <span>{css.length.toLocaleString()} / 12 000</span>
      </div>
      <CssReference selectors={['.music-widget', '.music-now', '.music-art', '.music-cover', '.music-track', '.music-info', '.music-title', '.music-artist', '.music-brand', '.music-progress', '.music-progress > span', '.music-time', '.music-equalizer', '.music-waveform', '.music-terminal-header', '.music-terminal-body', '.player-caption']}
        variables={['--card-background', '--card-text', '--card-muted', '--card-border', '--card-radius', '--music-accent', '--cd-bevel', '--cd-caption', '--cd-caption-text', '--cd-display', '--cd-raised', '--motion']}>
        <p className="help">Los selectores de carátula y ventana dependen del diseño. Usa <code>!important</code> para personalizar el acento.</p>
      </CssReference>
    </section>
  </div>;
}
