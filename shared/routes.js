export const routes = { home: '/', tts: '/tts', layout: '/layout', ads: '/ads', notifications: '/notifications', likes:'/likes', commands:'/commands' };
export function viewForPath(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  if(/^\/layout\/[a-zA-Z0-9-]{1,80}$/.test(path))return 'layout:'+path.split('/')[2];
  return Object.keys(routes).find(view => routes[view] === path) ?? null;
}
