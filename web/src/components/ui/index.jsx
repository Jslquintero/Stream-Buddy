import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '../../lib/utils';
export { Button } from './button';
export function Card({ className, ...props }) { return <section className={cn('card', className)} {...props} />; }
export function Badge({ className, ...props }) { return <span className={cn('badge', className)} {...props} />; }
export function Input({ className, ...props }) { return <input className={cn('input', className)} {...props} />; }
export function Select({ className, ...props }) { return <select className={cn('input', className)} {...props} />; }
export function Textarea({ className, ...props }) { return <textarea className={cn('input', className)} {...props} />; }
export function Switch(props) { return <SwitchPrimitive.Root className="switch" {...props}><SwitchPrimitive.Thumb className="switch-thumb" /></SwitchPrimitive.Root>; }
export const Tabs = TabsPrimitive.Root;
export function TabsList(props) { return <TabsPrimitive.List className="tabs-list" {...props} />; }
export function TabsTrigger(props) { return <TabsPrimitive.Trigger className="tabs-trigger" {...props} />; }
export function TabsContent(props) { return <TabsPrimitive.Content className="tabs-content" {...props} />; }
export { Dialog } from './dialog';
