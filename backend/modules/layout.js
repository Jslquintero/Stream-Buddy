import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { defaultLayout, validateLayout } from '../../shared/layout.js';
import { layoutOutputPath } from '../../shared/layout-url.js';
export function createLayoutModule({ dataDir, changed, log }) {
  const file = path.join(dataDir, 'layout.json');
  let document = structuredClone(defaultLayout), error = '';
  let revision = Date.now();
  const libraryFile=path.join(dataDir,'layout-compositions.json');
  let compositions=[];
  const nameOf=value=>{if(typeof value!=='string'||!value.trim()||value.trim().length>80)throw new Error('Escribe un nombre de hasta 80 caracteres');return value.trim();};
  const persist=next=>{
    const json=JSON.stringify(next,null,2);
    if(Buffer.byteLength(json)>50000000)throw new Error('La biblioteca supera 50 MB. Reduce las imágenes de tus composiciones.');
    fs.mkdirSync(dataDir,{recursive:true});fs.writeFileSync(libraryFile+'.tmp',json,'utf8');fs.renameSync(libraryFile+'.tmp',libraryFile);
    compositions=next;changed();
  };
  try { document = validateLayout(JSON.parse(fs.readFileSync(file, 'utf8'))); }
  catch (e) { if (e.code !== 'ENOENT') error = 'No se pudo cargar layout.json: ' + e.message; }
  try {
    const saved=JSON.parse(fs.readFileSync(libraryFile,'utf8'));
    if(!Array.isArray(saved)||saved.length>20)throw new Error('Biblioteca inválida');
    const ids=new Set();
    compositions=saved.map(item=>{
      if(typeof item.id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(item.id)||ids.has(item.id))throw new Error('Identificador inválido');
      ids.add(item.id);return {id:item.id,name:nameOf(item.name),document:validateLayout(item.document),revision};
    });
  }catch(e){if(e.code!=='ENOENT')error+=' No se pudo cargar la biblioteca: '+e.message;}
  return {
    state: () => ({ available: true, running: true, url: layoutOutputPath, document, error, revision, compositions }),
    create(input) {
      if(compositions.length>=20)throw new Error('Puedes guardar hasta 20 composiciones');
      const item={id:randomUUID(),name:nameOf(input.name),document:validateLayout(input.document),revision:Date.now()};
      persist([...compositions,item]);return {compositionId:item.id};
    },
    saveComposition(input) {
      const item=compositions.find(item=>item.id===input.id);
      if(!item)throw new Error('Composición no encontrada');
      const next={...item,document:validateLayout(input.document),revision:Math.max(Date.now(),item.revision+1)};
      persist(compositions.map(item=>item.id===next.id?next:item));return {layoutRevision:next.revision};
    },
    rename(input) {
      if(!compositions.some(item=>item.id===input.id))throw new Error('Composición no encontrada');
      const name=nameOf(input.name);persist(compositions.map(item=>item.id===input.id?{...item,name}:item));
      return {};
    },
    deleteComposition(input) {
      const next = compositions.filter(item => item.id !== input.id);
      if (next.length === compositions.length) throw new Error('Composición no encontrada');
      persist(next);
    },
    health: async () => {}, start: async () => { changed(); },
    save(input) {
      const next = validateLayout(input);
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(file + '.tmp', JSON.stringify(next, null, 2), 'utf8');
      fs.renameSync(file + '.tmp', file);
      document = next; revision=Math.max(Date.now(),revision+1); error = ''; changed();
    },
  };
}
