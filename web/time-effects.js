/* Subject-only time mapping. Camera and output frame clocks remain independent. */
(function(scope){
  "use strict";
  const t=(source,vars)=>scope.StageI18n?.t(source,vars)??String(source).replace(/\{(\w+)\}/g,(all,key)=>vars?.[key]??all);
  const finite=(value,label)=>{
    if(typeof value!=="number"||!Number.isFinite(value))throw Error(label+t(" 必须是有限数字"));
    return value;
  };
  function durationSeconds(shot){
    const has=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
    const total=finite(has(shot,"duration_s")?shot.duration_s:(shot.motion&&has(shot.motion,"duration_s")?shot.motion.duration_s:4),t("镜头长度"));
    if(total<.1||total>30)throw Error(t("镜头长度超出范围"));
    return total;
  }
  function validateEffect(shot){
    if(!shot||typeof shot!=="object"||Array.isArray(shot))throw Error(t("镜头数据无效"));
    if(!Object.prototype.hasOwnProperty.call(shot,"time_effect"))return null;
    const effect=shot.time_effect,total=durationSeconds(shot);
    if(!effect||typeof effect!=="object"||Array.isArray(effect)||
       Object.keys(effect).some(k=>!["mode","at_s","rate"].includes(k)))throw Error(t("主体时间字段无效"));
    if(!["freeze","slow"].includes(effect.mode))throw Error(t("不支持的主体时间效果"));
    if(finite(effect.at_s,t("主体源时刻"))<0||effect.at_s>total)throw Error(t("主体源时刻超出镜头"));
    if(effect.mode==="slow"){
      if(finite(effect.rate,t("主体速度"))<.01||effect.rate>1)throw Error(t("主体速度应在 0.01 到 1 之间"));
    }else if(Object.prototype.hasOwnProperty.call(effect,"rate"))throw Error(t("冻结主体不应包含速度"));
    return effect;
  }
  function sampleSeconds(shot,seconds){
    finite(seconds,t("输出时刻"));
    const effect=validateEffect(shot);
    if(!effect)return seconds;
    if(effect.mode==="freeze")return effect.at_s;
    return Math.max(0,Math.min(durationSeconds(shot),effect.at_s+seconds*effect.rate));
  }
  const api={sampleSeconds,validateEffect,durationSeconds};
  scope.StageTime=api;if(typeof module!=="undefined")module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
