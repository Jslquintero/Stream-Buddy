const needsTikTok = new Set(['notifications', 'likes', 'gifters', 'auction', 'commands']);
const statusText = { idle: 'Sin iniciar', live: 'En vivo', ended: 'Cerrada' };

export function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('es') : '0';
}

export function relativeTime(timestamp, now = Date.now()) {
  if (!timestamp) return '';
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 10) return 'hace unos segundos';
  if (seconds < 60) return 'hace ' + seconds + ' s';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return 'hace ' + minutes + ' min';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return 'hace ' + hours + ' h';
  return 'hace ' + Math.floor(hours / 24) + ' d';
}

export function widgetStatus({ id, tool, state, online }) {
  if (!online) return { label: 'Sin conexión', tone: 'muted' };
  if (!tool) return { label: 'No cargado', tone: 'muted' };
  if (tool.error) return { label: 'Error', tone: 'danger' };

  if (id === 'layout' || id === 'ads') {
    if (tool.starting) return { label: 'Iniciando', tone: 'warn' };
    if (tool.available === false) return { label: 'No disponible', tone: 'muted' };
    if (!tool.running) return { label: 'Detenido', tone: 'muted' };
    return { label: 'En pantalla', tone: 'live' };
  }

  if (tool.config?.enabled === false) return { label: 'Oculto', tone: 'muted' };

  if (id === 'spotify') {
    if (tool.playback?.playing) return { label: 'Reproduciendo', tone: 'live' };
    if (tool.connected) return { label: 'Esperando reproducción', tone: 'warn' };
    return { label: 'Sin conectar', tone: 'warn' };
  }

  if (needsTikTok.has(id) && !state?.tts?.connected) return { label: 'Sin conectar', tone: 'warn' };

  return { label: 'En pantalla', tone: 'live' };
}

export function widgetSummary({ id, tool, state, now = Date.now() }) {
  if (!tool) return 'Esperando al servidor.';
  if (tool.error) return tool.error;

  if (id === 'layout') {
    const count = tool.compositions?.length || 0;
    return count + (count === 1 ? ' composición guardada' : ' composiciones guardadas') + (tool.running ? ' · salida abierta' : '');
  }

  if (id === 'ads') return tool.running ? 'Cola de anuncios abierta.' : 'AdQueue está detenido.';

  if (id === 'notifications') {
    const queued = Number(tool.queued) || 0;
    return queued + ' en cola' + (tool.current ? ' · mostrando una alerta' : ' · esperando eventos');
  }

  if (id === 'likes') {
    if (!tool.updatedAt) return 'Esperando likes.';
    return formatNumber(tool.participants) + ' usuarios · ' + formatNumber(tool.total) + ' likes · ' + relativeTime(tool.updatedAt, now);
  }

  if (id === 'gifters') {
    if (!tool.updatedAt) return 'Esperando regalos.';
    return formatNumber(tool.participants) + ' usuarios · ' + formatNumber(tool.totalGifts) + ' regalos · ' + formatNumber(tool.totalDiamonds) + ' ◆';
  }

  if (id === 'auction') {
    const round = tool.round > 0 ? ' · ronda ' + tool.round : '';
    const participants = Number(tool.participants) || 0;
    const remaining = tool.status === 'live' && tool.remainingMs > 0
      ? ' · quedan ' + Math.ceil(tool.remainingMs / 1000) + ' s'
      : '';
    return (statusText[tool.status] || 'Sin iniciar') + round + ' · ' + formatNumber(participants) + ' pujas' + remaining;
  }

  if (id === 'social') {
    const channels = (tool.config?.channels || []).filter(channel => channel?.enabled).length;
    const interval = Number(tool.config?.interval) || 6;
    return channels + (channels === 1 ? ' red' : ' redes') + ' · cambia cada ' + interval + ' s';
  }

  if (id === 'commands') {
    const enabled = (tool.config?.commands || []).filter(command => command?.enabled).length;
    return formatNumber(enabled) + (enabled === 1 ? ' comando activo' : ' comandos activos') + (tool.visual ? ' · mostrando uno' : '');
  }

  if (id === 'spotify') {
    if (tool.playback) return [tool.playback.title, tool.playback.artist].filter(Boolean).join(' — ');
    if (tool.config?.enabled === false) return 'Lectura de música desactivada.';
    return tool.connected ? 'Sin reproducción ahora mismo.' : 'Abre Spotify o AIMP para empezar.';
  }

  return '';
}

export function visibleCount(widgets, tools) {
  return widgets.filter(({ id }) => {
    const tool = tools?.[id];
    if (!tool) return false;
    if (id === 'layout' || id === 'ads') return !!tool.running;
    return tool.config?.enabled !== false;
  }).length;
}

export function lastActivityAt(tools) {
  return Math.max(0, ...['likes', 'gifters', 'auction'].map(id => Number(tools?.[id]?.updatedAt) || 0));
}
