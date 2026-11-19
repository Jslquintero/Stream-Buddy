"""Exercise the connector's registered handlers without a TikTok account."""
import asyncio
import importlib.util
from pathlib import Path
import sys
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import patch


class NotificationBridgeTest(unittest.TestCase):
    def test_social_events_and_final_gift_streak(self):
        spec = importlib.util.spec_from_file_location('notification_bridge', Path(__file__).resolve().parents[1] / 'modules/tts/bridge.py')
        bridge = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(bridge)
        records = []
        bridge.emit = lambda kind, **data: records.append(dict(kind=kind, **data))
        events = ModuleType('TikTokLive.events')
        for name in ['CommentEvent', 'ConnectEvent', 'DisconnectEvent', 'WebsocketResponseEvent', 'FollowEvent', 'GiftEvent', 'ShareEvent', 'SuperFanEvent', 'LikeEvent']:
            setattr(events, name, type(name, (), {}))

        class Client:
            def __init__(self, **kwargs):
                self.handlers = {}
                self.logger = SimpleNamespace(addHandler=lambda _: None)

            def on(self, event):
                def register(handler):
                    self.handlers[event.__name__] = handler
                    return handler
                return register

            async def start(self):
                async def playback():
                    user = SimpleNamespace(nickname='Ana', unique_id='ana', avatar_thumb=SimpleNamespace(url_list=['https://example.com/ana.jpg']))
                    await self.handlers['LikeEvent'](SimpleNamespace(user=user,count=7,total=9999,common=SimpleNamespace(msg_id=123)))
                    await self.handlers['FollowEvent'](SimpleNamespace(user=user))
                    await self.handlers['ShareEvent'](SimpleNamespace(user=user))
                    for field in ('content', 'common_barrage_content'):
                        content = SimpleNamespace(pieces=[SimpleNamespace(user_value=SimpleNamespace(user=user))])
                        await self.handlers['SuperFanEvent'](SimpleNamespace(**{field: content}))
                    for streaking, count in [(True, 1), (True, 2), (False, 3)]:
                        await self.handlers['GiftEvent'](SimpleNamespace(user=user, gift=SimpleNamespace(name='Rosa'), streaking=streaking, repeat_count=count))
                    await self.handlers['GiftEvent'](SimpleNamespace(user=user, gift=SimpleNamespace(name='Corazón'), streaking=False, repeat_count=1))
                return asyncio.create_task(playback())

        package = ModuleType('TikTokLive')
        package.TikTokLiveClient = Client
        with patch.dict(sys.modules, {'TikTokLive': package, 'TikTokLive.events': events}), patch.object(sys, 'argv', ['bridge.py', 'test']):
            asyncio.run(bridge.main())
        alerts = [record for record in records if record['kind'] in ('follow', 'share', 'gift', 'superfan')]
        self.assertEqual([record for record in records if record['kind']=='like'],[dict(kind='like',userId='ana',user='Ana',count=7,messageId='123',avatar='https://example.com/ana.jpg')])
        self.assertEqual([record['kind'] for record in alerts], ['follow', 'share', 'superfan', 'superfan', 'gift', 'gift'])
        self.assertEqual(alerts[2], dict(kind='superfan', user='Ana'))
        self.assertEqual(alerts[3], dict(kind='superfan', user='Ana'))
        self.assertEqual(alerts[4], dict(kind='gift', user='Ana', gift='Rosa', count=3))


if __name__ == '__main__':
    unittest.main()
