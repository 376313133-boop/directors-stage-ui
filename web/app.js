const el = name => document.getElementById(name);
const demoText = value => window.StageI18n?.demoText(value) ?? value;
const t = (source,...values) => window.StageI18n?.t(source,...values) ?? (Array.isArray(source)?source.reduce((text,part,index)=>text+(index?values[index-1]:"")+part,""):String(source??"").replace(/\{([\w]+)\}/g,(match,key)=>Object.hasOwn(values[0]||{},key)?String(values[0][key]??""):match));
const compactLabel = (value,fallback='',kind='label') => window.StageNaming?.compact(value,{fallback,kind}).text || value || fallback;
const shotName = s => compactLabel(demoText(s?.title),s?.id||t('镜头'),'shot');
document.title = window.StageI18n?.locale === "zh" || !window.StageI18n ? "导演片场 · Director’s Stage" : "Director’s Stage";
const ui = Object.fromEntries(Array.from(document.querySelectorAll("[id]"), item => [item.id, item]));
const map = ui.map;
const preview = ui.preview;
const mapCtx = map.getContext("2d");
const viewCtx = preview.getContext("2d");
const params = new URLSearchParams(location.search);
const hash = location.hash.slice(1);
let draftKey = null;
let draftStorageFailed = false;
const radians = Math.PI / 180;
const defaultLens = 35;
const tools = { camera: "#d7dce3", target: "#79bfcf", object: "#c8ed92" };

let plan, session, selectedShot, selectedEntity, canvasFit, drag;
let sceneOverview = null;
let navigationMode = "video";
let navigationMessage = "";
const sceneLastShot = new Map();
const navigationOpen = new Map();
const canEdit = () => !sceneOverview && session?.can_edit !== false;
const canHandoff = () => session?.can_edit !== false;
let snapshotMarks=[];
let deletedShots=new Set();
let lastShotDeletion=null;
let shotDeletionSequence=0;
let sceneEdits=new Set();
let geometryEditor=null;
let geometryPlacement=null,placementSequence=0;
let geometryPlacementStatus={status:"idle",sequence:0};
let locatedObjectId=null;
let trialEdit=null,presetContext=null,selectedSegment=null;
let committedRevision=0;
let savedMapFit;
let previewPan;
let panPress;
let time = 0;
let changed = new Set();
let playing = null;
let lastFrame = 0;
let preferredMarker = "camera";
let pendingRender = false;
// Cache only within one synchronous render pass; authored data may mutate between frames.
let frameSamples = null;
const sliderRangeValues = new WeakMap();
let orbitDrag = null;
let orbitBranch = null;
let activePreset = null;
let presetTab = "basic";
const cinemaDefinition = kind => window.StageCinema?.definitions?.[kind];
const subjectTimeLocked = () => Boolean(shot()?.time_effect);
let presetCamera = null;
let presetShot = null;
const presetStates = new Map();
let lensSelected = null;
let warpMap = null;
let timingSignature = "";
let videoByShot = new Map();
let pathTimeline = null;
let originalPlan = null;
const editorSubscribers = new Set();
window.addEventListener("stage-local-branch",()=>notice(t("另一个窗口也有修改。两份草稿已分别保留，重新打开时可以选择，不会互相覆盖。")));
const undoStack = [], redoStack = [];
let historyBaseline = null, editTransaction = null, restoringHistory = false;
let localSaveTimer = null;


const clamp = (x, min, max) => Math.min(max, Math.max(min, x));
const add = (a,b) => a.map((x,i) => x+b[i]);
const sub = (a,b) => a.map((x,i) => x-b[i]);
const mul = (a,s) => a.map(x => x*s);
const dot = (a,b) => a.reduce((sum,x,i) => sum+x*b[i],0);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit = a => mul(a,1/Math.max(1e-8,Math.hypot(...a)));
const mix = (a,b,t) => a+(b-a)*t;
const lerp = (a,b,t) => a.map((x,i) => mix(x,b[i],t));
const round = (n,d=3) => Number(n.toFixed(d));
const copy = x => structuredClone(x);
const shot = () => plan?.shots.find(s => s.id===selectedShot) || sceneOverview;
const scene = () => plan.scenes[shot().scene];
const duration = s => Number(s.duration_s || s.motion?.duration_s || 4);
const authoredTiming = s => s.motion?.timing_mode === "arrival";
const timeEpsilon = .00001;
const wrapDegrees = degrees => ((degrees + 180) % 360 + 360) % 360 - 180;
const cameraMotionTime = (s, at) => clamp(at * duration(s) / (s.motion?.duration_s || duration(s)), 0, 1);
const cleanPoint = point => point.map(n => round(n, 5));
const rotateY = ([x,y,z], angle) => {
  const r=angle*radians, c=Math.cos(r), s=Math.sin(r);
  return [x*c+z*s,y,z*c-x*s];
};

function spherical(camera) {
  const p = sub(camera.position,camera.target);
  const dist = Math.max(.025,Math.hypot(...p));
  return {yaw:Math.atan2(p[0],p[2])/radians, pitch:Math.asin(clamp(p[1]/dist,-1,1))/radians, dist};
}

function orbitPosition(camera, {yaw,pitch,dist}) {
  // Keep the view basis defined at the two poles. A continued sweep still
  // crosses to the other side and retains the operator's yaw and roll.
  const a=yaw*radians;
  const e=(Math.abs(pitch)===90?Math.sign(pitch)*89.99:pitch)*radians;
  return cleanPoint(add(camera.target,[dist*Math.cos(e)*Math.sin(a),dist*Math.sin(e),dist*Math.cos(e)*Math.cos(a)]));
}

function orbitRead(camera) {
  const pose = spherical(camera);
  if(orbitBranch?.shot===selectedShot && orbitBranch.time===time &&
    Math.hypot(...sub(camera.position,orbitBranch.position))<1e-4 &&
    Math.hypot(...sub(camera.target,orbitBranch.target))<1e-4) return orbitBranch.pose;
  return pose;
}

function setOrbit(update) {
  updateCamera(camera=>{
    const before=orbitRead(camera), pose={...before,...update};
    const inverted=Math.abs(pose.pitch)>90, wasInverted=Math.abs(before.pitch)>90;
    if(inverted!==wasInverted) camera.roll_deg=wrapDegrees((camera.roll_deg||0)+(inverted?180:-180));
    camera.position=orbitPosition(camera,pose);
    orbitBranch={shot:selectedShot,time,pose,position:[...camera.position],target:[...camera.target]};
  });
}

function cameraResetBaseline(current,parameter) {
  const value=c=>parameter==="distance"?spherical(c).dist:parameter==="height"?c.position[1]:c.focal_mm||defaultLens;
  const candidates=[trialEdit?.before,editTransaction?.before,...undoStack.slice().reverse()].filter(Boolean);
  for(const snapshot of candidates){
    if(snapshot.shotId!==selectedShot||Math.abs(snapshot.time-time)>.5/fps()/duration(shot()))continue;
    const source=snapshot.plan.shots.find(s=>s.id===selectedShot);if(!source)continue;
    const previous=sampleBaseCamera(source,time);
    if(Math.abs(value(previous)-value(current))>1e-8)return previous;
  }
  return current;
}

function applyCameraReset(candidate) {
  if(!plan||!canEdit()||comparisonActive())return false;
  if(trialEdit&&(trialEdit.kind!=="camera"||trialEdit.shotId!==selectedShot||Math.abs(time-trialEdit.time)>1e-5)){
    endEdit();
  }
  const current=sampleBaseCamera(shot(),time);
  if([...candidate.position,...candidate.target].some(n=>!Number.isFinite(n)||Math.abs(n)>1000)||
    Math.hypot(...sub(candidate.position,candidate.target))<.025){
    notice(t("这个调整会使摄影机与注视点重合或超出场地范围，请先调整距离。"));return false;
  }
  const fields=["position","target","focal_mm","roll_deg"];
  const same=fields.every(field=>{
    const a=candidate[field]??(field==="focal_mm"?defaultLens:0),b=current[field]??(field==="focal_mm"?defaultLens:0);
    return Array.isArray(a)?a.every((v,i)=>Math.abs(v-b[i])<1e-8):Math.abs(a-b)<1e-8;
  });
  if(same){orbitBranch=null;invalidate();return false;}
  pause();let applied=false;
  updateCamera(camera=>{
    // Alignment is explicit: a composition constraint must not move it back.
    if(shot().edit_locks)delete shot().edit_locks.composition;
    for(const field of fields)if(candidate[field]!==undefined)camera[field]=copy(candidate[field]);
    orbitBranch=null;applied=true;
  });
  return applied;
}

function quickCameraAlignment(action) {
  if(!plan||!canEdit()||comparisonActive())return false;
  const camera=copy(sampleBaseCamera(shot(),time)),pose=spherical(camera);
  if(action==="reset-orientation")camera.position=add(camera.target,[0,0,pose.dist]);
  else if(action==="level")camera.position=add(camera.target,[pose.dist*Math.sin(pose.yaw*radians),0,pose.dist*Math.cos(pose.yaw*radians)]);
  else if(action==="top")camera.position=add(camera.target,[0,pose.dist,0]);
  else return false;
  camera.roll_deg=0;
  return applyCameraReset(camera);
}

function resetCameraParameter(parameter) {
  if(!plan||!canEdit()||comparisonActive())return false;
  const current=sampleBaseCamera(shot(),time),camera=copy(current),pose=spherical(current),baseline=cameraResetBaseline(current,parameter);
  if(parameter==="yaw")camera.position=add(camera.target,[0,pose.dist*Math.sin(pose.pitch*radians),pose.dist*Math.cos(pose.pitch*radians)]);
  else if(parameter==="pitch")camera.position=add(camera.target,[pose.dist*Math.sin(pose.yaw*radians),0,pose.dist*Math.cos(pose.yaw*radians)]);
  else if(parameter==="roll")camera.roll_deg=0;
  else if(parameter==="distance")camera.position=add(camera.target,mul(unit(sub(current.position,current.target)),spherical(baseline).dist));
  else if(parameter==="height")camera.position[1]=baseline.position[1];
  else if(parameter==="focal")camera.focal_mm=baseline.focal_mm||defaultLens;
  else return false;
  return applyCameraReset(camera);
}

for(const button of document.querySelectorAll("[data-camera-action]"))button.addEventListener("click",()=>quickCameraAlignment(button.dataset.cameraAction));
for(const button of document.querySelectorAll("[data-camera-param]"))button.addEventListener("click",()=>resetCameraParameter(button.dataset.cameraParam));

function sliderDisplay(id,value,suffix="") {
  const input = ui[id];
  if (!input) return;
  const outside=value<Number(input.min)||value>Number(input.max);
  if(outside && /^(subject-|distance-|height-)/.test(id)) {
    input.min=Math.min(value,Number(input.min));
    input.max=Math.max(value,Number(input.max));
  }
  if ((document.activeElement!==input || !input.matches(":active")) && String(input.value)!==String(value)) input.value = value;
  const readout = ui[id+"-value"], label=value+suffix;
  if (readout && readout.textContent!==label) readout.textContent=label;
  const range=`${clamp((Number(input.value)-Number(input.min))/Math.max(.000001,Number(input.max)-Number(input.min)),0,1)*100}%`;
  if(sliderRangeValues.get(input)!==range){input.style.setProperty("--range",range);sliderRangeValues.set(input,range);}
}

function bindSlider(id, handler) {
  ui[id]?.addEventListener("input", event=>{
    if (!plan || !canEdit()) return;
    pause();
    handler(Number(event.currentTarget.value));
    invalidate();
  });
}

function notice(message, okay = false) {
  ui.notice.textContent = t(message);
  ui.notice.classList.toggle("ok", okay);
  ui.notice.hidden = !message;
}

function loadLocal() {
  if (!draftKey) return null;
  try { return JSON.parse(localStorage.getItem(draftKey)); }
  catch { return null; }
}

function storeLocal() {
  if (!draftKey) return false;
  const data={plan, changed:[...changed],snapshot_marks:snapshotMarks,scene_edits:[...sceneEdits],deleted_shots:[...deletedShots]};
  try {
    localStorage.setItem(draftKey,JSON.stringify(data));
    if(draftStorageFailed){draftStorageFailed=false;updateStatus();}
    return true;
  } catch {
    const firstFailure=!draftStorageFailed;draftStorageFailed=true;
    updateStatus();
    if(firstFailure)notice(t("自动保存失败，请下载工程"));
    return false;
  }
}

let resolveReady;
let rejectReady;
const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
let loadSequence=0;
let resizeObserver=null;

async function openProject(value,{restoreDraft=true,demo=false}={}) {
  if(handoffBusy)throw Error(t('保存未完成'));
  const sequence=++loadSequence;
  const loaded=await window.StageFrontend.normalize(value);
  if(sequence!==loadSequence)return false;
  if(plan){endEdit();storeLocal();pause();stopPanPress();}
  geometryEditor?.destroy?.();pathTimeline?.destroy?.();
  geometryEditor=null;pathTimeline=null;
  resizeObserver?.disconnect();
  plan=loaded.plan;session={...loaded.session,demo};originalPlan=loaded.baseline;draftKey=loaded.draftKey;
  snapshotMarks=[];deletedShots=new Set();sceneEdits=new Set();changed=new Set();
  const stored=restoreDraft?loadLocal():null;
  const state=window.StageFrontend.validPlan(stored?.plan)&&['changed','snapshot_marks','scene_edits','deleted_shots'].every(key=>Array.isArray(stored[key]))?stored:loaded.edits;
  if(state){
    if(window.StageFrontend.validPlan(state.plan))plan=copy(state.plan);
    changed=new Set(state.changed||[]);sceneEdits=new Set(state.scene_edits||[]);
    if(Array.isArray(state.snapshot_marks))snapshotMarks=copy(state.snapshot_marks);
    const retained=new Set(plan.shots.map(item=>item.id)),baseline=new Set(originalPlan.shots.map(item=>item.id));
    deletedShots=new Set((state.deleted_shots||[]).filter(id=>baseline.has(id)&&!retained.has(id)));
  }
  sceneOverview=null;selectedShot=null;selectedEntity=null;selectedTrack='camera';time=0;
  geometryPlacement=null;geometryPlacementStatus={status:'idle',sequence:++placementSequence};
  trialEdit=null;presetContext=null;selectedSegment=null;lastShotDeletion=null;capturedSnapshot=null;
  savedMapFit=null;canvasFit=null;previewPan=null;orbitBranch=null;activePreset=null;
  presetStates.clear();sceneLastShot.clear();navigationOpen.clear();
  undoStack.length=0;redoStack.length=0;historyBaseline=null;editTransaction=null;
  if(ui['compare-before'])ui['compare-before'].checked=false;
  document.querySelector('main').inert=false;
  window.StageI18n?.setDemoSource(demo?plan:null);
  committedRevision++;syncProjectCaption();
  ui['shot-count'].textContent=plan.shots.length;
  document.querySelector('main').setAttribute('aria-busy','false');
  ui.save.disabled=!canHandoff();ui['export-changes'].disabled=!canHandoff();
  navigationMode=params.has('scene')||!plan.shots.length?'scene':'video';
  renderShotList();openInitialLocation();historyBaseline=captureHistory();
  initPathTimeline();initGeometryEditor();renderSnapshotMarks();
  preview.classList.add('pan-ready');preview.tabIndex=0;
  resizeObserver=new ResizeObserver(()=>invalidate());resizeObserver.observe(map);resizeObserver.observe(preview.parentElement);
  updateStatus();invalidate();
  notice(demo?t('这是示例片场，可导入工程继续编辑。'):t('已打开工程'),true);
  window.dispatchEvent(new Event('stage-project-opened'));
  return true;
}

async function setup() {
  try {
    const host=window.DirectorsStageHost;
    let value=typeof host?.loadProject==='function'?await host.loadProject({params:Object.fromEntries(params)}):null;
    const demo=value==null;
    if(demo){
      if(window.__STAGE_DEMO)value=copy(window.__STAGE_DEMO);
      else {const response=await fetch(new URL('demo.json',import.meta.url));if(!response.ok)throw Error(t('未找到工程'));value=await response.json();}
    }
    await openProject(value,{demo});resolveReady(window.stageEditor);
  } catch(error){
    ui['save-status'].textContent=t('载入失败');notice(t(error.message));
    document.querySelector('main').setAttribute('aria-busy','false');rejectReady(error);
  }
}

function updateStatus() {
  syncContextCaptions();
  const version=session?.local_draft&&session.latest_revision!==session.revision?t("本地 v{local} · 项目 v{project}",{local:session.revision,project:session.latest_revision}):"";
  const activity=changed.size?changed.size+t(" 镜有修改"):sceneOverview?t("未拆镜 · 空间总览"):"";
  const connection=session?.demo?t("示例片场"):t("本地工程")+" · v"+(session?.revision||1);
  const removals=deletedShots.size?t("已删除 {count} 镜",{count:deletedShots.size}):"";
  const status=[draftStorageFailed?t("本地缓存未保存"):"",version,activity,removals,!version&&!activity&&!removals?connection:""].filter(Boolean).join(" · ");
  ui["save-status"].textContent=status+(snapshotMarks.length?" · "+snapshotMarks.length+t(" 帧已标记"):"");
}

function shotButton(shot) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "shot-button";
  button.dataset.shotId = shot.id;
  button.addEventListener("click", () => selectShot(shot.id));

  const number = document.createElement("span");
  number.className = "shot-number mono";
  number.textContent = shot.id;number.title=shot.id;
  const desc = document.createElement("span");
  desc.className = "shot-copy";
  const title = document.createElement("strong");
  title.textContent = shotName(shot);
  const detail = document.createElement("small");
  updateShotDetail(detail, shot);
  desc.append(title, detail);
  if(navigationMode==="scene"){
    const origin=document.createElement("span");origin.className="shot-origin";origin.textContent=videoByShot.get(shot.id)?.title||videoName(shot.video_id);desc.append(origin);
  }
  button.title=[videoByShot.get(shot.id)?.fullTitle,sceneRawName(shot.scene),demoText(shot.title)||shot.id].filter(Boolean).join(" / ");
  button.append(number, desc);
  const row=document.createElement("div");row.className="shot-row";
  const remove=document.createElement("button");remove.type="button";remove.className="shot-delete";remove.dataset.deleteShotId=shot.id;
  remove.setAttribute("aria-label",t("删除镜头 {name}",{name:shotName(shot)}));remove.title=t("删除镜头");remove.disabled=!shotManagementState().canDelete;
  remove.innerHTML='<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3.5 5.5h13M8 5.5V3.5h4v2M5.5 5.5l.7 11h7.6l.7-11M8.5 8.5v5M11.5 8.5v5" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  remove.addEventListener("click",event=>{event.preventDefault();event.stopPropagation();deleteShot(shot.id);});
  row.append(button,remove);return row;
}

function updateShotDetail(detail, shot) {
  const label=t(shot.shot_size)||(shot.motion?t("运动镜头"):t("固定镜头"));
  detail.textContent = compactLabel(label) + " · " + Number(shot.duration_s || shot.motion?.duration_s || 4).toFixed(1).replace(/\.0$/, "") + "s";
  detail.title=label;
}

function sceneRawName(id) {return demoText(plan?.scenes[id]?.title||plan?.scenes[id]?.name)||id;}
function sceneName(id) {return compactLabel(sceneRawName(id),id,'scene');}
function videoName(id) {return compactLabel(demoText(plan?.videos?.find(video=>video.id===id)?.title),id||t("视频 1"),'video');}
function syncProjectCaption() {
  const full=demoText(plan?.title)||t('项目片场');
  ui['project-title'].textContent=compactLabel(full,t('项目片场'),'project');
  ui['project-title'].title=full;
}
function syncShotHeading() {
  const s=shot();if(!s)return;
  const full=sceneOverview?sceneRawName(s.scene):(demoText(s.title)||s.id);
  const name=sceneOverview?sceneName(s.scene):shotName(s);
  ui['shot-id'].textContent=sceneOverview?t('片场'):s.id;ui['shot-id'].title=s.id;
  ui['shot-title'].textContent=name;ui['shot-title'].title=full;
  const details=ui['shot-description'];if(!details)return;
  const identity=(sceneOverview?'scene:':'shot:')+(sceneOverview?s.scene:s.id);
  if(details.dataset.subject!==identity){details.open=false;details.dataset.subject=identity;}
  const value=sceneOverview?plan.scenes[s.scene]?.description:s.description;
  const description=typeof value==='string'?value:'';
  const hasOriginal=Boolean(full&&full.trim()!==name);
  const hasDescription=Boolean(description.trim());
  details.hidden=!hasOriginal&&!hasDescription;
  ui['shot-description-summary'].textContent=sceneOverview?t('场景说明'):t('镜头说明');
  ui['shot-description-summary'].title=t('展开查看完整说明');
  ui['shot-original-label'].textContent=t('原始名称');
  ui['shot-description-label'].textContent=t('详细说明');
  ui['shot-original-section'].hidden=!hasOriginal;
  ui['shot-original-title'].textContent=full||'';
  ui['shot-description-section'].hidden=!hasDescription;
  ui['shot-description-text'].textContent=description;
}
function sceneShots(id) {return plan.shots.filter(item=>item.scene===id);}
function showNavigationMessage(message) {
  navigationMessage=message;
  if(ui["navigation-alert"])ui["navigation-alert"].hidden=!message;
  if(ui["navigation-message"])ui["navigation-message"].textContent=message;
}
function overviewCamera(stage) {
  const objects=stage.objects.filter(o=>!o.hidden&&Array.isArray(o.position)&&Array.isArray(o.size));
  if(window.StageObserve?.fitPose)return window.StageObserve.orbitCamera(window.StageObserve.fitPose(objects,"free",16/9));
  let lo=[-1,0,-1],hi=[1,2,1];
  if(objects.length){lo=[Infinity,Infinity,Infinity];hi=[-Infinity,-Infinity,-Infinity];
    for(const o of objects)for(let i=0;i<3;i++){const a=o.position[i]-(i===1?0:o.size[i]/2),b=o.position[i]+(i===1?o.size[i]:o.size[i]/2);lo[i]=Math.min(lo[i],a);hi[i]=Math.max(hi[i],b);}}
  const target=lo.map((n,i)=>(n+hi[i])/2),span=Math.max(2,...hi.map((n,i)=>n-lo[i]));
  return {position:add(target,[span,span*.75,span*1.15]),target,focal_mm:35,roll_deg:0};
}
function renderSceneThumbnail(id,canvas) {
  const source=getCommittedState().plan,stage=source?.scenes[id];if(!stage||!canvas?.getContext)return false;
  const ctx=canvas.getContext("2d"),width=canvas.width||160,height=canvas.height||90;if(!ctx)return false;
  ctx.setTransform(1,0,0,1,0,0);
  paintCameraView(canvas,ctx,stage,stage.objects,overviewCamera(stage),width,height);return true;
}
function rememberNavigationGroups() {
  for(const details of ui["shot-list"].querySelectorAll("details"))navigationOpen.set(details.dataset.sceneId!==undefined?"scene:"+details.dataset.sceneId:"video:"+(details.dataset.videoId||""),details.open);
}
function renderShotList() {
  const list=ui["shot-list"];rememberNavigationGroups();videoByShot=new Map();
  if(ui["shot-count"])ui["shot-count"].textContent=plan.shots.length;
  const hasVideoGroups=plan.shots.some(s=>typeof s.video_id==="string"&&s.video_id),videos=new Map();
  for(const video of Array.isArray(plan.videos)?plan.videos:[])if(typeof video?.id==="string"&&video.id&&!videos.has(video.id))videos.set(video.id,{title:videoName(video.id),fullTitle:demoText(video.title)||video.id,shots:[]});
  for(const s of plan.shots){const id=typeof s.video_id==="string"&&s.video_id?s.video_id:null;if(!videos.has(id)){const full=id??(hasVideoGroups?t("未分组镜头"):t("视频 1"));videos.set(id,{title:compactLabel(full,'','video'),fullTitle:full,shots:[]});}videos.get(id).shots.push(s);videoByShot.set(s.id,videos.get(id));}
  const groups=navigationMode==="scene"?new Map(Object.keys(plan.scenes).map(id=>[id,{title:sceneName(id),fullTitle:sceneRawName(id),shots:sceneShots(id)}])):videos;
  list.classList.add("grouped");list.setAttribute("aria-label",navigationMode==="scene"?t("按场景排列的镜头"):t("按视频排列的镜头"));
  for(const button of document.querySelectorAll("[data-navigation-mode]"))button.setAttribute("aria-pressed",String(button.dataset.navigationMode===navigationMode));
  if(ui["scene-count"])ui["scene-count"].textContent=t("{count} 场景",{count:Object.keys(plan.scenes).length});
  list.replaceChildren(...Array.from(groups,([id,group])=>{
    if(navigationMode==="video"&&!group.shots.length)return null;
    const details=document.createElement("details");details.className="video-group"+(navigationMode==="scene"?" scene-group":"");
    if(navigationMode==="scene")details.dataset.sceneId=id;else details.dataset.videoId=id??"";
    details.open=navigationOpen.get(navigationMode+":"+(id??""))||false;
    const summary=document.createElement("summary");summary.className="video-group-toggle";
    const title=document.createElement("strong");title.className="video-group-name";title.textContent=group.title;title.title=group.fullTitle||group.title;
    const count=document.createElement("span");count.className="video-group-count mono";count.textContent=group.shots.length?t("{count} 镜",{count:group.shots.length}):t("未拆镜");
    if(navigationMode==="scene"){
      const canvas=document.createElement("canvas");canvas.className="scene-thumbnail";canvas.width=160;canvas.height=90;canvas.dataset.sceneId=id;canvas.setAttribute("aria-hidden","true");summary.append(canvas);
      summary.addEventListener("click",event=>{event.preventDefault();if(trialEdit&&shot()?.scene!==id)endEdit();const opening=!details.open||shot()?.scene!==id;if(opening&&!selectScene(id))return;details.open=opening;navigationOpen.set("scene:"+id,opening);});
    }
    summary.append(title,count);
    const contents=document.createElement("div");contents.className="video-group-shots";contents.append(...group.shots.map(shotButton));
    if(!group.shots.length){const empty=document.createElement("p");empty.className="scene-folder-empty";empty.textContent=t("可查看空间 · 暂无镜头");contents.append(empty);}
    details.append(summary,contents);return details;
  }).filter(Boolean));
}
function setNavigationMode(mode) {
  navigationMode=mode==="scene"?"scene":"video";renderShotList();updateShotSelection();invalidate();
}
function updateShotSelection() {
  const group=videoByShot.get(selectedShot),s=shot(),title=ui["current-video-name"];
  if(title){const parts=s?[group?.title,sceneName(s.scene),sceneOverview?t("空间总览"):s.id]:[];title.hidden=!s;title.textContent=window.StageNaming?.breadcrumb(parts)||parts.filter(Boolean).join(" / ");title.title=s?[group?.fullTitle,sceneRawName(s.scene),sceneOverview?t('空间总览'):s.id].filter(Boolean).join(' / '):'';}
  const list=ui["shot-list"],shotsById=new Map(plan.shots.map(s=>[s.id,s]));
  for(const button of list.querySelectorAll(".shot-button")){
    const current=button.dataset.shotId===selectedShot;button.classList.toggle("active",current);button.setAttribute("aria-current",current?"true":"false");
    updateShotDetail(button.querySelector("small"),shotsById.get(button.dataset.shotId));
    if(current){const details=button.closest(".video-group");if(details)details.open=true;}
  }
  for(const details of list.querySelectorAll(".video-group")){
    const active=details.dataset.sceneId!==undefined?details.dataset.sceneId===s?.scene:Boolean(details.querySelector(".shot-button.active"));details.classList.toggle("active",active);
    if(sceneOverview&&active)details.open=true;
  }
}
function syncSceneOverviewUI() {
  const empty=Boolean(sceneOverview);document.querySelector(".workspace")?.classList.toggle("scene-overview",empty);
  if(ui["empty-scene-preview"])ui["empty-scene-preview"].hidden=!empty;
  if(ui["scene-empty-note"])ui["scene-empty-note"].hidden=!empty;
  if(ui["scope-label"])ui["scope-label"].textContent=empty?t("空间总览 · 只读"):t("仅编辑当前镜头");
  ui.snapshot.disabled=empty;ui.play.disabled=empty;ui.time.disabled=empty;
  if(ui["compare-before"]){ui["compare-before"].disabled=empty;if(empty)ui["compare-before"].checked=false;}
  ui.save.disabled=handoffBusy||!canHandoff();
}
function finishLocationSelection() {
  selectedEntity=undefined;selectedTrack="camera";activePreset=shot().motion_preset??null;orbitBranch=null;presetCamera=null;presetShot=null;lensSelected=shot().camera.lens_model==="fisheye"?"fisheye":null;time=0;
  if(ui["motion-direction"])ui["motion-direction"].value=knownMotionDirection(shot());
  if(activePreset){presetCamera=sampleBaseCamera(shot(),0);presetShot=selectedShot;}
  canvasFit=undefined;savedMapFit=undefined;updateFitLabel();
  syncShotHeading();
  updateShotSelection();syncSceneOverviewUI();
  const entities=scene().objects.filter(o=>!isCompanion(o));ui.entity.replaceChildren(new Option(t("选择主体"),""),...entities.map(o=>new Option(objectName(o),o.id)));
  if(ui["path-track"])ui["path-track"].replaceChildren(new Option(t("摄影机运镜"),"camera"),...entities.map(o=>new Option(objectName(o)+t(" · 走位"),o.id)));
  configureTravel(activePreset,false);restoreCinemaControls(shot());setPresetTab(cinemaDefinition(activePreset)?"cinema":"basic");if(ui["preset-status"])ui["preset-status"].textContent=t("选预设即可生效，再拖参数调整；不满意可还原。");
  updateStatus();invalidate();return true;
}
function prepareLocationSelection() {
  cancelGeometryPlacement(t("已切换位置，放置已取消。"));locatedObjectId=null;pause();selectedSegment=null;presetContext=null;stopPanPress();
}
function selectShot(id,options={}) {
  const found=plan?.shots.find(s=>s.id===id);if(!found){showNavigationMessage(t("这条镜头已不在当前工程中，请从全部片场重新选择。"));return false;}
  endEdit();
  if(!options.force&&selectedShot===found.id&&!sceneOverview&&ui["shot-id"].textContent===found.id)return true;
  prepareLocationSelection();sceneOverview=null;selectedShot=found.id;sceneLastShot.set(found.scene,found.id);showNavigationMessage("");return finishLocationSelection();
}
function selectScene(id) {
  if(!plan?.scenes[id]){showNavigationMessage(t("这个场景已不在当前工程中，请从全部片场重新选择。"));return false;}
  if(trialEdit&&shot()?.scene!==id)endEdit();
  const items=sceneShots(id),last=sceneLastShot.get(id),current=items.find(s=>s.id===last)||items[0];
  if(current)return selectShot(current.id);
  if(trialEdit)endEdit();
  prepareLocationSelection();selectedShot=null;sceneOverview={id:"__scene_overview",scene:id,title:sceneName(id),duration_s:1,camera:overviewCamera(plan.scenes[id])};showNavigationMessage("");return finishLocationSelection();
}
function openInitialLocation() {
  const wantedShot=params.get("shot"),wantedScene=params.get("scene"),wantedVideo=params.get("video");let failure="";
  if(wantedShot){const s=plan.shots.find(s=>s.id===wantedShot);if(s&&(!wantedScene||s.scene===wantedScene)&&(!wantedVideo||s.video_id===wantedVideo))return selectShot(s.id);failure=t("入口中的镜头与当前工程不匹配，已打开全部片场，请重新选择。");}
  else if(wantedScene){
    if(plan.scenes[wantedScene]){
      if(!wantedVideo)return selectScene(wantedScene);
      const match=plan.shots.find(s=>s.scene===wantedScene&&s.video_id===wantedVideo);if(match)return selectShot(match.id);
      failure=t("这个视频在指定场景中没有镜头，已打开全部片场，请重新选择。");
    }else failure=t("入口中的场景已不存在，已打开全部片场，请重新选择。");
  }
  else if(wantedVideo){const s=plan.shots.find(s=>s.video_id===wantedVideo);if(s)return selectShot(s.id);failure=t("入口中的视频没有可打开的镜头，已打开全部片场，请重新选择。");}
  const defaultShot=plan.shots.find(s=>s.id===session.shot_id)||plan.shots[0];
  if(failure){navigationMode="scene";renderShotList();}
  const result=defaultShot?selectShot(defaultShot.id):selectScene(Object.keys(plan.scenes)[0]);
  if(failure)showNavigationMessage(failure);return result;
}
for(const button of document.querySelectorAll("[data-navigation-mode]"))button.addEventListener("click",()=>setNavigationMode(button.dataset.navigationMode));
ui["navigation-home"]?.addEventListener("click",()=>{setNavigationMode("scene");showNavigationMessage("");});

function objectName(object) {
  const names = {person_a:t("主体 A"),person_b:t("主体 B"),table:t("桌面"),prop:t("道具"),back_wall:t("后墙")};
  return demoText(object.label || object.name) || names[object.id] || object.id;
}

function isCompanion(object,objects=scene().objects) {
  if(typeof object.parent_id==="string") return true;
  if(object.actor_id) {
    const actorParts=objects.filter(o=>o.actor_id===object.actor_id);
    const root=actorParts.find(o=>o.id===object.actor_id) || actorParts.find(o=>!/_head$|_top$/.test(o.id)) || actorParts[0];
    return root!==object;
  }
  return /_head$|_top$/.test(object.id) && objects.some(o=>o.id===object.id.replace(/_head$|_top$/,""));
}

function groupFor(id) {
  const originalObject = scene().objects.find(o => o.id===id);
  if (!originalObject) return [];
  return [originalObject,...scene().objects.filter(o=>o!==originalObject &&
    (o.parent_id===id || (originalObject.actor_id && o.actor_id===originalObject.actor_id) ||
     o.id===id+"_head" || o.id===id+"_top"))];
}

function hermite(a,b,slopeA,slopeB,span,u) {
  const delta = b-a;
  return a + u*(span*slopeA+u*(3*delta-span*(2*slopeA+slopeB)+u*(-2*delta+span*(slopeA+slopeB))));
}

function slopes(points, spans) {
  const velocity = spans.map((before,i) => mul(sub(points[i+1],points[i]),1/before));
  return [velocity[0], ...velocity.slice(1).map((right,i) => {
    const left = velocity[i], before = spans[i], after = spans[i+1];
    const tangent = mul(add(mul(left,after),mul(right,before)),1/(before+after));
    const limit = 2*Math.min(Math.hypot(...left),Math.hypot(...right));
    return mul(tangent,Math.min(1,limit/Math.max(1e-8,Math.hypot(...tangent))));
  }),velocity.at(-1)];
}

function scalarSlopes(values, spans) {
  const velocities = spans.map((span,i)=>(values[i+1]-values[i])/span);
  return [velocities[0], ...velocities.slice(1).map((right,i)=>{
    const left=velocities[i], a=spans[i], b=spans[i+1];
    return !left || !right || Math.sign(left)!==Math.sign(right) ? 0 :
      (3*a+3*b)/((2*b+a)/left+(b+2*a)/right);
  }), velocities.at(-1)];
}

function sampleBaseCamera(s, at) {
  const base = s.camera;
  const keys = s.motion?.keys;
  if (!keys || keys.length < 2) return {...base,position:[...base.position],target:[...base.target]};
  const t = cameraMotionTime(s, at);
  const timing = authoredTiming(s);
  const departure = key=>key.t+(key.hold_s||0)/s.motion.duration_s;
  const spans = keys.slice(1).map((key,i)=>key.t-(timing?departure(keys[i]):keys[i].t));
  let i = 0;
  while (i < spans.length-1 && t>=keys[i+1].t) i++;
  if(timing && (t<=departure(keys[i]) || t>=keys.at(-1).t)) {
    const key=t>=keys.at(-1).t?keys.at(-1):keys[i];
    let heldRoll=keys[0].roll_deg??base.roll_deg??0;
    for(let j=1;j<=keys.indexOf(key);j++){
      const difference=(keys[j].roll_deg??base.roll_deg??0)-heldRoll;
      const shortest=((difference+180)%360+360)%360-180;
      heldRoll+=shortest===-180&&difference>0?180:shortest;
    }
    return {...base,position:[...(key.position||base.position)],target:[...(key.target||base.target)],
      focal_mm:key.focal_mm??base.focal_mm??defaultLens,roll_deg:heldRoll};
  }
  let u = (t-(timing?departure(keys[i]):keys[i].t))/spans[i];
  const cap = v => v**3*(6+v*(-8+3*v));
  const smooth=(s.motion.ease || "smooth")==="smooth";
  if (!timing && smooth) {
    if (spans.length===1) u = u**3*(10+u*(-15+6*u));
    else if (i===0) u = cap(u);
    else if (i===spans.length-1) u = 1-cap(1-u);
  }
  const shouldStop=(key,index)=>timing&&((key.hold_s||0)>0 ||
    (index===0&&smooth) || (index===keys.length-1&&(key.t<1||smooth)));
  const vector = name => {
    const values = keys.map(k=>k[name] || base[name]);
    const tangents = slopes(values,spans).map((v,j)=>shouldStop(keys[j],j)?[0,0,0]:v);
    return values[i].map((a,j)=>hermite(a,values[i+1][j],tangents[i][j],tangents[i+1][j],spans[i],u));
  };
  const scalar = (name, defaultValue) => {
    const values = keys.map(k=>k[name] ?? base[name] ?? defaultValue);
    if (name==="roll_deg") for(let j=1;j<values.length;j++) {
      const difference = values[j]-values[j-1];
      const shortest = ((difference+180)%360+360)%360-180;
      values[j] = values[j-1]+(shortest===-180&&difference>0?180:shortest);
    }
    const tangents = scalarSlopes(values,spans).map((v,j)=>shouldStop(keys[j],j)?0:v);
    return hermite(values[i],values[i+1],tangents[i],tangents[i+1],spans[i],u);
  };
  return {...base,position:vector("position"),target:vector("target"),
    focal_mm:scalar("focal_mm",defaultLens),roll_deg:scalar("roll_deg",0)};
}

const handheldPhaseCache = new Map();

function handheldPhases(seed) {
  // Match Python Random(integer).random() in the CPU renderer, including its
  // integer-key initialization. Cache the 14 phases rather than run an RNG per frame.
  if(handheldPhaseCache.has(seed)) return handheldPhaseCache.get(seed);
  let integer=BigInt(Math.abs(seed));
  const words=[];
  do {words.push(Number(integer&0xffffffffn));integer>>=32n;} while(integer);
  const state=new Uint32Array(624);
  state[0]=19650218;
  for(let i=1;i<624;i++) state[i]=(Math.imul(1812433253,state[i-1]^(state[i-1]>>>30))+i)>>>0;
  let i=1,j=0;
  for(let count=Math.max(624,words.length);count>0;count--) {
    state[i]=((state[i]^Math.imul(state[i-1]^(state[i-1]>>>30),1664525))+words[j]+j)>>>0;
    i++;j++;
    if(i>=624){state[0]=state[623];i=1;}
    if(j>=words.length)j=0;
  }
  for(let count=623;count>0;count--) {
    state[i]=((state[i]^Math.imul(state[i-1]^(state[i-1]>>>30),1566083941))-i)>>>0;
    i++;
    if(i>=624){state[0]=state[623];i=1;}
  }
  state[0]=0x80000000;
  let cursor=624;
  function word() {
    if(cursor===624) {
      for(let k=0;k<624;k++) {
        const bits=(state[k]&0x80000000)|(state[(k+1)%624]&0x7fffffff);
        state[k]=state[(k+397)%624]^(bits>>>1)^((bits&1)?0x9908b0df:0);
      }
      cursor=0;
    }
    let value=state[cursor++];
    value^=value>>>11;
    value^=(value<<7)&0x9d2c5680;
    value^=(value<<15)&0xefc60000;
    value^=value>>>18;
    return value>>>0;
  }
  const phases=Array.from({length:14},()=>{
    const high=word()>>>5,low=word()>>>6;
    return 2*Math.PI*((high*67108864+low)/9007199254740992);
  });
  if(handheldPhaseCache.size>=64)handheldPhaseCache.delete(handheldPhaseCache.keys().next().value);
  handheldPhaseCache.set(seed,phases);
  return phases;
}

function sampleCamera(s, at) {
  const camera = sampleBaseCamera(s,at);
  const effect = s.camera_effect;
  if(!effect) return camera;
  const intensity=effect.intensity??(effect.type==="fpv"?.65:.5);
  if(!intensity) return camera;
  const seconds=s.motion?.duration_s||duration(s), t=cameraMotionTime(s,at), seed=effect.seed||0;
  const phase=(seed%1024+1024)%1024*(2*Math.PI/1024);
  let elapsed=t*seconds, bankWeight=1;
  if(authoredTiming(s)) {
    const keys=s.motion.keys;
    const clipped=Math.min(t, keys.at(-1).t);
    elapsed=clipped*seconds-keys.reduce((sum,key,index)=>index===keys.length-1?sum:
      sum+Math.min(key.hold_s||0,Math.max(0,(clipped-key.t)*seconds)),0);
    const index=keys.findIndex((key,i)=>i<keys.length-1&&t>=key.t&&t<keys[i+1].t);
    if(index===-1) bankWeight=0;
    else {
      const current=keys[index], next=keys[index+1], h=Math.min(.18/seconds,.18);
      const depart=current.t+(current.hold_s||0)/seconds;
      if(t<=depart&&(current.hold_s||0)>0) bankWeight=0;
      else {
        const edge=Math.min(1,(current.hold_s||0)>0?Math.max(0,t-depart)/h:1,
          (next.hold_s||0)>0||index===keys.length-2?Math.max(0,next.t-t)/h:1);
        bankWeight=edge*edge*(3-2*edge);
      }
    }
  }
  if(effect.type==="breathing") {
    camera.focal_mm*=1+.028*intensity*Math.sin(2*Math.PI*.31*elapsed+phase);
  } else if(effect.type==="shoulder") {
    const step=2*Math.PI*1.62*elapsed+phase;
    const height=intensity*(.02*Math.sin(step)+.004*Math.sin(2*step));
    const sway=intensity*.026*Math.sin(step/2), ray=sub(camera.target,camera.position);
    const horizontal=Math.hypot(ray[0],ray[2]);
    const right=horizontal>1e-8?[-ray[2]/horizontal,0,ray[0]/horizontal]:[1,0,0];
    const shift=[right[0]*sway,height,right[2]*sway];
    camera.position=add(camera.position,shift);
    camera.target=add(camera.target,mul(shift,.72));
    camera.roll_deg=(camera.roll_deg||0)+intensity*1.9*Math.sin(step/2-.45);
  } else if(effect.type==="fpv" && bankWeight>0 && t>0 && t<1) {
    const h=Math.min(.18/seconds,.18), left=Math.max(0,t-h), right=Math.min(1,t+h);
    const tShot=seconds/duration(s);
    const l=sub(camera.position,sampleBaseCamera(s,left*tShot).position);
    const r=sub(sampleBaseCamera(s,right*tShot).position,camera.position);
    const before=Math.hypot(l[0],l[2]),after=Math.hypot(r[0],r[2]);
    if(Math.min(before,after)>=1e-9) {
      const speed=Math.min(before/((t-left)*seconds),after/((right-t)*seconds));
      const turn=(l[2]*r[0]-l[0]*r[2])/(before*after);
      const rate=2*turn/((right-left)*seconds), edge=Math.min(1,t/h,(1-t)/h);
      camera.roll_deg=(camera.roll_deg||0)+18*intensity*bankWeight*edge*edge*(3-2*edge)*(speed/(speed+.2))*Math.tanh(rate/1.7);
    }
  } else if(effect.type==="handheld") {
    const channels=[[.69,1.93],[.87,2.27],[.49,1.59],[.61,1.81],[.91,2.11],[.57,1.69],[.71,1.99]];
    const phases=handheldPhases(seed);
    const [x,y,z,ax,ay,az,roll]=channels.map(([a,b],i)=>.76*Math.sin((2*Math.PI*a)*elapsed+phases[i*2])+.24*Math.sin((2*Math.PI*b)*elapsed+phases[i*2+1]));
    const shift=mul([.028*x,.016*y,.020*z],intensity);
    const ray=sub(camera.target,camera.position),forward=unit(ray),wobble=[.014*ax,.011*ay,.012*az];
    const aim=mul(sub(wobble,mul(forward,dot(wobble,forward))),Math.hypot(...ray)*intensity);
    camera.position=add(camera.position,shift);
    camera.target=add(add(camera.target,shift),aim);
    camera.roll_deg=(camera.roll_deg||0)+1.4*intensity*roll;
  }
  return camera;
}

function objectAt(s, object, t, sourceTime=false) {
  if(window.StageTime&&!sourceTime)t=window.StageTime.sampleSeconds(s,t*duration(s))/duration(s);
  const point = {...object, ...(s.object_overrides?.[object.id] || {})};
  const track = s.object_tracks?.[object.id];
  if (!track || track.length < 2) return point;
  let i=0;
  while(i<track.length-2 && t>=track[i+1].t) i++;
  const a=track[i], b=track[i+1];
  const u = clamp((t-a.t)/(b.t-a.t),0,1);
  const yawA=a.yaw_deg??point.yaw_deg??0, yawB=b.yaw_deg??point.yaw_deg??0;
  const difference = yawB-yawA, shortest = ((difference+180)%360+360)%360-180;
  return {...point,position:lerp(a.position,b.position,u),yaw_deg:yawA+shortest*u};
}

function editCamera(s) {
  const normalized = s.motion ? clamp(time*duration(s)/s.motion.duration_s,0,1) : 0;
  if (!s.motion || !s.motion.keys) return s.camera;
  const keys = s.motion.keys;
  const sample = sampleBaseCamera(s,time);
  let key = keys.find(k=>Math.abs(k.t-normalized)<0.0006);
  if(!key && authoredTiming(s)) {
    key=keys.find(k=>normalized>=k.t && normalized<=k.t+(k.hold_s||0)/s.motion.duration_s+timeEpsilon);
    if(!key && normalized>=keys.at(-1).t) key=keys.at(-1);
  }
  if (!key) {
    if(keys.length>=24){notice(t("构图点已达 24 个。请先选中已有点调整，或删除一个中间点。"));return null;}
    key = {t: round(normalized,5),position:sample.position,target:sample.target,
      focal_mm:sample.focal_mm,roll_deg:sample.roll_deg};
    keys.push(key);
    keys.sort((a,b)=>a.t-b.t);
  } else {
    for (const field of ["position","target","focal_mm","roll_deg"]) {
      if (key[field]===undefined) key[field]=copy(sample[field]);
    }
  }
  return key;
}

function updateCamera(handler, options = {}) {
  if(!beginTrialEdit("camera"))return false;
  chooseTrack("camera",true);
  if(!shot().motion && time>timeEpsilon)enableTiming(shot());
  const current = editCamera(shot());
  if(!current)return;
  handler(current);
  if(options.reframe) rememberComposition(current);
  else constrainComposition(current);
  shot().edit_locks ||= {};
  shot().edit_locks.camera=true;
  presetStates.delete(selectedShot);
  if(presetShot===selectedShot && presetCamera && !shakePresets.has(activePreset)) {
    presetCamera=null;
    activePreset=null;
    delete shot().motion_preset;
    if(ui["preset-status"]) ui["preset-status"].textContent=t("当前构图已更新，可继续调整或还原。");
  }
  markChanged();
}

function translationAxes(camera) {
  const forward=unit(sub(camera.target,camera.position));
  let right=cross(forward,[0,1,0]);
  if(Math.hypot(...right)<1e-7)right=cross(forward,[0,0,1]);
  right=unit(right);
  const up=cross(right,forward), roll=(camera.roll_deg||0)*radians;
  return {right:add(mul(right,Math.cos(roll)),mul(up,Math.sin(roll))),
    up:add(mul(right,-Math.sin(roll)),mul(up,Math.cos(roll)))};
}

function translateFraming(x,y,base) {
  if(!plan||!shot()||!canEdit()||(!x&&!y))return;
  const axes=translationAxes(base);
  const shift=add(mul(axes.right,x),mul(axes.up,y));
  updateCamera(camera=>{
    camera.position=cleanPoint(add(base.position,shift));
    camera.target=cleanPoint(add(base.target,shift));
  }, {reframe:true});
}

function scheduleLocalSave() {
  if(localSaveTimer!==null)return;
  localSaveTimer=setTimeout(()=>{localSaveTimer=null;storeLocal();syncAutoEditStatus();},250);
}
function syncAutoEditStatus() {
  if(ui["edit-status"])ui["edit-status"].textContent=draftStorageFailed
    ? t("已生效，但本地保存失败 · 请复制交接内容")
    : t("已自动应用 · 仅保存在此浏览器");
}
function markChanged() {
  if(sceneOverview)return false;
  changed.add(selectedShot);
  if(!restoringHistory) {
    if(editTransaction)editTransaction.dirty=true;
    else {commitHistory();committedRevision++;}
  }
  scheduleLocalSave();updateStatus();syncAutoEditStatus();invalidate();return true;
}

function fps() {
  const candidate=Number(plan.output?.fps || 24);
  return Number.isFinite(candidate)&&candidate>0?candidate:24;
}

function frameTime(seconds) {
  return Math.round(seconds*fps())/fps();
}

function formatTime(seconds) {
  return round(seconds,3).toLocaleString("zh-CN",{maximumFractionDigits:3});
}

function setShotDuration(value) {
  if(!canEdit())return false;
  if(pendingEditNotice())return false;
  const s=shot(), previous=duration(s), elapsed=time*previous;
  const next=round(Math.max(Math.ceil(.1*fps())/fps(),frameTime(clamp(value,.1,30))),8);
  if(Math.abs(previous-next)<1e-7) return;
  s.duration_s=next;
  if(s.motion) {
    if(authoredTiming(s)) {
      s.motion.duration_s=next;
      for(const key of s.motion.keys) if(key.hold_s) key.hold_s=round(key.hold_s*next/previous,8);
    } else {
      s.motion.duration_s=round(clamp(s.motion.duration_s*next/previous,.1,next),8);
    }
  }
  if(s.actor_timing)for(const keys of Object.values(s.actor_timing))for(const key of keys)if(key.hold_s)key.hold_s=round(key.hold_s*next/previous,8);
  if(s.time_effect)s.time_effect.at_s=round(s.time_effect.at_s*next/previous,8);
  if(s.state_events)for(const events of Object.values(s.state_events))for(const event of events){event.at_s=round(event.at_s*next/previous,8);if(event.duration_s)event.duration_s=round(event.duration_s*next/previous,8);}
  const shotFrames=plan.shots.map(s=>Number(s.duration_s ?? s.motion?.duration_s));
  if(shotFrames.every(d=>d>0)) {
    plan.target_duration_s=round(shotFrames.reduce((sum,d)=>sum+Math.round(d*fps()),0)/fps(),8);
  }
  time=clamp(elapsed/next,0,1);
  setTimingStatus(t`${formatTime(next)} 秒 · 路径点时间按镜头长度同比调整。`);
  markChanged();
}

function poseKey(camera,t) {
  return {t,position:[...camera.position],target:[...camera.target],
    focal_mm:camera.focal_mm??defaultLens,roll_deg:camera.roll_deg||0};
}

function enableTiming(s) {
  if(authoredTiming(s)) return;
  const total=duration(s), motion=s.motion, first=sampleBaseCamera(s,0);
  const keys=motion?.keys?.length>=2?motion.keys.map(key=>({...key,t:key.t*motion.duration_s/total})):
    [poseKey(first,0),poseKey(first,1)];
  s.duration_s=total;
  s.motion={...(motion||{}),duration_s:total,timing_mode:"arrival",ease:motion?.ease||"smooth",keys};
  presetStates.delete(selectedShot);
  presetCamera=null;
}

function setTimingStatus(message) {
  if(ui["timing-status"]) ui["timing-status"].textContent=message;
}

function holdFor(keys,index,total) {
  if(index===keys.length-1) return (1-keys[index].t)*total;
  return keys[index].hold_s||0;
}

function seekWaypoint(index) {
  const key=shot().motion.keys[index];
  goTo(key.t);
}

function addWaypoint() {
  if(pendingEditNotice())return false;
  if(!plan || !canEdit()) return;
  pause();
  const s=shot(), total=duration(s), at=clamp(frameTime(time*total)/total,0,1);
  const pose=sampleBaseCamera(s,at);
  enableTiming(s);
  const keys=s.motion.keys, gap=1/fps()/total;
  let index=keys.findIndex(k=>Math.abs(k.t-at)<gap*.51);
  if(index>=0) {
    goTo(keys[index].t);
    setTimingStatus(index===0?t("已选中起点。直接调整上方画面，就会更新这个构图。"):index===keys.length-1?t("已选中终点。直接调整上方画面，就会更新这个构图。"):t("这个时间已有构图，已为你选中。调整上方画面即可更新。"));
    markChanged();return {index};
  }
  if(keys.length>=24) {setTimingStatus(t("一个镜头最多可放 24 个构图点。可先删除一个中间点。"));return;}
  const after=keys.findIndex(k=>k.t>at);
  if(after===0 || at>=1) {goTo(after===0?0:1);return {index:after===0?0:keys.length-1};}
  const beforeIndex=after<0?keys.length-1:after-1, before=keys[beforeIndex];
  const departure=before.t+(before.hold_s||0)/total;
  if(at<departure+gap) {
    const shortened=Math.max(0,(at-before.t-gap)*total);
    if(shortened>timeEpsilon)before.hold_s=round(shortened,8);else delete before.hold_s;
  }
  const added=poseKey(pose,round(at,8));
  if(after<0)keys.push(added);else keys.splice(after,0,added);
  index=keys.indexOf(added);
  goTo(added.t);
  setTimingStatus(t`已记住 ${formatTime(at*total)} 秒的构图。拖动这个点可改变到达时间。`);
  markChanged();return {index};
}

function changeWaypoint(index,type,value) {
  if(pendingEditNotice())return false;
  if(!plan || !canEdit())return;
  const s=shot(), total=duration(s), keys=s.motion.keys;
  if(type==="travel"&&index<keys.length-1) {
    const departure=keys[index].t*total+holdFor(keys,index,total);
    changeWaypoint(index+1,"arrival",departure+value);
    return;
  }
  const point=keys[index], last=index===keys.length-1;
  if(!point||!Number.isFinite(value)) return;
  pause();
  const minimum=1/fps();
  const arrival=point.t*total;
  const previous=keys[index-1];
  const before=previous?previous.t*total+(previous.hold_s||0)+minimum:0;
  const after=last?total:keys[index+1].t*total-minimum;
  const requested=frameTime(value);
  if(type==="hold"&&!last) {
    const next=clamp(requested,0,Math.max(0,after-arrival));
    if(next>timeEpsilon) point.hold_s=round(next,8);
    else delete point.hold_s;
    setTimingStatus(t`在 ${formatTime(arrival)} 秒到达，${formatTime(arrival+next)} 秒出发。`);
  } else if(index>0) {
    const newArrival=clamp(type==="hold"?total-requested:requested,before,
      Math.max(before,after-(point.hold_s||0)));
    point.t=round(newArrival/total,8);
    if(last) delete point.hold_s;
    goTo(point.t,{preserveGesture:true});
    setTimingStatus(t`路径点到达时间为 ${formatTime(newArrival)} 秒。`);
  }
  markChanged();
  timingSignature="";
}

function timingInput(label,index,field,seconds,limit,disabled) {
  const input=document.createElement("input");
  input.type="number";
  input.min=0;
  input.max=limit;
  input.step="0.01";
  input.value=round(seconds,3);
  input.setAttribute("aria-label",label);
  input.dataset.timingField=field;
  input.disabled=disabled||!canEdit();
  input.addEventListener("change",()=>{
    if(input.value.trim()) changeWaypoint(index,field,Number(input.value));
  });
  return input;
}

function timingButton(label,name,index,handler,disabled=false) {
  const button=document.createElement("button");
  button.type="button";
  button.textContent=label;
  button.dataset[name]=index;
  button.disabled=disabled||!canEdit();
  button.addEventListener("click",handler);
  return button;
}

function showTimingRows(s) {
  const table=ui["timing-keys"];
  if(!table || !authoredTiming(s)) return;
  const keys=s.motion.keys, total=duration(s);
  const signature=JSON.stringify([s.id,total,s.camera.position,keys]);
  if(signature!==timingSignature) {
    timingSignature=signature;
    table.replaceChildren(...keys.map((key,index)=>{
      const last=index===keys.length-1;
      const row=document.createElement("tr");
      const fields=Array.from({length:5},()=>document.createElement("td"));
      const name=index===0?t("起点"):last?t("终点"):t`路径点 ${index}`;
      fields[0].append(timingButton(name,"waypointSeek",index,()=>seekWaypoint(index)));
      fields[1].append(timingInput(t`${name}到达时间`,index,"arrival",key.t*total,total,index===0));
      fields[2].append(timingInput(t`${name}停留时间`,index,"hold",holdFor(keys,index,total),total,false));
      if(last) fields[3].textContent=t("至切镜");
      else {
        const departure=key.t*total+holdFor(keys,index,total);
        const travel=Math.max(0,keys[index+1].t*total-departure);
        const distance=Math.hypot(...sub(keys[index+1].position||s.camera.position,key.position||s.camera.position));
        const explanation=document.createElement("small");
        explanation.textContent=t`${formatTime(departure)} s 出发${travel>1e-6?t` · 约 ${formatTime(distance/travel)} m/s`:""}`;
        fields[3].classList.add("timing-travel");
        fields[3].append(timingInput(t`${name}至下一点行进时间`,index,"travel",travel,total,false),explanation);
      }
      if(index>0&&!last) fields[4].append(timingButton(t("删除"),"waypointRemove",index,()=>{
        keys.splice(index,1);
        setTimingStatus(t`已删除${name}。`);
        markChanged();
      }));
      row.append(...fields);
      return row;
    }));
  }
  let nearest=0;
  for(let i=1;i<keys.length;i++) if(time>=keys[i].t-timeEpsilon) nearest=i;
  for(const [index,row] of Array.from(table.rows).entries()) row.setAttribute("aria-current",String(nearest===index));
  if(ui["timing-speed"]) ui["timing-speed"].textContent=t`${keys.length} 个路径点`;
}

function syncTiming(s) {
  const input=ui["shot-duration"];
  if(input && document.activeElement!==input) input.value=round(duration(s),3);
  sliderDisplay("shot-duration-slider",round(duration(s),3)," s");
  const timing=authoredTiming(s);
  if(ui["timing-detail"]) ui["timing-detail"].hidden=!timing;
  if(ui["timing-mode"]) ui["timing-mode"].hidden=timing||!canEdit();
  if(ui["waypoint-add"]) ui["waypoint-add"].hidden=!timing||!canEdit();
  if(ui["timing-status"] && !timing) setTimingStatus(t("编辑镜头时长，或开启路径点安排到达、停留和下一段行进。"));
  if(pathTimeline)pathTimeline.render();
  else showTimingRows(s);
}

function setActor(id, location, mode, yaw) {
  if(!beginTrialEdit("actor:"+id))return false;
  const parts = groupFor(id);if(!parts.length)return false;
  const s=shot();
  chooseTrack(id,true);
  const useTrack=mode || s.object_tracks?.[id]?.length || selectedTrack===id&&time>timeEpsilon;
  if(useTrack) {
    const data=actorPathData(s,id),keys=data.specs,gap=.5/fps()/duration(s);
    let t=mode==="start"?0:mode==="end"?keys.at(-1).t:clamp(frameTime(time*duration(s))/duration(s),0,1);
    let index=keys.findIndex((k,i)=>Math.abs(k.t-t)<gap || (t>=k.t && t<=k.t+(k.hold_s||0)/duration(s)+timeEpsilon) || i===keys.length-1&&t>=k.t);
    if(index<0) {
      if(keys.length>=24){notice(t("人物站位点已达上限，请先删除一个中间点。"));return false;}
      index=keys.findIndex(k=>k.t>t);if(index<0)index=keys.length;
      keys.splice(index,0,{t:round(t,8)});data.parts.forEach((o,j)=>data.poses[j].splice(index,0,objectAt(s,o,t)));
    }
    const source=data.poses[0][index],delta=sub(location,source.position),turn=yaw===undefined?0:wrapDegrees(yaw-(source.yaw_deg||0));
    data.parts.forEach((o,j)=>{
      const old=data.poses[j][index];
      data.poses[j][index]={...old,position:cleanPoint(add(add(source.position,delta),rotateY(sub(old.position,source.position),turn))),
        yaw_deg:yaw===undefined?old.yaw_deg||0:round(wrapDegrees((old.yaw_deg||0)+turn))};
    });
    writeActorPath(s,id,keys,data.parts,data.poses);
  } else {
    const source=objectAt(s,parts[0],time),delta=sub(location,source.position),turn=yaw===undefined?0:wrapDegrees(yaw-(source.yaw_deg||0));
    for(const part of parts){
      const old=objectAt(s,part,time),change={position:cleanPoint(add(add(source.position,delta),rotateY(sub(old.position,source.position),turn)))};
      if(yaw!==undefined)change.yaw_deg=round(wrapDegrees((old.yaw_deg||0)+turn));
      s.object_overrides ||= {};s.object_overrides[part.id]={...s.object_overrides[part.id],...change};
    }
  }
  s.edit_locks ||= {};s.edit_locks.subjects=[...new Set([...(s.edit_locks.subjects||[]),id])];
  markChanged();return true;
}

function invalidate() {
  if (pendingRender) return;
  pendingRender = true;
  requestAnimationFrame(() => {
    pendingRender = false;
    if (!plan || !shot()) return;
    frameSamples={objects:new Map()};
    try {
      renderSceneViews();
      syncControls();
      syncDirectorControls();
      geometryEditor?.render();
      // All subscribers observe the same sampled frame; controls that request
      // the adapter state again reuse its scene sample during this pass.
      const current=editorSubscribers.size?editorState():null;
      for(const listener of editorSubscribers) { try { listener(current); } catch(error) { console.warn(t("片场视图订阅失败"),error.name); } }
    } finally {frameSamples=null;}
  });
}

function fitCanvas(canvas, width, height) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1,Math.round(width*dpr));
  const h = Math.max(1,Math.round(height*dpr));
  if (canvas.width!==w || canvas.height!==h) {
    canvas.width=w;
    canvas.height=h;
  }
  return dpr;
}

function computeMapFit(objects, camera, w, h) {
  const points = [camera.position,camera.target];
  for(const o of objects) {
    const extent = Math.hypot(o.size[0],o.size[2])/2;
    points.push(add(o.position,[-extent,0,-extent]),add(o.position,[extent,0,extent]));
  }
  const minX = Math.min(...points.map(p=>p[0])), maxX = Math.max(...points.map(p=>p[0]));
  const minZ = Math.min(...points.map(p=>p[2])), maxZ = Math.max(...points.map(p=>p[2]));
  const x = (minX+maxX)/2, z = (minZ+maxZ)/2;
  return {x,z,scale:Math.min((w-42)/Math.max(2,maxX-minX),(h-38)/Math.max(2,maxZ-minZ)),w,h};
}

function isStage3D() {return Boolean(ui["stage-view"]&&ui["stage-view"].value!=="top2d");}
function updateFitLabel() {
  const restore=!isStage3D()&&Boolean(savedMapFit);
  const label = restore ? t("回到原视图") : t("查看全场");
  ui.fit.firstChild.textContent = label + " ";
  ui.fit.title = restore ? t("恢复缩放前的俯视图位置") : t("把主体、摄影机和路径缩放到全场可见");
  ui.fit.setAttribute("aria-label", label);
  ui.fit.setAttribute("aria-pressed", String(restore));
}

function mapPoint(p) {
  const f = canvasFit;
  return [(p[0]-f.x)*f.scale+f.w/2,(p[2]-f.z)*f.scale+f.h/2];
}

function mapWorld(x,y) {
  const f = canvasFit;
  return [(x-f.w/2)/f.scale+f.x,(y-f.h/2)/f.scale+f.z];
}

function sceneObjectsAt(s,at=time,sourcePlan=plan) {
  let sampled;
  if(frameSamples){
    let byPlan=frameSamples.objects.get(sourcePlan);
    if(!byPlan)frameSamples.objects.set(sourcePlan,byPlan=new Map());
    sampled=byPlan.get(s);if(!sampled)byPlan.set(s,sampled=new Map());
    if(sampled.has(at))return sampled.get(at);
  }
  const objects=sourcePlan.scenes[s.scene].objects.map(o=>objectAt(s,o,at));
  const sourceSeconds=window.StageTime?window.StageTime.sampleSeconds(s,at*duration(s)):at*duration(s);
  const result=window.StageStates?window.StageStates.sampleScene(objects,s.state_events||{},sourceSeconds):objects;
  sampled?.set(at,result);return result;
}

function drawMap() {
  const rect = map.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = fitCanvas(map,rect.width,rect.height);
  const {width:w,height:h} = rect;
  const s=shot(), camera = sampleCamera(s,time), objects = sceneObjectsAt(s,time).filter(o=>!o.hidden);
  if(!canvasFit || canvasFit.w!==w || canvasFit.h!==h) canvasFit=computeMapFit(objects,camera,w,h);
  mapCtx.setTransform(dpr,0,0,dpr,0,0);
  mapCtx.fillStyle="#15191c";
  mapCtx.fillRect(0,0,w,h);
  const start = mapWorld(0,0), end = mapWorld(w,h);
  const step = canvasFit.scale > 34 ? 0.5 : canvasFit.scale > 15 ? 1 : 2;
  mapCtx.lineWidth=1;
  for(let x=Math.ceil(start[0]/step)*step;x<=end[0];x+=step) {
    const [px]=mapPoint([x,0,0]);
    mapCtx.strokeStyle=Math.abs(x)<1e-8?"#42474c":"#272e33";
    line(mapCtx,[Math.round(px)+.5,0],[Math.round(px)+.5,h]);
  }
  for(let z=Math.ceil(start[1]/step)*step;z<=end[1];z+=step) {
    const [,py]=mapPoint([0,0,z]);
    mapCtx.strokeStyle=Math.abs(z)<1e-8?"#42474c":"#272e33";
    line(mapCtx,[0,Math.round(py)+.5],[w,Math.round(py)+.5]);
  }
  const drawOrder=[...objects].sort((a,b)=>(b.size[0]*b.size[2])-(a.size[0]*a.size[2]));
  for (const object of drawOrder) drawTopObject(object);
  if(sceneOverview)return;

  if(s.motion?.keys?.length) {
    mapCtx.beginPath();
    for(let i=0;i<=48;i++) {
      const p=mapPoint(sampleCamera(s,i/48).position);
      if(i) mapCtx.lineTo(...p);
      else mapCtx.moveTo(...p);
    }
    mapCtx.strokeStyle="#aeb5c1";
    mapCtx.setLineDash([4,4]);
    mapCtx.stroke();
    mapCtx.setLineDash([]);
  }
  const selectedActor=scene().objects.find(o=>o.id===selectedEntity);
  if(selectedActor && s.object_tracks?.[selectedActor.id]?.length) {
    mapCtx.strokeStyle=tools.object;mapCtx.lineWidth=1.5;mapCtx.setLineDash([3,4]);
    mapCtx.beginPath();for(let i=0;i<=48;i++){const p=mapPoint(objectAt(s,selectedActor,i/48).position);if(i)mapCtx.lineTo(...p);else mapCtx.moveTo(...p);}mapCtx.stroke();mapCtx.setLineDash([]);
    const points=actorTiming(s,selectedActor.id);
    points.forEach((k,i)=>{const p=mapPoint(objectAt(s,selectedActor,k.t).position);drawMarker(p,tools.object,3,false,false);mapCtx.fillStyle="#eef4ee";mapCtx.font="10px system-ui";mapCtx.textAlign="left";mapCtx.fillText((i===0?t("起"):i===points.length-1?t("终"):i)+" · "+formatTime(k.t*duration(s))+"s",p[0]+7,p[1]+11);});
  }
  drawLocatedObject();
  drawGeometryPlacement();
  const position=mapPoint(camera.position), target=mapPoint(camera.target);
  const forward=unit(sub(target,position));
  if(Math.hypot(...forward)>.1) {
    const ratio=(camera.sensor_width_mm||36)/(2*(camera.focal_mm||defaultLens));
    const field = camera.lens_model==="fisheye"?Math.min(ratio,76*radians):Math.atan(ratio);
    const ray = (a,length) => [
      position[0]+(forward[0]*Math.cos(a)-forward[1]*Math.sin(a))*length,
      position[1]+(forward[0]*Math.sin(a)+forward[1]*Math.cos(a))*length
    ];
    const distance=Math.max(18,Math.min(100,Math.hypot(...sub(target,position))));
    mapCtx.fillStyle="#d7dce319";
    mapCtx.beginPath();
    mapCtx.moveTo(...position);mapCtx.lineTo(...ray(-field,distance));mapCtx.lineTo(...ray(field,distance));
    mapCtx.closePath();mapCtx.fill();
    mapCtx.strokeStyle="#d7dce3a6";
    line(mapCtx,position,ray(-field,distance));
    line(mapCtx,position,ray(field,distance));
  }
  mapCtx.strokeStyle="#a8b5a2";
  mapCtx.setLineDash([3,3]);
  line(mapCtx,position,target);
  mapCtx.setLineDash([]);
  drawMarker(target,tools.target,4,preferredMarker==="target",false);
  drawMarker(position,tools.camera,6,preferredMarker==="camera",true);
  mapCtx.fillStyle="#a0adb0";
  mapCtx.font='10px ui-monospace, monospace';
  mapCtx.textAlign="right";
  mapCtx.fillText("XZ / " + step + "m",w-9,h-10);
}

function line(ctx,a,b) {
  ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();
}

function drawMarker(p,color,r,selected,square) {
  mapCtx.save();
  mapCtx.translate(...p);
  mapCtx.beginPath();
  square ? mapCtx.roundRect(-r,-r,2*r,2*r,2) : mapCtx.arc(0,0,r,0,Math.PI*2);
  mapCtx.fillStyle=color;mapCtx.fill();
  if(selected) {
    mapCtx.beginPath();mapCtx.arc(0,0,r+3,0,Math.PI*2);mapCtx.strokeStyle=color;mapCtx.stroke();
  }
  mapCtx.restore();
}

function drawTopObject(o) {
  const [x,y]=mapPoint(o.position);
  let a = Math.max(1.5,o.size[0]*canvasFit.scale/2);
  let b = Math.max(1.5,o.size[2]*canvasFit.scale/2);
  if(window.StageStates&&(o.pitch_deg||o.roll_deg)){
    const corners=[];for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5])corners.push(window.StageStates.rotateLocal([x*o.size[0],y*o.size[1],z*o.size[2]],o.pitch_deg||0,o.roll_deg||0,0));
    a=Math.max(1.5,...corners.map(p=>Math.abs(p[0])*canvasFit.scale));b=Math.max(1.5,...corners.map(p=>Math.abs(p[2])*canvasFit.scale));
  }
  const isSelected = selectedEntity && (selectedEntity===o.id || o.parent_id===selectedEntity);
  mapCtx.save();
  mapCtx.translate(x,y);
  mapCtx.rotate(-(o.yaw_deg||0)*radians);
  mapCtx.beginPath();
  o.shape==="box" ? mapCtx.rect(-a,-b,a*2,b*2) : mapCtx.ellipse(0,0,a,b,0,0,2*Math.PI);
  mapCtx.globalAlpha=isCompanion(o)?0.68:0.9;
  mapCtx.fillStyle=o.color||"#b1bec9";
  mapCtx.fill();
  mapCtx.globalAlpha=1;
  mapCtx.strokeStyle=isSelected?tools.object:"#101719";
  mapCtx.lineWidth=isSelected?2:1;
  mapCtx.stroke();
  if(!isCompanion(o) && (o.actor_id || /person|actor|subject/.test(o.id))) {
    mapCtx.strokeStyle="#e9eee9";mapCtx.lineWidth=1.5;
    line(mapCtx,[0,0],[0,-b-13]);
    line(mapCtx,[0,-b-13],[-3,-b-8]);line(mapCtx,[0,-b-13],[3,-b-8]);
  }
  mapCtx.restore();
  if (!isCompanion(o) && (isSelected || /person|actor|subject/.test(o.id) || (o.label && canvasFit.w>=500))) {
    mapCtx.font='10px system-ui,sans-serif';
    mapCtx.textAlign="center";
    mapCtx.fillStyle=isSelected?tools.object:"#dce5dc";
    mapCtx.fillText(objectName(o),x,y-b-3);
  }
}

function drawOrbit() {
  const orb=ui["camera-orb"];
  if(!orb) return;
  const ctx=orb.getContext("2d"), rect=orb.getBoundingClientRect();
  if(!rect.width || !rect.height) return;
  const dpr=fitCanvas(orb,rect.width,rect.height);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const w=rect.width,h=rect.height,x=w/2,y=h/2,r=Math.min(w,h)*.36;
  ctx.clearRect(0,0,w,h);
  const {yaw,pitch}=orbitRead(sampleBaseCamera(shot(),time));
  const a=yaw*radians,e=pitch*radians;
  const gradient=ctx.createRadialGradient(x-r*.4,y-r*.55,0,x,y,r*1.05);
  gradient.addColorStop(0,"#bcc5da40");
  gradient.addColorStop(.75,"#5b637335");
  gradient.addColorStop(1,"#3c444d12");
  ctx.fillStyle=gradient; ctx.strokeStyle="#c9d3e070";ctx.lineWidth=1;
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.strokeStyle="#c9d3e050";
  for(const scale of [.4,.73]) {
    ctx.beginPath();ctx.ellipse(x,y,r*scale,r,0,0,Math.PI*2);ctx.stroke();
  }
  for(const l of [-.55,0,.55]) {
    ctx.beginPath();ctx.ellipse(x,y-l*r,r*Math.sqrt(1-l*l),r*.23,0,0,Math.PI*2);ctx.stroke();
  }
  const dx=r*Math.cos(e)*Math.sin(a),dy=-r*Math.sin(e);
  ctx.strokeStyle="#e0e8f29c"; ctx.setLineDash([2,3]);line(ctx,[x,y],[x+dx,y+dy]);ctx.setLineDash([]);
  ctx.fillStyle=Math.cos(e)*Math.cos(a)>=0?"#eaf4ff":"#eac7ff";
  ctx.shadowColor=ctx.fillStyle; ctx.shadowBlur=12;
  ctx.beginPath();ctx.arc(x+dx,y+dy,5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  ctx.font="10px system-ui,sans-serif";ctx.textAlign="center";ctx.fillStyle="#bac5d0";
  ctx.fillText(t("顶"),x,y-r-8);ctx.fillText(t("底"),x,y+r+15);
}

const light = [-0.436,0.873,-0.218];
const meshes = {};
function mesh(shape) {
  if (meshes[shape]) return meshes[shape];
  const faces=[];
  if(shape==="cylinder") {
    const top=[], bottom=[];
    for(let i=0;i<12;i++) {
      const a=i*2*Math.PI/12;
      top.push([Math.cos(a)/2,.5,Math.sin(a)/2]);bottom.push([Math.cos(a)/2,-.5,Math.sin(a)/2]);
    }
    faces.push(top,bottom);
    for(let i=0;i<12;i++) faces.push([bottom[i],top[i],top[(i+1)%12],bottom[(i+1)%12]]);
  } else if(shape==="sphere") {
    for(let row=0;row<6;row++) for(let i=0;i<12;i++){
      const v=(band,col)=>{
        const a=(band/6-.5)*Math.PI;
        const b=col*2*Math.PI/12;
        return [Math.cos(a)*Math.cos(b)/2,Math.sin(a)/2,Math.cos(a)*Math.sin(b)/2];
      };
      const a=v(row,i), b=v(row+1,i), c=v(row+1,i+1), d=v(row,i+1);
      faces.push(row===0?[a,b,c]:row===5?[a,b,d]:[a,b,c,d]);
    }
  } else {
    const v=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(p=>mul(p,.5));
    for(const indices of [[3,2,1,0],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]]) faces.push(indices.map(i=>v[i]));
  }
  return meshes[shape]=faces;
}
function nearClip(points) {
  const near=.04;
  const result=[];
  let prev=points.at(-1);
  for(const p of points) {
    if((prev[2]>=near)!==(p[2]>=near)) result.push(lerp(prev,p,(near-prev[2])/(p[2]-prev[2])));
    if(p[2]>=near) result.push(p);
    prev=p;
  }
  return result;
}

function shade(color, n) {
  const shade=Math.min(1,.72+.28*Math.max(0,dot(unit(n),light)));
  const rgb=(color||"#aab6c6").match(/[0-9a-f]{2}/gi) || ["aa","b6","c6"];
  return "rgb("+rgb.map(part=>Math.round(parseInt(part,16)*shade)).join(",")+")";
}

function drawPreview(includeGuides = true) {
  const targetWidth=Number(plan.output?.width)||640;
  const targetHeight=Number(plan.output?.height)||360;
  const aspect=targetWidth/targetHeight;
  preview.style.setProperty("--ratio",aspect);
  preview.style.setProperty("--preview-max", Math.min(810,Math.max(160,innerHeight*.48*aspect))+"px");
  const rect=preview.getBoundingClientRect();
  if (!rect.width) return;
  const width=Math.max(32,Math.min(810,rect.width));
  const height=width/aspect;
  const dpr=fitCanvas(preview,width,height);
  viewCtx.setTransform(dpr,0,0,dpr,0,0);
  const s=shot(), camera=sampleCamera(s,time), stage=scene();
  paintCameraView(preview,viewCtx,stage,sceneObjectsAt(s,time),camera,width,height,dpr);
  if(includeGuides)drawCompositionGuides(viewCtx,width,height,
    ui["guide-mode"]?.value||(ui["composition-guides"]?.checked?"thirds":"safe"),
    ui["guide-color"]?.value||"red");
}

function paintCameraView(canvas,ctx,stage,objects,camera,width,height,dpr=1) {
  ctx.fillStyle=stage.background||"#e4e9ed";
  ctx.fillRect(0,0,width,height);
  const forward=unit(sub(camera.target,camera.position));
  if(Math.hypot(...forward)<.1) return;
  let right=unit(cross(forward,Math.abs(forward[1])>1-1e-7?[0,0,-1]:[0,1,0]));
  let up=cross(right,forward);
  const r=(camera.roll_deg||0)*radians;
  if(r) {
    const newRight=add(mul(right,Math.cos(r)),mul(up,Math.sin(r)));
    up=add(mul(right,-Math.sin(r)),mul(up,Math.cos(r)));
    right=newRight;
  }
  const rectilinearFocal=width*(camera.focal_mm||defaultLens)/(camera.sensor_width_mm||36);
  const rMax=Math.hypot(width/2,height/2);
  const fishFocal=Math.max(rectilinearFocal,rMax/(76*radians));
  const fishEye=camera.lens_model==="fisheye";
  const focal=fishEye?rMax/Math.tan(rMax/fishFocal):rectilinearFocal;
  const local=p=>{const v=sub(p,camera.position);return [dot(v,right),dot(v,up),dot(v,forward)];};
  const project=p=>[width/2+p[0]*focal/p[2],height/2-p[1]*focal/p[2]];
  function fill(points,color) {
    const uv=points.map(project);
    if(uv.length<3) return;
    ctx.beginPath();
    uv.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));
    ctx.closePath();
    ctx.fillStyle=color;
    ctx.fill();
  }
  if(stage.ground!==false) {
    const g=Number(stage.ground_extent)||64;
    fill(nearClip([[-g,0,-g],[g,0,-g],[g,0,g],[-g,0,g]].map(local)),stage.ground_color||"#cfd6df");
  }
  const faces=[];
  for(const o of objects.filter(o=>!o.hidden)) {
    const center=add(o.position,[0,o.size[1]/2,0]);
    const sin=Math.sin((o.yaw_deg||0)*radians), cos=Math.cos((o.yaw_deg||0)*radians);
    const localFaces=mesh(o.shape);
    for(const face of localFaces) {
      const points=face.map(p=>{
        const [x,y,z]=p.map((v,i)=>v*o.size[i]);
        return add(center,window.StageStates?window.StageStates.rotateLocal([x,y,z],o.pitch_deg||0,o.roll_deg||0,o.yaw_deg||0):[cos*x+sin*z,y,cos*z-sin*x]);
      });
      let n=cross(sub(points[1],points[0]),sub(points[2],points[0]));
      if(dot(n,sub(points[0],center))<0) n=mul(n,-1);
      if(dot(n,sub(camera.position,points[0]))<=0) continue;
      const clipped=nearClip(points.map(local));
      if(clipped.length<3) continue;
      faces.push({points:clipped,z:clipped.reduce((sum,p)=>sum+p[2],0)/clipped.length,color:shade(o.color,n)});
    }
  }
  faces.sort((a,b)=>b.z-a.z);
  for(const face of faces) fill(face.points,face.color);
  if(fishEye) warpFisheye(focal*dpr,fishFocal*dpr,canvas,ctx);
}

function renderShotThumbnail(id,canvas) {
  const source=getCommittedState().plan,s=source?.shots.find(item=>item.id===id);
  if(!s||!canvas?.getContext)return false;
  const ctx=canvas.getContext("2d");if(!ctx)return false;
  const width=Math.max(1,canvas.width||160),height=Math.max(1,canvas.height||90);
  const aspect=(Number(source.output?.width)||640)/(Number(source.output?.height)||360);
  const w=Math.max(1,Math.round(Math.min(width,height*aspect))),h=Math.max(1,Math.round(Math.min(height,width/aspect)));
  const frame=document.createElement("canvas");frame.width=w;frame.height=h;
  const frameCtx=frame.getContext("2d");if(!frameCtx)return false;
  const rig=s.camera_effect,moving=Boolean(s.motion||Object.keys(s.object_tracks||{}).length||Object.keys(s.state_events||{}).length||
    rig&&["handheld","shoulder","breathing"].includes(rig.type)&&(rig.intensity??.5)>0);
  const at=Number.isFinite(s.still_at)?clamp(s.still_at,0,1):(moving ? .5 : 0);
  paintCameraView(frame,frameCtx,source.scenes[s.scene],sceneObjectsAt(s,at,source),sampleCamera(s,at),w,h);
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle="#0c0d0e";ctx.fillRect(0,0,width,height);
  ctx.drawImage(frame,(width-w)/2,(height-h)/2,w,h);return true;
}

const guideColors={white:"#ffffff",red:"#ff5d68",cyan:"#4fe3ed"};
const cinemaRatios={"cinema-239":2.39,"cinema-185":1.85,"frame-43":4/3};
const guideModes=new Set(["none","thirds","center","golden","safe",...Object.keys(cinemaRatios)]);
const guidePreferenceKey="directors-stage-ui-view-guides-v1";

function guideAperture(width,height,ratio) {
  if(!(width>0&&height>0&&ratio>0))return null;
  const w=Math.min(width,height*ratio),h=Math.min(height,width/ratio);
  return {x:(width-w)/2,y:(height-h)/2,width:w,height:h};
}

function drawCompositionGuides(ctx,width,height,mode,color="red") {
  if(!guideModes.has(mode)||mode==="none"||width<=0||height<=0)return;
  const ratio=cinemaRatios[mode],aperture=ratio?guideAperture(width,height,ratio):null;
  ctx.save();
  const stroke=guideColors[color]||guideColors.red;
  if(aperture){
    const {x,y,width:w,height:h}=aperture;
    ctx.fillStyle="rgba(0,0,0,.36)";
    if(y>0){ctx.fillRect(0,0,width,y);ctx.fillRect(0,y+h,width,height-y-h);}
    if(x>0){ctx.fillRect(0,y,x,h);ctx.fillRect(x+w,y,width-x-w,h);}
  }
  ctx.beginPath();
  if(aperture)ctx.rect(aperture.x,aperture.y,aperture.width,aperture.height);
  else if(mode==="safe")ctx.rect(width*.05,height*.05,width*.9,height*.9);
  else {
    const divisions=mode==="center"?[.5]:mode==="golden"?[.381966,.618034]:[1/3,2/3];
    for(const t of divisions){ctx.moveTo(width*t,0);ctx.lineTo(width*t,height);ctx.moveTo(0,height*t);ctx.lineTo(width,height*t);}
  }
  // Coordinates and widths are in CSS pixels; drawPreview already applies DPR.
  ctx.setLineDash(mode==="safe"?[6,5]:[]);
  ctx.lineJoin="round";ctx.lineCap="butt";
  ctx.strokeStyle="rgba(0,0,0,.78)";ctx.lineWidth=3.6;ctx.stroke();
  ctx.strokeStyle=stroke;ctx.lineWidth=1.6;ctx.stroke();
  if(aperture&&aperture.width>=110&&aperture.height>=35){
    const caption=mode==="frame-43"?"4:3":ratio.toFixed(2)+":1";
    ctx.setLineDash([]);ctx.fillStyle="rgba(0,0,0,.72)";ctx.fillRect(aperture.x+5,aperture.y+5,67,20);
    ctx.font="11px ui-monospace, monospace";ctx.textBaseline="top";ctx.fillStyle=stroke;ctx.fillText(caption,aperture.x+11,aperture.y+8);
  }
  ctx.restore();
}

function restoreGuidePreferences() {
  try {
    const value=JSON.parse(localStorage.getItem(guidePreferenceKey)||"null");
    if(ui["guide-mode"]&&guideModes.has(value?.mode))ui["guide-mode"].value=value.mode;
    if(ui["guide-color"]&&guideColors[value?.color])ui["guide-color"].value=value.color;
  } catch {}
}
function changeGuidePreferences() {
  try {localStorage.setItem(guidePreferenceKey,JSON.stringify({mode:ui["guide-mode"]?.value||"none",color:ui["guide-color"]?.value||"red"}));} catch {}
  invalidate();
}

function warpFisheye(sourceFocal,fishFocal,canvas=preview,ctx=viewCtx) {
  const w=canvas.width,h=canvas.height;
  const source=ctx.getImageData(0,0,w,h), target=ctx.createImageData(w,h);
  const id=[w,h,sourceFocal,fishFocal].join("/");
  if(warpMap?.id!==id) {
    const offsets=new Uint32Array(w*h);
    for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
      const dx=x+.5-w/2,dy=y+.5-h/2,r=Math.hypot(dx,dy);
      const k=r?sourceFocal*Math.tan(r/fishFocal)/r:sourceFocal/fishFocal;
      const sx=clamp(Math.floor(w/2+dx*k),0,w-1),sy=clamp(Math.floor(h/2+dy*k),0,h-1);
      offsets[y*w+x]=sy*w+sx;
    }
    warpMap={id,offsets};
  }
  const from=new Uint32Array(source.data.buffer),to=new Uint32Array(target.data.buffer);
  for(let i=0;i<to.length;i++) to[i]=from[warpMap.offsets[i]];
  ctx.putImageData(target,0,0);
}

function syncControls() {
  const s=shot();
  const camera=sampleBaseCamera(s,time);
  const focal=round(camera.focal_mm || defaultLens,2);
  const height=round(camera.position[1],2);
  if(document.activeElement!==ui.focal) ui.focal.value=focal;
  if(document.activeElement!==ui.height) ui.height.value=height;
  ui["preview-lens"].textContent=focal+" mm";
  ui.time.value=Math.round(time*1000);
  ui["time-value"].value=(time*duration(s)).toFixed(1)+" / "+duration(s).toFixed(1)+" s";
  for(const button of ui["focal-presets"].querySelectorAll("button")) button.classList.toggle("on",+button.dataset.focal===focal);
  for(const button of ui["height-presets"].querySelectorAll("button")) button.classList.toggle("on",Math.abs(+button.dataset.height-height)<.01);
  ui["add-motion"].hidden=Boolean(s.motion);
  ui["add-motion"].disabled=!canEdit();
  for(const button of ui.keyframes.querySelectorAll("[data-key]")) {
    const keyTime=button.dataset.key==="start"?0:(s.motion?.keys?.at(-1)?.t??1)*(s.motion?.duration_s??duration(s))/duration(s);
    button.classList.toggle("on",Math.abs(time-keyTime)<timeEpsilon);
    button.hidden=!s.motion;
  }
  ui["edit-hint"].textContent=s.motion
    ? t("拖到时刻 → 调整画面，改动立即生效。球体调整环绕角度。")
    : t("拖画面或球体即可调整。左侧自由观察不会改变摄影机。");
  const actor = scene().objects.find(o=>o.id===selectedEntity);
  ui["actor-coords"].hidden=!actor;
  ui["actor-options"].hidden=true;
  if(ui["camera-context"])ui["camera-context"].hidden=selectedTrack!=="camera";
  if(ui["entity-setting"])ui["entity-setting"].hidden=selectedTrack==="camera";
  if(ui["state-disclosure"])ui["state-disclosure"].hidden=selectedTrack==="camera";
  if(actor) {
    const item=objectAt(s,actor,time), p=item.position;
    for(const [i,axis] of ["x","y","z"].entries()) {
      const input=ui["actor-"+axis];
      if(document.activeElement!==input) input.value=round(p[i],2);
      sliderDisplay("subject-"+axis+"-slider",round(p[i],2)," m");
    }
    sliderDisplay("subject-yaw-slider",round(wrapDegrees(item.yaw_deg||0),1),"°");
  }
  const orb=orbitRead(camera);
  sliderDisplay("azimuth-slider",round(wrapDegrees(orb.yaw),1),"°");
  sliderDisplay("elevation-slider",round(orb.pitch,1),"°");
  sliderDisplay("roll-slider",round(wrapDegrees((camera.roll_deg||0)-(Math.abs(orb.pitch)>90?180:0)),1),"°");
  sliderDisplay("distance-slider",round(orb.dist,2)," m");
  sliderDisplay("focal-slider",focal," mm");
  sliderDisplay("height-slider",height," m");
  const lens = lensSelected || (camera.lens_model==="fisheye"?"fisheye":"standard");
  if(lens==="fisheye") ui["preview-lens"].textContent+=t(" · 鱼眼");
  for(const button of ui["lens-mode"]?.querySelectorAll("[data-lens]") || []) {
    button.classList.toggle("on",button.dataset.lens===lens);
    button.setAttribute("aria-pressed",String(button.dataset.lens===lens));
  }
  for(const button of ui["motion-presets"]?.querySelectorAll("[data-motion-preset]") || []) {
    button.classList.toggle("on",button.dataset.motionPreset.replaceAll("-","_")===activePreset);
    button.setAttribute("aria-pressed",String(button.dataset.motionPreset.replaceAll("-","_")===activePreset));
  }
  for(const axis of ["x","y","z","yaw"]) if(ui[`subject-${axis}-slider`]) ui[`subject-${axis}-slider`].disabled=!actor || !canEdit() || subjectTimeLocked();
  if(ui["motion-duration-slider"]) {
    // Frame-aligned minima are not on the original 0.1s step grid. Let the
    // duration supplied by the model remain exact when syncing native ranges.
    ui["motion-duration-slider"].step=basicSpeedPresets.has(activePreset)?"any":".1";
    ui["motion-duration-slider"].min=cinemaDefinition(activePreset)?Math.min(.1,presetContext?.seconds||duration(s)):basicSpeedPresets.has(activePreset)?Math.min(duration(s),Math.ceil(.1*fps())/fps(),s.motion?.duration_s||Infinity):.2;
    ui["motion-duration-slider"].max=Math.max(.1,presetContext?.scope==="segment"?presetContext.seconds:duration(s));
    if(!activePreset || ["handheld","shoulder","breathing"].includes(activePreset)) sliderDisplay("motion-duration-slider",round(s.motion?.duration_s||duration(s),1)," s");
    else if(basicSpeedPresets.has(activePreset)&&!authoredTiming(s))sliderDisplay("motion-duration-slider",s.motion?.duration_s||duration(s)," s");
    if(presetContext?.scope==="segment"&&!cinemaDefinition(activePreset))sliderDisplay("motion-duration-slider",round(presetContext.seconds,2)," s");
    ui["motion-duration-slider"].disabled=!canEdit()||comparisonActive()||authoredTiming(s)&&!cinemaDefinition(activePreset)||["handheld","shoulder","breathing"].includes(activePreset)&&!s.motion;
  }
  if(!presetCamera && s.camera_effect) {
    sliderDisplay("intensity-slider",round((s.camera_effect?.intensity??.5)*100),"%");
  }
  syncTiming(s);
}

function dragTarget(x,y) {
  const camera=sampleCamera(shot(),time);
  const candidates=[["camera",mapPoint(camera.position)],["target",mapPoint(camera.target)]];
  candidates.sort((a,b)=>(a[0]===preferredMarker?-1:1)-(b[0]===preferredMarker?-1:1));
  for(const [kind,p] of candidates) if(Math.hypot(x-p[0],y-p[1])<=12) return {kind};
  const baseIds=new Set(scene().objects.filter(o=>!isCompanion(o)).map(o=>o.id));
  const entities=sceneObjectsAt(shot(),time).filter(o=>!o.hidden&&baseIds.has(o.id));
  for(const o of entities.sort((a,b)=>(a.size[0]*a.size[2])-(b.size[0]*b.size[2]))) {
    const p=mapPoint(o.position);
    const size=Math.max(11,Math.min(45,Math.hypot(o.size[0],o.size[2])*canvasFit.scale/2));
    if(Math.hypot(x-p[0],y-p[1])<=size) return {kind:"object",id:o.id,position:o.position};
  }
  return null;
}

map.addEventListener("pointerdown",event=>{
  if(!plan || !canvasFit || !canEdit() || event.button!==0) return;
  pause();
  const rect=map.getBoundingClientRect();
  const x=event.clientX-rect.left,y=event.clientY-rect.top;
  if(geometryPlacement){
    event.preventDefault();
    const [worldX,worldZ]=mapWorld(x,y);
    commitGeometryPlacement([worldX,0,worldZ]);return;
  }
  const target=dragTarget(x,y) || {kind:"pan",startX:x,startY:y,centerX:canvasFit.x,centerZ:canvasFit.z};
  if(target.kind==="object"&&trialEdit&&trialEdit.kind!=="actor:"+target.id)endEdit();
  if(target.kind==="object"&&!chooseTrack(target.id))return;
  if(target.kind!=="pan")beginEdit();
  drag={...target, pointer:event.pointerId};
  map.setPointerCapture(event.pointerId);
  map.classList.add("dragging");
  if(target.kind==="object"){
    selectedEntity=target.id;ui.entity.value=target.id;
    const base=objectAt(shot(),scene().objects.find(o=>o.id===target.id),time);
    drag.stateOffset=sub(target.position||base.position,base.position);
  } else if(target.kind!=="pan") preferredMarker=target.kind;
  invalidate();
});
map.addEventListener("pointermove",event=>{
  if(geometryPlacement&&canvasFit){
    const rect=map.getBoundingClientRect(),[x,z]=mapWorld(event.clientX-rect.left,event.clientY-rect.top);
    updateGeometryPlacementPosition([x,0,z]);return;
  }
  if(!drag || drag.pointer!==event.pointerId) return;
  const rect=map.getBoundingClientRect();
  if(drag.kind==="pan") {
    canvasFit.x=drag.centerX-(event.clientX-rect.left-drag.startX)/canvasFit.scale;
    canvasFit.z=drag.centerZ-(event.clientY-rect.top-drag.startY)/canvasFit.scale;
    invalidate();return;
  }
  const [x,z]=mapWorld(event.clientX-rect.left,event.clientY-rect.top);
  if(drag.kind==="object") {
    const o=scene().objects.find(o=>o.id===drag.id);
    setActor(drag.id,[x-(drag.stateOffset?.[0]||0),objectAt(shot(),o,time).position[1],z-(drag.stateOffset?.[2]||0)]);
  } else {
    const key=drag.kind==="camera"?"position":"target";
    updateCamera(camera=>{
      const next=[round(x),camera[key][1],round(z)];
      const opposite=camera[key==="position"?"target":"position"];
      if(Math.hypot(...sub(next,opposite))>.025) camera[key]=next;
    });
  }
});
function stopDrag(){drag=null;map.classList.remove("dragging");}
map.addEventListener("pointerup",stopDrag);map.addEventListener("pointercancel",stopDrag);
map.addEventListener("lostpointercapture",stopDrag);
map.addEventListener("wheel",event=>{
  if(!canvasFit||drag)return;
  event.preventDefault();
  const rect=map.getBoundingClientRect();
  const x=event.clientX-rect.left,y=event.clientY-rect.top;
  const [worldX,worldZ]=mapWorld(x,y);
  canvasFit.scale=clamp(canvasFit.scale*Math.exp(-event.deltaY*.0015),4,450);
  const [nextX,nextZ]=mapWorld(x,y);
  canvasFit.x+=worldX-nextX;canvasFit.z+=worldZ-nextZ;
  invalidate();
},{passive:false});
ui.fit.addEventListener("click",()=>{
  if(!plan)return;
  if(isStage3D()){window.stageObserve?.fit?.();updateFitLabel();return;}
  if(!canvasFit)return;
  if(savedMapFit){
    canvasFit={...savedMapFit,w:canvasFit.w,h:canvasFit.h};savedMapFit=undefined;
  } else {
    savedMapFit={...canvasFit};
    const s=shot(),objects=sceneObjectsAt(s,time).filter(o=>!o.hidden);
    const view=sampleCamera(s,time);
    const path=s.motion?.keys?.length ? Array.from({length:25},(_,i)=>sampleCamera(s,i/24)) : [];
    const markers=path.flatMap(key=>[key.position,key.target]).map(position=>({position,size:[.001,.001,.001]}));
    canvasFit=computeMapFit([...objects,...markers],view,canvasFit.w,canvasFit.h);
  }
  updateFitLabel();invalidate();
});
ui["stage-view"]?.addEventListener("change",()=>{updateFitLabel();invalidate();});
if(ui["pan-preview"])ui["pan-preview"].hidden=true;


const panButtonSelector="button[data-pan-x],button[data-pan-y]";
const keyboardPan={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]};
const panStep=()=>clamp(Number(ui["pan-step"]?.value)||.25,.01,10);
const panDirection=button=>[Number(button.dataset.panX||0),Number(button.dataset.panY||0)];

function stopPanPress() {
  if(!panPress) return;
  const {frame,button,pointer}=panPress;
  panPress=null;
  cancelAnimationFrame(frame);
  button?.classList.remove("pan-pressed");
  if(pointer!==undefined&&button?.hasPointerCapture(pointer)) button.releasePointerCapture(pointer);
  endEdit();
}

function continuePanPress(now) {
  if(!panPress) return;
  const press=panPress;
  if(!plan||selectedShot!==press.shotId||time!==press.time||!canEdit()) {
    stopPanPress();
    return;
  }
  if(now>=press.start+200) {
    const seconds=(now-press.start-200)/1000;
    // Ramp over the first moments of a hold, then move at the chosen rate.
    const travel=seconds<.15?seconds*seconds/.30:seconds-.075;
    const distance=press.step+travel*press.speed;
    translateFraming(press.direction[0]*distance,press.direction[1]*distance,press.base);
  }
  press.frame=requestAnimationFrame(continuePanPress);
}

function startPanPress(direction,button,pointer,key) {
  if(!plan||!canEdit()||panPress||(!direction[0]&&!direction[1])) return false;
  pause();beginEdit();
  const step=panStep(),base=sampleBaseCamera(shot(),time);
  panPress={direction,button,pointer,key,step,base,shotId:selectedShot,time,
    start:performance.now(),speed:Math.min(12,step*4)};
  button?.classList.add("pan-pressed");
  translateFraming(direction[0]*step,direction[1]*step,base);
  panPress.frame=requestAnimationFrame(continuePanPress);
  return true;
}

document.addEventListener("pointerdown",event=>{
  const button=event.target.closest(panButtonSelector);
  if(!button||button.disabled||event.button!==0||!event.isPrimary) return;
  if(startPanPress(panDirection(button),button,event.pointerId)) button.setPointerCapture(event.pointerId);
});
for(const eventName of ["pointerup","pointercancel","lostpointercapture"]) document.addEventListener(eventName,event=>{
  if(panPress?.pointer===event.pointerId) stopPanPress();
});

document.addEventListener("keydown",event=>{
  const button=event.target.closest(panButtonSelector);
  const previewControl=event.target===preview&&preview.classList.contains("pan-ready");
  if(!button&&!previewControl) return;
  const direction=keyboardPan[event.key]||(button&&(event.key===" "||event.key==="Enter")?panDirection(button):null);
  if(!direction||(!plan)||!canEdit()) return;
  event.preventDefault();
  if(!event.repeat&&!button?.disabled) startPanPress(direction,button,undefined,event.key);
});
document.addEventListener("keyup",event=>{
  if(panPress?.key===event.key) {
    event.preventDefault();
    stopPanPress();
  }
});

document.addEventListener("click",event=>{
  const button=event.target.closest(panButtonSelector);
  // Pointer and held keyboard presses are handled on press. A synthetic
  // activation from assistive technology still receives one precise step.
  if(!button||button.disabled||event.detail!==0||!plan||!canEdit()) return;
  pause();
  const [x,y]=panDirection(button),step=panStep();
  translateFraming(x*step,y*step,sampleBaseCamera(shot(),time));
});
window.addEventListener("blur",stopPanPress);
document.addEventListener("visibilitychange",()=>{if(document.hidden) stopPanPress();});

preview.addEventListener("pointerdown",event=>{
  if(!plan||!canEdit()||event.button!==0)return;
  stopPanPress();beginEdit();
  const base=sampleBaseCamera(shot(),time), width=preview.getBoundingClientRect().width;
  const metresPerPixel=Math.hypot(...sub(base.target,base.position))*(base.sensor_width_mm||36)/
    ((base.focal_mm||defaultLens)*Math.max(1,width));
  pause();
  previewPan={id:event.pointerId,x:event.clientX,y:event.clientY,base,metresPerPixel};
  preview.setPointerCapture(event.pointerId);preview.classList.add("dragging");
});
preview.addEventListener("pointermove",event=>{
  if(previewPan?.id!==event.pointerId)return;
  translateFraming((previewPan.x-event.clientX)*previewPan.metresPerPixel,
    (event.clientY-previewPan.y)*previewPan.metresPerPixel,previewPan.base);
});
for(const name of ["pointerup","pointercancel","lostpointercapture"])preview.addEventListener(name,()=>{
  previewPan=null;preview.classList.remove("dragging");
});
ui["select-target"].addEventListener("click",()=>{
  document.getElementById("view-layout")?.click();
  window.stageObserve?.setMode("top2d");
  preferredMarker=preferredMarker==="target"?"camera":"target";
  ui["select-target"].classList.toggle("on",preferredMarker==="target");
  invalidate();
});
function numberEdit(input, lower, upper, handler){
  input.addEventListener("change",()=>{
    const v=Number(input.value);
    if(Number.isFinite(v) && input.value.trim()) handler(clamp(v,lower,upper));
    invalidate();
  });
}
numberEdit(ui.focal,5,300,n=>updateCamera(c=>{c.focal_mm=n;}));
numberEdit(ui.height,.05,50,n=>updateCamera(c=>{c.position[1]=n;}));
if(ui["shot-duration"]) numberEdit(ui["shot-duration"],.1,30,value=>{
  if(plan&&canEdit()) {pause();setShotDuration(value);}
});
bindSlider("shot-duration-slider",setShotDuration);
ui["timing-mode"]?.addEventListener("click",()=>{
  if(pendingEditNotice())return;
  if(!plan||!canEdit()) return;
  pause();
  enableTiming(shot());
  setTimingStatus(t("点路径点可跳转。到达时间决定速度，停留结束后才出发。"));
  markChanged();
});
ui["waypoint-add"]?.addEventListener("click",addWaypoint);
for(const button of ui["focal-presets"].querySelectorAll("button")) button.addEventListener("click",()=>updateCamera(c=>{c.focal_mm=+button.dataset.focal;}));
for(const button of ui["height-presets"].querySelectorAll("button")) button.addEventListener("click",()=>updateCamera(c=>{c.position[1]=+button.dataset.height;}));
for(const button of ui["angle-presets"].querySelectorAll("[data-angle]")) button.addEventListener("click",()=>updateCamera(c=>{
  const a=+button.dataset.angle*radians;
  const [x,y,z]=sub(c.position,c.target);
  c.position=add(c.target,[x*Math.cos(a)-z*Math.sin(a),y,x*Math.sin(a)+z*Math.cos(a)]).map(v=>round(v));
}));
ui.entity.addEventListener("change",()=>{const id=ui.entity.value;if(chooseTrack(id||"camera")){selectedEntity=id;invalidate();}});
for(const [i,axis] of ["x","y","z"].entries()) {
  const input=ui["actor-"+axis];
  numberEdit(input,-1000,1000,n=>{
    const o=scene().objects.find(item=>item.id===selectedEntity);
    if(!o) return;
    const p=[...objectAt(shot(),o,time).position];
    p[i]=n;
    setActor(o.id,p);
  });
}
const orbitPad=ui["camera-orb"];
orbitPad?.addEventListener("pointerdown",event=>{
  if(!plan || !canEdit() || event.button!==0) return;
  pause();
  orbitDrag={pointer:event.pointerId,x:event.clientX,y:event.clientY,...orbitRead(sampleBaseCamera(shot(),time))};
  orbitPad.setPointerCapture(event.pointerId);
  orbitPad.classList.add("dragging");
});
orbitPad?.addEventListener("pointermove",event=>{
  if(orbitDrag?.pointer!==event.pointerId) return;
  const scale=360/Math.max(140,orbitPad.getBoundingClientRect().width);
  setOrbit({yaw:orbitDrag.yaw+(event.clientX-orbitDrag.x)*scale,
    pitch:wrapDegrees(orbitDrag.pitch-(event.clientY-orbitDrag.y)*scale*.72)});
});
for(const ev of ["pointerup","pointercancel","lostpointercapture"]) orbitPad?.addEventListener(ev,()=>{
  orbitDrag=null;orbitPad.classList.remove("dragging");
});
bindSlider("azimuth-slider",yaw=>setOrbit({yaw}));
bindSlider("elevation-slider",pitch=>setOrbit({pitch}));
bindSlider("distance-slider",dist=>setOrbit({dist:Math.max(.08,dist)}));
bindSlider("roll-slider",roll=>updateCamera(c=>{c.roll_deg=wrapDegrees(roll+(Math.abs(orbitRead(c).pitch)>90?180:0));}));
bindSlider("height-slider",height=>updateCamera(c=>{c.position[1]=height;}));
bindSlider("focal-slider",focal=>updateCamera(c=>{c.focal_mm=focal;}));
for(const [index,axis] of ["x","y","z"].entries()) bindSlider(`subject-${axis}-slider`,value=>{
  const subject=scene().objects.find(o=>o.id===selectedEntity);
  if(!subject) return;
  const location=[...objectAt(shot(),subject,time).position];
  location[index]=value;
  setActor(subject.id,location);
});
bindSlider("subject-yaw-slider",yaw=>{
  const subject=scene().objects.find(o=>o.id===selectedEntity);
  if(subject) setActor(subject.id,objectAt(shot(),subject,time).position,null,yaw);
});

function applyLens(mode) {
  if(!plan || !canEdit()) return;
  pause();
  if(!beginTrialEdit("camera"))return false;
  const s=shot(), current=sampleBaseCamera(s,time);
  lensSelected=mode;
  s.camera.lens_model=mode==="fisheye"?"fisheye":"perspective";
  updateCamera(c=>{
    if(mode==="fisheye") c.focal_mm=15;
    else if(mode==="ultra-wide") c.focal_mm=18;
    else if(mode==="macro") {
      const obj=scene().objects.find(o=>o.id===selectedEntity);
      if(obj) {
        const pose=objectAt(s,obj,time);
        c.target=cleanPoint(add(pose.position,[0,pose.size[1]/2,0]));
      }
      c.focal_mm=70;
      const look=unit(sub(current.position,current.target));
      const distance=obj?Math.max(.35,obj.size[1]*2.2,obj.size[0]*2.2):.65;
      c.position=cleanPoint(add(c.target,mul(look,distance)));
    } else if(mode==="tele" || mode==="portrait") {
      c.focal_mm=mode==="portrait"?50:85;
      const orb=spherical(c);
      c.position=orbitPosition(c,{...orb,dist:orb.dist*c.focal_mm/(current.focal_mm||defaultLens)});
    } else if(mode==="standard") c.focal_mm=35;
  });
}
for(const button of ui["lens-mode"]?.querySelectorAll("[data-lens]") || []) button.addEventListener("click",()=>applyLens(button.dataset.lens));

const presetNames={...Object.fromEntries(Object.entries(window.StageCinema?.definitions||{}).map(([id,spec])=>[id,spec.name])),tilt:"俯仰摇摄",pedestal:"垂直升降",zoom:"变焦",dolly_zoom:"推拉变焦",handheld:"手持",shoulder:"肩扛",push:"推进",pull:"拉远",pan:"横摇",truck:"横移",track:"跟拍",jib:"摇臂",orbit:"绕拍",fpv:"FPV",breathing:"呼吸感"};
const shakePresets=new Set(["handheld","shoulder","breathing"]);
const basicSpeedPresets=new Set(["push","pull","truck","orbit","jib"]);

function getBasicMotionSpeed() {
  const s=plan&&shot(),totalSeconds=s?duration(s):0,motion=s?.motion,moveSeconds=Number(motion?.duration_s)||0;
  const rate=moveSeconds>0?totalSeconds/moveSeconds:1;
  const source=originalPlan?.shots.find(item=>item.id===s?.id),sourceMotion=source?.motion;
  const sourceRate=source?.motion_preset===s?.motion_preset&&basicSpeedPresets.has(source?.motion_preset)&&!sourceMotion?.timing_mode&&sourceMotion?.keys?.length>=2&&!sourceMotion.keys.some(key=>(key.hold_s||0)>0)&&sourceMotion.duration_s>=.1&&sourceMotion.duration_s<=duration(source)?duration(source)/sourceMotion.duration_s:1;
  const sourceMinimum=sourceRate>4?totalSeconds/sourceRate:Infinity;
  const minimumSeconds=s?Math.min(totalSeconds,Math.ceil(.1*fps())/fps(),moveSeconds>=.1?moveSeconds:Infinity,sourceMinimum>=.1?sourceMinimum:Infinity):0;
  const max=minimumSeconds>0?Math.min(totalSeconds/minimumSeconds,Math.max(4,rate,sourceRate)):1;
  const result={enabled:false,reason:"unavailable",rate,min:1,max,step:.05,moveSeconds,holdSeconds:Math.max(0,totalSeconds-moveSeconds),totalSeconds};
  if(!s)return result;
  if(!canEdit()||comparisonActive()||geometryPlacement)return {...result,reason:"readonly"};
  if(!motion?.keys?.length)return {...result,reason:"fixed"};
  if(!basicSpeedPresets.has(s.motion_preset))return {...result,reason:"custom"};
  if(motion.timing_mode||motion.keys.some(key=>(key.hold_s||0)>0)||motion.keys.length<2||motion.keys[0].t!==0||motion.keys.at(-1).t!==1||moveSeconds<.1||moveSeconds>totalSeconds)return {...result,reason:"advanced"};
  if(max<=1+1e-7)return {...result,reason:"short"};
  return {...result,enabled:true,reason:""};
}

function setBasicMotionSpeed(value) {
  const control=getBasicMotionSpeed();if(!control.enabled||!Number.isFinite(value)||value<=0)return false;
  const rate=clamp(value,control.min,control.max),minimum=Math.min(control.totalSeconds,Math.ceil(control.totalSeconds/control.max*fps())/fps());
  if(Math.abs(rate-control.rate)<1e-7)return false;
  const seconds=round(clamp(frameTime(control.totalSeconds/rate),minimum,control.totalSeconds),8);
  if(Math.abs(seconds-control.moveSeconds)<1e-7)return false;
  pause();if(!beginTrialEdit("camera"))return false;
  const s=shot();
  // Legacy shots may derive their length from the movement. Freeze the existing
  // shot length before retiming only its camera; routes and subject times stay intact.
  if(!s.duration_s)s.duration_s=control.totalSeconds;
  s.motion.duration_s=seconds;presetContext=null;selectedSegment=null;
  chooseTrack("camera",true);sliderDisplay("motion-duration-slider",seconds," s");markChanged();return true;
}

function play() {
  if(sceneOverview)return;
  if(geometryPlacement){notice(t("先在左侧片场放置物体，或取消放置后再播放。"));return;}
  if(playing!==null) pause();
  endEdit();
  if(time>=1)time=0;
  lastFrame=performance.now();
  ui.play.textContent="❚❚";ui.play.setAttribute("aria-label",t("暂停"));
  playing=requestAnimationFrame(playFrame);
}

function motionControl(id, fallback) {
  return Number(ui[id]?.value??fallback);
}
function knownMotionDirection(s) {return s.motion_preset&&s.motion&&[1,-1].includes(s.motion.preset_direction)?String(s.motion.preset_direction):"";}

function updateMotionPreset(options={}) {
  if(!activePreset)return false;
  if(!beginTrialEdit("camera"))return false;
  const kind=activePreset,cinema=cinemaDefinition(kind);
  if(cinema?.wholeShot&&ui["motion-scope"]?.value!=="shot"){
    ui["motion-scope"].value="shot";presetContext=null;selectedSegment=null;
    notice(t`${t(cinema.name)}作用于整镜所有主体，已切换整条路线；镜头总时长保持不变。`,true);
  }
  const context=preparePresetContext();
  context.direction=Number(ui["motion-direction"]?.value||1)<0?-1:1;
  if(Number.isFinite(options.freezeAt))context.freezeAt=options.freezeAt;
  const s=shot();
  chooseTrack("camera",true);
  const amplitude=motionControl("intensity-slider",50)/100;
  const travel=motionControl("travel-slider",1);
  const interval=context.scope==="segment"?context.seconds:duration(s);
  const seconds=context.scope==="segment"&&!cinema?context.seconds:clamp(motionControl("motion-duration-slider",interval),Math.min(.1,interval),interval);
  sliderDisplay("intensity-slider",Math.round(amplitude*100),"%");
  sliderDisplay("travel-slider",travel,motionUnit(kind));
  sliderDisplay("motion-duration-slider",seconds," s");
  if(cinema){
    const freezeAt=context.freezeAt??(window.StageTime?window.StageTime.sampleSeconds(s,(trialEdit?.time??time)*duration(s)):(trialEdit?.time??time)*duration(s));
    context.freezeAt=freezeAt;
    const focus=selectedEntity?subjectBounds(selectedEntity,trialEdit?.time??time)?.center:null;
    if(cinema.orbit){
      if(Number.isFinite(options.radius)){context.radius=options.radius;context.radiusLimited=false;}
      if(!Number.isFinite(context.radius)){
        const source=trialEdit?.before.plan.shots.find(item=>item.id===s.id)||s;
        const recommendation=window.StageCinema.recommendRadius(presetCamera,source.motion_preset===kind?[]:sceneObjectsAt(s,trialEdit?.time??time));
        context.radius=recommendation.radius;context.radiusLimited=recommendation.limited;
      }
      syncOrbitRadius(context.radius,context.radiusLimited);
    }
    const recipe=window.StageCinema.create(kind,{camera:presetCamera,travel,direction:Number(ui["motion-direction"]?.value||1),seconds,totalSeconds:interval,focus,freezeAt,radius:context.radius});
    if(context.scope==="segment"){
      const original=context.motion,first=original.keys[context.index],last=original.keys[context.index+1];
      const ratio=recipe.motion.duration_s/interval;
      const replacement=recipe.motion.keys.map((key,index)=>{
        const mapped={...copy(key),t:round(context.start+key.t*ratio*(context.end-context.start),8)};
        if(index===0){mapped.t=first.t;mapped.hold_s=(first.hold_s||0)+(key.hold_s||0);}
        return mapped;
      });
      const endpoint=replacement.at(-1);
      if(endpoint.t<context.end-timeEpsilon){
        // A duplicate endpoint creates a stationary tail without changing adjacent timing.
        replacement.push({...copy(endpoint),t:last.t,hold_s:last.hold_s||0});
      }else replacement[replacement.length-1]={...last,...endpoint,t:last.t,hold_s:last.hold_s||0};
      if(original.keys.length-2+replacement.length>24){notice(t("路径点已满。请先删除一些经过点，或选择整条路线。"));return false;}
      s.motion={...copy(original),keys:[...copy(original.keys.slice(0,context.index)),...replacement,...copy(original.keys.slice(context.index+2))]};
    }else s.motion=recipe.motion;
    if(!s.duration_s)s.duration_s=context.shotSeconds;
    if(recipe.timeEffect)s.time_effect=recipe.timeEffect;
    s.motion_preset=kind;
    sliderDisplay("travel-slider",round(recipe.actualTravel,3),motionUnit(kind));
    syncMotionSpeed(recipe.actualTravel,seconds,interval);
  }else if(shakePresets.has(kind)) {
    s.camera_effect={type:kind,intensity:amplitude,seed:s.camera_effect?.seed??7};
    if(s.motion&&!authoredTiming(s)) s.motion.duration_s=seconds;
  } else {
    const start=presetCamera, direction=Number(ui["motion-direction"]?.value||1)<0?-1:1, range=travel*direction;
    const ray=sub(start.target,start.position);
    const toward=unit(ray),dist=Math.hypot(...ray), up=[0,1,0];
    const side=Math.abs(toward[1])>.999?[1,0,0]:unit(cross(toward,up));
    const move=(p,m)=>add(p,m);
    const keys=[];
    const entry=(t,position,target, lens=start.focal_mm, roll=start.roll_deg||0)=>
      keys.push({t,position:cleanPoint(position),target:cleanPoint(target),focal_mm:round(lens,3),roll_deg:round(roll,3)});
    const pos=start.position, target=start.target;
    entry(0,pos,target);
    if(kind==="push" || kind==="pull") {
      const distance=Math.min(kind==="push"?range:-range,dist*.82);
      entry(1,move(pos,mul(toward,distance)),target);
    } else if(kind==="pan") {
      entry(1,pos,move(pos,rotateY(ray,clamp(range,-170,170))));
    } else if(kind==="truck") {
      const offset=mul(side,range);
      entry(1,move(pos,offset),move(target,offset));
    } else if(kind==="track") {
      let obj=scene().objects.find(o=>o.id===selectedEntity);
      if(!obj) obj=scene().objects.filter(o=>!isCompanion(o)&&(/person|actor|subject/.test(o.id)||o.actor_id))
        .sort((a,b)=>Math.hypot(...sub(a.position,target))-Math.hypot(...sub(b.position,target)))[0];
      if(obj){selectedEntity=obj.id;ui.entity.value=obj.id;}
      const moving=obj&&s.object_tracks?.[obj.id]?.length;
      const before=moving?objectAt(s,obj,context.start).position:null;
      for(const t of [.33,.67,1]) {
        const offset=moving?sub(objectAt(s,obj,context.start+t*seconds/duration(s)).position,before):mul(side,range*t);
        entry(t,move(pos,offset),move(target,offset));
      }
    } else if(kind==="jib") {
      entry(.5,move(pos,add(mul(up,range*.56),mul(toward,range*.1))),target);
      entry(1,move(pos,add(mul(up,range),mul(toward,range*.28))),target);
    } else if(kind==="orbit") {
      const angle=clamp(range,-360,360);
      for(const t of [.25,.5,.75,1]) entry(t,move(target,rotateY(sub(pos,target),angle*t)),target);
    } else if(kind==="tilt") {
      const axes=translationAxes(start),angle=clamp(range,-85,85)*radians;
      const look=add(mul(toward,Math.cos(angle)),mul(axes.up,Math.sin(angle)));
      entry(1,pos,move(pos,mul(look,dist)));
    } else if(kind==="pedestal") {
      const offset=mul(up,Math.max(-pos[1]+.05,range));
      entry(1,move(pos,offset),move(target,offset));
    } else if(kind==="zoom") {
      entry(1,pos,target,clamp(start.focal_mm+range,5,300));
    } else if(kind==="dolly_zoom") {
      const distance=Math.min(range,dist*.8),nextDist=dist-distance;
      entry(1,move(pos,mul(toward,distance)),target,clamp(start.focal_mm*nextDist/dist,5,300));
    } else if(kind==="fpv") {
      const forward=unit([toward[0],0,toward[2]]);
      for(const [t,x,y,z] of [[.24,-.35,.07,.35],[.58,.1,.24,.72],[1,.60,.56,.94]]) {
        const offset=add(add(mul(side,x*range),mul(up,y*range)),mul(forward,z*Math.min(range,dist*.82)));
        entry(t,move(pos,offset),move(target,mul(offset,.14)));
      }
      s.camera_effect={type:"fpv",intensity:amplitude,seed:0};
    }
    // Rig texture is independent of the base path. FPV roll remains until a different rig is selected.
    s.motion_preset=kind;
    if(context.scope==="segment"){
      const original=context.motion,first=original.keys[context.index],last=original.keys[context.index+1];
      const capacity=Math.max(2,24-original.keys.length+2);
      const use=keys.length<=capacity&&context.seconds*fps()>=keys.length-1?keys:[keys[0],keys.at(-1)];
      const replacement=use.map((k,i)=>i===0?{...first,...k,t:first.t}:i===use.length-1?{...last,...k,t:last.t}:
        {...k,t:round(context.start+k.t*(context.end-context.start),8)});
      s.motion={...copy(original),keys:[...copy(original.keys.slice(0,context.index)),...replacement,...copy(original.keys.slice(context.index+2))]};
    }else s.motion={duration_s:round(seconds,3),ease:"smooth",keys};
  }
  if(!shakePresets.has(kind)&&s.motion){
    if(context.scope==="shot")s.motion.preset_direction=Number(ui["motion-direction"]?.value||1)<0?-1:1;
    else delete s.motion.preset_direction;
  }
  markChanged();
  if(ui["preset-status"])ui["preset-status"].textContent=context.scope==="segment"
    ? t`第 ${context.index+1} 段已更新，下一段从新终点衔接。`
    : t`${t(presetNames[kind]||kind)} · 路线已更新，镜头总长不变。`;
  return true;
}

for(const button of ui["motion-presets"]?.querySelectorAll("[data-motion-preset]") || []) button.addEventListener("click",()=>{
  if(!plan || !canEdit()) return;
  const visibleSubjectSeconds=window.StageTime?window.StageTime.sampleSeconds(shot(),time*duration(shot())):time*duration(shot());
  pause();
  const s=shot();
  const previous=activePreset;
  const selected=button.dataset.motionPreset.replaceAll("-","_");
  if(shakePresets.has(selected)) {setRig(selected);return;}
  if(trialEdit&&(trialEdit.kind!=="camera"||trialEdit.shotId!==selectedShot))endEdit();
  activePreset=selected;
  presetContext=null;
  configureTravel(activePreset,true);
  presetCamera=presetStates.get(selectedShot) || sampleBaseCamera(s,0);
  if(!shakePresets.has(activePreset)) presetStates.set(selectedShot,presetCamera);
  presetShot=selectedShot;
  if(previous!==activePreset && ui["intensity-slider"]) sliderDisplay("intensity-slider",activePreset==="fpv"?65:50,"%");
  if(ui["motion-duration-slider"]){
    const spec=cinemaDefinition(activePreset);
    if(basicSpeedPresets.has(activePreset))ui["motion-duration-slider"].step="any";
    ui["motion-duration-slider"].value=spec?Math.min(duration(s),spec.moveSeconds||duration(s)):Math.min(duration(s),s.motion?.duration_s||duration(s));
  }
  if(updateMotionPreset(selected==="freeze_orbit"?{freezeAt:visibleSubjectSeconds}:{})!==false)play();
});
bindSlider("intensity-slider",value=>{
  sliderDisplay("intensity-slider",value,"%");
  if(shot().camera_effect&&beginTrialEdit("camera")) {shot().camera_effect.intensity=value/100;markChanged();}
});
bindSlider("travel-slider",value=>{
  sliderDisplay("travel-slider",value,motionUnit(activePreset));
  updateMotionPreset();
});
bindSlider("motion-duration-slider",value=>{
  if(authoredTiming(shot())&&!cinemaDefinition(activePreset)) return;
  sliderDisplay("motion-duration-slider",value," s");
  if(activePreset&&presetCamera&&presetShot===selectedShot) updateMotionPreset();
  else if(shot().motion&&beginTrialEdit("camera")) {shot().motion.duration_s=Math.min(value,duration(shot()));markChanged();}
});

bindSlider("orbit-radius-slider",value=>{
  if(!cinemaDefinition(activePreset)?.orbit)return;
  updateMotionPreset({radius:Math.max(.25,value)});
});
bindSlider("motion-speed-slider",value=>{
  if(!cinemaDefinition(activePreset)||value<=0)return;
  const interval=presetContext?.scope==="segment"?presetContext.seconds:duration(shot());
  const travel=motionControl("travel-slider",1),seconds=clamp(travel/value,Math.min(.1,interval),interval);
  sliderDisplay("motion-duration-slider",round(seconds,3)," s");
  updateMotionPreset();
});

for(const button of ui["actor-options"].querySelectorAll("button")) button.addEventListener("click",()=>{
  const o=scene().objects.find(item=>item.id===selectedEntity);
  if(!o) return;
  const mode=button.dataset.actorKey;
  const p=[...objectAt(shot(),o,time).position];
  if(!goTo(mode==="start"?0:1))return;
  setActor(o.id,p,mode);
});
for(const button of ui.keyframes.querySelectorAll("[data-key]")) button.addEventListener("click",()=>{
  const s=shot();
  goTo(button.dataset.key==="start"?0:(s.motion?.keys?.at(-1)?.t??1)*(s.motion?.duration_s??duration(s))/duration(s));
});
ui["add-motion"].addEventListener("click",()=>{
  if(pendingEditNotice())return;
  if (!canEdit() || shot().motion) return;
  const s=shot(), camera=sampleCamera(s,0);
  const toward = unit(sub(camera.target,camera.position));
  const translation = Math.min(.45,Math.hypot(...sub(camera.position,camera.target))*.22);
  s.motion = {duration_s:duration(s),ease:"smooth",keys:[
    {t:0,position:[...camera.position],target:[...camera.target]},
    {t:1,position:add(camera.position,mul(toward,translation)).map(v=>round(v)),target:[...camera.target]}
  ]};
  goTo(1);
  markChanged();
});
ui.time.addEventListener("input",()=>goTo(+ui.time.value/1000));
function goTo(t,options={}){
  if(geometryPlacement)cancelGeometryPlacement(t("已切换时刻，放置已取消。"));
  if(Math.abs(t-time)>timeEpsilon&&!options.preserveGesture){endEdit();presetContext=null;}
  pause();time=t;invalidate();return true;
}
function pause() {
  if(playing!==null) cancelAnimationFrame(playing);
  playing=null;
  ui.play.textContent="▶"; ui.play.setAttribute("aria-label",t("播放"));
}
function playFrame(now) {
  const end=1;
  time=clamp(time+(now-lastFrame)/(duration(shot())*1000),0,end);
  lastFrame=now;
  invalidate();
  if(time===end) pause();
  else playing=requestAnimationFrame(playFrame);
}
ui.play.addEventListener("click",()=>{
  if(!plan||sceneOverview) return;
  if(playing!==null){pause();return;}
  play();
});
document.addEventListener("keydown",event=>{
  if(!plan||sceneOverview||event.code!=="Space"||event.repeat||event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||
    event.target.closest("button, a, input, select, textarea, summary, [contenteditable='true']")) return;
  event.preventDefault();
  if(playing!==null) pause();
  else {
    stopPanPress();
    play();
  }
});

function localPatch() {
  return {stage_id:session.id,base_revision:session.revision,...(session.project_id?{project_id:session.project_id}:{}),...(session.document_id?{document_id:session.document_id}:{}),plan:copy(plan),snapshot_marks:copy(snapshotMarks),scene_edits:[...sceneEdits],deleted_shots:[...deletedShots]};
}
let handoffBusy=false;
function exportChanges(){if(!plan)throw Error(t('未找到工程'));endEdit();return localPatch();}
function exportProject(){
  if(!plan)throw Error(t('未找到工程'));endEdit();
  const edits={changed:[...changed],snapshot_marks:copy(snapshotMarks),scene_edits:[...sceneEdits],deleted_shots:[...deletedShots]};
  return {kind:'directors-stage-ui-project',schema:1,id:session.id,revision:session.revision,can_edit:session.can_edit,
    ...Object.fromEntries(['project_id','document_id','conversation_id','project_title','shot_id'].filter(key=>session[key]!==undefined).map(key=>[key,session[key]])),
    baseline:copy(originalPlan),plan:copy(plan),edits};
}
ui.save.addEventListener('click',async()=>{
  if(!plan||handoffBusy||!canHandoff()||comparisonActive())return;
  handoffBusy=true;ui.save.disabled=true;pause();
  try {
    const project=exportProject(),changes=exportChanges(),host=window.DirectorsStageHost;
    if(typeof host?.saveProject==='function'){
      const result=await host.saveProject(project,{changes});
      if(result?.saved!==true)throw Error(t('保存结果未确认'));
      notice(t('工程已保存'),true);
    }else {window.StageFrontend.download(project,'directors-stage-project.json');notice(t('工程已下载'),true);}
    storeLocal();
  }catch(error){notice(t(error.message));}
  finally{handoffBusy=false;ui.save.disabled=!canHandoff()||comparisonActive();}
});
ui['export-changes'].addEventListener('click',()=>{try{window.StageFrontend.download(exportChanges(),'directors-stage-changes.json');notice(t('修改已下载'),true);}catch(error){notice(t(error.message));}});
ui['open-project'].addEventListener('click',()=>ui['project-file'].click());
ui['project-file'].addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{if(file.size>16*1024*1024)throw Error(t('工程格式无效'));await openProject(JSON.parse(await file.text()));}
  catch(error){notice(t(error.message));}finally{event.target.value='';}
});

function comparisonActive() {
  return Boolean(ui["compare-before"]?.checked && originalPlan?.shots.some(s=>s.id===selectedShot));
}
function renderSceneViews(render = ()=>{drawMap();drawPreview();drawOrbit();}) {
  const current=plan;
  try {if(comparisonActive())plan=originalPlan;render();}
  finally {plan=current;}
}
function toggleComparison() {
  endEdit();
  const requested=ui["compare-before"]?.checked;
  if(requested && !originalPlan?.shots.some(s=>s.id===selectedShot)){
    ui["compare-before"].checked=false;notice(t("该镜头没有可对照的修改前版本。"));
  }
  const active=comparisonActive();
  ui.save.disabled=handoffBusy||active||!canHandoff();
  document.querySelector("main").inert=active;
  if(ui["compare-label"]){ui["compare-label"].hidden=!active;ui["compare-label"].textContent=t("修改前 · 只读");}
  pause();stopPanPress();invalidate();
}

// Compatibility entry points now close an automatic gesture; no confirmation is required.
function pendingEditNotice() {
  if(trialEdit)endEdit();
  return false;
}
function beginTrialEdit(kind) {
  if(kind!=="camera"&&subjectTimeLocked()){notice(t("先恢复正常主体时间，再编辑走位或状态。摄影机仍可正常调整。"));return false;}
  if(!plan||!canEdit()||comparisonActive())return false;
  if(geometryPlacement){notice(t("先在左侧片场放置物体，或按 Esc 取消放置。"));return false;}
  if(trialEdit&&(trialEdit.kind!==kind||trialEdit.shotId!==selectedShot||Math.abs(time-trialEdit.time)>1e-5))endEdit();
  if(!editTransaction){
    const transaction=editTransaction={before:captureHistory(),dirty:false,implicit:true};
    // Nested camera/framing changes in one event are one undo action. Pointer and
    // keyboard gestures use explicit beginEdit/endEdit and do not finish here.
    Promise.resolve().then(()=>{if(editTransaction===transaction)endEdit();});
  }
  if(!trialEdit)trialEdit={kind,shotId:selectedShot,time,before:editTransaction.before};
  return true;
}
function applyTrialEdit() { return endEdit(); }
function revertTrialEdit() { return undoEdit(); }

function selectMotionSegment(index) {
  if(pendingEditNotice())return false;
  selectedSegment=index===null?null:Math.max(0,Math.floor(index));presetContext=null;invalidate();return true;
}
function preparePresetContext() {
  if(presetContext)return presetContext;
  const s=shot(),scope=ui["motion-scope"]?.value||"segment";
  const source=trialEdit?.before.plan.shots.find(item=>item.id===s.id)||s;
  if(scope==="segment"&&source.motion?.keys?.length>=2){
    const original=copy(source.motion),total=duration(source);
    const motion={...original,duration_s:total,timing_mode:"arrival",keys:original.keys.map(k=>({...k,t:k.t*original.duration_s/total}))};
    let index=selectedSegment;
    if(index===null||index>=motion.keys.length-1){index=motion.keys.findIndex((k,i)=>i<motion.keys.length-1&&time>=k.t&&time<motion.keys[i+1].t);if(index<0)index=Math.max(0,motion.keys.length-2);}
    const a=motion.keys[index],b=motion.keys[index+1],start=a.t+(a.hold_s||0)/total,end=b.t;
    presetContext={scope:"segment",motion,index,start,end,seconds:Math.max(1/fps(),(end-start)*total),camera:sampleBaseCamera(source,a.t)};
    selectedSegment=index;
  }else presetContext={scope:"shot",start:0,end:1,seconds:duration(source),camera:sampleBaseCamera(source,0)};
  presetContext.shotSeconds=duration(source);
  presetCamera=copy(presetContext.camera);presetShot=selectedShot;
  return presetContext;
}
function previewCamera(camera) {
  if(pendingEditNotice())return false;
  if(!plan||!canEdit()||comparisonActive())return false;
  pause();
  if(!camera||!Array.isArray(camera.position)||!Array.isArray(camera.target)||[...camera.position,...camera.target].some(v=>!Number.isFinite(v)))return false;
  if(!beginTrialEdit("camera"))return false;
  updateCamera(c=>{for(const key of ["position","target","focal_mm","roll_deg"])if(camera[key]!==undefined)c[key]=copy(camera[key]);},{reframe:true});
  return true;
}

function setStaticCamera() {
  if(!plan||!shot()||!canEdit()||comparisonActive()||geometryPlacement)return false;
  pause();stopPanPress();endEdit();
  const s=shot(),hasRoute=s.motion!==undefined||s.motion_preset!==undefined;
  const camera=copy(sampleBaseCamera(s,time)),seconds=duration(s);
  if(hasRoute){
    beginEdit();
    if(!beginTrialEdit("camera")){endEdit();return false;}
    s.camera=camera;
    // Older plans can keep the shot length only on the camera route.
    if(!s.duration_s)s.duration_s=seconds;
    delete s.motion;delete s.motion_preset;
  }
  activePreset=null;presetContext=null;presetCamera=null;presetShot=null;
  presetStates.delete(selectedShot);selectedSegment=null;timingSignature="";orbitBranch=null;
  chooseTrack("camera",true);configureTravel(null,false);
  if(hasRoute){markChanged();endEdit();}
  else invalidate();
  return hasRoute;
}

// Editing history groups a pointer drag or keyboard adjustment into one reversible action.
function captureHistory() {
  return {plan:copy(plan),shotId:selectedShot,overviewSceneId:sceneOverview?.scene||null,navigationMode,entity:selectedEntity,track:selectedTrack,selectedSegment,time,changed:[...changed],sceneEdits:[...sceneEdits],deletedShots:[...deletedShots]};
}
function beginEdit() {
  if(!plan || !canEdit() || restoringHistory)return;
  if(editTransaction){if(!editTransaction.implicit)return;endEdit();}
  editTransaction={before:captureHistory(),dirty:false,implicit:false};
}

function commitHistory(before) {
  if(!plan || restoringHistory)return;
  const prior=before || (historyBaseline && {...historyBaseline,shotId:selectedShot,entity:selectedEntity,time});
  if(prior && JSON.stringify(prior.plan)!==JSON.stringify(plan)) {
    undoStack.push(prior);if(undoStack.length>40)undoStack.shift();redoStack.length=0;
  }
  historyBaseline=captureHistory();
}
function endEdit() {
  const transaction=editTransaction;
  editTransaction=null;trialEdit=null;
  if(!transaction)return false;
  if(transaction.dirty){
    commitHistory(transaction.before);committedRevision++;
    if(localSaveTimer!==null){clearTimeout(localSaveTimer);localSaveTimer=null;}
    storeLocal();syncAutoEditStatus();updateStatus();invalidate();
  }
  return transaction.dirty;
}

function restoreHistory(snapshot) {
  restoringHistory=true;
  pause();stopPanPress();
  plan=copy(snapshot.plan);committedRevision++;changed=new Set(snapshot.changed);sceneEdits=new Set(snapshot.sceneEdits||[]);deletedShots=new Set(snapshot.deletedShots||[]);
  if(snapshot.shotDeletion){
    const ids=new Set(snapshot.shotDeletion.ids),present=new Set(plan.shots.map(item=>item.id));
    snapshotMarks=snapshotMarks.filter(mark=>!ids.has(mark.shot_id));
    for(const entry of snapshot.shotDeletion.marks||[])if(present.has(entry.mark.shot_id))snapshotMarks.splice(Math.min(entry.index,snapshotMarks.length),0,copy(entry.mark));
    capturedSnapshot=null;renderSnapshotMarks();
  }
  navigationMode=snapshot.navigationMode||navigationMode;
  presetContext=null;renderShotList();
  if(snapshot.overviewSceneId&&plan.scenes[snapshot.overviewSceneId])selectScene(snapshot.overviewSceneId);
  else if(plan.shots.some(item=>item.id===snapshot.shotId))selectShot(snapshot.shotId,{force:true});
  else if(plan.shots.length)selectShot(plan.shots[0].id,{force:true});
  else selectScene(Object.keys(plan.scenes)[0]);
  selectedEntity=snapshot.entity;ui.entity.value=selectedEntity||"";selectedTrack=snapshot.track||"camera";selectedSegment=snapshot.selectedSegment??null;if(ui["path-track"])ui["path-track"].value=selectedTrack;time=snapshot.time;
  timingSignature="";presetStates.clear();
  historyBaseline=captureHistory();restoringHistory=false;syncContextCaptions();storeLocal();invalidate();
}
function historyCounterpart(entry) {
  const current=captureHistory();
  if(entry.shotDeletion){const ids=new Set(entry.shotDeletion.ids),marks=snapshotMarks.flatMap((mark,index)=>ids.has(mark.shot_id)?[{index,mark:copy(mark)}]:[]);current.shotDeletion={ids:[...ids],marks};}
  return current;
}
function shotManagementState() {
  const allowed=Boolean(plan&&canHandoff()&&!comparisonActive()&&!handoffBusy),deletion=lastShotDeletion;
  return {canDelete:allowed,deletedIds:[...deletedShots],undoDeletion:allowed&&deletion&&undoStack.at(-1)===deletion.entry&&!editTransaction?.dirty?{id:deletion.id,title:deletion.title,sequence:deletion.sequence}:null};
}
function deleteShot(id) {
  if(!shotManagementState().canDelete)return false;
  const index=plan.shots.findIndex(item=>item.id===id);if(index<0)return false;
  pause();stopPanPress();endEdit();cancelGeometryPlacement();
  const removed=plan.shots[index],before=captureHistory(),ids=new Set([id]);
  before.shotDeletion={ids:[id],marks:snapshotMarks.flatMap((mark,markIndex)=>ids.has(mark.shot_id)?[{index:markIndex,mark:copy(mark)}]:[])};
  plan.shots.splice(index,1);changed.delete(id);
  if(originalPlan?.shots.some(item=>item.id===id))deletedShots.add(id);
  snapshotMarks=snapshotMarks.filter(mark=>mark.shot_id!==id);if(capturedSnapshot?.shot_id===id)capturedSnapshot=null;
  presetStates.delete(id);for(const [sceneId,last]of sceneLastShot)if(last===id)sceneLastShot.delete(sceneId);
  if(plan.shots.length){const rate=fps();plan.target_duration_s=round(plan.shots.reduce((sum,item)=>sum+Math.round(duration(item)*rate),0)/rate,8);}else delete plan.target_duration_s;
  if(!plan.shots.length)navigationMode="scene";
  renderShotList();
  if(selectedShot===id){
    const ordered=plan.shots.slice(index).concat(plan.shots.slice(0,index).reverse());
    const adjacent=ordered.find(item=>item.video_id===removed.video_id)||ordered.find(item=>item.scene===removed.scene)||ordered[0];
    if(adjacent)selectShot(adjacent.id,{force:true});else selectScene(removed.scene);
  }else updateShotSelection();
  commitHistory(before);committedRevision++;lastShotDeletion={entry:undoStack.at(-1),id,title:shotName(removed),sequence:++shotDeletionSequence};
  if(localSaveTimer!==null){clearTimeout(localSaveTimer);localSaveTimer=null;}storeLocal();renderSnapshotMarks();syncAutoEditStatus();updateStatus();invalidate();return true;
}
function undoShotDeletion() {return shotManagementState().undoDeletion?undoEdit():false;}
function undoEdit() {
  if(!plan || !canHandoff() || comparisonActive())return false;
  endEdit();const previous=undoStack.pop();if(!previous)return false;
  redoStack.push(historyCounterpart(previous));restoreHistory(previous);syncAutoEditStatus();notice(t("已还原上次调整，可用重做恢复。"),true);return true;
}
function redoEdit() {
  if(!plan || !canHandoff() || comparisonActive())return false;
  endEdit();const next=redoStack.pop();if(!next)return false;
  undoStack.push(historyCounterpart(next));restoreHistory(next);syncAutoEditStatus();notice(t("已重做。"),true);return true;
}

let selectedTrack="camera";
function trackActor() {return selectedTrack==="camera"?null:scene()?.objects.find(o=>o.id===selectedTrack);}
function actorTiming(s,id) {
  const supplied=s.actor_timing?.[id];
  if(supplied?.length>=2)return supplied.map(k=>({...k}));
  return s.object_tracks?.[id]?.length>=2?s.object_tracks[id].map(k=>({t:k.t})):[{t:0},{t:1}];
}
function actorPathData(s,id) {
  const specs=actorTiming(s,id);
  const parts=groupFor(id);
  return {specs,parts,poses:parts.map(o=>specs.map(k=>objectAt(s,o,k.t)))};
}
function writeActorPath(s,id,specs,parts,poses) {
  s.actor_timing ||= {};s.actor_timing[id]=specs.map(k=>({...k}));
  s.object_tracks ||= {};
  parts.forEach((o,j)=>{
    const keys=[];
    specs.forEach((k,i)=>{
      const pose=poses[j][i],point={t:round(k.t,8),position:cleanPoint(pose.position),yaw_deg:round(pose.yaw_deg||0,5)};
      keys.push(point);
      const end=k.t+(k.hold_s||0)/duration(s);
      if(end>k.t+timeEpsilon && end<(specs[i+1]?.t??1)-timeEpsilon)keys.push({...point,t:round(end,8),position:[...point.position]});
    });
    if(keys.at(-1).t<1-timeEpsilon)keys.push({...keys.at(-1),t:1,position:[...keys.at(-1).position]});
    s.object_tracks[o.id]=keys;
  });
  s.edit_locks ||= {};s.edit_locks.subjects=[...new Set([...(s.edit_locks.subjects||[]),id])];
}
function captureActorPoint() {
  if(subjectTimeLocked()){notice(t("先恢复正常主体时间，再编辑走位或状态。"));return false;}
  if(!canEdit())return false;
  if(pendingEditNotice())return false;
  const s=shot(),id=selectedTrack,data=actorPathData(s,id),total=duration(s),at=clamp(frameTime(time*total)/total,0,1),gap=1/fps()/total;
  let index=data.specs.findIndex(k=>Math.abs(k.t-at)<gap*.51);
  if(index>=0){goTo(data.specs[index].t);return {index,message:t("这里已有站位点，调整人物即可更新。")};}
  if(data.specs.length>=24){setTimingStatus(t("一个人物最多可放 24 个站位点。"));return;}
  const after=data.specs.findIndex(k=>k.t>at),slot=after<0?data.specs.length:after;
  const previous=data.specs[slot-1];
  if(previous && previous.t+(previous.hold_s||0)/total>=at-gap)previous.hold_s=Math.max(0,(at-previous.t-gap)*total);
  data.specs.splice(slot,0,{t:round(at,8)});
  data.parts.forEach((o,j)=>data.poses[j].splice(slot,0,objectAt(s,o,at)));
  writeActorPath(s,id,data.specs,data.parts,data.poses);goTo(at);markChanged();
  return {index:slot,message:t("已记住此刻站位。拖上方人物或调整位置，移动会在前后点之间发生。")};
}
function changeActorPoint(index,field,seconds) {
  if(subjectTimeLocked()){notice(t("先恢复正常主体时间，再编辑走位或状态。"));return false;}
  if(pendingEditNotice())return false;
  if(!canEdit())return;
  const s=shot(),id=selectedTrack,data=actorPathData(s,id),keys=data.specs,total=duration(s),minimum=1/fps(),key=keys[index];
  if(!key)return;
  const before=index?keys[index-1].t*total+(keys[index-1].hold_s||0)+minimum:0;
  const after=index===keys.length-1?total:keys[index+1].t*total-minimum;
  if(field==="hold" && index<keys.length-1)key.hold_s=clamp(frameTime(seconds),0,Math.max(0,after-key.t*total));
  else if(index>0)key.t=round(clamp(field==="hold"?total-frameTime(seconds):frameTime(seconds),before,Math.max(before,after-(key.hold_s||0)))/total,8);
  writeActorPath(s,id,keys,data.parts,data.poses);goTo(key.t,{preserveGesture:true});markChanged();
}
function removeActorPoint(index) {
  if(subjectTimeLocked()){notice(t("先恢复正常主体时间，再编辑走位或状态。"));return false;}
  if(!canEdit())return false;
  if(pendingEditNotice())return false;
  const s=shot(),data=actorPathData(s,selectedTrack);
  if(index<=0 || index>=data.specs.length-1)return;
  data.specs.splice(index,1);data.poses.forEach(poses=>poses.splice(index,1));
  writeActorPath(s,selectedTrack,data.specs,data.parts,data.poses);markChanged();
}
function timelineState() {
  const s=shot(),total=duration(s),actor=trackActor();
  const source=s;
  const keys=actor?actorTiming(source,actor.id):authoredTiming(source)?source.motion.keys:
    source.motion?.keys?.map(k=>({...k,t:k.t*(source.motion.duration_s||total)/total}))||[{t:0},{t:1}];
  const normalized=time,epsilon=.5/fps()/total;
  let activeIndex=keys.findIndex((k,i)=>Math.abs(k.t-normalized)<=epsilon || (normalized>=k.t && normalized<=k.t+(k.hold_s||0)/total+epsilon) || (i===keys.length-1&&normalized>=k.t));
  return {shotId:s.id+":"+selectedTrack,duration:total,fps:fps(),time:time*total,readOnly:!canEdit()||comparisonActive()||Boolean(geometryPlacement)||Boolean(actor&&subjectTimeLocked()),maxDuration:30,pendingPreview:false,selectedSegment,
    trackLabel:actor?objectName(actor)+t(" · 人物走位"):t("摄影机 · 运镜"),trackType:actor?"subject":"camera",captureLabel:actor?t("添加站位点"):t("添加构图点"),activeIndex,
    keys:keys.map((k,i)=>({time:k.t*total,hold:i===keys.length-1?(1-k.t)*total:k.hold_s||0,label:i===0?t("起点"):i===keys.length-1?t("终点"):(actor?t("站位 "):t("经过 "))+i}))};
}
function initPathTimeline() {
  if(!ui["path-timeline"] || !window.StageTimeline)return;
  pathTimeline=window.StageTimeline.create(ui["path-timeline"],{
    getState:timelineState,seek:seconds=>goTo(clamp(seconds/duration(shot()),0,1)),applyPreview:applyTrialEdit,selectSegment:selectMotionSegment,
    capture:seconds=>{endEdit();goTo(seconds/duration(shot()));return trackActor()?captureActorPoint():addWaypoint();},
    move:(index,seconds)=>{if(pendingEditNotice())return false;if(trackActor())return changeActorPoint(index,"arrival",seconds);enableTiming(shot());return changeWaypoint(index,"arrival",seconds);},
    hold:(index,seconds)=>{if(pendingEditNotice())return false;if(trackActor())return changeActorPoint(index,"hold",seconds);enableTiming(shot());return changeWaypoint(index,"hold",seconds);},
    remove:index=>{if(pendingEditNotice()||!canEdit())return false;if(trackActor())return removeActorPoint(index);const keys=shot().motion?.keys;if(index>0&&index<keys?.length-1){keys.splice(index,1);markChanged();return true;}return false;},
    duration:setShotDuration,beginEdit,endEdit,
  });
}
function chooseTrack(id,internal=false) {
  if(!plan)return false;
  if(!internal&&geometryPlacement&&id!==selectedTrack)cancelGeometryPlacement(t("已切换编辑对象，放置已取消。"));
  if(!internal&&id!==selectedTrack){endEdit();presetContext=null;}
  if(id!==selectedTrack)selectedSegment=null;
  selectedTrack=id==="camera"||scene().objects.some(o=>o.id===id)?id:"camera";
  if(selectedTrack!=="camera"){selectedEntity=selectedTrack;ui.entity.value=selectedTrack;}
  if(ui["path-track"])ui["path-track"].value=selectedTrack;
  syncContextCaptions();invalidate();return true;
}
function geometryState() {
  const s=shot(),selected=scene().objects.find(o=>o.id===selectedEntity),parts=selected?groupFor(selected.id):[];
  let selectedObject=selected?copy(selected):null;
  if(selectedObject&&parts.length>1){const bounds=subjectBounds(selected.id,0,true);selectedObject.size=bounds.hi.map((v,i)=>v-bounds.lo[i]);}
  return {sceneId:s.scene,sceneName:sceneName(s.scene),affectedShots:plan.shots.filter(item=>item.scene===s.scene).length,
    readOnly:!canEdit()||comparisonActive(),pendingPreview:false,
    blockedReason:"",placement:geometryPlacementStatus.sceneId===s.scene?copy(geometryPlacementStatus):{status:"idle",sequence:geometryPlacementStatus.sequence},selectedObject,selectedObjects:parts};
}
function refreshEntityOptions(id) {
  const entities=scene().objects.filter(o=>!isCompanion(o));
  ui.entity.replaceChildren(new Option(t("选择主体"),""),...entities.map(o=>new Option(objectName(o),o.id)));
  if(ui["path-track"])ui["path-track"].replaceChildren(new Option(t("摄影机运镜"),"camera"),...entities.map(o=>new Option(objectName(o)+t(" · 走位"),o.id)));
  selectedEntity=id;ui.entity.value=id||"";chooseTrack(id||"camera");
}
function markSharedScene(sceneId) {
  sceneEdits.add(sceneId);
  for(const item of plan.shots)if(item.scene===sceneId)changed.add(item.id);
  canvasFit=undefined;markChanged();storeLocal();
}
function placementResult(status,message,extra={}) {
  geometryPlacementStatus={status,message,sequence:++placementSequence,sceneId:plan?.shots?.find(item=>item.id===selectedShot)?.scene||null,
    ...(geometryPlacement?{spec:copy(geometryPlacement.spec)}:{}),...extra};
  if(ui["placement-hint"])ui["placement-hint"].hidden=!geometryPlacement;
  if(ui["placement-label"])ui["placement-label"].textContent=geometryPlacement
    ? t`${geometryPlacement.spec.label} · ${geometryPlacement.spec.size.map(v=>round(v,2)).join(" × ")} m · 点击左侧片场放置` : "";
  map.classList.toggle("placing-object",Boolean(geometryPlacement));
  invalidate();return copy(geometryPlacementStatus);
}
function blockGeometry(message) {
  notice(message);
  if(geometryPlacement){placementResult("placing",message,{label:geometryPlacement.spec.label,position:[...geometryPlacement.position]});return {status:"blocked",message};}
  return placementResult("blocked",message);
}
function geometryReady() {
  if(!plan||!shot())return t("片场还未载入，请稍后重试。");
  if(!canEdit()||comparisonActive())return t("当前为只读视图，不能添加物体。");
  if(trialEdit)endEdit();
  if(!window.StageGeometry)return t("物体工具还未载入，请稍后重试。");
  return "";
}
function validatedGeometrySpec(spec) {
  const result=window.StageGeometry.validateSpec(spec);
  return {...result,autoName:Boolean(spec?.autoName)};
}
function geometryLabel(spec) {
  const existing=new Set(scene().objects.filter(o=>!isCompanion(o)).map(o=>objectName(o).trim()));
  const base=spec.label.trim();let candidate=base,index=2;
  while(existing.has(candidate))candidate=base+" "+index++;
  return candidate;
}
function showLayoutForGeometry() {
  ui["view-layout"]?.click?.();
  if(ui["layout-pane"])ui["layout-pane"].hidden=false;
  if(ui["reference-pane"])ui["reference-pane"].hidden=true;
}
function objectRoot(id) {
  const object=scene().objects.find(o=>o.id===id);
  if(!object)return null;
  if(object.parent_id)return scene().objects.find(o=>o.id===object.parent_id)||object;
  if(object.actor_id)return scene().objects.find(o=>o.id===object.actor_id)||scene().objects.find(o=>o.actor_id===object.actor_id&&!isCompanion(o))||object;
  return object;
}
function getSubjectDragState(id) {
  if(!plan||!shot())return null;
  const root=objectRoot(id);if(!root)return null;
  const base=objectAt(shot(),root,time),resolved=sceneObjectsAt(shot(),time).find(o=>o.id===root.id)||base;
  return {id:root.id,position:[...resolved.position],basePosition:[...base.position],offset:sub(resolved.position,base.position),
    height:resolved.position[1],dragPlaneY:resolved.position[1],hidden:Boolean(resolved.hidden),
    canMove:canEdit()&&!comparisonActive()&&!subjectTimeLocked()&&!geometryPlacement&&!resolved.hidden};
}
function chooseStageSubject(id) {
  if(!plan||!canEdit()||comparisonActive())return false;
  const root=id==="camera"?null:objectRoot(id);if(id!=="camera"&&!root)return false;
  const target=root?.id||"camera",kind=target==="camera"?"camera":"actor:"+target;
  if(trialEdit&&(trialEdit.kind!==kind||trialEdit.shotId!==selectedShot||Math.abs(time-trialEdit.time)>1e-5))endEdit();
  return chooseTrack(target);
}
function moveSubjectOnGround(id,point) {
  const state=getSubjectDragState(id);
  if(!state?.canMove){
    if(trialEdit)pendingEditNotice();
    else if(state?.hidden)notice(t("这个主体在当前时刻已隐藏，请先切换到可见时刻。"));
    return false;
  }
  if(!Array.isArray(point)||point.length!==3||point.some(n=>!Number.isFinite(n)||Math.abs(n)>1000))return false;
  pause();stopPanPress();
  const result=setActor(state.id,[point[0]-state.offset[0],state.basePosition[1],point[2]-state.offset[2]]);
  return result!==false;
}
function locationMembers(id) {
  const root=objectRoot(id);if(!root)return [];
  const parts=groupFor(root.id),ids=new Set(parts.map(o=>o.id)),resolved=sceneObjectsAt(shot(),time);
  const byId=new Map(resolved.map(o=>[o.id,o]));
  return [...parts.map(o=>byId.get(o.id)||objectAt(shot(),o,time)),...resolved.filter(o=>o.state_source_id&&ids.has(o.state_source_id)&&!o.hidden)];
}
function planarBounds(objects) {
  const points=[];
  for(const o of objects)for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5]){
    const local=[x*o.size[0],y*o.size[1],z*o.size[2]];
    const turned=window.StageStates?window.StageStates.rotateLocal(local,o.pitch_deg||0,o.roll_deg||0,o.yaw_deg||0):rotateY(local,o.yaw_deg||0);
    points.push(add(add(o.position,[0,o.size[1]/2,0]),turned));
  }
  if(!points.length)return null;
  const minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0]));
  const minZ=Math.min(...points.map(p=>p[2])),maxZ=Math.max(...points.map(p=>p[2]));
  return {minX,maxX,minZ,maxZ,x:(minX+maxX)/2,z:(minZ+maxZ)/2};
}
function mapDimensions() {
  const rect=map.getBoundingClientRect();
  return {w:Math.max(100,rect.width||canvasFit?.w||500),h:Math.max(100,rect.height||canvasFit?.h||300)};
}
function dispatchObjectLocation(id) {
  const event=typeof CustomEvent==="function"?new CustomEvent("stage-locate-object",{detail:{id}}):Object.assign(new Event("stage-locate-object"),{detail:{id}});
  window.dispatchEvent(event);
}
function locateObject(id) {
  if(!plan||!shot())return false;
  if(id==="camera"){
    const camera=sampleCamera(shot(),time),{w,h}=mapDimensions();
    if(canvasFit&&!savedMapFit)savedMapFit={...canvasFit};
    canvasFit=computeMapFit([{position:camera.position,size:[1,1,1]}],camera,w,h);locatedObjectId="camera";preferredMarker="camera";
    showLayoutForGeometry();updateFitLabel();dispatchObjectLocation("camera");notice(t("已定位摄影机，仅调整观察视图。"),true);invalidate();return true;
  }
  const root=objectRoot(id);if(!root){notice(t("这个物体已不在当前片场。"));return false;}
  const members=locationMembers(root.id),bounds=planarBounds(members),{w,h}=mapDimensions();
  if(!bounds)return false;
  if(canvasFit&&!savedMapFit)savedMapFit={...canvasFit};
  canvasFit={x:bounds.x,z:bounds.z,w,h,scale:Math.max(.05,Math.min(300,(w-70)/Math.max(1,(bounds.maxX-bounds.minX)*1.3),(h-66)/Math.max(1,(bounds.maxZ-bounds.minZ)*1.3)))};
  locatedObjectId=root.id;showLayoutForGeometry();updateFitLabel();
  const hidden=members.every(o=>o.hidden);
  notice(t`已定位「${objectName(root)}」${hidden?t("，此刻处于隐藏状态，虚线框标出当前位置。"):t("，仅移动观察视图，拍摄机位保持不变。")}`,true);
  dispatchObjectLocation(root.id);invalidate();return true;
}
function drawLocatedObject() {
  if(!locatedObjectId||!canvasFit)return;
  if(locatedObjectId==="camera"){
    const p=mapPoint(sampleCamera(shot(),time).position);mapCtx.save();mapCtx.strokeStyle="#e9f6f1";mapCtx.lineWidth=2;mapCtx.beginPath();mapCtx.arc(p[0],p[1],13,0,Math.PI*2);mapCtx.stroke();mapCtx.font="12px system-ui";mapCtx.fillStyle="#e9f6f1";mapCtx.textAlign="left";mapCtx.fillText(t("摄影机 · 已定位"),clamp(p[0]+18,8,canvasFit.w-112),clamp(p[1]-16,18,canvasFit.h-8));mapCtx.restore();return;
  }
  const root=objectRoot(locatedObjectId),objects=locationMembers(locatedObjectId),bounds=planarBounds(objects);if(!root||!bounds)return;
  const a=mapPoint([bounds.minX,0,bounds.minZ]),b=mapPoint([bounds.maxX,0,bounds.maxZ]);
  const hidden=objects.every(o=>o.hidden);mapCtx.save();
  mapCtx.strokeStyle="#dcf5e6";mapCtx.lineWidth=2;mapCtx.setLineDash(hidden?[5,4]:[]);
  mapCtx.strokeRect(a[0]-7,a[1]-7,b[0]-a[0]+14,b[1]-a[1]+14);
  mapCtx.setLineDash([]);mapCtx.font="12px system-ui";mapCtx.textAlign="left";
  const text=objectName(root)+(hidden?t(" · 当前隐藏"):t(" · 已定位")),width=Math.min(canvasFit.w-16,mapCtx.measureText(text).width+16);
  const left=clamp(a[0]-7,8,Math.max(8,canvasFit.w-width-8)),top=clamp(a[1]-32,8,Math.max(8,canvasFit.h-28));
  mapCtx.fillStyle="#0c1512ee";mapCtx.fillRect(left,top,width,24);mapCtx.fillStyle="#e4f6eb";mapCtx.fillText(text,left+8,top+16);mapCtx.restore();
}
function beginGeometryPlacement(spec) {
  const problem=geometryReady();if(problem)return blockGeometry(problem);
  try {
    const value=validatedGeometrySpec(spec);value.label=geometryLabel(value);
    pause();stopPanPress();drag=null;
    const target=sampleBaseCamera(shot(),time).target;
    let position=[round(target[0],3),0,round(target[2],3)];
    // A hidden 2D canvas has stale bounds. Keep the active 3D view and start its ghost at the camera target.
    if(!isStage3D()){
      const {w,h}=mapDimensions();
      if(!canvasFit)canvasFit=computeMapFit(sceneObjectsAt(shot(),time),sampleCamera(shot(),time),w,h);
      canvasFit.scale=Math.min(canvasFit.scale,(w-60)/Math.max(2,value.size[0]*1.5),(h-60)/Math.max(2,value.size[2]*1.5));
      position=[round(canvasFit.x,3),0,round(canvasFit.z,3)];
    }
    geometryPlacement={spec:value,sceneId:shot().scene,shotId:selectedShot,position};
    showLayoutForGeometry();
    notice(t("把鼠标移到左侧片场，预览位置后点击放置；Esc 可取消。"),true);
    return placementResult("placing",t("在左侧片场点击放置，浅色预览表示新增物体。"),{label:value.label,position:[...geometryPlacement.position]});
  }catch(error){return blockGeometry(error.message);}
}
function cancelGeometryPlacement(message=t("已取消放置，片场未新增物体。")) {
  if(!geometryPlacement)return false;
  geometryPlacement=null;return placementResult("cancelled",message);
}
function commitGeometryPlacement(position) {
  if(!geometryPlacement)return false;
  if(geometryPlacement.sceneId!==shot().scene||geometryPlacement.shotId!==selectedShot){cancelGeometryPlacement(t("当前镜头已改变，请重新选择放置位置。"));return false;}
  const spec=copy(geometryPlacement.spec);
  return addGeometry(spec,{mode:"map",position});
}
function updateGeometryPlacementPosition(point) {
  if(!geometryPlacement||geometryPlacement.sceneId!==shot()?.scene||geometryPlacement.shotId!==selectedShot||!canEdit()||comparisonActive())return false;
  if(!Array.isArray(point)||point.length!==3||point.some(n=>!Number.isFinite(n)||Math.abs(n)>1000))return false;
  geometryPlacement.position=[round(point[0],3),0,round(point[2],3)];
  geometryPlacementStatus.position=[...geometryPlacement.position];invalidate();return true;
}
function placeGeometryAt(point) {
  if(!updateGeometryPlacementPosition(point))return false;
  return commitGeometryPlacement([...geometryPlacement.position]);
}

function drawGeometryPlacement() {
  if(!geometryPlacement||!canvasFit)return;
  const {spec,position}=geometryPlacement,p=mapPoint(position),w=spec.size[0]*canvasFit.scale,h=spec.size[2]*canvasFit.scale;
  mapCtx.save();mapCtx.strokeStyle="#d3ecde";mapCtx.fillStyle="#b8dccb24";mapCtx.lineWidth=1.5;mapCtx.setLineDash([6,4]);mapCtx.beginPath();
  if(spec.kind==="sphere"||spec.kind==="cylinder"||spec.kind==="person")mapCtx.ellipse(p[0],p[1],Math.max(3,w/2),Math.max(3,h/2),0,0,Math.PI*2);
  else mapCtx.rect(p[0]-w/2,p[1]-h/2,w,h);
  mapCtx.fill();mapCtx.stroke();mapCtx.setLineDash([]);mapCtx.strokeStyle="#edf9f2";line(mapCtx,[p[0]-8,p[1]],[p[0]+8,p[1]]);line(mapCtx,[p[0],p[1]-8],[p[0],p[1]+8]);
  mapCtx.font="11px system-ui";mapCtx.textAlign="center";mapCtx.fillStyle="#e7f4ed";
  mapCtx.fillText(spec.label+" · "+spec.size.map(n=>round(n,2)).join("×")+" m",clamp(p[0],70,canvasFit.w-70),clamp(p[1]-h/2-10,18,canvasFit.h-10));mapCtx.restore();
}
function revealAddedObjectControls(id) {
  requestAnimationFrame(()=>{
    if(selectedEntity!==id)return;
    const target=ui["object-picker"]||ui["entity-setting"],views=document.querySelector(".views");
    if(!target||!views||typeof window.scrollBy!=="function")return;
    const r=target.getBoundingClientRect(),top=views.getBoundingClientRect().bottom+14;
    if(r.top<top||r.bottom>innerHeight-12)window.scrollBy({top:r.top-top,behavior:window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches?"instant":"smooth"});
  });
}
function addGeometry(spec,placement={mode:"target"}) {
  const problem=geometryReady();if(problem){blockGeometry(problem);return false;}
  if(placement.mode==="map"&&!placement.position)return beginGeometryPlacement(spec);
  let value,origin;
  try {
    value=validatedGeometrySpec(spec);value.label=geometryLabel(value);
    if(placement.mode==="map")origin=placement.position;
    else if(placement.mode==="near-selected"){
      const bounds=selectedEntity&&planarBounds(locationMembers(selectedEntity));
      if(!bounds)throw Error(t("先选择一个主体，再使用“放在主体旁边”。"));
      origin=[bounds.maxX+value.size[0]/2+.5,0,bounds.z];
    }else if(placement.mode==="target"){
      const target=sampleBaseCamera(shot(),time).target;origin=[target[0],0,target[2]];
    }else throw Error(t("请选择有效的放置方式。"));
    if(!Array.isArray(origin)||origin.length!==3||origin.some(n=>!Number.isFinite(n)||Math.abs(n)>1000))throw Error(t("放置位置超出片场范围，请在左侧片场重新选择。"));
    origin=cleanPoint(origin);
  }catch(error){blockGeometry(error.message);return false;}
  beginEdit();
  try {
    const id="user_geo_"+crypto.randomUUID().replaceAll("-","");
    const result=window.StageGeometry.makeObjects(value,origin,id);
    if(!Array.isArray(result?.objects)||!result.objects.length)throw Error(t("几何体未生成，请重试。"));
    if(scene().objects.length+result.objects.length>100)throw Error(t("当前场景最多保留 100 个几何部件，请先简化后再添加。"));
    const existing=new Set(scene().objects.map(o=>o.id));
    if(result.objects.some(o=>existing.has(o.id)))throw Error(t("对象标识重复，请重试。"));
    geometryPlacement=null;
    scene().objects.push(...copy(result.objects));
    const created=result.primaryId||result.objects[0].id;
    refreshEntityOptions(created);markSharedScene(shot().scene);locateObject(created);
    placementResult("added",t`已添加「${value.label}」，已选中并定位。`,{id:created,label:value.label,position:[...origin]});
    revealAddedObjectControls(created);
    return created;
  } catch(error){blockGeometry(error.message);return false;}
  finally{endEdit();}
}
function resizeGeometry(id,size) {
  if(pendingEditNotice())return false;
  if(geometryPlacement){notice(t("先完成或取消当前物体放置，再调整已有物体大小。"));return false;}
  if(!plan||!canEdit()||comparisonActive())return false;
  if(!id?.startsWith("user_geo_")||!Array.isArray(size)||size.length!==3||size.some(n=>!Number.isFinite(n)||n<.02||n>100))return false;
  const parts=groupFor(id);if(!parts.length)return false;
  const ownTransaction=!editTransaction;if(ownTransaction)beginEdit();
  try {
    const root=parts[0],origin=[...root.position];
    if(parts.length===1)root.size=[...size];
    else {
      const lo=[0,1,2].map(axis=>Math.min(...parts.map(o=>o.position[axis]-(axis===1?0:o.size[axis]/2))));
      const hi=[0,1,2].map(axis=>Math.max(...parts.map(o=>o.position[axis]+(axis===1?o.size[axis]:o.size[axis]/2))));
      const scale=hi.map((v,i)=>size[i]/Math.max(.02,v-lo[i]));
      const scaleAround=(point,base,yaw=0)=>cleanPoint(add(base,rotateY(rotateY(sub(point,base),-yaw).map((v,i)=>v*scale[i]),yaw)));
      // Preserve articulated placement across every shot, including head tracks and local overrides.
      const edits=[];
      for(const related of plan.shots.filter(item=>item.scene===shot().scene))for(const part of parts.slice(1)){
        for(const key of related.object_tracks?.[part.id]||[]){
          const atRoot=objectAt(related,root,key.t,true);
          edits.push([key,scaleAround(key.position,atRoot.position,atRoot.yaw_deg||0)]);
        }
        const override=related.object_overrides?.[part.id];
        if(override?.position){const atRoot={...root,...related.object_overrides?.[root.id]};edits.push([override,scaleAround(override.position,atRoot.position,atRoot.yaw_deg||0)]);}
      }
      for(const [point,position] of edits)point.position=position;
      for(const part of parts){part.position=scaleAround(part.position,origin,root.yaw_deg||0);part.size=part.size.map((v,i)=>round(v*scale[i],5));}
    }
    markSharedScene(shot().scene);return true;
  }finally{if(ownTransaction)endEdit();}
}

function initGeometryEditor() {
  if(ui["geometry-editor"]&&window.StageGeometry)geometryEditor=window.StageGeometry.create(ui["geometry-editor"],{getState:geometryState,add:(spec,placement)=>{const result=addGeometry(spec,placement);return typeof result==="string"?copy(geometryPlacementStatus):result||{status:"blocked",message:geometryPlacementStatus.message};},beginPlace:beginGeometryPlacement,cancelPlace:cancelGeometryPlacement,locate:locateObject,resize:resizeGeometry,beginEdit,endEdit});
}

function checkedStates(events) {
  if(!window.StageStates)throw Error(t("状态工具还未就绪，请刷新页面后重试。"));
  return window.StageStates.validateEvents(scene().objects,events,duration(shot()));
}
function commitStates(events,rootId) {
  shot().state_events=checkedStates(events);
  shot().edit_locks ||= {};
  shot().edit_locks.subjects=[...new Set([...(shot().edit_locks.subjects||[]),rootId])];
  markChanged();storeLocal();
}
function addStateEvent(spec={},options={}) {
  if(subjectTimeLocked()){notice(t("先恢复正常主体时间，再编辑走位或状态。"));return false;}
  if(pendingEditNotice())return false;
  if(typeof spec==="string")spec={...options,type:spec};
  if(!plan||!canEdit()||comparisonActive())return null;
  const actor=scene().objects.find(o=>o.id===selectedEntity);
  if(!actor){notice(t("先选择要设置状态的人物或道具。"));return null;}
  const timed=["jump","fall","rise","break","shake"].includes(spec.type),total=duration(shot()),at=frameTime(time*total);
  const remaining=total-at;
  if(timed&&remaining<1/fps()-timeEpsilon){notice(t("结束处没有足够时间表现这个动作。请把播放头往前拖一点。"));return null;}
  const event={id:"state_"+crypto.randomUUID().replaceAll("-",""),type:spec.type,at_s:round(at,8)};
  if(timed)event.duration_s=round(clamp(Number(spec.duration_s)||.8,1/fps(),remaining),8);
  if(spec.type==="jump"||spec.type==="shake")event.height_m=Number.isFinite(spec.height_m)?spec.height_m:spec.type==="jump"?1:.06;
  if(spec.type==="teleport")event.offset=Array.isArray(spec.offset)?[...spec.offset]:[1,0,0];
  if(spec.seed!==undefined)event.seed=spec.seed;
  const events=copy(shot().state_events||{});events[actor.id]||=[];
  if(events[actor.id].length>=32){notice(t("一个主体最多保留 32 个状态变化，请先移除不需要的动作。"));return null;}
  events[actor.id].push(event);events[actor.id].sort((a,b)=>a.at_s-b.at_s);
  const own=!editTransaction;if(own)beginEdit();
  try{commitStates(events,actor.id);notice(t`已在 ${formatTime(event.at_s)} 秒加入状态变化，拖动时间轴即可检查。`,true);return copy(event);}
  catch(error){notice(error.message);return null;}finally{if(own)endEdit();}
}
function updateStateEvent(rootOrEvent,idOrPatch={},maybePatch) {
  if(subjectTimeLocked()){notice(t("先恢复正常主体时间，再编辑走位或状态。"));return false;}
  if(pendingEditNotice())return false;
  const eventId=maybePatch===undefined?rootOrEvent:idOrPatch,patch=maybePatch===undefined?idOrPatch:maybePatch;
  if(!plan||!canEdit()||comparisonActive())return false;
  const events=copy(shot().state_events||{}),entry=Object.entries(events).find(([,list])=>list.some(e=>e.id===eventId));
  if(!entry)return false;
  const [rootId,list]=entry,event=list.find(e=>e.id===eventId),total=duration(shot());
  for(const field of ["at_s","duration_s","height_m","offset","seed"])if(patch[field]!==undefined)event[field]=copy(patch[field]);
  event.at_s=round(clamp(frameTime(Number(event.at_s)),0,total),8);
  if(event.duration_s!==undefined){
    if(total-event.at_s<1/fps()-timeEpsilon)event.at_s=round(Math.max(0,total-1/fps()),8);
    event.duration_s=round(clamp(Number(event.duration_s),1/fps(),Math.max(1/fps(),total-event.at_s)),8);
  }
  list.sort((a,b)=>a.at_s-b.at_s);
  const own=!editTransaction;if(own)beginEdit();
  try{commitStates(events,rootId);goTo(event.at_s/duration(shot()),{preserveGesture:true});return true;}catch(error){notice(error.message);return false;}finally{if(own)endEdit();}
}
function removeStateEvent(rootOrEvent,maybeId) {
  if(subjectTimeLocked()){notice(t("先恢复正常主体时间，再编辑走位或状态。"));return false;}
  if(pendingEditNotice())return false;
  const eventId=maybeId===undefined?rootOrEvent:maybeId;
  if(!plan||!canEdit()||comparisonActive())return false;
  const events=copy(shot().state_events||{}),entry=Object.entries(events).find(([,list])=>list.some(e=>e.id===eventId));
  if(!entry)return false;
  const [rootId,list]=entry;events[rootId]=list.filter(e=>e.id!==eventId);if(!events[rootId].length)delete events[rootId];
  const own=!editTransaction;if(own)beginEdit();
  try{commitStates(events,rootId);return true;}catch(error){notice(error.message);return false;}finally{if(own)endEdit();}
}

function displayState() {
  const source=comparisonActive()?originalPlan:plan,s=source?.shots.find(s=>s.id===selectedShot),stage=s?source.scenes[s.scene]:null;
  return {displayPlan:source,displayScene:stage,displayShot:s||null,displaySubjects:stage?stage.objects.filter(o=>!isCompanion(o,stage.objects)):[],displayObjects:s?sceneObjectsAt(s,time,source):[],displayCamera:s?copy(sampleCamera(s,time)):null};
}
function getCommittedState() {return {plan,revision:committedRevision,selectedShot,pendingPreview:false,comparison:comparisonActive()};}
function getDisplayCamera() {
  const source=comparisonActive()?originalPlan:plan,s=source?.shots.find(s=>s.id===selectedShot);
  return s?copy(sampleCamera(s,time)):null;
}
function editorState() {
  const s=plan?shot():null,stage=s?scene():null,subjects=stage?stage.objects.filter(o=>!isCompanion(o)):[],objects=s?sceneObjectsAt(s,time):[],comparison=comparisonActive();
  const display=comparison?displayState():{displayPlan:plan,displayScene:stage,displayShot:s,displaySubjects:subjects,displayObjects:objects,displayCamera:s?copy(sampleCamera(s,time)):null};
  return {plan,session:sceneOverview?{...session,can_edit:false}:session,scene:stage,sceneOverview:Boolean(sceneOverview),navigationMode,pendingPreview:false,placement:copy(geometryPlacementStatus),locatedObjectId,selectedTrack,selectedEntity,subjects,resolvedObjects:objects,
    shot:s,time:s?time*duration(s):0,normalizedTime:time,playing:playing!==null,comparison,...display};
}
window.stageEditor={ready,openProject,exportProject,exportChanges,getState:editorState,getCommittedState,getBasicMotionSpeed,setBasicMotionSpeed,deleteShot,undoShotDeletion,getShotManagementState:shotManagementState,renderShotThumbnail,renderSceneThumbnail,selectScene,selectShot,setNavigationMode,getViewCamera:getDisplayCamera,previewCamera,commitObserveCamera:previewCamera,setStaticCamera,requestRender:invalidate,applyPreview:applyTrialEdit,revertPreview:revertTrialEdit,addGeometry,beginGeometryPlacement,cancelGeometryPlacement,updateGeometryPlacementPosition,placeGeometryAt,locateObject,resizeGeometry,addStateEvent,updateStateEvent,removeStateEvent,getSubjectDragState,moveSubjectOnGround,selectSubject:chooseStageSubject,chooseSubject:chooseStageSubject,beginEdit,endEdit,seek:seconds=>{if(plan)goTo(clamp(seconds/duration(shot()),0,1));},
  subscribe:listener=>{editorSubscribers.add(listener);return ()=>editorSubscribers.delete(listener);}};
window.dispatchEvent(new Event("stage-editor-ready"));

function motionUnit(kind) {return cinemaDefinition(kind)?(cinemaDefinition(kind).unit==="°"?"°":" "+cinemaDefinition(kind).unit):["pan","tilt","orbit"].includes(kind)?"°":kind==="zoom"?" mm":" m";}
function configureTravel(kind,reset=false) {
  const control=ui["travel-slider"];if(!control)return;
  const spec=cinemaDefinition(kind),angular=["pan","tilt","orbit"].includes(kind),zoom=kind==="zoom";
  const old=control.value;
  control.min=spec?.min??(angular?1:zoom?1:.1);control.max=spec?.max??(angular?(kind==="tilt"?85:kind==="orbit"?360:170):zoom?150:10);control.step=spec?.step??(angular||zoom?1:.05);
  if(reset)control.value=spec?.value??(angular?45:zoom?35:1);else control.value=old;
  const label=document.querySelector('label[for="travel-slider"]');if(label)label.textContent=spec?.label?t(spec.label):(angular?t("转动角度"):zoom?t("焦距变化"):kind==="jib"||kind==="pedestal"?t("升降高度"):kind==="fpv"?t("飞行范围"):t("移动距离"));
  sliderDisplay("travel-slider",Number(control.value),motionUnit(kind));
  if(ui["motion-speed-card"])ui["motion-speed-card"].hidden=!spec;
  if(ui["orbit-radius-card"])ui["orbit-radius-card"].hidden=!spec?.orbit;
}
function restoreCinemaControls(s) {
  const spec=cinemaDefinition(s.motion_preset),keys=s.motion?.keys;if(!spec||!keys?.length)return;
  const first=keys[0],last=keys.at(-1),position=k=>k.position||s.camera.position,target=k=>k.target||s.camera.target;
  let travel=Math.hypot(...sub(position(last),position(first)));
  if(spec.unit==="°"){
    const ray=k=>s.motion_preset==="whip_pan"?sub(target(k),position(k)):sub(position(k),target(k));
    travel=keys.slice(1).reduce((sum,key,index)=>{const a=ray(keys[index]),b=ray(key);return sum+Math.abs(wrapDegrees((Math.atan2(b[0],b[2])-Math.atan2(a[0],a[2]))/radians));},0);
  }
  const seconds=s.motion.timing_mode==="arrival"?(last.t-first.t)*s.motion.duration_s-keys.slice(0,-1).reduce((sum,k)=>sum+(k.hold_s||0),0):s.motion.duration_s;
  sliderDisplay("travel-slider",round(travel,3),motionUnit(s.motion_preset));
  sliderDisplay("motion-duration-slider",round(Math.max(.1,seconds),3)," s");
  syncMotionSpeed(travel,Math.max(.1,seconds),duration(s));
  if(spec.orbit){const delta=sub(position(first),target(first));syncOrbitRadius(Math.hypot(delta[0],delta[2]),false);}
}
function syncOrbitRadius(radius,limited=false) {
  const input=ui["orbit-radius-slider"];if(!input)return;
  input.max=Math.max(30,Math.ceil(radius));
  sliderDisplay("orbit-radius-slider",round(radius,3)," m");
  if(ui["orbit-radius-help"])ui["orbit-radius-help"].textContent=limited?t("默认已按附近薄墙收紧 留出 0.25 m 余量 可手动调整"):t("调整整条圆弧的半径 真实遮挡保留");
}
function syncMotionSpeed(travel,seconds,interval) {
  const input=ui["motion-speed-slider"],spec=cinemaDefinition(activePreset);if(!input||!spec)return;
  const minimum=travel/Math.max(.001,interval),maximum=travel/Math.min(.1,interval);
  input.min=minimum;input.max=Math.max(minimum,maximum);input.step=spec.unit==="°"?.1:.001;
  const label=document.querySelector('label[for="motion-speed-slider"]');if(label)label.textContent=spec.unit==="°"?t("平均转速"):t("平均移速");
  sliderDisplay("motion-speed-slider",round(travel/Math.max(.001,seconds),3)," "+spec.unit+"/s");
  if(ui["motion-speed-help"])ui["motion-speed-help"].textContent=t`运动 ${formatTime(seconds)} 秒 · 镜头总长 ${formatTime(duration(shot()))} 秒不变`;
}
function setPresetTab(tab) {
  presetTab=tab==="cinema"?"cinema":"basic";
  for(const group of ["basic","cinema"]){
    if(ui["motion-"+group])ui["motion-"+group].hidden=group!==presetTab;
    if(ui["preset-tab-"+group]){ui["preset-tab-"+group].setAttribute("aria-selected",String(group===presetTab));ui["preset-tab-"+group].tabIndex=group===presetTab?0:-1;}
  }
  if(ui["cinema-intro"])ui["cinema-intro"].hidden=presetTab!=="cinema";
}
for(const button of document.querySelectorAll("[data-preset-tab]")){
  button.addEventListener("click",()=>setPresetTab(button.dataset.presetTab));
  button.addEventListener("keydown",event=>{if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;event.preventDefault();setPresetTab(event.key==="Home"?"basic":event.key==="End"?"cinema":presetTab==="basic"?"cinema":"basic");ui["preset-tab-"+presetTab]?.focus();});
}
function restoreSubjectTime() {
  if(!plan||!subjectTimeLocked())return false;
  pause();if(!beginTrialEdit("camera"))return false;
  chooseTrack("camera",true);delete shot().time_effect;markChanged();
  if(ui["preset-status"])ui["preset-status"].textContent=t("已恢复正常主体时间，摄影机路线保留。");
  return true;
}
ui["restore-subject-time"]?.addEventListener("click",restoreSubjectTime);
function setRig(kind) {
  if(!plan||!canEdit())return;
  pause();
  if(kind==="fpv"&&!shot().motion){
    if(ui["rig-preset"])ui["rig-preset"].value=shot().camera_effect?.type||"none";
    notice(t("FPV 侧倾需要移动路径。先选 FPV、绕拍或其他运镜，再调整侧倾质感。"));return;
  }
  if(!beginTrialEdit("camera"))return false;
  chooseTrack("camera",true);
  if(kind==="none")delete shot().camera_effect;
  else shot().camera_effect={type:kind,intensity:motionControl("intensity-slider",50)/100,seed:shot().camera_effect?.seed??7};
  if(ui["rig-preset"])ui["rig-preset"].value=kind;
  markChanged();
  if(ui["preset-status"])ui["preset-status"].textContent=t("机身质感已更新，原路径保留。");
}
function subjectBounds(id,at=time,baseOnly=false) {
  const ids=new Set(groupFor(id).map(o=>o.id));if(!ids.size)return null;
  const parts=(baseOnly?groupFor(id).map(o=>objectAt(shot(),o,at)):sceneObjectsAt(shot(),at).filter(o=>ids.has(o.id)||ids.has(o.state_source_id))).filter(o=>!o.hidden);
  if(!parts.length)return null;
  const points=[];
  for(const o of parts)for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5]){
    const local=[x*o.size[0],y*o.size[1],z*o.size[2]],rotated=window.StageStates?window.StageStates.rotateLocal(local,o.pitch_deg||0,o.roll_deg||0,o.yaw_deg||0):rotateY(local,o.yaw_deg||0);
    points.push(add(add(o.position,[0,o.size[1]/2,0]),rotated));
  }
  const lo=[0,1,2].map(axis=>Math.min(...points.map(p=>p[axis]))),hi=[0,1,2].map(axis=>Math.max(...points.map(p=>p[axis])));
  return {lo,hi,center:lo.map((n,i)=>(n+hi[i])/2),height:hi[1]-lo[1]};
}

function projectedPoint(camera,p,aspect=(Number(plan.output?.width)||640)/(Number(plan.output?.height)||360)) {
  const forward=unit(sub(camera.target,camera.position)),axes=translationAxes(camera),delta=sub(p,camera.position),depth=dot(delta,forward);
  const factor=(camera.focal_mm||35)/(camera.sensor_width_mm||36);
  return {x:.5+dot(delta,axes.right)*factor/depth,y:.5-dot(delta,axes.up)*factor*aspect/depth,depth};
}
function rememberComposition(camera) {
  const lock=shot().edit_locks?.composition;if(!lock)return;
  const bounds=subjectBounds(lock.actor_id);if(!bounds)return;
  const p=projectedPoint(camera,bounds.center);
  if(p.depth<=.04 || p.x<0 || p.x>1 || p.y<0 || p.y>1){delete shot().edit_locks.composition;return;}
  lock.screen=[p.x,p.y];lock.distance=Math.hypot(...sub(bounds.center,camera.position));lock.focal_mm=camera.focal_mm||35;
}
function constrainComposition(camera) {
  const lock=shot().edit_locks?.composition;if(!lock)return;
  const bounds=subjectBounds(lock.actor_id);if(!bounds)return;
  const focal=camera.focal_mm||35,aspect=(Number(plan.output?.width)||640)/(Number(plan.output?.height)||360);
  const dist=Math.max(.08,lock.distance*focal/lock.focal_mm);
  camera.position=cleanPoint(add(bounds.center,mul(unit(sub(camera.position,bounds.center)),dist)));
  camera.target=[...bounds.center];
  const x=(lock.screen[0]-.5)*(camera.sensor_width_mm||36)/focal;
  const y=(.5-lock.screen[1])*(camera.sensor_width_mm||36)/focal/aspect;
  for(let i=0;i<4;i++){
    const axes=translationAxes(camera),depth=dot(sub(bounds.center,camera.position),unit(sub(camera.target,camera.position)));
    camera.target=cleanPoint(sub(bounds.center,add(mul(axes.right,x*depth),mul(axes.up,y*depth))));
  }
}
const peopleFraming=kind=>!["wide","extreme_wide"].includes(String(kind||"medium").replaceAll("-","_"));
function framingParts(object) {
  const stem=object.id.replace(/_(?:root|body|torso)$/i,"");
  // Older imported plans name siblings agatha_root/agatha_head without a parent.
  // Recognize them only for framing; never rewrite authored motion groups.
  return [...new Map([...groupFor(object.id),...scene().objects.filter(o=>o.id===stem+"_head")].map(o=>[o.id,o])).values()];
}
function framingBounds(object) {
  const ids=new Set(framingParts(object).map(o=>o.id));
  const parts=sceneObjectsAt(shot(),time).filter(o=>(ids.has(o.id)||ids.has(o.state_source_id))&&!o.hidden);
  if(!parts.length)return null;
  const points=[];
  for(const o of parts)for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5]){
    const local=[x*o.size[0],y*o.size[1],z*o.size[2]],rotated=window.StageStates?window.StageStates.rotateLocal(local,o.pitch_deg||0,o.roll_deg||0,o.yaw_deg||0):rotateY(local,o.yaw_deg||0);
    points.push(add(add(o.position,[0,o.size[1]/2,0]),rotated));
  }
  const lo=[0,1,2].map(axis=>Math.min(...points.map(p=>p[axis]))),hi=[0,1,2].map(axis=>Math.max(...points.map(p=>p[axis])));
  return {lo,hi,center:lo.map((v,i)=>(v+hi[i])/2),height:hi[1]-lo[1]};
}
function isFramingPerson(object) {
  const text=[object.id,object.label,object.name].filter(Boolean).join(" ").toLowerCase();
  const token=word=>new RegExp("(?:^|[^a-z])(?:"+word+")(?:$|[^a-z])").test(text);
  if(token("wall|door|window|table|chair|desk|counter|teapot|cup|saucer|lamp|pillar|column|floor|ceiling|platform|vehicle|car|tree|plant|rock|building|prop|camera|statue|rabbit|dog|cat")||/墙|門框|门框|玻璃门|房门|门板|窗|桌|椅|柜|台阶|地板|天花|茶壶|茶杯|茶碟|水壶|灯|立柱|柱子|汽车|道具|箱子|建筑|雕像|木兔|兔子|벽|소품|가구/.test(text))return false;
  if(object.actor_id||token("actor|person|human|character|man|woman|boy|girl|child|clerk|porter|nurse|guard|waiter|guest|protagonist|customer|staff|hero")||/人物|演员|角色|男子|女子|男人|女人|男孩|女孩|儿童|护士|门童|服务员|俳優|인물|배우/.test(text))return true;
  const [width,height,depth]=object.size;
  return ["box","cylinder"].includes(object.shape)&&height>Math.max(width,depth)*1.15&&framingParts(object).some(head=>{
    if(head===object||head.shape!=="sphere"||!/_head$/i.test(head.id))return false;
    const headWidth=Math.max(head.size[0],head.size[2]),bodyWidth=Math.max(width,depth),rise=head.position[1]-object.position[1];
    return headWidth>=bodyWidth*.3&&headWidth<=bodyWidth*1.3&&rise>=height*.65&&rise<=height*1.25&&Math.hypot(head.position[0]-object.position[0],head.position[2]-object.position[2])<=bodyWidth*.6;
  });
}
function framingSubjects(kind=ui["framing-preset"]?.value||"medium") {
  const objects=scene().objects;
  const roots=objects.filter(o=>!isCompanion(o)&&!(/_head$/i.test(o.id)&&objects.some(root=>root!==o&&framingParts(root).some(part=>part.id===o.id))));
  return roots.filter(o=>(!peopleFraming(kind)||isFramingPerson(o))&&framingBounds(o));
}
function cycleFramingSubject() {
  if(!plan||!canEdit()||comparisonActive())return false;
  if(trialEdit&&trialEdit.kind!=="camera")endEdit();
  const kind=ui["framing-preset"]?.value||"medium",items=framingSubjects(kind);
  if(!items.length){notice(t(peopleFraming(kind)?"当前没有可见的人物，人物构图不会切换到墙体或道具。":"先选择当前可见的人物或道具，再选择景别。"));return false;}
  const index=items.findIndex(o=>framingParts(o).some(part=>part.id===selectedEntity));
  return applyFraming(kind,items[(index+1)%items.length].id);
}
function applyFraming(rawKind,targetId=selectedEntity) {
  if(!plan||!canEdit()||comparisonActive())return false;
  pause();
  const kind=rawKind.replaceAll("-","_");
  const items=framingSubjects(kind),camera=sampleBaseCamera(shot(),time);
  const chosen=items.find(o=>framingParts(o).some(part=>part.id===targetId))||items.toSorted((a,b)=>Math.hypot(...sub(framingBounds(a).center,camera.target))-Math.hypot(...sub(framingBounds(b).center,camera.target)))[0];
  if(!chosen){notice(t(peopleFraming(kind)?"当前没有可见的人物，人物构图不会切换到墙体或道具。":"先选择当前可见的人物或道具，再选择景别。"));return false;}
  const id=chosen.id;let bounds=framingBounds(chosen);
  const definitions={extreme_wide:[.15,1,24,"远景"],wide:[.30,1,28,"全景"],full:[.78,1,40,"全身"],
    medium:[.80,.55,50,"中景"],medium_close:[.83,.38,60,"中近景"],close:[.85,.25,70,"近景"],extreme_close:[.88,.13,85,"特写"],
    two_shot:[.78,1,35,"双人"],over_shoulder:[.70,1,50,"过肩"],high:[.65,1,35,"俯视"],low:[.65,1,35,"低机位"]};
  const [ratio,crop,focal,label]=definitions[kind]||definitions.medium;
  const aspect=(Number(plan.output?.width)||640)/(Number(plan.output?.height)||360);
  const other=items.find(o=>o.id!==id);
  if(kind==="two_shot"){
    const second=other&&framingBounds(other);if(!second){notice(t("双人构图需要两个可见人物。"));return false;}
    const lo=bounds.lo.map((v,i)=>Math.min(v,second.lo[i])),hi=bounds.hi.map((v,i)=>Math.max(v,second.hi[i]));
    bounds={lo,hi,center:lo.map((v,i)=>(v+hi[i])/2),height:hi[1]-lo[1]};
  }
  const aim=[...bounds.center];aim[1]=bounds.hi[1]-bounds.height*crop*.52;
  let direction=unit(sub(camera.position,camera.target));
  if(kind==="over_shoulder"){
    const shoulder=other&&framingBounds(other);if(!shoulder){notice(t("过肩构图需要第二个人物作为前景。"));return false;}
    direction=unit(sub(shoulder.center,aim));
    direction=unit(add(direction,mul(unit(cross(mul(direction,-1),[0,1,0])),.20)));
  }else if(kind==="high"||kind==="low"){
    const horizontal=unit([direction[0],0,direction[2]]),elevation=(kind==="high"?45:-12)*radians;
    direction=[horizontal[0]*Math.cos(elevation),Math.sin(elevation),horizontal[2]*Math.cos(elevation)];
  }
  const sensor=camera.sensor_width_mm||36;
  let distance=Math.max(.25,bounds.height*crop*focal*aspect/(sensor*ratio));
  if(kind==="two_shot")distance=Math.max(distance,Math.hypot(bounds.hi[0]-bounds.lo[0],bounds.hi[2]-bounds.lo[2])*focal/(sensor*.82));
  if(!beginTrialEdit("camera"))return false;
  selectedEntity=id;ui.entity.value=id;
  delete shot().edit_locks?.composition;
  updateCamera(c=>{c.target=aim;c.position=cleanPoint(add(aim,mul(direction,distance)));c.position[1]=Math.max(.05,c.position[1]);c.focal_mm=focal;c.roll_deg=0;});
  shot().shot_size=label;markChanged();
  if(ui["composition-status"])ui["composition-status"].textContent=objectName(scene().objects.find(o=>o.id===id))+" · "+t(label);
  return true;
}

function toggleComposition(checked) {
  if(!plan||!canEdit())return;
  if(!beginTrialEdit("camera"))return false;
  shot().edit_locks ||= {};
  if(!checked)delete shot().edit_locks.composition;
  else {
    const bounds=subjectBounds(selectedEntity);if(!bounds){ui["composition-lock"].checked=false;notice(t("先选择要锁住的主体。"));return;}
    const camera=sampleBaseCamera(shot(),time),p=projectedPoint(camera,bounds.center);
    if(p.depth<=.04 || p.x<0 || p.x>1 || p.y<0 || p.y>1){ui["composition-lock"].checked=false;notice(t("主体位于镜头后方，请先用景别模板将它放入画面。"));return;}
    shot().edit_locks.composition={actor_id:selectedEntity,screen:[p.x,p.y],distance:Math.hypot(...sub(bounds.center,camera.position)),focal_mm:camera.focal_mm||35,height_fraction:.5};
  }
  markChanged();
}
function syncContextCaptions() {
  if(!plan||!Array.isArray(plan.shots)||!shot())return;
  const s=shot(),subject=scene().objects.find(o=>o.id===selectedEntity);
  const framingValues={"远景":"extreme-wide","全景":"wide","环境全景":"wide","全身":"full","中景":"medium","中近景":"medium-close","近景":"close","特写":"extreme-close","双人":"two-shot","双人镜头":"two-shot","过肩":"over_shoulder"};
  if(ui["framing-preset"]&&document.activeElement!==ui["framing-preset"]&&framingValues[s.shot_size])ui["framing-preset"].value=framingValues[s.shot_size];
  if(ui["composition-status"]){
    const label=[subject?objectName(subject):"",t(s.shot_size)||t("自定义构图")].filter(Boolean).join(" · ");
    ui["composition-status"].textContent=label;
  }
  if(ui["actor-current-state"]){
    const actor=trackActor(),p=actor&&(sceneObjectsAt(s,time).find(o=>o.id===actor.id)||objectAt(s,actor,time));
    ui["actor-current-state"].textContent=p?t`${objectName(actor)} · ${formatTime(time*duration(s))} 秒 · 左右 ${round(p.position[0],2)} / 高度 ${round(p.position[1],2)} / 前后 ${round(p.position[2],2)} m${p.hidden?t(" · 当前不可见"):""}${p.pitch_deg?t(" · 姿态 ")+round(p.pitch_deg,1)+"°":""}`:t`摄影机轨道 · ${formatTime(time*duration(s))} 秒`;
  }
}

function syncDirectorControls() {
  const s=shot(),readonly=!canEdit()||comparisonActive(),historyReadonly=!canHandoff()||comparisonActive();
  document.querySelector(".edit-dock")?.classList.remove("is-pending");
  syncAutoEditStatus();
  if(ui["apply-edit"])ui["apply-edit"].hidden=true;
  if(ui.undo)ui.undo.disabled=historyReadonly||(!undoStack.length&&!editTransaction?.dirty);
  if(ui.redo)ui.redo.disabled=historyReadonly||!redoStack.length;
  ui.save.disabled=handoffBusy||!canHandoff()||comparisonActive();
  if(ui["apply-edit"])ui["apply-edit"].disabled=readonly||!trialEdit;
  if(ui["revert-edit"])ui["revert-edit"].disabled=historyReadonly||(!undoStack.length&&!editTransaction?.dirty);
  if(ui["composition-lock"])ui["composition-lock"].checked=Boolean(s.edit_locks?.composition);
  if(ui["lock-camera"])ui["lock-camera"].checked=Boolean(s.edit_locks?.camera);
  if(ui["lock-subject"]) {ui["lock-subject"].checked=s.edit_locks?.subjects?.includes(selectedEntity)||false;ui["lock-subject"].disabled=readonly||!selectedEntity;}
  if(ui["rig-preset"] && document.activeElement!==ui["rig-preset"])ui["rig-preset"].value=s.camera_effect?.type||"none";
  if(ui["travel-slider"])ui["travel-slider"].disabled=readonly||!activePreset||Boolean(cinemaDefinition(activePreset)?.fixedTravel)||activePreset==="track"&&Boolean(s.object_tracks?.[selectedEntity]);
  if(ui["motion-direction"]){ui["motion-direction"].disabled=readonly||!activePreset||activePreset==="track"&&Boolean(s.object_tracks?.[selectedEntity]);ui["motion-direction"].value=presetContext?.scope==="segment"&&[1,-1].includes(presetContext.direction)?String(presetContext.direction):knownMotionDirection(s);}
  if(ui["intensity-slider"])ui["intensity-slider"].disabled=readonly||!s.camera_effect;
  for(const id of ["apply-framing","composition-lock","lock-camera","rig-preset"])if(ui[id])ui[id].disabled=readonly;
  const effect=s.time_effect,locked=Boolean(effect);
  for(const button of ui["motion-presets"]?.querySelectorAll("[data-motion-preset]")||[])button.disabled=readonly;
  if(ui["motion-scope"])ui["motion-scope"].disabled=readonly||Boolean(cinemaDefinition(activePreset)?.wholeShot);
  if(ui["motion-speed-card"])ui["motion-speed-card"].hidden=!cinemaDefinition(activePreset);
  if(ui["motion-speed-slider"])ui["motion-speed-slider"].disabled=readonly||!cinemaDefinition(activePreset);
  if(ui["orbit-radius-card"])ui["orbit-radius-card"].hidden=!cinemaDefinition(activePreset)?.orbit;
  if(ui["orbit-radius-slider"])ui["orbit-radius-slider"].disabled=readonly||!cinemaDefinition(activePreset)?.orbit;
  if(ui["subject-time-effect"])ui["subject-time-effect"].hidden=!locked;
  if(ui["restore-subject-time"])ui["restore-subject-time"].disabled=readonly;
  if(ui["subject-time-title"])ui["subject-time-title"].textContent=effect?.mode==="freeze"?t`整镜冻结 · 主体保持源动作 ${formatTime(effect.at_s)} 秒的姿态`:t`整镜慢动作 · 主体 ${effect?.rate??1} 倍速度`;
  if(ui["subject-time-detail"])ui["subject-time-detail"].textContent=t("所有主体走位与状态共用这一时间效果 摄影机正常运动 总时长不变 编辑主体前请先恢复正常时间");
  if(ui["subject-time-edit-note"])ui["subject-time-edit-note"].hidden=!locked;
  if(ui["state-editor"]){ui["state-editor"].inert=locked;ui["state-editor"].classList.toggle("subject-time-locked",locked);}
  for(const axis of ["x","y","z"])if(ui["actor-"+axis])ui["actor-"+axis].disabled=readonly||locked;
  syncContextCaptions();

}


ui["compare-before"]?.addEventListener("change",toggleComparison);
ui["apply-edit"]?.addEventListener("click",applyTrialEdit);
ui["revert-edit"]?.addEventListener("click",revertTrialEdit);
ui.undo?.addEventListener("click",undoEdit);
ui.redo?.addEventListener("click",redoEdit);
ui["path-track"]?.addEventListener("change",()=>chooseTrack(ui["path-track"].value));
ui["locate-selected"]?.addEventListener("click",()=>{if(selectedEntity)locateObject(selectedEntity);else notice(t("先从对象列表选择要定位的主体。"));});
ui["placement-cancel"]?.addEventListener("click",()=>cancelGeometryPlacement());
ui["motion-scope"]?.addEventListener("change",()=>{pause();presetContext=null;if(activePreset)updateMotionPreset();});
function changeMotionDirection(){
  if(!plan||!canEdit()||comparisonActive()||!activePreset)return false;
  pause();beginEdit();if(presetContext?.scope!==(ui["motion-scope"]?.value||"segment"))presetContext=null;
  const updated=updateMotionPreset();endEdit();return updated;
}
ui["motion-direction"]?.addEventListener("change",changeMotionDirection);
ui["rig-preset"]?.addEventListener("change",()=>setRig(ui["rig-preset"].value));
ui["apply-framing"]?.addEventListener("click",cycleFramingSubject);
ui["framing-preset"]?.addEventListener("change",()=>applyFraming(ui["framing-preset"].value));
ui["composition-lock"]?.addEventListener("change",()=>toggleComposition(ui["composition-lock"].checked));
ui["composition-guides"]?.addEventListener("change",invalidate);
ui["guide-mode"]?.addEventListener("change",changeGuidePreferences);
ui["guide-color"]?.addEventListener("change",changeGuidePreferences);
ui["lock-camera"]?.addEventListener("change",()=>{if(!plan||!canEdit())return;shot().edit_locks||={};shot().edit_locks.camera=ui["lock-camera"].checked;markChanged();});
ui["lock-subject"]?.addEventListener("change",()=>{
  if(!plan||!selectedEntity||!canEdit())return;
  const locks=shot().edit_locks||={};const ids=new Set(locks.subjects||[]);
  if(ui["lock-subject"].checked)ids.add(selectedEntity);else ids.delete(selectedEntity);
  locks.subjects=[...ids];markChanged();
});
document.addEventListener("pointerdown",event=>{
  if(event.button===0&&plan&&event.target.closest("canvas,input,select,button")&&!event.target.closest("#shot-list"))beginEdit();
},true);
for(const name of ["pointerup","pointercancel","lostpointercapture"])document.addEventListener(name,endEdit);
window.addEventListener("blur",endEdit);
window.addEventListener("pagehide",()=>{endEdit();if(plan)storeLocal();});
document.addEventListener("visibilitychange",()=>{if(document.hidden){endEdit();if(plan)storeLocal();}});
document.addEventListener("keydown",event=>{
  if(event.key==="Escape"&&geometryPlacement){event.preventDefault();cancelGeometryPlacement();return;}
  if(event.key==="Escape"&&trialEdit&&!event.target.closest("dialog")){event.preventDefault();revertTrialEdit();return;}
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="z"&&!event.target.closest("textarea,input[type='text']")){
    event.preventDefault();event.shiftKey?redoEdit():undoEdit();return;
  }
  if(event.target.matches("input[type='range']")&&event.key.startsWith("Arrow"))beginEdit();
});
document.addEventListener("keyup",event=>{if(event.key.startsWith("Arrow"))endEdit();});

restoreGuidePreferences();
setup();

let capturedSnapshot = null;
const snapshotLimit=30;

function snapshotDestination() {
  const current = shot();
  const video = plan.videos?.find(item => item.id === current.video_id);
  return {
    project_id: session.project_id || plan.project_id || null,
    group_id: current.group_id || video?.group_id || video?.sequence_id || null,
    asset_id: current.asset_id || null,
    shot_id: current.id,
    video_id: current.video_id || null,
    scene_id: current.scene,
    shot_title: current.title || current.id,
    video_title: video?.title || current.video_title || "",
  };
}

function captureSnapshotMark() {
  if(sceneOverview)return null;
  const current=shot(),rate=fps(),total=duration(current);
  // Capture a displayed frame, not a mutable playhead pointer. Every moving object
  // and camera effect is evaluated now and baked into an independent static plan.
  const frameIndex=clamp(Math.round(time*total*rate),0,Math.max(0,Math.round(total*rate)));
  const seconds=frameIndex/rate,at=seconds/total;
  const destination=snapshotDestination();
  const stage=copy(scene());
  stage.objects=copy(sceneObjectsAt(current,at));
  const frozenShot={id:current.id,scene:current.scene,title:current.title||current.id,
    shot_size:current.shot_size||"",camera:copy(sampleCamera(current,at)),duration_s:1};
  return {snapshot_id:"snapshot-"+crypto.randomUUID(),source_stage_id:session.id||"demo",
    source_revision:session.revision||1,captured_state_events:copy(current.state_events||{}),...destination,time_s:round(seconds,8),frame_index:frameIndex,fps:rate,
    frozen_plan:{version:1,title:(plan.title||"片场")+" · "+current.id+" 当前帧",output:copy(plan.output||{width:640,height:360,fps:rate}),
      target_duration_s:1,scenes:{[current.scene]:stage},shots:[frozenShot]}};
}

function renderSnapshotMarks() {
  const list=ui["snapshot-marks-list"];if(!list)return;
  list.replaceChildren();
  if(!snapshotMarks.length)return;
  const label=document.createElement("p");label.textContent=t`已标记 ${snapshotMarks.length} 帧 · 随工程保存`;list.append(label);
  for(const mark of snapshotMarks){
    const row=document.createElement("div"),text=document.createElement("span"),remove=document.createElement("button");
    text.textContent=[compactLabel(demoText(mark.video_title),"","video"),mark.shot_id,formatTime(mark.time_s)+t(" 秒")].filter(Boolean).join(" · ");
    remove.type="button";remove.textContent=t("移除");remove.setAttribute("aria-label",t("移除 ")+mark.shot_id+" "+formatTime(mark.time_s)+t(" 秒标记"));
    remove.disabled=!canEdit();
    remove.addEventListener("click",()=>{
      if(!canEdit())return;
      snapshotMarks=snapshotMarks.filter(item=>item.snapshot_id!==mark.snapshot_id);
      storeLocal();renderSnapshotMarks();updateStatus();
      if(capturedSnapshot?.snapshot_id===mark.snapshot_id)ui["snapshot-save"].disabled=false;
      ui["snapshot-status"].textContent=t("已移除本地标记，下载的图片不受影响。");
    });
    row.append(text,remove);list.append(row);
  }
}

function markSnapshotForExport() {
  if(!capturedSnapshot || !canEdit())return false;
  if(snapshotMarks.some(mark=>mark.snapshot_id===capturedSnapshot.snapshot_id)){
    ui["snapshot-status"].textContent=t("这帧已经标记，可继续拍摄其他时间点。");return false;
  }
  if(snapshotMarks.length>=snapshotLimit){
    ui["snapshot-status"].textContent=t("一次最多标记 30 帧。请先交接这批，或移除不需要的标记。");return false;
  }
  snapshotMarks.push(copy(capturedSnapshot));
  const stored=storeLocal();renderSnapshotMarks();updateStatus();ui["snapshot-save"].disabled=true;
  ui["snapshot-status"].textContent=stored
    ? t("已标记当前帧，保存工程或导出修改时包含这些数据。")
    : t("自动保存失败，请下载工程");
  return true;
}

ui.snapshot?.addEventListener("click", () => {
  if(!plan || !shot() || sceneOverview || comparisonActive()) return;
  const viewedTime=time;
  pause();stopPanPress();
  const previous=time;time=viewedTime;
  capturedSnapshot=captureSnapshotMark();
  // Freeze the frame actually visible during trial playback, then return to the edit anchor.
  time=capturedSnapshot.time_s/duration(shot());
  drawPreview(false);const png=preview.toDataURL("image/png");time=previous;drawPreview();
  ui["snapshot-image"].src=png;
  ui["snapshot-meta"].textContent=[compactLabel(demoText(session.project_title || plan.title),t("当前项目"),"project"),compactLabel(demoText(capturedSnapshot.video_title),"","video"),
    capturedSnapshot.shot_id,compactLabel(demoText(capturedSnapshot.shot_title),capturedSnapshot.shot_id,'shot'),formatTime(capturedSnapshot.time_s)+t(" 秒")].filter(Boolean).join(" · ");
  ui["snapshot-download"].href=png;
  ui["snapshot-download"].download=capturedSnapshot.shot_id+"-"+formatTime(capturedSnapshot.time_s)+"s.png";
  ui["snapshot-save"].disabled=!canEdit();
  ui["snapshot-status"].textContent=t("下载当前帧，或将机位与主体状态标记到工程数据中。");
  renderSnapshotMarks();
  if(!ui["snapshot-dialog"].open)ui["snapshot-dialog"].showModal();
});
ui["snapshot-save"]?.addEventListener("click",markSnapshotForExport);

// Language is a presentation preference: do not reload, reseek, reselect or write a draft.
function refreshLanguage() {
  const i18n=window.StageI18n;if(!i18n)return;
  for(const id of ['notice','navigation-message','edit-status','preset-status','timing-status','snapshot-status','handoff-label','placement-label','orbit-radius-help','motion-speed-help']){
    if(ui[id])ui[id].textContent=i18n.retranslate(ui[id].textContent);
  }
  navigationMessage=i18n.retranslate(navigationMessage);
  if(geometryPlacementStatus.message)geometryPlacementStatus.message=i18n.retranslate(geometryPlacementStatus.message);

  if(!plan||!shot())return;
  syncProjectCaption();syncShotHeading();
  const entities=scene().objects.filter(o=>!isCompanion(o));
  ui.entity.replaceChildren(new Option(t('选择主体'),''),...entities.map(o=>new Option(objectName(o),o.id)));
  ui.entity.value=selectedEntity||'';
  if(ui['path-track']){ui['path-track'].replaceChildren(new Option(t('摄影机运镜'),'camera'),...entities.map(o=>new Option(objectName(o)+t(' · 走位'),o.id)));ui['path-track'].value=selectedTrack;}
  ui.play.setAttribute('aria-label',playing!==null?t('暂停'):t('播放'));
  syncAutoEditStatus();
  renderShotList();updateShotSelection();updateFitLabel();updateStatus();
  syncSceneOverviewUI();syncDirectorControls();configureTravel(activePreset,false);
  timingSignature='';renderSnapshotMarks();
  if(capturedSnapshot&&ui['snapshot-dialog']?.open){ui['snapshot-meta'].textContent=[compactLabel(demoText(session.project_title||plan.title),t('当前项目'),'project'),compactLabel(demoText(capturedSnapshot.video_title),'','video'),capturedSnapshot.shot_id,compactLabel(demoText(capturedSnapshot.shot_title),capturedSnapshot.shot_id,'shot'),formatTime(capturedSnapshot.time_s)+t(' 秒')].filter(Boolean).join(' · ');}
  invalidate();
}
window.addEventListener('stage-language-change',refreshLanguage);
