import { appearanceDefaults } from '../../../shared/spotify';

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
export function SpotifyCssEditor({ draft, setDraft }) {
  const style = draft.playerStyle || 'compact', css = draft.customCss?.[style] || '';
  const change = value => setDraft(d => ({...d, customCss:{...d.customCss, [style]:value}}));
  return <section className="spotify-css-editor">
    <div className="spotify-editor-heading"><div><span className="spotify-editor-eyebrow">TU DISEÑO, TUS REGLAS</span><h3>CSS personalizado</h3></div><span className="spotify-editor-skin">{style}</span></div>
    <p className="help">Edita la tarjeta en vivo. Cada diseño conserva su propio CSS. Los cambios se guardan automáticamente y se aplican al directo al dejar de escribir.</p>
    <label className="spotify-toggle">Aplicar CSS personalizado<input type="checkbox" role="switch" checked={draft.cssEnabled !== false} onChange={e => setDraft(d => ({...d, cssEnabled:e.target.checked}))}/></label>
    <label className="spotify-code-label">Estilos de {style}<textarea aria-label="CSS personalizado" value={css} maxLength={12000} spellCheck={false} autoCapitalize="off" autoComplete="off" placeholder={starter} onChange={e => change(e.target.value)}/></label>
    <div className="spotify-editor-actions"><button type="button" disabled={!!css} onClick={() => change(starter)}>Insertar ejemplo</button><button type="button" disabled={!css} onClick={() => change('')}>Restaurar CSS de este diseño</button><span>{css.length.toLocaleString()} / 12 000</span></div>
    <details><summary>Selectores y variables disponibles</summary><p>Usa <code>.spotify-now</code> para la tarjeta, <code>.spotify-art</code> para el contenedor de carátula, <code>.spotify-cover</code> para la imagen o video, <code>.spotify-title</code>, <code>.spotify-artist</code>, <code>.spotify-brand</code>, <code>.spotify-progress</code> y <code>.spotify-time</code>.</p><p>Variables: <code>--card-background</code>, <code>--card-text</code>, <code>--card-muted</code>, <code>--card-border</code>, <code>--card-radius</code>. Para cambiar el acento, usa <code>.spotify-now {'{ --spotify-accent: #b28aff !important; }'}</code>.</p><p>Se admiten animaciones CSS. Los estilos quedan aislados del panel. Si cambias el tamaño de la tarjeta, ajusta también el lienzo de salida.</p></details>
    <div className="spotify-canvas-fields">{[['outputWidth','Ancho del lienzo'],['outputHeight','Alto del lienzo']].map(([key,label]) => <label key={key}>{label}<input className="input" type="number" min="0" max="2560" step="1" value={draft[key] ?? appearanceDefaults[key]} onChange={e => setDraft(d => ({...d,[key]:Number(e.target.value)}))}/></label>)}</div><p className="help">0 = automático · medidas en píxeles · los cambios de lienzo se aplican a todos los diseños.</p>
  </section>;
}
