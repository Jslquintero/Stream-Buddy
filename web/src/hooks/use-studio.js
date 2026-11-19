import { useCallback, useEffect, useRef, useState } from 'react';

export function useStudio() {
  const [state, setState] = useState(null);
  const [notice, setNotice] = useState('');
  const [online, setOnline] = useState(false);
  const current = useRef(null);

  useEffect(() => {
    let disconnected = false;
    const stream = new EventSource('/api/events');
    stream.onmessage = event => {
      try {
        const next = JSON.parse(event.data);
        current.current = next;
        setState(next);
        setOnline(true);
        if (disconnected) setNotice('Conexión con el centro restablecida.');
        disconnected = false;
      } catch {
        setNotice('No se pudo leer el estado del servidor.');
      }
    };
    stream.onerror = () => {
      disconnected = true;
      setOnline(false);
      setNotice('Sin conexión con Live Studio. Abre Iniciar.cmd; el panel se reconectará automáticamente.');
    };
    return () => stream.close();
  }, []);

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
      return ['likes/export','likes/save','layout/save','notifications/upload','notifications/save','notifications/fonts/install'].includes(action)?result:true;
    } catch (error) {
      setNotice(error.message);
      if(options.throwOnError)throw error;
      return false;
    }
  }, []);

  return { state, notice, setNotice, online, api };
}
