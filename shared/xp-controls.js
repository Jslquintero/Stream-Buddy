export function xpControlsBounds(element,width,height) {
  const innerWidth=Math.max(1,element.w*width/100-6),innerHeight=Math.max(1,element.h*height/100-3);
  const padding=Math.min(4,innerWidth/4,innerHeight/4);
  const scale=Math.min(element.xpControls?.scale??1,(innerWidth-2*padding)/69,(innerHeight-2*padding)/21);
  const rangeX=Math.max(0,innerWidth-2*padding-69*scale),rangeY=Math.max(0,innerHeight-2*padding-21*scale);
  return {padding,scale,rangeX,rangeY,left:padding+(element.xpControls?.x??1)*rangeX,top:padding+(element.xpControls?.y??0)*rangeY};
}
