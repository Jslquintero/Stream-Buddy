export function commandHelpMessages(config) {
  if (!config.enabled) throw new Error('Activa los comandos antes de enviar la lista');
  const entries = config.commands.filter(row => row.enabled).map(row => {
    const description = row.description || (row.image ? 'Muestra una imagen o GIF' : row.audio ? 'Reproduce un sonido' : 'Muestra una notificación');
    return row.command + ': ' + description;
  });
  if (!entries.length) return ['No hay comandos activos por ahora.'];
  const messages = []; let current = 'Comandos: ';
  for (const entry of entries) {
    const separator = current === 'Comandos: ' ? '' : ' · ';
    if ([...current + separator + entry].length > 150) {
      if (current !== 'Comandos: ') messages.push(current);
      current = entry;
    } else current += separator + entry;
  }
  if (current) messages.push(current);
  return messages;
}
