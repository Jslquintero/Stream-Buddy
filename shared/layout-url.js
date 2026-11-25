const outputPath = '/output/layout';
const outputSuffix = '#tiktok.studio';
export const layoutOutputPath = outputPath + outputSuffix;

export function layoutOutputId(pathname) {
  const path = pathname.replace(/\/+$/, '');
  if (path === outputPath) return null;
  return /^\/output\/layout\/([a-zA-Z0-9-]{1,80})$/.exec(path)?.[1];
}

export function layoutOutputURL(base, compositionId) {
  const path = compositionId ? outputPath + '/' + encodeURIComponent(compositionId) : outputPath;
  const url = new URL(path + outputSuffix, base);
  if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) url.hostname = '127.0.0.1';
  return url.href;
}
