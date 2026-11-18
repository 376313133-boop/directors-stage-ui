const t=(source,vars)=>window.StageI18n?.t(source,vars)??String(source).replace(/\{(\w+)\}/g,(all,key)=>vars?.[key]??all);
  const bind=(node,key,render)=>{if(window.StagePanelI18n)return window.StagePanelI18n.bind(node,key,render);const value=render();if(key.startsWith('@'))node.setAttribute(key.slice(1),value);else node[key]=value;};
  const sourceText=value=>window.StagePanelI18n?.source(value)??value;
const layoutButton=document.getElementById("view-layout"),referenceButton=document.getElementById("view-reference");
const layout=document.getElementById("layout-pane"),pane=document.getElementById("reference-pane");
const video=document.getElementById("reference-video"),status=document.getElementById("reference-state"),retry=document.getElementById("reference-retry"),timeLabel=document.getElementById("reference-time");
let editor,current,key="",activeSource="",generation=0,expires=0,inFlight=false,selected=false,connected=false,failed=false,controller;
function showReference(value) {
  const changed=selected!==value;selected=value;layout.hidden=value;pane.hidden=!value;
  document.getElementById("stage-controls").hidden=value;
  layout.closest(".top-view").classList.toggle("showing-reference",value);
  layoutButton.setAttribute("aria-pressed",String(!value));referenceButton.setAttribute("aria-pressed",String(value));
  document.getElementById("fit").hidden=value;
  if(value && current)load();else video.pause();
  if(changed&&!value){editor?.requestRender?.();window.stageObserve?.render?.();}
}
layoutButton.addEventListener("click",()=>showReference(false));
referenceButton.addEventListener("click",()=>showReference(true));
retry.addEventListener("click",()=>{key="";failed=false;load();});
async function load() {
  if(!current?.shot?.reference || !selected || typeof window.DirectorsStageHost?.getReferenceMedia!=='function')return;
  const reference=current.shot.reference,project=current.session?.project_id || current.session?.id;
  const wanted=project+":"+JSON.stringify(reference);
  if((key===wanted && (failed || !expires || Date.now()/1000<expires-30)) || inFlight)return;
  const serial=++generation;inFlight=true;key=wanted;failed=false;controller=null;
  video.pause();video.removeAttribute("src");video.load();bind(status, 'textContent', ()=>t("正在载入参考…"));retry.hidden=true;
  try {
    const result=await window.DirectorsStageHost.getReferenceMedia({project:current.session,reference});
    const source=typeof result==='string'?result:result?.url;
    if(typeof source!=='string'||!source)throw Error(t('参考地址无效'));
    const url=new URL(source,location.href);
    if(!['https:','http:','blob:'].includes(url.protocol))throw Error(t('参考地址无效'));
    if(serial!==generation)return;
    video.src=url.href;expires=Number(result?.expires_at)||0;video.load();
  } catch(error) {
    if(serial!==generation)return;failed=true;bind(status, 'textContent', ()=>window.StageI18n?.retranslate(error.message)??error.message);retry.hidden=false;
  } finally {if(serial===generation)inFlight=false;}
}
function synchronize() {
  if(!current?.shot?.reference||!selected||video.readyState<1)return;
  const ref=current.shot.reference,start=Number(ref.start_s)||0,end=Number(ref.end_s);
  const duration=Number(current.shot.duration_s||current.shot.motion?.duration_s)||4;
  const time=Number(current.time)||0,span=Number.isFinite(end)?Math.max(.001,end-start):duration;
  const target=Math.min(Math.max(start+Math.min(1,time/duration)*span,0),Math.max(start,start+span-.001),Math.max(0,video.duration-.001));
  const playing=!!current.playing && time<duration;
  if(Math.abs(video.currentTime-target)>(playing?.15:.015))video.currentTime=target;
  video.playbackRate=Math.min(4,Math.max(.25,span/duration));
  if(playing){if(video.paused)video.play().catch(()=>{});}else video.pause();
  bind(timeLabel, 'textContent', ()=>t("原片 {0} 秒 · 本镜 {1} 秒", {0: target.toFixed(2), 1: time.toFixed(2)}));
}
video.addEventListener("loadedmetadata",()=>{bind(status, 'textContent', ()=>"");failed=false;synchronize();});
video.addEventListener("error",()=>{if(video.getAttribute("src")){failed=true;bind(status, 'textContent', ()=>t("参考地址已失效或视频暂不可播放，重新载入会刷新地址。"));retry.hidden=false;}});
function sync(state) {
  current=state;const has=!!state?.shot?.reference&&typeof window.DirectorsStageHost?.getReferenceMedia==='function';
  const desired=has?(state.session?.project_id||state.plan?.project_id)+":"+JSON.stringify(state.shot.reference):"";
  if(desired!==activeSource){activeSource=desired;generation++;controller?.abort();inFlight=false;key="";expires=0;failed=false;video.pause();video.removeAttribute("src");video.load();}
  referenceButton.hidden=!has;
  if(!has){showReference(false);return;}
  if(selected){load();synchronize();}
}
function connect() {
  if(connected || !window.stageEditor)return;
  connected=true;editor=window.stageEditor;editor.subscribe(sync);sync(editor.getState());
}
window.addEventListener("stage-editor-ready",connect);connect();
