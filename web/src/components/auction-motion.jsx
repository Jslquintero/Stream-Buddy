import {useEffect,useLayoutEffect,useRef,useState} from 'react';
const reduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function AuctionAmount({value}){
  const [shown,setShown]=useState(value),current=useRef(value),previous=useRef(value),[gain,setGain]=useState(null);
  useEffect(()=>{
    const from=current.current,difference=value-previous.current;previous.current=value;
    setGain(difference>0?difference:null);
    if(reduced()||value<from){current.current=value;setShown(value);setGain(null);return;}
    let frame,start;
    const tick=time=>{start??=time;const progress=Math.min(1,(time-start)/700);current.current=Math.round(from+(value-from)*(1-(1-progress)**3));setShown(current.current);if(progress<1)frame=requestAnimationFrame(tick);};
    frame=requestAnimationFrame(tick);const timer=setTimeout(()=>setGain(null),1200);
    return()=>{cancelAnimationFrame(frame);clearTimeout(timer);};
  },[value]);
  return <span className="auction-counter"><span>{Number(shown).toLocaleString('es')}</span>{gain&&<small key={value} className="auction-gain" aria-hidden="true">+{gain.toLocaleString('es')}</small>}</span>;
}

export function useAuctionClock(status,endsAt){
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{
    if(status!=='live'||!endsAt)return;
    const timer=setInterval(()=>setNow(Date.now()),1000);
    return()=>clearInterval(timer);
  },[status,endsAt]);
  if(status!=='live')return {label:status==='ended'?'Cerrada':'—',over:false};
  if(!endsAt)return {label:'∞',over:false};
  const remaining=Math.max(0,endsAt-now),seconds=Math.ceil(remaining/1000),minutes=Math.floor(seconds/60);
  return {label:minutes+':'+String(seconds%60).padStart(2,'0'),over:remaining<=0};
}

export function useAuctionMotion(signature){
  const list=useRef(null),positions=useRef(new Map()),animations=useRef(new Map());
  useLayoutEffect(()=>{
    const next=new Map();
    for(const row of list.current?.children||[]){
      const id=row.dataset.userId,top=row.offsetTop,old=positions.current.get(id);
      const transform=getComputedStyle(row).transform;
      let offset=0;
      if(transform&&transform!=='none'&&window.DOMMatrixReadOnly)offset=new DOMMatrixReadOnly(transform).m42;
      animations.current.get(id)?.cancel();
      if(row.animate&&!reduced()){
        const delta=old==null?0:old+offset-top;
        if(delta)animations.current.set(id,row.animate([{transform:`translateY(${delta}px)`},{transform:'translateY(0)'}],{duration:600,easing:'cubic-bezier(.22,1,.36,1)'}));
        else if(old==null)animations.current.set(id,row.animate([{opacity:0,transform:'translateX(-16px)'},{opacity:1,transform:'translateX(0)'}],{duration:400}));
      }
      next.set(id,top);
    }
    for(const [id,animation] of animations.current)if(!next.has(id)){animation.cancel();animations.current.delete(id);}
    positions.current=next;
  },[signature]);
  useEffect(()=>()=>{for(const animation of animations.current.values())animation.cancel();positions.current.clear();animations.current.clear();},[]);
  return list;
}

export function useAuctionDemo(active,initial){
  const [rows,setRows]=useState(initial);
  useEffect(()=>{
    setRows(initial);if(!active)return;
    let step=0;
    const timer=setInterval(()=>{
      setRows(previous=>{
        const sorted=[...previous].sort((a,b)=>b.diamonds-a.diamonds);
        const target=step++%3===2?sorted[sorted.length-1]:sorted[1];
        const boost=Math.max(120,sorted[0].diamonds-target.diamonds+180);
        return sorted.map(row=>row.id===target.id?{...row,diamonds:row.diamonds+boost,gifts:row.gifts+1}:row).sort((a,b)=>b.diamonds-a.diamonds);
      });
    },2200);
    return()=>clearInterval(timer);
  },[active,initial]);
  return rows;
}
