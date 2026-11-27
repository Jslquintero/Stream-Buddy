export function googleFontId(value) {
  return typeof value === 'string' && /^google:[a-f0-9]{24}$/.test(value) ? value.slice(7) : '';
}

export function googleFontStack(value) {
  const id = googleFontId(value);
  return id ? '"GoogleFont-' + id + '", sans-serif' : undefined;
}
