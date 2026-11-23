import { messengerCameraKind, messengerCameraDimensions, messengerCameraMinSide, messengerCameraMaxSide } from '../../../shared/layout.js';

const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

// Pointer deltas are logical canvas pixels, independent of preview zoom.
export function gridTransform(element,dx,dy,width,height,{resize=false,step=8,snap=true,lockAxis=false}={}) {
  if(lockAxis&&!resize){if(Math.abs(dx)>=Math.abs(dy))dy=0;else dx=0;}
  const quantize=value=>snap?Math.round(value/step)*step:value;
  if(resize&&element.kind===messengerCameraKind){
    const delta=Math.abs(dx)>=Math.abs(dy)?dx:dy;
    const min=messengerCameraMinSide(width,height);
    const max=messengerCameraMaxSide(element,width,height);
    const side=Math.max(min,Math.min(max,quantize(element.w*width/100+delta)));
    return messengerCameraDimensions(side,width,height);
  }
  const axis=(key,delta,size,min,max)=>{
    // Keep the untouched axis in place, even if it was initially off the grid.
    if(delta===0)return element[key];
    return clamp(quantize(element[key]*size/100+delta)*100/size,min,max);
  };
  return resize
    ? {w:axis('w',dx,width,5,100-element.x),h:axis('h',dy,height,element.kind==='taskbar'?1:5,100-element.y)}
    : {x:axis('x',dx,width,0,Math.min(99,100-element.w)),y:axis('y',dy,height,0,Math.min(99,100-element.h))};
}
