const dimensions = { width:[200,1200], fontSize:[16,96], imageSize:[32,400], padding:[0,80], radius:[0,80], imageRadius:[0,200], borderWidth:[0,12] };
export function resizeNotification(design, factor) {
  if (!Number.isFinite(factor) || factor <= 0) throw new Error('Escala inválida');
  const values = Object.entries(dimensions).filter(([key]) => Number.isFinite(design[key]) && design[key] > 0);
  const minimum = Math.max(...values.map(([key,[min]]) => min / design[key]));
  const maximum = Math.min(...values.map(([key,[,max]]) => max / design[key]));
  const scale = Math.min(maximum, Math.max(minimum, factor));
  return Object.fromEntries(Object.keys(dimensions).map(key => [key, Math.round(design[key] * scale)]));
}
