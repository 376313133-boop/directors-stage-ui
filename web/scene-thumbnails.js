/* Scene cards show shared geometry, independent of whichever shot is selected. */
(function(scope){
  'use strict';
  function create(list,adapter){
    if(!list||!adapter?.getCommittedState||!adapter?.renderSceneThumbnail)return null;
    const records=new Map(),cache=new Map(),queue=new Set();let revision=null,frame=0,signatures=new Map();
    const schedule=()=>{if(!frame&&queue.size)frame=scope.requestAnimationFrame(draw);};
    const enqueue=record=>{if(record.visible&&record.signature!==signatures.get(record.id)){queue.add(record);schedule();}};
    function draw(){
      frame=0;let count=0;
      for(const record of queue){queue.delete(record);if(!record.visible||!list.contains(record.canvas))continue;
        const signature=signatures.get(record.id);if(!signature||record.signature===signature)continue;
        let cached=cache.get(record.id);
        if(cached?.signature!==signature){const canvas=list.ownerDocument.createElement('canvas');canvas.width=160;canvas.height=90;if(adapter.renderSceneThumbnail(record.id,canvas)===false)continue;cached={signature,canvas};cache.set(record.id,cached);}
        const ctx=record.canvas.getContext('2d');ctx.clearRect(0,0,160,90);ctx.drawImage(cached.canvas,0,0);record.canvas.dataset.ready='true';record.signature=signature;
        if(++count===2)break;
      }
      schedule();
    }
    const observer=scope.IntersectionObserver?new scope.IntersectionObserver(entries=>{for(const entry of entries){const record=records.get(entry.target);if(record){record.visible=entry.isIntersecting;if(record.visible)enqueue(record);else queue.delete(record);}}}):null;
    function collect(){
      const found=new Set(list.querySelectorAll('.scene-thumbnail[data-scene-id]'));
      for(const [canvas,record]of records)if(!found.has(canvas)){observer?.unobserve(canvas);queue.delete(record);records.delete(canvas);}
      for(const canvas of found){if(records.has(canvas))continue;canvas.width=160;canvas.height=90;const record={canvas,id:canvas.dataset.sceneId,visible:!observer,signature:null};records.set(canvas,record);observer?.observe(canvas);enqueue(record);}
    }
    function refresh(){const state=adapter.getCommittedState();if(state.revision===revision)return;revision=state.revision;signatures=new Map(Object.entries(state.plan?.scenes||{}).map(([id,scene])=>[id,JSON.stringify(scene)]));for(const id of cache.keys())if(!signatures.has(id))cache.delete(id);for(const record of records.values())enqueue(record);}
    const mutation=scope.MutationObserver?new scope.MutationObserver(collect):null;mutation?.observe(list,{childList:true,subtree:true});
    const unsubscribe=adapter.subscribe(refresh);refresh();collect();
    return {destroy(){observer?.disconnect();mutation?.disconnect();unsubscribe?.();if(frame)scope.cancelAnimationFrame(frame);queue.clear();cache.clear();records.clear();}};
  }
  scope.StageSceneThumbnails={create};
  if(typeof document!=='undefined'){
    let mounted=false;function connect(){if(mounted||!scope.stageEditor)return;const list=document.getElementById('shot-list');if(!list)return;mounted=true;create(list,scope.stageEditor);}
    scope.addEventListener('stage-editor-ready',connect);connect();
  }
})(typeof window!=='undefined'?window:globalThis);
