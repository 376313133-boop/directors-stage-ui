const t=(source,vars)=>window.StageI18n?.t(source,vars)??String(source).replace(/\{(\w+)\}/g,(all,key)=>vars?.[key]??all);
  const bind=(node,key,render)=>{if(window.StagePanelI18n)return window.StagePanelI18n.bind(node,key,render);const value=render();if(key.startsWith('@'))node.setAttribute(key.slice(1),value);else node[key]=value;};
  const sourceText=value=>window.StagePanelI18n?.source(value)??value;
const selector=document.getElementById('stage-view'),host=document.getElementById('stage-view-options');
if(selector&&host){
  const buttons=[...selector.options].map(option=>{
    const button=document.createElement('button');button.type='button';bind(button, 'textContent', ()=>t(option.textContent));
    button.dataset.stageMode=option.value;
    button.addEventListener('click',()=>{selector.value=option.value;selector.dispatchEvent(new Event('change',{bubbles:true}));sync();});
    host.append(button);return button;
  });
  function sync(){
    for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.stageMode===selector.value));
    const caption=document.getElementById('stage-view-caption');
    if(caption)bind(caption, 'textContent', ()=>selector.value==='top2d'?t('平面布局'):t('观察视角'));
  }
  selector.addEventListener('change',sync);window.addEventListener('stage-view-mode',sync);window.addEventListener('stage-language-change',sync);sync();
}
