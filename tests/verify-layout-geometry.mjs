import {build} from 'vite';
import fs from 'node:fs';
import path from 'node:path';
await build({define:{'process.env.NODE_ENV':JSON.stringify('production')},configFile:path.resolve('vite.config.js'),build:{outDir:path.resolve('.tmp/geometry'),emptyOutDir:true,lib:{entry:path.resolve('tests/layout-geometry.browser.jsx'),name:'GeometryTest',formats:['iife'],fileName:()=> 'geometry.js'},cssCodeSplit:false}});
const files=fs.readdirSync('.tmp/geometry');
const css=files.filter(f=>f.endsWith('.css')).map(f=>fs.readFileSync('.tmp/geometry/'+f,'utf8')).join('\n');
fs.writeFileSync('.tmp/layout-geometry.html',`<!doctype html><meta charset="utf-8"><style>${css}\nbody{padding:20px}#report{white-space:pre-wrap;color:#b9f678;font:20px/1.6 monospace;margin-bottom:20px}.geometry-pair{display:flex;gap:30px}.geometry-output .layout-canvas{width:640px;height:360px!important;aspect-ratio:auto!important}</style><pre id="report">Running geometry checks...</pre><div id="root"></div><script src="geometry/geometry.js"></script>`);
