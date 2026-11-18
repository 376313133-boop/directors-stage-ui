const t=(source,vars)=>window.StageI18n?.t(source,vars)??String(source).replace(/\{(\w+)\}/g,(all,key)=>vars?.[key]??all);
  const bind=(node,key,render)=>{if(window.StagePanelI18n)return window.StagePanelI18n.bind(node,key,render);const value=render();if(key.startsWith('@'))node.setAttribute(key.slice(1),value);else node[key]=value;};
  const sourceText=value=>window.StagePanelI18n?.source(value)??value;
const host=document.getElementById('state-editor');
const presets={show:[t('出现'),t('恢复可见')],hide:[t('消失'),t('保持隐藏')],teleport:[t('瞬移'),t('此刻直接换位置')],jump:[t('跳跃'),t('落回原路线')],fall:[t('倒下'),t('倒地后保持')],rise:[t('起身'),t('恢复直立')],break:[t('破碎消失'),t('碎块散开后隐藏')],restore:[t('恢复完整'),t('恢复完整物体')],shake:[t('抖动'),t('短暂晃动后恢复')]};
window.StagePanelI18n?.live(presets);
const durationTypes=new Set(['jump','fall','rise','break','shake']);
let api,state,selectedEvent=null,signature='',drag=null,connected=false;
host.innerHTML=`<div class="setting-head"><div><h2>主体状态</h2><p>先选主体，拖到发生的时刻，再添加状态。路线决定位置，状态决定这一刻的样子。</p></div><span id="state-now" class="mono"></span></div><div class="state-target"><label for="state-subject">作用主体</label><select id="state-subject" aria-label="状态作用主体"></select><span id="state-current" role="status"></span></div><div class="state-presets"></div><div class="state-rail" aria-label="主体状态时间线"></div><div class="state-event-list"></div><div class="state-detail" hidden><div class="state-detail-head"><strong id="state-selection"></strong><button id="state-remove" type="button">移除此状态</button></div><label class="state-range"><span data-state-label="发生时刻">发生时刻</span><input id="state-at" type="range" min="0" step="0.04166667" aria-label="拖动状态发生时刻"><output id="state-at-value"></output></label><label class="state-range" id="state-duration-row"><span data-state-label="动作时长">动作时长</span><input id="state-duration" type="range" min="0.1" max="5" step="0.05" aria-label="拖动状态动作时长"><output id="state-duration-value"></output></label><label class="state-range" id="state-height-row"><span data-state-label="跳起高度">跳起高度</span><input id="state-height" type="range" min="0.1" max="5" step="0.05" aria-label="跳跃高度"><output id="state-height-value"></output></label><div id="state-offsets" hidden><p>瞬移是相对当前位置的偏移，后续路线会一起偏移。</p></div><p id="state-explanation" class="state-explanation"></p></div><p id="state-empty" class="state-empty">该主体还没有状态。拖动时间轴后，点击上方预设。</p>`;
const el=id=>document.getElementById(id),rail=host.querySelector('.state-rail'),list=host.querySelector('.state-event-list'),detail=host.querySelector('.state-detail');
const fmt=n=>Number(n.toFixed(2));
for(const [selector,key] of [
 ['.setting-head h2','主体状态'],['.setting-head p','先选主体，拖到发生的时刻，再添加状态。路线决定位置，状态决定这一刻的样子。'],
 ['.state-target label','作用主体'],['#state-remove','移除此状态'],['#state-offsets p','瞬移是相对当前位置的偏移，后续路线会一起偏移。'],
 ['#state-empty','该主体还没有状态。拖动时间轴后，点击上方预设。'],
 ['[data-state-label="发生时刻"]','发生时刻'],['[data-state-label="动作时长"]','动作时长'],['[data-state-label="跳起高度"]','跳起高度']
]){const node=host.querySelector(selector);if(node)bind(node,'textContent',()=>t(key));}
for(const [selector,key] of [['#state-subject','状态作用主体'],['.state-rail','主体状态时间线'],['#state-at','拖动状态发生时刻'],['#state-duration','拖动状态动作时长'],['#state-height','跳跃高度']]){const node=host.querySelector(selector);if(node)bind(node,'@aria-label',()=>t(key));}
for(const [type,[name,hint]] of Object.entries(presets)){
  const b=document.createElement('button');b.type='button';b.dataset.stateType=type;
  const title=document.createElement('strong');bind(title, 'textContent', ()=>presets[type][0]);const small=document.createElement('small');bind(small, 'textContent', ()=>presets[type][1]);b.append(title,small);
  b.addEventListener('click',()=>{
    if(!api||!state?.selectedEntity)return;
    const e=api.addStateEvent(type,{duration_s:type==='jump'?.8:.6,height_m:1,offset:[1,0,0]});
    selectedEvent=e?.id||e||null;signature='';sync(api.getState());
  });host.querySelector('.state-presets').append(b);
}
for(const [i,label] of ['左右偏移','上下偏移','前后偏移'].entries()){
  const wrap=document.createElement('label');wrap.className='state-range';const labelText=document.createElement('span');bind(labelText,'textContent',()=>t(label));wrap.append(labelText);
  const input=document.createElement('input');input.type='range';input.min='-10';input.max='10';input.step='.05';input.id='state-offset-'+i;bind(input, '@aria-label', ()=>t('瞬移')+' '+t(label));
  const output=document.createElement('output');output.id=input.id+'-value';wrap.append(input,output);el('state-offsets').append(wrap);
  bindRange(input,()=>{const e=selected();if(e)edit({offset:[0,1,2].map(j=>Number(el('state-offset-'+j).value))});});
}
function events(){return state?.shot?.state_events?.[state.selectedEntity]||[];}
function selected(){return events().find(e=>e.id===selectedEvent);}
function stateReadOnly(){return state?.session?.can_edit===false||!!state?.comparison||!!state?.pendingPreview;}
function removeEvent(rootId,eventId){
  if(!api||stateReadOnly()||rootId!==state.selectedEntity)return;
  api.removeStateEvent(rootId,eventId);
  const next=api.getState();
  if(selectedEvent===eventId&&!next.shot?.state_events?.[rootId]?.some(e=>e.id===eventId))selectedEvent=null;
  signature='';sync(next);
}
function edit(patch){if(selected())api.updateStateEvent(state.selectedEntity,selectedEvent,patch);}
function bindRange(input,handler){
  input.addEventListener('pointerdown',()=>api?.beginEdit?.());input.addEventListener('keydown',()=>api?.beginEdit?.());
  input.addEventListener('input',()=>{handler();sync(api.getState());});
  for(const name of ['change','pointerup','pointercancel','keyup','blur'])input.addEventListener(name,()=>api?.endEdit?.());
}
bindRange(el('state-at'),()=>edit({at_s:Number(el('state-at').value)}));
bindRange(el('state-duration'),()=>edit({duration_s:Number(el('state-duration').value)}));
bindRange(el('state-height'),()=>edit({height_m:Number(el('state-height').value)}));
el('state-subject').addEventListener('change',()=>{selectedEvent=null;api.chooseSubject(el('state-subject').value);});
el('state-remove').addEventListener('click',()=>{if(selected())removeEvent(state.selectedEntity,selectedEvent);});
function select(id){selectedEvent=id;const event=selected();if(event)api.seek(event.at_s);signature='';sync(api.getState());}
function paintEvents(){
  if(drag)return;
  const readonly=stateReadOnly(),rootId=state.selectedEntity;
  const key=JSON.stringify([state?.shot?.id,rootId,events(),selectedEvent,readonly]);if(key===signature)return;signature=key;rail.replaceChildren();list.replaceChildren();
  const total=state.shot.duration_s||state.shot.motion?.duration_s||4;
  for(const e of events()){
    const button=document.createElement('button');button.type='button';button.className='state-pin';bind(button, 'textContent', ()=>presets[e.type]?.[0]||e.type);button.style.left=(e.at_s/total*100)+'%';bind(button, '@aria-label', ()=>t("{0} {1} 秒，左右拖动调时间", {0: button.textContent, 1: fmt(e.at_s)}));button.setAttribute('aria-pressed',String(e.id===selectedEvent));
    button.addEventListener('pointerdown',event=>{if(event.button!==0||state.session?.can_edit===false)return;event.preventDefault();selectedEvent=e.id;api.beginEdit?.();drag={id:event.pointerId,element:button,eventId:e.id,root:state.selectedEntity,rect:rail.getBoundingClientRect(),duration:total};button.setPointerCapture(event.pointerId);api.seek(e.at_s);});
    button.addEventListener('pointermove',event=>{if(drag?.id!==event.pointerId)return;const t=Math.max(0,Math.min(drag.duration,(event.clientX-drag.rect.left)/drag.rect.width*drag.duration));api.updateStateEvent(drag.root,drag.eventId,{at_s:t});button.style.left=t/drag.duration*100+'%';});
    const end=event=>{if(drag?.id!==event.pointerId)return;drag=null;api.endEdit?.();signature='';sync(api.getState());};
    button.addEventListener('pointerup',end);button.addEventListener('pointercancel',end);button.addEventListener('lostpointercapture',end);
    button.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();api.updateStateEvent(state.selectedEntity,e.id,{at_s:e.at_s+(event.key==='ArrowRight'?1:-1)/(state.plan.output?.fps||24)});}if(event.key==='Enter')select(e.id);});
    const chip=document.createElement('div');chip.className='state-chip';chip.classList.toggle('is-selected',e.id===selectedEvent);
    const choose=document.createElement('button');choose.type='button';choose.className='state-chip-select';bind(choose, 'textContent', ()=>`${fmt(e.at_s)}s · ${presets[e.type]?.[0]||e.type}`);choose.setAttribute('aria-pressed',String(e.id===selectedEvent));choose.addEventListener('click',()=>select(e.id));
    const remove=document.createElement('button');remove.type='button';remove.className='state-chip-remove';bind(remove, 'textContent', ()=>'×');remove.disabled=readonly;
    bind(remove, '@aria-label', ()=>t("移除 {0} 秒{1}", {0: fmt(e.at_s), 1: presets[e.type]?.[0]||e.type}));bind(remove, 'title', ()=>t('移除此状态'));
    remove.addEventListener('pointerdown',event=>event.stopPropagation());
    remove.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();removeEvent(rootId,e.id);});
    chip.append(choose,remove);rail.append(button);list.append(chip);
  }
}
function range(id,value,unit){const input=el(id);if(document.activeElement!==input)input.value=value;bind(el(id+'-value'), 'textContent', ()=>fmt(value)+unit);}
function sync(next){
  state=next;if(!state?.shot){host.hidden=true;return;}host.hidden=false;
  const objects=state.plan.scenes[state.shot.scene].objects.filter(o=>!o.parent_id&&!o.id.endsWith('_head'));
  const options=(window.StageI18n?.locale||'zh')+JSON.stringify(objects.map(o=>[o.id,o.label||o.name||o.id]));
  if(el('state-subject').dataset.options!==options){el('state-subject').replaceChildren(new Option(t('选择主体'),''),...objects.map(o=>new Option(window.StageI18n?.demoText(o.label||o.name||o.id)||o.label||o.name||o.id,o.id)));el('state-subject').dataset.options=options;}
  el('state-subject').value=state.selectedEntity||'';bind(el('state-now'), 'textContent', ()=>t("当前 {0} 秒", {0: fmt(state.time||0)}));
  const readonly=stateReadOnly();
  for(const b of host.querySelectorAll('.state-presets button'))b.disabled=readonly||!state.selectedEntity;
  const previous=events().filter(e=>e.at_s<=state.time).at(-1);bind(el('state-current'), 'textContent', ()=>previous?t("最近状态：{0} · {1} 秒", {0: presets[previous.type]?.[0]||previous.type, 1: fmt(previous.at_s)}):t('拖到状态发生的时刻再添加'));
  paintEvents();const event=selected();detail.hidden=!event;el('state-empty').hidden=events().length>0;rail.hidden=!events().length;
  if(!event)return;
  bind(el('state-selection'), 'textContent', ()=>presets[event.type]?.[0]||event.type);
  el('state-at').max=state.shot.duration_s||state.shot.motion?.duration_s||4;range('state-at',event.at_s,' s');range('state-duration',event.duration_s||.6,' s');range('state-height',event.height_m||1,' m');
  el('state-duration-row').hidden=!durationTypes.has(event.type);el('state-height-row').hidden=event.type!=='jump';el('state-offsets').hidden=event.type!=='teleport';
  for(let i=0;i<3;i++)range('state-offset-'+i,event.offset?.[i]||0,' m');
  bind(el('state-explanation'), 'textContent', ()=>['hide','show','fall','rise','break','restore','teleport'].includes(event.type)?t('发生后保持结果；需要恢复时，在后面的时刻再添加对应状态。'):t('动作结束后回到正常路线。拖动上方时间轴查看前、中、后的变化。'));
  for(const element of detail.querySelectorAll('input,button'))element.disabled=readonly;
}
function connect(){if(connected||!window.stageEditor?.addStateEvent)return;connected=true;api=window.stageEditor;api.subscribe(sync);sync(api.getState());}
window.addEventListener('stage-editor-ready',connect);window.addEventListener('stage-language-change',()=>{signature='';if(api)sync(api.getState());});connect();
