import { useCallback, useEffect, useRef, useState } from 'react';
import { useProfileChangeGuard } from './use-studio-profile';

export function useLayoutAutosave(remote, remoteRevision, api, paused=false) {
  const [draft,setValue]=useState(remote),[dirty,setDirty]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('');
  useProfileChangeGuard(dirty || saving || paused);
  const current=useRef(remote),edited=useRef(false),version=useRef(0),inFlight=useRef(false),minimumRevision=useRef(0),pause=useRef(paused);
  pause.current=paused;
  useEffect(()=>{
    if(remote&&!edited.current&&!inFlight.current&&(remoteRevision??0)>=minimumRevision.current){current.current=remote;setValue(remote);}
  },[remote,remoteRevision]);
  const setDraft=useCallback(value=>{
    const next=typeof value==='function'?value(current.current):value;
    current.current=next;version.current++;edited.current=true;
    setValue(next);setDirty(true);setError('');
  },[]);
  const save=useCallback(async()=>{
    if(!current.current||!edited.current||inFlight.current||pause.current)return false;
    const sent=current.current,sentVersion=version.current;
    inFlight.current=true;setSaving(true);setError('');
    try {
      const result=await api('layout/save',sent);
      if(!result){setError('No se pudo guardar. Se reintentará automáticamente.');return false;}
      if(Number.isFinite(result.layoutRevision))minimumRevision.current=result.layoutRevision;
      if(version.current===sentVersion){edited.current=false;setDirty(false);}
      return true;
    } catch {setError('No se pudo guardar. Se reintentará automáticamente.');return false;}
    finally {inFlight.current=false;setSaving(false);}
  },[api]);
  useEffect(()=>{
    if(!dirty||saving||paused)return;
    const timer=setTimeout(()=>void save(),error?5000:700);
    return ()=>clearTimeout(timer);
  },[draft,dirty,saving,paused,error,save]);
  useEffect(()=>{
    const beforeUnload=event=>{if(edited.current||inFlight.current||pause.current){event.preventDefault();event.returnValue='';}};
    const flush=()=>{if(document.visibilityState==='hidden')void save();};
    window.addEventListener('beforeunload',beforeUnload);document.addEventListener('visibilitychange',flush);
    return ()=>{window.removeEventListener('beforeunload',beforeUnload);document.removeEventListener('visibilitychange',flush);};
  },[save]);
  return {draft,setDraft,dirty,saving,save,error};
}
