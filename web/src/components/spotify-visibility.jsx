export function SpotifyVisibilitySettings({draft,setDraft}) {
  const update=(key,value)=>setDraft(d=>({...d,[key]:value}));
  return <section className="spotify-customization">
    <hr/><h3>Visibilidad</h3>
    <label className="spotify-toggle">Ocultar al pausar<input type="checkbox" role="switch" checked={draft.hideWhenPaused} onChange={e=>update('hideWhenPaused',e.target.checked)}/></label>
    <label>Retraso al ocultar<select className="input" disabled={!draft.hideWhenPaused} value={draft.hideDelay ?? 0} onChange={e=>update('hideDelay',Number(e.target.value))}>{[0,1,3,5,10,15,30,60].map(n=><option value={n} key={n}>{n===0?'Inmediatamente':`${n} segundos`}</option>)}</select></label>
    <label className="spotify-toggle">Mostrar solo al cambiar de canción<input type="checkbox" role="switch" checked={draft.songChangeOnly ?? false} onChange={e=>update('songChangeOnly',e.target.checked)}/></label>
    <label>Duración visible<select className="input" disabled={!draft.songChangeOnly} value={draft.visibleDuration ?? 5} onChange={e=>update('visibleDuration',Number(e.target.value))}>{[1,3,5,10,15,30,60].map(n=><option value={n} key={n}>{n} segundos</option>)}</select></label>
    <p className="help">La salida aparece al recibir una canción y vuelve a mostrarse cuando cambia. Pausar y reanudar la misma canción no reinicia esa duración. La vista previa permanece visible para editar el diseño.</p>
    <hr/><h3>Otros</h3><label className="spotify-toggle">Ocultar visualizador<input type="checkbox" role="switch" checked={draft.hideVisualizer ?? false} onChange={e=>update('hideVisualizer',e.target.checked)}/></label>
    <p className="help">Oculta las barras animadas decorativas. Los tiempos y el progreso siguen visibles.</p>
  </section>;
}
