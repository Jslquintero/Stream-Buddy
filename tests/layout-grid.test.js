import {test} from 'node:test';
import assert from 'node:assert/strict';
import {gridTransform} from '../web/src/lib/layout-grid.js';

test('grid snaps logical pixels, preserves untouched axes and supports fine adjustments',()=>{
  const e={x:5,y:5,w:40,h:25,kind:'frame'};
  const moved=gridTransform(e,15,0,1080,1920);
  assert.equal(moved.x*1080/100,72);
  assert.equal(moved.y,5);
  const free=gridTransform(e,15,0,1080,1920,{snap:false});
  assert.equal(free.x*1080/100,69);
  const locked=gridTransform(e,15,5,1080,1920,{lockAxis:true});
  assert.deepEqual(locked,moved);
  const fine=gridTransform(e,1,0,1440,1440,{snap:false});
  assert.equal(fine.x*1440/100,73);
});

test('grid resizing and movement respect canvas bounds at custom resolutions',()=>{
  const e={x:60,y:50,w:40,h:25,kind:'frame'};
  assert.deepEqual(gridTransform(e,5000,-5000,1440,2560),{x:60,y:0});
  assert.deepEqual(gridTransform(e,5000,-5000,1440,2560,{resize:true}),{w:40,h:5});
  const resized=gridTransform({...e,x:0},17,17,1440,2560,{resize:true,step:16});
  assert.ok(Math.abs(resized.w*1440/100-592)<1e-8);
  assert.equal(resized.h*2560/100,656);
});
