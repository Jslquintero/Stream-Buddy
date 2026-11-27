import { useEffect, useId, useState } from 'react';
import { Button, Input } from './ui';
import { Field } from './fields';
import { googleFontId, googleFontStack } from '../../../shared/google-fonts';
export const systemFonts=[['sans','Sans serif'],['serif','Serif'],['mono','Monoespaciada'],['arial','Arial'],['georgia','Georgia'],['verdana','Verdana'],['trebuchet','Trebuchet MS'],['impact','Impact'],['courier','Courier New']];
export function googleFontOptions(fonts, selected) {
  const options = (fonts?.items ?? []).map(font => ['google:' + font.id, font.name + ' · instalada']);
  if (googleFontId(selected) && !options.some(([value]) => value === selected)) {
    options.push([selected, 'Fuente de Google seleccionada']);
  }
  return options;
}
export function notificationFontStack(value){
  return googleFontStack(value) || {sans:'Arial, sans-serif',serif:'Georgia, serif',mono:'Consolas, monospace',arial:'Arial, sans-serif',georgia:'Georgia, serif',verdana:'Verdana, sans-serif',trebuchet:'"Trebuchet MS", sans-serif',impact:'Impact, sans-serif',courier:'"Courier New", monospace'}[value]||'Arial, sans-serif';
}
export function NotificationFontResource({ family }) {
  useEffect(() => {
    const fontId = googleFontId(family);
    if (!fontId) return;
    const id = 'notification-font-' + fontId;
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = '/notification-fonts/' + fontId + '.css';
    document.head.append(link);
  }, [family]);
  return null;
}

const googleFontSuggestions = ['Roboto', 'Montserrat', 'Poppins', 'Oswald', 'Lato', 'Nunito', 'Bebas Neue', 'Playfair Display', 'Pacifico'];

export function NotificationFonts({ fonts, api, select, online }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const suggestionsId = useId();
  const installing = busy || fonts?.installing;

  async function installFont() {
    setBusy(true);
    setError('');
    try {
      const result = await api('notifications/fonts/install', { name: name.trim() }, { throwOnError: true });
      if (result?.id) {
        select('google:' + result.id);
        setName('');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="notification-font-installer">
    <h4>Instalar desde Google Fonts</h4>
    <p className="help">Se descarga al estudio y queda disponible sin Internet.</p>
    <Field label="Nombre de la familia">{id => <Input id={id} value={name} onChange={event => setName(event.target.value)}
      placeholder="Por ejemplo, Montserrat" list={suggestionsId}/>}</Field>
    <datalist id={suggestionsId}>{googleFontSuggestions.map(font => <option key={font} value={font}/>)}</datalist>
    <Button variant="outline" disabled={!online || installing || !name.trim()} onClick={installFont}>
      {installing ? 'Instalando fuente…' : 'Instalar y seleccionar'}
    </Button>
    {error && <p className="error" role="alert">{error}</p>}
  </div>;
}
