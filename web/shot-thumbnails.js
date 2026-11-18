/* Sidebar stills use applied shot data only; observing or trying a camera never redraws them. */
(function(scope){
  'use strict';
  const t=(source,vars)=>scope.StageI18n?.t(source,vars)??String(source).replace(/\{(\w+)\}/g,(all,key)=>vars?.[key]??all);
  const WIDTH=160,HEIGHT=90;
  function create(list,adapter){
    if(!list||!adapter?.getCommittedState||!adapter?.renderShotThumbnail)return null;
    const document=list.ownerDocument,records=new Map(),cache=new Map(),sceneKeys=new Map(),queue=new Set();
    let desired=new Map(),lastRevision=Symbol('initial'),sceneVersion=0,frame=0,destroyed=false;
    const raf=scope.requestAnimationFrame||((callback)=>scope.setTimeout(callback,16));
    const caf=scope.cancelAnimationFrame||scope.clearTimeout;
    const open=button=>{
      for(let parent=button.parentElement;parent&&parent!==list;parent=parent.parentElement){
        if(parent.hidden||(parent.tagName==='DETAILS'&&!parent.open))return false;
      }
      return !button.hidden&&list.contains(button);
    };
    function fallbackVisible(button){
      const box=button.getBoundingClientRect();
      return box.width>0&&box.height>0&&box.bottom>0&&box.right>0&&
        box.top<(scope.innerHeight||document.documentElement.clientHeight)&&
        box.left<(scope.innerWidth||document.documentElement.clientWidth);
    }
    function enqueue(record){
      const key=desired.get(record.id);
      if(key!==undefined&&record.key!==key&&record.visible&&open(record.button))queue.add(record);
    }
    function schedule(){
      if(!frame&&!destroyed&&queue.size)frame=raf(drawBatch);
    }
    function drawBatch(){
      frame=0;if(destroyed)return;
      let drawn=0;
      for(const record of queue){
        queue.delete(record);
        if(!records.has(record.button)||!record.visible||!open(record.button))continue;
        const key=desired.get(record.id);
        if(key===undefined||record.key===key)continue;
        let still=cache.get(record.id);
        if(still?.key!==key){
          const canvas=document.createElement('canvas');canvas.width=WIDTH;canvas.height=HEIGHT;
          let rendered=false;
          try{rendered=adapter.renderShotThumbnail(record.id,canvas)!==false;}catch(error){
            scope.console?.warn(t('镜头缩略图暂时不可用'),error?.name||'Error');
          }
          if(rendered){still={key,canvas};cache.set(record.id,still);}
          else still=null;
        }
        const context=record.canvas.getContext('2d');
        context.clearRect(0,0,WIDTH,HEIGHT);
        if(still)context.drawImage(still.canvas,0,0,WIDTH,HEIGHT);
        record.canvas.dataset.ready=still?'true':'false';
        record.key=key;
        if(++drawn>=2)break;
      }
      schedule();
    }
    const intersection=scope.IntersectionObserver?new scope.IntersectionObserver(entries=>{
      for(const entry of entries){
        const record=records.get(entry.target);if(!record)continue;
        record.visible=entry.isIntersecting;
        if(record.visible)enqueue(record);else queue.delete(record);
      }
      schedule();
    },{root:null,threshold:0}):null;
    function collect(){
      if(destroyed)return;
      const buttons=new Set(list.querySelectorAll('.shot-button[data-shot-id]'));
      for(const [button,record] of records){
        if(buttons.has(button)&&record.id===button.dataset.shotId)continue;
        intersection?.unobserve(button);queue.delete(record);records.delete(button);
      }
      for(const button of buttons){
        if(records.has(button))continue;
        let canvas=button.querySelector('.shot-thumbnail');
        if(!canvas){canvas=document.createElement('canvas');canvas.className='shot-thumbnail';button.prepend(canvas);}
        canvas.width=WIDTH;canvas.height=HEIGHT;canvas.setAttribute('aria-hidden','true');canvas.dataset.ready='false';
        const record={button,canvas,id:button.dataset.shotId,key:null,visible:intersection?false:fallbackVisible(button)};
        records.set(button,record);intersection?.observe(button);enqueue(record);
      }
      schedule();
    }
    function refresh(force=false){
      if(destroyed)return;
      const state=adapter.getCommittedState(),plan=state?.plan;
      if(!plan)return;
      // The adapter increments revision only on confirmed changes, never on playback frames.
      const revision=state.revision??plan;
      if(!force&&lastRevision===revision)return;
      lastRevision=revision;
      const existingScenes=new Set();
      for(const [id,scene] of Object.entries(plan.scenes||{})){
        existingScenes.add(id);
        const signature=JSON.stringify(scene),previous=sceneKeys.get(id);
        if(previous?.signature!==signature)sceneKeys.set(id,{signature,version:++sceneVersion});
      }
      for(const id of sceneKeys.keys())if(!existingScenes.has(id))sceneKeys.delete(id);
      const output=JSON.stringify(plan.output||{});
      desired=new Map((plan.shots||[]).map(shot=>[shot.id,JSON.stringify([shot,sceneKeys.get(shot.scene)?.version,output])]));
      for(const id of cache.keys())if(!desired.has(id))cache.delete(id);
      for(const record of records.values())enqueue(record);
      schedule();
    }
    function onVisibility(){
      if(destroyed)return;
      for(const record of records.values()){
        if(!intersection)record.visible=fallbackVisible(record.button);
        enqueue(record);
      }
      schedule();
    }
    const mutation=scope.MutationObserver?new scope.MutationObserver(collect):null;
    mutation?.observe(list,{childList:true,subtree:true});
    list.addEventListener('toggle',onVisibility,true);
    scope.addEventListener?.('scroll',onVisibility,true);
    scope.addEventListener?.('resize',onVisibility);
    const unsubscribe=adapter.subscribe?.(()=>refresh());
    collect();refresh();
    return {
      refresh:()=>{collect();refresh(true);onVisibility();},
      destroy(){
        destroyed=true;if(frame)caf(frame);frame=0;queue.clear();records.clear();cache.clear();sceneKeys.clear();
        intersection?.disconnect();mutation?.disconnect();unsubscribe?.();
        list.removeEventListener('toggle',onVisibility,true);
        scope.removeEventListener?.('scroll',onVisibility,true);
        scope.removeEventListener?.('resize',onVisibility);
      }
    };
  }
  scope.StageShotThumbnails={create};
  if(scope.document){
    const mount=()=>{const list=scope.document.getElementById('shot-list');if(list&&scope.stageEditor)scope.stageShotThumbnails=create(list,scope.stageEditor);};
    if(scope.document.readyState==='loading')scope.document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
  }
})(globalThis);
