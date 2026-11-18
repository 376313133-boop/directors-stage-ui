import { readdir, readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'web'), output=path.join(root,'dist');
const allowed=new Set(['.html','.css','.js','.json','.svg']);
const entries=await readdir(source,{withFileTypes:true});
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
for(const entry of entries){
  if(!entry.isFile()||!allowed.has(path.extname(entry.name)))throw Error(`Unexpected frontend entry: ${entry.name}`);
  await writeFile(path.join(output,entry.name),await readFile(path.join(source,entry.name)));
}
console.log(`Built ${entries.length} static frontend files in dist/`);
