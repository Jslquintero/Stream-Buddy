export const layoutOutputPath = '/?layout-output=1#tiktok.studio';

export function layoutOutputURL(base) {
  const url = new URL(layoutOutputPath, base);
  if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) url.hostname = '127.0.0.1';
  return url.href;
}
