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

export const socialStyles = [
  ['clean', 'Limpio'],
  ['neon', 'Neón'],
  ['glass', 'Cristal'],
  ['soft', 'Suave'],
  ['retro', 'Retro'],
];

export const socialLayouts = [
  ['card', 'Tarjeta · completa'],
  ['minimal', 'Mínima'],
  ['slim', 'Compacta'],
  ['pill', 'Píldora'],
  ['stacked', 'Vertical'],
  ['banner', 'Franja'],
  ['announcement', 'Anuncio'],
  ['ticker', 'Ticker'],
  ['ribbon', 'Cinta'],
];

export function socialPlatform(id) {
  return socialPlatforms.find(platform => platform.id === id) ?? socialPlatforms[0];
}

export const defaultSocial = {
  enabled: true,
  heading: 'SÍGUEME EN',
  channels: [
    { id: 'instagram', platform: 'instagram', label: 'Instagram', handle: '@tuusuario', url: '', color: '#e1306c', enabled: true },
    { id: 'tiktok', platform: 'tiktok', label: 'TikTok', handle: '@tuusuario', url: '', color: '#25f4ee', enabled: true },
    { id: 'youtube', platform: 'youtube', label: 'YouTube', handle: '@tucanal', url: '', color: '#ff0033', enabled: true },
  ],
  interval: 6,
  animation: 'pop',
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
  radius: 24,
  showIcon: true,
  showLabel: true,
  showHandle: true,
  showProgress: true,
  random: false,
  iconSize: 56,
  textShadow: false,
  shadowColor: '#000000',
  customCss: '',
};

export function migrateSocial(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  const next = { ...input };
  if (typeof next.iconSize === 'number' && (next.iconSize < 24 || next.iconSize > 96)) next.iconSize = defaultSocial.iconSize;
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

export function validateSocial(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Configuración inválida');
  const value = { ...defaultSocial, ...input }, result = {};
  for (const key of ['enabled', 'showIcon', 'showLabel', 'showHandle', 'showProgress', 'random', 'textShadow']) {
    if (typeof value[key] !== 'boolean') throw new Error('Estado inválido');
    result[key] = value[key];
  }
  if (!socialAnimations.some(([id]) => id === value.animation)) throw new Error('Animación inválida');
  result.animation = value.animation;
  if (!socialPositions.some(([id]) => id === value.position)) throw new Error('Posición inválida');
  result.position = value.position;
  if (!socialLayouts.some(([id]) => id === value.layout)) throw new Error('Diseño inválido');
  result.layout = value.layout;
  if (!socialStyles.some(([id]) => id === value.style)) throw new Error('Tema visual inválido');
  result.style = value.style;
  if (!socialBorderStyles.some(([id]) => id === value.borderStyle)) throw new Error('Tipo de borde inválido');
  result.borderStyle = value.borderStyle;
  if (typeof value.heading !== 'string' || value.heading.length > 40 || /[\r\n]/.test(value.heading)) throw new Error('El texto superior debe tener hasta 40 caracteres en una línea');
  result.heading = value.heading.trim();
  for (const [key, min, max] of [['interval', 2, 120], ['width', 240, 900], ['iconSize', 24, 96], ['opacity', 0, 100], ['borderOpacity', 0, 100], ['borderWidth', 0, 8], ['radius', 0, 80]]) {
    if (!Number.isInteger(value[key]) || value[key] < min || value[key] > max) throw new Error('Valor inválido: ' + key);
    result[key] = value[key];
  }
  if (typeof value.customCss !== 'string' || value.customCss.length > 4000) throw new Error('CSS personalizado inválido');
  result.customCss = value.customCss.trim();
  for (const key of ['background', 'color', 'accent', 'shadowColor']) {
    if (!/^#[a-f0-9]{6}$/i.test(value[key])) throw new Error('Color inválido');
    result[key] = value[key];
  }
  if (!Array.isArray(value.channels) || value.channels.length < 1 || value.channels.length > 20) throw new Error('Añade entre 1 y 20 redes');
  const ids = new Set();
  result.channels = value.channels.map(channel => {
    if (!channel || typeof channel !== 'object' || Array.isArray(channel)) throw new Error('Red inválida');
    if (typeof channel.id !== 'string' || !/^[\w-]{1,80}$/.test(channel.id) || ids.has(channel.id)) throw new Error('Identificador de red inválido');
    ids.add(channel.id);
    const platform = socialPlatform(channel.platform);
    if (platform.id !== channel.platform) throw new Error('Red social inválida');
    const label = channel.label === undefined || channel.label === null ? platform.name : channel.label;
    if (typeof label !== 'string' || label.trim().length > 50 || /[\r\n]/.test(label)) throw new Error('El nombre de la red debe tener hasta 50 caracteres');
    const handle = channel.handle === undefined || channel.handle === null ? '' : channel.handle;
    if (typeof handle !== 'string' || handle.trim().length > 80 || /[\r\n]/.test(handle)) throw new Error('El usuario debe tener hasta 80 caracteres');
    const color = channel.color === undefined || channel.color === null ? platform.color : channel.color;
    if (typeof color !== 'string' || !/^#[a-f0-9]{6}$/i.test(color)) throw new Error('Color de red inválido');
    return {
      id: channel.id,
      platform: platform.id,
      label: label.trim(),
      handle: handle.trim(),
      url: safeUrl(channel.url),
      color,
      enabled: channel.enabled === undefined ? true : channel.enabled,
    };
  });
  if (result.channels.some(channel => typeof channel.enabled !== 'boolean')) throw new Error('Estado de red inválido');
  return result;
}
