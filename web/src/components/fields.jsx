import { Input, Switch, Textarea, Select } from './ui';
import { useId } from 'react';
export function Field({ label, hint, children }) { const id = useId(); return <div className="field"><label htmlFor={id}>{label}</label>{typeof children === 'function' ? children(id) : children}{hint && <p className="help">{hint}</p>}</div>; }
export function Setting({ name, label, settings, update, options, multiline, ...props }) {
 return <Field label={label}>{id => options ? <Select id={id} value={settings[name]} onChange={e => update(name, name === 'Speaker' ? Number(e.target.value) : e.target.value)} {...props}>{options.map(o => <option key={o.id ?? o.path} value={o.id ?? o.path}>{o.name}</option>)}</Select> : multiline ? <Textarea id={id} value={Array.isArray(settings[name]) ? settings[name].join('\n') : settings[name]} onChange={e => update(name, e.target.value.split('\n'))} rows={4} {...props} /> : <Input id={id} value={settings[name]} onChange={e => update(name, props.type === 'number' ? Number(e.target.value) : e.target.value)} {...props} />}</Field>;
}
export function ToggleRow({ label, description, checked, disabled, onCheckedChange }) {
  const id = useId();
  return <div className="toggle-row">
    <div><label htmlFor={id}>{label}</label>{description && <p className="help">{description}</p>}</div>
    <Switch id={id} checked={Boolean(checked)} disabled={disabled} onCheckedChange={onCheckedChange}/>
  </div>;
}
export function Toggle({ name, settings, update, ...props }) {
  return <ToggleRow {...props} checked={settings[name]} onCheckedChange={value => update(name, value)}/>;
}

export function OverlayColors({ settings, update }) {
  const colors = [['background', 'Fondo'], ['color', 'Texto'], ['accent', 'Acento']];
  return <div className="form-row">{colors.map(([key, label]) =>
    <Field key={key} label={label}>{id =>
      <Input id={id} type="color" value={settings[key]} onChange={event => update(key, event.target.value)}/>
    }</Field>
  )}</div>;
}

export function NumberSettings({ fields, settings, update, required }) {
  return <div className="form-row">{fields.map(([key, label, min, max]) =>
    <Field key={key} label={label}>{id =>
      <Input id={id} type="number" min={min} max={max} required={required} value={settings[key]}
        onChange={({ target }) => update(key, target.value === '' ? '' : Number(target.value))}/>
    }</Field>
  )}</div>;
}
