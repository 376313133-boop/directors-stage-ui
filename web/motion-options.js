/* The native controls remain the source of truth; these readable choices are their UI. */
(function(scope){
  'use strict';
  const t=(source,vars)=>scope.StageI18n?.t(source,vars)??String(source).replace(/\{(\w+)\}/g,(all,key)=>vars?.[key]??all);
  const bind=(node,key,render)=>{if(scope.StagePanelI18n)return scope.StagePanelI18n.bind(node,key,render);const value=render();if(key.startsWith('@'))node.setAttribute(key.slice(1),value);else node[key]=value;};
  const sourceText=value=>scope.StagePanelI18n?.source(value)??value;
  const groups=[
    {id:'motion-scope',host:'motion-scope-options',label:t('路径范围'),details:{segment:t('只调整选中的一段'),shot:t('重建本镜整条路线')}},
    {id:'motion-direction',host:'motion-direction-options',label:t('路径方向'),details:{'1':t('沿设定方向运动'),'-1':t('沿相反方向运动')}},
    {id:'rig-preset',host:'rig-preset-options',label:t('机身质感'),details:{none:t('不叠加机身晃动'),handheld:t('轻微自然晃动'),shoulder:t('带步态的起伏'),breathing:t('轻微焦距起伏'),fpv:t('根据转向产生侧倾')}},
  ];
scope.StagePanelI18n?.live(groups);
  function optionLabel(option){return t(String(option.label||option.textContent||option.text||option.value));}
  function optionDisabled(option){return !!option.disabled||!!(option.parentElement?.tagName==='OPTGROUP'&&option.parentElement.disabled);}
  function create(doc,editor){
    if(!doc?.getElementById)throw Error('Motion choices need a document.');
    const entries=[],listeners=[];let destroyed=false,frame=0;
    const on=(target,type,handler)=>{target.addEventListener(type,handler);listeners.push(()=>target.removeEventListener(type,handler));};
    const state=()=>editor?.getState?.();
    const readOnly=()=>{const current=state();return !!editor&&(!current?.shot||current.comparison||current.session?.can_edit===false||current.placement?.status==='placing'||current.pendingPreview&&current.selectedTrack!=='camera');};
    function schedule(){
      if(destroyed||frame||typeof scope.requestAnimationFrame!=='function')return;
      frame=scope.requestAnimationFrame(()=>{frame=0;sync();});
    }
    function build(entry){
      entry.buttons=[];entry.host.replaceChildren();
      for(const option of Array.from(entry.control.options||[])){
        const button=doc.createElement('button');button.type='button';button.className='motion-choice';
        button.dataset.motionControl=entry.config.id;button.dataset.value=String(option.value);
        const title=doc.createElement('span');title.className='motion-choice-title';bind(title, 'textContent', ()=>optionLabel(option));
        const detail=()=>entry.config.details[option.value]||'';
        const caption=doc.createElement('small');caption.className='motion-choice-detail';bind(caption, 'textContent', ()=>detail());
        bind(button, 'title', ()=>optionLabel(option)+(detail()?' · '+detail():''));bind(button, '@aria-label', ()=>optionLabel(option));
        button.append(title,caption);
        const choose=()=>{
          // Read current flags again; callbacks can change them between paints.
          if(destroyed||entry.control.disabled||optionDisabled(option)||readOnly())return;
          if(entry.control.value!==String(option.value)){
            entry.control.value=String(option.value);
            const EventType=doc.defaultView?.Event||scope.Event;
            entry.control.dispatchEvent(new EventType('change',{bubbles:true}));
          }
          // Rejected choices (e.g. FPV without a path) may restore the select value.
          sync();schedule();
        };
        button.addEventListener('click',choose);
        entry.buttons.push({button,option,choose});entry.host.append(button);
      }
    }
    function clearButtons(entry){for(const {button,choose} of entry.buttons)button.removeEventListener('click',choose);entry.buttons=[];}
    function sync(){
      if(destroyed)return;
      const readonly=readOnly();
      for(const entry of entries){
        const signature=JSON.stringify(Array.from(entry.control.options||[],o=>[o.value,optionLabel(o),optionDisabled(o)]));
        if(signature!==entry.signature){clearButtons(entry);entry.signature=signature;build(entry);}
        const disabled=readonly||!!entry.control.disabled;
        entry.host.setAttribute('aria-disabled',String(disabled));
        for(const {button,option} of entry.buttons){
          const selected=entry.control.value===String(option.value);
          button.classList.toggle('is-selected',selected);button.setAttribute('aria-pressed',String(selected));
          button.disabled=disabled||optionDisabled(option);
        }
      }
      const summary=doc.getElementById('rig-choice-summary'),rig=entries.find(e=>e.config.id==='rig-preset');
      if(summary&&rig){
        const option=Array.from(rig.control.options||[]).find(o=>String(o.value)===rig.control.value);
        bind(summary, 'textContent', ()=>option?[optionLabel(option),rig.config.details[option.value]].filter(Boolean).join(' · '):'');
      }
      const help=(id,text)=>{const node=doc.getElementById(id);if(node)bind(node, 'textContent', ()=>text);};
      const intensity=doc.getElementById('intensity-slider'),travel=doc.getElementById('travel-slider'),duration=doc.getElementById('motion-duration-slider');
      const following=doc.querySelector?.('[data-motion-preset="track"]')?.getAttribute('aria-pressed')==='true';
      const whole=doc.getElementById('motion-scope')?.value==='shot';
      const cinema=scope.StageCinema?.definitions?.[state()?.shot?.motion_preset];
      if(intensity)help('motion-intensity-help',intensity.disabled?t('选择机身质感后可调整'):t('控制晃动或呼吸幅度'));
      if(travel)help('motion-travel-help',cinema?.fixedTravel?t('固定完整 360° 可用速度调整完成时间'):travel.disabled?(following?t('跟随主体路线'):t('选择运镜预设后调整')):t('调整当前路径的幅度'));
      if(duration)help('motion-duration-help',cinema?t('运动结束后保留停留 镜头总长不变'):duration.disabled?(whole?t('请在时间轴调整镜头时长'):t('请在时间轴调整这一段时长')):(whole?t('控制整条路线的运动时间'):t('控制这一段的运动时间')));
    }
    for(const config of groups){
      const control=doc.getElementById(config.id),host=doc.getElementById(config.host);if(!control||!host)continue;
      const entry={config,control,host,buttons:[],signature:'',wasHidden:control.hidden};entries.push(entry);
      control.hidden=true;host.setAttribute('role','group');bind(host, '@aria-label', ()=>config.label);
      on(control,'change',()=>{sync();schedule();});
    }
    const observer=typeof scope.MutationObserver==='function'?new scope.MutationObserver(sync):null;
    for(const entry of entries)observer?.observe(entry.control,{attributes:true,attributeFilter:['disabled','value','label'],childList:true,subtree:true,characterData:true});
    for(const id of ['intensity-slider','travel-slider','motion-duration-slider']){const input=doc.getElementById(id);if(input)observer?.observe(input,{attributes:true,attributeFilter:['disabled']});}
    if(scope.addEventListener)on(scope,'stage-language-change',()=>{for(const entry of entries)entry.signature='';sync();});
    const unsubscribe=editor?.subscribe?.(sync);sync();
    return {sync,destroy(){destroyed=true;observer?.disconnect();unsubscribe?.();if(frame&&scope.cancelAnimationFrame)scope.cancelAnimationFrame(frame);listeners.forEach(stop=>stop());for(const entry of entries){clearButtons(entry);entry.host.replaceChildren();entry.control.hidden=entry.wasHidden;}}};
  }
  scope.StageMotionOptions={create,groups};
  if(typeof module==='object'&&module.exports)module.exports=scope.StageMotionOptions;
  if(scope.document){
    let mounted=false;
    function connect(){if(mounted||!scope.stageEditor||!scope.document.getElementById('motion-scope-options'))return;mounted=true;scope.stageMotionOptions=create(scope.document,scope.stageEditor);}
    scope.addEventListener('stage-editor-ready',connect);
    if(scope.document.readyState==='loading')scope.document.addEventListener('DOMContentLoaded',connect,{once:true});
    connect();
  }
})(typeof window==='object'?window:globalThis);
