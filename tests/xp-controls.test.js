import {test} from 'node:test';
import assert from 'node:assert/strict';
import {xpControlsBounds} from '../shared/xp-controls.js';
import {defaultLayout,validateLayout} from '../shared/layout.js';

test('XP control groups remain visible after window and canvas resizing',()=>{
  for(const [width,height] of [[1080,1920],[1920,1080],[240,240],[1440,2560]]){
    for(const w of [5,40,84])for(const position of [{x:1,y:0},{x:.3,y:.6,scale:2},{x:0,y:1,scale:4}]){
      const element={w,h:5,xpControls:position};
      const b=xpControlsBounds(element,width,height);
      assert.ok(b.left>=0&&b.top>=0);
      assert.ok(b.left+69*b.scale<=w*width/100-6+.00001);
      assert.ok(b.top+21*b.scale<=element.h*height/100-3+.00001);
    }
  }
});

test('XP control sizes persist and scale the whole group',()=>{
  const document=structuredClone(defaultLayout);
  const element=document.elements[0];
  element.xpControls={x:.3,y:.6,scale:2};
  assert.deepEqual(validateLayout(document).elements[0].xpControls,element.xpControls);
  assert.equal(xpControlsBounds(element,1080,1920).scale,2);
  for(const scale of [0,-1,0.49,4.01,'2',null,Infinity]){
    element.xpControls.scale=scale;
    assert.throws(()=>validateLayout(document),/controles XP/);
  }
});

test('XP group positions survive validation and reject invalid coordinates',()=>{
  const document=structuredClone(defaultLayout);
  document.elements[0].xpControls={x:.3,y:.6};
  assert.deepEqual(validateLayout(document).elements[0].xpControls,{x:.3,y:.6});
  for(const value of [null,{x:-1,y:0},{x:0,y:1.1},{x:0,y:'0'}]){
    document.elements[0].xpControls=value;
    assert.throws(()=>validateLayout(document),/controles XP/);
  }
});
