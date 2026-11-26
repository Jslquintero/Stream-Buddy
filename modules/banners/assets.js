import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const mime = {
  png: 'image/png',
  gif: 'image/gif',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};
const maxRasterBytes = 10 * 1024 * 1024;
const maxSvgBytes = 3 * 1024 * 1024;
const maxDataLength = Math.ceil(maxRasterBytes / 3) * 4 + 512;

function detectedFormat(bytes) {
  const starts = values => values.every((value, index) => bytes[index] === value);
  if (starts([137, 80, 78, 71, 13, 10, 26, 10])) return 'png';
  if (starts([71, 73, 70, 56, 55, 97]) || starts([71, 73, 70, 56, 57, 97])) return 'gif';
  if (starts([255, 216, 255])) return 'jpg';
  if (starts([82, 73, 70, 70]) && [87, 69, 66, 80].every((value, index) => bytes[index + 8] === value)) return 'webp';
  return null;
}

// Un SVG puede animarse con CSS o SMIL, pero nunca debe ejecutar código.
export function sanitizeSvg(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('El SVG está vacío');
  if (Buffer.byteLength(text, 'utf8') > maxSvgBytes) throw new Error('El SVG supera 3 MB');
  let svg = text
    .replace(/^\uFEFF/, '')
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject\s*>/gi, '')
    .replace(/<(iframe|object|embed)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(?:href|xlink:href)\s*=\s*(?:"\s*(?:javascript|data:text\/html)[^"]*"|'\s*(?:javascript|data:text\/html)[^']*')/gi, '');
  if (/<script\b|<foreignObject\b|<iframe\b|<object\b|<embed\b|javascript:/i.test(svg)) {
    throw new Error('El SVG contiene contenido no permitido');
  }
  if (!/<svg[\s>]/i.test(svg)) throw new Error('El archivo no es un SVG válido');
  if (!/<svg[^>]*\sxmlns=/i.test(svg)) svg = svg.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  // Un SVG con solo viewBox no tiene tamaño intrínseco para <img>; usamos el viewBox.
  const viewBox = /<svg[^>]*\sviewBox\s*=\s*["']\s*[-+\d.]+[\s,]+[-+\d.]+[\s,]+([-+\d.]+)[\s,]+([-+\d.]+)\s*["']/i.exec(svg);
  if (viewBox) {
    const width = Number(viewBox[1]), height = Number(viewBox[2]);
    if (width > 0 && height > 0) {
      svg = svg.replace(/<svg\b([^>]*)>/i, (tag, attributes) => {
        let extra = '';
        if (!/\swidth\s*=/i.test(attributes)) extra += ' width="' + width + '"';
        if (!/\sheight\s*=/i.test(attributes)) extra += ' height="' + height + '"';
        return '<svg' + attributes + extra + '>';
      });
    }
  }
  return svg;
}

export function bannerAssets(dataDir) {
  const directory = path.join(dataDir, 'banner-assets');
  const store = (bytes, format) => {
    const name = createHash('sha256').update(bytes).digest('hex') + '.' + format;
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, name), bytes);
    return '/banner-assets/' + name;
  };
  return {
    upload({ data } = {}) {
      if (typeof data !== 'string' || !data.length || data.length > maxDataLength) throw new Error('La imagen supera 10 MB');
      const svg = /^data:image\/svg\+xml(?:;charset=[^;,]+)?;base64,([A-Za-z0-9+/]+={0,2})$/i.exec(data);
      if (svg) {
        const bytes = Buffer.from(svg[1], 'base64');
        if (!bytes.length || bytes.length > maxSvgBytes) throw new Error('El SVG supera 3 MB');
        const sanitized = Buffer.from(sanitizeSvg(bytes.toString('utf8')), 'utf8');
        return { image: store(sanitized, 'svg') };
      }
      const match = /^data:image\/(png|gif|jpe?g|webp)(?:;charset=[^;,]+)?;base64,([A-Za-z0-9+/]+={0,2})$/i.exec(data);
      if (!match) throw new Error('Elige una imagen PNG, JPG, WebP, GIF o SVG');
      const bytes = Buffer.from(match[2], 'base64');
      if (!bytes.length || bytes.length > maxRasterBytes) throw new Error('La imagen supera 10 MB');
      const format = detectedFormat(bytes);
      const declared = match[1].toLowerCase();
      const expected = declared === 'jpeg' || declared === 'jpg' ? 'image/jpeg' : 'image/' + declared;
      if (!format || mime[format] !== expected) {
        throw new Error('El contenido no corresponde al formato de imagen');
      }
      return { image: store(bytes, format) };
    },
    read(name) {
      if (!/^[a-f0-9]{64}\.(png|gif|jpg|webp|svg)$/.test(name)) return null;
      try {
        return { bytes: fs.readFileSync(path.join(directory, name)), mime: mime[path.extname(name).slice(1)] };
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
    },
  };
}
