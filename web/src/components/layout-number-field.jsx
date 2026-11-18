import { useEffect, useRef, useState } from 'react';

const display=value=>String(Math.round(value*100)/100);

export function LayoutNumberField({ label, value, min, max, onChange }) {
  const [text,setText]=useState(display(value)),editing=useRef(false);
  useEffect(()=>{if(!editing.current)setText(display(value));},[value]);
  const commit=()=>{
    editing.current=false;
    const number=Number(text);
    if(text.trim()===''||!Number.isFinite(number)){setText(display(value));return;}
    const next=Math.min(max,Math.max(min,number));setText(display(next));
    if(Math.abs(next-value)>.00001)onChange(next);
  };
  return <label>{label}<input className="input" type="number" aria-label={label} min={min} max={max} step="any" value={text} onFocus={()=>{editing.current=true;}} onBlur={commit} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();event.currentTarget.blur();}}} onChange={event=>{
    const next=event.target.value;setText(next);
    const number=Number(next);
    if(next.trim()!==''&&Number.isFinite(number)&&number>=min&&number<=max&&Math.abs(number-value)>.00001)onChange(number);
  }}/></label>;
}
