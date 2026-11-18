/* Secondary editor UI messages. Scene, shot, actor, and object names are not translated. */
(function(scope){
  const catalog={
  "方块": {
    "en": "Box",
    "ja": "ボックス",
    "ko": "상자"
  },
  "球体": {
    "en": "Sphere",
    "ja": "球体",
    "ko": "구체"
  },
  "圆柱": {
    "en": "Cylinder",
    "ja": "円柱",
    "ko": "원기둥"
  },
  "简易人物": {
    "en": "Simple person",
    "ja": "簡易人物",
    "ko": "간단한 인물"
  },
  "墙体、桌台、道具": {
    "en": "Walls, tables, props",
    "ja": "壁・テーブル・小道具",
    "ko": "벽 테이블 소품"
  },
  "球形物与标记": {
    "en": "Round objects and markers",
    "ja": "球形の物体とマーカー",
    "ko": "구형 물체와 마커"
  },
  "柱体与立式道具": {
    "en": "Columns and upright props",
    "ja": "柱と縦長の小道具",
    "ko": "기둥과 세워 놓는 소품"
  },
  "头身一起移动": {
    "en": "Head and body move together",
    "ja": "頭と体をまとめて移動",
    "ko": "머리와 몸을 함께 이동"
  },
  "请选择方块、球体、圆柱或简易人物。": {
    "en": "Choose a box, sphere, cylinder, or simple person.",
    "ja": "ボックス・球体・円柱・簡易人物を選択してください。",
    "ko": "상자 구체 원기둥 또는 간단한 인물을 선택하세요."
  },
  "每个尺寸需要在 0.05–30 米之间。": {
    "en": "Each dimension must be between 0.05 and 30 m.",
    "ja": "各寸法は 0.05〜30 m にしてください。",
    "ko": "각 치수는 0.05~30m 사이여야 합니다."
  },
  "名称请使用 1–64 个可见字符。": {
    "en": "Use 1–64 visible characters for the name.",
    "ja": "名前は表示可能な 1〜64 文字にしてください。",
    "ko": "이름은 표시 가능한 1~64자로 입력하세요."
  },
  "请选择有效颜色。": {
    "en": "Choose a valid color.",
    "ja": "有効な色を選択してください。",
    "ko": "유효한 색상을 선택하세요."
  },
  "新物体标识无效。": {
    "en": "The new object ID is invalid.",
    "ja": "新しい物体の ID が無効です。",
    "ko": "새 물체 ID가 올바르지 않습니다."
  },
  "放置位置无效。": {
    "en": "The placement position is invalid.",
    "ja": "配置位置が無効です。",
    "ko": "배치 위치가 올바르지 않습니다."
  },
  " · 头部": {
    "en": " · Head",
    "ja": " · 頭部",
    "ko": " · 머리"
  },
  "尚未添加物体，请先应用或还原当前调整，再选择放置位置。": {
    "en": "Apply or revert the current preview, then choose where to place the object.",
    "ja": "現在の試調整を適用または元に戻してから、配置位置を選んでください。",
    "ko": "현재 미리보기 조정을 적용하거나 되돌린 다음 배치 위치를 선택하세요."
  },
  "手动添加物体": {
    "en": "Add an object manually",
    "ja": "物体を手動追加",
    "ko": "물체 직접 추가"
  },
  "添加物体": {
    "en": "Add object",
    "ja": "物体を追加",
    "ko": "물체 추가"
  },
  "先选物体和尺寸，再决定放在哪里。添加后会自动选中并定位。": {
    "en": "Choose the object and size, then its position. The new object will be selected and located.",
    "ja": "物体とサイズを選び、配置位置を決めます。追加後は自動で選択し、位置を表示します。",
    "ko": "물체와 크기를 선택한 다음 위치를 정하세요. 추가된 물체가 자동으로 선택되고 화면에 표시됩니다."
  },
  "选择几何体类型": {
    "en": "Choose a shape",
    "ja": "形状を選択",
    "ko": "도형 선택"
  },
  "物体名称": {
    "en": "Object name",
    "ja": "物体名",
    "ko": "물체 이름"
  },
  "留空自动编号": {
    "en": "Leave blank to auto-number",
    "ja": "空欄なら自動採番",
    "ko": "비워 두면 자동 번호 지정"
  },
  "新物体名称": {
    "en": "New object name",
    "ja": "新しい物体名",
    "ko": "새 물체 이름"
  },
  "新物体颜色": {
    "en": "New object color",
    "ja": "新しい物体の色",
    "ko": "새 물체 색상"
  },
  "石灰": {
    "en": "Limestone",
    "ja": "石灰色",
    "ko": "석회색"
  },
  "雾蓝": {
    "en": "Mist blue",
    "ja": "ミストブルー",
    "ko": "안개빛 파랑"
  },
  "陶土": {
    "en": "Terracotta",
    "ja": "テラコッタ",
    "ko": "테라코타"
  },
  "鼠尾草": {
    "en": "Sage",
    "ja": "セージ",
    "ko": "세이지"
  },
  "浅灰紫": {
    "en": "Pale lavender",
    "ja": "淡いラベンダー",
    "ko": "연한 회보라"
  },
  "宽度": {
    "en": "Width",
    "ja": "幅",
    "ko": "너비"
  },
  "高度": {
    "en": "Height",
    "ja": "高さ",
    "ko": "높이"
  },
  "进深": {
    "en": "Depth",
    "ja": "奥行き",
    "ko": "깊이"
  },
  "（米）": {
    "en": " (m)",
    "ja": "（m）",
    "ko": " (m)"
  },
  " 米": {
    "en": " m",
    "ja": " m",
    "ko": " m"
  },
  "需要在 0.05–30 米之间。": {
    "en": " must be between 0.05 and 30 m.",
    "ja": "は 0.05〜30 m にしてください。",
    "ko": " 값은 0.05~30m 사이여야 합니다."
  },
  "新物体": {
    "en": "New object",
    "ja": "新しい物体",
    "ko": "새 물체"
  },
  "恢复默认尺寸": {
    "en": "Reset size",
    "ja": "標準サイズに戻す",
    "ko": "기본 크기로 복원"
  },
  "滑动精调常用尺寸，也可直接输入米数。": {
    "en": "Fine-tune with the sliders or enter a size in meters.",
    "ja": "スライダーで微調整、またはメートルで直接入力できます。",
    "ko": "슬라이더로 미세 조정하거나 미터 단위로 직접 입력하세요."
  },
  "放置位置": {
    "en": "Placement position",
    "ja": "配置位置",
    "ko": "배치 위치"
  },
  "放在哪里": {
    "en": "Place at",
    "ja": "配置する場所",
    "ko": "배치할 위치"
  },
  "片场点选": {
    "en": "Click on stage",
    "ja": "ステージをクリック",
    "ko": "스테이지에서 선택"
  },
  "在左侧片场点击地面放置": {
    "en": "Click the ground in the left stage view.",
    "ja": "左側のステージの地面をクリックして配置",
    "ko": "왼쪽 스테이지의 바닥을 클릭하여 배치"
  },
  "摄影机注视点": {
    "en": "Camera target",
    "ja": "カメラの注視点",
    "ko": "카메라 주시점"
  },
  "放到摄影机注视点对应的地面": {
    "en": "Place on the ground below the camera target.",
    "ja": "カメラの注視点の真下の地面に配置",
    "ko": "카메라 주시점 아래 바닥에 배치"
  },
  "选中主体旁": {
    "en": "Beside selected subject",
    "ja": "選択した被写体の横",
    "ko": "선택한 피사체 옆"
  },
  "放到当前选中主体旁边，保留间距": {
    "en": "Place beside the selected subject with a gap.",
    "ja": "選択した被写体の横に間隔を空けて配置",
    "ko": "선택한 피사체 옆에 간격을 두고 배치"
  },
  "选择放置位置": {
    "en": "Choose position",
    "ja": "配置位置を選択",
    "ko": "배치 위치 선택"
  },
  "取消放置": {
    "en": "Cancel placement",
    "ja": "配置をキャンセル",
    "ko": "배치 취소"
  },
  "定位刚添加的物体": {
    "en": "Locate new object",
    "ja": "追加した物体を表示",
    "ko": "추가한 물체 찾기"
  },
  "调整选中物体大小": {
    "en": "Resize selected object",
    "ja": "選択した物体のサイズ",
    "ko": "선택한 물체 크기 조정"
  },
  "选中物体": {
    "en": "Selected object",
    "ja": "選択した物体",
    "ko": "선택한 물체"
  },
  "大小未修改，请先完成当前调整。": {
    "en": "Size unchanged. Finish the current adjustment first.",
    "ja": "サイズは未変更です。現在の調整を先に完了してください。",
    "ko": "크기가 변경되지 않았습니다. 현재 조정을 먼저 완료하세요."
  },
  "大小已更新；本片场相关镜头会一起更新。": {
    "en": "Size updated across all shots in this scene.",
    "ja": "サイズを更新しました。このシーンの全ショットに反映されます。",
    "ko": "크기를 변경했습니다. 이 장면의 모든 샷에 반영됩니다."
  },
  "到左侧片场点击放置；按 Esc 或“取消放置”退出。": {
    "en": "Click the left stage to place. Press Esc or Cancel placement to exit.",
    "ja": "左側のステージをクリックして配置。Esc または「配置をキャンセル」で終了。",
    "ko": "왼쪽 스테이지를 클릭하여 배치하세요. Esc 또는 배치 취소로 종료합니다."
  },
  "已添加 ": {
    "en": "Added ",
    "ja": "追加しました：",
    "ko": "추가됨: "
  },
  "，并已选中定位。": {
    "en": ", selected and located.",
    "ja": "。選択して位置を表示しています。",
    "ko": " 물체를 선택하고 화면에 표시했습니다."
  },
  "先应用或还原上方的试调，再添加物体。": {
    "en": "Apply or revert the preview above before adding an object.",
    "ja": "上の試調整を適用または元に戻してから物体を追加してください。",
    "ko": "위의 미리보기 조정을 적용하거나 되돌린 다음 물체를 추가하세요."
  },
  "当前是只读状态，不能添加物体。": {
    "en": "This stage is read-only. Objects cannot be added.",
    "ja": "読み取り専用のため、物体を追加できません。",
    "ko": "읽기 전용 상태에서는 물체를 추가할 수 없습니다."
  },
  "已取消放置，未添加新物体。": {
    "en": "Placement canceled. No object was added.",
    "ja": "配置をキャンセルしました。物体は追加されていません。",
    "ko": "배치를 취소했습니다. 물체가 추가되지 않았습니다."
  },
  "该物体已不在当前片场，请从对象列表重新选择。": {
    "en": "This object is no longer in this scene. Select it again from the object list.",
    "ja": "この物体は現在のシーンにありません。物体一覧から選び直してください。",
    "ko": "현재 장면에 이 물체가 없습니다. 물체 목록에서 다시 선택하세요."
  },
  "当前片场": {
    "en": "Current scene",
    "ja": "現在のシーン",
    "ko": "현재 장면"
  },
  "本场 ": {
    "en": "This scene: ",
    "ja": "このシーンの ",
    "ko": "이 장면의 "
  },
  " 个镜头会同步更新": {
    "en": " shots will update together",
    "ja": " ショットを同時に更新",
    "ko": "개 샷이 함께 변경됩니다"
  },
  " 旁边": {
    "en": " — beside",
    "ja": "の横",
    "ko": " 옆"
  },
  "放到 ": {
    "en": "Place beside ",
    "ja": "配置：",
    "ko": "배치: "
  },
  " 当前站位的旁边，保留间距": {
    "en": ", keeping a gap from its current position.",
    "ja": "の現在位置の横に間隔を空けて配置",
    "ko": "의 현재 위치 옆에 간격을 두고 배치"
  },
  "先选择一个主体": {
    "en": "Select a subject first",
    "ja": "先に被写体を選択",
    "ko": "먼저 피사체를 선택하세요"
  },
  "正在准备…": {
    "en": "Preparing…",
    "ja": "準備中…",
    "ko": "준비 중…"
  },
  "等待片场点选": {
    "en": "Waiting for a stage click",
    "ja": "ステージのクリック待ち",
    "ko": "스테이지에서 위치를 선택하세요"
  },
  "添加到注视点": {
    "en": "Add at target",
    "ja": "注視点に追加",
    "ko": "주시점에 추가"
  },
  "添加到主体旁": {
    "en": "Add beside subject",
    "ja": "被写体の横に追加",
    "ko": "피사체 옆에 추가"
  },
  " · 修改本场共享尺寸": {
    "en": " · Shared size for this scene",
    "ja": " · シーン内で共有するサイズ",
    "ko": " · 이 장면에서 공유하는 크기"
  },
  "未命名物体": {
    "en": "Untitled object",
    "ja": "名前のない物体",
    "ko": "이름 없는 물체"
  },
  "人物": {
    "en": "Actor",
    "ja": "人物",
    "ko": "인물"
  },
  "物体": {
    "en": "Object",
    "ja": "物体",
    "ko": "물체"
  },
  "新建": {
    "en": "New",
    "ja": "新規",
    "ko": "새로 추가됨"
  },
  "摄影机运镜": {
    "en": "Camera motion",
    "ja": "カメラワーク",
    "ko": "카메라 움직임"
  },
  "摄影机": {
    "en": "Camera",
    "ja": "カメラ",
    "ko": "카메라"
  },
  "选择编辑对象": {
    "en": "Choose editing target",
    "ja": "編集対象を選択",
    "ko": "편집 대상 선택"
  },
  "定位": {
    "en": "Locate",
    "ja": "位置を表示",
    "ko": "위치 찾기"
  },
  "只定位观察视图，不改变拍摄机位": {
    "en": "Locate in the observation view without changing the shot camera.",
    "ja": "観察ビューで位置を表示。撮影カメラは変更しません。",
    "ko": "관찰 화면에서 위치를 표시하며 촬영 카메라는 변경하지 않습니다."
  },
  "查找并选择编辑对象": {
    "en": "Find and select an editing target",
    "ja": "編集対象を検索・選択",
    "ko": "편집 대상 검색 및 선택"
  },
  "查找对象": {
    "en": "Find object",
    "ja": "物体を検索",
    "ko": "물체 찾기"
  },
  "关闭对象列表": {
    "en": "Close object list",
    "ja": "物体一覧を閉じる",
    "ko": "물체 목록 닫기"
  },
  "搜索人物、物体名称": {
    "en": "Search actor or object names",
    "ja": "人物・物体名を検索",
    "ko": "인물 또는 물체 이름 검색"
  },
  "搜索编辑对象": {
    "en": "Search editing targets",
    "ja": "編集対象を検索",
    "ko": "편집 대상 검색"
  },
  "选择切换编辑对象；定位只移动观察视图。": {
    "en": "Select to change the editing target. Locate only moves the observation view.",
    "ja": "選択すると編集対象を切り替えます。位置の表示は観察ビューだけを移動します。",
    "ko": "선택하면 편집 대상이 바뀝니다. 위치 찾기는 관찰 화면만 이동합니다."
  },
  "先应用或还原当前试调，再切换编辑对象。": {
    "en": "Apply or revert the preview before changing the editing target.",
    "ja": "試調整を適用または元に戻してから編集対象を切り替えてください。",
    "ko": "미리보기 조정을 적용하거나 되돌린 다음 편집 대상을 변경하세요."
  },
  "暂时无法定位这个对象。": {
    "en": "This object cannot be located right now.",
    "ja": "現在、この物体の位置を表示できません。",
    "ko": "지금은 이 물체의 위치를 찾을 수 없습니다."
  },
  "已定位 ": {
    "en": "Located ",
    "ja": "位置を表示：",
    "ko": "위치 표시: "
  },
  "（当前隐藏）": {
    "en": " (currently hidden)",
    "ja": "（現在は非表示）",
    "ko": " (현재 숨김)"
  },
  "，拍摄机位保持不变。": {
    "en": ". The shot camera is unchanged.",
    "ja": "。撮影カメラは変更していません。",
    "ko": " 촬영 카메라는 변경되지 않았습니다."
  },
  "编辑 ": {
    "en": "Edit ",
    "ja": "編集：",
    "ko": "편집: "
  },
  "当前隐藏": {
    "en": "Currently hidden",
    "ja": "現在は非表示",
    "ko": "현재 숨김"
  },
  "只移动观察视图": {
    "en": "Move only the observation view",
    "ja": "観察ビューだけを移動",
    "ko": "관찰 화면만 이동"
  },
  "定位 ": {
    "en": "Locate ",
    "ja": "位置を表示：",
    "ko": "위치 찾기: "
  },
  "没有匹配的对象，试试更短的名称。": {
    "en": "No matching objects. Try a shorter name.",
    "ja": "一致する物体がありません。短い名前で検索してください。",
    "ko": "일치하는 물체가 없습니다. 더 짧은 이름으로 검색하세요."
  },
  "选择编辑对象，当前：": {
    "en": "Choose editing target. Current: ",
    "ja": "編集対象を選択。現在：",
    "ko": "편집 대상 선택 현재: "
  },
  " 个对象": {
    "en": " objects",
    "ja": " 個の物体",
    "ko": "개 물체"
  },
  "有未应用的调整：仍可定位，切换编辑对象前请先应用或还原。": {
    "en": "Unapplied preview: you can still locate objects. Apply or revert before changing targets.",
    "ja": "未適用の試調整があります。位置は表示できます。対象を切り替える前に適用または元に戻してください。",
    "ko": "적용하지 않은 조정이 있습니다. 위치 찾기는 가능하며 편집 대상을 바꾸려면 적용하거나 되돌리세요."
  },
  "待放置": {
    "en": "Ready to place",
    "ja": "配置待ち",
    "ko": "배치 대기"
  },
  "拖空白环绕 · 点选主体后拖移 · ⇧平移 · 滚轮远近": {
    "en": "Drag empty space to orbit · Select then drag a subject · ⇧ pan · Scroll to zoom",
    "ja": "空白をドラッグで旋回 · 被写体を選んで移動 · ⇧で平行移動 · ホイールでズーム",
    "ko": "빈 공간을 드래그하여 회전 · 피사체를 선택한 뒤 이동 · ⇧ 평행 이동 · 스크롤로 확대 축소"
  },
  "点选主体后拖移 · 拖空白平移 · 滚轮远近": {
    "en": "Select then drag a subject · Drag empty space to pan · Scroll to zoom",
    "ja": "被写体を選んで移動 · 空白をドラッグで平行移動 · ホイールでズーム",
    "ko": "피사체를 선택한 뒤 이동 · 빈 공간을 드래그하여 평행 이동 · 스크롤로 확대 축소"
  },
  "摄影机 · 已定位 · 观察不会改机位": {
    "en": "Camera located · Observation does not change the shot camera",
    "ja": "カメラの位置を表示 · 観察しても撮影カメラは変わりません",
    "ko": "카메라 위치 표시 · 관찰은 촬영 카메라에 영향을 주지 않습니다"
  },
  " · 此刻隐藏": {
    "en": " · Hidden at this time",
    "ja": " · この時刻では非表示",
    "ko": " · 현재 시점에서 숨김"
  },
  " · 已定位": {
    "en": " · Located",
    "ja": " · 位置を表示中",
    "ko": " · 위치 표시됨"
  },
  "三维片场，拖空白观察，点选主体后拖动位置": {
    "en": "3D stage. Drag empty space to observe. Select a subject, then drag to move it.",
    "ja": "3D ステージ。空白をドラッグして観察。被写体を選んでドラッグすると移動します。",
    "ko": "3D 스테이지 빈 공간을 드래그하여 관찰합니다 피사체를 선택한 뒤 드래그하여 이동합니다"
  },
  "移动鼠标预览地面落点 · 点击放置 · Esc 取消": {
    "en": "Move to preview ground position · Click to place · Esc to cancel",
    "ja": "マウスで地面の配置位置を確認 · クリックで配置 · Esc でキャンセル",
    "ko": "마우스를 움직여 바닥 위치 미리보기 · 클릭하여 배치 · Esc로 취소"
  },
  "已选中主体 · 再拖动可调整地面位置": {
    "en": "Subject selected · Drag again to adjust ground position",
    "ja": "被写体を選択 · 再度ドラッグして地面上の位置を調整",
    "ko": "피사체 선택됨 · 다시 드래그하여 바닥 위치 조정"
  },
  "这个角度看不到地面，请切换自由观察或顶视": {
    "en": "Ground is not visible from this angle. Switch to Free or Top view.",
    "ja": "この角度からは地面が見えません。自由観察または上面に切り替えてください。",
    "ko": "현재 각도에서는 바닥이 보이지 않습니다. 자유 관찰 또는 위에서 보기로 전환하세요."
  },
  "当前角度不便沿地面拖移，请切换自由观察或顶视": {
    "en": "Switch to Free or Top view to drag along the ground.",
    "ja": "地面に沿って移動するには自由観察または上面に切り替えてください。",
    "ko": "바닥을 따라 이동하려면 자유 관찰 또는 위에서 보기로 전환하세요."
  },
  "先应用或还原当前调整，再移动这个主体": {
    "en": "Apply or revert the current preview before moving this subject.",
    "ja": "現在の試調整を適用または元に戻してから被写体を移動してください。",
    "ko": "현재 조정을 적용하거나 되돌린 다음 피사체를 이동하세요."
  },
  "主体正在试调 · 满意后点击应用": {
    "en": "Previewing subject position · Click Apply when ready",
    "ja": "被写体の位置を試調整中 · 決まったら適用",
    "ko": "피사체 위치 미리보기 중 · 준비되면 적용을 클릭하세요"
  },
  "平面布局": {
    "en": "Plan view",
    "ja": "平面図",
    "ko": "평면 배치"
  },
  "观察视角": {
    "en": "Observation view",
    "ja": "観察ビュー",
    "ko": "관찰 화면"
  },
  "正在从当前 Flova 项目载入参考…": {
    "en": "Loading reference from the current Flova project…",
    "ja": "現在の Flova プロジェクトから参考映像を読み込み中…",
    "ko": "현재 Flova 프로젝트에서 참고 영상을 불러오는 중…"
  },
  "此链接未绑定 Flova 项目。请让项目 Agent 重新生成编辑链接。": {
    "en": "This link is not bound to a Flova project. Ask the project Agent to generate a new editing link.",
    "ja": "このリンクは Flova プロジェクトに紐づいていません。プロジェクト Agent に編集リンクの再生成を依頼してください。",
    "ko": "Flova 프로젝트에 연결되지 않은 링크입니다. 프로젝트 Agent에게 편집 링크를 다시 생성하도록 요청하세요."
  },
  "参考载入失败。": {
    "en": "Could not load the reference.",
    "ja": "参考映像を読み込めませんでした。",
    "ko": "참고 영상을 불러오지 못했습니다."
  },
  "原片 {0} 秒 · 本镜 {1} 秒": {
    "en": "Reference {0} s · Shot {1} s",
    "ja": "元映像 {0} 秒 · ショット {1} 秒",
    "ko": "원본 {0}초 · 현재 샷 {1}초"
  },
  "参考地址已失效或视频暂不可播放，重新载入会刷新地址。": {
    "en": "The reference link expired or the video cannot play. Reload to refresh the link.",
    "ja": "参考リンクの期限切れ、または再生できない状態です。再読み込みするとリンクを更新します。",
    "ko": "참고 링크가 만료되었거나 동영상을 재생할 수 없습니다. 다시 불러오면 링크가 갱신됩니다."
  },
  "镜头缩略图暂时不可用": {
    "en": "Shot thumbnail temporarily unavailable",
    "ja": "ショットのサムネイルを利用できません",
    "ko": "샷 미리보기를 일시적으로 사용할 수 없습니다"
  },
  "路径范围": {
    "en": "Path scope",
    "ja": "パスの適用範囲",
    "ko": "경로 범위"
  },
  "只调整选中的一段": {
    "en": "Adjust only the selected segment",
    "ja": "選択した区間だけを調整",
    "ko": "선택한 구간만 조정"
  },
  "重建本镜整条路线": {
    "en": "Rebuild the full path for this shot",
    "ja": "このショットの全パスを再作成",
    "ko": "이 샷의 전체 경로 다시 만들기"
  },
  "路径方向": {
    "en": "Path direction",
    "ja": "パスの方向",
    "ko": "경로 방향"
  },
  "沿设定方向运动": {
    "en": "Move in the defined direction",
    "ja": "設定した方向に移動",
    "ko": "설정한 방향으로 이동"
  },
  "沿相反方向运动": {
    "en": "Move in the opposite direction",
    "ja": "逆方向に移動",
    "ko": "반대 방향으로 이동"
  },
  "机身质感": {
    "en": "Camera feel",
    "ja": "カメラの質感",
    "ko": "카메라 움직임 질감"
  },
  "不叠加机身晃动": {
    "en": "No added camera shake",
    "ja": "カメラの揺れを追加しない",
    "ko": "카메라 흔들림 없음"
  },
  "轻微自然晃动": {
    "en": "Subtle natural shake",
    "ja": "自然で控えめな揺れ",
    "ko": "은은하고 자연스러운 흔들림"
  },
  "带步态的起伏": {
    "en": "Walking rhythm and sway",
    "ja": "歩行に合わせた上下の揺れ",
    "ko": "걸음에 따른 움직임"
  },
  "轻微焦距起伏": {
    "en": "Subtle focal-length breathing",
    "ja": "わずかな焦点距離の変動",
    "ko": "미세한 초점거리 변화"
  },
  "根据转向产生侧倾": {
    "en": "Bank into turns",
    "ja": "旋回に合わせて傾斜",
    "ko": "회전 방향에 따라 기울어짐"
  },
  "选择机身质感后可调整": {
    "en": "Choose a camera feel to adjust",
    "ja": "カメラの質感を選択して調整",
    "ko": "카메라 움직임 질감을 선택한 후 조정"
  },
  "控制晃动或呼吸幅度": {
    "en": "Adjust shake or breathing strength",
    "ja": "揺れやブリージングの強さを調整",
    "ko": "흔들림 또는 브리딩 강도 조정"
  },
  "固定完整 360° 可用速度调整完成时间": {
    "en": "Full 360° turn. Use speed to adjust its duration.",
    "ja": "360° 固定。速度で完了までの時間を調整。",
    "ko": "전체 360° 회전 고정 속도로 완료 시간 조정"
  },
  "跟随主体路线": {
    "en": "Follow the subject path",
    "ja": "被写体のパスに追従",
    "ko": "피사체 경로 따라가기"
  },
  "选择运镜预设后调整": {
    "en": "Choose a motion preset to adjust",
    "ja": "カメラワークのプリセットを選択して調整",
    "ko": "카메라 움직임 프리셋을 선택한 후 조정"
  },
  "调整当前路径的幅度": {
    "en": "Adjust current path amplitude",
    "ja": "現在のパスの移動量を調整",
    "ko": "현재 경로의 이동량 조정"
  },
  "运动结束后保留停留 镜头总长不变": {
    "en": "Hold after motion ends. Shot duration stays unchanged.",
    "ja": "動作後は静止。ショットの全長は変わりません。",
    "ko": "움직임 후 정지 유지 샷 전체 길이는 그대로 유지"
  },
  "请在时间轴调整镜头时长": {
    "en": "Adjust shot duration on the timeline",
    "ja": "タイムラインでショットの長さを調整",
    "ko": "타임라인에서 샷 길이 조정"
  },
  "请在时间轴调整这一段时长": {
    "en": "Adjust this segment on the timeline",
    "ja": "タイムラインでこの区間の長さを調整",
    "ko": "타임라인에서 이 구간 길이 조정"
  },
  "控制整条路线的运动时间": {
    "en": "Set the full path motion duration",
    "ja": "全パスの移動時間を設定",
    "ko": "전체 경로의 이동 시간 설정"
  },
  "控制这一段的运动时间": {
    "en": "Set this segment's motion duration",
    "ja": "この区間の移動時間を設定",
    "ko": "이 구간의 이동 시간 설정"
  },
  "希区柯克推拉变焦": {
    "en": "Hitchcock dolly zoom",
    "ja": "ヒッチコック式ドリーズーム",
    "ko": "히치콕 돌리 줌"
  },
  "推近同时减焦 主体大小近似不变": {
    "en": "Dolly in and zoom out to keep subject size nearly constant",
    "ja": "前進しながらズームアウトし、被写体の大きさをほぼ維持",
    "ko": "전진하며 줌 아웃하여 피사체 크기를 거의 일정하게 유지"
  },
  "当前一段或整镜": {
    "en": "Selected segment or full shot",
    "ja": "選択した区間または全ショット",
    "ko": "선택한 구간 또는 전체 샷"
  },
  "移动距离": {
    "en": "Travel distance",
    "ja": "移動距離",
    "ko": "이동 거리"
  },
  "反应慢推": {
    "en": "Slow reaction push",
    "ja": "リアクションへのスロープッシュ",
    "ko": "리액션 슬로 푸시"
  },
  "克制地靠近角色 逐步收紧情绪": {
    "en": "Move gently toward the actor to build emotion",
    "ja": "人物に静かに近づき、感情を徐々に高める",
    "ko": "인물에게 서서히 다가가며 감정을 고조"
  },
  "斯皮尔伯格灵感": {
    "en": "Inspired by Spielberg",
    "ja": "スピルバーグに着想",
    "ko": "스필버그에서 영감"
  },
  "推进距离": {
    "en": "Push distance",
    "ja": "前進距離",
    "ko": "전진 거리"
  },
  "中轴跟进": {
    "en": "Axial push",
    "ja": "中軸プッシュ",
    "ko": "중심축 푸시"
  },
  "沿视线直推 注视点保持居中": {
    "en": "Push along the sightline with the target centered",
    "ja": "視線に沿って前進し、注視点を中央に維持",
    "ko": "시선을 따라 전진하며 주시점을 중앙에 유지"
  },
  "库布里克灵感": {
    "en": "Inspired by Kubrick",
    "ja": "キューブリックに着想",
    "ko": "큐브릭에서 영감"
  },
  "低角度英雄环绕": {
    "en": "Low-angle hero orbit",
    "ja": "ローアングルのヒーロー旋回",
    "ko": "로우 앵글 히어로 오비트"
  },
  "低机位绕主体约 120° 展示气势": {
    "en": "Orbit about 120° from a low angle for a heroic view",
    "ja": "低い位置から被写体を約 120° 回り込み、迫力を演出",
    "ko": "낮은 위치에서 피사체 주위를 약 120° 회전하여 웅장함 표현"
  },
  "迈克尔·贝灵感": {
    "en": "Inspired by Michael Bay",
    "ja": "マイケル・ベイに着想",
    "ko": "마이클 베이에서 영감"
  },
  "环绕角度": {
    "en": "Orbit angle",
    "ja": "旋回角度",
    "ko": "회전 각도"
  },
  "子弹时间": {
    "en": "Bullet time",
    "ja": "バレットタイム",
    "ko": "불릿 타임"
  },
  "主体以 0.1 倍动作 摄影机正常弧绕": {
    "en": "Subject moves at 0.1× speed while the camera orbits normally",
    "ja": "被写体は 0.1 倍速、カメラは通常速度で旋回",
    "ko": "피사체는 0.1배속 카메라는 정상 속도로 회전"
  },
  "仅整镜 · 主体从 0 秒慢放": {
    "en": "Full shot only · Subject slow motion starts at 0 s",
    "ja": "全ショットのみ · 0 秒から被写体をスロー再生",
    "ko": "전체 샷 전용 · 0초부터 피사체 슬로 모션"
  },
  "时间冻结 360°": {
    "en": "360° time freeze",
    "ja": "タイムフリーズ 360°",
    "ko": "시간 정지 360°"
  },
  "冻结当前可见姿态 摄影机完整绕一圈": {
    "en": "Freeze the visible pose while the camera makes a full orbit",
    "ja": "現在の姿勢を固定し、カメラが一周する",
    "ko": "현재 보이는 자세를 정지하고 카메라가 한 바퀴 회전"
  },
  "仅整镜 · 冻结所有主体": {
    "en": "Full shot only · Freeze all subjects",
    "ja": "全ショットのみ · 全被写体を固定",
    "ko": "전체 샷 전용 · 모든 피사체 정지"
  },
  "完整一圈": {
    "en": "Full turn",
    "ja": "完全な一周",
    "ko": "한 바퀴"
  },
  "快速甩镜": {
    "en": "Whip pan",
    "ja": "ウィップパン",
    "ko": "휩 팬"
  },
  "原地快速转向约 120° 两端保留停留": {
    "en": "Quickly pan about 120° with a hold at each end",
    "ja": "その場で約 120° 高速パンし、両端で静止",
    "ko": "제자리에서 약 120° 빠르게 회전 양 끝에서 정지"
  },
  "转向角度": {
    "en": "Pan angle",
    "ja": "パン角度",
    "ko": "회전 각도"
  },
  "滚转穿越": {
    "en": "Rolling fly-through",
    "ja": "ロールスルー",
    "ko": "롤링 플라이 스루"
  },
  "沿视线前进 同时连续滚转 360°": {
    "en": "Move along the sightline while rolling a full 360°",
    "ja": "視線に沿って前進しながら 360° ロール",
    "ko": "시선을 따라 전진하며 360° 연속 롤 회전"
  },
  "穿越距离": {
    "en": "Fly-through distance",
    "ja": "通過距離",
    "ko": "통과 거리"
  },
  "出现": {
    "en": "Show",
    "ja": "表示",
    "ko": "나타나기"
  },
  "恢复可见": {
    "en": "Become visible again",
    "ja": "再び表示する",
    "ko": "다시 보이기"
  },
  "消失": {
    "en": "Hide",
    "ja": "非表示",
    "ko": "사라지기"
  },
  "保持隐藏": {
    "en": "Stay hidden",
    "ja": "非表示を維持",
    "ko": "숨김 유지"
  },
  "瞬移": {
    "en": "Teleport",
    "ja": "瞬間移動",
    "ko": "순간 이동"
  },
  "此刻直接换位置": {
    "en": "Change position instantly",
    "ja": "この時刻に位置を即座に変更",
    "ko": "현재 시점에 즉시 위치 변경"
  },
  "跳跃": {
    "en": "Jump",
    "ja": "ジャンプ",
    "ko": "점프"
  },
  "落回原路线": {
    "en": "Land back on the path",
    "ja": "元のパスに着地",
    "ko": "원래 경로로 착지"
  },
  "倒下": {
    "en": "Fall",
    "ja": "倒れる",
    "ko": "넘어지기"
  },
  "倒地后保持": {
    "en": "Remain on the ground",
    "ja": "倒れた状態を維持",
    "ko": "넘어진 상태 유지"
  },
  "起身": {
    "en": "Rise",
    "ja": "起き上がる",
    "ko": "일어나기"
  },
  "恢复直立": {
    "en": "Return upright",
    "ja": "直立姿勢に戻る",
    "ko": "바로 선 자세로 복귀"
  },
  "破碎消失": {
    "en": "Shatter and hide",
    "ja": "砕けて消える",
    "ko": "부서져 사라지기"
  },
  "碎块散开后隐藏": {
    "en": "Scatter fragments, then hide",
    "ja": "破片が散った後に非表示",
    "ko": "파편이 흩어진 후 숨김"
  },
  "恢复完整": {
    "en": "Restore",
    "ja": "元に戻す",
    "ko": "원상 복구"
  },
  "恢复完整物体": {
    "en": "Restore the whole object",
    "ja": "物体を元の形に戻す",
    "ko": "물체 전체를 복구"
  },
  "抖动": {
    "en": "Shake",
    "ja": "震える",
    "ko": "떨림"
  },
  "短暂晃动后恢复": {
    "en": "Shake briefly, then recover",
    "ja": "短く揺れてから元に戻る",
    "ko": "잠시 흔들린 후 복귀"
  },
  "左右偏移": {
    "en": "Horizontal offset",
    "ja": "左右の移動量",
    "ko": "좌우 이동량"
  },
  "上下偏移": {
    "en": "Vertical offset",
    "ja": "上下の移動量",
    "ko": "상하 이동량"
  },
  "前后偏移": {
    "en": "Depth offset",
    "ja": "前後の移動量",
    "ko": "앞뒤 이동량"
  },
  "{0} {1} 秒，左右拖动调时间": {
    "en": "{0} at {1} s. Drag horizontally to change the time.",
    "ja": "{0} · {1} 秒。左右にドラッグして時刻を変更。",
    "ko": "{0} {1}초 좌우로 드래그하여 시점 조정"
  },
  "移除 {0} 秒{1}": {
    "en": "Remove {1} at {0} s",
    "ja": "{0} 秒の {1} を削除",
    "ko": "{0}초의 {1} 삭제"
  },
  "移除此状态": {
    "en": "Remove state",
    "ja": "この状態を削除",
    "ko": "이 상태 삭제"
  },
  "选择主体": {
    "en": "Select subject",
    "ja": "被写体を選択",
    "ko": "피사체 선택"
  },
  "当前 {0} 秒": {
    "en": "Now {0} s",
    "ja": "現在 {0} 秒",
    "ko": "현재 {0}초"
  },
  "最近状态：{0} · {1} 秒": {
    "en": "Latest state: {0} · {1} s",
    "ja": "直近の状態：{0} · {1} 秒",
    "ko": "최근 상태: {0} · {1}초"
  },
  "拖到状态发生的时刻再添加": {
    "en": "Move to the time of the event, then add a state",
    "ja": "状態が変わる時刻に移動して追加",
    "ko": "상태가 발생할 시점으로 이동한 후 추가"
  },
  "发生后保持结果；需要恢复时，在后面的时刻再添加对应状态。": {
    "en": "This result persists. Add a matching state later to restore it.",
    "ja": "変化後の状態を維持します。元に戻す場合は、後の時刻に対応する状態を追加します。",
    "ko": "변경된 상태가 유지됩니다. 복구하려면 이후 시점에 해당 상태를 추가하세요."
  },
  "动作结束后回到正常路线。拖动上方时间轴查看前、中、后的变化。": {
    "en": "Returns to the normal path after the action. Scrub the timeline to inspect before, during, and after.",
    "ja": "動作後は通常のパスに戻ります。上のタイムラインを動かし、前後や途中の変化を確認できます。",
    "ko": "동작이 끝나면 정상 경로로 돌아갑니다. 위 타임라인을 이동하여 전후 및 중간 변화를 확인하세요."
  },
  "主体状态": {
    "en": "Subject states",
    "ja": "被写体の状態",
    "ko": "피사체 상태"
  },
  "先选主体，拖到发生的时刻，再添加状态。路线决定位置，状态决定这一刻的样子。": {
    "en": "Select a subject, move to an event time, then add a state. Paths set position; states set appearance at that moment.",
    "ja": "被写体を選び、変化する時刻に移動して状態を追加。パスは位置を、状態はその瞬間の姿を決めます。",
    "ko": "피사체를 선택하고 발생 시점으로 이동한 다음 상태를 추가하세요. 경로는 위치를 상태는 그 순간의 모습을 결정합니다."
  },
  "作用主体": {
    "en": "Target subject",
    "ja": "対象の被写体",
    "ko": "대상 피사체"
  },
  "状态作用主体": {
    "en": "State target subject",
    "ja": "状態を適用する被写体",
    "ko": "상태를 적용할 피사체"
  },
  "主体状态时间线": {
    "en": "Subject state timeline",
    "ja": "被写体の状態タイムライン",
    "ko": "피사체 상태 타임라인"
  },
  "发生时刻": {
    "en": "Event time",
    "ja": "発生時刻",
    "ko": "발생 시점"
  },
  "拖动状态发生时刻": {
    "en": "Drag to change event time",
    "ja": "ドラッグして発生時刻を変更",
    "ko": "드래그하여 상태 발생 시점 변경"
  },
  "动作时长": {
    "en": "Action duration",
    "ja": "動作時間",
    "ko": "동작 시간"
  },
  "拖动状态动作时长": {
    "en": "Drag to change action duration",
    "ja": "ドラッグして動作時間を変更",
    "ko": "드래그하여 동작 시간 변경"
  },
  "跳起高度": {
    "en": "Jump height",
    "ja": "ジャンプの高さ",
    "ko": "점프 높이"
  },
  "跳跃高度": {
    "en": "Jump height",
    "ja": "ジャンプの高さ",
    "ko": "점프 높이"
  },
  "瞬移是相对当前位置的偏移，后续路线会一起偏移。": {
    "en": "Teleport offsets the current position. The remaining path moves with it.",
    "ja": "瞬間移動は現在位置からの相対移動です。後続のパスも同じ分だけ移動します。",
    "ko": "순간 이동은 현재 위치에서의 상대 이동입니다. 이후 경로도 함께 이동합니다."
  },
  "该主体还没有状态。拖动时间轴后，点击上方预设。": {
    "en": "This subject has no states yet. Move the timeline, then choose a preset above.",
    "ja": "この被写体にはまだ状態がありません。タイムラインを動かし、上のプリセットを選択してください。",
    "ko": "이 피사체에는 아직 상태가 없습니다. 타임라인을 이동한 후 위 프리셋을 선택하세요."
  },
  " 超出范围": {
    "en": " is out of range",
    "ja": "が範囲外です",
    "ko": " 값이 범위를 벗어났습니다"
  },
  "状态事件必须按主体保存": {
    "en": "State events must be stored by subject",
    "ja": "状態イベントは被写体ごとに保存してください",
    "ko": "상태 이벤트는 피사체별로 저장해야 합니다"
  },
  "镜头长度": {
    "en": "Shot duration",
    "ja": "ショットの長さ",
    "ko": "샷 길이"
  },
  "一镜最多 96 个状态事件": {
    "en": "A shot can contain up to 96 state events",
    "ja": "1 ショットの状態イベントは 96 個までです",
    "ko": "한 샷에는 최대 96개의 상태 이벤트를 추가할 수 있습니다"
  },
  "状态主体不存在": {
    "en": "State subject does not exist",
    "ja": "状態の被写体が存在しません",
    "ko": "상태를 적용할 피사체가 없습니다"
  },
  "同一人物的状态应记录在一个主体上": {
    "en": "Store an actor's states under one subject",
    "ja": "同じ人物の状態は一つの被写体に記録してください",
    "ko": "동일 인물의 상태는 하나의 피사체에 기록해야 합니다"
  },
  "状态字段无效": {
    "en": "Invalid state fields",
    "ja": "状態の項目が無効です",
    "ko": "상태 필드가 올바르지 않습니다"
  },
  "状态标识无效": {
    "en": "Invalid state ID",
    "ja": "状態 ID が無効です",
    "ko": "상태 ID가 올바르지 않습니다"
  },
  "不支持的主体状态": {
    "en": "Unsupported subject state",
    "ja": "未対応の被写体状態です",
    "ko": "지원하지 않는 피사체 상태입니다"
  },
  "状态时刻": {
    "en": "State time",
    "ja": "状態の時刻",
    "ko": "상태 시점"
  },
  "动作需要在镜头内结束": {
    "en": "The action must end within the shot",
    "ja": "動作はショット内で終了する必要があります",
    "ko": "동작은 샷 안에서 끝나야 합니다"
  },
  "动作幅度": {
    "en": "Action amplitude",
    "ja": "動作の大きさ",
    "ko": "동작 크기"
  },
  "瞬移需要三轴位移": {
    "en": "Teleport requires a three-axis offset",
    "ja": "瞬間移動には 3 軸の移動量が必要です",
    "ko": "순간 이동에는 3축 이동량이 필요합니다"
  },
  "瞬移位移": {
    "en": "Teleport offset",
    "ja": "瞬間移動の移動量",
    "ko": "순간 이동량"
  },
  "状态种子必须是整数": {
    "en": "The state seed must be an integer",
    "ja": "状態のシードは整数にしてください",
    "ko": "상태 시드는 정수여야 합니다"
  },
  " 必须是有限数字": {
    "en": " must be a finite number",
    "ja": "は有限の数値にしてください",
    "ko": " 값은 유한한 숫자여야 합니다"
  },
  "镜头长度超出范围": {
    "en": "Shot duration is out of range",
    "ja": "ショットの長さが範囲外です",
    "ko": "샷 길이가 범위를 벗어났습니다"
  },
  "镜头数据无效": {
    "en": "Invalid shot data",
    "ja": "ショットのデータが無効です",
    "ko": "샷 데이터가 올바르지 않습니다"
  },
  "主体时间字段无效": {
    "en": "Invalid subject time fields",
    "ja": "被写体時間の項目が無効です",
    "ko": "피사체 시간 필드가 올바르지 않습니다"
  },
  "不支持的主体时间效果": {
    "en": "Unsupported subject time effect",
    "ja": "未対応の被写体時間エフェクトです",
    "ko": "지원하지 않는 피사체 시간 효과입니다"
  },
  "主体源时刻": {
    "en": "Subject source time",
    "ja": "被写体の参照時刻",
    "ko": "피사체 원본 시점"
  },
  "主体源时刻超出镜头": {
    "en": "Subject source time is outside the shot",
    "ja": "被写体の参照時刻がショットの範囲外です",
    "ko": "피사체 원본 시점이 샷 범위를 벗어났습니다"
  },
  "主体速度": {
    "en": "Subject speed",
    "ja": "被写体の速度",
    "ko": "피사체 속도"
  },
  "主体速度应在 0.01 到 1 之间": {
    "en": "Subject speed must be between 0.01 and 1",
    "ja": "被写体の速度は 0.01〜1 にしてください",
    "ko": "피사체 속도는 0.01~1 사이여야 합니다"
  },
  "冻结主体不应包含速度": {
    "en": "A frozen subject must not include a speed",
    "ja": "固定した被写体に速度は指定できません",
    "ko": "정지된 피사체에는 속도를 지정할 수 없습니다"
  },
  "输出时刻": {
    "en": "Output time",
    "ja": "出力時刻",
    "ko": "출력 시점"
  },
  "起点": {
    "en": "Start",
    "ja": "始点",
    "ko": "시작점"
  },
  "终点": {
    "en": "End",
    "ja": "終点",
    "ko": "끝점"
  },
  "途经点 {0}": {
    "en": "Waypoint {0}",
    "ja": "経由点 {0}",
    "ko": "경유점 {0}"
  },
  "当前片场只可查看。": {
    "en": "This stage is read-only.",
    "ja": "現在のステージは閲覧専用です。",
    "ko": "현재 스테이지는 읽기 전용입니다."
  },
  "请先应用或还原当前调整，再删除途经点。": {
    "en": "Apply or revert the current preview before deleting a waypoint.",
    "ja": "現在の試調整を適用または元に戻してから経由点を削除してください。",
    "ko": "현재 조정을 적용하거나 되돌린 다음 경유점을 삭제하세요."
  },
  "这个路径点已不存在。": {
    "en": "This waypoint no longer exists.",
    "ja": "このパス点は既に存在しません。",
    "ko": "이 경로 지점은 더 이상 존재하지 않습니다."
  },
  "起点和终点需要保留，可以调整位置与时间。": {
    "en": "Start and end points are required. You can adjust their position and time.",
    "ja": "始点と終点は必要です。位置と時刻は調整できます。",
    "ko": "시작점과 끝점은 유지해야 합니다. 위치와 시간은 조정할 수 있습니다."
  },
  "位置": {
    "en": "position",
    "ja": "位置",
    "ko": "위치"
  },
  "构图": {
    "en": "composition",
    "ja": "構図",
    "ko": "구도"
  },
  "应用当前站位": {
    "en": "Apply position",
    "ja": "現在位置を適用",
    "ko": "현재 위치 적용"
  },
  "应用当前构图": {
    "en": "Apply composition",
    "ja": "現在の構図を適用",
    "ko": "현재 구도 적용"
  },
  "添加途经点": {
    "en": "Add waypoint",
    "ja": "経由点を追加",
    "ko": "경유점 추가"
  },
  "请先应用或还原当前调整，再切换时间或路径点。": {
    "en": "Apply or revert the current preview before changing time or waypoints.",
    "ja": "現在の試調整を適用または元に戻してから時刻やパス点を切り替えてください。",
    "ko": "현재 조정을 적용하거나 되돌린 다음 시점 또는 경로 지점을 변경하세요."
  },
  "拖动时间，安排镜头": {
    "en": "Scrub time to arrange the shot",
    "ja": "時間を動かしてショットを構成",
    "ko": "시간을 이동하여 샷 구성"
  },
  "拖到时刻 → 试调上方画面 → 应用。点击下面的移动段，可单独设置这一段运镜。": {
    "en": "Choose a time → adjust the preview → Apply. Select a segment below to set its camera motion.",
    "ja": "時刻を選択 → 上の画面を試調整 → 適用。下の移動区間を選ぶと、その区間のカメラワークを設定できます。",
    "ko": "시점 선택 → 위 화면에서 미리 조정 → 적용 아래 이동 구간을 선택하여 해당 구간의 카메라 움직임을 설정하세요."
  },
  "镜头时间轴：拖动白线选择时刻，双击空白添加构图": {
    "en": "Shot timeline: drag the white line to choose a time; double-click empty space to add a composition.",
    "ja": "ショットのタイムライン：白線で時刻を選択。空白をダブルクリックして構図を追加。",
    "ko": "샷 타임라인 흰 선을 드래그하여 시점 선택 빈 공간을 두 번 클릭하여 구도 추가"
  },
  "选择镜头时刻": {
    "en": "Choose shot time",
    "ja": "ショットの時刻を選択",
    "ko": "샷 시점 선택"
  },
  "白线选时间": {
    "en": "White line selects time",
    "ja": "白線で時刻を選択",
    "ko": "흰 선으로 시점 선택"
  },
  "圆点是构图 · 右键删除途经点": {
    "en": "Dots are compositions · Right-click to delete a waypoint",
    "ja": "丸は構図 · 右クリックで経由点を削除",
    "ko": "점은 구도 · 우클릭하여 경유점 삭제"
  },
  "点移动段可组合运镜 · 浅色条是停留": {
    "en": "Select segments to combine moves · Light bars are holds",
    "ja": "移動区間を選んでカメラワークを組み合わせ · 薄い帯は静止",
    "ko": "이동 구간을 선택하여 움직임 조합 · 밝은 막대는 정지"
  },
  "删除途经点": {
    "en": "Delete waypoint",
    "ja": "経由点を削除",
    "ko": "경유점 삭제"
  },
  "在这里停留": {
    "en": "Hold here",
    "ja": "ここで静止",
    "ko": "여기서 정지"
  },
  "拖动调整当前构图停留时间": {
    "en": "Drag to adjust this composition's hold time",
    "ja": "ドラッグして現在の構図の静止時間を調整",
    "ko": "드래그하여 현재 구도의 정지 시간 조정"
  },
  "到下个构图": {
    "en": "To next composition",
    "ja": "次の構図まで",
    "ko": "다음 구도까지"
  },
  "拖动调整到下个构图的行进时间": {
    "en": "Drag to adjust travel time to the next composition",
    "ja": "ドラッグして次の構図までの移動時間を調整",
    "ko": "드래그하여 다음 구도까지의 이동 시간 조정"
  },
  "整镜时长": {
    "en": "Shot duration",
    "ja": "ショットの長さ",
    "ko": "샷 길이"
  },
  "拖动调整整镜时长": {
    "en": "Drag to adjust total shot duration",
    "ja": "ドラッグしてショット全体の長さを調整",
    "ko": "드래그하여 전체 샷 길이 조정"
  },
  "{0} · {1} 秒。试调上方{2}，满意后点击应用。": {
    "en": "{0} · {1} s. Adjust the {2} above, then click Apply.",
    "ja": "{0} · {1} 秒。上の{2}を試調整し、決まったら適用してください。",
    "ko": "{0} · {1}초 위의 {2}을 조정한 다음 적용을 클릭하세요."
  },
  "画面": {
    "en": "preview",
    "ja": "画面",
    "ko": "화면"
  },
  "已记住 {0} 秒的{1}。拖到下一个时刻，继续调整{2}。": {
    "en": "Saved the {1} at {0} s. Move to the next time and adjust the {2}.",
    "ja": "{0} 秒の{1}を保存しました。次の時刻へ移動し、{2}の調整を続けてください。",
    "ko": "{0}초의 {1} 저장됨 다음 시점으로 이동하여 {2} 조정을 계속하세요."
  },
  "已记录当前{0}。": {
    "en": "Current {0} saved.",
    "ja": "現在の{0}を保存しました。",
    "ko": "현재 {0} 저장됨."
  },
  "当前调整尚未应用，请检查上方提示。": {
    "en": "The preview has not been applied. Check the message above.",
    "ja": "試調整はまだ未適用です。上のメッセージを確認してください。",
    "ko": "현재 조정이 아직 적용되지 않았습니다. 위 안내를 확인하세요."
  },
  "已应用当前{0}。": {
    "en": "Current {0} applied.",
    "ja": "現在の{0}を適用しました。",
    "ko": "현재 {0} 적용됨."
  },
  "已删除{0}，前后{1}直接衔接。可用撤销恢复。": {
    "en": "Deleted {0}. The surrounding {1} points connect directly. Undo to restore.",
    "ja": "{0} を削除し、前後の{1}を直接つなぎました。元に戻す操作で復元できます。",
    "ko": "{0} 삭제됨 앞뒤 {1} 지점이 바로 연결됩니다 실행 취소로 복구할 수 있습니다."
  },
  "这个途经点未删除，请检查当前编辑状态。": {
    "en": "The waypoint was not deleted. Check the current editing state.",
    "ja": "経由点は削除されていません。現在の編集状態を確認してください。",
    "ko": "경유점이 삭제되지 않았습니다. 현재 편집 상태를 확인하세요."
  },
  "{0} · 在 {1} 秒到达。": {
    "en": "{0} · Arrive at {1} s.",
    "ja": "{0} · {1} 秒で到着。",
    "ko": "{0} · {1}초에 도착."
  },
  "{0} · 停留 {1} 秒{2}。": {
    "en": "{0} · Hold for {1} s{2}.",
    "ja": "{0} · {1} 秒静止{2}。",
    "ko": "{0} · {1}초 동안 정지{2}."
  },
  "后结束镜头": {
    "en": ", then end the shot",
    "ja": "してショットを終了",
    "ko": " 후 샷 종료"
  },
  "再出发": {
    "en": ", then continue",
    "ja": "してから移動",
    "ko": " 후 이동"
  },
  "镜头共 {0} 秒，构图按原来的节奏分布。": {
    "en": "Shot duration: {0} s. Compositions retain their relative rhythm.",
    "ja": "ショット全長は {0} 秒。構図の相対的なリズムは維持されます。",
    "ko": "샷 전체 길이 {0}초 구도의 상대적인 리듬은 유지됩니다."
  },
  "在这个{0}停留 {1} 秒{2}。": {
    "en": "Hold this {0} for {1} s{2}.",
    "ja": "この{0}で {1} 秒静止{2}。",
    "ko": "이 {0}에서 {1}초 정지{2}."
  },
  "从{0}到下个{1}用 {2} 秒。": {
    "en": "Travel from {0} to the next {1} in {2} s.",
    "ja": "{0} から次の{1}まで {2} 秒で移動。",
    "ko": "{0}에서 다음 {1}까지 {2}초 동안 이동."
  },
  "已选第 {0} 段：{1} → {2}。之后选择运镜预设，只调整这一段。": {
    "en": "Segment {0} selected: {1} → {2}. A motion preset will affect only this segment.",
    "ja": "区間 {0} を選択：{1} → {2}。カメラワークのプリセットはこの区間だけに適用されます。",
    "ko": "구간 {0} 선택됨 {1} → {2} 이후 선택하는 움직임 프리셋은 이 구간에만 적용됩니다."
  },
  " 秒": {
    "en": " s",
    "ja": " 秒",
    "ko": "초"
  },
  "正在试调，尚未写入路径。点击应用保留，或还原这次调整。": {
    "en": "Previewing changes. Click Apply to save them to the path, or Revert.",
    "ja": "試調整中で、パスには未反映です。適用で保存、または元に戻してください。",
    "ko": "미리 조정 중이며 경로에 아직 반영되지 않았습니다 적용하여 저장하거나 되돌리세요."
  },
  "拖到时刻 → 试调人物位置 → 应用。右键可删除中间站位点。": {
    "en": "Choose a time → adjust actor position → Apply. Right-click to delete intermediate positions.",
    "ja": "時刻を選択 → 人物の位置を試調整 → 適用。中間の位置は右クリックで削除できます。",
    "ko": "시점 선택 → 인물 위치 미리 조정 → 적용 중간 위치는 우클릭하여 삭제할 수 있습니다."
  },
  "镜头": {
    "en": "Shot",
    "ja": "ショット",
    "ko": "샷"
  },
  "时间轴：拖动白线选择时刻，双击空白添加": {
    "en": " timeline: drag the white line to select a time; double-click empty space to add a ",
    "ja": "タイムライン：白線で時刻を選択。空白をダブルクリックして追加：",
    "ko": " 타임라인 흰 선으로 시점 선택 빈 공간을 두 번 클릭하여 추가: "
  },
  "走到下个位置": {
    "en": "To next position",
    "ja": "次の位置まで",
    "ko": "다음 위치까지"
  },
  "{0} 秒，共 {1} 秒": {
    "en": "{0} s of {1} s",
    "ja": "{1} 秒中 {0} 秒",
    "ko": "전체 {1}초 중 {0}초"
  },
  "此刻已有路径点 ✓": {
    "en": "Waypoint already here ✓",
    "ja": "この時刻にパス点があります ✓",
    "ko": "이 시점에 경로 지점 있음 ✓"
  },
  "＋ 添加途经点": {
    "en": "＋ Add waypoint",
    "ja": "＋ 経由点を追加",
    "ko": "＋ 경유점 추가"
  },
  "应用试调后的{0}": {
    "en": "Apply the previewed {0}",
    "ja": "試調整した{0}を適用",
    "ko": "미리 조정한 {0} 적용"
  },
  "拖白线到另一时刻再添加；也可先试调当前点，再应用": {
    "en": "Move the white line to another time to add a point, or adjust the current point and Apply.",
    "ja": "白線を別の時刻へ移動して追加。または現在の点を試調整して適用。",
    "ko": "흰 선을 다른 시점으로 이동하여 추가하거나 현재 지점을 조정한 후 적용하세요"
  },
  "在此刻增加一个{0}点": {
    "en": "Add a {0} point at this time",
    "ja": "この時刻に{0}点を追加",
    "ko": "이 시점에 {0} 지점 추가"
  },
  "{0}，{1} 秒{2}": {
    "en": "{0}, {1} s{2}",
    "ja": "{0}、{1} 秒{2}",
    "ko": "{0} {1}초{2}"
  },
  "，左右拖动修改到达时间": {
    "en": "; drag horizontally to change arrival time",
    "ja": "。左右にドラッグして到着時刻を変更",
    "ko": " 좌우로 드래그하여 도착 시점 변경"
  },
  "{0} · {1}s，点击查看{2}{3}{4}": {
    "en": "{0} · {1}s. Click to view {2}{3}{4}",
    "ja": "{0} · {1}s。クリックして{2}を表示{3}{4}",
    "ko": "{0} · {1}s 클릭하여 {2} 보기{3}{4}"
  },
  "，拖动改时间": {
    "en": "; drag to change time",
    "ja": "。ドラッグして時刻を変更",
    "ko": " 드래그하여 시점 변경"
  },
  "，右键删除": {
    "en": "; right-click to delete",
    "ja": "。右クリックで削除",
    "ko": " 우클릭하여 삭제"
  },
  "停 {0}s": {
    "en": "Hold {0}s",
    "ja": "静止 {0}s",
    "ko": "정지 {0}s"
  },
  "{0}停留 {1} 秒，拖动{2}调整": {
    "en": "{0}: hold {1} s. Drag the {2} to adjust.",
    "ja": "{0} で {1} 秒静止。{2}をドラッグして調整。",
    "ko": "{0}에서 {1}초 정지 {2}을 드래그하여 조정"
  },
  "左边缘": {
    "en": "left edge",
    "ja": "左端",
    "ko": "왼쪽 가장자리"
  },
  "右边缘": {
    "en": "right edge",
    "ja": "右端",
    "ko": "오른쪽 가장자리"
  },
  "向左拖，让终点画面多停一会": {
    "en": "Drag left to hold the end frame longer",
    "ja": "左にドラッグして終点の静止時間を延長",
    "ko": "왼쪽으로 드래그하여 마지막 화면의 정지 시간 늘리기"
  },
  "向右拖，让这个画面多停一会": {
    "en": "Drag right to hold this frame longer",
    "ja": "右にドラッグしてこの構図の静止時間を延長",
    "ko": "오른쪽으로 드래그하여 이 화면의 정지 시간 늘리기"
  },
  "第 {0} 段：{1} → {2}": {
    "en": "Segment {0}: {1} → {2}",
    "ja": "区間 {0}：{1} → {2}",
    "ko": "구간 {0}: {1} → {2}"
  },
  "{0}，行进 {1} 秒，点击选择运镜段": {
    "en": "{0}. Travel {1} s. Click to select this motion segment.",
    "ja": "{0}。移動 {1} 秒。クリックして運動区間を選択。",
    "ko": "{0} 이동 {1}초 클릭하여 카메라 움직임 구간 선택"
  },
  "{0} · {1}s，点击后可单独应用运镜预设": {
    "en": "{0} · {1}s. Click to apply a preset to this segment.",
    "ja": "{0} · {1}s。クリックしてこの区間だけにプリセットを適用。",
    "ko": "{0} · {1}s 클릭하여 이 구간에만 움직임 프리셋 적용"
  },
  "第 {0} 段 · {1}s": {
    "en": "Segment {0} · {1}s",
    "ja": "区間 {0} · {1}s",
    "ko": "구간 {0} · {1}s"
  },
  "第 {0} 段 · {1} → {2}": {
    "en": "Segment {0} · {1} → {2}",
    "ja": "区間 {0} · {1} → {2}",
    "ko": "구간 {0} · {1} → {2}"
  },
  "此刻还没有{0}点": {
    "en": "No {0} point at this time",
    "ja": "この時刻には{0}点がありません",
    "ko": "이 시점에는 {0} 지점이 없습니다"
  },
  "当前是试调画面，应用后才会更新路径。": {
    "en": "This is a preview. Apply it to update the path.",
    "ja": "試調整の画面です。適用するとパスを更新します。",
    "ko": "현재는 미리보기입니다 적용하면 경로가 변경됩니다."
  },
  "运镜预设只作用这一段。点击圆点可回到单点编辑。": {
    "en": "Motion presets affect only this segment. Click a dot to edit one point.",
    "ja": "プリセットはこの区間だけに適用されます。丸をクリックすると単一の点を編集できます。",
    "ko": "움직임 프리셋은 이 구간에만 적용됩니다 점을 클릭하면 개별 지점을 편집할 수 있습니다."
  },
  "先试调上方{0}，再点击应用。中间点可右键删除。": {
    "en": "Adjust the {0} above, then click Apply. Right-click to delete intermediate points.",
    "ja": "上の{0}を試調整してから適用。中間点は右クリックで削除できます。",
    "ko": "위의 {0}을 조정한 다음 적용을 클릭하세요 중간 지점은 우클릭하여 삭제할 수 있습니다."
  },
  "试调满意后应用，即可新增途经点；也可以先添加点，再调整。": {
    "en": "Apply the preview to create a waypoint, or add a point first and then adjust it.",
    "ja": "試調整を適用すると経由点を追加できます。先に点を追加してから調整することもできます。",
    "ko": "미리 조정한 결과를 적용하여 경유점을 추가하거나 먼저 지점을 추가한 후 조정하세요."
  },
  "结束前停留": {
    "en": "Hold before ending",
    "ja": "終了前に静止",
    "ko": "종료 전 정지"
  },
  "这一段用时": {
    "en": "Segment duration",
    "ja": "この区間の長さ",
    "ko": "이 구간 길이"
  },
  "本场 {0} 个镜头会同步更新": {
    "en": "{0} shots in this scene will update together",
    "ja": "このシーンの {0} ショットを同時に更新",
    "ko": "이 장면의 샷 {0}개가 함께 변경됩니다"
  },
  "{0} 旁边": {
    "en": "Beside {0}",
    "ja": "{0} の横",
    "ko": "{0} 옆"
  },
  "放到 {0} 当前站位的旁边，保留间距": {
    "en": "Place beside {0}, leaving a gap.",
    "ja": "{0} の現在位置の横に間隔を空けて配置",
    "ko": "{0}의 현재 위치 옆에 간격을 두고 배치"
  },
  "已添加 {0}，并已选中定位。": {
    "en": "Added {0}, selected and located.",
    "ja": "{0} を追加し、選択して位置を表示しています。",
    "ko": "{0} 추가됨 물체를 선택하고 화면에 표시했습니다."
  },
  "已定位 {0}{1}，拍摄机位保持不变。": {
    "en": "Located {0}{1}. The shot camera is unchanged.",
    "ja": "{0}{1} の位置を表示。撮影カメラは変更していません。",
    "ko": "{0}{1} 위치 표시 촬영 카메라는 변경되지 않았습니다."
  },
  "{0} 个对象": {
    "en": "{0} objects",
    "ja": "{0} 個の物体",
    "ko": "물체 {0}개"
  }
};
  scope.StageI18n?.register(catalog);
  // Bind only explicitly authored UI fields. Never scan or rewrite project text.
  const sources=new Map();
  for(const [key,values] of Object.entries(catalog)){sources.set(key,key);for(const value of Object.values(values))if(!sources.has(value))sources.set(value,key);}
  const source=value=>sources.get(value)??value;
  const bindings=new Map();
  function apply(node,key,render){const value=render();if(key.startsWith('@'))node.setAttribute(key.slice(1),value);else node[key]=value;}
  function bind(node,key,render){let fields=bindings.get(node);if(!fields){fields=new Map();bindings.set(node,fields);}fields.set(key,render);apply(node,key,render);}
  function live(record){
    for(const key of Object.keys(record)){
      const value=record[key];
      if(value&&typeof value==='object')live(value);
      else if(typeof value==='string'&&sources.has(value)){const original=source(value);Object.defineProperty(record,key,{enumerable:true,configurable:true,get:()=>scope.StageI18n?.t(original)??original});}
    }
    return record;
  }
  scope.StagePanelI18n={bind,source,live};
  scope.addEventListener?.('stage-language-change',()=>{
    for(const [node,fields] of bindings){if(node.isConnected===false){bindings.delete(node);continue;}for(const [key,render] of fields)apply(node,key,render);}
  });
})(typeof window!=="undefined"?window:globalThis);
(typeof window!=="undefined"?window:globalThis).StageI18n.register({
  "当前没有可见的人物，人物构图不会切换到墙体或道具。": {
    "en": "No visible people are available. Person framing will not switch to walls or props.",
    "ja": "表示中の人物がいません。人物の構図では壁や小道具に切り替わりません。",
    "ko": "현재 보이는 인물이 없습니다. 인물 구도는 벽이나 소품으로 바뀌지 않습니다."
  }
});
