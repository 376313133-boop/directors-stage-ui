/* UI-only localization. Project documents, IDs and authored names are never rewritten. */
(function(scope){
  'use strict';
  const supported=['zh','en','ja','ko'];
  const normalize=value=>{const base=String(value||'').trim().toLowerCase().replace('_','-').split('-')[0];return supported.includes(base)?base:'en';};
  const storageKey='directors-stage-language';
  let saved;try{saved=scope.localStorage?.getItem(storageKey);}catch{}
  const params=new URLSearchParams(scope.location?.search||'');
  let locale=normalize(params.has('lang')?params.get('lang'):saved||scope.navigator?.language||'en');
  const catalog=Object.create(null),generated=new Map(),staticRecords=[];
  let demoLabels=new Set();
  function setDemoSource(plan){demoLabels=new Set();const visit=value=>{if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')for(const [key,item]of Object.entries(value)){if(['title','name','label','shot_size','angle','group'].includes(key)&&typeof item==='string')demoLabels.add(item);visit(item);}};if(plan)visit(plan);}
  const demoText=value=>demoLabels.has(value)?t(value):value;
  const interpolate=(source,vars)=>source.replace(/\{([\w]+)\}/g,(match,key)=>Object.hasOwn(vars,key)?String(vars[key]??''):match);
  function t(source,...args){
    let key,vars;
    if(Array.isArray(source)&&Object.hasOwn(source,'raw')){key=source.reduce((s,part,index)=>s+(index?'{'+(index-1)+'}':'')+part,'');vars=args;}
    else{key=String(source??'');vars=args[0]||{};if(!catalog[key]&&generated.has(key)){const previous=generated.get(key);key=previous.key;vars=previous.vars;}}
    const translated=locale==='zh'?key:(catalog[key]?.[locale]??catalog[key]?.en??key);
    const result=interpolate(translated,vars);
    // Only strings produced by this API are eligible for later status refresh.
    if(result){generated.set(result,{key,vars});if(generated.size>2000)generated.delete(generated.keys().next().value);}
    return result;
  }
  function retranslate(value){const record=generated.get(value);return record?t(record.key,record.vars):value;}
  function applyStatic(){
    const document=scope.document;if(!document)return;
    document.documentElement.lang=locale==='zh'?'zh-CN':locale;
    document.documentElement.dataset.locale=locale;
    document.documentElement.dataset.uiLang=locale;
    document.title=locale==='zh'?'导演片场 · Director’s Stage':'Director’s Stage';
    for(const record of staticRecords){
      // A dynamic renderer may have replaced this node or attribute. It owns it now.
      if(!record.node.isConnected)continue;
      const current=record.attribute?record.node.getAttribute(record.attribute):record.node.nodeValue;
      if(current!==record.last)continue;
      const next=record.leading+t(record.source)+record.trailing;
      if(record.attribute)record.node.setAttribute(record.attribute,next);else record.node.nodeValue=next;
      record.last=next;
    }
    const selector=document.getElementById('ui-language');if(selector){selector.value=locale;selector.setAttribute('aria-label',t('界面语言'));}
  }
  function captureStatic(){
    const document=scope.document;if(!document?.body)return;
    const skip=node=>node.parentElement?.closest('script,style,textarea,[data-i18n-skip],[translate="no"]');
    const walker=document.createTreeWalker(document.body,4);
    while(walker.nextNode()){
      const node=walker.currentNode;if(skip(node)||!node.nodeValue.trim())continue;
      const source=node.nodeValue.trim();if(!/[\u3400-\u9fff]/.test(source))continue;
      staticRecords.push({node,source,leading:node.nodeValue.match(/^\s*/)[0],trailing:node.nodeValue.match(/\s*$/)[0],last:node.nodeValue});
    }
    for(const node of document.body.querySelectorAll('[title],[aria-label],[placeholder],[alt]')){
      if(node.closest('[data-i18n-skip],[translate="no"]'))continue;
      for(const attribute of ['title','aria-label','placeholder','alt']){const source=node.getAttribute(attribute);if(source&&/[\u3400-\u9fff]/.test(source))staticRecords.push({node,attribute,source,leading:'',trailing:'',last:source});}
    }
    document.getElementById('ui-language')?.addEventListener('change',event=>setLocale(event.target.value));
    applyStatic();
  }
  function register(entries){for(const [key,value]of Object.entries(entries||{}))catalog[key]={...(catalog[key]||{}),...value};applyStatic();}
  function setLocale(value,{persist=true}={}){
    const next=normalize(value),previousLocale=locale;locale=next;
    if(persist)try{scope.localStorage?.setItem(storageKey,locale);}catch{}
    if(persist&&scope.history?.replaceState&&scope.location?.href){try{const url=new URL(scope.location.href);url.searchParams.set('lang',locale);scope.history.replaceState(scope.history.state,'',url.href);}catch{}}
    applyStatic();
    if(previousLocale!==locale&&scope.CustomEvent)scope.dispatchEvent?.(new scope.CustomEvent('stage-language-change',{detail:{locale,previousLocale}}));
    return locale;
  }
  scope.StageI18n={t,register,setLocale,normalize,retranslate,setDemoSource,demoText,referenceNotice:()=>'',get locale(){return locale;},get catalog(){return catalog;}};
  // Deferred script execution occurs after HTML parsing and before project modules.
  captureStatic();
})(typeof window!=='undefined'?window:globalThis);

StageI18n.register({
  " · 人物走位": {
    "en": " · Subject path",
    "ja": " · 被写体の移動",
    "ko": " · 피사체 이동"
  },
  " · 姿态 ": {
    "en": " · Pose ",
    "ja": " · 姿勢 ",
    "ko": " · 자세 "
  },
  " · 已定位": {
    "en": " · Located",
    "ja": " · 位置を表示",
    "ko": " · 위치 표시됨"
  },
  " · 当前不可见": {
    "en": " · Hidden now",
    "ja": " · 現在は非表示",
    "ko": " · 현재 숨김"
  },
  " · 当前隐藏": {
    "en": " · Hidden now",
    "ja": " · 現在は非表示",
    "ko": " · 현재 숨김"
  },
  " · 约 {0} m/s": {
    "en": " · About {0} m/s",
    "ja": " · 約 {0} m/s",
    "ko": " · 약 {0} m/s"
  },
  " · 试调": {
    "en": " · Preview",
    "ja": " · 試調整中",
    "ko": " · 미리 조정"
  },
  " · 试调整条路线，镜头总长不变。满意后点应用。": {
    "en": " · Previewing the entire path; shot duration stays unchanged. Apply when ready.",
    "ja": " · 経路全体を試調整中。ショット全長は変わりません。確認後に適用してください。",
    "ko": " · 전체 경로를 미리 조정합니다. 숏 길이는 유지됩니다. 확인 후 적용하세요."
  },
  " · 走位": {
    "en": " · Path",
    "ja": " · 移動",
    "ko": " · 이동"
  },
  " · 项目 v": {
    "en": " · Project v",
    "ja": " · プロジェクト v",
    "ko": " · 프로젝트 v"
  },
  " · 鱼眼": {
    "en": " · Fisheye",
    "ja": " · 魚眼",
    "ko": " · 어안"
  },
  " 场景": {
    "en": " scenes",
    "ja": " シーン",
    "ko": " 장면"
  },
  " 已保存。": {
    "en": " saved. ",
    "ja": " を保存しました。",
    "ko": " 저장됨. "
  },
  " 已在浏览器保存。": {
    "en": " saved in this browser. ",
    "ja": " をこのブラウザに保存しました。",
    "ko": " 브라우저에 저장됨. "
  },
  " 帧待交接": {
    "en": " frames to hand off",
    "ja": " フレームが引き継ぎ待ち",
    "ko": " 프레임 인계 대기"
  },
  " 版：": {
    "en": ": ",
    "ja": "：",
    "ko": ": "
  },
  " 秒": {
    "en": " s",
    "ja": " 秒",
    "ko": " 초"
  },
  " 秒加入状态变化，拖动时间轴即可检查。": {
    "en": " s. Scrub the timeline to review.",
    "ja": " 秒に状態変化を追加しました。タイムラインで確認できます。",
    "ko": " 초에 상태 변화를 추가했습니다. 타임라인을 이동해 확인하세요."
  },
  " 秒标记": {
    "en": " s mark",
    "ja": " 秒のマーク",
    "ko": " 초 표시"
  },
  " 镜": {
    "en": " shots",
    "ja": " ショット",
    "ko": " 숏"
  },
  " 镜有修改": {
    "en": " shots modified",
    "ja": " ショットを変更",
    "ko": " 숏 변경됨"
  },
  "FPV 侧倾需要移动路径。先选 FPV、绕拍或其他运镜，再调整侧倾质感。": {
    "en": "FPV banking needs a movement path. Choose FPV, orbit or another camera move first, then adjust the banking.",
    "ja": "FPV の傾きには移動経路が必要です。まず FPV・周回などのカメラワークを選び、その後で傾きを調整してください。",
    "ko": "FPV 기울기에는 이동 경로가 필요합니다. 먼저 FPV, 오빗 등 카메라 움직임을 선택한 뒤 기울기를 조정하세요."
  },
  "Flova 授权已过期，请刷新页面重新连接。": {
    "en": "Your Flova authorization has expired. Refresh to reconnect.",
    "ja": "Flova の認証期限が切れました。更新して再接続してください。",
    "ko": "Flova 인증이 만료되었습니다. 새로고침하여 다시 연결하세요."
  },
  "{0} s 出发{1}": {
    "en": "Departs at {0} s{1}",
    "ja": "{0} 秒に出発{1}",
    "ko": "{0}초에 출발{1}"
  },
  "{0} · {1} m · 点击左侧片场放置": {
    "en": "{0} · {1} m · Click the stage on the left to place",
    "ja": "{0} · {1} m · 左のステージをクリックして配置",
    "ko": "{0} · {1} m · 왼쪽 스테이지를 클릭해 배치"
  },
  "{0} · {1} 秒 · 左右 {2} / 高度 {3} / 前后 {4} m{5}{6}": {
    "en": "{0} · {1} s · X {2} / Height {3} / Depth {4} m{5}{6}",
    "ja": "{0} · {1} 秒 · 左右 {2} / 高さ {3} / 前後 {4} m{5}{6}",
    "ko": "{0} · {1}초 · 좌우 {2} / 높이 {3} / 앞뒤 {4} m{5}{6}"
  },
  "{0} 个路径点": {
    "en": "{0} waypoints",
    "ja": "{0} 個の経路ポイント",
    "ko": "경로점 {0}개"
  },
  "{0} 秒 · 路径点时间按镜头长度同比调整。": {
    "en": "{0} s · Waypoint times scale with the shot duration.",
    "ja": "{0} 秒 · 経路ポイントの時刻もショット長に合わせて変わります。",
    "ko": "{0}초 · 경로점 시간이 숏 길이에 비례해 조정됩니다."
  },
  "{0}停留时间": {
    "en": "{0} hold duration",
    "ja": "{0}の停止時間",
    "ko": "{0} 머무름 시간"
  },
  "{0}到达时间": {
    "en": "{0} arrival time",
    "ja": "{0}の到着時刻",
    "ko": "{0} 도착 시간"
  },
  "{0}至下一点行进时间": {
    "en": "Travel time from {0} to the next point",
    "ja": "{0}から次の点までの移動時間",
    "ko": "{0}에서 다음 지점까지 이동 시간"
  },
  "。你的本地修改已保留，选择继续旧草稿，或打开项目新版。两份内容不会互相覆盖。": {
    "en": ". Your local changes are safe. Continue the older draft or open the latest project. Neither will overwrite the other.",
    "ja": "。ローカルの変更は保持されています。以前の下書きを続けるか、最新版を開いてください。互いに上書きされません。",
    "ko": ". 로컬 변경 사항은 보존됩니다. 이전 초안을 계속하거나 최신 프로젝트를 여세요. 서로 덮어쓰지 않습니다."
  },
  "一个主体最多保留 32 个状态变化，请先移除不需要的动作。": {
    "en": "A subject supports up to 32 state changes. Remove an unused action first.",
    "ja": "被写体ごとの状態変化は最大 32 個です。不要な動作を削除してください。",
    "ko": "피사체당 상태 변화는 최대 32개입니다. 불필요한 동작을 먼저 제거하세요."
  },
  "一个人物最多可放 24 个站位点。": {
    "en": "Each subject supports up to 24 position points.",
    "ja": "被写体ごとの位置ポイントは最大 24 個です。",
    "ko": "피사체당 위치점은 최대 24개입니다."
  },
  "一个镜头最多可放 24 个构图点。可先删除一个中间点。": {
    "en": "A shot supports up to 24 composition points. Remove an intermediate point first.",
    "ja": "ショットごとの構図ポイントは最大 24 個です。途中の点を削除してください。",
    "ko": "숏당 구도점은 최대 24개입니다. 중간 지점을 먼저 삭제하세요."
  },
  "一次最多标记 30 帧。请先交接这批，或移除不需要的标记。": {
    "en": "You can mark up to 30 frames. Hand off this batch or remove unneeded marks first.",
    "ja": "マークできるのは一度に最大 30 フレームです。引き継ぐか、不要なマークを削除してください。",
    "ko": "한 번에 최대 30프레임을 표시할 수 있습니다. 먼저 인계하거나 불필요한 표시를 제거하세요."
  },
  "下载保存图片；标记会记住此刻的完整机位和人物状态，之后统一交给 Agent。": {
    "en": "Download the image to save it. Marking preserves this frame’s complete camera and subject state for the Agent handoff.",
    "ja": "画像はダウンロードして保存できます。マークにはこの瞬間のカメラと被写体の全状態が保存され、まとめて Agent に引き継げます。",
    "ko": "이미지를 다운로드해 저장하세요. 표시하면 현재 프레임의 전체 카메라와 피사체 상태가 보존되어 Agent에 함께 인계됩니다."
  },
  "下载这份修改": {
    "en": "Download these changes",
    "ja": "この変更をダウンロード",
    "ko": "변경 사항 다운로드"
  },
  "不同窗口的修改已分别保留。请选择要继续的草稿，其他草稿不会被覆盖，也不会自动合并。": {
    "en": "Changes from separate windows are kept separately. Choose a draft to continue; other drafts will not be overwritten or automatically merged.",
    "ja": "各ウィンドウの変更は個別に保存されています。続ける下書きを選んでください。他の下書きは上書きも自動統合もされません。",
    "ko": "각 창의 변경 사항이 별도로 보존되었습니다. 계속할 초안을 선택하세요. 다른 초안을 덮어쓰거나 자동 병합하지 않습니다."
  },
  "主体 A": {
    "en": "Subject A",
    "ja": "被写体 A",
    "ko": "피사체 A"
  },
  "主体 B": {
    "en": "Subject B",
    "ja": "被写体 B",
    "ko": "피사체 B"
  },
  "主体位于镜头后方，请先用景别模板将它放入画面。": {
    "en": "The subject is behind the camera. Use a framing preset to bring it into view first.",
    "ja": "被写体がカメラの後ろにあります。まず画角プリセットで画面内に入れてください。",
    "ko": "피사체가 카메라 뒤에 있습니다. 먼저 프레이밍 프리셋으로 화면 안에 배치하세요."
  },
  "人物站位点已达上限，请先删除一个中间点。": {
    "en": "The subject-position point limit is reached. Remove an intermediate point first.",
    "ja": "被写体の位置ポイントが上限に達しました。途中の点を削除してください。",
    "ko": "피사체 위치점이 한도에 도달했습니다. 중간 지점을 먼저 삭제하세요."
  },
  "仅编辑当前镜头": {
    "en": "Editing current shot only",
    "ja": "現在のショットのみ編集",
    "ko": "현재 숏만 편집"
  },
  "作用于整镜所有主体，已切换整条路线；镜头总时长保持不变。": {
    "en": " applies to all subjects throughout the shot. Switched to the entire path; total duration stays unchanged.",
    "ja": " はショット全体の全被写体に適用されます。経路全体に切り替えました。ショット全長は変わりません。",
    "ko": " 효과는 전체 숏의 모든 피사체에 적용됩니다. 전체 경로로 전환했으며 숏 길이는 유지됩니다."
  },
  "你正在编辑示例片场。可复制示例接力指令。": {
    "en": "You are editing the demo stage. Copy the demo handoff instructions.",
    "ja": "サンプルステージを編集中です。サンプルの引き継ぎ指示をコピーできます。",
    "ko": "데모 스테이지를 편집 중입니다. 데모 인계 지시를 복사할 수 있습니다."
  },
  "修改前 · 只读": {
    "en": "Before changes · Read only",
    "ja": "変更前 · 読み取り専用",
    "ko": "변경 전 · 읽기 전용"
  },
  "修改的 ": {
    "en": " changes for ",
    "ja": " の変更対象：",
    "ko": " 변경 대상: "
  },
  "先从对象列表选择要定位的主体。": {
    "en": "Choose a subject in the object list first.",
    "ja": "まずオブジェクト一覧で位置を表示する被写体を選んでください。",
    "ko": "먼저 오브젝트 목록에서 위치를 찾을 피사체를 선택하세요."
  },
  "先在左侧片场放置物体，或取消放置后再播放。": {
    "en": "Place the object on the left stage or cancel placement before playing.",
    "ja": "左のステージに物体を配置するか、配置をキャンセルしてから再生してください。",
    "ko": "왼쪽 스테이지에 물체를 배치하거나 배치를 취소한 뒤 재생하세요."
  },
  "先在左侧片场放置物体，或按 Esc 取消放置。": {
    "en": "Place the object on the left stage, or press Esc to cancel.",
    "ja": "左のステージに物体を配置するか、Esc でキャンセルしてください。",
    "ko": "왼쪽 스테이지에 물체를 배치하거나 Esc로 취소하세요."
  },
  "先完成或取消当前物体放置，再调整已有物体大小。": {
    "en": "Finish or cancel placement before resizing an existing object.",
    "ja": "配置を完了またはキャンセルしてから、既存の物体の大きさを調整してください。",
    "ko": "현재 배치를 완료하거나 취소한 뒤 기존 물체 크기를 조정하세요."
  },
  "先应用或还原当前试调，再添加物体。": {
    "en": "Apply or revert the current preview before adding an object.",
    "ja": "現在の試調整を適用または元に戻してから物体を追加してください。",
    "ko": "현재 미리 조정을 적용하거나 되돌린 뒤 물체를 추가하세요."
  },
  "先恢复正常主体时间，再编辑走位或状态。": {
    "en": "Restore normal subject timing before editing paths or states.",
    "ja": "被写体の時間を通常に戻してから移動や状態を編集してください。",
    "ko": "피사체 시간을 정상으로 복원한 뒤 이동이나 상태를 편집하세요."
  },
  "先恢复正常主体时间，再编辑走位或状态。摄影机仍可正常调整。": {
    "en": "Restore normal subject timing before editing paths or states. Camera adjustments remain available.",
    "ja": "移動や状態を編集する前に、被写体の時間を通常に戻してください。カメラはそのまま調整できます。",
    "ko": "이동이나 상태 편집 전에 피사체 시간을 정상으로 복원하세요. 카메라는 계속 조정할 수 있습니다."
  },
  "先选择一个主体，再使用“放在主体旁边”。": {
    "en": "Select a subject before choosing “Place beside subject”.",
    "ja": "「被写体の横に配置」を使う前に被写体を選んでください。",
    "ko": "“피사체 옆에 배치”를 사용하기 전에 피사체를 선택하세요."
  },
  "先选择当前可见的人物或道具，再选择景别。": {
    "en": "Select a visible person or prop before choosing a framing preset.",
    "ja": "表示されている人物や小道具を選んでから画角を選択してください。",
    "ko": "현재 보이는 인물이나 소품을 선택한 뒤 숏 크기를 선택하세요."
  },
  "先选择要设置状态的人物或道具。": {
    "en": "Select the person or prop whose state you want to edit.",
    "ja": "状態を設定する人物または小道具を選んでください。",
    "ko": "상태를 설정할 인물이나 소품을 선택하세요."
  },
  "先选择要锁住的主体。": {
    "en": "Select the subject to lock first.",
    "ja": "まず固定する被写体を選んでください。",
    "ko": "먼저 고정할 피사체를 선택하세요."
  },
  "入口中的场景已不存在，已打开全部片场，请重新选择。": {
    "en": "The linked scene no longer exists. All scenes are shown; select another.",
    "ja": "リンク先のシーンは存在しません。全ステージを表示したので選び直してください。",
    "ko": "링크된 장면이 더 이상 없습니다. 모든 장면을 표시했으니 다시 선택하세요."
  },
  "入口中的视频没有可打开的镜头，已打开全部片场，请重新选择。": {
    "en": "The linked video has no available shots. All scenes are shown; select another.",
    "ja": "リンク先の動画に開けるショットがありません。全ステージから選び直してください。",
    "ko": "링크된 영상에 열 수 있는 숏이 없습니다. 전체 스테이지에서 다시 선택하세요."
  },
  "入口中的镜头与当前工程不匹配，已打开全部片场，请重新选择。": {
    "en": "The linked shot does not match this project. All scenes are shown; select another.",
    "ja": "リンク先のショットが現在のプロジェクトと一致しません。全ステージから選び直してください。",
    "ko": "링크된 숏이 현재 프로젝트와 일치하지 않습니다. 전체 스테이지에서 다시 선택하세요."
  },
  "几何体未生成，请重试。": {
    "en": "The geometry could not be created. Try again.",
    "ja": "形状を生成できませんでした。再試行してください。",
    "ko": "도형을 생성하지 못했습니다. 다시 시도하세요."
  },
  "删除": {
    "en": "Delete",
    "ja": "削除",
    "ko": "삭제"
  },
  "升降高度": {
    "en": "Vertical travel",
    "ja": "昇降距離",
    "ko": "수직 이동 거리"
  },
  "双人构图需要两个可见人物。": {
    "en": "A two-shot needs two visible people.",
    "ja": "ツーショットには表示された人物が 2 人必要です。",
    "ko": "투 숏에는 보이는 인물 두 명이 필요합니다."
  },
  "另一个窗口也有修改。两份草稿已分别保留，重新打开时可以选择，不会互相覆盖。": {
    "en": "Another window also has changes. Both drafts are kept separately; choose one when reopening. Neither overwrites the other.",
    "ja": "別のウィンドウにも変更があります。両方の下書きを個別に保持しました。再度開くときに選択でき、互いに上書きされません。",
    "ko": "다른 창에도 변경 사항이 있습니다. 두 초안은 별도로 보존되며 다시 열 때 선택할 수 있습니다. 서로 덮어쓰지 않습니다."
  },
  "可查看空间 · 等待 Agent 拆镜": {
    "en": "Space available · Awaiting Agent shot breakdown",
    "ja": "空間を表示可能 · Agent のショット分割待ち",
    "ko": "공간 보기 가능 · Agent 숏 분할 대기"
  },
  "可编辑": {
    "en": "Editable",
    "ja": "編集可能",
    "ko": "편집 가능"
  },
  "后墙": {
    "en": "Back wall",
    "ja": "奥の壁",
    "ko": "뒷벽"
  },
  "回到原视图": {
    "en": "Restore view",
    "ja": "元のビューに戻す",
    "ko": "원래 뷰 복원"
  },
  "固定镜头": {
    "en": "Static shot",
    "ja": "固定ショット",
    "ko": "고정 숏"
  },
  "在 {0} 秒到达，{1} 秒出发。": {
    "en": "Arrives at {0} s; departs at {1} s.",
    "ja": "{0} 秒に到着、{1} 秒に出発。",
    "ko": "{0}초에 도착하고 {1}초에 출발합니다."
  },
  "在左侧片场点击放置，浅色预览表示新增物体。": {
    "en": "Click the left stage to place. The light preview shows the new object.",
    "ja": "左のステージをクリックして配置します。薄いプレビューが追加される物体です。",
    "ko": "왼쪽 스테이지를 클릭해 배치하세요. 밝은 미리보기가 새 물체입니다."
  },
  "复制指令并发回原项目，Agent 就能接着执行。": {
    "en": "Copy the instructions back to the original project so the Agent can continue.",
    "ja": "指示をコピーして元のプロジェクトに送ると、Agent が作業を続けられます。",
    "ko": "지시를 복사해 원래 프로젝트로 보내면 Agent가 이어서 작업할 수 있습니다."
  },
  "复制接力指令": {
    "en": "Copy handoff instructions",
    "ja": "引き継ぎ指示をコピー",
    "ko": "인계 지시 복사"
  },
  "对象标识重复，请重试。": {
    "en": "Duplicate object ID. Try again.",
    "ja": "オブジェクト ID が重複しています。再試行してください。",
    "ko": "오브젝트 ID가 중복됩니다. 다시 시도하세요."
  },
  "导演片场-未交接修改-v": {
    "en": "Directors-Stage-pending-changes-v",
    "ja": "Directors-Stage-未引き継ぎ変更-v",
    "ko": "Directors-Stage-인계대기-v"
  },
  "将接力指令发回 Flova 项目。": {
    "en": "Send the handoff instructions back to the Flova project.",
    "ja": "引き継ぎ指示を Flova プロジェクトに送ってください。",
    "ko": "인계 지시를 Flova 프로젝트로 보내세요."
  },
  "工程文档与此入口不匹配，请让项目 Agent 检查入口。": {
    "en": "The project document does not match this link. Ask the project Agent to check it.",
    "ja": "プロジェクト文書がこのリンクと一致しません。プロジェクトの Agent に確認を依頼してください。",
    "ko": "프로젝트 문서가 이 링크와 일치하지 않습니다. 프로젝트 Agent에 확인을 요청하세요."
  },
  "已保存在此浏览器。请复制接力指令。": {
    "en": "Saved in this browser. Copy the handoff instructions.",
    "ja": "このブラウザに保存しました。引き継ぎ指示をコピーしてください。",
    "ko": "이 브라우저에 저장했습니다. 인계 지시를 복사하세요."
  },
  "已保存给 Agent": {
    "en": "Saved for Agent handoff",
    "ja": "Agent への引き継ぎ用に保存済み",
    "ko": "Agent 인계용으로 저장됨"
  },
  "已切换位置，放置已取消。": {
    "en": "Location changed; placement cancelled.",
    "ja": "場所を切り替えたため、配置をキャンセルしました。",
    "ko": "위치가 변경되어 배치를 취소했습니다."
  },
  "已切换时刻，放置已取消。": {
    "en": "Time changed; placement cancelled.",
    "ja": "時刻を切り替えたため、配置をキャンセルしました。",
    "ko": "시간이 변경되어 배치를 취소했습니다."
  },
  "已切换编辑对象，放置已取消。": {
    "en": "Editing target changed; placement cancelled.",
    "ja": "編集対象を切り替えたため、配置をキャンセルしました。",
    "ko": "편집 대상이 변경되어 배치를 취소했습니다."
  },
  "已删除{0}。": {
    "en": "Deleted {0}.",
    "ja": "{0}を削除しました。",
    "ko": "{0} 삭제됨."
  },
  "已取消放置，片场未新增物体。": {
    "en": "Placement cancelled. No object was added.",
    "ja": "配置をキャンセルしました。物体は追加されていません。",
    "ko": "배치를 취소했습니다. 물체가 추가되지 않았습니다."
  },
  "已在 ": {
    "en": "State change added at ",
    "ja": "",
    "ko": ""
  },
  "已复制": {
    "en": "Copied",
    "ja": "コピー済み",
    "ko": "복사됨"
  },
  "已定位「{0}」{1}": {
    "en": "Located “{0}”{1}",
    "ja": "「{0}」の位置を表示しました{1}",
    "ko": "“{0}” 위치를 표시했습니다{1}"
  },
  "已定位摄影机，仅调整观察视图。": {
    "en": "Camera located. Only the observation view changed.",
    "ja": "カメラの位置を表示しました。観察ビューだけを調整しています。",
    "ko": "카메라 위치를 표시했습니다. 관찰 뷰만 조정됩니다."
  },
  "已应用。现在可以继续拖时间或选择下一处位置。": {
    "en": "Applied. You can now scrub time or select another position.",
    "ja": "適用しました。時刻の移動や次の位置の選択ができます。",
    "ko": "적용했습니다. 이제 시간을 이동하거나 다음 위치를 선택할 수 있습니다."
  },
  "已撤销。": {
    "en": "Undone.",
    "ja": "元に戻しました。",
    "ko": "실행 취소됨."
  },
  "已标记 {0} 帧 · 随接力指令一起交给 Agent": {
    "en": "{0} frames marked · Included in the Agent handoff",
    "ja": "{0} フレームをマーク済み · 引き継ぎ指示と一緒に Agent へ",
    "ko": "{0}프레임 표시됨 · 인계 지시와 함께 Agent에 전달"
  },
  "已添加「{0}」，已选中并定位。": {
    "en": "Added “{0}”; selected and located.",
    "ja": "「{0}」を追加し、選択して位置を表示しました。",
    "ko": "“{0}”을 추가하고 선택하여 위치를 표시했습니다."
  },
  "已移除本地标记，下载的图片不受影响。": {
    "en": "Local mark removed. Downloaded images are unchanged.",
    "ja": "ローカルのマークを削除しました。ダウンロード済み画像には影響しません。",
    "ko": "로컬 표시를 제거했습니다. 다운로드한 이미지는 유지됩니다."
  },
  "已记住 {0} 秒的构图。拖动这个点可改变到达时间。": {
    "en": "Composition saved at {0} s. Drag this point to change arrival time.",
    "ja": "{0} 秒の構図を記録しました。この点をドラッグすると到着時刻を変えられます。",
    "ko": "{0}초 구도를 기록했습니다. 이 점을 드래그해 도착 시간을 바꾸세요."
  },
  "已记住此刻站位。拖上方人物或调整位置，移动会在前后点之间发生。": {
    "en": "Position recorded. Drag the subject above or adjust its position; movement occurs between neighboring points.",
    "ja": "この時刻の位置を記録しました。上の人物をドラッグするか位置を調整すると、前後の点の間を移動します。",
    "ko": "현재 위치를 기록했습니다. 위의 피사체를 드래그하거나 위치를 조정하면 앞뒤 지점 사이에서 이동합니다."
  },
  "已记住示例当前帧。复制顶部的接力指令，由项目 Agent 先导入示例并建立项目绑定。": {
    "en": "Demo frame recorded. Copy the handoff instructions above so the project Agent can import the demo and link it to the project first.",
    "ja": "サンプルの現在フレームを記録しました。上部の引き継ぎ指示をコピーし、まずプロジェクトの Agent にサンプルの取り込みと紐付けを依頼してください。",
    "ko": "데모 프레임을 기록했습니다. 상단 인계 지시를 복사하여 프로젝트 Agent가 먼저 데모를 가져오고 프로젝트에 연결하게 하세요."
  },
  "已记住这帧。点击顶部“保存并交还 Agent”，将接力指令发回原 Flova 项目。": {
    "en": "Frame recorded. Click “Save & return to Agent” above and send the instructions back to the original Flova project.",
    "ja": "フレームを記録しました。上部の「保存して Agent に戻す」を押し、元の Flova プロジェクトに指示を送ってください。",
    "ko": "프레임을 기록했습니다. 상단의 “저장 후 Agent에 반환”을 누르고 원래 Flova 프로젝트로 인계 지시를 보내세요."
  },
  "已记住这帧，但浏览器缓存不可用。请在关闭页面前复制顶部的接力指令。": {
    "en": "Frame recorded, but browser storage is unavailable. Copy the handoff instructions above before closing this page.",
    "ja": "フレームを記録しましたが、ブラウザに保存できません。ページを閉じる前に上部の引き継ぎ指示をコピーしてください。",
    "ko": "프레임을 기록했지만 브라우저 저장소를 사용할 수 없습니다. 페이지를 닫기 전에 상단 인계 지시를 복사하세요."
  },
  "已还原这次试调，之前应用的调整保留。": {
    "en": "This preview was reverted. Previously applied changes are preserved.",
    "ja": "今回の試調整を元に戻しました。以前に適用した変更は保持されています。",
    "ko": "이번 미리 조정을 되돌렸습니다. 이전에 적용한 변경은 유지됩니다."
  },
  "已连接 · v": {
    "en": "Connected · v",
    "ja": "接続済み · v",
    "ko": "연결됨 · v"
  },
  "已选中终点。直接调整上方画面，就会更新这个构图。": {
    "en": "End point selected. Adjust the image above to update this composition.",
    "ja": "終点を選択しました。上の画面を調整すると、この構図を更新できます。",
    "ko": "끝점을 선택했습니다. 위 화면을 조정하면 이 구도가 업데이트됩니다."
  },
  "已选中起点。直接调整上方画面，就会更新这个构图。": {
    "en": "Start point selected. Adjust the image above to update this composition.",
    "ja": "始点を選択しました。上の画面を調整すると、この構図を更新できます。",
    "ko": "시작점을 선택했습니다. 위 화면을 조정하면 이 구도가 업데이트됩니다."
  },
  "已重做。": {
    "en": "Redone.",
    "ja": "やり直しました。",
    "ko": "다시 실행됨."
  },
  "平均移速": {
    "en": "Average speed",
    "ja": "平均移動速度",
    "ko": "평균 이동 속도"
  },
  "平均转速": {
    "en": "Average rotation speed",
    "ja": "平均回転速度",
    "ko": "평균 회전 속도"
  },
  "应用": {
    "en": "Apply",
    "ja": "適用",
    "ko": "적용"
  },
  "应用当前构图": {
    "en": "Apply composition",
    "ja": "現在の構図を適用",
    "ko": "현재 구도 적용"
  },
  "应用当前站位": {
    "en": "Apply position",
    "ja": "現在の位置を適用",
    "ko": "현재 위치 적용"
  },
  "应用本次调整": {
    "en": "Apply changes",
    "ja": "今回の調整を適用",
    "ko": "이번 조정 적용"
  },
  "底": {
    "en": "Bottom",
    "ja": "下",
    "ko": "아래"
  },
  "当前为只读视图，不能添加物体。": {
    "en": "This view is read only. Objects cannot be added.",
    "ja": "読み取り専用ビューのため、物体は追加できません。",
    "ko": "현재 읽기 전용 뷰여서 물체를 추가할 수 없습니다."
  },
  "当前只是试调。先点“应用”或“还原”，再切换时刻或轨道。": {
    "en": "This is a preview. Apply or revert it before changing the time or track.",
    "ja": "現在は試調整中です。「適用」または「元に戻す」の後に時刻やトラックを切り替えてください。",
    "ko": "현재는 미리 조정 중입니다. 적용하거나 되돌린 후 시간이나 트랙을 변경하세요."
  },
  "当前场景最多保留 100 个几何部件，请由 Agent 简化后再添加。": {
    "en": "A scene supports up to 100 geometry parts. Ask the Agent to simplify it before adding more.",
    "ja": "シーンの形状パーツは最大 100 個です。Agent に簡略化を依頼してから追加してください。",
    "ko": "장면당 도형 부품은 최대 100개입니다. Agent에 단순화를 요청한 뒤 추가하세요."
  },
  "当前机位调整已应用。选择新的预设可继续试调。": {
    "en": "Camera adjustments applied. Choose another preset to preview more changes.",
    "ja": "カメラの調整を適用しました。別のプリセットで試調整を続けられます。",
    "ko": "카메라 조정을 적용했습니다. 새 프리셋을 선택해 계속 미리 조정할 수 있습니다."
  },
  "当前镜头已改变，请重新选择放置位置。": {
    "en": "The current shot changed. Choose the placement position again.",
    "ja": "現在のショットが変わりました。配置場所を選び直してください。",
    "ko": "현재 숏이 변경되었습니다. 배치 위치를 다시 선택하세요."
  },
  "当前项目": {
    "en": "Current project",
    "ja": "現在のプロジェクト",
    "ko": "현재 프로젝트"
  },
  "恢复缩放前的俯视图位置": {
    "en": "Restore the top view before fitting",
    "ja": "全体表示前の俯瞰位置に戻す",
    "ko": "전체 보기 전 상단 뷰 위치 복원"
  },
  "所有主体走位与状态共用这一时间效果 摄影机正常运动 总时长不变 编辑主体前请先恢复正常时间": {
    "en": "This timing effect applies to all subject paths and states. The camera moves normally and total duration stays unchanged. Restore normal timing before editing subjects.",
    "ja": "この時間効果は全被写体の移動と状態に適用されます。カメラは通常どおり動き、全長は変わりません。被写体を編集する前に時間を通常に戻してください。",
    "ko": "이 시간 효과는 모든 피사체 이동과 상태에 공통 적용됩니다. 카메라는 정상 이동하며 전체 길이는 유지됩니다. 피사체 편집 전에 정상 시간을 복원하세요."
  },
  "打开项目原版": {
    "en": "Open project baseline",
    "ja": "プロジェクトの元版を開く",
    "ko": "프로젝트 원본 열기"
  },
  "打开项目新版": {
    "en": "Open latest project",
    "ja": "プロジェクト最新版を開く",
    "ko": "최신 프로젝트 열기"
  },
  "把主体、摄影机和路径缩放到全场可见": {
    "en": "Fit all subjects, cameras and paths in view",
    "ja": "被写体・カメラ・経路をすべて表示",
    "ko": "모든 피사체, 카메라, 경로를 화면에 맞추기"
  },
  "把鼠标移到左侧片场，预览位置后点击放置；Esc 可取消。": {
    "en": "Move over the left stage to preview, then click to place. Esc cancels.",
    "ja": "左のステージで位置を確認してクリックすると配置できます。Esc でキャンセル。",
    "ko": "왼쪽 스테이지에서 위치를 미리 확인한 뒤 클릭해 배치하세요. Esc로 취소합니다."
  },
  "拖到时刻 → 试调画面 → 应用。球体调整环绕角度。": {
    "en": "Seek a time → Adjust the view → Apply. Use the sphere to change the orbit angle.",
    "ja": "時刻へ移動 → 画面を試調整 → 適用。球体で周回角度を調整します。",
    "ko": "시간 이동 → 화면 미리 조정 → 적용. 구체로 오빗 각도를 조정합니다."
  },
  "拖画面或球体试调，满意后点应用。自由观察不会改变摄影机。": {
    "en": "Drag the view or sphere to preview, then apply. Free observation does not change the camera.",
    "ja": "画面や球体をドラッグして試調整し、確認後に適用してください。自由な観察は撮影カメラを変えません。",
    "ko": "화면이나 구체를 드래그해 미리 조정한 뒤 적용하세요. 자유 관찰은 촬영 카메라를 바꾸지 않습니다."
  },
  "按场景排列的镜头": {
    "en": "Shots grouped by scene",
    "ja": "シーン別ショット",
    "ko": "장면별 숏"
  },
  "按视频排列的镜头": {
    "en": "Shots grouped by video",
    "ja": "動画別ショット",
    "ko": "영상별 숏"
  },
  "摄影机 · 已定位": {
    "en": "Camera · Located",
    "ja": "カメラ · 位置を表示",
    "ko": "카메라 · 위치 표시됨"
  },
  "摄影机 · 运镜": {
    "en": "Camera · Movement",
    "ja": "カメラ · カメラワーク",
    "ko": "카메라 · 움직임"
  },
  "摄影机轨道 · {0} 秒": {
    "en": "Camera track · {0} s",
    "ja": "カメラトラック · {0} 秒",
    "ko": "카메라 트랙 · {0}초"
  },
  "摄影机运镜": {
    "en": "Camera movement",
    "ja": "カメラワーク",
    "ko": "카메라 움직임"
  },
  "播放": {
    "en": "Play",
    "ja": "再生",
    "ko": "재생"
  },
  "放置位置超出片场范围，请在左侧片场重新选择。": {
    "en": "Placement is outside the stage. Choose another position on the left.",
    "ja": "配置位置がステージ範囲外です。左のステージで選び直してください。",
    "ko": "배치 위치가 스테이지 범위를 벗어났습니다. 왼쪽에서 다시 선택하세요."
  },
  "整镜冻结 · 主体保持源动作 {0} 秒的姿态": {
    "en": "Whole-shot freeze · Subjects hold their source pose at {0} s",
    "ja": "ショット全体を静止 · 被写体は元の動きの {0} 秒の姿勢を保持",
    "ko": "전체 숏 정지 · 피사체가 원본 동작 {0}초의 자세 유지"
  },
  "整镜慢动作 · 主体 {0} 倍速度": {
    "en": "Whole-shot slow motion · Subjects at {0}× speed",
    "ja": "ショット全体をスロー再生 · 被写体は {0} 倍速",
    "ko": "전체 숏 슬로 모션 · 피사체 {0}배속"
  },
  "暂停": {
    "en": "Pause",
    "ja": "一時停止",
    "ko": "일시 정지"
  },
  "暂时无法读取项目工程，请稍后刷新重试。": {
    "en": "The project cannot be loaded right now. Refresh and try again later.",
    "ja": "現在プロジェクトを読み込めません。しばらくしてから更新してください。",
    "ko": "지금 프로젝트를 불러올 수 없습니다. 잠시 후 새로고침해 다시 시도하세요."
  },
  "有一份修改还没交还 Agent": {
    "en": "Changes are awaiting Agent handoff",
    "ja": "Agent に未引き継ぎの変更があります",
    "ko": "Agent에 인계하지 않은 변경 사항이 있습니다"
  },
  "有多份本地修改": {
    "en": "Multiple local drafts found",
    "ja": "複数のローカル変更があります",
    "ko": "로컬 초안이 여러 개 있습니다"
  },
  "有未应用的": {
    "en": "Unapplied ",
    "ja": "未適用の",
    "ko": "적용되지 않은 "
  },
  "未分组镜头": {
    "en": "Ungrouped shots",
    "ja": "未分類ショット",
    "ko": "미분류 숏"
  },
  "未拆镜": {
    "en": "No shots yet",
    "ja": "未分割",
    "ko": "아직 숏 없음"
  },
  "未拆镜 · 空间总览": {
    "en": "No shots yet · Space overview",
    "ja": "未分割 · 空間の全体表示",
    "ko": "아직 숏 없음 · 공간 개요"
  },
  "未能保存本地修改，请先复制交接指令后再刷新。": {
    "en": "Local changes could not be saved. Copy the handoff instructions before refreshing.",
    "ja": "ローカルの変更を保存できませんでした。更新前に引き継ぎ指示をコピーしてください。",
    "ko": "로컬 변경을 저장하지 못했습니다. 새로고침 전에 인계 지시를 복사하세요."
  },
  "本地 v": {
    "en": "Local v",
    "ja": "ローカル v",
    "ko": "로컬 v"
  },
  "本地缓存未保存": {
    "en": "Local draft not saved",
    "ja": "ローカル保存未完了",
    "ko": "로컬 저장 안 됨"
  },
  "本地缓存未保存，请复制交接内容。": {
    "en": "Local storage failed. Copy the handoff content.",
    "ja": "ローカル保存に失敗しました。引き継ぎ内容をコピーしてください。",
    "ko": "로컬 저장에 실패했습니다. 인계 내용을 복사하세요."
  },
  "本地缓存未保存，请复制交接内容。下方包含完整修改，可直接交给原项目 Agent。": {
    "en": "Local storage failed. Copy the handoff below; it includes all changes and can be given directly to the original project Agent.",
    "ja": "ローカル保存に失敗しました。以下の引き継ぎ内容には全変更が含まれるので、コピーして元のプロジェクトの Agent に渡してください。",
    "ko": "로컬 저장에 실패했습니다. 아래 전체 변경 사항을 복사해 원래 프로젝트 Agent에 직접 전달하세요."
  },
  "本地缓存未保存，请复制交接内容。不要关闭当前页面。": {
    "en": "Local storage failed. Copy the handoff content before closing this page.",
    "ja": "ローカル保存に失敗しました。このページを閉じる前に引き継ぎ内容をコピーしてください。",
    "ko": "로컬 저장에 실패했습니다. 현재 페이지를 닫기 전에 인계 내용을 복사하세요."
  },
  "本次试调已还原，之前的运镜保留。": {
    "en": "Preview reverted. The previous camera movement is preserved.",
    "ja": "今回の試調整を元に戻しました。以前のカメラワークは保持されています。",
    "ko": "이번 미리 조정을 되돌렸습니다. 이전 카메라 움직임은 유지됩니다."
  },
  "机位": {
    "en": "camera",
    "ja": "カメラ",
    "ko": "카메라"
  },
  "机身质感试调中，原路径保留。满意后点应用。": {
    "en": "Previewing camera feel; the original path is preserved. Apply when ready.",
    "ja": "カメラの質感を試調整中です。元の経路は保持されています。確認後に適用してください。",
    "ko": "카메라 질감을 미리 조정 중이며 원래 경로는 유지됩니다. 확인 후 적용하세요."
  },
  "构图点已达 24 个。请先选中已有点调整，或删除一个中间点。": {
    "en": "The 24 composition-point limit is reached. Adjust an existing point or remove an intermediate one.",
    "ja": "構図ポイントが上限の 24 個に達しました。既存の点を調整するか、途中の点を削除してください。",
    "ko": "구도점이 한도인 24개에 도달했습니다. 기존 점을 조정하거나 중간 지점을 삭제하세요."
  },
  "查看全场": {
    "en": "Fit stage",
    "ja": "全体を表示",
    "ko": "전체 보기"
  },
  "桌面": {
    "en": "Tabletop",
    "ja": "天板",
    "ko": "테이블 상판"
  },
  "正在试调当前构图，满意后点应用。": {
    "en": "Previewing the current composition. Apply when ready.",
    "ja": "現在の構図を試調整中です。確認後に適用してください。",
    "ko": "현재 구도를 미리 조정 중입니다. 확인 후 적용하세요."
  },
  "正在试调正常主体时间，摄影机路线保留。满意后点应用。": {
    "en": "Previewing normal subject timing; the camera path is preserved. Apply when ready.",
    "ja": "被写体の通常時間を試調整中です。カメラ経路は保持されます。確認後に適用してください。",
    "ko": "정상 피사체 시간을 미리 확인 중이며 카메라 경로는 유지됩니다. 확인 후 적용하세요."
  },
  "此浏览器需要更新才能打开片场链接。": {
    "en": "Update this browser to open the stage link.",
    "ja": "このステージリンクを開くにはブラウザの更新が必要です。",
    "ko": "스테이지 링크를 열려면 브라우저를 업데이트하세요."
  },
  "添加构图点": {
    "en": "Add composition point",
    "ja": "構図ポイントを追加",
    "ko": "구도점 추가"
  },
  "添加站位点": {
    "en": "Add position point",
    "ja": "位置ポイントを追加",
    "ko": "위치점 추가"
  },
  "点路径点可跳转。到达时间决定速度，停留结束后才出发。": {
    "en": "Click a waypoint to jump to it. Arrival time sets speed; movement resumes after the hold.",
    "ja": "経路ポイントをクリックすると移動します。到着時刻が速度を決め、停止時間の終了後に出発します。",
    "ko": "경로점을 클릭해 이동하세요. 도착 시간이 속도를 결정하며 머무름이 끝난 뒤 출발합니다."
  },
  "焦距变化": {
    "en": "Focal length change",
    "ja": "焦点距離の変化",
    "ko": "초점 거리 변화"
  },
  "片场": {
    "en": "Stage",
    "ja": "ステージ",
    "ko": "스테이지"
  },
  "片场不可用": {
    "en": "Stage unavailable",
    "ja": "ステージを利用できません",
    "ko": "스테이지 사용 불가"
  },
  "片场入口缺少完整的项目和工程文档，请从 Flova 的片场入口文档重新打开。": {
    "en": "This link is missing the project or document. Reopen it from the stage entry document in Flova.",
    "ja": "リンクにプロジェクトまたは文書情報がありません。Flova のステージ入口文書から開き直してください。",
    "ko": "링크에 프로젝트 또는 문서 정보가 없습니다. Flova 스테이지 진입 문서에서 다시 여세요."
  },
  "片场已保存。": {
    "en": "Stage saved. ",
    "ja": "ステージを保存しました。",
    "ko": "스테이지 저장됨. "
  },
  "片场已保存，但当前服务没有返回接力链接。": {
    "en": "The stage was saved, but the service did not return a handoff link.",
    "ja": "ステージは保存されましたが、サービスから引き継ぎリンクが返されませんでした。",
    "ko": "스테이지는 저장됐지만 서비스가 인계 링크를 반환하지 않았습니다."
  },
  "片场已在浏览器保存。": {
    "en": "Stage saved in this browser. ",
    "ja": "ステージをこのブラウザに保存しました。",
    "ko": "브라우저에 스테이지가 저장됨. "
  },
  "片场已有新版本。请重新打开片场链接后再编辑。": {
    "en": "A newer stage version is available. Reopen the stage link before editing.",
    "ja": "新しいステージ版があります。リンクを開き直してから編集してください。",
    "ko": "새 스테이지 버전이 있습니다. 편집 전에 링크를 다시 여세요."
  },
  "片场无法打开": {
    "en": "Cannot open stage",
    "ja": "ステージを開けません",
    "ko": "스테이지를 열 수 없음"
  },
  "片场缺少有效的场景数据。": {
    "en": "The stage has no valid scene data.",
    "ja": "有効なシーンデータがありません。",
    "ko": "스테이지에 유효한 장면 데이터가 없습니다."
  },
  "片场视图订阅失败": {
    "en": "Stage view subscription failed",
    "ja": "ステージビューの購読に失敗しました",
    "ko": "스테이지 뷰 구독 실패"
  },
  "片场还未载入，请稍后重试。": {
    "en": "The stage has not loaded yet. Try again shortly.",
    "ja": "ステージがまだ読み込まれていません。少し待ってから再試行してください。",
    "ko": "스테이지를 아직 불러오지 못했습니다. 잠시 후 다시 시도하세요."
  },
  "片场链接无法使用或已过期（": {
    "en": "The stage link is unavailable or expired (",
    "ja": "ステージリンクが無効か期限切れです（",
    "ko": "스테이지 링크를 사용할 수 없거나 만료되었습니다 ("
  },
  "物体工具还未载入，请稍后重试。": {
    "en": "Object tools have not loaded yet. Try again shortly.",
    "ja": "物体ツールがまだ読み込まれていません。少し待ってから再試行してください。",
    "ko": "물체 도구를 아직 불러오지 못했습니다. 잠시 후 다시 시도하세요."
  },
  "状态工具还未就绪，请刷新页面后重试。": {
    "en": "State tools are not ready. Refresh and try again.",
    "ja": "状態ツールの準備ができていません。更新して再試行してください。",
    "ko": "상태 도구가 준비되지 않았습니다. 새로고침 후 다시 시도하세요."
  },
  "示例片场": {
    "en": "Demo stage",
    "ja": "サンプルステージ",
    "ko": "데모 스테이지"
  },
  "示例片场载入失败。": {
    "en": "The demo stage could not be loaded.",
    "ja": "サンプルステージを読み込めませんでした。",
    "ko": "데모 스테이지를 불러오지 못했습니다."
  },
  "移动距离": {
    "en": "Travel distance",
    "ja": "移動距離",
    "ko": "이동 거리"
  },
  "移除": {
    "en": "Remove",
    "ja": "削除",
    "ko": "제거"
  },
  "移除 ": {
    "en": "Remove ",
    "ja": "削除：",
    "ko": "제거: "
  },
  "空间总览": {
    "en": "Space overview",
    "ja": "空間の全体表示",
    "ko": "공간 개요"
  },
  "空间总览 · 只读": {
    "en": "Space overview · Read only",
    "ja": "空間の全体表示 · 読み取り専用",
    "ko": "공간 개요 · 읽기 전용"
  },
  "站位": {
    "en": "position",
    "ja": "位置",
    "ko": "위치"
  },
  "站位 ": {
    "en": "Position ",
    "ja": "位置 ",
    "ko": "위치 "
  },
  "终": {
    "en": "End",
    "ja": "終",
    "ko": "끝"
  },
  "终点": {
    "en": "End",
    "ja": "終点",
    "ko": "끝점"
  },
  "经过 ": {
    "en": "Waypoint ",
    "ja": "通過点 ",
    "ko": "경유점 "
  },
  "结束处没有足够时间表现这个动作。请把播放头往前拖一点。": {
    "en": "There is not enough time left for this action. Move the playhead earlier.",
    "ja": "終点までに動作の時間が足りません。再生ヘッドを少し前に移動してください。",
    "ko": "끝부분에 이 동작을 표현할 시간이 부족합니다. 재생 헤드를 앞쪽으로 이동하세요."
  },
  "继续本地修改": {
    "en": "Continue local draft",
    "ja": "ローカル変更を続ける",
    "ko": "로컬 초안 계속"
  },
  "编辑镜头时长，或开启路径点安排到达、停留和下一段行进。": {
    "en": "Edit shot duration or enable waypoints to schedule arrival, holds and travel.",
    "ja": "ショット長を編集するか、経路ポイントを有効にして到着・停止・次の移動を設定できます。",
    "ko": "숏 길이를 편집하거나 경로점을 켜서 도착, 머무름, 다음 이동을 설정하세요."
  },
  "自定义构图": {
    "en": "Custom composition",
    "ja": "カスタム構図",
    "ko": "사용자 지정 구도"
  },
  "至切镜": {
    "en": "Until cut",
    "ja": "カットまで",
    "ko": "컷 전환까지"
  },
  "草稿 ": {
    "en": "Draft ",
    "ja": "下書き ",
    "ko": "초안 "
  },
  "视频 1": {
    "en": "Video 1",
    "ja": "動画 1",
    "ko": "영상 1"
  },
  "试调": {
    "en": "Preview",
    "ja": "試調整",
    "ko": "미리 조정"
  },
  "试调第 {0} 段，下一段从新终点衔接。满意后点应用。": {
    "en": "Previewing segment {0}. The next segment joins its new end point. Apply when ready.",
    "ja": "区間 {0} を試調整中です。次の区間は新しい終点からつながります。確認後に適用してください。",
    "ko": "{0}구간을 미리 조정합니다. 다음 구간은 새 끝점에서 이어집니다. 확인 후 적용하세요."
  },
  "该镜头没有可对照的修改前版本。": {
    "en": "This shot has no earlier version to compare.",
    "ja": "このショットには比較できる変更前の版がありません。",
    "ko": "이 숏에는 비교할 이전 버전이 없습니다."
  },
  "请复制选中的内容": {
    "en": "Copy the selected content",
    "ja": "選択した内容をコピーしてください",
    "ko": "선택한 내용을 복사하세요"
  },
  "请选择有效的放置方式。": {
    "en": "Choose a valid placement method.",
    "ja": "有効な配置方法を選んでください。",
    "ko": "유효한 배치 방식을 선택하세요."
  },
  "读取工程超时。你的本地修改未被删除，请稍后刷新重试。": {
    "en": "Loading timed out. Your local changes are intact. Refresh and try again later.",
    "ja": "読み込みがタイムアウトしました。ローカルの変更は保持されています。しばらくしてから更新してください。",
    "ko": "불러오기 시간이 초과됐습니다. 로컬 변경은 유지됩니다. 잠시 후 새로고침하세요."
  },
  "调整": {
    "en": " adjustment",
    "ja": "調整があります",
    "ko": " 조정"
  },
  "调整整条圆弧的半径 真实遮挡保留": {
    "en": "Adjust the entire arc radius; real occlusion is preserved",
    "ja": "円弧全体の半径を調整します。実際の遮蔽は保持されます",
    "ko": "전체 원호 반경 조정 · 실제 가림 유지"
  },
  "起": {
    "en": "Start",
    "ja": "始",
    "ko": "시작"
  },
  "起点": {
    "en": "Start",
    "ja": "始点",
    "ko": "시작점"
  },
  "路径点 {0}": {
    "en": "Waypoint {0}",
    "ja": "経路ポイント {0}",
    "ko": "경로점 {0}"
  },
  "路径点到达时间为 {0} 秒。": {
    "en": "Waypoint arrival time: {0} s.",
    "ja": "経路ポイントの到着時刻は {0} 秒です。",
    "ko": "경로점 도착 시간: {0}초."
  },
  "路径点已满。请先删除一些经过点，或选择整条路线。": {
    "en": "Waypoint limit reached. Remove some intermediate points or choose the entire path.",
    "ja": "経路ポイントが上限です。途中の点を削除するか、経路全体を選んでください。",
    "ko": "경로점 한도에 도달했습니다. 경유점을 일부 삭제하거나 전체 경로를 선택하세요."
  },
  "转动角度": {
    "en": "Rotation angle",
    "ja": "回転角度",
    "ko": "회전 각도"
  },
  "载入失败": {
    "en": "Loading failed",
    "ja": "読み込み失敗",
    "ko": "불러오기 실패"
  },
  "过肩构图需要第二个人物作为前景。": {
    "en": "An over-the-shoulder shot needs a second person in the foreground.",
    "ja": "肩越しの構図には前景となる 2 人目の人物が必要です。",
    "ko": "오버 숄더 구도에는 전경에 두 번째 인물이 필요합니다."
  },
  "运动 {0} 秒 · 镜头总长 {1} 秒不变": {
    "en": "Movement {0} s · Shot duration remains {1} s",
    "ja": "移動 {0} 秒 · ショット全長 {1} 秒は維持",
    "ko": "이동 {0}초 · 숏 전체 길이 {1}초 유지"
  },
  "运动镜头": {
    "en": "Moving shot",
    "ja": "移動ショット",
    "ko": "이동 숏"
  },
  "这个主体在当前时刻已隐藏，请先切换到可见时刻。": {
    "en": "This subject is hidden at the current time. Move to a time when it is visible.",
    "ja": "この時刻では被写体が非表示です。表示される時刻に移動してください。",
    "ko": "현재 시점에 이 피사체가 숨겨져 있습니다. 보이는 시점으로 이동하세요."
  },
  "这个场景已不在当前工程中，请从全部片场重新选择。": {
    "en": "This scene is no longer in the project. Choose another from all scenes.",
    "ja": "このシーンは現在のプロジェクトにありません。全ステージから選び直してください。",
    "ko": "이 장면은 현재 프로젝트에 없습니다. 전체 스테이지에서 다시 선택하세요."
  },
  "这个时间已有构图，已为你选中。调整上方画面即可更新。": {
    "en": "A composition already exists here and is selected. Adjust the image above to update it.",
    "ja": "この時刻の構図を選択しました。上の画面を調整すると更新できます。",
    "ko": "이 시점에 이미 구도가 있어 선택했습니다. 위 화면을 조정해 업데이트하세요."
  },
  "这个物体已不在当前片场。": {
    "en": "This object is no longer in the stage.",
    "ja": "この物体は現在のステージにありません。",
    "ko": "이 물체는 현재 스테이지에 없습니다."
  },
  "这个视频在指定场景中没有镜头，已打开全部片场，请重新选择。": {
    "en": "This video has no shots in the selected scene. All scenes are shown; select another.",
    "ja": "この動画には指定シーンのショットがありません。全ステージから選び直してください。",
    "ko": "이 영상은 지정 장면에 숏이 없습니다. 전체 스테이지에서 다시 선택하세요."
  },
  "这个调整会使摄影机与注视点重合或超出场地范围，请先调整距离。": {
    "en": "This change would overlap the camera and target or exceed stage bounds. Adjust the distance first.",
    "ja": "この調整ではカメラと注視点が重なるか、ステージ範囲を超えます。まず距離を調整してください。",
    "ko": "이 조정은 카메라와 주시점을 겹치게 하거나 스테이지 범위를 벗어납니다. 먼저 거리를 조정하세요."
  },
  "这帧已经标记，可继续拍摄其他时间点。": {
    "en": "This frame is already marked. Capture another time point.",
    "ja": "このフレームはマーク済みです。別の時刻を撮影できます。",
    "ko": "이미 표시한 프레임입니다. 다른 시점을 캡처하세요."
  },
  "这是示例片场。你可以试调机位，再复制一条可发给 Agent 的接力指令。": {
    "en": "This is a demo stage. Try adjusting the camera, then copy handoff instructions to send to your Agent.",
    "ja": "サンプルステージです。カメラを試調整し、Agent に送る引き継ぎ指示をコピーできます。",
    "ko": "데모 스테이지입니다. 카메라를 미리 조정한 뒤 Agent에 보낼 인계 지시를 복사하세요."
  },
  "这条镜头已不在当前工程中，请从全部片场重新选择。": {
    "en": "This shot is no longer in the project. Choose another from all scenes.",
    "ja": "このショットは現在のプロジェクトにありません。全ステージから選び直してください。",
    "ko": "이 숏은 현재 프로젝트에 없습니다. 전체 스테이지에서 다시 선택하세요."
  },
  "这里已有站位点，调整人物即可更新。": {
    "en": "A position point already exists here. Adjust the subject to update it.",
    "ja": "ここには位置ポイントがあります。人物を調整すると更新できます。",
    "ko": "여기에 이미 위치점이 있습니다. 피사체를 조정해 업데이트하세요."
  },
  "选择主体": {
    "en": "Select subject",
    "ja": "被写体を選択",
    "ko": "피사체 선택"
  },
  "选择未交接草稿": {
    "en": "Choose a pending draft",
    "ja": "未引き継ぎの下書きを選択",
    "ko": "인계 대기 초안 선택"
  },
  "选择路径与机身质感，试调后点击应用。": {
    "en": "Choose a path and camera feel, preview, then apply.",
    "ja": "経路とカメラの質感を選び、試調整して適用してください。",
    "ko": "경로와 카메라 질감을 선택하고 미리 조정한 뒤 적용하세요."
  },
  "道具": {
    "en": "Prop",
    "ja": "小道具",
    "ko": "소품"
  },
  "顶": {
    "en": "Top",
    "ja": "上",
    "ko": "위"
  },
  "项目入口不完整，请从 Flova 的片场入口文档重新打开。": {
    "en": "The project link is incomplete. Reopen it from the stage entry document in Flova.",
    "ja": "プロジェクトリンクが不完全です。Flova のステージ入口文書から開き直してください。",
    "ko": "프로젝트 링크가 불완전합니다. Flova 스테이지 진입 문서에서 다시 여세요."
  },
  "项目工程 · v": {
    "en": "Project document · v",
    "ja": "プロジェクト文書 · v",
    "ko": "프로젝트 문서 · v"
  },
  "项目工程当前为 v": {
    "en": "The project is currently v",
    "ja": "現在のプロジェクトは v",
    "ko": "현재 프로젝트 버전은 v"
  },
  "项目片场": {
    "en": "Project stage",
    "ja": "プロジェクトのステージ",
    "ko": "프로젝트 스테이지"
  },
  "飞行范围": {
    "en": "Flight range",
    "ja": "飛行範囲",
    "ko": "비행 범위"
  },
  "默认已按附近薄墙收紧 留出 0.25 m 余量 可手动调整": {
    "en": "Adjusted for nearby thin walls with 0.25 m clearance; you can change it",
    "ja": "周囲の薄い壁に合わせて 0.25 m の余裕を確保済み。手動調整も可能",
    "ko": "주변 얇은 벽에 맞춰 0.25 m 여유 확보 · 수동 조정 가능"
  },
  "，仅移动观察视图，拍摄机位保持不变。": {
    "en": ". Only the observation view moved; the shooting camera is unchanged.",
    "ja": "。観察ビューだけを移動しました。撮影カメラは変わりません。",
    "ko": ". 관찰 뷰만 이동하며 촬영 카메라는 유지됩니다."
  },
  "，此刻处于隐藏状态，虚线框标出当前位置。": {
    "en": ". It is hidden at this time; the dashed box marks its position.",
    "ja": "。現在は非表示です。点線の枠が現在位置を示します。",
    "ko": ". 현재 숨김 상태이며 점선 상자가 현재 위치를 표시합니다."
  },
  "界面语言": {
    "en": "Interface language",
    "ja": "表示言語",
    "ko": "인터페이스 언어"
  },
  "退出 Flova 授权": {
    "en": "Disconnect Flova",
    "ja": "Flova 連携を解除",
    "ko": "Flova 연결 해제"
  },
  "远景": {
    "en": "Extreme wide",
    "ja": "超ロング",
    "ko": "익스트림 와이드"
  },
  "全景": {
    "en": "Wide",
    "ja": "ロング",
    "ko": "와이드"
  },
  "环境全景": {
    "en": "Establishing wide",
    "ja": "環境のロング",
    "ko": "환경 와이드"
  },
  "全身": {
    "en": "Full body",
    "ja": "全身",
    "ko": "전신"
  },
  "中景": {
    "en": "Medium",
    "ja": "ミディアム",
    "ko": "미디엄"
  },
  "中近景": {
    "en": "Medium close-up",
    "ja": "ミディアムクローズ",
    "ko": "미디엄 클로즈업"
  },
  "近景": {
    "en": "Close-up",
    "ja": "クローズ",
    "ko": "클로즈업"
  },
  "特写": {
    "en": "Extreme close-up",
    "ja": "アップ",
    "ko": "익스트림 클로즈업"
  },
  "双人": {
    "en": "Two-shot",
    "ja": "ツーショット",
    "ko": "투 숏"
  },
  "双人镜头": {
    "en": "Two-shot",
    "ja": "ツーショット",
    "ko": "투 숏"
  },
  "过肩": {
    "en": "Over the shoulder",
    "ja": "肩越し",
    "ko": "오버 숄더"
  },
  "俯视": {
    "en": "High angle",
    "ja": "俯瞰",
    "ko": "하이 앵글"
  },
  "低机位": {
    "en": "Low angle",
    "ja": "ローアングル",
    "ko": "로우 앵글"
  },
  "俯仰摇摄": {
    "en": "Tilt",
    "ja": "縦パン",
    "ko": "틸트"
  },
  "垂直升降": {
    "en": "Pedestal",
    "ja": "垂直移動",
    "ko": "페데스탈"
  },
  "变焦": {
    "en": "Zoom",
    "ja": "ズーム",
    "ko": "줌"
  },
  "推拉变焦": {
    "en": "Dolly zoom",
    "ja": "ドリーズーム",
    "ko": "돌리 줌"
  },
  "手持": {
    "en": "Handheld",
    "ja": "手持ち",
    "ko": "핸드헬드"
  },
  "肩扛": {
    "en": "Shoulder-mounted",
    "ja": "肩載せ",
    "ko": "숄더 마운트"
  },
  "推进": {
    "en": "Push in",
    "ja": "プッシュイン",
    "ko": "푸시 인"
  },
  "拉远": {
    "en": "Pull out",
    "ja": "プルアウト",
    "ko": "풀 아웃"
  },
  "横摇": {
    "en": "Pan",
    "ja": "横パン",
    "ko": "팬"
  },
  "横移": {
    "en": "Truck",
    "ja": "横移動",
    "ko": "트럭"
  },
  "跟拍": {
    "en": "Track",
    "ja": "追従",
    "ko": "트래킹"
  },
  "摇臂": {
    "en": "Jib",
    "ja": "ジブ",
    "ko": "지브"
  },
  "绕拍": {
    "en": "Orbit",
    "ja": "周回",
    "ko": "오빗"
  },
  "呼吸感": {
    "en": "Breathing",
    "ja": "呼吸感",
    "ko": "호흡감"
  },
  "交接场景": {
    "en": "Handoff scene",
    "ja": "引き継ぎシーン",
    "ko": "인계 장면"
  },
  "交接道具": {
    "en": "Handoff prop",
    "ja": "受け渡し小道具",
    "ko": "인계 소품"
  },
  "双人站位": {
    "en": "Two-person blocking",
    "ja": "二人の立ち位置",
    "ko": "두 사람 배치"
  },
  "平视": {
    "en": "Eye level",
    "ja": "目線の高さ",
    "ko": "아이 레벨"
  },
  "广角": {
    "en": "Wide angle",
    "ja": "広角",
    "ko": "광각"
  },
  "建立空间": {
    "en": "Establish the space",
    "ja": "空間の導入",
    "ko": "공간 설정"
  },
  "桌体": {
    "en": "Table base",
    "ja": "テーブル本体",
    "ko": "테이블 본체"
  },
  "桌面高度": {
    "en": "Table height",
    "ja": "天板の高さ",
    "ko": "테이블 높이"
  },
  "正侧": {
    "en": "Front-side angle",
    "ja": "正面寄りの側面",
    "ko": "정측면"
  },
  "演员 A": {
    "en": "Actor A",
    "ja": "俳優 A",
    "ko": "배우 A"
  },
  "演员 A 头部": {
    "en": "Actor A head",
    "ja": "俳優 A の頭",
    "ko": "배우 A 머리"
  },
  "演员 B": {
    "en": "Actor B",
    "ja": "俳優 B",
    "ko": "배우 B"
  },
  "演员 B 头部": {
    "en": "Actor B head",
    "ja": "俳優 B の頭",
    "ko": "배우 B 머리"
  },
  "白模示例": {
    "en": "White-model demo",
    "ja": "白モデルのサンプル",
    "ko": "흰색 모델 데모"
  },
  "窗口": {
    "en": "Window",
    "ja": "窓",
    "ko": "창문"
  },
  "绕过桌台": {
    "en": "Around the table",
    "ja": "テーブルを回る",
    "ko": "테이블 주변 이동"
  },
  "背景墙": {
    "en": "Backdrop wall",
    "ja": "背景の壁",
    "ko": "배경 벽"
  },
  "轻手持": {
    "en": "Subtle handheld",
    "ja": "控えめな手持ち",
    "ko": "약한 핸드헬드"
  },
  "门框右柱": {
    "en": "Doorframe right post",
    "ja": "ドア枠の右柱",
    "ko": "문틀 오른쪽 기둥"
  },
  "门框左柱": {
    "en": "Doorframe left post",
    "ja": "ドア枠の左柱",
    "ko": "문틀 왼쪽 기둥"
  },
  "门梁": {
    "en": "Door lintel",
    "ja": "ドアの上枠",
    "ko": "문 상인방"
  },
  "高机位": {
    "en": "High camera",
    "ja": "高いカメラ位置",
    "ko": "높은 카메라"
  },
  "片场链接无法使用或已过期（{status}）。": {
    "en": "The stage link is unavailable or expired ({status}).",
    "ja": "ステージリンクが無効か期限切れです（{status}）。",
    "ko": "스테이지 링크를 사용할 수 없거나 만료되었습니다 ({status})."
  },
  "本地 v{local} · 项目 v{project}": {
    "en": "Local v{local} · Project v{project}",
    "ja": "ローカル v{local} · プロジェクト v{project}",
    "ko": "로컬 v{local} · 프로젝트 v{project}"
  },
  "有未应用的{kind}调整": {
    "en": "Unapplied {kind} adjustment",
    "ja": "未適用の{kind}調整があります",
    "ko": "적용되지 않은 {kind} 조정"
  },
  "{0} · 试调整条路线，镜头总长不变。满意后点应用。": {
    "en": "{0} · Previewing the full path; shot duration is unchanged. Apply when ready.",
    "ja": "{0} · 経路全体を試調整中。全長は変わりません。確認後に適用してください。",
    "ko": "{0} · 전체 경로를 미리 조정합니다. 숏 길이는 유지됩니다. 확인 후 적용하세요."
  },
  "{0}作用于整镜所有主体，已切换整条路线；镜头总时长保持不变。": {
    "en": "{0} applies to all subjects throughout the shot. Switched to the full path; shot duration is unchanged.",
    "ja": "{0}は全ショットの全被写体に適用されます。経路全体に切り替えました。全長は変わりません。",
    "ko": "{0} 효과는 전체 숏의 모든 피사체에 적용됩니다. 전체 경로로 전환했으며 숏 길이는 유지됩니다."
  },
  "已在 {0} 秒加入状态变化，拖动时间轴即可检查。": {
    "en": "State change added at {0} s. Scrub the timeline to review.",
    "ja": "{0} 秒に状態変化を追加しました。タイムラインで確認できます。",
    "ko": "{0}초에 상태 변화를 추가했습니다. 타임라인을 이동해 확인하세요."
  },
  "项目工程当前为 v{revision}。你的本地修改已保留，选择继续旧草稿，或打开项目新版。两份内容不会互相覆盖。": {
    "en": "The project is at v{revision}. Your local changes are preserved. Continue the earlier draft or open the latest version; neither overwrites the other.",
    "ja": "現在のプロジェクトは v{revision} です。ローカル変更は保持されています。以前の下書きを続けるか、最新版を開いてください。互いに上書きされません。",
    "ko": "현재 프로젝트는 v{revision}입니다. 로컬 변경은 보존됩니다. 이전 초안을 계속하거나 최신 버전을 여세요. 서로 덮어쓰지 않습니다."
  },
  "的镜头 {names}": {
    "en": " shots {names}",
    "ja": " のショット {names} ",
    "ko": "의 숏 {names}"
  },
  "{names} 已保存。": {
    "en": "{names} saved. ",
    "ja": "{names} を保存しました。",
    "ko": "{names} 저장됨. "
  },
  "{names} 已在浏览器保存。": {
    "en": "{names} saved in this browser. ",
    "ja": "{names} をこのブラウザに保存しました。",
    "ko": "{names} 브라우저에 저장됨. "
  },
  "{saved}将接力指令发回 Flova 项目。": {
    "en": "{saved}Send the handoff instructions back to the Flova project.",
    "ja": "{saved}引き継ぎ指示を Flova プロジェクトに送ってください。",
    "ko": "{saved}인계 지시를 Flova 프로젝트로 보내세요."
  },
  "{saved}复制指令并发回原项目，Agent 就能接着执行。": {
    "en": "{saved}Copy the instructions back to the original project so the Agent can continue.",
    "ja": "{saved}指示をコピーして元のプロジェクトに送ると、Agent が作業を続けられます。",
    "ko": "{saved}지시를 복사해 원래 프로젝트로 보내면 Agent가 이어서 작업할 수 있습니다."
  },
  "工程文档格式不完整，请让项目 Agent 重新保存片场工程。": {
    "en": "The project document format is incomplete. Ask the project Agent to save the stage project again.",
    "ja": "プロジェクト文書の形式が不完全です。プロジェクトの Agent に再保存を依頼してください。",
    "ko": "프로젝트 문서 형식이 불완전합니다. 프로젝트 Agent에 스테이지 프로젝트를 다시 저장하도록 요청하세요."
  },
  "这份文档不是完整的片场工程，请让项目 Agent 检查并重新保存。": {
    "en": "This document is not a complete stage project. Ask the project Agent to check and save it again.",
    "ja": "この文書は完全なステージプロジェクトではありません。Agent に確認と再保存を依頼してください。",
    "ko": "완전한 스테이지 프로젝트 문서가 아닙니다. 프로젝트 Agent에 확인 후 다시 저장하도록 요청하세요."
  },
  "工程数据不完整，请让项目 Agent 核对场景、镜头和项目绑定。": {
    "en": "Project data is incomplete. Ask the Agent to check scenes, shots and project links.",
    "ja": "プロジェクトデータが不完全です。Agent にシーン・ショット・紐付けの確認を依頼してください。",
    "ko": "프로젝트 데이터가 불완전합니다. Agent에 장면, 숏, 프로젝트 연결을 확인하도록 요청하세요."
  },
  "工程索引与当前项目不匹配，请从原项目重新打开。": {
    "en": "The project index does not match this project. Reopen it from the original project.",
    "ja": "プロジェクト索引が現在のプロジェクトと一致しません。元のプロジェクトから開き直してください。",
    "ko": "프로젝트 인덱스가 현재 프로젝트와 일치하지 않습니다. 원래 프로젝트에서 다시 여세요."
  },
  "工程索引无效，请让项目 Agent 核对当前工程文档和版本。": {
    "en": "The project index is invalid. Ask the Agent to check the current document and version.",
    "ja": "プロジェクト索引が無効です。Agent に現在の文書と版の確認を依頼してください。",
    "ko": "프로젝트 인덱스가 잘못되었습니다. Agent에 현재 문서와 버전을 확인하도록 요청하세요."
  },
  "工程入口信息过大。": {
    "en": "The project entry information is too large.",
    "ja": "プロジェクト入口情報が大きすぎます。",
    "ko": "프로젝트 진입 정보가 너무 큽니다."
  },
  "工程入口无效，请从 Flova 项目重新打开。": {
    "en": "The project link is invalid. Reopen it from the Flova project.",
    "ja": "プロジェクト入口が無効です。Flova プロジェクトから開き直してください。",
    "ko": "프로젝트 링크가 잘못되었습니다. Flova 프로젝트에서 다시 여세요."
  },
  "缺少项目或工程文档信息，请从 Flova 项目的片场入口打开。": {
    "en": "Project or document information is missing. Open the stage from its entry in the Flova project.",
    "ja": "プロジェクトまたは文書情報がありません。Flova プロジェクトのステージ入口から開いてください。",
    "ko": "프로젝트 또는 문서 정보가 없습니다. Flova 프로젝트의 스테이지 진입점에서 여세요."
  },
  "读取期间工程已更新，请重新打开以载入完整的新版本。": {
    "en": "The project changed while loading. Reopen it to load the complete new version.",
    "ja": "読み込み中にプロジェクトが更新されました。完全な最新版を読み込むため、開き直してください。",
    "ko": "불러오는 동안 프로젝트가 업데이트되었습니다. 전체 새 버전을 불러오려면 다시 여세요."
  },
  "当前 Flova 账号无法读取这份工程，请确认项目和文档访问权限。": {
    "en": "This Flova account cannot read the project. Check project and document access permissions.",
    "ja": "現在の Flova アカウントでは読み込めません。プロジェクトと文書のアクセス権を確認してください。",
    "ko": "현재 Flova 계정으로 이 프로젝트를 읽을 수 없습니다. 프로젝트와 문서 접근 권한을 확인하세요."
  },
  "当前账号无法访问这个 Flova 项目。": {
    "en": "This account cannot access this Flova project.",
    "ja": "現在のアカウントではこの Flova プロジェクトにアクセスできません。",
    "ko": "현재 계정으로 이 Flova 프로젝트에 접근할 수 없습니다."
  },
  "工程文档与当前项目不匹配，请从原项目重新打开。": {
    "en": "The document does not match this project. Reopen it from the original project.",
    "ja": "文書が現在のプロジェクトと一致しません。元のプロジェクトから開き直してください。",
    "ko": "문서가 현재 프로젝트와 일치하지 않습니다. 원래 프로젝트에서 다시 여세요."
  },
  "工程文档读取不完整，请稍后重试。": {
    "en": "The project document did not load completely. Try again shortly.",
    "ja": "プロジェクト文書を完全に読み込めませんでした。しばらくしてから再試行してください。",
    "ko": "프로젝트 문서를 완전히 읽지 못했습니다. 잠시 후 다시 시도하세요."
  },
  "工程文档分页不完整，请稍后重试。": {
    "en": "Some project document pages are missing. Try again shortly.",
    "ja": "プロジェクト文書のページが不足しています。しばらくしてから再試行してください。",
    "ko": "프로젝트 문서 일부 페이지가 누락되었습니다. 잠시 후 다시 시도하세요."
  },
  "工程内容被截断，请让项目 Agent 按完整工程重新保存。": {
    "en": "Project content was truncated. Ask the Agent to save the complete project again.",
    "ja": "プロジェクトの内容が途切れています。Agent に全体の再保存を依頼してください。",
    "ko": "프로젝트 내용이 잘렸습니다. Agent에 전체 프로젝트를 다시 저장하도록 요청하세요."
  },
  "工程文档行号不连续，请重新载入。": {
    "en": "The project document has missing line numbers. Reload it.",
    "ja": "プロジェクト文書の行番号が連続していません。再読み込みしてください。",
    "ko": "프로젝트 문서의 줄 번호가 연속적이지 않습니다. 다시 불러오세요."
  },
  "工程超过当前打开上限，请让项目 Agent 精简白模或拆分工程文档。": {
    "en": "The project exceeds the current size limit. Ask the Agent to simplify the white model or split the document.",
    "ja": "プロジェクトがサイズ上限を超えています。Agent に白モデルの簡略化か文書の分割を依頼してください。",
    "ko": "프로젝트가 현재 크기 한도를 초과했습니다. Agent에 흰색 모델 단순화 또는 문서 분할을 요청하세요."
  },
  "工程文档分页过多，请让项目 Agent 精简后重新保存。": {
    "en": "The project has too many document pages. Ask the Agent to simplify and save it again.",
    "ja": "プロジェクト文書のページ数が多すぎます。Agent に簡略化と再保存を依頼してください。",
    "ko": "프로젝트 문서 페이지가 너무 많습니다. Agent에 단순화 후 다시 저장하도록 요청하세요."
  },
  "工程索引超过 8 KiB，请让项目 Agent 只保留当前工程的文档标识与版本。": {
    "en": "The project index exceeds 8 KiB. Ask the Agent to retain only the current document ID and version.",
    "ja": "プロジェクト索引が 8 KiB を超えています。Agent に現在の文書 ID と版だけを残すよう依頼してください。",
    "ko": "프로젝트 인덱스가 8 KiB를 초과했습니다. Agent에 현재 문서 ID와 버전만 남기도록 요청하세요."
  },
  "工程索引只能直接指向一份工程，不能嵌套另一份索引。": {
    "en": "A project index must point directly to one project document, not another index.",
    "ja": "索引は単一のプロジェクト文書を直接参照する必要があります。別の索引は参照できません。",
    "ko": "프로젝트 인덱스는 한 프로젝트 문서를 직접 가리켜야 하며 다른 인덱스를 중첩할 수 없습니다."
  },
  "索引指向的工程不属于当前项目。": {
    "en": "The indexed document belongs to a different project.",
    "ja": "索引先の文書は現在のプロジェクトに属していません。",
    "ko": "인덱스가 가리키는 문서는 현재 프로젝트에 속하지 않습니다."
  },
  "索引与工程标识或版本不一致，请让项目 Agent 核对后重新打开。": {
    "en": "The index and project ID or version do not match. Ask the Agent to check them, then reopen.",
    "ja": "索引とプロジェクトの ID または版が一致しません。Agent に確認を依頼してから開き直してください。",
    "ko": "인덱스와 프로젝트 ID 또는 버전이 일치하지 않습니다. Agent에 확인을 요청한 뒤 다시 여세요."
  },
  "暂时无法读取 Flova 工程，请稍后重试；本地未交接修改不会被覆盖。": {
    "en": "The Flova project cannot be loaded right now. Try again later; local pending changes will not be overwritten.",
    "ja": "現在 Flova プロジェクトを読み込めません。後ほど再試行してください。ローカルの未引き継ぎ変更は上書きされません。",
    "ko": "지금 Flova 프로젝트를 읽을 수 없습니다. 나중에 다시 시도하세요. 로컬 인계 대기 변경은 덮어쓰지 않습니다."
  },
  "参考信息过大。": {
    "en": "The reference information is too large.",
    "ja": "参考情報が大きすぎます。",
    "ko": "참고 정보가 너무 큽니다."
  },
  "缺少项目或参考素材标识。": {
    "en": "Project or reference asset ID is missing.",
    "ja": "プロジェクトまたは参考素材の ID がありません。",
    "ko": "프로젝트 또는 참고 에셋 ID가 없습니다."
  },
  "当前账号无法读取参考素材，请回 Flova 检查访问权限。": {
    "en": "This account cannot read the reference. Check access permissions in Flova.",
    "ja": "このアカウントでは参考素材を読み込めません。Flova でアクセス権を確認してください。",
    "ko": "현재 계정으로 참고 자료를 읽을 수 없습니다. Flova에서 접근 권한을 확인하세요."
  },
  "无法访问这个 Flova 项目。": {
    "en": "This Flova project cannot be accessed.",
    "ja": "この Flova プロジェクトにアクセスできません。",
    "ko": "이 Flova 프로젝트에 접근할 수 없습니다."
  },
  "参考不是此项目中的视频素材。": {
    "en": "The reference is not a video asset in this project.",
    "ja": "この参考は現在のプロジェクトの動画素材ではありません。",
    "ko": "이 참고 자료는 현재 프로젝트의 영상 에셋이 아닙니다."
  },
  "参考地址暂不可用。": {
    "en": "The reference URL is currently unavailable.",
    "ja": "参考の URL は現在利用できません。",
    "ko": "참고 URL을 현재 사용할 수 없습니다."
  },
  "无法载入参考视频。请确认原素材仍在项目中，然后重新载入。": {
    "en": "The reference video could not be loaded. Confirm the source asset is still in the project, then reload.",
    "ja": "参考動画を読み込めませんでした。元の素材がプロジェクト内に残っていることを確認して再読み込みしてください。",
    "ko": "참고 영상을 불러올 수 없습니다. 원본 에셋이 프로젝트에 있는지 확인한 뒤 다시 불러오세요."
  },
  "{count} 场景": {
    "en": "Scenes: {count}",
    "ja": "{count} シーン",
    "ko": "장면 {count}개"
  },
  "{count} 镜": {
    "en": "Shots: {count}",
    "ja": "{count} ショット",
    "ko": "숏 {count}개"
  }
});
