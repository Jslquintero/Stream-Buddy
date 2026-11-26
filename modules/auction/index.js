import fs from 'node:fs';
import path from 'node:path';
import {defaultAuction,validateAuction,auctionOutputPath,safeAvatar} from './config.js';

const statuses=['idle','live','ended'];
const emptyWinner=value=>{
  if(!value||typeof value!=='object')return null;
  if(typeof value.id!=='string'||typeof value.name!=='string'||!Number.isSafeInteger(value.diamonds)||value.diamonds<0)return null;
  return {id:value.id.slice(0,128),name:String(value.name).slice(0,80),avatar:safeAvatar(value.avatar),diamonds:value.diamonds,gifts:Number.isSafeInteger(value.gifts)&&value.gifts>0?value.gifts:0,lastGift:String(value.lastGift||'').slice(0,80)};
};

export function createAuctionModule({dataDir,changed,log}){
  const file=path.join(dataDir,'auction.json');
  let config={...defaultAuction},revision=Date.now(),channel='',status='idle',round=0,itemTitle='',startsAt=0,endsAt=0,endedAt=0,winner=null,bidders=new Map(),seen=new Set(),error='',timer=null,updatedAt=0,savedAt=0;
  function read(target){
    const data=JSON.parse(fs.readFileSync(target,'utf8').replace(/^\uFEFF/,''));
    const restored=validateAuction(data.config);
    if(!statuses.includes(data.status))throw new Error('Estado de subasta inválido');
    if(!Number.isSafeInteger(data.round)||data.round<0||data.round>1000000)throw new Error('Ronda inválida');
    if(!Array.isArray(data.bids)||data.bids.some(u=>!u||typeof u.id!=='string'||typeof u.name!=='string'||!Number.isSafeInteger(u.diamonds)||u.diamonds<0||!Number.isSafeInteger(u.gifts)||u.gifts<0))throw new Error('Pujas inválidas');
    config=restored;status=data.status;round=data.round;itemTitle=String(data.itemTitle||'').slice(0,80);
    startsAt=Number.isFinite(data.startsAt)?data.startsAt:0;endsAt=Number.isFinite(data.endsAt)?data.endsAt:0;endedAt=Number.isFinite(data.endedAt)?data.endedAt:0;
    winner=emptyWinner(data.winner);channel=String(data.channel||'');seen=new Set((data.seen||[]).filter(id=>typeof id==='string'));
    bidders=new Map(data.bids.map(u=>[u.id,{id:u.id,name:String(u.name).slice(0,80),avatar:safeAvatar(u.avatar),diamonds:u.diamonds,gifts:u.gifts,lastGift:String(u.lastGift||'').slice(0,80)}]));
    revision=data.revision||Date.now();updatedAt=data.updatedAt||0;savedAt=data.savedAt||0;
  }
  try{read(file);}catch(e){if(e.code!=='ENOENT'){try{read(file+'.bak');error='Subasta recuperada de la copia local.';}catch{error='No se pudo cargar la subasta: '+e.message;}}}
  function persist(){
    clearTimeout(timer);timer=null;
    try{
      fs.mkdirSync(dataDir,{recursive:true});
      const writtenAt=Date.now();
      fs.writeFileSync(file+'.tmp',JSON.stringify({config,revision,channel,status,round,itemTitle,startsAt,endsAt,endedAt,winner,updatedAt,savedAt:writtenAt,bids:[...bidders.values()],seen:[...seen].slice(-2000)}));
      if(fs.existsSync(file)&&!error)fs.copyFileSync(file,file+'.bak');
      fs.renameSync(file+'.tmp',file);savedAt=writtenAt;error='';
    }catch(e){error='No se pudo guardar la subasta: '+e.message;log(error);}
  }
  function schedule(){if(!timer){timer=setTimeout(()=>{persist();changed();},1000);timer.unref();}changed();}
  function ranked(){return [...bidders.values()].sort((a,b)=>b.diamonds-a.diamonds||b.gifts-a.gifts||a.id.localeCompare(b.id));}
  function closeExpired(now=Date.now()){
    if(status!=='live'||!endsAt||now<endsAt)return false;
    status='ended';endedAt=endsAt;updatedAt=now;const rows=ranked();winner=rows[0]?{...rows[0]}:null;return true;
  }
  function clearBids(){bidders.clear();seen.clear();winner=null;}
  function currentTitle(){return itemTitle||config.itemTitle;}
  return {
    state(){
      closeExpired();
      const rows=ranked(),now=Date.now();
      return {available:true,running:true,config,revision,channel,status,round,itemTitle:currentTitle(),startsAt,endsAt,endedAt,
        remainingMs:status==='live'&&endsAt?Math.max(0,endsAt-now):0,
        ranking:rows.slice(0,config.limit),leader:rows[0]||null,
        total:rows.reduce((sum,u)=>sum+u.diamonds,0),totalGifts:rows.reduce((sum,u)=>sum+u.gifts,0),participants:bidders.size,
        winner,updatedAt,savedAt,error,url:auctionOutputPath};
    },
    results(){const rows=ranked();return {channel,status,round,itemTitle:currentTitle(),winner,updatedAt,total:rows.reduce((sum,u)=>sum+u.diamonds,0),users:rows};},
    health:async()=>{if(closeExpired())schedule();},
    start:async()=>changed(),
    save(value){
      config=validateAuction(value);revision=Math.max(Date.now(),revision+1);
      if(status==='live'){endsAt=config.duration?startsAt+config.duration*1000:0;closeExpired();}
      persist();if(error)throw new Error(error);changed();
    },
    begin(){
      closeExpired();
      if(status==='live')throw new Error('La subasta ya está en marcha. Ciérrala o empieza la siguiente ronda.');
      clearBids();round=Math.max(1,round+1);status='live';itemTitle=config.itemTitle;
      startsAt=Date.now();endsAt=config.duration?startsAt+config.duration*1000:0;endedAt=0;updatedAt=startsAt;
      persist();if(error)throw new Error(error);changed();
    },
    end(){
      if(status==='idle')throw new Error('Inicia la subasta antes de cerrarla.');
      if(status==='ended')throw new Error('La subasta ya está cerrada.');
      status='ended';endedAt=Date.now();updatedAt=endedAt;const rows=ranked();winner=rows[0]?{...rows[0]}:null;
      persist();if(error)throw new Error(error);changed();
    },
    next(){
      closeExpired();clearBids();round+=1;status='live';itemTitle=config.itemTitle;
      startsAt=Date.now();endsAt=config.duration?startsAt+config.duration*1000:0;endedAt=0;updatedAt=startsAt;
      persist();if(error)throw new Error(error);changed();
    },
    receive(event,owner){
      const nextChannel=String(owner||'').replace(/^@/,'').toLowerCase();
      let channelChanged=false;
      if(channel!==nextChannel){channel=nextChannel;channelChanged=true;}
      if(closeExpired()){schedule();return false;}
      if(channelChanged)schedule();
      if(status!=='live')return false;
      if(typeof event.userId!=='string'||!event.userId||!Number.isSafeInteger(event.count)||event.count<1||event.count>1000000)return false;
      const messageId=String(event.messageId||'');if(messageId&&seen.has(messageId))return false;
      const id=event.userId.slice(0,128),previous=bidders.get(id);
      if(!previous&&bidders.size>=100000)return false;
      const diamonds=Number.isSafeInteger(event.diamonds)&&event.diamonds>0&&event.diamonds<=1000000000?event.diamonds:event.count;
      const gifts=(previous?.gifts||0)+event.count,total=(previous?.diamonds||0)+diamonds;
      if(!Number.isSafeInteger(gifts)||!Number.isSafeInteger(total))return false;
      bidders.set(id,{id,name:String(event.user||id).slice(0,80),avatar:safeAvatar(event.avatar)||previous?.avatar||'',diamonds:total,gifts,lastGift:String(event.gift||previous?.lastGift||'').slice(0,80)});
      updatedAt=Date.now();
      if(messageId){seen.add(messageId);if(seen.size>2000)seen.delete(seen.values().next().value);}
      schedule();return true;
    },
    reset(){status='idle';round=0;itemTitle='';startsAt=endsAt=endedAt=0;clearBids();updatedAt=Date.now();persist();if(error)throw new Error(error);changed();},
    close(){if(timer)persist();},
  };
}
