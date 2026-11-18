import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../web/frontend-host.js',import.meta.url),'utf8');
const sample=JSON.parse(await readFile(new URL('../examples/minimal-project.json',import.meta.url),'utf8'));
const scope={crypto:webcrypto};vm.runInNewContext(source,{window:scope,TextEncoder,URL,Blob,setTimeout});
const plain=x=>JSON.parse(JSON.stringify(x));
test('import identity separates versions and baseline contents',async()=>{
 const a=await scope.StageFrontend.normalize({id:'test-stage',revision:1,plan:sample});
 const b=await scope.StageFrontend.normalize({id:'test-stage',revision:2,plan:sample});
 const changed=structuredClone(sample);changed.shots[0].camera.focal_mm=50;
 const c=await scope.StageFrontend.normalize({id:'test-stage',revision:1,plan:changed});
 assert.notEqual(a.draftKey,b.draftKey);assert.notEqual(a.draftKey,c.draftKey);
 assert.equal(a.draftKey,(await scope.StageFrontend.normalize({id:'test-stage',revision:1,plan:sample})).draftKey);
 a.plan.shots[0].camera.focal_mm=85;assert.equal(sample.shots[0].camera.focal_mm,35);
});
test('project envelope keeps editing baseline and excludes credentials',async()=>{
 const edits={changed:['V01_S01'],snapshot_marks:[],scene_edits:[],deleted_shots:[]};
 const x=await scope.StageFrontend.normalize({id:'sample',revision:2,plan:sample,baseline:sample,edits,can_edit:false,access_token:'not-a-real-token',project_url:'javascript:alert(1)'});
 assert.equal(x.session.can_edit,false);assert(!Object.hasOwn(x.session,'access_token'));assert(!Object.hasOwn(x.session,'project_url'));assert.deepEqual(plain(x.edits),edits);
});
test('invalid geometry, repeated IDs and reserved identities reject',async()=>{
 for(const change of [p=>p.scenes.studio.objects.push(p.scenes.studio.objects[0]),p=>p.scenes.studio.objects[0].size=[0,1,1],p=>p.shots[0].scene='missing',p=>p.scenes.studio.objects[0].id='__proto__']){
  const p=structuredClone(sample);change(p);await assert.rejects(()=>scope.StageFrontend.normalize(p));
 }
});
