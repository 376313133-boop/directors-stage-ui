/* Manual additions use the same CPU-compatible primitives as Agent-built scenes. */
(function(scope){
  'use strict';
  const t=(source,vars)=>scope.StageI18n?.t(source,vars)??String(source).replace(/\{(\w+)\}/g,(all,key)=>vars?.[key]??all);
  const bind=(node,key,render)=>{if(scope.StagePanelI18n)return scope.StagePanelI18n.bind(node,key,render);const value=render();if(key.startsWith('@'))node.setAttribute(key.slice(1),value);else node[key]=value;};
  const sourceText=value=>scope.StagePanelI18n?.source(value)??value;
  const demoText=value=>scope.StageI18n?.demoText(value)??value;
  const kinds={
    box:{name:t('方块'),hint:t('墙体、桌台、道具'),size:[1,1,1],icon:'<path d="m10 2 7 4v8l-7 4-7-4V6zM3 6l7 4 7-4m-7 4v8"/>'},
    sphere:{name:t('球体'),hint:t('球形物与标记'),size:[.6,.6,.6],icon:'<circle cx="10" cy="10" r="7"/><ellipse cx="10" cy="10" rx="3" ry="7"/><path d="M3 10h14"/>'},
    cylinder:{name:t('圆柱'),hint:t('柱体与立式道具'),size:[.6,1.2,.6],icon:'<ellipse cx="10" cy="4" rx="6" ry="2.5"/><path d="M4 4v12c0 3.3 12 3.3 12 0V4M4 12c0 3.3 12 3.3 12 0"/>'},
    person:{name:t('简易人物'),hint:t('头身一起移动'),size:[.48,1.72,.4],icon:'<circle cx="10" cy="4.5" r="2.5"/><path d="M6 18V9h8v9M10 11v7"/>'},
  };
scope.StagePanelI18n?.live(kinds);
  const palettes=['#aeb5b7','#7c9cad','#b9927e','#90a896','#b2a2bd'];
  const finite=n=>Number.isFinite(n);
  const round=n=>Number(n.toFixed(6));
  function validateSpec(spec){
    if(!spec || !kinds[spec.kind])throw Error(t('请选择方块、球体、圆柱或简易人物。'));
    if(!Array.isArray(spec.size)||spec.size.length!==3||!spec.size.every(n=>finite(n)&&n>=.05&&n<=30))throw Error(t('每个尺寸需要在 0.05–30 米之间。'));
    const label=String(spec.label||kinds[spec.kind].name).trim();
    if(!label||label.length>64||/[\x00-\x1f\x7f]/.test(label))throw Error(t('名称请使用 1–64 个可见字符。'));
    if(typeof spec.color!=='string'||!/^#[0-9a-f]{6}$/i.test(spec.color))throw Error(t('请选择有效颜色。'));
    return {kind:spec.kind,label,size:spec.size.map(round),color:spec.color.toLowerCase()};
  }
  function makeObjects(spec,origin,id){
    const value=validateSpec(spec);
    if(typeof id!=='string'||!/^user_geo_[A-Za-z0-9_-]+$/.test(id)||id.length>75)throw Error(t('新物体标识无效。'));
    if(!Array.isArray(origin)||origin.length!==3||!origin.every(n=>finite(n)&&Math.abs(n)<=1000))throw Error(t('放置位置无效。'));
    const position=origin.map(round),base={id,label:value.label,shape:value.kind,position,size:[...value.size],color:value.color,yaw_deg:0};
    if(value.kind!=='person')return {objects:[base],primaryId:id};
    const [w,h,d]=value.size,bodyHeight=round(h*.8);
    return {primaryId:id,objects:[
      {...base,shape:'cylinder',size:[w,bodyHeight,d],actor_id:id},
      {id:id+'_head',label:value.label+t(' · 头部'),parent_id:id,actor_id:id,shape:'sphere',position:[position[0],round(position[1]+bodyHeight),position[2]],size:[round(w*.7),round(h-bodyHeight),round(d*.7)],color:value.color,yaw_deg:0},
    ]};
  }
  const sizeMin=.05,sizeMax=30;
  function sliderToSize(value){return round(sizeMin*Math.pow(sizeMax/sizeMin,Math.max(0,Math.min(100,Number(value)))/100));}
  function sizeToSlider(value){return 100*Math.log(Math.max(sizeMin,Math.min(sizeMax,Number(value)))/sizeMin)/Math.log(sizeMax/sizeMin);}
  function classifyOutcome(value){
    if(typeof value==='string'&&value)return {status:'added',id:value};
    if(value&&typeof value==='object'&&value.status==='placing')return value;
    if(value&&typeof value==='object'&&value.status==='added'&&typeof value.id==='string'&&value.id)return value;
    throw Error(value?.message||t('尚未添加物体，请结束拖动后选择放置位置。'));
  }
  function create(container,adapter){
    if(!container||!adapter?.getState||!adapter.add)throw Error('Geometry editor requires a container, getState and add.');
    const doc=container.ownerDocument,listeners=[];
    let kind='box',color=palettes[0],mode='map',busy=false,selectedId='',state={},editing=false,lastAddedId='',lastPlacement='',lastSceneId='',wasPending=false;
    const el=(tag,cls,text)=>{const node=doc.createElement(tag);if(cls)node.className=cls;if(text!==undefined&&text!==''){const source=sourceText(text);bind(node, 'textContent', ()=>t(source));}return node;};
    const on=(node,event,handler)=>{node.addEventListener(event,handler);listeners.push(()=>node.removeEventListener(event,handler));};
    const action=(cls,text)=>{const b=el('button',cls,text);b.type='button';return b;};
    const blocked=()=>!!state.readOnly||!!state.pendingPreview||busy;
    const placing=()=>state.placement?.status==='placing';
    const root=el('section','geometry-editor');bind(root, '@aria-label', ()=>t('手动添加物体'));
    const header=el('div','ge-heading'),title=el('h2','',t('添加物体')),scene=el('span','ge-scene');header.append(title,scene);
    const note=el('p','ge-note',t('先选物体和尺寸，再决定放在哪里。添加后会自动选中并定位。'));
    const grid=el('div','ge-kinds');grid.setAttribute('role','group');bind(grid, '@aria-label', ()=>t('选择几何体类型'));
    const kindButtons=[];
    for(const [key,value] of Object.entries(kinds)){
      const button=action('ge-kind','');button.dataset.geometryKind=key;
      const icon=el('span','ge-icon');icon.setAttribute('aria-hidden','true');icon.innerHTML='<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">'+value.icon+'</svg>';
      button.append(icon,el('strong','',value.name),el('small','',value.hint));
      on(button,'click',()=>{if(blocked()||placing())return;kind=key;for(let i=0;i<3;i++)draftRanges[i].set(value.size[i]);render();});
      grid.append(button);kindButtons.push(button);
    }
    const form=el('div','ge-form'),nameLabel=el('label','ge-name'),nameText=el('span','',t('物体名称')),name=el('input');name.type='text';name.maxLength=64;bind(name, 'placeholder', ()=>t('留空自动编号'));bind(name, '@aria-label', ()=>t('新物体名称'));nameLabel.append(nameText,name);
    const colors=el('div','ge-colors');colors.setAttribute('role','group');bind(colors, '@aria-label', ()=>t('新物体颜色'));
    const colorLabels=['石灰','雾蓝','陶土','鼠尾草','浅灰紫'],colorButtons=[];
    palettes.forEach((hex,index)=>{const b=action('ge-color','');bind(b, '@aria-label', ()=>t(colorLabels[index]));b.style.setProperty('--swatch',hex);on(b,'click',()=>{if(blocked()||placing())return;color=hex;render();});colors.append(b);colorButtons.push(b);});
    form.append(nameLabel,colors);
    function ranges(prefix,callback){
      prefix=sourceText(prefix);
      const box=el('div','ge-ranges');
      const values=['宽度','高度','进深'].map((label,index)=>{
        const row=el('div','ge-size'),text=el('span','',label),input=el('input'),number=el('input'),unit=el('span','ge-size-unit','m');
        input.type='range';input.min='0';input.max='100';input.step='.1';bind(input, '@aria-label', ()=>t(prefix)+(scope.StageI18n?.locale&&scope.StageI18n.locale!=='zh'?' ':'')+t(label));
        number.type='number';number.min=String(sizeMin);number.max=String(sizeMax);number.step='.01';number.inputMode='decimal';bind(number, '@aria-label', ()=>t(prefix)+(scope.StageI18n?.locale&&scope.StageI18n.locale!=='zh'?' ':'')+t(label)+t('（米）'));
        let current=kinds.box.size[index];
        const set=(value,preserveInput=false)=>{current=value;input.value=String(sizeToSlider(value));bind(input, '@aria-valuetext', ()=>Number(value).toFixed(2)+t(' 米'));if(!preserveInput)number.value=String(round(value));};
        const read=()=>{const value=number.value.trim()===''?NaN:Number(number.value);if(!finite(value)||value<sizeMin||value>sizeMax)throw Error(t(label)+t('需要在 0.05–30 米之间。'));return value;};
        set(current);row.append(text,input,number,unit);box.append(row);
        on(input,'input',()=>{set(sliderToSize(input.value));if(callback)callback();});
        on(number,'input',()=>{const value=Number(number.value);if(number.value.trim()&&finite(value)&&value>=sizeMin&&value<=sizeMax){set(value,true);if(callback)callback();}});
        on(number,'change',()=>{try{set(read());}catch(error){bind(status, 'textContent', ()=>scope.StageI18n?.retranslate(error.message)??error.message);}});
        return {input,number,set,read};
      });return {box,values};
    }
    const draft=ranges(t('新物体')),draftRanges=draft.values;
    const sizeTools=el('div','ge-size-tools'),resetSize=action('ge-size-reset',t('恢复默认尺寸'));
    on(resetSize,'click',()=>{if(blocked()||placing())return;draftRanges.forEach((r,i)=>r.set(kinds[kind].size[i]));render();});sizeTools.append(el('span','',t('滑动精调常用尺寸，也可直接输入米数。')),resetSize);
    const placement=el('div','ge-placement');placement.setAttribute('role','group');bind(placement, '@aria-label', ()=>t('放置位置'));placement.append(el('span','ge-placement-label',t('放在哪里')));
    const placementButtons=[];
    for(const [value,label,hint] of [['map',t('片场点选'),t('在左侧片场点击地面放置')],['target',t('摄影机注视点'),t('放到摄影机注视点对应的地面')],['near-selected',t('选中主体旁'),t('放到当前选中主体旁边，保留间距')]]){
      const b=action('ge-placement-choice',label);b.dataset.placementMode=value;bind(b, 'title', ()=>t(sourceText(hint)));on(b,'click',()=>{if(blocked()||placing())return;mode=value;render();});placement.append(b);placementButtons.push(b);
    }
    const actions=el('div','ge-actions'),add=action('ge-add',t('选择放置位置')),cancel=action('ge-cancel',t('取消放置')),locate=action('ge-locate',t('定位刚添加的物体'));cancel.hidden=true;locate.hidden=true;
    const impact=el('span','ge-impact');actions.append(add,cancel,locate,impact);
    const status=el('p','ge-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const selected=el('details','ge-selected');selected.hidden=true;
    const summary=el('summary','',t('调整选中物体大小')),selectedName=el('p','ge-selected-name');selected.append(summary,selectedName);
    const selectedRanges=ranges(t('选中物体'),()=>{
      if(!state.selectedObject||blocked()||placing())return;
      try{const result=adapter.resize?.(state.selectedObject.id,selectedRanges.values.map(r=>r.read()));if(result===false||result?.status==='blocked')throw Error(result?.message||t('大小未修改，请先完成当前调整。'));bind(status, 'textContent', ()=>t('大小已更新；本片场相关镜头会一起更新。'));}
      catch(error){bind(status, 'textContent', ()=>scope.StageI18n?.retranslate(error.message)??error.message);}
    });selected.append(selectedRanges.box);
    for(const row of selectedRanges.values)for(const input of [row.input,row.number]){
      on(input,'pointerdown',()=>{editing=true;adapter.beginEdit?.();});
      on(input,'keydown',()=>{editing=true;adapter.beginEdit?.();});
      for(const type of ['pointerup','pointercancel','change','blur'])on(input,type,()=>{editing=false;adapter.endEdit?.();render();});
    }
    function outcome(value,spec){
      const result=classifyOutcome(value);
      if(result.status==='placing'){
        lastAddedId='';locate.hidden=true;bind(status, 'textContent', ()=>(scope.StageI18n?.retranslate(result.message)??result.message)||t('到左侧片场点击放置；按 Esc 或“取消放置”退出。'));
      }else{
        lastAddedId=result.id;locate.hidden=false;bind(status, 'textContent', ()=>(scope.StageI18n?.retranslate(result.message)??result.message)||t('已添加 {0}，并已选中定位。',{0:result.label||spec?.label||kinds[kind].name}));
      }
      return result;
    }
    on(add,'click',async()=>{
      state=adapter.getState()||{};
      if(state.pendingPreview){bind(status, 'textContent', ()=>t('请结束当前拖动后再添加物体。'));return;}
      if(state.readOnly||busy||placing()){if(state.readOnly)bind(status, 'textContent', ()=>t('当前是只读状态，不能添加物体。'));return;}
      busy=true;render();
      try{
        const spec={...validateSpec({kind,label:name.value||kinds[kind].name,size:draftRanges.map(r=>r.read()),color}),autoName:!name.value.trim()};
        if(mode==='map')outcome(await adapter.beginPlace?.(spec),spec);
        else outcome(await adapter.add(spec,{mode}),spec);
      }catch(error){bind(status, 'textContent', ()=>scope.StageI18n?.retranslate(error.message)??error.message);}
      finally{busy=false;render();}
    });
    on(cancel,'click',()=>{adapter.cancelPlace?.();bind(status, 'textContent', ()=>t('已取消放置，未添加新物体。'));render();});
    on(locate,'click',()=>{if(!lastAddedId)return;const found=adapter.locate?.(lastAddedId);if(found===false)bind(status, 'textContent', ()=>t('该物体已不在当前片场，请从对象列表重新选择。'));});
    root.append(header,note,grid,form,draft.box,sizeTools,placement,actions,status,selected);container.replaceChildren(root);
    function render(){
      state=adapter.getState()||{};
      const pending=!!state.pendingPreview,isPlacing=placing(),readonly=blocked()||isPlacing;
      if(wasPending&&!pending)bind(status, 'textContent', ()=>'');wasPending=pending;
      const event=state.placement,sceneId=state.sceneId||'';
      if(lastSceneId&&sceneId!==lastSceneId){lastAddedId='';bind(status, 'textContent', ()=>'');lastPlacement=event?JSON.stringify([event.sequence,event.status,event.id,event.message]):'';}
      lastSceneId=sceneId;
      if(event){const signature=JSON.stringify([event.sequence,event.status,event.id,event.message]);if(signature!==lastPlacement){lastPlacement=signature;if(event.status==='added'&&event.id)outcome(event);else if(event.status==='placing')outcome(event);else if(event.status==='cancelled'){bind(status, 'textContent', ()=>(scope.StageI18n?.retranslate(event.message)??event.message)||t('已取消放置，未添加新物体。'));locate.hidden=true;}else if(event.status==='blocked')bind(status, 'textContent', ()=>(scope.StageI18n?.retranslate(event.message)??event.message)||t('请结束当前拖动后再添加物体。'));}}
      if(pending)bind(status, 'textContent', ()=>t('请结束当前拖动后再添加物体。'));
      status.classList.toggle('is-placement',isPlacing);status.classList.toggle('is-blocked',pending);
      bind(scene, 'textContent', ()=>state.sceneName||state.sceneId||t('当前片场'));
      bind(impact, 'textContent', ()=>t('本场 {0} 个镜头会同步更新',{0:Math.max(0,Number(state.affectedShots)||0)}));
      kindButtons.forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.geometryKind===kind));b.disabled=readonly;});
      colorButtons.forEach((b,i)=>{b.setAttribute('aria-pressed',String(palettes[i]===color));b.disabled=readonly;});
      draftRanges.forEach(({input,number})=>{input.disabled=readonly;number.disabled=readonly;});
      name.disabled=readonly;resetSize.disabled=readonly;
      placementButtons.forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.placementMode===mode));b.disabled=readonly||(b.dataset.placementMode==='near-selected'&&!state.selectedObject);if(b.dataset.placementMode==='near-selected'){const label=state.selectedObject&&demoText(state.selectedObject.label||state.selectedObject.name||state.selectedObject.id);bind(b, 'textContent', ()=>label?t('{0} 旁边',{0:label}):t('选中主体旁'));bind(b, 'title', ()=>label?t('放到 {0} 当前站位的旁边，保留间距',{0:label}):t('先选择一个主体'));}});
      add.disabled=readonly;bind(add, 'textContent', ()=>busy?t('正在准备…'):isPlacing?t('等待片场点选'):mode==='map'?t('选择放置位置'):mode==='target'?t('添加到注视点'):t('添加到主体旁'));
      cancel.hidden=!isPlacing;cancel.disabled=!!state.readOnly||busy;locate.hidden=!lastAddedId||isPlacing;locate.disabled=busy;
      const object=state.selectedObject,canResize=!!adapter.resize&&!!object?.id?.startsWith('user_geo_')&&Array.isArray(object.size);
      selected.hidden=!canResize;
      if(canResize){
        if(selectedId!==object.id){selectedId=object.id;selected.open=true;}
        bind(selectedName, 'textContent', ()=>demoText(object.label||object.name||object.id)+t(' · 修改本场共享尺寸'));
        selectedRanges.values.forEach((row,i)=>{row.input.disabled=readonly;row.number.disabled=readonly;if(!editing)row.set(Number(object.size[i]));});
      }
    }
    if(scope.addEventListener)on(scope,'stage-language-change',render);
    render();return {render,destroy(){listeners.forEach(unlisten=>unlisten());container.replaceChildren();}};
  }
  const api={kinds,palettes,validateSpec,makeObjects,sliderToSize,sizeToSlider,classifyOutcome,create};
  scope.StageGeometry=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:globalThis);
