export function videoSite(value) {
  let url;try{url=new URL(value);}catch{return null;}
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return null;
  const host=url.hostname.toLowerCase().replace(/^www\./,''),parts=url.pathname.split('/').filter(Boolean);
  let id,provider;
  if(host==='youtu.be'){id=parts[0];provider='youtube';}
  else if(['youtube.com','m.youtube.com','youtube-nocookie.com'].includes(host)){
    id=parts[0]==='watch'?url.searchParams.get('v'):['shorts','embed','live'].includes(parts[0])?parts[1]:null;provider='youtube';
  }else if(host==='vimeo.com'||host==='player.vimeo.com'){
    id=parts.find(part=>/^\d+$/.test(part));provider='vimeo';
  }
  if(!id||(provider==='youtube'?!/^[\w-]{11}$/.test(id):!/^\d{1,15}$/.test(id)))return null;
  const time=url.searchParams.get('t')||url.searchParams.get('start')||url.hash.replace(/^#t=/,'');
  let start=0;
  if(/^\d+(?:\.\d+)?$/.test(time))start=Number(time);
  else {const match=/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(time);if(match)start=Number(match[1]||0)*3600+Number(match[2]||0)*60+Number(match[3]||0);}
  const hash=provider==='vimeo'?(url.searchParams.get('h')||parts[parts.indexOf(id)+1]||''):'';
  return {provider,id,start:Math.min(86370,start),url:provider==='youtube'?`https://www.youtube.com/watch?v=${id}`:`https://vimeo.com/${id}${/^[a-zA-Z0-9]+$/.test(hash)?'/'+hash:''}`};
}
