import { createContext, useEffect } from 'react';

export const StudioProfileContext = createContext('default');
export const beforeProfileChange = 'studio:before-profile-change';

export function useProfileChangeGuard(pending) {
  useEffect(() => {
    if (!pending) return;
    const keepProfile = event => event.preventDefault();
    window.addEventListener(beforeProfileChange, keepProfile);
    return () => window.removeEventListener(beforeProfileChange, keepProfile);
  }, [pending]);
}
