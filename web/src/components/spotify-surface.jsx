import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { spotifyBaseCss } from './spotify-style';
import { spotifySize } from '../../../shared/spotify';

const previewHeight = 424;

// The widget owns its stylesheet tree: user CSS cannot restyle the studio UI.
export function SpotifySurface({ config = {}, children, preview = false }) {
  const host = useRef(null), frame = useRef(null);
  const [root, setRoot] = useState(null), [scale, setScale] = useState(1);
  const [width, height] = spotifySize(config.playerStyle, config);
  const frameWidth = preview ? Math.min(width, width * previewHeight / height) : width;
  useLayoutEffect(() => { setRoot(host.current.shadowRoot || host.current.attachShadow({ mode:'open' })); }, []);
  useLayoutEffect(() => {
    if (!preview) return;
    const resize = () => setScale(Math.min(frameWidth, frame.current.clientWidth || frameWidth) / width);
    resize(); const observer = new ResizeObserver(resize); observer.observe(frame.current);
    return () => observer.disconnect();
  }, [preview, width, frameWidth]);
  const css = config.cssEnabled !== false ? config.customCss?.[config.playerStyle || 'compact'] || '' : '';
  return <div className="spotify-surface-frame" ref={frame} style={{ height:height * scale, width:frameWidth, maxWidth:preview ? '100%' : undefined, marginInline:preview ? 'auto' : undefined }}>
    <div className="spotify-surface" ref={host} style={{width, height, transform:`scale(${scale})`, transformOrigin:'top left'}}>
      {root && createPortal(<><style>{'@layer music-base {\n' + spotifyBaseCss + '\n}'}</style><style data-spotify-custom-css>{css.replace(/([.]|--)spotify-/g, '$1music-')}</style><div className="music-widget" style={{width, height}}>{children}</div></>, root)}
    </div>
  </div>;
}
