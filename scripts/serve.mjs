import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.env.PORT||4173);
if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT must be 1–65535');
const base=await realpath(path.join(root,process.argv.includes('--dist')?'dist':'web'));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end('Read-only development server');return;}
  try{
    let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    // A nested path is useful for checking deployments under a repository/subdirectory.
    if(pathname.startsWith('/preview/'))pathname=pathname.slice('/preview'.length);
    if(pathname.endsWith('/'))pathname+='index.html';
    if(pathname.includes('\0')||pathname.includes('\\'))throw Error('Invalid path');
    const candidate=path.resolve(base,'.'+pathname);
    if(candidate!==base&&!candidate.startsWith(base+path.sep))throw Error('Invalid path');
    const file=await realpath(candidate);
    if(!file.startsWith(base+path.sep)||!(await stat(file)).isFile())throw Error('Invalid file');
    const type=types[path.extname(file)];if(!type)throw Error('Unsupported file');
    const body=await readFile(file);res.writeHead(200,{'Content-Type':type,'Content-Length':body.length});res.end(req.method==='HEAD'?undefined:body);
  }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Director's Stage UI: http://127.0.0.1:${port}/`));
