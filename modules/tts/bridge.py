"""Optional TikTok connector. stdout is a JSON-lines protocol, never a shell command."""
import asyncio
import json
import sys
import logging
import os
from pathlib import Path
from datetime import datetime

LOG = Path(os.environ['STUDIO_BRIDGE_LOG']) if 'STUDIO_BRIDGE_LOG' in os.environ else Path(__file__).resolve().parent / 'runtime' / 'bridge-events.jsonl'


def emit(kind, **data):
    record = dict(kind=kind, **data)
    print(json.dumps(record, ensure_ascii=True), flush=True)
    if kind not in ('comment', 'like'):
        try:
            LOG.parent.mkdir(exist_ok=True)
            if LOG.exists() and LOG.stat().st_size > 100_000:
                LOG.write_text('', encoding='utf-8')
            with LOG.open('a', encoding='utf-8') as output:
                output.write(json.dumps(dict(time=datetime.now().isoformat(), **record), ensure_ascii=True) + '\n')
        except OSError:
            pass


async def run_session(client, timeout=45):
    # start() returns a running Task; keep the event loop alive until it finishes.
    task = await asyncio.wait_for(client.start(), timeout=timeout)
    await task


def comment_data(event):
    user = getattr(event, 'user', None)
    identity = None
    if user is not None:
        identity = (getattr(user, 'unique_id', None) or getattr(user, 'display_id', None)
                    or getattr(user, 'id', None) or getattr(user, 'nickname', None))
    text = getattr(event, 'content', None) or getattr(event, 'comment', None)
    if not isinstance(text, str) or not text.strip():
        raise ValueError('TikTok envio un comentario sin texto legible.')
    return dict(user=str(identity or 'usuario'), text=text)


def avatar_url(user):
    for field in ('avatar_thumb', 'avatar_medium', 'avatar_large'):
        image = getattr(user, field, None)
        for url in getattr(image, 'url_list', None) or []:
            if isinstance(url, str) and url.startswith(('https://', 'http://')):
                return url
    return ''


def alert_user(event):
    candidates = [getattr(event, 'user', None)]
    # Barrage-based SuperFan events carry the viewer in a formatted text piece.
    for content in (getattr(event, 'content', None), getattr(event, 'common_barrage_content', None)):
        for piece in getattr(content, 'pieces', None) or []:
            candidates.append(getattr(getattr(piece, 'user_value', None), 'user', None))
    for user in candidates:
        identity = (getattr(user, 'nickname', None) or getattr(user, 'unique_id', None)
                    or getattr(user, 'display_id', None))
        if identity:
            return str(identity)[:80]
    return 'usuario'


class BridgeLogHandler(logging.Handler):
    def emit(self, record):
        if record.levelno >= logging.WARNING:
            emit('diagnostic', text='Aviso del conector: ' + record.getMessage()[:700])


def explain_error(exc):
    name = type(exc).__name__
    if isinstance(exc, TimeoutError):
        return 'TikTok no completo la conexion en 45 segundos. Intenta de nuevo y revisa si el LIVE abre en el navegador.'
    if name == 'UserOfflineError':
        return 'TikTok no detecta un LIVE activo para ese usuario. Comprueba el @ y que el directo sea publico.'
    if name == 'UserNotFoundError':
        return 'No se pudo localizar el usuario. Comprueba el @ exacto; TikTok tambien puede estar bloqueando la consulta.'
    if name in ('ConnectError', 'ProxyError', 'ConnectTimeout'):
        return 'No se pudo alcanzar TikTok o el servicio de conexion. Revisa la red, VPN o proxy.'
    if 'RateLimit' in name:
        return 'El servicio de firma limito los intentos. Espera antes de volver a conectar.'
    if 'Sign' in name or 'Premium' in name:
        return 'Fallo el servicio externo de firma de TikTok. Revisa el detalle tecnico en Actividad.'
    if 'Restricted' in name:
        return 'El LIVE tiene una restriccion que impide el acceso del conector.'
    return 'No se pudo conectar al LIVE. Revisa el detalle tecnico en Actividad.'


async def main():
    try:
        from TikTokLive import TikTokLiveClient
        from TikTokLive.events import CommentEvent, ConnectEvent, DisconnectEvent, WebsocketResponseEvent, FollowEvent, GiftEvent, ShareEvent, LikeEvent
        if sys.argv[1:] == ['--self-test']:
            from TikTokLive.events import SuperFanEvent
            TikTokLiveClient(unique_id='streambuddy')
            return
        client = TikTokLiveClient(unique_id=sys.argv[1])
        client.logger.addHandler(BridgeLogHandler())
        stats = dict(events=0, comments=0, connected=False)
        loop = asyncio.get_running_loop()
        loop.set_exception_handler(lambda _loop, context: emit(
            'diagnostic', text='Error procesando eventos del chat: ' +
            str(context.get('exception') or context.get('message'))[:700]))

        @client.on(ConnectEvent)
        async def connected(event):
            stats['connected'] = True
            emit('status', text=f'Conectado al directo @{event.unique_id} (sala {event.room_id})')

        @client.on(DisconnectEvent)
        async def disconnected(event):
            stats['connected'] = False
            emit('status', text='Desconectado del directo')

        @client.on(WebsocketResponseEvent)
        def traffic(event):
            stats['events'] += 1

        @client.on(CommentEvent)
        async def comment(event):
            try:
                data = comment_data(event)
                stats['comments'] += 1
                emit('comment', **data)
            except Exception as exc:
                emit('diagnostic', text=f'No se pudo leer un comentario: {type(exc).__name__}: {exc}')

        try:
            from TikTokLive.events import SuperFanEvent
        except ImportError:
            emit('diagnostic', text='Actualiza el conector desde Preparar para recibir alertas Super Fan (TikTokLive 6.6.6 o superior).')
        else:
            @client.on(SuperFanEvent)
            async def superfan(event):
                emit('superfan', user=alert_user(event))

        @client.on(FollowEvent)
        async def followed(event):
            emit('follow', user=alert_user(event))

        @client.on(ShareEvent)
        async def shared(event):
            emit('share', user=alert_user(event))

        @client.on(LikeEvent)
        async def liked(event):
            user = getattr(event, 'user', None)
            identity = getattr(user, 'id', None) or getattr(user, 'unique_id', None)
            count = getattr(event, 'count', 0)
            if identity and isinstance(count, int) and count > 0:
                message_id = getattr(getattr(event, 'common', None), 'msg_id', None)
                emit('like', userId=str(identity), user=alert_user(event), count=count, avatar=avatar_url(user),
                     messageId=str(message_id) if message_id else '')

        @client.on(GiftEvent)
        async def gifted(event):
            if getattr(event, 'streaking', False):
                return
            user = getattr(event, 'user', None)
            identity = getattr(user, 'id', None) or getattr(user, 'unique_id', None)
            gift = getattr(event, 'gift', None)
            count = max(1, int(getattr(event, 'repeat_count', 1) or 1))
            diamonds = max(0, int(getattr(gift, 'diamond_count', 0) or 0)) * count
            emit('gift', userId=str(identity) if identity else '', user=alert_user(event),
                 avatar=avatar_url(user), gift=str(getattr(gift, 'name', None) or 'Regalo')[:80],
                 count=count, diamonds=diamonds)

        async def monitor():
            while True:
                await asyncio.sleep(15)
                if stats['connected']:
                    emit('metrics', text=f"Eventos recibidos: {stats['events']} | Comentarios recibidos: {stats['comments']}",
                         events=stats['events'], comments=stats['comments'])

        emit('status', text='Conectando a TikTok...')
        monitor_task = asyncio.create_task(monitor())
        try:
            await run_session(client)
        finally:
            monitor_task.cancel()
        emit('status', text='La conexion al LIVE ha terminado. Puedes volver a conectar.')
    except Exception as exc:
        emit('error', text=explain_error(exc), detail=f'{type(exc).__name__}: {exc}')
        sys.exit(1)


if __name__ == '__main__':
    asyncio.run(main())
