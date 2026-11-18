/* A small, live front door to the existing editor. Nothing changes until a user acts. */
(function(scope){
  'use strict';
  const presets=[['fixed','固定不动','保持这个画面','□'],['push','慢慢靠近','突出人物或物体','↑'],['pull','慢慢拉远','看见更多环境','↓'],['truck','左右移动','平稳地横着拍','↔'],['orbit','绕着拍','换个角度看主体','↻'],['jib','升高拍','边升高边看主体','↗']];
  const speedMessages={fixed:'先选一个运镜预设',preset_required:'先选一个运镜预设',custom:'自定义路线请在高级参数中调整',advanced:'分段和停留请在高级参数中调整',readonly:'当前为只读，不能调整速度',unavailable:'运镜还未准备好',short:'镜头太短，暂不能调整速度'};
  function create(doc,editor){
    const host=doc.getElementById('basic-settings'),advanced=doc.getElementById('advanced-settings');
    if(!host||!advanced||!editor)return null;
    const t=(key,vars)=>scope.StageI18n?.t(key,vars)??key.replace(/\{(\w+)\}/g,(match,name)=>vars?.[name]??match),bindings=[],listeners=[],controls=[],presetButtons=[];
    let destroyed=false,gesture=null,lastShot=null,speedBounds=null;
    const on=(el,type,fn,options)=>{el?.addEventListener(type,fn,options);listeners.push(()=>el?.removeEventListener(type,fn,options));};
    const node=(tag,cls,key)=>{const el=doc.createElement(tag);if(cls)el.className=cls;if(key){bindings.push(()=>el.textContent=t(key));el.textContent=t(key);}return el;};
    const button=(cls,key)=>{const el=node('button',cls,key);el.type='button';return el;};
    const state=()=>editor.getState();
    const readonly=s=>!s?.shot||s.comparison||s.sceneOverview||s.session?.can_edit===false||s.placement?.status==='placing';
    const event=(el,type)=>el.dispatchEvent(new (doc.defaultView?.Event||scope.Event)(type,{bubbles:true}));
    const pause=()=>{if(state()?.playing)doc.getElementById('play')?.click();};
    const atStart=()=>{pause();editor.seek(0);};
    const finish=()=>{if(gesture){editor.endEdit?.();gesture=null;speedBounds=null;}};
    function start(id,seek){if(readonly(state()))return false;if(gesture===id)return true;finish();if(typeof seek==='function'?seek():seek)atStart();editor.beginEdit?.();gesture=id;return true;}
    const head=node('div','basic-heading'),heading=node('div');
    heading.append(node('h2','','基础参数'),node('p','','选好时长、画面和运镜，就可以播放看看。'));
    const preview=button('basic-play','播放看看');preview.id='basic-play';preview.setAttribute('aria-label',t('播放当前镜头'));head.append(heading,preview);host.append(head);
    const grid=node('div','basic-grid');host.append(grid);
    function step(number,title){const card=node('section','basic-step'),h=node('h3'),num=node('span','basic-step-number');num.textContent=number;h.append(num,node('span','',title));card.append(h);grid.append(card);return card;}
    const lengthCard=step('01','镜头多长'),framingCard=step('02','画面怎么拍'),motionCard=step('03','镜头怎么动');
    function range(card,id,label,sourceId,{min,max,step:increment,seek=false,unit='',ends=[]}={}){
      const wrap=node('div','basic-range'),line=node('div','basic-range-label'),labelEl=node('label','',label),output=node('output');labelEl.htmlFor=id;output.htmlFor=id;
      const input=node('input');input.type='range';input.id=id;input.min=min;input.max=max;input.step=increment;
      line.append(labelEl,output);wrap.append(line,input);
      if(ends.length){const endsEl=node('div','basic-range-ends');endsEl.append(...ends.map(text=>node('span','',text)));wrap.append(endsEl);}
      card.append(wrap);controls.push({input,output,sourceId,unit});
      on(input,'pointerdown',()=>start(id,seek));on(input,'keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key))start(id,seek);});
      on(input,'input',()=>{if(!start(id,seek))return;const source=doc.getElementById(sourceId);if(!source||source.disabled)return;source.value=input.value;event(source,'input');sync();});
      const finishOwn=()=>{if(gesture===id)finish();};on(input,'change',finishOwn);on(input,'blur',finishOwn);on(input,'keyup',finishOwn);
      return {input,output,wrap};
    }
    const duration=range(lengthCard,'basic-duration','这一镜的时长','shot-duration-slider',{min:.1,max:30,step:.1,unit:' s',ends:['短一点','长一点']});
    const durationValue=node('div','basic-duration-value'),durationInput=node('input'),seconds=node('span','','秒');durationInput.id='basic-duration-value';durationInput.type='number';durationInput.min=.1;durationInput.max=30;durationInput.step=.1;durationInput.setAttribute('aria-label',t('这一镜的时长'));durationValue.append(durationInput,seconds);lengthCard.insertBefore(durationValue,duration.wrap);
    on(durationInput,'change',()=>{if(readonly(state())||!durationInput.value.trim()||!Number.isFinite(Number(durationInput.value)))return;start('duration-number');const source=doc.getElementById('shot-duration');source.value=durationInput.value;event(source,'change');finish();sync();});
    lengthCard.append(node('p','basic-caption','只改当前镜头，其他镜头不变。'));
    // Keep one real orbit canvas and its native pointer listeners; never draw a clone.
    const orbit=doc.getElementById('camera-orb'),sphere=orbit?.closest('.sphere-cell'),orbitHome=sphere?.parentElement;
    const orbitAnchor=sphere?.nextSibling||null;
    const orbitBox=node('div','basic-orbit-box');
    if(sphere){
      sphere.classList.add('basic-orbit');orbitBox.append(sphere);orbitHome?.classList.add('camera-grid-numeric');
      const oldCaption=sphere.querySelector('.sphere-caption');if(oldCaption)oldCaption.hidden=true;
      orbit.tabIndex=0;bindings.push(()=>{orbit.setAttribute('aria-label',t('拖动球体调整角度，方向键微调'));orbit.title=t('拖动球体调整角度，方向键微调');});
      on(orbit,'pointerdown',e=>{if(e.button!==0)return;if(readonly(state())){e.preventDefault();e.stopImmediatePropagation();return;}start('basic-orbit',!advanced.open);},true);
      on(orbit,'keydown',e=>{const direction={ArrowLeft:['azimuth-slider',-3],ArrowRight:['azimuth-slider',3],ArrowUp:['elevation-slider',3],ArrowDown:['elevation-slider',-3]}[e.key];if(!direction)return;e.preventDefault();if(!start('basic-orbit',!advanced.open))return;const control=doc.getElementById(direction[0]);if(!control||control.disabled)return;control.value=Number(control.value)+direction[1];event(control,'input');sync();});
      const finishOrbit=()=>{if(gesture==='basic-orbit')finish();};on(orbit,'keyup',finishOrbit);on(orbit,'blur',finishOrbit);on(orbit,'lostpointercapture',finishOrbit);
    }
    const level=button('basic-level','回到水平');level.id='basic-level';orbitBox.append(level);on(level,'click',()=>{if(readonly(state()))return;finish();if(!advanced.open)atStart();else pause();doc.querySelector('[data-camera-action="level"]')?.click();sync();});
    framingCard.append(orbitBox,node('p','basic-orbit-hint','拖动小球换角度'));
    range(framingCard,'basic-distance','画面远近','distance-slider',{min:.15,max:20,step:.05,seek:()=>!advanced.open,unit:' m',ends:['拉近','拉远']});
    const framingHint=node('p','basic-caption');framingCard.append(framingHint);
    // Subject framing is an optional advanced helper, not the beginner's camera control.
    const framing=doc.querySelector('.quick-framing'),framingHome=framing?.parentElement,framingAnchor=framing?.nextSibling||null;
    if(framing){const cameraPanel=doc.querySelector('#camera-context .inline-camera');framing.classList.remove('basic-framing');framing.classList.add('advanced-quick-framing');const select=doc.getElementById('framing-preset');const label=node('label','basic-control-label','快速景别');label.htmlFor='framing-preset';framing.insertBefore(label,select);cameraPanel?.insertBefore(framing,doc.getElementById('camera-shortcuts'));}
    const presetGrid=node('div','basic-presets');presetGrid.setAttribute('role','group');presetGrid.setAttribute('aria-label',t('选择简单运镜'));
    for(const [kind,label,description,symbol]of presets){const choice=button('basic-preset'),icon=node('span','basic-preset-icon'),name=node('strong','',label);icon.textContent=symbol;icon.setAttribute('aria-hidden','true');choice.dataset.basicPreset=kind;choice.append(icon,name);choice.title=t(description);bindings.push(()=>choice.title=t(description));presetButtons.push([kind,choice]);presetGrid.append(choice);
      on(choice,'click',()=>{if(readonly(state()))return;finish();if(kind==='fixed'){editor.setStaticCamera?.();sync();return;}const source=doc.querySelector('#motion-presets [data-motion-preset="'+kind+'"]');if(!source||source.disabled)return;atStart();const scopeInput=doc.getElementById('motion-scope');if(scopeInput)scopeInput.value='shot';source.click();sync();});
    }
    const directionRow=node('div','basic-direction-row'),directionLabel=node('span','','运动方向'),directionChoices=node('div','basic-direction-options');directionChoices.setAttribute('role','group');directionChoices.setAttribute('aria-label',t('运动方向'));
    const directionButtons=[];for(const [value,label]of [['1','正向'],['-1','反向']]){const b=button('basic-direction',label);b.dataset.basicDirection=value;directionChoices.append(b);directionButtons.push([value,b]);on(b,'click',()=>{if(readonly(state())||b.disabled)return;const source=doc.getElementById('motion-direction');if(!source||source.disabled)return;const scopeInput=doc.getElementById('motion-scope');if(scopeInput?.value==='shot'&&String(state()?.shot?.motion?.preset_direction)===value)return;finish();pause();if(scopeInput)scopeInput.value='shot';source.value=value;event(source,'change');sync();});}directionRow.append(directionLabel,directionChoices);
    motionCard.append(directionRow,presetGrid);
    const speedBox=node('div','basic-speed'),speedLine=node('div','basic-range-label'),speedLabel=node('label','','运动速度'),speedOutput=node('output'),speedInput=node('input'),speedEnds=node('div','basic-range-ends'),speedHint=node('p','basic-speed-hint');
    speedLabel.htmlFor='basic-motion-speed';speedInput.type='range';speedInput.id='basic-motion-speed';speedInput.min=1;speedInput.max=4;speedInput.step=.05;speedInput.value=1;speedInput.disabled=true;speedOutput.htmlFor='basic-motion-speed';speedHint.id='basic-motion-speed-hint';speedInput.setAttribute('aria-describedby',speedHint.id);speedEnds.append(node('span','','舒缓'),node('span','','快速'));speedLine.append(speedLabel,speedOutput);speedBox.append(speedLine,speedInput,speedEnds,speedHint);motionCard.append(speedBox);
    const speedState=()=>editor.getBasicMotionSpeed?.()||{enabled:false,reason:'unavailable'};
    function beginSpeed(){const current=speedState();if(readonly(state())||!current.enabled)return false;if(gesture!=='basic-motion-speed'){pause();if(!start('basic-motion-speed',false))return false;speedBounds={min:current.min,max:current.max,step:current.step};}return true;}
    const finishSpeed=()=>{if(gesture==='basic-motion-speed')finish();};
    on(speedInput,'pointerdown',beginSpeed);on(speedInput,'keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key))beginSpeed();});
    on(speedInput,'input',()=>{if(!beginSpeed())return;editor.setBasicMotionSpeed?.(Number(speedInput.value));sync();});
    on(speedInput,'change',finishSpeed);on(speedInput,'keyup',finishSpeed);on(speedInput,'blur',finishSpeed);

    const rigRow=node('div','basic-rig-row'),rigLabel=node('span','', '画面感觉'),rigChoices=node('div','basic-rig-options');rigChoices.setAttribute('role','group');rigChoices.setAttribute('aria-label',t('画面感觉'));
    const rigButtons=[];for(const [value,label]of [['none','平稳'],['handheld','轻微手持']]){const b=button('basic-rig',label);b.dataset.basicRig=value;rigChoices.append(b);rigButtons.push([value,b]);on(b,'click',()=>{if(readonly(state()))return;finish();const source=doc.getElementById('rig-preset');if(!source||source.disabled)return;source.value=value;event(source,'change');sync();});}rigRow.append(rigLabel,rigChoices);motionCard.append(rigRow);
    const status=node('p','basic-motion-status');status.setAttribute('role','status');motionCard.append(status);
    on(preview,'click',()=>{if(!state()?.shot||state().sceneOverview)return;finish();const source=doc.getElementById('play');if(!state().playing)editor.seek(0);source?.click();sync();});
    on(doc,'pointerup',finish);on(doc,'pointercancel',finish);
    function layout(){framingHint.textContent=t(advanced.open?'调整当前时刻画面，拖右侧画面可以平移。':'调整开头画面，拖右侧画面可以平移。');doc.body.classList.toggle('beginner-mode',!advanced.open);for(const el of advanced.querySelectorAll('[data-beginner-text]'))el.textContent=t(el.classList.contains('advanced-toggle')?(advanced.open?'收起':'展开'):el.dataset.beginnerText);editor.requestRender?.();}
    on(advanced,'toggle',()=>{finish();layout();});
    function sync(){if(destroyed)return;const s=state(),disabled=readonly(s);host.hidden=Boolean(s?.sceneOverview);host.setAttribute('aria-label',t('基础参数'));
      if(s?.shot?.id!==lastShot){finish();lastShot=s?.shot?.id;}
      for(const {input,output,sourceId,unit}of controls){const source=doc.getElementById(sourceId);if(!source)continue;input.disabled=disabled||source.disabled;input.min=source.min;input.max=source.max;input.step=source.step;
        if(gesture!==input.id)input.value=source.value;const value=Number(input.value);output.textContent=(Number.isFinite(value)?Number(value.toFixed(2)):'—')+unit;input.style.setProperty('--range',((value-Number(input.min))/(Number(input.max)-Number(input.min))*100)+'%');}
      durationInput.disabled=disabled;if(doc.activeElement!==durationInput&&gesture!=='basic-duration')durationInput.value=doc.getElementById('shot-duration')?.value||'';
      preview.disabled=!s?.shot||s.sceneOverview;preview.textContent=t(s?.playing?'暂停播放':'播放看看');preview.setAttribute('aria-label',t(s?.playing?'暂停播放':'播放当前镜头'));
      const kind=s?.shot?.motion?.keys?.length?s.shot.motion_preset:'fixed';for(const [key,b]of presetButtons){b.disabled=disabled||(key==='fixed'&&!editor.setStaticCamera);b.setAttribute('aria-pressed',String(key===kind));}
      level.disabled=disabled;if(orbit){orbit.tabIndex=disabled?-1:0;orbit.setAttribute('aria-disabled',String(disabled));}
      const direction=doc.getElementById('motion-direction');for(const [value,b]of directionButtons){b.disabled=disabled||kind==='fixed'||!s?.shot?.motion_preset||!direction||direction.disabled;b.setAttribute('aria-pressed',String(String(s?.shot?.motion?.preset_direction)===value));b.title=b.disabled?t('请选择运镜预设后切换方向'):t(value==='1'?'按预设方向移动':'沿相反方向移动');}
      const speed=speedState(),rate=Number(speed.rate),move=Number(speed.moveSeconds),hold=Number(speed.holdSeconds);
      speedInput.disabled=disabled||!speed.enabled;speedBox.classList.toggle('is-disabled',speedInput.disabled);
      const bounds=gesture==='basic-motion-speed'&&speedBounds?speedBounds:speed;
      const lower=Number.isFinite(Number(bounds.min))?Number(bounds.min):1,upper=Number.isFinite(Number(bounds.max))?Number(bounds.max):4;
      speedInput.min=lower;speedInput.max=Math.max(lower,upper);speedInput.step=Number(bounds.step)||.05;
      if(gesture!=='basic-motion-speed'||speedInput.disabled)speedInput.value=Number.isFinite(rate)?rate:lower;
      speedOutput.textContent=Number.isFinite(rate)?Number(rate.toFixed(2))+'×':'—';
      speedInput.style.setProperty('--range',Math.max(0,Math.min(100,(Number(speedInput.value)-lower)/Math.max(.0001,upper-lower)*100))+'%');
      const speedVars={rate:Number.isFinite(rate)?Number(rate.toFixed(2)):0,move:Number.isFinite(move)?Number(move.toFixed(2)):0,hold:Number.isFinite(hold)?Number(hold.toFixed(2)):0};
      const speedReason=!s?.shot?'unavailable':disabled?'readonly':speed.reason;
      speedHint.textContent=speedInput.disabled?t(speedMessages[speedReason]||speedMessages.custom):t('运动 {move} 秒 · 末尾停留 {hold} 秒',speedVars);
      speedInput.setAttribute('aria-valuetext',speedInput.disabled?speedHint.textContent:t('{rate} 倍，运动 {move} 秒，末尾停留 {hold} 秒',speedVars));
      const rig=s?.shot?.camera_effect?.type||'none';for(const [value,b]of rigButtons){b.disabled=disabled;b.setAttribute('aria-pressed',String(rig===value));}
      status.textContent=t(s?.shot?.motion?.keys?.length&&!presets.some(p=>p[0]===kind)?'已保留原运镜；选预设会替换本镜路线。':'选择预设会替换本镜路线，可随时还原。');
    }
    on(scope,'stage-language-change',()=>{for(const update of bindings)update();durationInput.setAttribute('aria-label',t('这一镜的时长'));presetGrid.setAttribute('aria-label',t('选择简单运镜'));rigChoices.setAttribute('aria-label',t('画面感觉'));directionChoices.setAttribute('aria-label',t('运动方向'));layout();sync();});
    const unsubscribe=editor.subscribe?.(sync);for(const update of bindings)update();layout();sync();
    return {sync,destroy(){finish();destroyed=true;unsubscribe?.();listeners.forEach(off=>off());doc.body.classList.remove('beginner-mode');if(sphere&&orbitHome){orbitHome.insertBefore(sphere,orbitAnchor);sphere.classList.remove('basic-orbit');orbitHome.classList.remove('camera-grid-numeric');const caption=sphere.querySelector('.sphere-caption');if(caption)caption.hidden=false;}if(framing&&framingHome){framingHome.insertBefore(framing,framingAnchor);framing.classList.remove('advanced-quick-framing');framing.querySelector('.basic-control-label')?.remove();}}};
  }
  scope.StageBeginner={create,presets,speedMessages};
  if(scope.document){let mounted=false;const connect=()=>{if(mounted||!scope.stageEditor)return;mounted=true;scope.stageBeginner=create(scope.document,scope.stageEditor);};scope.addEventListener('stage-editor-ready',connect);if(scope.document.readyState==='loading')scope.document.addEventListener('DOMContentLoaded',connect,{once:true});connect();}
})(typeof window!=='undefined'?window:globalThis);
