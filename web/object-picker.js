/* Search and locate change the editing target or observation, never the shot camera. */
(function(scope){
  'use strict';
  const t=(source,vars)=>scope.StageI18n?.t(source,vars)??String(source).replace(/\{(\w+)\}/g,(all,key)=>vars?.[key]??all);
  const bind=(node,key,render)=>{if(scope.StagePanelI18n)return scope.StagePanelI18n.bind(node,key,render);const value=render();if(key.startsWith('@'))node.setAttribute(key.slice(1),value);else node[key]=value;};
  const sourceText=value=>scope.StagePanelI18n?.source(value)??value;
  const shapes={
    camera:'<path d="M3 6h9v8H3zM12 8l5-2v8l-5-2M5 3h5"/>',
    person:'<circle cx="10" cy="4.5" r="2.5"/><path d="M6 18V9h8v9M10 11v7"/>',
    box:'<path d="m10 2 7 4v8l-7 4-7-4V6zM3 6l7 4 7-4m-7 4v8"/>',
    sphere:'<circle cx="10" cy="10" r="7"/><ellipse cx="10" cy="10" rx="3" ry="7"/>',
    cylinder:'<ellipse cx="10" cy="4" rx="6" ry="2.5"/><path d="M4 4v12c0 3.3 12 3.3 12 0V4"/>',
  };
  const objectName=object=>String(scope.StageI18n?.demoText(object.label||object.name||object.id)||object.label||object.name||object.id||t('未命名物体'));
  function itemsFrom(state){
    const source=Array.isArray(state?.subjects)?state.subjects:(state?.scene?.objects||[]).filter(o=>!o.parent_id&&!String(o.id).endsWith('_head'));
    const visible=new Map((state?.resolvedObjects||[]).map(o=>[o.id,o]));
    const counts=new Map();for(const object of source){const name=objectName(object);counts.set(name,(counts.get(name)||0)+1);}
    const objects=source.map(o=>({
      id:o.id,name:objectName(o),kind:o.actor_id?'person':(shapes[o.shape]?o.shape:'box'),group:o.actor_id?t('人物'):t('物体'),
      color:/^#[0-9a-f]{6}$/i.test(o.color||'')?o.color:'#aab6b0',hidden:visible.has(o.id)?!!visible.get(o.id).hidden:!!o.hidden,
      detail:counts.get(objectName(o))>1?'…'+String(o.id).slice(-6):String(o.id).startsWith('user_geo_')?t('新建'):'',
    }));
    return [{id:'camera',name:t('摄影机运镜'),kind:'camera',group:t('摄影机'),color:'#dce3df',hidden:false},...objects.filter(o=>o.group===t('人物')),...objects.filter(o=>o.group===t('物体'))];
  }
  function filteredItems(items,query){const q=String(query||'').trim().toLocaleLowerCase();return !q?items:items.filter(o=>(o.name+' '+o.id+' '+o.group).toLocaleLowerCase().includes(q));}
  function create(container,adapter){
    if(!container||!adapter?.getState||!adapter.chooseSubject)throw Error('Object picker requires a container and editing-target adapter.');
    const doc=container.ownerDocument,listeners=[];let state=adapter.getState(),opened=false,activeIndex=0,rows=[],signature='',currentSignature='',feedbackKind='',lastPending=false,destroyed=false;
    const node=(tag,cls,text)=>{const el=doc.createElement(tag);if(cls)el.className=cls;if(text!==undefined&&text!==''){const source=cls==='op-name'?null:sourceText(text);bind(el, 'textContent', ()=>source===null?text:t(source));}return el;};
    const on=(target,event,fn,options)=>{target?.addEventListener(event,fn,options);listeners.push(()=>target?.removeEventListener(event,fn,options));};
    const icon=item=>{const el=node('span','op-icon');el.setAttribute('aria-hidden','true');el.style.setProperty('--object-color',item.color);el.innerHTML='<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">'+shapes[item.kind]+'</svg>';return el;};
    const button=node('button','op-trigger');button.type='button';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');bind(button, '@aria-label', ()=>t('选择编辑对象'));
    const currentIcon=node('span','op-current-icon'),copy=node('span','op-current-copy'),name=node('strong','op-current-name',t('摄影机运镜')),meta=node('span','op-current-meta',t('摄影机')),arrow=node('span','op-arrow','⌄');arrow.setAttribute('aria-hidden','true');copy.append(name,meta);button.append(currentIcon,copy,arrow);
    const locateCurrent=node('button','op-locate-current',t('定位'));locateCurrent.type='button';bind(locateCurrent, 'title', ()=>t('只定位观察视图，不改变拍摄机位'));
    const panel=node('div','op-panel');panel.hidden=true;panel.setAttribute('role','dialog');bind(panel, '@aria-label', ()=>t('查找并选择编辑对象'));
    const header=node('div','op-panel-header'),title=node('strong','',t('查找对象')),count=node('span','op-count'),closeButton=node('button','op-close','×');closeButton.type='button';bind(closeButton, '@aria-label', ()=>t('关闭对象列表'));header.append(title,count,closeButton);
    const search=node('input','op-search');search.type='search';bind(search, 'placeholder', ()=>t('搜索人物、物体名称'));bind(search, '@aria-label', ()=>t('搜索编辑对象'));search.autocomplete='off';search.spellcheck=false;
    const list=node('div','op-list');list.setAttribute('role','list');
    const feedback=node('p','op-feedback');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
    const hint=node('p','op-hint',t('选择切换编辑对象；定位只移动观察视图。'));panel.append(header,search,list,feedback,hint);
    container.replaceChildren(button,locateCurrent);doc.body.append(panel);
    const legacy=doc.getElementById('path-track'),legacyHidden=legacy?.hidden;if(legacy)legacy.hidden=true;
    function currentId(){return state?.selectedTrack||'camera';}
    function announce(message,kind='info'){bind(feedback, 'textContent', typeof message==='function'?message:()=>scope.StageI18n?.retranslate(message)??message);feedbackKind=kind;}
    function position(){
      if(!opened)return;const rect=button.getBoundingClientRect(),vw=scope.innerWidth||doc.documentElement.clientWidth||390,vh=scope.innerHeight||doc.documentElement.clientHeight||700;
      const width=Math.min(440,vw-24),below=vh-rect.bottom-16,above=rect.top-16,available=below>=Math.min(320,above)?below:above;
      panel.style.width=width+'px';panel.style.maxHeight=Math.max(160,Math.min(500,vh-24,available))+'px';
      panel.style.left=Math.max(12,Math.min(rect.left,vw-width-12))+'px';
      const height=Math.min(panel.offsetHeight||420,vh-24);
      panel.style.top=Math.max(12,Math.min(vh-height-12,below>=Math.min(320,above)?rect.bottom+8:rect.top-height-8))+'px';
    }
    function close(returnFocus=true){opened=false;panel.hidden=true;button.setAttribute('aria-expanded','false');search.value='';signature='';if(returnFocus)button.focus();}
    function open(){opened=true;panel.hidden=false;button.setAttribute('aria-expanded','true');search.value='';signature='';lastPending=false;announce(()=>(''));render();position();search.focus();}
    function choose(item){
      if(!item)return;const accepted=adapter.chooseSubject(item.id);
      if(accepted===false){announce(()=>(t('当前对象暂不可切换，请结束拖动后重试。')),'blocked');return;}
      state=adapter.getState();close();render();
    }
    function locate(item){
      if(!item)return;let result=false;
      try{result=adapter.locateObject?.(item.id);}catch(error){announce(()=>(error.message||t('暂时无法定位这个对象。')));return;}
      if(result!==true){announce(()=>(t('暂时无法定位这个对象。')));return;}
      announce(()=>(t('已定位 {0}{1}，拍摄机位保持不变。',{0:item.name,1:item.hidden?t('（当前隐藏）'):''})),'location');
    }
    function focusRow(index){if(!rows.length)return;activeIndex=(index+rows.length)%rows.length;rows[activeIndex].select.focus();rows[activeIndex].select.scrollIntoView?.({block:'nearest'});}
    function paintRows(items){
      rows=[];list.replaceChildren();let group='';
      for(const item of items){
        if(item.group!==group){group=item.group;const heading=node('div','op-group',group);heading.setAttribute('role','presentation');list.append(heading);}
        const row=node('div','op-row');row.setAttribute('role','listitem');row.classList.toggle('is-current',item.id===currentId());row.dataset.objectId=item.id;
        const select=node('button','op-select');select.type='button';select.setAttribute('aria-pressed',String(item.id===currentId()));bind(select, '@aria-label', ()=>t('编辑 ')+item.name);
        const words=node('span','op-row-copy'),label=node('strong','op-name',item.name),subtitle=node('span','op-meta',[item.group,item.detail,item.hidden?t('当前隐藏'):''].filter(Boolean).join(' · '));words.append(label,subtitle);select.append(icon(item),words);
        const locateButton=node('button','op-locate',t('定位'));locateButton.type='button';bind(locateButton, 'title', ()=>t('只移动观察视图'));bind(locateButton, '@aria-label', ()=>t('定位 ')+item.name);
        select.addEventListener('click',()=>choose(item));locateButton.addEventListener('click',event=>{event.stopPropagation();locate(item);});
        const index=rows.length;select.addEventListener('keydown',event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();focusRow(index+(event.key==='ArrowDown'?1:-1));}else if(event.key==='Enter'){event.preventDefault();choose(item);}});
        rows.push({item,select,locateButton});row.append(select,locateButton);list.append(row);
      }
      if(!items.length)list.append(node('p','op-empty',t('没有匹配的对象，试试更短的名称。')));
    }
    function render(next){
      if(destroyed)return;if(next)state=next;else state=adapter.getState();
      const items=itemsFrom(state),current=items.find(o=>o.id===currentId())||items[0];
      const currentKey=JSON.stringify(current);
      if(currentKey!==currentSignature){currentSignature=currentKey;bind(name, 'textContent', ()=>current.name);bind(meta, 'textContent', ()=>[current.group,current.hidden?t('当前隐藏'):''].filter(Boolean).join(' · '));currentIcon.replaceChildren(icon(current));bind(button, '@aria-label', ()=>t('选择编辑对象，当前：')+current.name);}
      bind(locateCurrent, '@aria-label', ()=>t('定位 ')+current.name);bind(count, 'textContent', ()=>t('{0} 个对象',{0:items.length-1}));button.disabled=!state?.shot;locateCurrent.disabled=!state?.shot||typeof adapter.locateObject!=='function';
      if(!opened)return;const filtered=filteredItems(items,search.value),key=JSON.stringify([filtered,currentId(),state?.pendingPreview]);
      if(signature!==key){signature=key;paintRows(filtered);activeIndex=Math.max(0,filtered.findIndex(o=>o.id===currentId()));}
      if(state?.pendingPreview&&!lastPending)announce(()=>(t('正在调整：可随时定位，结束拖动后可切换对象。')),'pending');
      else if(!state?.pendingPreview&&['pending','blocked'].includes(feedbackKind))announce(()=>(''));
      lastPending=!!state?.pendingPreview;
      position();
    }
    on(button,'click',()=>opened?close():open());on(closeButton,'click',()=>close());
    on(button,'keydown',event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(!opened)open();focusRow(event.key==='ArrowUp'?rows.length-1:0);}});
    on(locateCurrent,'click',()=>{const item=itemsFrom(state).find(o=>o.id===currentId());locate(item);});
    on(search,'input',()=>{signature='';activeIndex=0;render();});
    on(search,'keydown',event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();focusRow(event.key==='ArrowUp'?rows.length-1:0);}else if(event.key==='Enter'){event.preventDefault();choose(rows[activeIndex]?.item);}});
    on(panel,'keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}});
    on(doc,'pointerdown',event=>{if(opened&&!panel.contains(event.target)&&!container.contains(event.target))close(false);});
    on(doc,'focusin',event=>{if(opened&&!panel.contains(event.target)&&!container.contains(event.target))close(false);});
    on(scope,'resize',position);on(scope,'scroll',position,true);
    if(scope.addEventListener)on(scope,'stage-language-change',()=>{signature='';currentSignature='';render();position();});
    const unsubscribe=adapter.subscribe?.(render);render();
    return {open,close,render,getOpen:()=>opened,destroy(){destroyed=true;unsubscribe?.();listeners.forEach(stop=>stop());panel.remove();container.replaceChildren();if(legacy)legacy.hidden=legacyHidden;}};
  }
  const api={create,itemsFrom,filteredItems};scope.StageObjectPicker=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
  let connected=false;
  function connect(){const container=scope.document?.getElementById('object-picker'),editor=scope.stageEditor;if(connected||!container||!editor?.chooseSubject)return;connected=true;create(container,editor);}
  scope.addEventListener?.('stage-editor-ready',connect);connect();
})(typeof window==='object'?window:globalThis);
