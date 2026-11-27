import { useEffect, useState } from 'react';
import {
  siBehance,
  siBluesky,
  siDiscord,
  siDribbble,
  siFacebook,
  siInstagram,
  siKick,
  siMastodon,
  siMedium,
  siPatreon,
  siPinterest,
  siReddit,
  siTelegram,
  siThreads,
  siTiktok,
  siTwitch,
  siX,
  siYoutube,
} from 'simple-icons';
import { Globe, Link2, QrCode } from 'lucide-react';
import { validateSocialWebsiteUrl } from '../../../modules/social/config';

// simple-icons ya no incluye LinkedIn, así que conservamos el glifo oficial "in".
const linkedin = {
  path: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z',
};

const brandIcons = {
  instagram: siInstagram,
  tiktok: siTiktok,
  youtube: siYoutube,
  twitch: siTwitch,
  kick: siKick,
  x: siX,
  facebook: siFacebook,
  discord: siDiscord,
  telegram: siTelegram,
  threads: siThreads,
  linkedin,
  bluesky: siBluesky,
  mastodon: siMastodon,
  reddit: siReddit,
  pinterest: siPinterest,
  medium: siMedium,
  patreon: siPatreon,
  dribbble: siDribbble,
  behance: siBehance,
};

function websiteFaviconUrl(value) {
  try {
    const url = validateSocialWebsiteUrl(value);
    if (!url) return '';
    const domain = new URL(url).hostname.replace(/\.$/, '');
    const publicDomain = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;
    const localSuffix = /\.(?:local|localhost|internal|home|lan|corp|intranet|test|invalid|example|onion)$/;
    if (!publicDomain.test(domain) || localSuffix.test(domain)) return '';
    return `https://a.favicon.im/${domain}?larger=true&throw-error-on-404=true`;
  } catch {
    return '';
  }
}

function WebsiteFavicon({ src, size }) {
  const [status, setStatus] = useState('loading');
  return <>
    {status !== 'loaded' && <Globe size={size} strokeWidth={1.9} aria-hidden="true"/>}
    {status !== 'failed' && <img className="social-icon-image" src={src} width={size} height={size} alt=""
      hidden={status !== 'loaded'} referrerPolicy="no-referrer"
      onLoad={() => setStatus('loaded')} onError={() => setStatus('failed')}/>}
  </>;
}

function WebsiteIcon({ url, size }) {
  const source = websiteFaviconUrl(url);
  const [requested, setRequested] = useState(source);
  useEffect(() => {
    if (!source || source === requested) return;
    const timer = setTimeout(() => setRequested(source), 450);
    return () => clearTimeout(timer);
  }, [source, requested]);
  if (source && requested === source) return <WebsiteFavicon key={source} src={source} size={size}/>;
  return <Globe size={size} strokeWidth={1.9} aria-hidden="true"/>;
}

export function SocialPlatformIcon({ platform, icon, url, size = 26 }) {
  if (icon) {
    return <img className="social-icon-image" src={icon} width={size} height={size} alt=""/>;
  }
  const brand = brandIcons[platform];
  if (brand) {
    return <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" focusable="false">
      <path d={brand.path}/>
    </svg>;
  }
  if (platform === 'qr') return <QrCode size={size} strokeWidth={1.9} aria-hidden="true"/>;
  if (platform === 'website') return <WebsiteIcon url={url} size={size}/>;
  return <Link2 size={size} strokeWidth={1.9} aria-hidden="true"/>;
}
