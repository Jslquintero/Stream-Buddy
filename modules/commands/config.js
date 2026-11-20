export const commandsListOutputPath = '/commands?commands-list-output=1#tiktok.studio';
export const commandsOutputPath = '/commands?commands-output=1#tiktok.studio';
export const defaultCommands = { enabled: true, commands: [
  { id: 'aatrox', command: '!Aatrox', description: 'Muestra un GIF de Aatrox', enabled: false, image: '', audio: '', text: '', duration: 5, volume: 80 },
  { id: 'sion', command: '!Sion', description: 'Reproduce el sonido de la definitiva de Sion', enabled: false, image: '', audio: '', text: '', duration: 5, volume: 80 },
] };

function media(value, kind) {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Recurso inválido');
  if (!value) return '';
  const extensions = kind === 'image' ? 'png|gif|jpg|webp' : 'mp3|wav|ogg';
  if (new RegExp('^/notification-assets/[a-f0-9]{64}\\.(' + extensions + ')$').test(value)) return value;
  try { const url = new URL(value); if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return url.href; } catch {}
  throw new Error('Usa un enlace HTTP/HTTPS directo o sube un archivo');
}
export function validateCommands(value) {
  if (!value || typeof value.enabled !== 'boolean' || !Array.isArray(value.commands) || value.commands.length > 100) throw new Error('Configura hasta 100 comandos');
  const names = new Set(['!comandos']), ids = new Set();
  return { enabled: value.enabled, commands: value.commands.map(row => {
    if (!row || typeof row.id !== 'string' || !/^[\w-]{1,80}$/.test(row.id) || ids.has(row.id)) throw new Error('Identificador de comando inválido');
    ids.add(row.id);
    const command = typeof row.command === 'string' ? row.command.trim() : '';
    if (!/^![\p{L}\p{N}_-]{1,40}$/u.test(command)) throw new Error('Escribe un comando como !Aatrox, sin espacios');
    if (names.has(command.toLowerCase())) throw new Error('No repitas el mismo comando');
    names.add(command.toLowerCase());
    const description = row.description ?? '';
    if (typeof description !== 'string' || description.length > 100 || /[\r\n]/.test(description)) throw new Error('La descripción debe tener hasta 100 caracteres en una sola línea');
    if (typeof row.enabled !== 'boolean' || typeof row.text !== 'string' || row.text.length > 200) throw new Error('Notificación inválida');
    if (!Number.isFinite(row.duration) || row.duration < 1 || row.duration > 120 || !Number.isFinite(row.volume) || row.volume < 0 || row.volume > 100) throw new Error('Duración: 1–120 segundos. Volumen: 0–100');
    const image = media(row.image, 'image'), audio = media(row.audio, 'audio'), text = row.text.trim();
    if (row.enabled && !image && !audio && !text) throw new Error('Añade un recurso o texto antes de activar ' + command);
    return { id: row.id, command, description: description.trim(), enabled: row.enabled, image, audio, text, duration: row.duration, volume: row.volume };
  }) };
}
