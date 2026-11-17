import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';
export const buttonVariants = cva('button', { variants: { variant: { default: 'button-primary', outline: 'button-outline', ghost: 'button-ghost', destructive: 'button-danger' }, size: { default: '', sm: 'button-sm', icon: 'button-icon' } }, defaultVariants: { variant: 'default', size: 'default' } });
export function Button({ className, variant, size, asChild, type = 'button', ...props }) { const Comp = asChild ? Slot : 'button'; return <Comp type={asChild ? undefined : type} className={cn(buttonVariants({ variant, size }), className)} {...props} />; }
