import { cn } from '../../lib/utils';

export function Dialog({ open, onClose, className, backdropClassName, children, keepMounted = false, ...props }) {
  if (!open && !keepMounted) return null;
  return <div className={cn('dialog-backdrop', backdropClassName)} hidden={!open} aria-hidden={!open} onClick={open ? onClose : undefined}>
    <div className={cn('dialog', className)} onClick={event => event.stopPropagation()} role="dialog" aria-modal={open ? 'true' : undefined} {...props}>{children}</div>
  </div>;
}
