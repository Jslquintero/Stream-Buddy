import { useEffect, useRef, useState } from 'react';
import { Button, Card } from './ui';

export function PiperSetup({ resources, speaking, api }) {
  const dialog = useRef(null);
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState('language');
  const [language, setLanguage] = useState('es');
  const [submitting, setSubmitting] = useState(false);
  const catalog = resources.catalog || [];
  const languages = [...new Set(catalog.map(voice => voice.language.split(/[_-]/)[0]))].sort();
  const names = new Intl.DisplayNames(['es'], { type: 'language' });
  const selected = catalog.filter(voice => scope === 'all' || voice.language.split(/[_-]/)[0] === language);
  const size = selected.reduce((total, voice) => total + voice.size, 0);
  const loading = resources.task?.running;
  useEffect(() => {
    if (open) dialog.current.showModal();
    else if (dialog.current.open) dialog.current.close();
  }, [open]);
  useEffect(() => {
    if (languages.length && !languages.includes(language)) setLanguage(languages[0]);
  }, [catalog, language]);
  const show = () => {
    setOpen(true);
    if (!catalog.length) void api('tts/catalog');
  };
  return <>
    <Card className="piper-setup"><div><h3>Prepara Piper a tu medida</h3><p className="muted">Elige los idiomas que quieres instalar. Configuramos el motor y una voz inicial automáticamente.</p></div><Button disabled={loading || speaking} onClick={show}>{loading ? 'Preparando recursos…' : 'Preparar Piper'}</Button></Card>
    <dialog ref={dialog} className="piper-dialog" aria-labelledby="piper-dialog-title" onCancel={e => { e.preventDefault(); if (!submitting) setOpen(false); }} onClose={() => setOpen(false)}>
      <form onSubmit={async e => {
        e.preventDefault();
        if (loading || submitting || speaking || !selected.length) return;
        setSubmitting(true);
        try { if (await api('tts/install-piper', { language: scope === 'all' ? 'all' : language })) setOpen(false); }
        finally { setSubmitting(false); }
      }}>
        <h2 id="piper-dialog-title">Preparar Piper</h2>
        <p className="muted">Instalaremos el motor y las voces elegidas dentro del módulo TTS. Los archivos ya verificados se reutilizan.</p>
        <fieldset disabled={submitting}>
          <legend>¿Qué voces quieres instalar?</legend>
          <label className="piper-choice"><input type="radio" name="piper-scope" value="language" checked={scope === 'language'} onChange={() => setScope('language')}/> Un idioma específico</label>
          <label className="piper-choice"><input type="radio" name="piper-scope" value="all" checked={scope === 'all'} onChange={() => setScope('all')}/> Todos los idiomas</label>
          {scope === 'language' && <label className="field">Idioma<select className="input" value={language} disabled={!languages.length} onChange={e => setLanguage(e.target.value)}>{!languages.length && <option value="es">Cargando idiomas…</option>}{languages.map(code => <option key={code} value={code}>{names.of(code)}</option>)}</select><span className="help">Incluye las voces y variantes regionales de este idioma.</span></label>}
        </fieldset>
        <p className="help" role="status">{loading ? 'Consultando recursos…' : selected.length ? `${selected.length} voces · Aproximadamente ${size >= 1024 ? (size / 1024).toFixed(1) + ' GB' : size + ' MB'} de voces.` : 'No hay voces disponibles.'}</p>
        {resources.error && <p className="error" role="alert">{resources.error}</p>}
        {!catalog.length && !loading && <Button variant="outline" onClick={() => api('tts/catalog')}>Reintentar catálogo</Button>}
        <div className="actions"><Button variant="outline" disabled={submitting} onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={loading || submitting || speaking || !selected.length}>{submitting ? 'Iniciando…' : 'Instalar selección'}</Button></div>
      </form>
    </dialog>
  </>;
}
