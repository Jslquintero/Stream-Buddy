const key = 'live-studio.onboarding.v1';

export const emptyOnboarding = { dismissed: false, copied: false, added: false, completed: false };

export function readOnboarding() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(key) || '{}');
    return {
      dismissed: saved.dismissed === true,
      copied: saved.copied === true,
      added: saved.added === true,
      completed: saved.completed === true,
    };
  } catch {
    return { ...emptyOnboarding };
  }
}

export function writeOnboarding(value) {
  try {
    window.localStorage.setItem(key, JSON.stringify({ ...emptyOnboarding, ...value }));
  } catch {
    // El panel sigue funcionando aunque el navegador no permita guardar preferencias.
  }
}
