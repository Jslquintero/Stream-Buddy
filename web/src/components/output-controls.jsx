import { Copy, ExternalLink } from 'lucide-react';
import { Badge, Button, Card } from './ui';

export function CopyLinkButton({ url, notice, message = 'Enlace copiado.', fallback = 'Enlace', children, variant = 'outline', size, 'aria-label': ariaLabel }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      notice(message);
    } catch {
      notice(`${fallback}: ${url}`);
    }
  }
  return <Button variant={variant} size={size} onClick={copy} aria-label={ariaLabel}>{children}</Button>;
}

export function OutputLinks({ url, notice, message, fallback, copyLabel = 'Copiar salida', openLabel = 'Abrir salida', iconSize, size, variant = 'outline' }) {
  return <>
    <CopyLinkButton url={url} notice={notice} message={message} fallback={fallback} size={size} variant={variant}>
      {iconSize && <Copy size={iconSize}/>}{copyLabel}
    </CopyLinkButton>
    <Button asChild variant={variant} size={size}>
      <a href={url} target="_blank" rel="noopener noreferrer">{iconSize && <ExternalLink size={iconSize}/>}{openLabel}</a>
    </Button>
  </>;
}

export function OutputToolbar({ title, connected, description, children, className = 'notifications-toolbar' }) {
  return <Card className={className}>
    <div>
      {title ? <h2>{title}</h2> : <Badge className={connected ? 'success' : ''}>{connected ? 'TikTok conectado' : 'TikTok sin conectar'}</Badge>}
      <p className="help">{description}</p>
    </div>
    <div className="actions">{children}</div>
  </Card>;
}
