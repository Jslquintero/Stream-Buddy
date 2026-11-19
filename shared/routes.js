export const routes = { home: '/', tts: '/tts', layout: '/layout', ads: '/ads', notifications: '/notifications', likes:'/likes' };
export function viewForPath(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  return Object.keys(routes).find(view => routes[view] === path) ?? null;
}
