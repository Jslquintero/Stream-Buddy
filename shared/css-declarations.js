export function cssDeclarations(selector, properties, priority = '') {
  const declarations = Object.entries(properties)
    .filter(([, value]) => value != null && value !== '')
    .map(([property, value]) => `  ${property}: ${value}${priority};`);
  return `${selector} {\n${declarations.join('\n')}\n}`;
}
