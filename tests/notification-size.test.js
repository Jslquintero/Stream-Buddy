import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resizeNotification} from '../modules/notifications/size.js';
import {defaultNotifications,validateNotifications} from '../modules/notifications/config.js';
test('alert resizing enlarges text and media together while respecting all saved limits',()=>{
  const enlarged={...defaultNotifications,...resizeNotification(defaultNotifications,1.75)};
  assert.equal(enlarged.width,1190);assert.equal(enlarged.fontSize,49);assert.equal(enlarged.imageSize,168);
  assert.doesNotThrow(()=>validateNotifications(enlarged));
  assert.doesNotThrow(()=>validateNotifications({...enlarged,...resizeNotification(enlarged,100)}));
  assert.doesNotThrow(()=>validateNotifications({...enlarged,...resizeNotification(enlarged,.001)}));
  assert.equal(resizeNotification({...defaultNotifications,borderWidth:0},1.25).borderWidth,0);
});
