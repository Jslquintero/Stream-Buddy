import fs from 'node:fs';
import path from 'node:path';
import {defaultLikes,validateLikes,likesOutputPath,safeAvatar} from './config.js';
export function createLikesModule({dataDir,changed,log}){
  const file=path.join(dataDir,'likes.json');
  let config={...defaultLikes},revision=Date.now(),channel='',users=new Map(),seen=new Set(),error='',timer=null,updatedAt=0,savedAt=0;
  function read(target){
    const data=JSON.parse(fs.readFileSync(target,'utf8').replace(/^\uFEFF/,''));
    const restored=validateLikes(data.config);
    if(!Array.isArray(data.users)||data.users.some(u=>!u||typeof u.id!=='string'||typeof u.name!=='string'||!Number.isSafeInteger(u.likes)||u.likes<1))throw new Error('Clasificación inválida');
    config=restored;users=new Map(data.users.map(u=>[u.id,{...u,avatar:safeAvatar(u.avatar)}]));channel=String(data.channel||'');seen=new Set((data.seen||[]).filter(id=>typeof id==='string'));revision=data.revision||Date.now();updatedAt=data.updatedAt||0;savedAt=data.savedAt||0;
  }
  try{read(file);}catch(e){if(e.code!=='ENOENT'){try{read(file+'.bak');error='Clasificación recuperada de la copia local.';}catch{error='No se pudo cargar Top likes: '+e.message;}}}
  function persist(){
    clearTimeout(timer);timer=null;
    try{
      fs.mkdirSync(dataDir,{recursive:true});
      const writtenAt=Date.now();
      fs.writeFileSync(file+'.tmp',JSON.stringify({config,revision,channel,updatedAt,savedAt:writtenAt,users:[...users.values()],seen:[...seen].slice(-2000)}));
      if(fs.existsSync(file)&&!error)fs.copyFileSync(file,file+'.bak');
      fs.renameSync(file+'.tmp',file);savedAt=writtenAt;error='';
    }catch(e){error='No se pudo guardar Top likes: '+e.message;log(error);}
  }
  function schedule(){if(!timer){timer=setTimeout(()=>{persist();changed();},1000);timer.unref();}changed();}
  return {
    state(){const ranked=[...users.values()].sort((a,b)=>b.likes-a.likes||a.id.localeCompare(b.id));return {available:true,running:true,config,revision,channel,updatedAt,savedAt,ranking:ranked.slice(0,config.limit),total:ranked.reduce((sum,u)=>sum+u.likes,0),participants:users.size,error,url:likesOutputPath};},
    scoreboard(){return {channel,updatedAt,users:[...users.values()].sort((a,b)=>b.likes-a.likes||a.id.localeCompare(b.id))};},
    health:async()=>{},start:async()=>changed(),
    save(value){config=validateLikes(value);revision=Math.max(Date.now(),revision+1);persist();if(error)throw new Error(error);changed();},
    receive(event,owner){
      if(typeof event.userId!=='string'||!event.userId||!Number.isSafeInteger(event.count)||event.count<1||event.count>1000000)return false;
      const nextChannel=String(owner||'').replace(/^@/,'').toLowerCase();
      if(channel!==nextChannel){users.clear();seen.clear();channel=nextChannel;}
      const messageId=String(event.messageId||'');if(messageId&&seen.has(messageId))return false;
      const id=event.userId.slice(0,128),previous=users.get(id);
      if(!previous&&users.size>=100000)return false;
      const likes=(previous?.likes||0)+event.count;if(!Number.isSafeInteger(likes))return false;
      users.set(id,{id,name:String(event.user||id).slice(0,80),likes,avatar:safeAvatar(event.avatar)||previous?.avatar||''});updatedAt=Date.now();
      if(messageId){seen.add(messageId);if(seen.size>2000)seen.delete(seen.values().next().value);}
      schedule();return true;
    },
    reset(){users.clear();seen.clear();updatedAt=Date.now();persist();if(error)throw new Error(error);changed();},
    close(){if(timer)persist();},
  };
}
