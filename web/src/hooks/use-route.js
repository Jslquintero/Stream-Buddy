import { useEffect, useState } from 'react';
import { routes, viewForPath } from '../../../shared/routes';

export function useRoute() {
  const [view, setView] = useState(() => viewForPath(window.location.pathname));
  useEffect(() => {
    const restore = () => setView(viewForPath(window.location.pathname));
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  const navigate = id => {
    if (!routes[id]) return;
    if (window.location.pathname !== routes[id]) window.history.pushState(null, '', routes[id]);
    setView(id);
  };
  return [view, navigate];
}
