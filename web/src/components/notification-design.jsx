import { Field, Toggle } from './fields';
import { Input, Button } from './ui';
import { resizeNotification } from '../../../modules/notifications/size';
import { notificationAnimations } from '../../../modules/notifications/config';
import { systemFonts, NotificationFonts } from './notification-fonts';
export function NotificationDesign({ design, update, resize, fonts, api, online }) {
  const select = (key,label,options) => <Field key={key} label={label}>{id => <select className="input" id={id} value={design[key]} onChange={e => update(key,e.target.value)}>{options.map(([value,text]) => <option key={value} value={value}>{text}</option>)}</select>}</Field>;
  return <>
    <Field label="Tamaño general de la alerta">{()=><div className="actions"><Button variant="outline" onClick={()=>resize(resizeNotification(design,.8))}>Reducir 20%</Button><Button variant="outline" onClick={()=>resize(resizeNotification(design,1.25))}>Ampliar 25%</Button></div>}</Field>
    <p className="help">Amplía el texto, la imagen y el contenedor juntos. Ancho actual: {design.width} px. Los cambios se guardan automáticamente.</p>
    {select('layout','Distribución',[['left','Imagen a la izquierda'],['right','Imagen a la derecha'],['top','Imagen arriba'],['bottom','Imagen abajo'],['image-only','Solo imagen o GIF']])}
    <div className="form-row">{[['background','Fondo'],['color','Texto'],['accent','Acento']].map(([key,label]) => <Field key={key} label={label}>{id => <Input id={id} type="color" value={design[key]} onChange={e => update(key,e.target.value)}/>}</Field>)}</div>
    <div className="form-row">{[['duration','Duración · segundos',2,30],['fontSize','Tamaño de texto · px',16,96],['width','Ancho de la alerta · px',200,1200],['padding','Espaciado interior · px',0,80],['imageSize','Tamaño de imagen · px',32,400],['imageRadius','Bordes de imagen · px',0,200],['backgroundOpacity','Opacidad del fondo · %',0,100],['borderWidth','Grosor del borde · px',0,12],['radius','Bordes redondeados · px',0,80]].map(([key,label,min,max]) => <Field key={key} label={label}>{id => <Input id={id} type="number" min={min} max={max} required value={design[key]} onChange={e => update(key,e.target.value === '' ? '' : Number(e.target.value))}/>}</Field>)}</div>
    {select('imageFit','Ajuste de imagen',[['contain','Mostrar completa'],['cover','Rellenar y recortar']])}
    <Toggle name="transparent" label="Borde transparente" settings={{transparent:design.borderOpacity===0}} update={(_,value)=>update('borderOpacity',value?0:100)}/>
    <Field label="Opacidad del borde · %">{id=><Input id={id} type="number" min="0" max="100" value={design.borderOpacity??100} onChange={e=>update('borderOpacity',Number(e.target.value))}/>}</Field>
    <div className="form-row">{select('fontFamily','Tipografía',[...systemFonts,...(fonts?.items||[]).map(font=>['google:'+font.id,font.name+' · instalada']),...(/^google:/.test(design.fontFamily)&&!(fonts?.items||[]).some(f=>'google:'+f.id===design.fontFamily)?[[design.fontFamily,'Fuente de Google seleccionada']]:[])])}{select('fontWeight','Grosor del título',[['400','Normal'],['600','Seminegrita'],['700','Negrita'],['900','Muy gruesa']])}</div>
    <NotificationFonts fonts={fonts} api={api} online={online} select={value=>update('fontFamily',value)}/>
    {select('textAlign','Alineación de texto',[['left','Izquierda'],['center','Centro'],['right','Derecha']])}
    {select('position','Posición',[['top-left','Arriba · izquierda'],['top-center','Arriba · centro'],['top-right','Arriba · derecha'],['bottom-left','Abajo · izquierda'],['bottom-center','Abajo · centro'],['bottom-right','Abajo · derecha']])}
    {select('animation','Animación de entrada',Object.entries(notificationAnimations))}
    <Field label="Duración de la animación · milisegundos">{id=><Input id={id} type="number" min="100" max="2000" step="50" value={design.animationSpeed??500} onChange={e=>update('animationSpeed',Number(e.target.value))}/>}</Field>
    <Toggle name="shadow" label="Sombra de la alerta" settings={design} update={update}/>
  </>;
}
