import { FilePicker } from './ui/file-picker';
import { useState } from 'react';
import { ImagePlus, ArrowLeft, ArrowRight, Trash2 } from 'lucide-react';
import { Button, Select, Input } from './ui';
import { createIcon, iconStyles } from '../../../shared/layout';
import { readIconImage } from '../lib/layout-image';

export function IconRow({ row, theme, selectedIcon, onSelect }) {
  return <div className="icon-row-content" style={{gap:row.gap,justifyContent:{start:'flex-start',center:'center',end:'flex-end'}[row.align]}}>
    {row.icons.map(icon=>{
      const style=icon.style==='theme'?theme:icon.style;
      return <div key={icon.id} data-icon-id={icon.id} className={`row-shortcut shortcut-style-${style} ${onSelect&&selectedIcon===icon.id?'icon-selected':''}`} style={{width:Math.max(icon.size,row.fontSize*4),fontSize:row.fontSize,flexDirection:icon.labelPosition==='top'?'column-reverse':'column'}} role={onSelect?'button':undefined} tabIndex={onSelect?0:undefined} aria-label={onSelect?'Editar icono '+icon.name:undefined} onClick={onSelect?()=>onSelect(icon.id):undefined} onKeyDown={onSelect?event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();onSelect(icon.id);}}:undefined}>
        <span className="row-icon-picture" style={{width:icon.size,height:icon.size}}>{icon.image?<img src={icon.image} alt="" draggable={false}/>:<span className="row-icon-placeholder"><ImagePlus/></span>}{style==='xp'&&<span className="row-shortcut-arrow" style={{fontSize:icon.size*.24}} aria-hidden="true">↗</span>}</span>
        <span className="row-icon-name">{icon.name}</span>
      </div>;
    })}
  </div>;
}

export function IconRowEditor({ row, selectedIcon, selectIcon, updateRow, updateIcon, notice, imageTask, format, canvasWidth, canvasHeight }) {
  const [loading,setLoading]=useState(false);
  const icon=row.icons.find(i=>i.id===selectedIcon)||row.icons[0],index=row.icons.indexOf(icon);
  const patch=value=>updateIcon(row.id,icon.id,value);
  const upload=async file => {
    const id=icon.id,rowId=row.id;setLoading(true);imageTask(1);
    try{const image=await readIconImage(file);updateIcon(rowId,id,{image});}
    catch(error){notice(error.message);}finally{setLoading(false);imageTask(-1);}
  };
  const number=(label,value,min,max,onChange)=><label>{label}<Input type="number" min={min} max={max} value={value} onChange={e=>{const next=Number(e.target.value);if(Number.isFinite(next))onChange(Math.min(max,Math.max(min,next)));}}/></label>;
  const reorder=direction=>{const icons=[...row.icons],next=index+direction;[icons[index],icons[next]]=[icons[next],icons[index]];updateRow({icons});};
  const neededWidth=row.icons.reduce((sum,i)=>sum+Math.max(i.size,row.fontSize*4),0)+(row.icons.length-1)*row.gap+16;
  const neededHeight=Math.max(...row.icons.map(i=>i.size))+row.fontSize*2.4+24;
  const fits=neededWidth<=row.w*(canvasWidth ?? (format==='portrait'?1080:1920))/100&&neededHeight<=row.h*(canvasHeight ?? (format==='portrait'?1920:1080))/100;
  return <section className="icon-row-editor"><h4>Iconos de la fila · {row.icons.length}/12</h4>
    <div className="icon-picker">{row.icons.map((item,i)=><button key={item.id} aria-pressed={icon.id===item.id} onClick={()=>selectIcon(item.id)} title={item.name}>{item.image?<img src={item.image} alt=""/>:<ImagePlus size={16}/>}<span>{i+1}. {item.name}</span></button>)}</div>
    <Button size="sm" variant="outline" disabled={row.icons.length>=12} onClick={()=>{const next=createIcon(crypto.randomUUID(),row.icons.length+1);updateRow({icons:[...row.icons,next]});selectIcon(next.id);}}>+ Añadir icono</Button>
    <label>Nombre del icono<Input maxLength={60} value={icon.name} onChange={e=>patch({name:e.target.value})}/></label>
    <FilePicker label={loading?'Preparando icono…':'Imagen del icono'} accept="image/png,image/jpeg,image/webp" disabled={loading} onFile={upload}/>
    <p className="help">PNG, JPG o WebP. Cada icono conserva su propia imagen y ajustes.</p>
    {icon.image&&<Button size="sm" variant="outline" onClick={()=>patch({image:''})} disabled={loading}>Quitar imagen del icono</Button>}
    {number('Tamaño del icono (px)',icon.size,16,256,size=>patch({size}))}
    <label>Posición del texto<Select value={icon.labelPosition} onChange={e=>patch({labelPosition:e.target.value})}><option value="top">Encima de la imagen</option><option value="bottom">Debajo de la imagen</option></Select></label>
    <label>Estilo del icono<Select value={icon.style} onChange={e=>patch({style:e.target.value})}>{Object.entries(iconStyles).map(([id,name])=><option key={id} value={id}>{name}</option>)}</Select></label>
    <div className="actions"><Button size="icon" variant="outline" aria-label="Mover icono a la izquierda" disabled={index===0} onClick={()=>reorder(-1)}><ArrowLeft size={14}/></Button><Button size="icon" variant="outline" aria-label="Mover icono a la derecha" disabled={index===row.icons.length-1} onClick={()=>reorder(1)}><ArrowRight size={14}/></Button><Button size="sm" variant="destructive" disabled={row.icons.length===1} onClick={()=>{updateRow({icons:row.icons.filter(i=>i.id!==icon.id)});selectIcon(null);}}><Trash2 size={14}/>Eliminar icono</Button></div>
    {number('Espacio entre iconos (px)',row.gap,0,120,gap=>updateRow({gap}))}
    <label>Alineación de la fila<Select value={row.align} onChange={e=>updateRow({align:e.target.value})}><option value="start">Izquierda</option><option value="center">Centro</option><option value="end">Derecha</option></Select></label>
    {!fits&&<p className="help icon-fit-warning">La fila puede recortar contenido. Amplía su ancho/alto o reduce el tamaño y el espacio entre iconos.</p>}
  </section>;
}
