import fs from 'node:fs';
import path from 'node:path';
import {defaultGifters,validateGifters,giftersOutputPath,safeAvatar} from './config.js';
export function createGiftersModule({dataDir,changed,log}){
  const file=path.join(dataDir,'gifters.json');
  let config={...defaultGifters},revision=Date.now(),channel='',users=new Map(),seen=new Set(),error='',timer=null,updatedAt=0,savedAt=0;
  function read(target){
    const data=JSON.parse(fs.readFileSync(target,'utf8').replace(/^\uFEFF/,''));
    const restored=validateGifters(data.config);
    if(!Array.isArray(data.users)||data.users.some(u=>!u||typeof u.id!=='string'||typeof u.name!=='string'||!Number.isSafeInteger(u.gifts)||u.gifts<1||!Number.isSafeInteger(u.diamonds)||u.diamonds<0))throw new Error('Clasificación inválida');
    config=restored;users=new Map(data.users.map(u=>[u.id,{id:u.id,name:String(u.name).slice(0,80),gifts:u.gifts,diamonds:u.diamonds,avatar:safeAvatar(u.avatar),lastGift:String(u.lastGift||'').slice(0,80)}]));channel=String(data.channel||'');seen=new Set((data.seen||[]).filter(id=>typeof id==='string'));revision=data.revision||Date.now();updatedAt=data.updatedAt||0;savedAt=data.savedAt||0;
  }
  try{read(file);}catch(e){if(e.code!=='ENOENT'){try{read(file+'.bak');error='Clasificación recuperada de la copia local.';}catch{error='No se pudo cargar Top gifters: '+e.message;}}}
  function persist(){
    clearTimeout(timer);timer=null;
    try{
      fs.mkdirSync(dataDir,{recursive:true});
      const writtenAt=Date.now();
      fs.writeFileSync(file+'.tmp',JSON.stringify({config,revision,channel,updatedAt,savedAt:writtenAt,users:[...users.values()],seen:[...seen].slice(-2000)}));
      if(fs.existsSync(file)&&!error)fs.copyFileSync(file,file+'.bak');
      fs.renameSync(file+'.tmp',file);savedAt=writtenAt;error='';
    }catch(e){error='No se pudo guardar Top gifters: '+e.message;log(error);}
  }
  function schedule(){if(!timer){timer=setTimeout(()=>{persist();changed();},1000);timer.unref();}changed();}
  const metric=user=>config.metric==='diamonds'?user.diamonds:user.gifts;
  const ranked=()=>[...users.values()].sort((a,b)=>metric(b)-metric(a)||b.gifts-a.gifts||b.diamonds-a.diamonds||a.id.localeCompare(b.id));
  return {
    state(){const rows=ranked();return {available:true,running:true,config,revision,channel,updatedAt,savedAt,ranking:rows.slice(0,config.limit),total:rows.reduce((sum,u)=>sum+metric(u),0),totalGifts:rows.reduce((sum,u)=>sum+u.gifts,0),totalDiamonds:rows.reduce((sum,u)=>sum+u.diamonds,0),participants:users.size,error,url:giftersOutputPath};},
    scoreboard(){return {channel,updatedAt,metric:config.metric,users:ranked()};},
    health:async()=>{},start:async()=>changed(),
    save(value){config=validateGifters(value);revision=Math.max(Date.now(),revision+1);persist();if(error)throw new Error(error);changed();},
    receive(event,owner){
      if(typeof event.userId!=='string'||!event.userId||!Number.isSafeInteger(event.count)||event.count<1||event.count>1000000)return false;
      const nextChannel=String(owner||'').replace(/^@/,'').toLowerCase();
      if(channel!==nextChannel){users.clear();seen.clear();channel=nextChannel;}
      const messageId=String(event.messageId||'');if(messageId&&seen.has(messageId))return false;
      const id=event.userId.slice(0,128),previous=users.get(id);
      if(!previous&&users.size>=100000)return false;
      const diamonds=Number.isSafeInteger(event.diamonds)&&event.diamonds>=0&&event.diamonds<=1000000000?event.diamonds:0;
      const gifts=(previous?.gifts||0)+event.count,total=(previous?.diamonds||0)+diamonds;
      if(!Number.isSafeInteger(gifts)||!Number.isSafeInteger(total))return false;
      users.set(id,{id,name:String(event.user||id).slice(0,80),gifts,diamonds:total,avatar:safeAvatar(event.avatar)||previous?.avatar||'',lastGift:String(event.gift||previous?.lastGift||'').slice(0,80)});updatedAt=Date.now();
      if(messageId){seen.add(messageId);if(seen.size>2000)seen.delete(seen.values().next().value);}
      schedule();return true;
    },
    reset(){users.clear();seen.clear();updatedAt=Date.now();persist();if(error)throw new Error(error);changed();},
    close(){if(timer)persist();},
  };
}
