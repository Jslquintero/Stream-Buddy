import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import './toast.css';

const icons = { success: CheckCircle2, error: AlertTriangle, warning: AlertTriangle, info: Info };

export function ToastRegion({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return <div className="toast-region" role="region" aria-label="Avisos del estudio">
    {toasts.map(toast => {
      const Icon = icons[toast.type] || Info;
      return <div key={toast.id} className={'toast toast-' + toast.type}
        role={toast.type === 'error' ? 'alert' : 'status'}>
        <Icon size={18} aria-hidden="true"/>
        <p>{toast.message}</p>
        <button type="button" className="toast-close" aria-label="Cerrar aviso" onClick={() => onDismiss(toast.id)}>
          <X size={16}/>
        </button>
      </div>;
    })}
  </div>;
}
