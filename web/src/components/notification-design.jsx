import { Field, NumberSettings, OverlayColors, Toggle } from './fields';
import { Input, Button, Select } from './ui';
import { resizeNotification } from '../../../modules/notifications/size';
import { notificationAnimations } from '../../../modules/notifications/config';
import { systemFonts, NotificationFonts } from './notification-fonts';

export function NotificationDesign({ design, update, resize, fonts, api, online }) {
  const select = (key,label,options) => <Field key={key} label={label}>{id => <Select id={id} value={design[key]} onChange={e => update(key,e.target.value)}>{options.map(([value,text]) => <option key={value} value={value}>{text}</option>)}</Select>}</Field>;
  return <>
    <section className="notification-design-group">
      <div className="notification-form-heading">
        <div><h4>Estructura</h4><p className="help">Posición, distribución y movimiento de entrada.</p></div>
      </div>
      <div className="notification-design-grid">
        {select('layout','Distribución',[['left','Imagen a la izquierda'],['right','Imagen a la derecha'],['top','Imagen arriba'],['bottom','Imagen abajo'],['image-only','Solo imagen o GIF']])}
        {select('position','Posición',[['top-left','Arriba · izquierda'],['top-center','Arriba · centro'],['top-right','Arriba · derecha'],['bottom-left','Abajo · izquierda'],['bottom-center','Abajo · centro'],['bottom-right','Abajo · derecha']])}
        {select('animation','Animación de entrada',Object.entries(notificationAnimations))}
        <Field label="Duración · segundos">{id => <Input id={id} type="number" min="2" max="30" required value={design.duration} onChange={e => update('duration',e.target.value === '' ? '' : Number(e.target.value))}/>}</Field>
        <Field label="Duración de la animación · milisegundos">{id=><Input id={id} type="number" min="100" max="2000" step="50" value={design.animationSpeed??500} onChange={e=>update('animationSpeed',Number(e.target.value))}/>}</Field>
      </div>
    </section>
    <section className="notification-design-group">
      <div className="notification-form-heading">
        <div><h4>Colores</h4><p className="help">Fondo, texto y acento de la alerta.</p></div>
      </div>
      <OverlayColors settings={design} update={update}/>
    </section>
    <details className="notification-design-section notification-design-group" name="notification-design">
      <summary><span>Tamaño y bordes</span><span className="help">Ancho, imagen, opacidad y sombra</span></summary>
      <div className="notification-size-actions">
        <div><strong>Tamaño general de la alerta</strong><p className="help">Ajusta el conjunto sin cambiar cada valor.</p></div>
        <div className="actions"><Button variant="outline" size="sm" onClick={()=>resize(resizeNotification(design,.8))}>Reducir 20%</Button><Button variant="outline" size="sm" onClick={()=>resize(resizeNotification(design,1.25))}>Ampliar 25%</Button></div>
      </div>
      <div className="notification-design-grid">
        <NumberSettings fields={[['width','Ancho de la alerta · px',200,1200],['padding','Espaciado interior · px',0,80],['imageSize','Tamaño de imagen · px',32,400],['imageRadius','Bordes de imagen · px',0,200],['backgroundOpacity','Opacidad del fondo · %',0,100],['borderWidth','Grosor del borde · px',0,12],['radius','Bordes redondeados · px',0,80]]} settings={design} update={update} required/>
        {select('imageFit','Ajuste de imagen',[['contain','Mostrar completa'],['cover','Rellenar y recortar']])}
        <Toggle name="transparent" label="Borde transparente" settings={{transparent:design.borderOpacity===0}} update={(_,value)=>update('borderOpacity',value?0:100)}/>
        <Field label="Opacidad del borde · %">{id=><Input id={id} type="number" min="0" max="100" value={design.borderOpacity??100} onChange={e=>update('borderOpacity',Number(e.target.value))}/>}</Field>
        <Toggle name="shadow" label="Sombra de la alerta" settings={design} update={update}/>
      </div>
    </details>
    <details className="notification-design-section notification-design-group" name="notification-design">
      <summary><span>Texto y tipografía</span><span className="help">Fuente, tamaño y alineación</span></summary>
      <div className="notification-design-grid">
        {select('fontFamily','Tipografía',[...systemFonts,...(fonts?.items||[]).map(font=>['google:'+font.id,font.name+' · instalada']),...(/^google:/.test(design.fontFamily)&&!(fonts?.items||[]).some(f=>'google:'+f.id===design.fontFamily)?[[design.fontFamily,'Fuente de Google seleccionada']]:[])])}
        {select('fontWeight','Grosor del título',[['400','Normal'],['600','Seminegrita'],['700','Negrita'],['900','Muy gruesa']])}
        <Field label="Tamaño de texto · px">{id => <Input id={id} type="number" min="16" max="96" required value={design.fontSize} onChange={e => update('fontSize',e.target.value === '' ? '' : Number(e.target.value))}/>}</Field>
        {select('textAlign','Alineación de texto',[['left','Izquierda'],['center','Centro'],['right','Derecha']])}
        <Toggle name="textShadow" label="Sombra del texto" settings={design} update={update}/>
        <NotificationFonts fonts={fonts} api={api} online={online} select={value=>update('fontFamily',value)}/>
      </div>
    </details>
  </>;
}
