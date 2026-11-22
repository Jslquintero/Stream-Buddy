import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import baseCss from './spotify.css?inline';
import finishCss from './spotify-cover-finishes.css?inline';
import skinCss from './spotify-skins.css?inline';
import { spotifySize } from '../../../shared/spotify';

// The widget owns its stylesheet tree: user CSS cannot restyle the studio UI.
export function SpotifySurface({ config = {}, children, preview = false }) {
  const host = useRef(null), frame = useRef(null);
  const [root, setRoot] = useState(null), [scale, setScale] = useState(1);
  const [width, height] = spotifySize(config.playerStyle, config);
  useLayoutEffect(() => { setRoot(host.current.shadowRoot || host.current.attachShadow({ mode:'open' })); }, []);
  useLayoutEffect(() => {
    if (!preview) return;
    const resize = () => setScale(Math.min(1, (frame.current?.clientWidth || width) / width));
    resize(); const observer = new ResizeObserver(resize); observer.observe(frame.current);
    return () => observer.disconnect();
  }, [preview, width]);
  const css = config.cssEnabled !== false ? config.customCss?.[config.playerStyle || 'compact'] || '' : '';
  return <div className="spotify-surface-frame" ref={frame} style={{ height:height * scale, width:preview ? '100%' : width }}>
    <div className="spotify-surface" ref={host} style={{width, height, transform:`scale(${scale})`, transformOrigin:'top left'}}>
      {root && createPortal(<><style>{'@layer spotify-base {\n' + baseCss + '\n' + skinCss + '\n' + finishCss + '\n}'}</style><style data-spotify-custom-css>{css}</style><div className="spotify-widget" style={{width, height}}>{children}</div></>, root)}
    </div>
  </div>;
}
