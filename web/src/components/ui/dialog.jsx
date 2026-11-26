import { cn } from '../../lib/utils';

export function Dialog({ open, onClose, className, children, ...props }) {
  if (!open) return null;
  return <div className="dialog-backdrop" onClick={onClose}>
    <div className={cn('dialog', className)} onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" {...props}>{children}</div>
  </div>;
}
