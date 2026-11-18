/* Deterministic subject states. Geometry is evaluated from authored data at each time. */
(function(scope){
  "use strict";
  const t=(source,vars)=>scope.StageI18n?.t(source,vars)??String(source).replace(/\{(\w+)\}/g,(all,key)=>vars?.[key]??all);
  const types=["show","hide","teleport","jump","shake","fall","rise","break","restore"];
  const timed=["jump","shake","fall","rise","break"];
  const clone=value=>JSON.parse(JSON.stringify(value));
  function fragmentId(sourceId,eventId,index){let hash=14695981039346656037n;for(const byte of new TextEncoder().encode(sourceId+"|"+eventId))hash=((hash^BigInt(byte))*1099511628211n)&0xffffffffffffffffn;return "statefrag_"+hash.toString(16).padStart(16,"0")+"_"+index;}
  const finite=(value,label,low=0,high=3600)=>{if(typeof value!=="number"||!Number.isFinite(value)||value<low||value>high)throw Error(label+t(" 超出范围"));return value;};
  function validateEvents(objects,events,total){
    if(!events||typeof events!=="object"||Array.isArray(events))throw Error(t("状态事件必须按主体保存"));
    finite(total,t("镜头长度"),.1,30);
    const byId=new Map(objects.map(o=>[o.id,o])),result={},groups=new Set(),ids=new Set();
    if(Object.values(events).reduce((n,v)=>n+(Array.isArray(v)?v.length:1000),0)>96)throw Error(t("一镜最多 96 个状态事件"));
    for(const [objectId,entries] of Object.entries(events)){
      if(!byId.has(objectId)||!Array.isArray(entries))throw Error(t("状态主体不存在"));
      const root=byId.get(objectId),group=root.actor_id||objectId;
      if(entries.length&&groups.has(group))throw Error(t("同一人物的状态应记录在一个主体上"));
      if(entries.length)groups.add(group);
      result[objectId]=entries.map(event=>{
        if(!event||typeof event!=="object"||Array.isArray(event)||Object.keys(event).some(k=>!["id","type","at_s","duration_s","height_m","offset","seed"].includes(k)))throw Error(t("状态字段无效"));
        if(typeof event.id!=="string"||!event.id||event.id.length>80||ids.has(event.id)||/[\x00-\x1f]/.test(event.id))throw Error(t("状态标识无效"));
        ids.add(event.id);if(!types.includes(event.type))throw Error(t("不支持的主体状态"));
        const item=clone(event);finite(item.at_s,t("状态时刻"),0,total);
        if(timed.includes(item.type)){item.duration_s=finite(item.duration_s??.8,t("动作时长"),.001,30);if(item.at_s+item.duration_s>total+1e-7)throw Error(t("动作需要在镜头内结束"));}
        if(["jump","shake"].includes(item.type))item.height_m=finite(item.height_m??(item.type==="jump"?1:.06),t("动作幅度"),0,10);
        if(item.type==="teleport"){if(!Array.isArray(item.offset)||item.offset.length!==3)throw Error(t("瞬移需要三轴位移"));item.offset.forEach(v=>finite(v,t("瞬移位移"),-1000,1000));}
        if(item.seed!==undefined&&!Number.isSafeInteger(item.seed))throw Error(t("状态种子必须是整数"));
        return item;
      }).sort((a,b)=>a.at_s-b.at_s);
    }
    return result;
  }
  function rotateLocal(point,pitch=0,roll=0,yaw=0){
    let [x,y,z]=point;const a=pitch*Math.PI/180,b=roll*Math.PI/180,c=yaw*Math.PI/180;
    [y,z]=[Math.cos(a)*y-Math.sin(a)*z,Math.sin(a)*y+Math.cos(a)*z];
    [x,y]=[Math.cos(b)*x-Math.sin(b)*y,Math.sin(b)*x+Math.cos(b)*y];
    return [Math.cos(c)*x+Math.sin(c)*z,y,Math.cos(c)*z-Math.sin(c)*x];
  }
  const smooth=value=>{value=Math.max(0,Math.min(1,value));return value*value*(3-2*value);};
  const angleAt=(transition,seconds)=>transition?transition[2]+(transition[3]-transition[2])*smooth((seconds-transition[0])/transition[1]):0;
  function stateAt(entries,seconds){
    let visible=null,broken=null,transition=null,offset=[0,0,0],temporary=[0,0,0];
    for(const event of entries){
      const at=event.at_s,kind=event.type;if(at>seconds+1e-9)break;
      if(kind==="show")visible=true;
      else if(kind==="hide")visible=false;
      else if(kind==="restore"){visible=true;broken=null;}
      else if(kind==="break")broken=event;
      else if(kind==="teleport")offset=offset.map((v,i)=>v+event.offset[i]);
      else if(kind==="fall"||kind==="rise")transition=[at,event.duration_s??.8,angleAt(transition,at),kind==="fall"?90:0];
      else if(kind==="jump"||kind==="shake"){
        const u=(seconds-at)/(event.duration_s??.8);
        if(u>=0&&u<1){
          const amplitude=event.height_m??(kind==="jump"?1:.06);
          if(kind==="jump")temporary[1]+=amplitude*4*u*(1-u);
          else{const phase=(((event.seed??0)%1024)+1024)%1024*2*Math.PI/1024;[7,9,6].forEach((cycles,i)=>temporary[i]+=amplitude*Math.sin(Math.PI*u)*Math.sin(2*Math.PI*cycles*u+phase+i));}
        }
      }
    }
    return {visible,broken,angle:angleAt(transition,seconds),offset:offset.map((v,i)=>v+temporary[i])};
  }
  function sampleScene(objects,events,seconds){
    if(!events||!Object.keys(events).length)return objects;
    const byId=new Map(objects.map(o=>[o.id,o])),assignments=new Map(),result=[];
    for(const [objectId,entries] of Object.entries(events)){
      const root=byId.get(objectId);if(!root||!entries?.length)continue;
      const group=root.actor_id,state=stateAt([...entries].sort((a,b)=>a.at_s-b.at_s),seconds);
      for(const member of objects)if(member.id===objectId||(group&&member.actor_id===group))assignments.set(member.id,[root,state]);
    }
    for(const original of objects){
      if(!assignments.has(original.id)){result.push(original);continue;}
      const [root,state]=assignments.get(original.id),obj=clone(original);
      let center=[obj.position[0],obj.position[1]+obj.size[1]/2,obj.position[2]];
      const pivot=root.position;
      let relative=rotateLocal(center.map((v,i)=>v-pivot[i]),0,0,-(root.yaw_deg||0));
      relative=rotateLocal(relative,state.angle,0,root.yaw_deg||0);
      const lift=Math.min(root.size[0],root.size[2])*.5*Math.sin(state.angle*Math.PI/180);
      center=relative.map((v,i)=>v+pivot[i]+state.offset[i]+(i===1?lift:0));
      obj.position=[center[0],center[1]-obj.size[1]/2,center[2]];
      if(state.angle)obj.pitch_deg=(obj.pitch_deg||0)+state.angle;
      if(state.visible!==null)obj.hidden=!state.visible;
      const broken=state.broken;if(broken)obj.hidden=true;result.push(obj);
      if(!broken||state.visible===false||(original.hidden&&state.visible!==true))continue;
      const u=(seconds-broken.at_s)/(broken.duration_s??.8);if(u<0||u>=1)continue;
      const seed=broken.seed??0;
      for(let index=0;index<6;index++){
        const col=index%2,row=Math.floor(index/2);
        let offset=[(col-.5)*obj.size[0]/2,(row-1)*obj.size[1]/3,0];
        offset=rotateLocal(offset,obj.pitch_deg||0,obj.roll_deg||0,obj.yaw_deg||0);
        const phase=(index+1)*2.399963229728653+(((seed%997)+997)%997)*.017;
        const drift=[Math.cos(phase)*u*.8,Math.sin(phase*.7)*u*.55-1.8*u*u,Math.sin(phase)*u*.8];
        const size=[Math.max(.001,obj.size[0]*.44),Math.max(.001,obj.size[1]*.29),Math.max(.001,obj.size[2]*.9)];
        const fc=center.map((v,i)=>v+offset[i]+drift[i]);
        result.push({id:fragmentId(original.id,broken.id,index),state_source_id:original.id,shape:"box",color:original.color||"#aab6c6",
          position:[fc[0],Math.max(0,fc[1]-size[1]/2),fc[2]],size,yaw_deg:(obj.yaw_deg||0)+u*90*Math.sin(phase),pitch_deg:(obj.pitch_deg||0)+u*100*Math.cos(phase),roll_deg:u*70*Math.sin(phase+1)});
      }
    }
    return result;
  }
  const api={types,timed,validateEvents,sampleScene,rotateLocal,stateAt,fragmentId};
  scope.StageStates=api;if(typeof module!=="undefined")module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
