import { AtSign, Award, Bird, Globe, Heart, Link, Link2, Pin, Send, ShieldCheck, Text, Users, UsersRound } from 'lucide-react';

const strokeProps = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };

function Brand({ children, size, fill = false }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" {...(fill ? { fill: 'currentColor' } : strokeProps)}>{children}</svg>;
}

export function SocialPlatformIcon({ platform, size = 26 }) {
  if (platform === 'threads') return <AtSign size={size} strokeWidth={2.2} aria-hidden="true"/>;
  if (platform === 'website') return <Globe size={size} strokeWidth={2} aria-hidden="true"/>;
  switch (platform) {
    case 'instagram':
      return <Brand size={size}><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none"/></Brand>;
    case 'youtube':
      return <Brand size={size}><rect x="2.4" y="5.2" width="19.2" height="13.6" rx="4"/><path d="m10.2 9.3 4.7 2.7-4.7 2.7z" fill="currentColor" stroke="none"/></Brand>;
    case 'twitch':
      return <Brand size={size}><path d="M4.5 3.5h15v10.2l-3.8 3.8h-4.1l-2.7 2.7v-2.7H4.5z"/><path d="M10 8.2v4M14.8 8.2v4"/></Brand>;
    case 'facebook':
      return <Brand size={size} fill><path d="M14 3h3.5v3.5H15c-.6 0-1 .4-1 1V10h3.4l-.5 3.8H14V21h-4v-7.2H7V10h3V7.3C10 4.6 11.6 3 14 3Z"/></Brand>;
    case 'x':
      return <Brand size={size} fill><path d="M17.5 3H21l-7.2 8.2L21.5 21h-6.4l-4.6-5.9L5.2 21H1.7l7.6-8.7L1.5 3h6.5l4.2 5.5L17.5 3Zm-1.2 16h1.9L7.6 4.9H5.6L16.3 19Z"/></Brand>;
    case 'tiktok':
      return <Brand size={size} fill><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07Z"/></Brand>;
    case 'discord':
      return <Brand size={size} fill><path d="M19.5 5.3A16.3 16.3 0 0 0 15.6 4l-.5 1a13.4 13.4 0 0 0-6.2 0L8.4 4a16.3 16.3 0 0 0-3.9 1.3C2 9.3 1.3 13.2 1.6 17a16.5 16.5 0 0 0 4.8 2.4l.9-1.5a10.5 10.5 0 0 1-1.5-.7l.4-.3a11.7 11.7 0 0 0 10.4 0l.4.3c-.5.3-1 .5-1.5.7l.9 1.5a16.5 16.5 0 0 0 4.8-2.4c.3-3.8-.4-7.7-2.7-11.7ZM8.5 14.7c-1 0-1.7-.9-1.7-1.9s.8-1.9 1.7-1.9 1.8.9 1.7 1.9c0 1-.8 1.9-1.7 1.9Zm7 0c-1 0-1.7-.9-1.7-1.9s.8-1.9 1.7-1.9 1.8.9 1.7 1.9c0 1-.7 1.9-1.7 1.9Z"/></Brand>;
    case 'kick':
      return <Brand size={size} fill><path d="M3 3h6v7l5-7h7l-6 8 6 10h-7l-5-8v8H3z"/></Brand>;
    case 'telegram':
      return <Brand size={size} fill><path d="M21.9 4.3 19 19.4c-.2 1-.8 1.2-1.6.7l-4.4-3.3-2.1 2c-.2.3-.5.5-.9.5l.3-4.4 8-7.2c.3-.3-.1-.5-.5-.2L7 14.3 2.8 13c-1-.3-1-1 .2-1.4l17.3-6.7c.8-.3 1.6.2 1.6.9Z"/></Brand>;
    case 'linkedin':
      return <Brand size={size}><path d="M8.4 3C9.5 3 10.4 4 10.4 5.1v6.9H7.4V5.1C7.4 4 8.2 3.3 9 3zm3 0c1.2 0 1.7.7 1.7 1.6v1.7h1.8V7c0-1.8-1.2-2.6-2.8-2.6C13.1 3.4 11.6 5 11.6 7v4.6H9.9v-1.7c0-.7.4-1.4 1.4-1.4z"/></Brand>;
    case 'bluesky':
      return <Bird size={size} strokeWidth={2} aria-hidden="true"/>;
    case 'mastodon':
      return <Send size={size} strokeWidth={1.9} aria-hidden="true"/>;
    case 'reddit':
      return <Users size={size} strokeWidth={1.8} aria-hidden="true"/>;
    case 'pinterest':
      return <Pin size={size} strokeWidth={2} aria-hidden="true"/>;
    case 'medium':
      return <Text size={size} strokeWidth={2.1} aria-hidden="true"/>;
    case 'patreon':
      return <Heart size={size} strokeWidth={2} aria-hidden="true"/>;
    case 'dribbble':
      return <UsersRound size={size} strokeWidth={2} aria-hidden="true"/>;
    case 'behance':
      return <ShieldCheck size={size} strokeWidth={1.8} aria-hidden="true"/>;
    case 'link':
      return <Link size={size} strokeWidth={2} aria-hidden="true"/>;
    default:
      return <Link2 size={size} strokeWidth={2} aria-hidden="true"/>;
  }
}
