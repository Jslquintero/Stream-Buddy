import { useCallback, useEffect, useRef, useState } from 'react';

export function useStudio(output) {
  const [state, setState] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [online, setOnline] = useState(false);
  const current = useRef(null);
  const timers = useRef(new Map());
  const sequence = useRef(0);

  const dismissToast = useCallback(id => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setToasts(list => list.filter(toast => toast.id !== id));
  }, []);

  const notice = useCallback((message, options = {}) => {
    if (message === null || message === undefined || message === '') return;
    const type = options.type || 'success';
    const item = {
      id: ++sequence.current,
      type,
      message: String(message),
      key: options.key || null,
    };
    setToasts(list => {
      if (list.some(toast => toast.type === item.type && toast.message === item.message)) return list;
      const next = item.key ? list.filter(toast => toast.key !== item.key) : list;
      return [...next, item].slice(-5);
    });
    const sticky = options.sticky ?? type === 'error';
    if (!sticky) {
      const timer = setTimeout(() => {
        timers.current.delete(item.id);
        setToasts(list => list.filter(toast => toast.id !== item.id));
      }, options.duration ?? (type === 'success' ? 3600 : 5000));
      timers.current.set(item.id, timer);
    }
  }, []);

  useEffect(() => () => {
    timers.current.forEach(timer => clearTimeout(timer));
    timers.current.clear();
  }, []);

  useEffect(() => {
    let disconnected = false;
    let rotating = false;
    const stream = new EventSource(output ? `/api/events?output=${output}` : '/api/events');
    if (output) stream.addEventListener?.('rotate', () => { rotating = true; });
    stream.onmessage = event => {
      try {
        const next = JSON.parse(event.data);
        current.current = next;
        setState(next);
        setOnline(true);
        if (disconnected) notice('Conexión con el centro restablecida.', { type: 'success', key: 'connection' });
        disconnected = false;
      } catch {
        notice('No se pudo leer el estado del servidor.', { type: 'error' });
      }
    };
    stream.onerror = () => {
      if (rotating) {
        rotating = false;
        return;
      }
      disconnected = true;
      setOnline(false);
      notice('Sin conexión con Stream Buddy. Abre Iniciar.cmd; el panel se reconectará automáticamente.', { type: 'error', key: 'connection', sticky: true });
    };
    return () => stream.close();
  }, [output, notice]);

  const api = useCallback(async (action, body = {}, options = {}) => {
    try {
      if (!current.current) throw new Error('Espera a que el centro termine de conectar.');
      const response = await fetch('/api/' + action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Studio': current.current.token },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo completar la acción.');
      return ['spotify/connect','likes/export','likes/save','gifters/export','gifters/save','auction/export','auction/save','social/save','social/upload','banners/save','banners/upload','layout/create','layout/save-composition','layout/rename','layout/save','notifications/upload','notifications/save','notifications/fonts/install'].includes(action)?result:true;
    } catch (error) {
      notice(error.message, { type: 'error' });
      if(options.throwOnError)throw error;
      return false;
    }
  }, [notice]);

  return { state, notice, toasts, dismissToast, online, api };
}
