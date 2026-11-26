import { Check, ChevronRight, Sparkles } from 'lucide-react';
import { Badge, Button, Card } from './ui';

export function FirstRun({ state, online, copied, added, copyName = 'Notificaciones', dismissed, onAdded, onDismiss, onConnect, onCopy }) {
  if (dismissed) return null;
  const connected = !!state?.tts?.connected;
  const connector = !!state?.tts?.connector || connected;
  const connecting = !!state?.tts?.connecting;
  const steps = [
    {
      id: 'connect',
      title: 'Conecta tu TikTok',
      description: 'Abre el panel de conexión y escribe tu usuario. No necesitas contraseña.',
      done: connected,
      action: connecting ? 'Conectando…' : 'Conectar',
      disabled: !online || connecting,
      run: onConnect,
    },
    {
      id: 'connector',
      title: 'Instala el conector',
      description: 'Recibe comentarios, likes y regalos en el panel.',
      done: connector,
      action: 'Abrir conexión',
      disabled: !online || connecting,
      run: onConnect,
    },
    {
      id: 'copy',
      title: 'Copia el enlace de una superposición',
      description: 'Empezamos por ' + copyName + '. Lo pegarás en TikTok LIVE Studio.',
      done: copied,
      action: 'Copiar enlace',
      disabled: !online || !onCopy,
      run: onCopy,
    },
    {
      id: 'add',
      title: 'Añádela a TikTok LIVE Studio',
      description: 'En TikTok LIVE Studio abre Fuentes → Navegador y pega el enlace.',
      done: added,
      action: 'Ya la añadí',
      disabled: false,
      run: onAdded,
    },
  ];
  const done = steps.filter(step => step.done).length;
  if (done === steps.length) return null;

  return <Card className="first-run">
    <div className="first-run-heading">
      <div>
        <Badge><Sparkles size={12}/> Primeros pasos</Badge>
        <h2>Prepara tu primer directo</h2>
        <p className="help">Cuatro pasos para dejar el estudio listo. Detectamos el progreso automáticamente.</p>
      </div>
      <div className="first-run-progress" aria-label={'Progreso: ' + done + ' de ' + steps.length}>
        <strong>{done}/{steps.length}</strong>
        <span>completado</span>
      </div>
    </div>
    <progress max={steps.length} value={done} aria-label="Progreso de los primeros pasos"/>
    <ol className="first-run-steps">
      {steps.map((step, index) => <li key={step.id} className={step.done ? 'is-done' : ''}>
        <span className="first-run-check" aria-hidden="true">{step.done ? <Check size={15}/> : index + 1}</span>
        <div>
          <strong>{step.title}</strong>
          <p>{step.description}</p>
        </div>
        {!step.done && <Button variant="outline" size="sm" disabled={step.disabled} onClick={step.run}>
          {step.action}<ChevronRight size={14}/>
        </Button>}
      </li>)}
    </ol>
    <div className="first-run-footer">
      <span className="help">Al completar los pasos, esta guía se oculta.</span>
      <Button variant="ghost" size="sm" onClick={onDismiss}>Ocultar guía</Button>
    </div>
  </Card>;
}
