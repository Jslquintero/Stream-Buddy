export function boardStyle(prefix, config) {
  const alpha = value => Math.round(value * 2.55).toString(16).padStart(2, '0');
  return {
    [`--${prefix}-width`]: config.width + 'px',
    [`--${prefix}-font-size`]: config.fontSize + 'px',
    [`--${prefix}-color`]: config.color,
    [`--${prefix}-background`]: config.background + alpha(config.opacity),
    [`--${prefix}-border`]: config.accent + alpha(config.borderOpacity),
    [`--${prefix}-radius`]: config.radius + 'px',
    [`--${prefix}-accent`]: config.accent,
  };
}
