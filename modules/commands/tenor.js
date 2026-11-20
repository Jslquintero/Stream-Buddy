export function isTenorPage(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && ['tenor.com', 'www.tenor.com'].includes(url.hostname) && !url.username && !url.password && !url.port && /^\/view\/[^/]+-\d+\/?$/.test(url.pathname);
  } catch { return false; }
}

export async function resolveTenorImage(value, fetcher = fetch) {
  if (!isTenorPage(value)) return value;
  const url = new URL(value); url.protocol = 'https:'; url.search = ''; url.hash = '';
  const response = await fetcher(url.href, { redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Tenor no respondió. Descarga el GIF y súbelo como archivo.');
  const chunks = []; let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > 3000000) throw new Error('La página de Tenor es demasiado grande');
    chunks.push(Buffer.from(chunk));
  }
  const html = Buffer.concat(chunks).toString('utf8');
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const key of ['contentUrl', 'og:image']) {
    for (const tag of tags) {
      if (!new RegExp('(?:itemprop|property)=["\']' + key + '["\']', 'i').test(tag)) continue;
      const src = /\bcontent=["']([^"']+)["']/i.exec(tag)?.[1];
      if (!src) continue;
      try {
        const image = new URL(src.replaceAll('&amp;', '&'));
        if (image.protocol === 'https:' && /^media\d*\.tenor\.com$/.test(image.hostname) && !image.port && !image.username && !image.password && image.pathname.endsWith('.gif')) return image.href;
      } catch {}
    }
  }
  throw new Error('No se encontró el GIF en Tenor. Descárgalo y súbelo como archivo.');
}

export async function resolveCommandImages(config, fetcher = fetch) {
  const cache = new Map();
  const commands = [];
  for (const row of config.commands) {
    if (!cache.has(row.image)) cache.set(row.image, await resolveTenorImage(row.image, fetcher));
    commands.push({ ...row, image: cache.get(row.image) });
  }
  return { ...config, commands };
}
