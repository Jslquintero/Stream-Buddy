export const bannersOutputPath = '/?banners-output=1#tiktok.studio';

export const bannerPositions = [
  ['top-left', 'Arriba · izquierda'],
  ['top-center', 'Arriba · centro'],
  ['top-right', 'Arriba · derecha'],
  ['bottom-left', 'Abajo · izquierda'],
  ['bottom-center', 'Abajo · centro'],
  ['bottom-right', 'Abajo · derecha'],
];

export const bannerAnimations = [
  ['rise', 'Elevar suave'],
  ['wipe', 'Barrido lateral'],
  ['curtain', 'Cortina'],
  ['zoom', 'Zoom corporativo'],
  ['slide', 'Deslizar lateral'],
  ['flip', 'Giro sutil'],
  ['fade', 'Fundido'],
  ['none', 'Sin animación'],
];

export const bannerExits = [
  ['sink', 'Descender suave'],
  ['wipe', 'Barrido lateral'],
  ['curtain', 'Cortina'],
  ['zoom', 'Alejar'],
  ['slide', 'Deslizar lateral'],
  ['flip', 'Giro sutil'],
  ['fade', 'Fundido'],
  ['none', 'Sin animación'],
];

export const bannerLayouts = [
  ['frame', 'Marco corporativo'],
  ['bleed', 'A sangre'],
  ['caption', 'Barra de patrocinador'],
];

export const bannerStyles = [
  ['corporate', 'Corporativo'],
  ['minimal', 'Minimal'],
  ['glass', 'Cristal'],
  ['contrast', 'Alto contraste'],
  ['soft', 'Suave'],
];

export const bannerFits = [
  ['contain', 'Contener · sin recortar'],
  ['cover', 'Cubrir · recortando'],
  ['fill', 'Estirar al espacio'],
];

export const defaultBanners = {
  enabled: true,
  ads: [],
  interval: 8,
  transition: 650,
  animation: 'rise',
  exitAnimation: 'sink',
  position: 'bottom-center',
  fitToCreative: true,
  width: 728,
  height: 90,
  fit: 'contain',
  layout: 'frame',
  style: 'corporate',
  background: '#0b1524',
  color: '#f8fafc',
  accent: '#3b82f6',
  opacity: 92,
  borderOpacity: 100,
  borderWidth: 1,
  radius: 10,
  padding: 5,
  showLabel: true,
  labelText: 'PUBLICIDAD',
  showProgress: true,
  showCaption: false,
  showAdvertiser: false,
  imageMotion: false,
  random: false,
  customCss: '',
  cssEnabled: true,
};

export function migrateBanners(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  const next = { ...input };
  if (typeof next.fitToCreative !== 'boolean') next.fitToCreative = defaultBanners.fitToCreative;
  if (typeof next.transition === 'number' && (next.transition < 150 || next.transition > 2000)) next.transition = defaultBanners.transition;
  if (typeof next.padding === 'number' && (next.padding < 0 || next.padding > 48)) next.padding = defaultBanners.padding;
  return next;
}

const assetPath = /^\/banner-assets\/[a-f0-9]{64}\.(png|gif|jpg|webp|svg)$/;

export function bannerImage(value) {
  if (typeof value !== 'string' || !value || value.length > 2048) return '';
  if (assetPath.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    return url.href;
  } catch {
    return '';
  }
}

function oneLine(value) {
  return typeof value === 'string' && !/[\r\n]/.test(value);
}

export function validateBanners(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Configuración inválida');
  const value = { ...defaultBanners, ...input }, result = {};
  for (const key of ['enabled', 'cssEnabled', 'showLabel', 'showProgress', 'showCaption', 'showAdvertiser', 'imageMotion', 'random', 'fitToCreative']) {
    if (typeof value[key] !== 'boolean') throw new Error('Estado inválido: ' + key);
    result[key] = value[key];
  }
  if (!bannerAnimations.some(([id]) => id === value.animation)) throw new Error('Animación de entrada inválida');
  result.animation = value.animation;
  if (!bannerExits.some(([id]) => id === value.exitAnimation)) throw new Error('Animación de salida inválida');
  result.exitAnimation = value.exitAnimation;
  if (!bannerPositions.some(([id]) => id === value.position)) throw new Error('Posición inválida');
  result.position = value.position;
  if (!bannerLayouts.some(([id]) => id === value.layout)) throw new Error('Formato del anuncio inválido');
  result.layout = value.layout;
  if (!bannerStyles.some(([id]) => id === value.style)) throw new Error('Tema visual inválido');
  result.style = value.style;
  if (!bannerFits.some(([id]) => id === value.fit)) throw new Error('Ajuste de imagen inválido');
  result.fit = value.fit;
  for (const [key, min, max] of [
    ['interval', 3, 300],
    ['transition', 150, 2000],
    ['width', 120, 1920],
    ['height', 40, 1080],
    ['padding', 0, 48],
    ['radius', 0, 60],
    ['opacity', 0, 100],
    ['borderOpacity', 0, 100],
    ['borderWidth', 0, 8],
  ]) {
    if (!Number.isInteger(value[key]) || value[key] < min || value[key] > max) throw new Error('Valor inválido: ' + key);
    result[key] = value[key];
  }
  if (!oneLine(value.labelText) || value.labelText.trim().length > 24) throw new Error('La etiqueta debe tener hasta 24 caracteres en una línea');
  result.labelText = value.labelText.trim();
  if (typeof value.customCss !== 'string' || value.customCss.length > 4000) throw new Error('CSS personalizado inválido');
  result.customCss = value.customCss.trim();
  for (const key of ['background', 'color', 'accent']) {
    if (typeof value[key] !== 'string' || !/^#[a-f0-9]{6}$/i.test(value[key])) throw new Error('Color inválido: ' + key);
    result[key] = value[key];
  }
  if (!Array.isArray(value.ads) || value.ads.length > 24) throw new Error('Añade hasta 24 anuncios');
  const ids = new Set();
  result.ads = value.ads.map(ad => {
    if (!ad || typeof ad !== 'object' || Array.isArray(ad)) throw new Error('Anuncio inválido');
    if (typeof ad.id !== 'string' || !/^[\w-]{1,80}$/.test(ad.id) || ids.has(ad.id)) throw new Error('Identificador de anuncio inválido');
    ids.add(ad.id);
    const image = bannerImage(ad.image);
    if (!image) throw new Error('Sube una imagen PNG, JPG, WebP, GIF o SVG para cada anuncio');
    const name = ad.name === undefined || ad.name === null ? 'Anuncio' : ad.name;
    if (!oneLine(name) || name.trim().length > 60) throw new Error('El nombre del anuncio debe tener hasta 60 caracteres');
    const alt = ad.alt === undefined || ad.alt === null ? '' : ad.alt;
    if (!oneLine(alt) || alt.trim().length > 160) throw new Error('El texto alternativo debe tener hasta 160 caracteres');
    const advertiser = ad.advertiser === undefined || ad.advertiser === null ? '' : ad.advertiser;
    if (!oneLine(advertiser) || advertiser.trim().length > 60) throw new Error('El anunciante debe tener hasta 60 caracteres');
    const caption = ad.caption === undefined || ad.caption === null ? '' : ad.caption;
    if (!oneLine(caption) || caption.trim().length > 120) throw new Error('El texto del anuncio debe tener hasta 120 caracteres');
    return {
      id: ad.id,
      image,
      name: name.trim() || 'Anuncio',
      alt: alt.trim(),
      advertiser: advertiser.trim(),
      caption: caption.trim(),
      enabled: ad.enabled === undefined ? true : ad.enabled,
    };
  });
  if (result.ads.some(ad => typeof ad.enabled !== 'boolean')) throw new Error('Estado del anuncio inválido');
  if (result.ads.some(ad => !ad.image)) throw new Error('Anuncio sin imagen');
  return result;
}
