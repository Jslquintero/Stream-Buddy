import { useLayoutEffect, useRef, useState } from 'react';

export function AutoFitPreview({ width, className, children }) {
  const host = useRef(null);
  const inner = useRef(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const panel = host.current;
    const content = inner.current;
    const resize = () => {
      if (!panel.clientWidth) return;

      const { paddingLeft, paddingRight, paddingTop, paddingBottom } = getComputedStyle(panel);
      const availableWidth = panel.clientWidth - parseFloat(paddingLeft) - parseFloat(paddingRight);
      const previewHeight = Math.max(320, Math.min(window.innerHeight * 0.6, 540));
      const availableHeight = previewHeight - parseFloat(paddingTop) - parseFloat(paddingBottom);
      const widthScale = Math.min(1, Math.max(1, availableWidth) / width);
      const heightScale = availableHeight / Math.max(1, content.offsetHeight);
      // Let long boards extend down the page before the text gets too small.
      setScale(Math.min(widthScale, Math.max(widthScale * 0.7, heightScale)));
    };

    resize();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(panel);
    observer?.observe(content, { box: 'border-box' });
    window.addEventListener('resize', resize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [width]);

  return <div ref={host} className={className}>
    <div ref={inner} style={{ flex: 'none', width, zoom: scale }}>{children}</div>
  </div>;
}
