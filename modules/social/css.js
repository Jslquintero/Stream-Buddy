import { defaultSocial, resolveSocialDesign, socialLayouts, socialPlatform, socialStyles } from './config.js';
import { googleFontStack } from '../../shared/google-fonts.js';
import { cssDeclarations } from '../../shared/css-declarations.js';

const layoutNames = Object.fromEntries(socialLayouts);
const styleNames = Object.fromEntries(socialStyles);

function color(value, fallback) {
  return typeof value === 'string' && /^#[a-f0-9]{6}$/i.test(value) ? value : fallback;
}

function alpha(value, opacity) {
  return value + Math.round(Math.max(0, Math.min(1, opacity)) * 255).toString(16).padStart(2, '0');
}

export function socialCustomCss(config = defaultSocial) {
  const style = config?.style || 'clean';
  const value = config?.customCss;
  if (typeof value === 'string') return value;
  return value && typeof value === 'object' ? value[style] || '' : '';
}

export function socialCardProperties(settings, channel) {
  const channelColor = color(channel?.color, socialPlatform(channel?.platform).color);
  const background = color(settings.background, '#0f1218');
  const accent = color(settings.accent, '#b9f678');
  const shadowColor = color(settings.shadowColor, '#000000');
  const cover = ['photo-cover', 'photo-caption'].includes(settings.layout);
  const defaultTextShadow = cover && (channel?.image || settings.image) ? '0 2px 12px #000e, 0 0 3px #000b' : 'none';
  return {
    '--social-width': (Number(settings.width) || 460) + 'px',
    '--social-bg': alpha(background, (Number(settings.opacity) || 0) / 100),
    '--social-border': alpha(accent, Math.min(100, Math.max(0, Number(settings.borderOpacity ?? 100))) / 100),
    '--social-border-width': (Number(settings.borderWidth) || 0) + 'px',
    '--social-border-style': settings.borderStyle || 'solid',
    '--social-color': color(settings.color, '#ffffff'),
    '--social-font-family': googleFontStack(settings.fontFamily),
    '--social-text-duration': settings.textAnimationDuration + 'ms',
    '--social-text-shadow': settings.textShadow ? `0 0.1em 0.4em ${alpha(shadowColor, 0.65)}` : defaultTextShadow,
    '--social-accent': accent,
    '--social-channel': channelColor,
    '--social-channel-bg': alpha(channelColor, 0.16),
    '--social-channel-border': alpha(channelColor, 0.5),
    '--social-channel-glow': alpha(channelColor, 0.24),
    '--social-radius': (Number(settings.radius) || 0) + 'px',
    '--social-card-tl': (Number(settings.radiusTL) || 0) + 'px',
    '--social-card-tr': (Number(settings.radiusTR) || 0) + 'px',
    '--social-card-br': (Number(settings.radiusBR) || 0) + 'px',
    '--social-card-bl': (Number(settings.radiusBL) || 0) + 'px',
    '--social-interval': (Number(settings.interval) || 6) + 's',
    '--social-icon-size': (Number(settings.iconSize) || 56) + 'px',
    '--social-image-width': (Number(settings.imageWidth) || 230) + 'px',
    '--social-image-height': (Number(settings.imageHeight) || 250) + 'px',
    '--social-image-gap': (Number(settings.imageGap) || 0) + 'px',
    '--social-custom-height': (Number(settings.customHeight) || 250) + 'px',
    '--social-image-x': settings.imagePositionX + '%',
    '--social-image-y': settings.imagePositionY + '%',
    '--social-image-fit': settings.imageFit || 'cover',
    '--social-image-position': `calc(50% + ${Number(settings.imageOffsetX) || 0}%) calc(50% + ${Number(settings.imageOffsetY) || 0}%)`,
    '--social-image-zoom': (Number(settings.imageZoom) || 100) / 100,
    '--social-image-radius': (Number(settings.imageRadius) || 0) + 'px',
    '--social-image-tl': (Number(settings.imageRadiusTL) || 0) + 'px',
    '--social-image-tr': (Number(settings.imageRadiusTR) || 0) + 'px',
    '--social-image-br': (Number(settings.imageRadiusBR) || 0) + 'px',
    '--social-image-bl': (Number(settings.imageRadiusBL) || 0) + 'px',
  };
}

export function socialCardCss(config = defaultSocial, selectedChannel, includeCustom = true) {
  const channels = Array.isArray(config.channels) ? config.channels : [];
  const channel = selectedChannel ?? channels.find(item => item.enabled) ?? channels[0] ?? defaultSocial.channels[0];
  const settings = resolveSocialDesign(config, channel);
  const style = styleNames[settings.style] ?? 'Limpio';
  const layout = layoutNames[settings.layout] ?? 'Tarjeta · completa';
  const css = settings.cssEnabled === false ? '/* CSS personalizado desactivado */' : socialCustomCss(settings).trim();
  return [
    `/* Tema visual «${style}» · ${layout} */`,
    cssDeclarations('.social-card', socialCardProperties(settings, channel)),
    includeCustom ? css : '',
  ].filter(Boolean).join('\n\n');
}
