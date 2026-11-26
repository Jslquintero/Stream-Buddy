import { useCallback, useEffect, useRef, useState } from 'react';

const HISTORY_LIMIT = 80;
const COALESCE_MS = 600;

/*
 * Historial local del documento. Los cambios con la misma clave y muy seguidos
 * se agrupan para que escribir un título no requiera pulsar Ctrl+Z por letra.
 */
export function useLayoutHistory(value, apply) {
  const current = useRef(value);
  const past = useRef([]);
  const future = useRef([]);
  const last = useRef({ key: '', time: 0 });
  const [state, setState] = useState({ canUndo: false, canRedo: false });

  useEffect(() => {
    current.current = value;
  }, [value]);

  const refresh = useCallback(() => {
    setState(previous => {
      const next = { canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
      return previous.canUndo === next.canUndo && previous.canRedo === next.canRedo ? previous : next;
    });
  }, []);

  const commit = useCallback((updater, key = '') => {
    const before = current.current;
    if (!before) return;
    const next = typeof updater === 'function' ? updater(before) : updater;
    if (!next || next === before) return;
    const now = Date.now();
    const coalesce = Boolean(key) && last.current.key === key && now - last.current.time < COALESCE_MS;
    if (!coalesce) {
      past.current.push(before);
      if (past.current.length > HISTORY_LIMIT) past.current.shift();
    }
    future.current = [];
    last.current = { key, time: now };
    current.current = next;
    apply(next);
    refresh();
  }, [apply, refresh]);

  const undo = useCallback(() => {
    const previous = past.current.pop();
    if (!previous) return false;
    if (current.current) future.current.push(current.current);
    current.current = previous;
    last.current = { key: '', time: 0 };
    apply(previous);
    refresh();
    return true;
  }, [apply, refresh]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return false;
    if (current.current) past.current.push(current.current);
    current.current = next;
    last.current = { key: '', time: 0 };
    apply(next);
    refresh();
    return true;
  }, [apply, refresh]);

  return { commit, undo, redo, canUndo: state.canUndo, canRedo: state.canRedo };
}
