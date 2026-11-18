import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const web=path.join(root,'web');
test('frontend has no personal deployment or private Skill payload',async()=>{
  const files=await readdir(web,{withFileTypes:true});
  assert(files.every(f=>f.isFile()),'Only allowlisted frontend files are distributed');
  const forbidden=[/chatgpt\.site/i,/pages\.dev/i,/shared_token\s*=/i,/__Host-stage-session/,/下游参考用途说明/,/Downstream reference-use requirements/,/stage-bootstrap/,/AUTH_SECRET/,/\b[a-f0-9]{32}\b/i,/(?:\/Users\/|\/home\/)[^\s"']+/];
  for(const f of files){const text=await readFile(path.join(web,f.name),'utf8');for(const pattern of forbidden)assert(!pattern.test(text),`${f.name} contains excluded owner/workflow data (${pattern})`);}
});
test('HTML asset references resolve under a deployment subdirectory',async()=>{
  const html=await readFile(path.join(web,'index.html'),'utf8');
  const refs=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1]).filter(x=>!x.startsWith('#')&&!/^(https?:|data:|mailto:)/i.test(x));
  for(const ref of refs){assert(!ref.startsWith('/'),`Root-relative asset: ${ref}`);const name=ref.split(/[?#]/)[0];if(name)await readFile(path.join(web,name));}
  assert(!html.includes('project-source.js'));assert(!html.includes('handoff-client.js'));
});
test('demo is generic and has no account or project bindings',async()=>{
  const demo=JSON.parse(await readFile(path.join(web,'demo.json'),'utf8'));
  assert.equal(demo.version,1);assert(demo.shots.length>0);assert(Object.keys(demo.scenes).length>0);
  const visit=value=>{if(!value||typeof value!=='object')return;for(const[k,v]of Object.entries(value)){assert(!['project_id','conversation_id','document_id','read_token','access_token','refresh_token','shared_token'].includes(k),`Personal binding: ${k}`);if(typeof v==='object')visit(v);}};visit(demo);
});
