/* Lightweight 3D stage. Observation is independent of the take camera; edits use the editor's trial APIs. */
(function(scope){
  'use strict';
  const t=(source,vars)=>scope.StageI18n?.t(source,vars)??String(source).replace(/\{(\w+)\}/g,(all,key)=>vars?.[key]??all);
  const bind=(node,key,render)=>{if(scope.StagePanelI18n)return scope.StagePanelI18n.bind(node,key,render);const value=render();if(key.startsWith('@'))node.setAttribute(key.slice(1),value);else node[key]=value;};
  const sourceText=value=>scope.StagePanelI18n?.source(value)??value;
  const demoText=value=>scope.StageI18n?.demoText(value)??value;
  const rad=Math.PI/180,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const mul=(a,k)=>a.map(v=>v*k),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const unit=a=>mul(a,1/Math.max(1e-9,Math.hypot(...a)));
  const finitePoint=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
  const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
  const modes=['free','top2d','front','back','left','right','top'];
  function rotate(point,pitch=0,roll=0,yaw=0){
    let [x,y,z]=point;const a=pitch*rad,b=roll*rad,c=yaw*rad;
    [y,z]=[Math.cos(a)*y-Math.sin(a)*z,Math.sin(a)*y+Math.cos(a)*z];
    [x,y]=[Math.cos(b)*x-Math.sin(b)*y,Math.sin(b)*x+Math.cos(b)*y];
    return [Math.cos(c)*x+Math.sin(c)*z,y,Math.cos(c)*z-Math.sin(c)*x];
  }
  function bounds(objects){
    const visible=(objects||[]).filter(o=>!o.hidden&&finitePoint(o.position)&&finitePoint(o.size));
    if(!visible.length)return {center:[0,.8,0],radius:2,extent:4};
    const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];
    for(const o of visible)for(const p of worldGeometry(o,false).corners){
      p.forEach((v,i)=>{low[i]=Math.min(low[i],v);high[i]=Math.max(high[i],v);});
    }
    const center=low.map((v,i)=>(v+high[i])/2),radius=Math.max(.5,Math.hypot(...sub(high,low))/2);
    return {center,radius,extent:Math.max(4,radius*2)};
  }
  function orbitCamera(pose){
    const a=pose.yaw*rad,e=pose.pitch*rad,d=pose.distance;
    return {position:add(pose.target,[d*Math.cos(e)*Math.sin(a),d*Math.sin(e),d*Math.cos(e)*Math.cos(a)]),target:[...pose.target],focal_mm:35,sensor_width_mm:36,roll_deg:0,lens_model:'perspective'};
  }
  function fitPose(objects,mode='free',aspect=16/9){
    const b=bounds(objects),view={free:[42,32],front:[0,0],back:[180,0],left:[-90,0],right:[90,0],top:[0,90]}[mode]||[42,32];
    const pose={target:[...b.center],distance:1,yaw:view[0],pitch:view[1]},basis=axes(orbitCamera(pose));
    const safeAspect=Number.isFinite(aspect)&&aspect>0?aspect:16/9,tanX=36/2/35,tanY=tanX/safeAspect,margin=1.12;
    const visible=(objects||[]).filter(o=>!o.hidden&&finitePoint(o.position)&&finitePoint(o.size));
    const points=visible.length?visible.flatMap(o=>worldGeometry(o,false).corners):objectCorners({position:[0,0,0],size:[2,1.6,2]});
    // Solve the perspective constraints for the actual corners, not a padded bounding sphere.
    // Camera depth is d + dot(point - target, forward); each corner must clear both frame axes and near clipping.
    let distance=.2;
    for(const point of points){
      const q=sub(point,pose.target),z=dot(q,basis.forward);
      distance=Math.max(distance,margin*Math.abs(dot(q,basis.right))/tanX-z,margin*Math.abs(dot(q,basis.up))/tanY-z,.05-z);
    }
    return {...pose,distance};
  }
  function axes(camera){
    const forward=unit(sub(camera.target,camera.position));
    const right=unit(cross(forward,Math.abs(forward[1])>.999999?[0,0,-1]:[0,1,0]));
    return {forward,right,up:cross(right,forward)};
  }
  function projectPoint(point,camera,width,height){
    const basis=axes(camera),p=sub(point,camera.position),z=dot(p,basis.forward);
    if(z<=.04)return null;
    const f=width*(camera.focal_mm||35)/(camera.sensor_width_mm||36);
    return [width/2+dot(p,basis.right)*f/z,height/2-dot(p,basis.up)*f/z,z];
  }
  function panPose(pose,dx,dy,width){
    const camera=orbitCamera(pose),basis=axes(camera),step=pose.distance*36/35/Math.max(1,width);
    return {...pose,target:add(pose.target,add(mul(basis.right,-dx*step),mul(basis.up,dy*step)))};
  }
  function orbitPose(pose,dx,dy){return {...pose,target:[...pose.target],yaw:pose.yaw-dx*.35,pitch:clamp(pose.pitch+dy*.35,-89.5,89.5)};}
  function zoomPose(pose,delta){return {...pose,target:[...pose.target],distance:clamp(pose.distance*Math.exp(clamp(delta,-1000,1000)*.001),.08,5000)};}
  const cache={};
  function mesh(shape){
    if(cache[shape])return cache[shape];const faces=[];
    if(shape==='cylinder'){
      const top=[],bottom=[];for(let i=0;i<12;i++){const a=i*Math.PI/6;top.push([Math.cos(a)/2,.5,Math.sin(a)/2]);bottom.push([Math.cos(a)/2,-.5,Math.sin(a)/2]);}
      faces.push(top,bottom);for(let i=0;i<12;i++)faces.push([bottom[i],top[i],top[(i+1)%12],bottom[(i+1)%12]]);
    }else if(shape==='sphere'){
      const v=(r,c)=>{const a=(r/6-.5)*Math.PI,b=c*Math.PI/6;return [Math.cos(a)*Math.cos(b)/2,Math.sin(a)/2,Math.cos(a)*Math.sin(b)/2];};
      for(let r=0;r<6;r++)for(let i=0;i<12;i++){const a=v(r,i),b=v(r+1,i),c=v(r+1,i+1),d=v(r,i+1);faces.push(r===0?[a,b,c]:r===5?[a,b,d]:[a,b,c,d]);}
    }else{
      const v=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(p=>mul(p,.5));
      for(const idx of [[3,2,1,0],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]])faces.push(idx.map(i=>v[i]));
    }
    cache[shape]=faces;return faces;
  }
  function displayState(state){return {...state,plan:state?.displayPlan||state?.plan,scene:state?.displayScene||state?.scene,shot:state?.displayShot||state?.shot,resolvedObjects:state?.displayObjects||state?.resolvedObjects};}
  function objectCorners(o){
    const center=add(o.position,[0,o.size[1]/2,0]),points=[];
    for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5])points.push(add(center,rotate([x*o.size[0],y*o.size[1],z*o.size[2]],o.pitch_deg,o.roll_deg,o.yaw_deg)));
    return points;
  }
  // Geometry is independent of the observation camera. Reuse transformed
  // vertices for orbiting/hover picking, with value-based invalidation because
  // authored objects and their arrays may be updated in place during a drag.
  const worldGeometryCache=new Map();
  function worldGeometry(o,includeFaces=true){
    const key=o.id||o,signature=[o.shape,...o.position,...o.size,o.pitch_deg||0,o.roll_deg||0,o.yaw_deg||0].join('|');
    const previous=worldGeometryCache.get(key),same=previous?.signature===signature;
    if(same&&(!includeFaces||previous.faces))return previous;
    const center=same?previous.center:add(o.position,[0,o.size[1]/2,0]);
    const value=same?previous:{signature,center,corners:objectCorners(o)};
    if(includeFaces)value.faces=mesh(o.shape).map(face=>{
      const points=face.map(p=>add(center,rotate(p.map((v,i)=>v*o.size[i]),o.pitch_deg,o.roll_deg,o.yaw_deg)));
      let normal=cross(sub(points[1],points[0]),sub(points[2],points[0]));
      if(dot(normal,sub(points[0],center))<0)normal=mul(normal,-1);
      return {points,normal};
    });
    if(!worldGeometryCache.has(key)&&worldGeometryCache.size>=1024)worldGeometryCache.delete(worldGeometryCache.keys().next().value);
    worldGeometryCache.set(key,value);return value;
  }
  function isWall(o){return o.shape==='box'&&!o.actor_id&&(/wall|墙|门框|门梁/i.test(o.id+' '+(o.label||''))||(o.size[1]>.9&&Math.max(o.size[0],o.size[2])>2&&Math.min(o.size[0],o.size[2])<.3));}
  function rayAt(x,y,camera,width,height){
    if(!(width>0&&height>0))return null;
    const a=axes(camera),f=width*(camera.focal_mm||35)/(camera.sensor_width_mm||36);
    return {origin:[...camera.position],direction:unit(add(a.forward,add(mul(a.right,(x-width/2)/f),mul(a.up,(height/2-y)/f))))};
  }
  function groundPoint(ray,y=0){
    if(!ray||Math.abs(ray.direction[1])<1e-6)return null;
    const t=(y-ray.origin[1])/ray.direction[1];if(t<=.04||t>10000)return null;
    const p=add(ray.origin,mul(ray.direction,t));return finitePoint(p)&&p.every(v=>Math.abs(v)<=1000)?p:null;
  }
  function rayTriangle(ray,a,b,c){
    const e1=sub(b,a),e2=sub(c,a),h=cross(ray.direction,e2),det=dot(e1,h);
    if(Math.abs(det)<1e-8)return null;const inv=1/det,s=sub(ray.origin,a),u=inv*dot(s,h);if(u<0||u>1)return null;
    const q=cross(s,e1),v=inv*dot(ray.direction,q);if(v<0||u+v>1)return null;
    const t=inv*dot(e2,q);return t>.04?t:null;
  }
  function rootId(object,source){
    let current=source.find(o=>o.id===(object.state_source_id||object.id))||object;
    for(let i=0;i<12;i++){
      const parent=source.find(o=>o.id===(current.parent_id||current.actor_id)&&o.id!==current.id)||
        (current.actor_id&&source.find(o=>o.actor_id===current.actor_id&&!o.parent_id&&!o.id.endsWith('_head')&&o.id!==current.id));
      if(!parent)break;current=parent;
    }
    return current.id;
  }
  function pickObject(ray,objects,source=objects,transparentWalls=false){
    if(!ray)return null;const hits=[];
    for(const o of objects||[]){
      if(o.hidden||!finitePoint(o.position)||!finitePoint(o.size))continue;
      let distance=Infinity;
      for(const {points} of worldGeometry(o).faces){
        for(let i=1;i<points.length-1;i++){const t=rayTriangle(ray,points[0],points[i],points[i+1]);if(t!==null)distance=Math.min(distance,t);}
      }
      if(Number.isFinite(distance))hits.push({id:rootId(o,source),objectId:o.id,distance,wall:isWall(o)});
    }
    hits.sort((a,b)=>a.distance-b.distance);
    return transparentWalls?(hits.find(h=>!h.wall)||hits[0]||null):(hits[0]||null);
  }
  function canvasSize(canvas){
    const wrapper=canvas.parentElement,w=wrapper.clientWidth,h=wrapper.clientHeight;
    return {width:Math.max(1,w),height:Math.max(1,h),aspect:Math.max(1,w)/Math.max(1,h),visible:w>0&&h>0&&!wrapper.hidden};
  }
  function placementObjects(placement){
    if(placement?.status!=='placing'||!placement.spec||!finitePoint(placement.position))return [];
    try{return scope.StageGeometry?.makeObjects(placement.spec,placement.position,'user_geo_placement_preview')?.objects||[{id:'placement-preview',shape:placement.spec.kind==='person'?'cylinder':placement.spec.kind,position:placement.position,size:placement.spec.size,color:placement.spec.color||'#b9d5c4'}];}catch{return [];}
  }
  function clipped(points){
    if(!points.length)return [];const result=[];let prev=points.at(-1);
    for(const p of points){if((prev[2]>=.04)!==(p[2]>=.04))result.push(mix(prev,p,(.04-prev[2])/(p[2]-prev[2])));if(p[2]>=.04)result.push(p);prev=p;}
    return result;
  }
  function render(canvas,input,camera,activeCamera,focusId,options={}){
    const state=displayState(input),{width,height,visible}=canvasSize(canvas);if(!visible)return false;
    const ratio=Math.min(2,scope.devicePixelRatio||1,1600/width,1200/height),ctx=canvas.getContext('2d');
    canvas.style.width=width+'px';canvas.style.height=height+'px';
    if(canvas.width!==Math.round(width*ratio)||canvas.height!==Math.round(height*ratio)){canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);}
    ctx.setTransform(ratio,0,0,ratio,0,0);ctx.globalAlpha=1;ctx.fillStyle='#151a1d';ctx.fillRect(0,0,width,height);
    const objects=state.resolvedObjects||state.scene?.objects||[],stage=state.scene||{},basis=axes(camera),f=width*(camera.focal_mm||35)/36;
    const local=p=>{const v=sub(p,camera.position);return [dot(v,basis.right),dot(v,basis.up),dot(v,basis.forward)];};
    const screen=p=>[width/2+p[0]*f/p[2],height/2-p[1]*f/p[2]];
    const fill=(points,color,alpha=1)=>{if(points.length<3)return;ctx.beginPath();points.map(screen).forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();ctx.fillStyle=color;ctx.globalAlpha=alpha;ctx.fill();ctx.globalAlpha=1;};
    const b=bounds(objects),g=Math.max(8,b.extent*1.5),cx=b.center[0],cz=b.center[2];
    const line=(a,b,color,lineWidth=1,dash=[])=>{
      let p=local(a),q=local(b);if(p[2]<.04&&q[2]<.04)return;if(p[2]<.04)p=mix(p,q,(.04-p[2])/(q[2]-p[2]));if(q[2]<.04)q=mix(q,p,(.04-q[2])/(p[2]-q[2]));
      ctx.beginPath();ctx.moveTo(...screen(p));ctx.lineTo(...screen(q));ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);
    };
    if(stage.ground!==false){
      fill(clipped([[-g+cx,0,-g+cz],[g+cx,0,-g+cz],[g+cx,0,g+cz],[-g+cx,0,g+cz]].map(local)),'#222a2c');
      const step=Math.max(.5,10**Math.floor(Math.log10(g/12)));for(let n=-Math.ceil(g/step);n<=Math.ceil(g/step);n++){const v=n*step;line([-g+cx,.001,v+cz],[g+cx,.001,v+cz],'#d4e9dd13');line([v+cx,.001,-g+cz],[v+cx,.001,g+cz],'#d4e9dd13');}
      // A restrained contact cue improves height perception without a physics renderer.
      for(const o of objects.filter(o=>!o.hidden&&!o.parent_id&&!isWall(o)&&finitePoint(o.position)&&finitePoint(o.size))){
        const corners=worldGeometry(o).corners,xs=corners.map(p=>p[0]),zs=corners.map(p=>p[2]),ys=corners.map(p=>p[1]);
        const x=(Math.min(...xs)+Math.max(...xs))/2,z=(Math.min(...zs)+Math.max(...zs))/2,lift=Math.max(0,Math.min(...ys));
        const rx=(Math.max(...xs)-Math.min(...xs))*.57+.08+lift*.1,rz=(Math.max(...zs)-Math.min(...zs))*.57+.08+lift*.1;
        const ring=Array.from({length:16},(_,i)=>[x+Math.cos(i*Math.PI/8)*rx,.003,z+Math.sin(i*Math.PI/8)*rz]);
        fill(clipped(ring.map(local)),'#000000',.2/(1+lift*.8));
      }
    }
    const light=unit([-.436,.873,-.218]);
    function drawObjects(items,ghost=false){
      const faces=[];
      for(const o of items.filter(o=>!o.hidden&&finitePoint(o.position)&&finitePoint(o.size))){
        for(const {points,normal:n} of worldGeometry(o).faces){
          if(dot(n,sub(camera.position,points[0]))<=0)continue;
          const polygon=clipped(points.map(local));if(polygon.length<3)continue;
          const shade=Math.min(1,.72+.28*Math.max(0,dot(unit(n),light))),rgb=(o.color||'#aab6c6').match(/[0-9a-f]{2}/gi)||['aa','b6','c6'];
          faces.push({points:polygon,depth:polygon.reduce((sum,p)=>sum+p[2],0)/polygon.length,color:'rgb('+rgb.map(v=>Math.round(parseInt(v,16)*shade)).join(',')+')',alpha:ghost ? .3 : options.transparentWalls&&isWall(o) ? .22 : 1});
        }
      }
      faces.sort((a,b)=>b.depth-a.depth);for(const face of faces)fill(face.points,face.color,face.alpha);
    }
    drawObjects(objects);
    function outline(o,color='#b9ffd4',dashed=false){const c=worldGeometry(o).corners;for(let i=0;i<8;i++)for(const bit of [1,2,4])if(!(i&bit))line(c[i],c[i|bit],color,1.5,dashed?[4,3]:[]);}
    const selected=focusId||state.selectedEntity;
    if(selected){const root=objects.find(o=>o.id===selected),group=root?.actor_id;for(const o of objects.filter(o=>o.id===selected||o.parent_id===selected||(group&&o.actor_id===group)))if(finitePoint(o.position)&&finitePoint(o.size))outline(o,'#b9ffd4',!!o.hidden);}
    const tracks=state.shot?.object_tracks||{};
    for(const [id,keys] of Object.entries(tracks)){if(id.endsWith('_head')||!Array.isArray(keys))continue;for(let i=1;i<keys.length;i++)if(finitePoint(keys[i-1].position)&&finitePoint(keys[i].position))line(keys[i-1].position,keys[i].position,'#b9d5c48c',1.2,[3,4]);}
    const motionKeys=state.shot?.motion?.keys;
    if(Array.isArray(motionKeys))for(let i=1;i<motionKeys.length;i++)if(finitePoint(motionKeys[i-1].position)&&finitePoint(motionKeys[i].position))line(motionKeys[i-1].position,motionKeys[i].position,'#d0d9e08c',1.2,[4,4]);
    if(activeCamera&&finitePoint(activeCamera.position)&&finitePoint(activeCamera.target)){
      const a=axes(activeCamera),origin=activeCamera.position,depth=Math.max(.2,Math.min(1.2,b.radius*.3));
      const frameAspect=(state.plan?.output?.width||640)/(state.plan?.output?.height||360);
      const half=depth*(activeCamera.sensor_width_mm||36)/2/(activeCamera.focal_mm||35),mid=add(origin,mul(a.forward,depth));
      const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>add(mid,add(mul(a.right,x*half),mul(a.up,y*half/frameAspect))));
      corners.forEach((p,i)=>{line(origin,p,'#f4f4f4c9',1.2);line(p,corners[(i+1)%4],'#f4f4f4c9',1.2);});
      const p=projectPoint(origin,camera,width,height);if(p){ctx.beginPath();ctx.arc(p[0],p[1],3.5,0,Math.PI*2);ctx.fillStyle='#f4f4f4';ctx.fill();}
    }
    const placement=!input.comparison?input.placement:null,ghost=placementObjects(placement);
    if(ghost.length){
      drawObjects(ghost,true);for(const o of ghost)outline(o,'#ceffe1',true);
      const p=placement.position,sz=placement.spec.size,foot=[[p[0]-sz[0]/2,.008,p[2]-sz[2]/2],[p[0]+sz[0]/2,.008,p[2]-sz[2]/2],[p[0]+sz[0]/2,.008,p[2]+sz[2]/2],[p[0]-sz[0]/2,.008,p[2]+sz[2]/2]];
      for(let i=0;i<4;i++)line(foot[i],foot[(i+1)%4],'#d8ffe6',1.5,[3,3]);
      line(add(p,[-.15,.01,0]),add(p,[.15,.01,0]),'#d8ffe6',1.5);line(add(p,[0,.01,-.15]),add(p,[0,.01,.15]),'#d8ffe6',1.5);
      const label=projectPoint(add(p,[0,sz[1]+.15,0]),camera,width,height);if(label){ctx.font='11px system-ui';ctx.fillStyle='#dcffe7';ctx.textAlign='center';ctx.fillText(placement.spec.label||t('待放置'),clamp(label[0],50,width-50),clamp(label[1],16,height-12));}
    }
    return true;
  }
  function create(canvas,selector,useButton,adapter){
    if(!canvas||!selector||!adapter?.getState)throw Error('Stage view requires a canvas, selector and editor adapter.');
    const doc=canvas.ownerDocument,map=doc.getElementById('map'),wallControl=doc.getElementById('stage-walls'),layoutButton=doc.getElementById('view-layout'),hint=doc.createElement('div');
    hint.className='observe-hint';canvas.parentElement.append(hint);
    let mode='free',state,pose,sceneKey='',drag=null,frame=0,destroyed=false,focusId=null;
    const listeners=[];const on=(target,type,handler,options)=>{if(!target)return;target.addEventListener(type,handler,options);listeners.push(()=>target.removeEventListener(type,handler,options));};
    const readonly=()=>state?.session?.can_edit===false||state?.comparison;
    const aspect=()=>canvasSize(canvas).aspect;
    const visible=()=>mode!=='top2d'&&!canvas.hidden&&canvasSize(canvas).visible;
    function cue(text){bind(hint, 'textContent', ()=>((typeof text==='function'?text():text)||(mode==='free'?t('拖空白环绕 · 点选主体后拖移 · ⇧平移 · 滚轮远近'):t('点选主体后拖移 · 拖空白平移 · 滚轮远近'))));}
    function fitScene(){
      if(!state?.shot)return;focusId=null;cue();const display=displayState(state),items=[...(display.resolvedObjects||display.scene?.objects||[])],camera=adapter.getViewCamera?.();
      const points=[camera?.position,...(display.shot?.motion?.keys||[]).map(k=>k.position),...Object.values(display.shot?.object_tracks||{}).flatMap(keys=>Array.isArray(keys)?keys.map(k=>k.position):[])];
      for(const p of points)if(finitePoint(p))items.push({position:sub(p,[0,.04,0]),size:[.08,.08,.08]});
      pose=fitPose(items,mode==='top2d'?'free':mode,aspect());schedule();
    }
    function schedule(){if(!frame&&!destroyed)frame=scope.requestAnimationFrame(()=>{frame=0;if(visible()&&state?.shot&&pose)render(canvas,state,orbitCamera(pose),adapter.getViewCamera?.(),focusId,{transparentWalls:!!wallControl?.checked});});}
    function showLayout(){if(canvas.parentElement.hidden)layoutButton?.click();}
    function locate(id){
      state=adapter.getState();if(!state?.shot)return false;showLayout();const display=displayState(state);
      if(mode==='top2d'){adapter.requestRender?.();return true;}
      if(id==='camera'){
        const camera=adapter.getViewCamera?.();if(!camera||!finitePoint(camera.position))return false;
        setMode('free');focusId=null;pose=fitPose([{id:'camera-locator',position:sub(camera.position,[0,.6,0]),size:[1.6,1.2,1.6]}],'free',aspect());cue(()=>(t('摄影机 · 已定位 · 观察不会改机位')));schedule();return true;
      }
      const objects=display.resolvedObjects||display.scene?.objects||[],root=objects.find(o=>o.id===id);if(!root)return false;
      const parts=objects.filter(o=>rootId(o,display.scene?.objects||objects)===id);
      setMode('free');focusId=id;pose=fitPose(parts.map(o=>({...o,hidden:false})),'free',aspect());cue(()=>(demoText(root.label||root.name||root.id)+(root.hidden?t(' · 此刻隐藏'):t(' · 已定位'))));schedule();return true;
    }
    function setMode(value){
      const next=modes.includes(value)?value:'free',previous=mode;mode=next;selector.value=mode;drag=null;canvas.classList.remove('dragging');
      canvas.hidden=mode==='top2d';if(map)map.hidden=mode!=='top2d';hint.hidden=mode==='top2d';if(wallControl)wallControl.disabled=mode==='top2d';if(useButton)useButton.hidden=mode==='top2d';
      cue();bind(canvas, '@aria-label', ()=>t('三维片场，拖空白观察，点选主体后拖动位置'));
      if(mode!=='top2d'){if(!pose||(mode!==previous&&mode!=='free'))fitScene();schedule();}else adapter.requestRender?.();
      if(typeof scope.dispatchEvent==='function'&&typeof scope.CustomEvent==='function')scope.dispatchEvent(new scope.CustomEvent('stage-view-mode',{detail:{mode}}));
      return mode;
    }
    function sync(next){
      if(state?.selectedEntity!==next?.selectedEntity&&focusId!==next?.selectedEntity)focusId=null;
      state=next;if(!state?.shot)return;const display=displayState(state),key=(state.session?.id||'demo')+':'+display.shot.scene+':'+Boolean(state.comparison);
      if(sceneKey!==key){sceneKey=key;pose=null;focusId=null;if(mode!=='top2d')fitScene();}
      if(focusId&&!(display.resolvedObjects||display.scene?.objects||[]).some(o=>o.id===focusId))fitScene();
      if(useButton)useButton.disabled=readonly()||state.placement?.status==='placing';
      if(state.placement?.status==='placing')cue(()=>(t('移动鼠标预览地面落点 · 点击放置 · Esc 取消')));else if(!drag&&!focusId)cue();
      schedule();
    }
    function cursor(event){const rect=canvas.getBoundingClientRect();return {x:event.clientX-rect.left,y:event.clientY-rect.top,width:rect.width,height:rect.height};}
    function pointerRay(event){if(!pose)return null;const p=cursor(event);return rayAt(p.x,p.y,orbitCamera(pose),p.width,p.height);}
    function hit(event){const display=displayState(state);return pickObject(pointerRay(event),display.resolvedObjects||[],display.scene?.objects||[],!!wallControl?.checked);}
    function finish(event){
      if(drag?.id!==event.pointerId)return;const previous=drag;drag=null;canvas.classList.remove('dragging');
      if(event.type==='pointerup'&&previous.kind==='select'&&!previous.moved&&!readonly()){
        const accepted=adapter.selectSubject?.(previous.hit.id);if(accepted!==false){focusId=previous.hit.id;cue(()=>(t('已选中主体 · 再拖动可调整地面位置')));adapter.requestRender?.();}
      }
      if(canvas.hasPointerCapture?.(event.pointerId))canvas.releasePointerCapture(event.pointerId);schedule();
    }
    on(selector,'change',()=>setMode(selector.value));on(wallControl,'change',schedule);
    on(canvas,'dblclick',event=>{if(state?.placement?.status!=='placing'&&!hit(event))fitScene();});
    if(typeof scope.addEventListener==='function')on(scope,'stage-locate-object',event=>locate(event.detail?.id));
    on(layoutButton,'click',schedule);if(scope.addEventListener)on(scope,'stage-language-change',schedule);
    on(canvas,'pointerdown',event=>{
      if(!visible()||!pose||event.button>2)return;state=adapter.getState();event.preventDefault();
      if(state.placement?.status==='placing'&&event.button===0&&!event.shiftKey){
        if(readonly())return;const point=groundPoint(pointerRay(event),0);if(!point){cue(()=>(t('这个角度看不到地面，请切换自由观察或顶视')));return;}
        adapter.updateGeometryPlacementPosition?.(point);adapter.placeGeometryAt?.(point);drag={id:event.pointerId,kind:'placed'};canvas.setPointerCapture(event.pointerId);return;
      }
      const object=event.button===0&&!event.shiftKey?hit(event):null;
      if(object&&state.selectedEntity===object.id&&!readonly()){
        const info=adapter.getSubjectDragState?.(object.id)||adapter.subjectDragState?.(object.id);
        if(info&&info.canMove!==false){
          const origin=info.position||info.renderOrigin,planeY=info.dragPlaneY??info.planeY??origin?.[1];
          const point=groundPoint(pointerRay(event),planeY);
          if(finitePoint(origin)&&point){drag={id:event.pointerId,kind:'subject',objectId:object.id,origin:[...origin],anchor:point,planeY,shotId:state.shot.id,x:event.clientX,y:event.clientY,moved:false};canvas.setPointerCapture(event.pointerId);canvas.classList.add('dragging');return;}
          cue(()=>(t('当前角度不便沿地面拖移，请切换自由观察或顶视')));return;
        }
        cue(()=>(t('当前主体暂不可移动，请结束拖动后重试')));return;
      }
      drag={id:event.pointerId,kind:object&&!readonly()?'select':'observe',hit:object,x:event.clientX,y:event.clientY,pose:{...pose,target:[...pose.target]},pan:mode!=='free'||event.shiftKey||event.button!==0,moved:false};
      canvas.setPointerCapture(event.pointerId);canvas.classList.add('dragging');
    });
    on(canvas,'pointermove',event=>{
      if(!visible()||!pose)return;
      if(drag?.id===event.pointerId){
        if(drag.kind==='placed')return;
        const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(Math.hypot(dx,dy)>3)drag.moved=true;
        if(drag.kind==='subject'){
          if(!drag.moved)return;state=adapter.getState();if(readonly()||state.shot?.id!==drag.shotId)return;
          const point=groundPoint(pointerRay(event),drag.planeY);if(!point)return;
          const desired=add(drag.origin,sub(point,drag.anchor));desired[1]=drag.origin[1];
          if(adapter.moveSubjectOnGround?.(drag.objectId,desired)===false)cue(()=>(t('当前主体暂不可移动，请结束拖动后重试')));else{focusId=drag.objectId;cue(()=>(t('主体位置已更新 · 可还原上次调整')));}schedule();return;
        }
        if(drag.moved){pose=drag.pan?panPose(drag.pose,dx,dy,canvas.clientWidth):orbitPose(drag.pose,dx,dy);schedule();}
      }else if(state?.placement?.status==='placing'&&!readonly()){
        const point=groundPoint(pointerRay(event),0);if(point){adapter.updateGeometryPlacementPosition?.(point);canvas.style.cursor='crosshair';}else canvas.style.cursor='not-allowed';
      }else{
        const object=hit(event);canvas.style.cursor=object?(object.id===state?.selectedEntity&&!readonly()?'move':'pointer'):'grab';
      }
    });
    for(const type of ['pointerup','pointercancel','lostpointercapture'])on(canvas,type,finish);
    on(canvas,'wheel',event=>{event.preventDefault();if(pose){pose=zoomPose(pose,event.deltaY);schedule();}},{passive:false});on(canvas,'contextmenu',event=>event.preventDefault());
    on(useButton,'click',()=>{if(!pose||readonly()||state?.placement?.status==='placing')return;adapter.previewCamera?.(orbitCamera(pose));});
    const unsubscribe=adapter.subscribe?.(sync),observer=typeof scope.ResizeObserver==='function'?new scope.ResizeObserver(()=>{if(!pose&&state?.shot&&mode!=='top2d')fitScene();schedule();}):null;observer?.observe(canvas.parentElement);
    sync(adapter.getState());setMode(selector.value||'free');
    return {getMode:()=>mode,getCamera:()=>pose?orbitCamera(pose):null,setMode,fit:fitScene,locate,render:schedule,destroy(){destroyed=true;listeners.forEach(stop=>stop());unsubscribe?.();observer?.disconnect();if(frame)scope.cancelAnimationFrame(frame);hint.remove();}};
  }
  scope.StageObserve={modes,rotate,bounds,objectCorners,fitPose,orbitCamera,axes,projectPoint,panPose,orbitPose,zoomPose,rayAt,groundPoint,rayTriangle,rootId,pickObject,canvasSize,isWall,placementObjects,render,create};
  if(typeof module!=='undefined')module.exports=scope.StageObserve;
  if(typeof document!=='undefined'){
    let mounted=false;function connect(){const api=scope.stageEditor,canvas=document.getElementById('observe-canvas'),selector=document.getElementById('stage-view');if(mounted||!api||!canvas||!selector)return;mounted=true;scope.stageObserve=create(canvas,selector,document.getElementById('use-observe-view'),api);}
    scope.addEventListener('stage-editor-ready',connect);connect();
  }
})(typeof window!=='undefined'?window:globalThis);
