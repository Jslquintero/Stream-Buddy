import { googleFontId } from '../../shared/google-fonts.js';

export const socialOutputPath = '/?social-output=1#tiktok.studio';

export const socialPlatforms = [
  { id: 'instagram', name: 'Instagram', color: '#e1306c', placeholder: '@tuusuario' },
  { id: 'tiktok', name: 'TikTok', color: '#25f4ee', placeholder: '@tuusuario' },
  { id: 'youtube', name: 'YouTube', color: '#ff0033', placeholder: '@tucanal' },
  { id: 'twitch', name: 'Twitch', color: '#9146ff', placeholder: 'tucanal' },
  { id: 'kick', name: 'Kick', color: '#53fc18', placeholder: 'tucanal' },
  { id: 'x', name: 'X', color: '#e7e9ea', placeholder: '@tuusuario' },
  { id: 'facebook', name: 'Facebook', color: '#1877f2', placeholder: '/tupagina' },
  { id: 'discord', name: 'Discord', color: '#5865f2', placeholder: 'discord.gg/invitacion' },
  { id: 'telegram', name: 'Telegram', color: '#2aabee', placeholder: '@tucanal' },
  { id: 'threads', name: 'Threads', color: '#e7e9ea', placeholder: '@tuusuario' },
  { id: 'website', name: 'Sitio web', color: '#b9f678', placeholder: 'tupagina.com' },
  { id: 'custom', name: 'Personalizada', color: '#a78bfa', placeholder: '@tuusuario' },
  { id: 'qr', name: 'QR', color: '#64748b', placeholder: 'https://tupagina.com' },
  { id: 'linkedin', name: 'LinkedIn', color: '#0a66c2', placeholder: '/tuperfil' },
  { id: 'bluesky', name: 'Bluesky', color: '#1185fe', placeholder: '@usuario' },
  { id: 'mastodon', name: 'Mastodon', color: '#563acc', placeholder: '@usuario' },
  { id: 'reddit', name: 'Reddit', color: '#ff4500', placeholder: 'r/tucomunidad' },
  { id: 'pinterest', name: 'Pinterest', color: '#e60023', placeholder: '/tuboard' },
  { id: 'medium', name: 'Medium', color: '#000000', placeholder: '@usuario' },
  { id: 'patreon', name: 'Patreon', color: '#f96854', placeholder: '@creador' },
  { id: 'dribbble', name: 'Dribbble', color: '#ea4c89', placeholder: '@usuario' },
  { id: 'behance', name: 'Behance', color: '#1769ff', placeholder: '@usuario' },
];

export const socialQrPalettes = [
  { id: 'classic', name: 'Negro sobre blanco', foreground: '#000000', background: '#ffffff' },
  { id: 'blue', name: 'Azul marino sobre celeste', foreground: '#172554', background: '#eff6ff' },
  { id: 'green', name: 'Verde bosque sobre menta', foreground: '#052e16', background: '#ecfdf5' },
  { id: 'purple', name: 'Morado sobre lavanda', foreground: '#3b0764', background: '#faf5ff' },
  { id: 'sepia', name: 'Marrón sobre crema', foreground: '#431407', background: '#fffbeb' },
];

export const socialQrShapes = [
  ['square', 'Cuadrados'],
  ['rounded', 'Redondeados'],
];

export const socialIconShapes = [
  ['auto', 'Según el formato'],
  ['rounded', 'Redondeado'],
  ['circle', 'Círculo'],
  ['square', 'Cuadrado'],
];

export const socialIconBackdropStyles = [
  ['theme', 'Según el tema'],
  ['channel', 'Color de la red'],
  ['light', 'Claro'],
  ['dark', 'Oscuro'],
];

export const socialAnimations = [
  ['pop', 'Pop'],
  ['slide', 'Deslizar'],
  ['flip', 'Girar'],
  ['bounce', 'Rebote'],
  ['float', 'Flotar'],
  ['scale', 'Acercar'],
  ['fade', 'Fundido'],
  ['none', 'Sin animación'],
];

export const socialTextAnimations = [
  ...socialAnimations.filter(([id]) => id !== 'none'),
  ['reveal', 'Revelar'],
  ['blur', 'Enfoque'],
  ['none', 'Sin animación'],
];

export const socialPositions = [
  ['top-left', 'Arriba · izquierda'],
  ['top-center', 'Arriba · centro'],
  ['top-right', 'Arriba · derecha'],
  ['bottom-left', 'Abajo · izquierda'],
  ['bottom-center', 'Abajo · centro'],
  ['bottom-right', 'Abajo · derecha'],
];

export const socialBorderStyles = [
  ['solid', 'Sólido'],
  ['dashed', 'Discontinuo'],
  ['dotted', 'Punteado'],
  ['double', 'Doble'],
  ['none', 'Sin borde'],
];

export const socialCornerStyles = [
  ['auto', 'Según el formato'],
  ['rounded', 'Redondeadas'],
  ['square', 'Rectas'],
  ['custom', 'Por esquina'],
];

export const socialBorderEffects = [
  ['none', 'Normal'],
  ['rgb', 'RGB animado'],
  ['glow', 'RGB con brillo'],
];

export const socialImageFits = [
  ['cover', 'Rellenar y recortar'],
  ['contain', 'Mostrar completa'],
];

export const socialImageCorners = [
  ['all', 'Todas'],
  ['none', 'Ninguna'],
  ['top', 'Superiores'],
  ['bottom', 'Inferiores'],
  ['left', 'Izquierdas'],
  ['right', 'Derechas'],
  ['custom', 'Personalizadas'],
];

export const socialStyles = [
  ['clean', 'Limpio'],
  ['neon', 'Neón'],
  ['glass', 'Cristal'],
  ['soft', 'Suave'],
  ['retro', 'Retro'],
  ['aurora', 'Aurora'],
  ['holo', 'Holográfico'],
  ['noir', 'Noir'],
  ['outline', 'Contorno'],
  ['candy', 'Pastel'],
  ['matrix', 'Matrix'],
];

export const socialLayouts = [
  ['card', 'Tarjeta · completa'],
  ['hero', 'Destacada'],
  ['minimal', 'Mínima'],
  ['slim', 'Compacta'],
  ['pill', 'Píldora'],
  ['badge', 'Insignia'],
  ['photo-left', 'Lower third · foto izquierda'],
  ['photo-right', 'Lower third · foto derecha'],
  ['photo-cover', 'Lower third · foto completa'],
  ['photo-top', 'Lower third · foto superior'],
  ['photo-caption', 'Lower third · pie sobre foto'],
  ['custom', 'Tarjeta personalizada'],
  ['stacked', 'Vertical'],
  ['banner', 'Franja'],
  ['announcement', 'Anuncio'],
  ['ticker', 'Ticker'],
  ['ribbon', 'Cinta'],
];

const socialLayoutIds = new Set(socialLayouts.map(([id]) => id));

export function resolveSocialLayout(config, channel) {
  return channel?.layout ?? config?.layout ?? defaultSocial.layout;
}

export function resolveSocialDesign(config, channel) {
  const design = { ...defaultSocial, ...config, ...channel?.design, layout: resolveSocialLayout(config, channel) };
  if (channel?.platform === 'qr' && channel.design?.heading === undefined && design.heading === defaultSocial.heading) {
    design.heading = 'ESCANEA EL CÓDIGO';
  }
  return design;
}

export function socialPlatform(id) {
  return socialPlatforms.find(platform => platform.id === id) ?? socialPlatforms[0];
}

const socialAssetPath = /^\/social-assets\/[a-f0-9]{64}\.(png|gif|jpg|webp|svg)$/;

function validateSocialImage(image, error = 'Foto de red inválida') {
  if (typeof image !== 'string' || (image && !socialAssetPath.test(image))) throw new Error(error);
  return image;
}

export const defaultSocial = {
  enabled: true,
  heading: 'SÍGUEME EN',
  channels: [
    { id: 'instagram', platform: 'instagram', label: 'Instagram', handle: '@tuusuario', url: '', color: '#e1306c', enabled: true, image: '' },
    { id: 'tiktok', platform: 'tiktok', label: 'TikTok', handle: '@tuusuario', url: '', color: '#25f4ee', enabled: true, image: '' },
    { id: 'youtube', platform: 'youtube', label: 'YouTube', handle: '@tucanal', url: '', color: '#ff0033', enabled: true, image: '' },
  ],
  interval: 6,
  animation: 'pop',
  textAnimation: 'none',
  textAnimationDuration: 500,
  fontFamily: 'theme',
  position: 'bottom-left',
  layout: 'card',
  style: 'clean',
  width: 460,
  background: '#0f1218',
  color: '#ffffff',
  accent: '#b9f678',
  opacity: 92,
  borderOpacity: 100,
  borderStyle: 'solid',
  borderWidth: 1,
  borderEffect: 'none',
  cornerStyle: 'auto',
  radius: 24,
  radiusTL: 24,
  radiusTR: 24,
  radiusBR: 24,
  radiusBL: 24,
  showIcon: true,
  showIconBackdrop: true,
  iconShape: 'auto',
  iconBackdropStyle: 'theme',
  showLabel: true,
  showHandle: true,
  showProgress: true,
  random: false,
  iconSize: 56,
  qrSize: 160,
  qrPalette: 'classic',
  qrShape: 'square',
  image: '',
  customHeight: 250,
  imagePositionX: 50,
  imagePositionY: 50,
  imageWidth: 230,
  imageHeight: 250,
  imageGap: 18,
  imageFit: 'cover',
  imageOffsetX: 0,
  imageOffsetY: 0,
  imageZoom: 100,
  imageRadius: 20,
  imageCorners: 'all',
  imageRadiusTL: 20,
  imageRadiusTR: 20,
  imageRadiusBR: 20,
  imageRadiusBL: 20,
  imageShadow: true,
  textShadow: false,
  shadowColor: '#000000',
  customCss: {},
  cssEnabled: true,
  cssTemplates: [],
};

export function migrateSocial(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  const next = { ...input };
  delete next.layoutMode;
  if (typeof next.iconSize === 'number' && (next.iconSize < 24 || next.iconSize > 96)) next.iconSize = defaultSocial.iconSize;
  if (typeof next.customCss === 'string') {
    const style = socialStyles.some(([id]) => id === next.style) ? next.style : 'clean';
    next.customCss = next.customCss.trim() ? { [style]: next.customCss } : {};
  }
  if (next.cssEnabled === undefined) next.cssEnabled = true;
  return next;
}

function safeUrl(value) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Enlace inválido: usa una dirección HTTP o HTTPS');
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
    return url.href;
  } catch {
    throw new Error('Enlace inválido: usa una dirección HTTP o HTTPS');
  }
}

export function validateSocialQrUrl(value) {
  const url = safeUrl(value);
  if (url.length > 2048) throw new Error('El enlace del QR supera los 2048 caracteres al codificarlo');
  return url;
}

export function validateSocialWebsiteUrl(value) {
  const input = typeof value === 'string' ? value.trim() : value;
  const bareDomain = /^(?:[\p{L}\p{N}-]+\.)+[\p{L}\p{N}-]+(?::\d+)?(?:[/?#]|$)/u;
  return safeUrl(typeof input === 'string' && bareDomain.test(input) ? 'https://' + input : input);
}

function validateSocialDesign(value) {
  const result = {};
  if (!socialQrPalettes.some(({ id }) => id === value.qrPalette) || !socialQrShapes.some(([id]) => id === value.qrShape)) {
    throw new Error('Estilo de QR inválido');
  }
  result.qrPalette = value.qrPalette;
  result.qrShape = value.qrShape;
  for (const key of ['showIcon', 'showIconBackdrop', 'showLabel', 'showHandle', 'textShadow', 'imageShadow']) {
    if (typeof value[key] !== 'boolean') throw new Error('Estado inválido');
    result[key] = value[key];
  }
  if (!socialIconShapes.some(([id]) => id === value.iconShape) || !socialIconBackdropStyles.some(([id]) => id === value.iconBackdropStyle)) {
    throw new Error('Estilo de icono inválido');
  }
  result.iconShape = value.iconShape;
  result.iconBackdropStyle = value.iconBackdropStyle;
  if (!socialAnimations.some(([id]) => id === value.animation)) throw new Error('Animación inválida');
  result.animation = value.animation;
  if (!socialTextAnimations.some(([id]) => id === value.textAnimation)) throw new Error('Animación de texto inválida');
  result.textAnimation = value.textAnimation;
  if (value.fontFamily !== 'theme' && !googleFontId(value.fontFamily)) {
    throw new Error('Tipografía inválida');
  }
  result.fontFamily = value.fontFamily;
  if (!socialPositions.some(([id]) => id === value.position)) throw new Error('Posición inválida');
  result.position = value.position;
  if (!socialStyles.some(([id]) => id === value.style)) throw new Error('Tema visual inválido');
  result.style = value.style;
  if (!socialBorderStyles.some(([id]) => id === value.borderStyle)) throw new Error('Tipo de borde inválido');
  result.borderStyle = value.borderStyle;
  if (!socialCornerStyles.some(([id]) => id === value.cornerStyle)) throw new Error('Estilo de esquinas inválido');
  result.cornerStyle = value.cornerStyle;
  if (!socialBorderEffects.some(([id]) => id === value.borderEffect)) throw new Error('Efecto de borde inválido');
  result.borderEffect = value.borderEffect;
  if (!socialImageFits.some(([id]) => id === value.imageFit)) throw new Error('Encuadre de foto inválido');
  result.imageFit = value.imageFit;
  if (!socialImageCorners.some(([id]) => id === value.imageCorners)) throw new Error('Esquinas de foto inválidas');
  result.imageCorners = value.imageCorners;
  if (typeof value.heading !== 'string' || value.heading.length > 40 || /[\r\n]/.test(value.heading)) throw new Error('El texto superior debe tener hasta 40 caracteres en una línea');
  result.heading = value.heading.trim();
  for (const [key, min, max] of [
    ['width', 240, 900], ['iconSize', 24, 96], ['qrSize', 120, 360], ['opacity', 0, 100],
    ['textAnimationDuration', 100, 2000],
    ['borderOpacity', 0, 100], ['borderWidth', 0, 8], ['radius', 0, 80],
    ['radiusTL', 0, 80], ['radiusTR', 0, 80], ['radiusBR', 0, 80], ['radiusBL', 0, 80],
    ['customHeight', 80, 900], ['imagePositionX', 0, 100], ['imagePositionY', 0, 100],
    ['imageWidth', 80, 900], ['imageHeight', 80, 900], ['imageGap', 0, 64],
    ['imageOffsetX', -50, 50], ['imageOffsetY', -50, 50], ['imageZoom', 100, 200],
    ['imageRadius', 0, 120], ['imageRadiusTL', 0, 120], ['imageRadiusTR', 0, 120],
    ['imageRadiusBR', 0, 120], ['imageRadiusBL', 0, 120],
  ]) {
    if (!Number.isInteger(value[key]) || value[key] < min || value[key] > max) throw new Error('Valor inválido: ' + key);
    result[key] = value[key];
  }
  if (typeof value.cssEnabled !== 'boolean') throw new Error('Estado del CSS personalizado inválido');
  result.cssEnabled = value.cssEnabled;
  if (!value.customCss || typeof value.customCss !== 'object' || Array.isArray(value.customCss)) throw new Error('CSS personalizado inválido');
  const styleIds = socialStyles.map(([id]) => id);
  result.customCss = {};
  for (const [style, css] of Object.entries(value.customCss)) {
    if (!styleIds.includes(style)) throw new Error('Tema de CSS personalizado inválido');
    if (typeof css !== 'string' || css.length > 12000) throw new Error('CSS personalizado inválido: máximo 12 000 caracteres');
    if (css.trim()) result.customCss[style] = css.trim();
  }
  for (const key of ['background', 'color', 'accent', 'shadowColor']) {
    if (!/^#[a-f0-9]{6}$/i.test(value[key])) throw new Error('Color inválido');
    result[key] = value[key];
  }
  return result;
}

export function validateSocial(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Configuración inválida');
  const value = { ...defaultSocial, ...input };
  const result = validateSocialDesign(value);
  result.image = validateSocialImage(value.image);
  for (const key of ['enabled', 'showProgress', 'random']) {
    if (typeof value[key] !== 'boolean') throw new Error('Estado inválido');
    result[key] = value[key];
  }
  if (!Number.isInteger(value.interval) || value.interval < 2 || value.interval > 120) throw new Error('Valor inválido: interval');
  result.interval = value.interval;
  if (!socialLayoutIds.has(value.layout)) throw new Error('Diseño inválido');
  result.layout = value.layout;
  if (!Array.isArray(value.cssTemplates) || value.cssTemplates.length > 20) throw new Error('Plantillas CSS inválidas: máximo 20');
  const templateIds = new Set();
  result.cssTemplates = value.cssTemplates.map(template => {
    if (!template || typeof template !== 'object' || Array.isArray(template)) throw new Error('Plantilla CSS inválida');
    if (typeof template.id !== 'string' || !/^[\w-]{1,80}$/.test(template.id) || templateIds.has(template.id)) throw new Error('Identificador de plantilla CSS inválido');
    templateIds.add(template.id);
    if (typeof template.name !== 'string' || !template.name.trim() || template.name.trim().length > 60 || /[\r\n]/.test(template.name)) throw new Error('El nombre de la plantilla CSS debe tener hasta 60 caracteres');
    if (typeof template.css !== 'string' || !template.css.trim() || template.css.length > 12000) throw new Error('El CSS de la plantilla no es válido');
    return { id: template.id, name: template.name.trim(), css: template.css };
  });
  if (!Array.isArray(value.channels) || value.channels.length < 1 || value.channels.length > 20) throw new Error('Añade entre 1 y 20 redes');
  const ids = new Set();
  result.channels = value.channels.map(channel => {
    if (!channel || typeof channel !== 'object' || Array.isArray(channel)) throw new Error('Red inválida');
    if (typeof channel.id !== 'string' || !/^[\w-]{1,80}$/.test(channel.id) || ids.has(channel.id)) throw new Error('Identificador de red inválido');
    ids.add(channel.id);
    const platform = socialPlatform(channel.platform);
    if (platform.id !== channel.platform) throw new Error('Red social inválida');
    const validateUrl = platform.id === 'website' ? validateSocialWebsiteUrl : platform.id === 'qr' ? validateSocialQrUrl : safeUrl;
    const label = channel.label ?? '';
    if (typeof label !== 'string' || label.trim().length > 50 || /[\r\n]/.test(label)) throw new Error('El nombre de la red debe tener hasta 50 caracteres');
    const handle = channel.handle === undefined || channel.handle === null ? '' : channel.handle;
    if (typeof handle !== 'string' || handle.trim().length > 80 || /[\r\n]/.test(handle)) throw new Error('El usuario debe tener hasta 80 caracteres');
    const color = channel.color === undefined || channel.color === null ? platform.color : channel.color;
    if (typeof color !== 'string' || !/^#[a-f0-9]{6}$/i.test(color)) throw new Error('Color de red inválido');
    const image = validateSocialImage(channel.image ?? '');
    const icon = validateSocialImage(channel.icon ?? '', 'Icono de red inválido');
    if (channel.layout !== undefined && !socialLayoutIds.has(channel.layout)) throw new Error('Formato de red inválido');
    let design;
    if (channel.design !== undefined) {
      if (!channel.design || typeof channel.design !== 'object' || Array.isArray(channel.design)) throw new Error('Diseño de red inválido');
      const validated = validateSocialDesign({ ...result, ...channel.design });
      design = Object.fromEntries(Object.entries(validated).filter(([key]) => Object.hasOwn(channel.design, key)));
    }
    return {
      id: channel.id,
      platform: platform.id,
      label: label.trim(),
      handle: handle.trim(),
      url: validateUrl(channel.url),
      color,
      enabled: channel.enabled === undefined ? true : channel.enabled,
      image,
      ...(icon ? { icon } : {}),
      ...(channel.layout === undefined ? {} : { layout: channel.layout }),
      ...(design && Object.keys(design).length ? { design } : {}),
    };
  });
  if (result.channels.some(channel => typeof channel.enabled !== 'boolean')) throw new Error('Estado de red inválido');
  return result;
}
