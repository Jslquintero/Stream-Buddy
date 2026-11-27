import { defaultSocial, resolveSocialDesign, socialLayouts, socialStyles } from './config.js';
import { googleFontStack } from '../../shared/google-fonts.js';

const layoutNames = Object.fromEntries(socialLayouts);
const styleNames = Object.fromEntries(socialStyles);
const autoRadii = { pill: 999, banner: 8, ticker: 6, ribbon: 4 };

function color(value, fallback) {
  return typeof value === 'string' && /^#[a-f0-9]{6}$/i.test(value) ? value : fallback;
}

function alpha(value, opacity) {
  return value + Math.round(Math.max(0, Math.min(1, opacity)) * 255).toString(16).padStart(2, '0');
}

function resolvedRadius(settings) {
  if (settings.cornerStyle === 'square') return 0;
  if (settings.cornerStyle === 'rounded') return Number(settings.radius) || 0;
  const base = autoRadii[settings.layout] ?? 24;
  return settings.style === 'soft' ? base + 8 : base;
}

export function socialCustomCss(config = defaultSocial) {
  const style = config?.style || 'clean';
  const value = config?.customCss;
  if (typeof value === 'string') return value;
  return value && typeof value === 'object' ? value[style] || '' : '';
}

export function socialCardCss(config = defaultSocial, selectedChannel) {
  const channels = Array.isArray(config.channels) ? config.channels : [];
  const channel = selectedChannel ?? channels.find(item => item.enabled) ?? channels[0] ?? defaultSocial.channels[0];
  const settings = resolveSocialDesign(config, channel);
  const background = color(settings.background, '#0f1218');
  const accent = color(settings.accent, '#b9f678');
  const text = color(settings.color, '#ffffff');
  const shadow = color(settings.shadowColor, '#000000');
  const channelColor = color(channel?.color, '#e1306c');
  const radius = resolvedRadius(settings);
  const cornerRadius = settings.cornerStyle === 'custom'
    ? ['TL', 'TR', 'BR', 'BL'].map(corner => (Number(settings['radius' + corner]) || 0) + 'px').join(' ')
    : radius + 'px';
  const width = Number(settings.width) || 460;
  const iconSize = Number(settings.iconSize) || 56;
  const borderWidth = Number(settings.borderWidth) || 0;
  const borderOpacity = Math.max(0, Math.min(100, Number(settings.borderOpacity ?? 100))) / 100;
  const border = settings.borderEffect === 'none'
    ? `${borderWidth}px ${settings.borderStyle || 'solid'} ${alpha(accent, borderOpacity)}`
    : '0 solid transparent';
  const textShadow = settings.textShadow ? `0 0.1em 0.4em ${alpha(shadow, 0.65)}` : 'none';
  const fontStack = googleFontStack(settings.fontFamily);
  const layout = layoutNames[settings.layout] ?? 'Tarjeta · completa';
  const style = styleNames[settings.style] ?? 'Limpio';

  const lines = [
    `/* Social Media Rotator · ${style} · ${layout} */`,
    '.social-card {',
    `  --social-width: ${width}px;`,
    `  --social-bg: ${alpha(background, (Number(settings.opacity) || 0) / 100)};`,
    `  --social-border: ${alpha(accent, borderOpacity)};`,
    `  --social-border-width: ${borderWidth}px;`,
    `  --social-border-style: ${settings.borderStyle || 'solid'};`,
    `  --social-color: ${text};`,
    `  --social-text-duration: ${settings.textAnimationDuration}ms;`,
    ...(fontStack ? [`  --social-font-family: ${fontStack};`] : []),
    `  --social-accent: ${accent};`,
    `  --social-channel: ${channelColor};`,
    `  --social-radius: ${radius}px;`,
    `  --social-icon-size: ${iconSize}px;`,
    `  --social-custom-height: ${Number(settings.customHeight) || 250}px;`,
    `  --social-image-x: ${settings.imagePositionX}%;`,
    `  --social-image-y: ${settings.imagePositionY}%;`,
    `  --social-image-width: ${Number(settings.imageWidth) || 230}px;`,
    `  --social-image-height: ${Number(settings.imageHeight) || 250}px;`,
    `  --social-image-gap: ${Number(settings.imageGap) || 0}px;`,
    `  --social-image-radius: ${Number(settings.imageRadius) || 0}px;`,
    `  --social-image-fit: ${settings.imageFit || 'cover'};`,
    `  --social-image-position: calc(50% + ${Number(settings.imageOffsetX) || 0}%) calc(50% + ${Number(settings.imageOffsetY) || 0}%);`,
    `  --social-image-zoom: ${(Number(settings.imageZoom) || 100) / 100};`,
    `  --social-interval: ${Number(settings.interval) || 6}s;`,
    '  position: relative;',
    `  width: min(${width}px, 100%);`,
    '  padding: 1em 1.2em 1.2em;',
    `  color: ${text};`,
    `  background: ${alpha(background, (Number(settings.opacity) || 0) / 100)};`,
    `  border: ${border};`,
    `  border-radius: ${cornerRadius};`,
    '  box-shadow: 0 18px 48px #0007, inset 0 1px 0 #ffffff10;',
    "  font-family: Inter, 'Segoe UI', sans-serif;",
    `  font-size: clamp(14px, calc(${width}px * 0.035), 26px);`,
    '}',
    '',
    '.social-card .social-icon {',
    `  width: ${iconSize}px;`,
    `  height: ${iconSize}px;`,
    `  color: ${channelColor};`,
    `  background: ${alpha(channelColor, 0.16)};`,
    `  border: 1px solid ${alpha(channelColor, 0.5)};`,
    '}',
    '',
    '.social-card .social-media img {',
    `  object-fit: ${settings.imageFit || 'cover'};`,
    `  object-position: calc(50% + ${Number(settings.imageOffsetX) || 0}%) calc(50% + ${Number(settings.imageOffsetY) || 0}%);`,
    `  transform: scale(${(Number(settings.imageZoom) || 100) / 100});`,
    '}',
    '',
    '.social-card .social-copy {',
    '  font-family: var(--social-font-family, inherit);',
    '  animation-duration: var(--social-text-duration, 500ms);',
    '}',
    '',
    '.social-card .social-heading {',
    '  color: #ffffffa8;',
    '  font-size: 0.6em;',
    '  font-weight: 750;',
    '  letter-spacing: 0.2em;',
    '  text-transform: uppercase;',
    '}',
    '',
    '.social-card .social-label {',
    `  color: ${text};`,
    '  font-size: 1.34em;',
    '  font-weight: 800;',
    '}',
    '',
    '.social-card .social-handle {',
    `  color: ${channelColor};`,
    '  font-size: 0.78em;',
    '  font-weight: 650;',
    '}',
    '',
    '.social-card .social-heading,',
    '.social-card .social-label,',
    '.social-card .social-handle {',
    `  text-shadow: ${textShadow};`,
    '}',
  ];

  if (settings.borderEffect !== 'none') {
    lines.push(
      '',
      '/* Efecto de borde RGB */',
      '.social-card { border-color: transparent; }',
      '.social-card::before {',
      "  content: '';",
      '  position: absolute;',
      '  inset: 0;',
      `  padding: max(2px, ${borderWidth}px);`,
      '  border-radius: inherit;',
      '  background: conic-gradient(from 90deg, #ff2d75, #ff9a00, #f4ff00, #2bff88, #00d4ff, #7b5cff, #ff2df7, #ff2d75);',
      '  animation: social-rgb 6s linear infinite;',
      '  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);',
      '  -webkit-mask-composite: xor;',
      '  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);',
      '  mask-composite: exclude;',
      '  pointer-events: none;',
      '}',
    );
  }

  lines.push(
    '',
    `/* Tema visual «${style}» y formato «${layout}»: la app añade sus detalles propios. */`,
    '',
    '/* ── Modificaciones personalizadas ── */',
    settings.cssEnabled === false ? '/* CSS personalizado desactivado */' : '',
    settings.cssEnabled === false ? '' : '',
    socialCustomCss(settings).trim() || '/* Sin modificaciones */',
  );
  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}
