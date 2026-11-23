export const coverFinishes = {
  "xp": "Luna XP",
  "wmp": "Windows Media Player",
  "winamp": "Winamp clásico",
  "ipod": "iPod",
  "vaporwave": "Vaporwave",
  "neon": "Neón nocturno",
  "radio": "Radio FM",
  "cassette": "Cassette",
  "marquee": "Marquesina",
  "amber": "Terminal ámbar",
  "glass": "Vidrio",
  "editorial": "Editorial"
};
export const playerStyles = ['compact', 'boxy', 'gallery', 'vertical', 'minimal', 'cd-retro', 'macos', 'shell', 'discord', ...Object.keys(coverFinishes)];
export const coverStyles = ['square', 'canvas', 'vinyl', 'none', ...Object.keys(coverFinishes)];
export const spotifyThemes = ['dark', 'light', 'tinted', 'gradient', 'transparent', 'cd-retro', 'xp', 'wmp', 'winamp', 'ipod', 'vaporwave', 'neon', 'radio', 'cassette', 'marquee', 'amber', 'glass', 'editorial'];
export const animationStyles = ['original', 'fade', 'slide-left', 'slide-right', 'slide-top', 'slide-bottom', 'grow', 'shrink', 'swing-left', 'swing-right', 'tilt-right', 'tilt-left'];
export const appearanceDefaults = { playerStyle: 'compact', coverStyle: 'square', coverGlow: false, coverBlur: false, magicColors: false, tintColor: '#1ed760', idleCover: '', canvasUrl: '', revealAnimation: 'original', exitAnimation: 'original', customCss: {}, cssEnabled: true, outputWidth: 0, outputHeight: 0, hideDelay:0, songChangeOnly:false, visibleDuration:5, hideVisualizer:false };
export function validateAppearance(value) {
  const c = { ...appearanceDefaults, ...value };
  if (!c.customCss || typeof c.customCss !== 'object' || Array.isArray(c.customCss) || Object.keys(c.customCss).some(key => !playerStyles.includes(key)) || Object.values(c.customCss).some(css => typeof css !== 'string' || css.length > 12000)) throw new Error('CSS inválido: máximo 12 000 caracteres por diseño.');
  if (typeof c.cssEnabled !== 'boolean') throw new Error('Estado del CSS inválido.');
  for (const key of ['outputWidth', 'outputHeight']) if (!Number.isInteger(c[key]) || (c[key] !== 0 && (c[key] < 80 || c[key] > 2560))) throw new Error('Las dimensiones deben estar entre 80 y 2560 px, o 0 para automático.');
  for (const [key, options] of [['playerStyle', playerStyles], ['coverStyle', coverStyles], ['revealAnimation', animationStyles], ['exitAnimation', animationStyles]]) {
    if (!options.includes(c[key])) throw new Error('Opción de apariencia de Spotify inválida: ' + key);
  }
  for (const key of ['coverGlow', 'coverBlur', 'magicColors', 'songChangeOnly', 'hideVisualizer']) if (typeof c[key] !== 'boolean') throw new Error('Ajuste de Spotify inválido: ' + key);
  for (const [key,min] of [['hideDelay',0],['visibleDuration',1]]) if (!Number.isInteger(c[key]) || c[key]<min || c[key]>300) throw new Error('Duración de Spotify inválida: ' + key);
  if (!/^#[\da-f]{6}$/i.test(c.tintColor)) throw new Error('Color de Spotify inválido.');
  if (typeof c.idleCover !== 'string' || c.idleCover.length > 700000 || (c.idleCover && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(c.idleCover))) throw new Error('La carátula debe ser PNG, JPG o WebP de hasta 500 KB.');
  if (typeof c.canvasUrl !== 'string' || c.canvasUrl.length > 2048) throw new Error('URL de video inválida.');
  if (c.canvasUrl) { let url; try { url = new URL(c.canvasUrl); } catch { throw new Error('URL de video inválida.'); } if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Usa un enlace HTTP o HTTPS al video.'); }
  return Object.fromEntries(Object.keys(appearanceDefaults).map(key => [key, c[key]]));
}
const playerSizes = {
  __proto__: null,
  compact: [600, 200],
  boxy: [600, 140],
  gallery: [320, 420],
  vertical: [288, 424],
  minimal: [600, 90],
  'cd-retro': [552, 264],
  shell: [600, 280],
  ipod: [320, 420],
  amber: [600, 280]
};
export function spotifySize(style, config = {}) {
  const [width, height] = playerSizes[style] || (style ? [600, 180] : playerSizes.compact);
  return [config.outputWidth || width, config.outputHeight || height];
}
export function validateSpotifyConfig(value) {
  const config = { mode:'local', enabled:true, clientId:'', hideWhenPaused:true, theme:'dark', ...value };
  if (!['local','api'].includes(config.mode) || typeof config.enabled !== 'boolean') throw new Error('Modo de Spotify inválido.');
  if (typeof config.clientId !== 'string' || (config.clientId && !/^[a-f0-9]{32}$/i.test(config.clientId))) throw new Error('Completa el Client ID de Spotify (32 caracteres).');
  if (typeof config.hideWhenPaused !== 'boolean' || !spotifyThemes.includes(config.theme)) throw new Error('Diseño de Spotify inválido.');
  return { ...validateAppearance(config), mode:config.mode, enabled:config.enabled, clientId:config.clientId, hideWhenPaused:config.hideWhenPaused, theme:config.theme };
}
