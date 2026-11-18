/* Non-modal guidance. It never calls the editor adapter or changes project data. */
(function(scope){
  'use strict';
  const preferenceKey='directors-stage-ui-guide-v1';
  const steps=[
    {label:'选镜头',title:'先选你要改的那个画面',text:'左侧按视频或场景展开分组，点镜头缩略图。右侧始终显示这个镜头实际拍到的画面。',target:'.shot-rail'},
    {label:'选时长',title:'在基础参数里选时长',text:'拖动时长滑杆，决定这一镜拍多久。只调整当前镜头。',target:'#basic-duration'},
    {label:'调画面',title:'选画面和运镜',text:'拖动小球换角度，再拉近或拉远。选一个运镜，点正向或反向改变方向。不喜欢就点画面旁的「还原」。更多细节在「高级参数」里。',target:'#basic-settings'},
    {label:'保存工程',title:'先播放检查，再保存工程',text:'点播放检查整镜。完成后点右上角「保存工程」，下载包含场景和镜头的 JSON。部署方接入宿主保存接口后，也可通过该接口保存。',target:'#save'},
  ];
  const extras=[
    ['试一次人物走位','以一个 10 秒镜头为例：拖到第 4 秒，移动人物；再拖到第 8 秒，把人物移到下一处。两个时刻的位置会连成路线，播放就能检查。'],
    ['路线与停留','圆点是机位或站位。左右拖圆点改到达时间，拖停留条改停多久；点两个点之间的移动段，只调整这一段运镜。'],
    ['下载当前帧','直接把右侧取景保存成 PNG 到你的设备，不上传图片。'],
    ['标记当前帧','记录此刻的机位与主体状态，作为工程 JSON 中的一条标记；不会自动上传图片或启动任务。'],
  ];
  function create(host,trigger,options={}){
    if(!host||!trigger)return null;
    const doc=host.ownerDocument,bindings=[],listeners=[];
    let current=0,focusTarget=null,timer=null,destroyed=false;
    const t=key=>scope.StageI18n?.t(key)??key;
    const on=(node,type,fn)=>{node.addEventListener(type,fn);listeners.push(()=>node.removeEventListener(type,fn));};
    const text=(node,key)=>{bindings.push(()=>node.textContent=t(key));node.textContent=t(key);return node;};
    const node=(tag,cls,key)=>{const el=doc.createElement(tag);if(cls)el.className=cls;if(key)text(el,key);return el;};
    const button=(cls,key)=>{const el=node('button',cls,key);el.type='button';return el;};
    const storage=()=>{try{return options.storage||scope.localStorage;}catch{return null;}};
    const remember=()=>{try{storage()?.setItem(preferenceKey,'dismissed');}catch{}};
    const head=node('div','quick-guide-heading'),copy=node('div','quick-guide-heading-copy');
    const title=node('h2','','从一个镜头开始');title.id='quick-guide-title';
    const intro=node('p','','四步熟悉片场，随时可以收起。');copy.append(title,intro);
    const closeButton=button('quick-guide-close','收起指引');head.append(copy,closeButton);
    const tabs=node('div','quick-guide-tabs');tabs.setAttribute('role','tablist');
    const tabButtons=steps.map((step,index)=>{const tab=button('quick-guide-tab');tab.id='quick-guide-tab-'+index;tab.setAttribute('role','tab');tab.setAttribute('aria-controls','quick-guide-content');const number=node('span','quick-guide-number');number.textContent=String(index+1).padStart(2,'0');tab.append(number,node('span','',step.label));tabs.append(tab);on(tab,'click',()=>select(index));on(tab,'keydown',event=>{let next;if(event.key==='ArrowRight')next=(current+1)%steps.length;else if(event.key==='ArrowLeft')next=(current+steps.length-1)%steps.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=steps.length-1;else return;event.preventDefault();select(next);tabButtons[next].focus();});return tab;});
    const content=node('div','quick-guide-content');content.id='quick-guide-content';content.setAttribute('role','tabpanel');content.tabIndex=0;
    const stepTitle=node('h3'),body=node('p'),actions=node('div','quick-guide-actions');
    const locateButton=button('quick-guide-locate','定位到操作区'),nextButton=button('quick-guide-next');
    actions.append(locateButton,nextButton);content.append(stepTitle,body,actions);
    const details=node('details','quick-guide-extra'),summary=node('summary','','常用操作'),grid=node('div','quick-guide-extra-grid');
    for(const [heading,description]of extras){const item=node('div');item.append(node('h4','',heading),node('p','',description));grid.append(item);}details.append(summary,grid);
    const note=node('p','quick-guide-storage','日常调整保存在此浏览器。请用「保存工程」保留 JSON 副本；远端保存取决于部署方接入的宿主保存接口。');
    const feedback=node('p','quick-guide-feedback');feedback.setAttribute('role','status');
    host.append(head,tabs,content,details,note,feedback);
    function clearFocus(){if(timer!==null)scope.clearTimeout?.(timer);timer=null;focusTarget?.classList.remove('stage-guide-focus');focusTarget=null;}
    function select(index){current=Math.max(0,Math.min(steps.length-1,index));clearFocus();feedback.textContent='';render();}
    function render(){if(destroyed)return;for(const update of bindings)update();host.setAttribute('aria-label',t('片场使用指引'));tabs.setAttribute('aria-label',t('入门步骤'));tabButtons.forEach((tab,index)=>{tab.setAttribute('aria-selected',String(index===current));tab.tabIndex=index===current?0:-1;});content.setAttribute('aria-labelledby',tabButtons[current].id);stepTitle.textContent=t(steps[current].title);body.textContent=t(steps[current].text);nextButton.textContent=t(current===steps.length-1?'开始调整':'下一步');if(feedback.textContent)feedback.textContent=t('这里是对应的操作区');}
    const motion=()=>scope.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';
    function reveal(el){for(let ancestor=el.parentElement;ancestor;ancestor=ancestor.parentElement)if(ancestor.tagName?.toLowerCase()==='details')ancestor.open=true;el.scrollIntoView?.({block:'center',behavior:motion()});}
    function open({focus=false}={}){host.hidden=false;trigger.setAttribute('aria-expanded','true');render();if(focus){reveal(host);tabButtons[current].focus({preventScroll:true});}}
    function close({focus=true}={}){host.hidden=true;trigger.setAttribute('aria-expanded','false');clearFocus();remember();if(focus)trigger.focus({preventScroll:true});}
    on(trigger,'click',()=>open({focus:true}));on(closeButton,'click',()=>close());
    on(nextButton,'click',()=>current===steps.length-1?close():select(current+1));
    on(locateButton,'click',()=>{clearFocus();const target=doc.querySelector(steps[current].target);if(!target)return;focusTarget=target;target.classList.add('stage-guide-focus');reveal(target);feedback.textContent=t('这里是对应的操作区');timer=scope.setTimeout?.(clearFocus,2600)??null;});
    on(scope,'stage-language-change',render);
    let seen=false;try{seen=storage()?.getItem(preferenceKey)==='dismissed';}catch{}
    if(seen||doc.getElementById('basic-settings')){host.hidden=true;trigger.setAttribute('aria-expanded','false');}else open();
    return {open,close,getState:()=>({open:!host.hidden,step:current}),destroy(){destroyed=true;clearFocus();listeners.forEach(off=>off());host.replaceChildren();}};
  }
  scope.StageGettingStarted={create};
  const host=scope.document?.getElementById('getting-started'),trigger=scope.document?.getElementById('guide-open');
  if(host&&trigger)scope.StageGettingStarted.instance=create(host,trigger);
})(typeof window!=='undefined'?window:globalThis);
