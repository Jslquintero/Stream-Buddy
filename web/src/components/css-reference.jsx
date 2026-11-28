import { cssDeclarations } from '../../../shared/css-declarations';
import { Field, ToggleRow } from './fields';
import { Button, Textarea } from './ui';

export function CssReference({ selectors, variables, children, className = '' }) {
  return <details className={`css-reference ${className}`}>
    <summary>Selectores y variables disponibles</summary>
    <p className="help">Selectores {selectors.map(selector => <code key={selector}>{selector} </code>)}</p>
    <p className="help">Variables {variables.map(variable => <code key={variable}>{variable} </code>)}</p>
    {children}
  </details>;
}
export function WidgetCssEditor({
  css, change, enabled, onEnabledChange, selector, selectors, properties, extraVariables = [], dynamicVariables = [], maxLength = 20000, className,
}) {
  const insert = () => {
    const settings = Object.fromEntries(Object.entries(properties).filter(([name]) => !dynamicVariables.includes(name)));
    change(cssDeclarations(selector, settings, ' !important'));
  };
  return <>
    <ToggleRow label="Aplicar CSS personalizado" checked={enabled !== false} onCheckedChange={onEnabledChange}
      description="Controla el CSS en la vista previa y en la salida."/>
    <Field label="CSS personalizado">{id => <Textarea id={id} className={className} rows={6} spellCheck={false}
      maxLength={maxLength} value={css || ''} onChange={event => change(event.target.value)}/>}</Field>
    <div className="actions">
      <Button variant="outline" size="sm" disabled={Boolean(css)} onClick={insert}>Insertar CSS actual</Button>
      <Button variant="outline" size="sm" disabled={!css} onClick={() => change('')}>Restablecer CSS</Button>
    </div>
    <CssReference selectors={[selector, ...selectors]} variables={[...Object.keys(properties), ...extraVariables]}>
      <p className="help">Usa <code>!important</code> para cambiar las variables que asigna el panel.</p>
    </CssReference>
  </>;
}
