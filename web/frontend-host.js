/* Optional integration boundary. Project data remains independent of a host service. */
(function(scope){
  'use strict';
  const clone=value=>JSON.parse(JSON.stringify(value));
  const point=value=>Array.isArray(value)&&value.length===3&&value.every(Number.isFinite);
  const identity=value=>typeof value==='string'&&value.length>0&&value.length<=160&&!['__proto__','constructor','prototype'].includes(value)&&!/[\x00-\x1f\x7f]/.test(value);
  function validPlan(plan){
    if(!plan||plan.version!==1||!plan.scenes||Array.isArray(plan.scenes)||!Object.keys(plan.scenes).length||!Array.isArray(plan.shots))return false;
    for(const [sceneId,scene] of Object.entries(plan.scenes)){
      if(!identity(sceneId))return false;
      if(!Array.isArray(scene?.objects))return false;
      const ids=new Set();
      for(const object of scene.objects){
        if(!identity(object?.id)||ids.has(object.id)||!['box','sphere','cylinder'].includes(object.shape)||!point(object.position)||!point(object.size)||object.size.some(n=>n<=0))return false;
        ids.add(object.id);
      }
    }
    const ids=new Set();
    for(const shot of plan.shots){
      if(!identity(shot?.id)||!identity(shot.scene)||ids.has(shot.id)||!Object.hasOwn(plan.scenes,shot.scene)||!point(shot.camera?.position)||!point(shot.camera?.target))return false;
      if(shot.duration_s!==undefined&&(!Number.isFinite(shot.duration_s)||shot.duration_s<=0))return false;
      ids.add(shot.id);
    }
    return true;
  }
  async function normalize(value){
    const data=clone(value),plan=data?.plan||data;
    if(!validPlan(plan))throw Error('工程格式无效');
    const baseline=validPlan(data.baseline)?data.baseline:clone(plan);
    const bytes=new TextEncoder().encode(JSON.stringify(baseline));
    const digest=Array.from(new Uint8Array(await scope.crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
    const id=identity(data.id)?data.id:'local-'+digest.slice(0,24);
    const revision=Number.isSafeInteger(data.revision)&&data.revision>0?data.revision:1;
    const session={id,revision,source:'local',can_edit:data.can_edit!==false};
    for(const key of ['project_id','document_id','conversation_id','project_title','shot_id'])if(identity(data[key]))session[key]=data[key];
    const edits=data.edits;
    if(edits&&(!Array.isArray(edits.changed)||!Array.isArray(edits.snapshot_marks)||!Array.isArray(edits.scene_edits)||!Array.isArray(edits.deleted_shots)))throw Error('工程格式无效');
    return {session,plan,baseline,edits:edits||null,draftKey:'directors-stage-ui:'+encodeURIComponent(id)+':'+revision+':'+digest};
  }
  function download(value,name){
    const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=name;link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  scope.StageFrontend={normalize,validPlan,download,clone};
})(window);
