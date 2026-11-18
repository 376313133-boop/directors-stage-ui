/* Deterministic camera recipes. Every recipe expands to ordinary editable keys. */
(function(scope){
  'use strict';
  const t=(source,vars)=>scope.StageI18n?.t(source,vars)??String(source).replace(/\{(\w+)\}/g,(all,key)=>vars?.[key]??all);
  const definitions={
    hitchcock_dolly_zoom:{name:t('希区柯克推拉变焦'),detail:t('推近同时减焦 主体大小近似不变'),scope:t('当前一段或整镜'),unit:'m',label:t('移动距离'),min:.1,max:10,step:.05,value:1},
    reaction_push:{name:t('反应慢推'),detail:t('克制地靠近角色 逐步收紧情绪'),inspiration:t('斯皮尔伯格灵感'),scope:t('当前一段或整镜'),unit:'m',label:t('推进距离'),min:.1,max:5,step:.05,value:.7},
    axial_push:{name:t('中轴跟进'),detail:t('沿视线直推 注视点保持居中'),inspiration:t('库布里克灵感'),scope:t('当前一段或整镜'),unit:'m',label:t('推进距离'),min:.1,max:8,step:.05,value:1.2},
    hero_orbit:{orbit:true,name:t('低角度英雄环绕'),detail:t('低机位绕主体约 120° 展示气势'),inspiration:t('迈克尔·贝灵感'),scope:t('当前一段或整镜'),unit:'°',label:t('环绕角度'),min:15,max:240,step:1,value:120},
    bullet_time:{orbit:true,name:t('子弹时间'),detail:t('主体以 0.1 倍动作 摄影机正常弧绕'),scope:t('仅整镜 · 主体从 0 秒慢放'),wholeShot:true,unit:'°',label:t('环绕角度'),min:30,max:360,step:1,value:180},
    freeze_orbit:{orbit:true,name:t('时间冻结 360°'),detail:t('冻结当前可见姿态 摄影机完整绕一圈'),scope:t('仅整镜 · 冻结所有主体'),wholeShot:true,unit:'°',label:t('完整一圈'),min:360,max:360,step:1,value:360,fixedTravel:true},
    whip_pan:{name:t('快速甩镜'),detail:t('原地快速转向约 120° 两端保留停留'),scope:t('当前一段或整镜'),unit:'°',label:t('转向角度'),min:30,max:170,step:1,value:120,moveSeconds:.32},
    roll_through:{name:t('滚转穿越'),detail:t('沿视线前进 同时连续滚转 360°'),scope:t('当前一段或整镜'),unit:'m',label:t('穿越距离'),min:.1,max:10,step:.05,value:2}
  };
scope.StagePanelI18n?.live(definitions);
  const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
  const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,k)=>a.map(v=>v*k);
  const unit=a=>mul(a,1/Math.max(.000001,Math.hypot(...a)));
  const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
  const clean=a=>a.map(v=>Number(v.toFixed(6)));
  const rotate=([x,y,z],degrees)=>{const a=degrees*Math.PI/180;return [x*Math.cos(a)+z*Math.sin(a),y,z*Math.cos(a)-x*Math.sin(a)];};
  function recommendRadius(camera,objects=[]){
    const offset=sub(camera.position,camera.target),horizontal=Math.hypot(offset[0],offset[2]);
    const sourceRadius=Math.max(.25,horizontal<.05?Math.hypot(...offset):horizontal);
    let radius=sourceRadius;
    for(const object of objects){
      const size=object.size;
      if(object.hidden||object.shape!=='box'||!Array.isArray(size)||!Array.isArray(object.position))continue;
      const thin=Math.min(size[0],size[2]),long=Math.max(size[0],size[2]);
      // Only obvious thin, tall walls participate; props and general obstacles stay real.
      if(size[1]<1.5||thin>.6||long<1.5||long/Math.max(.001,thin)<4||object.pitch_deg||object.roll_deg)continue;
      const local=rotate(sub(camera.target,object.position),-(object.yaw_deg||0));
      const clearance=Math.hypot(Math.max(0,Math.abs(local[0])-size[0]/2),Math.max(0,Math.abs(local[2])-size[2]/2));
      radius=Math.min(radius,Math.max(.25,clearance-.25));
    }
    return {radius:Number(radius.toFixed(6)),sourceRadius,limited:radius<sourceRadius-.001};
  }
  function create(kind,{camera,travel,direction=1,seconds,totalSeconds,focus,freezeAt=0,radius}){
    const definition=definitions[kind];if(!definition)return null;
    const total=Math.max(.001,Number(totalSeconds)||4),moving=clamp(Number(seconds)||total,.001,total);
    const amplitude=clamp(Number(travel)||definition.value,definition.min,definition.max),sign=direction<0?-1:1;
    const pos=[...camera.position],target=[...camera.target],ray=sub(target,pos),distance=Math.hypot(...ray),toward=unit(ray);
    const lens=Number(camera.focal_mm)||35,roll=Number(camera.roll_deg)||0;
    const keys=[],entry=(t,position=pos,aim=target,focal=lens,angle=roll)=>keys.push({t:Number(t.toFixed(8)),position:clean(position),target:clean(aim),focal_mm:Number(focal.toFixed(6)),roll_deg:Number(angle.toFixed(6))});
    let actual=amplitude,arrival=false;
    if(kind==='hitchcock_dolly_zoom'){
      // Stay inside the supported lens range while preserving focal/distance ratio.
      const signed=clamp(sign*amplitude,distance*(1-300/lens),distance*(1-5/lens));actual=Math.abs(signed);
      entry(0);entry(1,add(pos,mul(toward,signed)),target,lens*(distance-signed)/distance);
    }else if(kind==='reaction_push'||kind==='axial_push'){
      const signed=sign*Math.min(amplitude,sign>0?distance*.8:amplitude);actual=Math.abs(signed);
      entry(0);
      if(kind==='reaction_push'){
        const aim=Array.isArray(focus)?focus:target;
        for(const [t,f] of [[.4,.15],[.75,.65],[1,1]])entry(t,add(pos,mul(toward,signed*f)),lerp(target,aim,f*.6));
      }else entry(1,add(pos,mul(toward,signed)),target);
    }else if(['hero_orbit','bullet_time','freeze_orbit'].includes(kind)){
      const original=sub(pos,target),horizontal=Math.hypot(original[0],original[2]);
      const orbitRadius=Number.isFinite(radius)?Math.max(.25,radius):Math.max(.5,horizontal<.05?distance:horizontal);
      const heading=horizontal<.05?[0,0,1]:unit([original[0],0,original[2]]);
      const height=kind==='hero_orbit'?Math.max(.15,Math.min(.6,target[1]-.35))-target[1]:original[1];
      const offset=[heading[0]*orbitRadius,height,heading[2]*orbitRadius];
      const steps=Math.max(8,Math.ceil(amplitude/30));
      for(let i=0;i<=steps;i++){const t=i/steps;entry(t,add(target,rotate(offset,sign*amplitude*t)),target);}
    }else if(kind==='whip_pan'){
      // Arrival timing preserves the entire selected interval around the quick turn.
      arrival=true;const hold=(total-moving)/2;
      entry(0);keys[0].hold_s=hold;
      for(let i=1;i<=8;i++)entry((hold+moving*i/8)/total,pos,add(pos,rotate(ray,sign*amplitude*i/8)));
    }else if(kind==='roll_through'){
      for(let i=0;i<=8;i++){const t=i/8,offset=mul(toward,sign*amplitude*t);entry(t,add(pos,offset),add(target,offset),lens,roll+sign*360*t);}
    }
    const motion={duration_s:arrival?total:moving,ease:kind==='axial_push'?'linear':'smooth',keys};
    if(arrival)motion.timing_mode='arrival';
    const timeEffect=kind==='freeze_orbit'?{mode:'freeze',at_s:clamp(Number(freezeAt)||0,0,total)}:kind==='bullet_time'?{mode:'slow',at_s:0,rate:.1}:undefined;
    return {motion,actualTravel:actual,...(timeEffect?{timeEffect}:{})};
  }
  scope.StageCinema={definitions,create,recommendRadius};
  if(typeof module==='object'&&module.exports)module.exports=scope.StageCinema;
})(typeof window==='object'?window:globalThis);
