import { useState } from 'react';
import { Copy, Save, Trash2 } from 'lucide-react';
import { Button, Input } from './ui';
import { ToggleRow } from './fields';
import { resolveSocialDesign, socialLayouts, socialStyles } from '../../../modules/social/config';
import { socialCardCss, socialCustomCss } from '../../../modules/social/css';

const styleLabel = id => socialStyles.find(([value]) => value === id)?.[1] ?? 'Limpio';
const layoutLabel = id => socialLayouts.find(([value]) => value === id)?.[1] ?? 'Tarjeta · completa';

const starter = `/* Este CSS se aplica únicamente a este tema visual. */
.social-card {
  --social-radius: 32px;
  --social-bg: #0f1218e8;
  --social-border: #b9f678;
  --social-border-width: 2px;
}

.social-card .social-label { font-size: 1.6em; }
.social-card .social-icon { border-radius: 50%; }
.social-card .social-progress { height: 5px; }
`;

export function SocialCssEditor({ config, channel, update, notice }) {
  const [templateName, setTemplateName] = useState('');
  const design = resolveSocialDesign(config, channel);
  const style = design.style;
  const cssMap = design.customCss;
  const css = socialCustomCss(design);
  const templates = config.cssTemplates ?? [];
  const currentCss = socialCardCss(config, channel);
  const change = value => update('customCss', { ...cssMap, [style]: value });

  async function copyCss() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error();
      await navigator.clipboard.writeText(currentCss);
      notice('CSS actual de la tarjeta copiado.');
    } catch {
      notice('No se pudo copiar el CSS. Selecciónalo manualmente.', { type: 'error' });
    }
  }

  function saveTemplate() {
    const name = templateName.trim(), value = css.trim();
    if (!name || !value) return;
    const existing = templates.find(template => template.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      update('cssTemplates', templates.map(template => template.id === existing.id ? { ...template, name, css: value } : template));
      notice('Plantilla CSS «' + name + '» actualizada.');
    } else {
      if (templates.length >= 20) {
        notice('Puedes guardar hasta 20 plantillas CSS.', { type: 'warning' });
        return;
      }
      update('cssTemplates', [...templates, { id: crypto.randomUUID(), name, css: value }]);
      notice('Plantilla CSS «' + name + '» guardada.');
    }
    setTemplateName('');
  }

  function applyTemplate(template) {
    change(template.css);
    if (!design.cssEnabled) update('cssEnabled', true);
    notice('Plantilla CSS «' + template.name + '» aplicada a ' + styleLabel(style) + '.');
  }

  function removeTemplate(template) {
    update('cssTemplates', templates.filter(item => item.id !== template.id));
    notice('Plantilla CSS «' + template.name + '» eliminada.');
  }

  return <section className="social-css-editor">
    <div className="social-css-editor-heading">
      <h3>CSS personalizado</h3>
      <span className="social-css-skin">{styleLabel(style)}</span>
    </div>
    <p className="help">El CSS se guarda por tema visual. Las plantillas están disponibles en todas las redes.</p>
    <ToggleRow label="Aplicar CSS personalizado" checked={design.cssEnabled} onCheckedChange={value => update('cssEnabled', value)}/>
    <label className="social-css-code-label">Estilos de {styleLabel(style)}
      <textarea className="social-css-input" aria-label="CSS personalizado" value={css} maxLength={12000} spellCheck={false} autoCapitalize="off" autoComplete="off" placeholder={starter} onChange={event => change(event.target.value)}/>
    </label>
    <div className="social-css-editor-actions">
      <Button type="button" variant="outline" size="sm" disabled={Boolean(css)} onClick={() => change(starter)}>Insertar ejemplo</Button>
      <Button type="button" variant="outline" size="sm" disabled={!css} onClick={() => change('')}>Restaurar CSS de este tema</Button>
      <span>{css.length.toLocaleString('es')} / 12 000</span>
    </div>
    <details className="social-css-reference" open>
      <summary>CSS actual de la tarjeta <small>{styleLabel(style)} · {layoutLabel(design.layout)}</small></summary>
      <div className="social-css-reference-head">
        <p className="help">Incluye los valores del panel y tus modificaciones. La plantilla guarda solo las modificaciones de este tema.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void copyCss()}><Copy size={13}/>Copiar</Button>
      </div>
      <pre className="social-css-current" aria-label="CSS actual de la tarjeta"><code>{currentCss}</code></pre>
    </details>
    <details className="social-css-help">
      <summary>Selectores y variables disponibles</summary>
      <p>Usa <code>.social-card</code> para la tarjeta, <code>.social-icon</code> para el icono, <code>.social-copy</code> para el bloque de texto, <code>.social-heading</code>, <code>.social-label</code>, <code>.social-handle</code>, <code>.social-progress</code> y <code>.social-glow</code>.</p>
      <p>Variables: <code>--social-bg</code>, <code>--social-color</code>, <code>--social-accent</code>, <code>--social-border</code>, <code>--social-border-width</code>, <code>--social-border-style</code>, <code>--social-radius</code>, <code>--social-width</code>, <code>--social-icon-size</code>, <code>--social-channel</code>, <code>--social-channel-bg</code>, <code>--social-channel-border</code> y <code>--social-channel-glow</code>.</p>
      <p>Para el degradado del icono usa <code>.social-icon {'{ background: linear-gradient(135deg, #ff2d75, #7b5cff); }'}</code>. Para el borde RGB, activa el efecto en el panel de diseño o anima un <code>::before</code> propio.</p>
    </details>
    <section className="social-css-templates" aria-labelledby="social-css-templates-title">
      <div className="social-css-templates-head">
        <div>
          <h4 id="social-css-templates-title">Plantillas CSS</h4>
          <p className="help">Guarda el CSS de este tema y aplícalo cuando quieras.</p>
        </div>
        <span>{templates.length} / 20</span>
      </div>
      <form className="social-css-template-save" onSubmit={event => { event.preventDefault(); saveTemplate(); }}>
        <Input value={templateName} maxLength={60} placeholder="Nombre de la plantilla" aria-label="Nombre de la plantilla CSS" onChange={event => setTemplateName(event.target.value)}/>
        <Button type="submit" size="sm" variant="outline" disabled={!templateName.trim() || !css.trim()}><Save size={14}/>Guardar</Button>
      </form>
      {templates.length
        ? <ul className="social-css-template-list">{templates.map(template =>
          <li key={template.id}>
            <span className="social-css-template-copy"><strong>{template.name}</strong><small>{template.css.length.toLocaleString('es')} caracteres</small></span>
            <Button type="button" size="sm" variant="outline" onClick={() => applyTemplate(template)}>Aplicar</Button>
            <Button type="button" size="icon" variant="ghost" aria-label={'Eliminar plantilla ' + template.name} onClick={() => removeTemplate(template)}><Trash2 size={13}/></Button>
          </li>
        )}</ul>
        : <p className="social-css-template-empty">Aún no hay plantillas. Escribe CSS y guárdalo con un nombre para reutilizarlo.</p>}
    </section>
  </section>;
}
