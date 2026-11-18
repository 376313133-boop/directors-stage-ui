/* Shot removal is local and reversible. External project assets are never deleted here. */
(function(scope){
  'use strict';
  function create(doc,adapter){
    if(!doc?.body||!adapter?.getShotManagementState)return null;
    const t=(key,vars)=>scope.StageI18n?.t(key,vars)??key.replace(/\{(\w+)\}/g,(m,k)=>vars?.[k]??m);
    const toast=doc.createElement('section'),copy=doc.createElement('div'),message=doc.createElement('strong'),hint=doc.createElement('span'),undo=doc.createElement('button'),close=doc.createElement('button');
    toast.id='shot-delete-toast';toast.className='shot-delete-toast';toast.hidden=true;toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');
    copy.className='shot-delete-toast-copy';undo.type=close.type='button';undo.className='shot-delete-undo';close.className='shot-delete-dismiss';close.textContent='×';copy.append(message,hint);toast.append(copy,undo,close);doc.body.append(toast);
    let dismissed=null,destroyed=false,lastButtonKey="",lastToastKey="";
    const sync=()=>{if(destroyed)return;const s=adapter.getShotManagementState(),locale=scope.StageI18n?.locale||'zh',buttonKey=[adapter.getCommittedState?.().revision,s.canDelete,locale].join(':');
      if(buttonKey!==lastButtonKey){lastButtonKey=buttonKey;const shots=new Map((adapter.getState().plan?.shots||[]).map(shot=>[shot.id,shot]));for(const button of doc.querySelectorAll('[data-delete-shot-id]')){const shot=shots.get(button.dataset.deleteShotId);button.disabled=!s.canDelete||!shot;button.title=t('删除镜头');button.setAttribute('aria-label',t('删除镜头 {name}',{name:shot?.title||shot?.id||''}));}}
      const current=s.undoDeletion,toastKey=[current?.sequence,current?.title,dismissed,locale].join(':');if(toastKey===lastToastKey)return;lastToastKey=toastKey;toast.hidden=!current||current.sequence===dismissed;
      if(current){message.textContent=t('已删除「{name}」',{name:current.title});message.title=current.title;}
      hint.textContent=t('仅移除片场镜头，原项目素材保留');undo.textContent=t('撤销删除');undo.disabled=!current;close.setAttribute('aria-label',t('关闭删除提示'));
    };
    const undoAction=()=>{adapter.undoShotDeletion();sync();};const dismiss=()=>{dismissed=adapter.getShotManagementState().undoDeletion?.sequence;sync();};
    undo.addEventListener('click',undoAction);close.addEventListener('click',dismiss);scope.addEventListener('stage-language-change',sync);
    const unsubscribe=adapter.subscribe(sync);sync();
    return {sync,destroy(){destroyed=true;unsubscribe?.();scope.removeEventListener('stage-language-change',sync);undo.removeEventListener('click',undoAction);close.removeEventListener('click',dismiss);toast.remove();}};
  }
  scope.StageShotManager={create};
  if(scope.document){let mounted=false;const mount=()=>{if(mounted||!scope.stageEditor)return;mounted=true;scope.stageShotManager=create(scope.document,scope.stageEditor);};scope.addEventListener('stage-editor-ready',mount);if(scope.document.readyState==='loading')scope.document.addEventListener('DOMContentLoaded',mount,{once:true});mount();}
})(typeof window!=='undefined'?window:globalThis);
