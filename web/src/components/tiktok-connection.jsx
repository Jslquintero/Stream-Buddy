import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Radio, X } from 'lucide-react';
import { Badge, Button, Input } from './ui';
import { Field } from './fields';

export function TikTokConnection({ state, online, api }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const root = useRef(null), trigger = useRef(null), input = useRef(null);
  const t = state?.tts;
  useEffect(() => { setUsername(state?.settings.Username || ''); }, [state?.settings.Username]);
  useEffect(() => {
    const openPanel = () => {
      setOpen(true);
      window.setTimeout(() => input.current?.focus(), 0);
    };
    window.addEventListener('live-studio:connect', openPanel);
    return () => window.removeEventListener('live-studio:connect', openPanel);
  }, []);
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const outside = e => { if (!root.current?.contains(e.target)) setOpen(false); };
    const escape = e => { if (e.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  const live = online && t?.connected;
  const status = !online ? 'Sin conexión con el servidor' : t?.connected ? 'Conectado' : t?.connecting ? 'Conectando…' : t?.installing ? 'Instalando…' : 'Sin conectar';
  const run = async action => { setBusy(true); try { await action(); } finally { setBusy(false); } };
  const locked = !online || busy || t?.installing;
  const needsPreparation = t && (!t.connector || t.lastError?.startsWith('El entorno Python del conector'));
  return <div className="tiktok-connection" ref={root}>
    <Button ref={trigger} variant="outline" className="tiktok-trigger" aria-expanded={open} aria-controls="tiktok-panel" onClick={() => setOpen(!open)}><Radio size={17} className={live ? "tiktok-live-icon" : online && t?.connecting ? "tiktok-connecting-icon" : "tiktok-offline-icon"}/><span>{state?.settings.Username ? '@' + state.settings.Username.replace(/^@/, '') : 'Conectar TikTok'}</span><Badge className={live ? 'success' : ''}>{status}</Badge><ChevronDown size={14} aria-hidden="true"/></Button>
    {open && <section id="tiktok-panel" className="tiktok-panel" aria-label="Conexión de TikTok LIVE">
      <div className="section-heading"><h2>TikTok LIVE</h2><Button variant="ghost" size="icon" aria-label="Cerrar conexión" onClick={() => { setOpen(false); trigger.current?.focus(); }}><X size={18}/></Button></div>
      <p className="muted">Conecta tu comunidad a todo el estudio. Tu LIVE debe estar activo y público; no necesitas contraseña.</p>
      <form onSubmit={e => { e.preventDefault(); if (locked || needsPreparation || !t?.connector || t.connected || t.connecting || !username.trim()) return; void run(async () => { if (await api('settings', { ...state.settings, Username: username.trim().replace(/^@/, '') })) await api('connect'); }); }}>
        <Field label="Usuario de TikTok">{id => <Input ref={input} id={id} value={username} onChange={e => setUsername(e.target.value)} placeholder="Usuario sin @" autoComplete="off" required disabled={locked || t?.connected || t?.connecting}/>}</Field>
        <p className="inline-note" role="status"><span className={live ? 'online-dot' : 'offline-dot'}/>{online ? status : 'Esperando al servidor…'}</p>
        <div className="actions">
          {needsPreparation
            ? <Button disabled={locked || t.connected || t.connecting} onClick={() => run(() => api('install'))}>{busy || t.installing ? 'Preparando…' : 'Preparar TikTok'}</Button>
            : <Button type="submit" disabled={locked || !t?.connector || t?.connected || t?.connecting || !username.trim()}>{busy ? 'Procesando…' : 'Conectar'}</Button>}
          <Button variant="outline" disabled={locked || (!t?.connected && !t?.connecting)} onClick={() => run(() => api('disconnect'))}>Desconectar</Button>
        </div>
        {needsPreparation && <p className="help">La preparación inicial requiere Python e Internet.</p>}
      </form>
      {t?.lastError && <p className="error" role="alert">{t.lastError}</p>}
    </section>}
  </div>;
}
