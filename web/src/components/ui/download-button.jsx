import { Download } from 'lucide-react';
import { Button } from './button';

export function DownloadButton({ children, ...props }) {
  return <Button variant="outline" size="sm" {...props}><Download size={15}/>{children}</Button>;
}
