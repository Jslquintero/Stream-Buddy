import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { validateNotifications, migrateNotifications } from '../../../modules/notifications/config';
import { StudioProfileContext } from './use-studio-profile';
const defaults={key:'live-studio.notifications.pending.v1',validate:validateNotifications,migrate:migrateNotifications,action:'notifications/save'};
function restore(remote,key,migrate){
  try{const saved=JSON.parse(localStorage.getItem(key));if(saved?.config)return migrate(saved.config);}catch{}
  return remote;
}
export function useNotificationSettings(remote,revision,api,online,options=defaults){
  const {key: baseKey,validate,migrate,action}=options;
  const profileId = useContext(StudioProfileContext);
  const key = profileId === 'default' ? baseKey : baseKey + '.profile.' + profileId;
  const [config,setValue]=useState(()=>restore(remote,key,migrate));
  const [dirty,setDirty]=useState(()=>config!==remote),[saving,setSaving]=useState(false),[error,setError]=useState('');
  const current=useRef(config),edited=useRef(dirty),version=useRef(0),inFlight=useRef(false),minimum=useRef(0),awaiting=useRef(null),connected=useRef(online);
  connected.current=online;
  const setConfig=useCallback(value=>{
    const next=typeof value==='function'?value(current.current):value;
    current.current=next;version.current++;edited.current=true;setValue(next);setDirty(true);setError('');
    try{localStorage.setItem(key,JSON.stringify({config:next}));}catch{setError('No se pudo guardar la copia del navegador. Mantén abierto el editor hasta guardar en disco.');}
  },[key]);
  useEffect(()=>{
    if(edited.current||inFlight.current||(revision??0)<minimum.current)return;
    if(awaiting.current&&JSON.stringify(remote)!==awaiting.current&&(revision??0)<=minimum.current)return;
    awaiting.current=null;current.current=remote;setValue(remote);
  },[remote,revision]);
  const save=useCallback(async()=>{
    if(inFlight.current||!connected.current)return false;
    let payload;try{payload=validate(current.current);}catch(e){setError(e.message);return false;}
    const sentVersion=version.current;inFlight.current=true;setSaving(true);setError('');
    try{
      const result=await api(action,payload,{throwOnError:true});
      if(!result)throw new Error('No se pudo guardar. Se reintentará automáticamente.');
      minimum.current=result.notificationRevision??0;
      awaiting.current=JSON.stringify(payload);
      if(version.current===sentVersion){edited.current=false;setDirty(false);current.current=payload;setValue(payload);try{localStorage.removeItem(key);}catch{}}
      return true;
    }catch(e){setError(e.message);return false;}finally{inFlight.current=false;setSaving(false);}
  },[api,key,validate,action]);
  useEffect(()=>{
    if(!dirty||saving||!online)return;
    const timer=setTimeout(()=>void save(),error?4000:650);return()=>clearTimeout(timer);
  },[config,dirty,saving,online,error,save]);
  useEffect(()=>{
    const flush=()=>{if(document.visibilityState==='hidden'&&edited.current)void save();};
    document.addEventListener('visibilitychange',flush);return()=>document.removeEventListener('visibilitychange',flush);
  },[save]);
  return {config,setConfig,dirty,saving,error,save};
}
