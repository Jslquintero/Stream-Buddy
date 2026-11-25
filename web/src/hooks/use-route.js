import { useCallback, useEffect, useState } from 'react';
import { routes, viewForPath } from '../../../shared/routes';

export function useRoute() {
  const [view, setView] = useState(() => viewForPath(window.location.pathname));
  useEffect(() => {
    const restore = () => setView(viewForPath(window.location.pathname));
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  const navigate = useCallback((id, { replace = false } = {}) => {
    const target=routes[id]||(/^layout:[a-zA-Z0-9-]{1,80}$/.test(id)?'/layout/'+id.slice(7):null);
    if (!target) return;
    if (window.location.pathname !== target) {
      if (replace) window.history.replaceState(null, '', target);
      else window.history.pushState(null, '', target);
    }
    setView(id);
  }, []);
  return [view, navigate];
}
