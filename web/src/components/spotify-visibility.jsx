import { ToggleRow } from './fields';
import { Select } from './ui';
export function SpotifyVisibilitySettings({draft,setDraft}) {
  const update=(key,value)=>setDraft(d=>({...d,[key]:value}));
  return <section className="spotify-customization">
    <hr/><h3>Visibilidad</h3>
    <ToggleRow label="Ocultar al pausar" checked={draft.hideWhenPaused} onCheckedChange={value => update('hideWhenPaused',value)}/>
    <label>Retraso al ocultar<Select disabled={!draft.hideWhenPaused} value={draft.hideDelay ?? 0} onChange={e=>update('hideDelay',Number(e.target.value))}>{[0,1,3,5,10,15,30,60].map(n=><option value={n} key={n}>{n===0?'Inmediatamente':`${n} segundos`}</option>)}</Select></label>
    <ToggleRow label="Mostrar solo al cambiar de canción" checked={draft.songChangeOnly ?? false} onCheckedChange={value => update('songChangeOnly',value)}/>
    <label>Duración visible<Select disabled={!draft.songChangeOnly} value={draft.visibleDuration ?? 5} onChange={e=>update('visibleDuration',Number(e.target.value))}>{[1,3,5,10,15,30,60].map(n=><option value={n} key={n}>{n} segundos</option>)}</Select></label>
    <p className="help">La salida aparece al recibir una canción y vuelve a mostrarse cuando cambia. Pausar y reanudar la misma canción no reinicia esa duración. La vista previa permanece visible para editar el diseño.</p>
    <hr/><h3>Otros</h3><ToggleRow label="Ocultar visualizador" checked={draft.hideVisualizer ?? false} onCheckedChange={value => update('hideVisualizer',value)}/>
    <p className="help">Oculta las barras animadas decorativas. Los tiempos y el progreso siguen visibles.</p>
  </section>;
}
