/* Small, dependency-free camera timeline. All adapter times are seconds. */
(function (scope) {
  "use strict";
  const t=(source,vars)=>scope.StageI18n?.t(source,vars)??String(source).replace(/\{(\w+)\}/g,(all,key)=>vars?.[key]??all);
  const bind=(node,key,render)=>{if(scope.StagePanelI18n)return scope.StagePanelI18n.bind(node,key,render);const value=render();if(key.startsWith('@'))node.setAttribute(key.slice(1),value);else node[key]=value;};
  const sourceText=value=>scope.StagePanelI18n?.source(value)??value;
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const snap = (seconds, fps = 24) => Math.round(seconds * fps) / fps;
  const format = seconds => Number(Math.max(0, seconds).toFixed(2)).toLocaleString(scope.StageI18n?.locale==='zh'?'zh-CN':scope.StageI18n?.locale||'zh-CN', {maximumFractionDigits: 2});

  function stateFrom(raw = {}) {
    const fps = Math.max(1, number(raw.fps, 24));
    const duration = Math.max(1 / fps, number(raw.duration, 4));
    const keys = (raw.keys || []).map((key, index, all) => ({
      ...key,
      time: clamp(number(key.time, 0), 0, duration),
      hold: Math.max(0, number(key.hold, 0)),
      label: key.label || (index === 0 ? t("起点") : index === all.length - 1 ? t("终点") : t("途经点 {0}", {0: index})),
    }));
    keys.forEach((key, index) => {
      key.hold = index === keys.length - 1 ? duration - key.time :
        Math.min(key.hold, Math.max(0, keys[index + 1].time - key.time - 1 / fps));
    });
    const time = clamp(number(raw.time, 0), 0, duration);
    const activeIndex = Number.isInteger(raw.activeIndex) ? raw.activeIndex : keys.findIndex(key =>
      Math.abs(key.time - time) < .5 / fps || (time >= key.time && time <= key.time + key.hold));
    return {...raw, fps, duration, time, keys, activeIndex, readOnly: !!raw.readOnly};
  }

  function arrivalBounds(state, index) {
    const s = stateFrom(state), key = s.keys[index];
    if (!key || index === 0) return [0, 0];
    const previous = s.keys[index - 1], next = s.keys[index + 1];
    const min = previous.time + previous.hold + 1 / s.fps;
    const max = next ? next.time - key.hold - 1 / s.fps : s.duration;
    return [Math.min(min, max), max];
  }

  function arrivalAt(state, index, seconds) {
    const s = stateFrom(state), [min, max] = arrivalBounds(s, index);
    return clamp(snap(seconds, s.fps), min, max);
  }

  function holdBounds(state, index) {
    const s = stateFrom(state), key = s.keys[index];
    if (!key) return [0, 0];
    if (index === s.keys.length - 1) {
      const previous = s.keys[index - 1];
      return [0, Math.max(0, s.duration - (previous ? previous.time + previous.hold + 1 / s.fps : 0))];
    }
    return [0, Math.max(0, s.keys[index + 1].time - key.time - 1 / s.fps)];
  }

  function holdAt(state, index, seconds) {
    const s = stateFrom(state), [min, max] = holdBounds(s, index);
    return clamp(snap(seconds, s.fps), min, max);
  }

  function timeAt(clientX, left, width, duration, fps) {
    return clamp(snap((clientX - left) / Math.max(1, width) * duration, fps), 0, duration);
  }

  function nearest(state, seconds) {
    const s = stateFrom(state);
    return s.keys.findIndex(key => Math.abs(key.time - seconds) < .51 / s.fps);
  }

  function removalDecision(state, index) {
    const s = stateFrom(state);
    if (s.readOnly) return {allowed:false,reason:t("当前片场只可查看。")};
    if (s.pendingPreview) return {allowed:false,reason:t("请结束当前拖动后再删除途经点。")};
    if (!Number.isInteger(index) || !s.keys[index]) return {allowed:false,reason:t("这个路径点已不存在。")};
    if (index === 0 || index === s.keys.length - 1) return {allowed:false,reason:t("起点和终点需要保留，可以调整位置与时间。")};
    return {allowed:true};
  }

  const helpers = {stateFrom, snap, format, arrivalBounds, arrivalAt, holdBounds, holdAt, timeAt, nearest, removalDecision};

  function create(container, adapter) {
    if (!container || !adapter || typeof adapter.getState !== "function") throw new Error("Timeline needs a container and getState adapter.");
    const doc = container.ownerDocument;
    const listen = [];
    let keyListen = [];
    let drag = null, rangeEdit = null, state = stateFrom(adapter.getState()), keySignature = "", destroyed = false;
    let keyElements = [], holdElements = [], segmentElements = [];
    const node = (tag, className, text) => {
      const item = doc.createElement(tag);
      if (className) item.className = className;
      if (text !== undefined && text !== '') {const source=className==='st-key-label'?null:sourceText(text);bind(item, 'textContent', ()=>source===null?text:t(source));}
      return item;
    };
    const on = (element, event, handler, options) => {
      element.addEventListener(event, handler, options);
      listen.push(() => element.removeEventListener(event, handler, options));
    };
    const onKey = (element, event, handler) => {
      element.addEventListener(event, handler);
      keyListen.push(() => element.removeEventListener(event, handler));
    };
    const action = (label, className = "") => {
      const button = node("button", "st-button " + className, label);
      button.type = "button";
      return button;
    };
    const invoke = (name, ...args) => typeof adapter[name] === "function" ? adapter[name](...args) : undefined;
    const begin = kind => invoke("beginEdit", kind);
    const end = kind => invoke("endEdit", kind);
    const transaction = (kind, callback) => {
      begin(kind);
      try { callback(); } finally { end(kind); }
      render();
    };
    const read = () => stateFrom(adapter.getState());
    const subjectTrack = () => state.trackType === "subject";
    const noun = () => subjectTrack() ? t("位置") : t("构图");
    const captureText = () => state.pendingPreview ? (state.captureLabel || (subjectTrack() ? t("记下当前站位") : t("记下当前构图"))) : t("添加途经点");
    const selectedSegment = () => Number.isInteger(state.selectedSegment) && state.selectedSegment >= 0 && state.selectedSegment < state.keys.length - 1 ? state.selectedSegment : -1;
    const pendingMessage = () => t("请结束当前拖动后再切换时间或路径点。");
    const percent = seconds => `${clamp(seconds / state.duration * 100, 0, 100)}%`;

    const root = node("div", "stage-timeline");
    const header = node("div", "st-header");
    const intro = node("div", "st-intro");
    const title = node("strong", "st-heading", t("拖动时间，安排镜头"));
    const guide = node("p", "st-guide", t("拖到时刻 → 调整画面，自动记在这一刻。点击移动段，可单独设置这一段运镜。"));
    intro.append(title, guide);
    const capture = action(t("添加途经点"), "st-capture");
    header.append(intro, capture);
    const axis = node("div", "st-axis");
    const rail = node("div", "st-rail");
    bind(rail, '@aria-label', ()=>t("镜头时间轴：拖动白线选择时刻，双击空白添加构图"));
    const track = node("div", "st-track");
    const segments = node("div", "st-segments");
    const handles = node("div", "st-handles");
    const playhead = node("div", "st-playhead");
    const scrub = node("input", "st-scrubber");
    scrub.type = "range";
    scrub.min = "0";
    bind(scrub, '@aria-label', ()=>t("选择镜头时刻"));
    const currentTime = node("output", "st-current-time");
    currentTime.setAttribute("aria-live", "off");
    const playheadGrip = node("span", "st-playhead-grip");
    playhead.append(currentTime, playheadGrip);
    rail.append(track, segments, handles, playhead, scrub);
    const legend = node("div", "st-legend");
    legend.append(node("span", "st-legend-cue", t("白线选时间")), node("span", "", t("圆点是构图 · 右键删除途经点")), node("span", "", t("点移动段可组合运镜 · 浅色条是停留")));
    const selection = node("div", "st-selection");
    const selectionTitle = node("strong", "st-selection-title");
    const selectionDetail = node("span", "st-selection-detail");
    const remove = action(t("删除途经点"), "st-remove");
    selection.append(selectionTitle, selectionDetail, remove);
    const controls = node("div", "st-controls");
    function range(label, className, ariaLabel) {
      const wrap = node("label", "st-range-row " + className);
      const name = node("span", "st-range-label", label);
      const input = node("input", "st-range");
      input.type = "range";
      bind(input, '@aria-label', ()=>ariaLabel || label);
      const value = node("output", "st-range-value");
      wrap.append(name, input, value);
      return {wrap, input, value, name};
    }
    const hold = range(t("在这里停留"), "st-hold-range", t("拖动调整当前构图停留时间"));
    const travel = range(t("到下个构图"), "st-travel-range", t("拖动调整到下个构图的行进时间"));
    const total = range(t("整镜时长"), "st-total-range", t("拖动调整整镜时长"));
    controls.append(hold.wrap, travel.wrap, total.wrap);
    const feedback = node("p", "st-feedback");
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");
    root.append(header, axis, rail, legend, selection, controls, feedback);
    container.replaceChildren(root);

    function message(text) { bind(feedback, 'textContent', typeof text==='function'?text:()=>scope.StageI18n?.retranslate(text)??text); }
    function select(index) {
      const s = read(), key = s.keys[index];
      if (!key) return;
      if (s.pendingPreview) { message(pendingMessage); return; }
      invoke("selectSegment", null);
      invoke("seek", key.time);
      message(()=>(t("{0} · {1} 秒。调整上方{2}，位置会自动记下。", {0: key.label, 1: format(key.time), 2: subjectTrack() ? t("人物") : t("画面")})));
      render();
    }
    function remember(seconds) {
      if (read().readOnly) return;
      transaction("capture", () => {
        const result = invoke("capture", seconds);
        const latest = read(), index = typeof result?.index === "number" ? result.index : nearest(latest, seconds);
        if (index >= 0) invoke("seek", latest.keys[index]?.time ?? seconds);
        message(()=>(result?.message || (index >= 0 ? t("已记住 {0} 秒的{1}。拖到下一个时刻，继续调整{2}。", {0: format(seconds), 1: noun(), 2: subjectTrack() ? t("人物") : t("画面")}) : t("已记录当前{0}。", {0: noun()}))));
      });
    }
    on(capture, "click", () => {
      const s = read();
      if (s.readOnly) return;
      if (s.pendingPreview) {
        transaction("apply", () => {
          invoke("applyPreview");
          message(()=>(read().pendingPreview ? t("当前调整进行中，请检查上方提示。") : t("已记下当前{0}。", {0: noun()})));
        });
      } else remember(s.time);
    });
    function deletePoint(index) {
      const before = read(), decision = removalDecision(before, index);
      if (!decision.allowed) { message(()=>(scope.StageI18n?.retranslate(decision.reason)??decision.reason)); return; }
      transaction("remove", () => {
        invoke("selectSegment", null);
        invoke("remove", index);
        message(()=>(read().keys.length < before.keys.length ? t("已删除{0}，前后{1}直接衔接。可用撤销恢复。", {0: before.keys[index].label, 1: noun()}) : t("这个途经点未删除，请检查当前编辑状态。")));
      });
    }
    on(remove, "click", () => deletePoint(read().activeIndex));
    on(scrub, "input", () => {
      if (read().pendingPreview) message(pendingMessage);
      else invoke("seek", Number(scrub.value));
      render();
    });
    on(rail, "dblclick", event => {
      if (event.target.closest(".st-key,.st-hold-handle,.st-moving-band") || read().readOnly) return;
      if (read().pendingPreview) {message(pendingMessage);return;}
      const rect = rail.getBoundingClientRect(), s = read();
      const seconds = timeAt(event.clientX, rect.left, rect.width, s.duration, s.fps);
      invoke("seek", seconds);
      remember(seconds);
    });

    function startDrag(event, kind, index = -1) {
      if (event.button !== 0 || drag || (kind !== "seek" && read().readOnly)) return;
      const s = read(), key = s.keys[index];
      if (s.pendingPreview) {event.preventDefault();message(pendingMessage);return;}
      if (kind !== "seek" && !key) return;
      if (index >= 0) invoke("selectSegment", null);
      event.preventDefault();
      event.stopPropagation();
      const target = event.currentTarget;
      const rect = rail.getBoundingClientRect();
      drag = {kind, index, pointer: event.pointerId, target, x: event.clientX, width: rect.width, snapshot: s,
        handleTime: key ? (kind === "hold" && index < s.keys.length - 1 ? key.time + key.hold : key.time) : s.time};
      target.setPointerCapture?.(event.pointerId);
      if (kind === "seek") invoke("seek", timeAt(event.clientX, rect.left, rect.width, s.duration, s.fps));
      else { begin(kind); invoke("seek", key.time); }
      root.classList.add("st-dragging");
      render();
    }
    function moveDrag(event) {
      if (!drag || event.pointerId !== drag.pointer) return;
      event.preventDefault();
      const {kind, index, snapshot, handleTime} = drag;
      if (kind === "seek") {
        const rect = rail.getBoundingClientRect();
        invoke("seek", timeAt(event.clientX, rect.left, rect.width, snapshot.duration, snapshot.fps));
      } else {
        const wanted = handleTime + (event.clientX - drag.x) / Math.max(1, drag.width) * snapshot.duration;
        if (kind === "arrival") {
          const value = arrivalAt(snapshot, index, wanted);
          invoke("move", index, value);
          message(()=>(t("{0} · 在 {1} 秒到达。", {0: snapshot.keys[index].label, 1: format(value)})));
        } else {
          const last = index === snapshot.keys.length - 1;
          const value = holdAt(snapshot, index, last ? snapshot.duration - wanted : wanted - snapshot.keys[index].time);
          invoke("hold", index, value);
          message(()=>(t("{0} · 停留 {1} 秒{2}。", {0: snapshot.keys[index].label, 1: format(value), 2: last ? t("后结束镜头") : t("再出发")})));
        }
      }
      render();
    }
    function finishDrag(event) {
      if (!drag || event.pointerId !== drag.pointer) return;
      const previous = drag;
      drag = null;
      if (previous.target.hasPointerCapture?.(event.pointerId)) previous.target.releasePointerCapture(event.pointerId);
      if (previous.kind !== "seek") end(previous.kind);
      root.classList.remove("st-dragging");
      render();
    }
    on(rail, "pointerdown", event => {
      if (event.target.closest(".st-key,.st-hold-handle,.st-scrubber,.st-moving-band")) return;
      startDrag(event, "seek");
    });
    on(root, "pointermove", moveDrag);
    on(root, "pointerup", finishDrag);
    on(root, "pointercancel", finishDrag);
    on(root, "lostpointercapture", finishDrag);

    function rangeEvents(control, kind, mutate) {
      const start = () => {
        if (rangeEdit || read().readOnly || read().pendingPreview) return;
        rangeEdit = kind;
        begin(kind);
      };
      const finish = () => {
        if (rangeEdit !== kind) return;
        rangeEdit = null;
        end(kind);
        render();
      };
      on(control.input, "pointerdown", start);
      on(control.input, "input", () => {
        if (read().readOnly || read().pendingPreview) return;
        start();
        mutate(Number(control.input.value), read());
        render();
      });
      on(control.input, "change", finish);
      on(control.input, "pointerup", finish);
      on(control.input, "pointercancel", finish);
      on(control.input, "blur", finish);
    }
    rangeEvents(total, "duration", seconds => {
      invoke("duration", snap(seconds, read().fps));
      message(()=>(t("镜头共 {0} 秒，构图按原来的节奏分布。", {0: format(read().duration)})));
    });
    rangeEvents(hold, "hold", (seconds, s) => {
      if (s.activeIndex < 0) return;
      const index = s.activeIndex;
      invoke("seek", s.keys[index].time);
      invoke("hold", index, holdAt(s, index, seconds));
      const key = read().keys[index];
      if (key) invoke("seek", key.time);
      message(()=>(t("在这个{0}停留 {1} 秒{2}。", {0: noun(), 1: format(seconds), 2: index === s.keys.length - 1 ? t("后结束镜头") : t("再出发")})));
    });
    rangeEvents(travel, "travel", (seconds, s) => {
      const chosen = Number.isInteger(s.selectedSegment) ? s.selectedSegment : s.activeIndex;
      if (chosen < 0 || chosen >= s.keys.length - 1) return;
      const index = chosen, key = s.keys[index];
      const value = arrivalAt(s, index + 1, key.time + key.hold + seconds);
      invoke("move", index + 1, value);
      // Editing this segment keeps its departure point selected.
      if (!Number.isInteger(s.selectedSegment)) invoke("seek", key.time);
      message(()=>(t("从{0}到下个{1}用 {2} 秒。", {0: key.label, 1: noun(), 2: format(value - key.time - key.hold)})));
    });

    function keyboard(event, kind, index) {
      if (read().readOnly) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deletePoint(index);
        return;
      }
      if (read().pendingPreview) {message(pendingMessage);return;}
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const s = read(), key = s.keys[index], direction = event.key === "ArrowLeft" ? -1 : 1;
      const step = event.shiftKey ? .5 : 1 / s.fps;
      transaction(kind, () => {
        if (kind === "arrival") {
          const [min, max] = arrivalBounds(s, index);
          const value = event.key === "Home" ? min : event.key === "End" ? max : key.time + direction * step;
          invoke("move", index, arrivalAt(s, index, value));
        } else {
          const [min, max] = holdBounds(s, index);
          const value = event.key === "Home" ? min : event.key === "End" ? max : key.hold + direction * step;
          invoke("hold", index, holdAt(s, index, value));
        }
      });
    }
    function buildKeys() {
      keyListen.forEach(dispose => dispose());
      keyListen = [];
      handles.replaceChildren();
      segments.replaceChildren();
      keyElements = []; holdElements = []; segmentElements = [];
      state.keys.forEach((key, index) => {
        const button = action("", "st-key");
        button.dataset.point = String(index);
        const name = node("span", "st-key-label", key.label);
        const dot = node("span", "st-key-dot", index === 0 ? "" : index === state.keys.length - 1 ? "" : String(index));
        button.append(name, dot);
        onKey(button, "click", () => select(index));
        onKey(button, "pointerdown", event => startDrag(event, index === 0 ? "seek" : "arrival", index));
        onKey(button, "keydown", event => keyboard(event, "arrival", index));
        onKey(button, "contextmenu", event => {event.preventDefault();event.stopPropagation();deletePoint(index);});
        handles.append(button);
        keyElements.push(button);
        const band = node("div", "st-hold-band");
        const bandLabel = node("span", "st-band-label");
        const grip = action("", "st-hold-handle");
        grip.append(node("span", "st-hold-grip", "Ⅱ"));
        onKey(grip, "pointerdown", event => startDrag(event, "hold", index));
        onKey(grip, "keydown", event => keyboard(event, "hold", index));
        onKey(grip, "click", () => select(index));
        band.append(bandLabel);
        segments.append(band, grip);
        holdElements.push({band, label: bandLabel, grip});
        if (index < state.keys.length - 1) {
          const moving = action("", "st-moving-band");
          moving.dataset.segment = String(index);
          onKey(moving, "click", () => {
            if (read().pendingPreview) {message(pendingMessage);return;}
            invoke("selectSegment", index);
            const latest = read();
            message(()=>(t("已选第 {0} 段：{1} → {2}。之后选择运镜预设，只调整这一段。", {0: index + 1, 1: latest.keys[index].label, 2: latest.keys[index + 1].label})));
            render();
          });
          segments.append(moving);
          segmentElements.push(moving);
        }
      });
    }
    function setRange(control, min, max, value, disabled) {
      control.input.min = String(min);
      control.input.max = String(Math.max(min, max));
      control.input.step = String(1 / state.fps);
      if (doc.activeElement !== control.input || rangeEdit === null) control.input.value = String(value);
      control.input.disabled = disabled || max <= min;
      bind(control.value, 'textContent', ()=>format(value) + " s");
      bind(control.input, '@aria-valuetext', ()=>format(value) + t(" 秒"));
      control.input.style.setProperty("--range", `${max > min ? (value - min) / (max - min) * 100 : 0}%`);
    }
    function render() {
      if (destroyed) return;
      state = read();
      const signature = (scope.StageI18n?.locale||'zh') + ":" + state.shotId + ":" + state.keys.length;
      if (signature !== keySignature && !drag) {
        keySignature = signature;
        buildKeys();
        if (root.dataset.shot !== String(state.shotId)) { bind(feedback, 'textContent', ()=>""); root.dataset.shot = String(state.shotId); }
      }
      bind(title, 'textContent', ()=>state.trackLabel || t("拖动时间，安排镜头"));
      bind(guide, 'textContent', ()=>state.pendingPreview ? t("正在调整，松开后可继续移动时间线。") : subjectTrack() ? t("拖到时刻 → 移动人物，自动记下站位。右键可删除中间站位点。") : t("拖到时刻 → 调整画面，自动记在这一刻。点击移动段，可单独设置这一段运镜。"));
      bind(rail, '@aria-label', ()=>(state.trackLabel || t("镜头")) + t("时间轴：拖动白线选择时刻，双击空白添加") + noun());
      bind(travel.name, 'textContent', ()=>subjectTrack() ? t("走到下个位置") : t("到下个构图"));
      const durationText = format(state.duration);
      const ticks = state.duration > 12 ? 6 : 4;
      if (axis.dataset.duration !== String(state.duration)) {
        axis.replaceChildren(...Array.from({length: ticks + 1}, (_, index) => {
          const label = node("span", "", `${format(state.duration * index / ticks)}s`);
          label.style.left = `${100 * index / ticks}%`;
          return label;
        }));
        axis.dataset.duration = String(state.duration);
      }
      bind(currentTime, 'textContent', ()=>`${format(state.time)}s`);
      playhead.style.left = percent(state.time);
      playhead.classList.toggle("st-at-end", state.time > state.duration * .9);
      scrub.max = String(state.duration);
      scrub.step = String(1 / state.fps);
      scrub.value = String(state.time);
      bind(scrub, '@aria-valuetext', ()=>t("{0} 秒，共 {1} 秒", {0: format(state.time), 1: durationText}));
      capture.disabled = state.readOnly || (!state.pendingPreview && state.activeIndex >= 0);
      bind(capture, 'textContent', ()=>state.pendingPreview ? captureText() : state.activeIndex >= 0 ? t("此刻已有路径点 ✓") : t("＋ 添加途经点"));
      bind(capture, 'title', ()=>state.pendingPreview ? t("记下调整后的{0}", {0: noun()}) : state.activeIndex >= 0 ? t("拖白线到另一时刻再添加；调整当前画面会自动更新这个点") : t("在此刻增加一个{0}点", {0: noun()}));
      root.classList.toggle("st-many-points", state.keys.length > 7);
      state.keys.forEach((key, index) => {
        const button = keyElements[index], holdUI = holdElements[index];
        if (!button || !holdUI) return;
        const active = index === state.activeIndex;
        button.style.left = percent(key.time);
        button.classList.toggle("is-selected", active);
        const adjacent = Math.min(key.time - (state.keys[index - 1]?.time ?? -Infinity),
          (state.keys[index + 1]?.time ?? Infinity) - key.time);
        const crowded = adjacent / state.duration * Math.max(1, rail.clientWidth) < 58;
        button.classList.toggle("st-label-quiet", crowded && !active && index > 0 && index < state.keys.length - 1);
        button.classList.toggle("is-endpoint", index === 0 || index === state.keys.length - 1);
        bind(button, '@aria-label', ()=>t("{0}，{1} 秒{2}", {0: key.label, 1: format(key.time), 2: index ? t("，左右拖动修改到达时间") : ""}));
        button.setAttribute("aria-pressed", String(active));
        bind(button, 'title', ()=>t("{0} · {1}s，点击查看{2}{3}{4}", {0: key.label, 1: format(key.time), 2: noun(), 3: index ? t("，拖动改时间") : "", 4: index > 0 && index < state.keys.length - 1 ? t("，右键删除") : ""}));
        button.disabled = false;
        const last = index === state.keys.length - 1;
        holdUI.band.style.left = percent(key.time);
        holdUI.band.style.width = percent(key.hold);
        holdUI.band.classList.toggle("is-selected", active);
        bind(holdUI.label, 'textContent', ()=>key.hold > 0 ? t("停 {0}s", {0: format(key.hold)}) : "");
        holdUI.label.hidden = key.hold / state.duration < .08;
        holdUI.grip.style.left = percent(last ? key.time : key.time + key.hold);
        holdUI.grip.classList.toggle("is-selected", active);
        holdUI.grip.classList.toggle("st-final-hold", last);
        holdUI.grip.hidden = !active || state.readOnly;
        bind(holdUI.grip, '@aria-label', ()=>t("{0}停留 {1} 秒，拖动{2}调整", {0: key.label, 1: format(key.hold), 2: last ? t("左边缘") : t("右边缘")}));
        bind(holdUI.grip, 'title', ()=>last ? t("向左拖，让终点画面多停一会") : t("向右拖，让这个画面多停一会"));
        const moving = segmentElements[index];
        if (moving) {
          const start = key.time + key.hold, gap = state.keys[index + 1].time - start;
          moving.style.left = percent(start);
          moving.style.width = percent(gap);
          const caption = t("第 {0} 段：{1} → {2}", {0: index + 1, 1: key.label, 2: state.keys[index + 1].label});
          moving.classList.toggle("is-selected", selectedSegment() === index);
          moving.setAttribute("aria-pressed", String(selectedSegment() === index));
          bind(moving, '@aria-label', ()=>t("{0}，行进 {1} 秒，点击选择运镜段", {0: caption, 1: format(gap)}));
          bind(moving, 'title', ()=>t("{0} · {1}s，点击后可单独应用运镜预设", {0: caption, 1: format(gap)}));
          bind(moving, 'textContent', ()=>gap / state.duration >= .1 ? t("第 {0} 段 · {1}s", {0: index + 1, 1: format(gap)}) : String(index + 1));
        }
      });
      const segment = selectedSegment(), selected = state.keys[state.activeIndex];
      bind(selectionTitle, 'textContent', ()=>segment >= 0 ? t("第 {0} 段 · {1} → {2}", {0: segment + 1, 1: state.keys[segment].label, 2: state.keys[segment + 1].label}) : selected ? `${selected.label} · ${format(selected.time)}s` : t("此刻还没有{0}点", {0: noun()}));
      bind(selectionDetail, 'textContent', ()=>state.pendingPreview ? t("当前画面正在调整，位置会自动记下。") : segment >= 0 ? t("运镜预设只作用这一段。点击圆点可回到单点编辑。") : selected ? t("调整上方{0}会自动更新当前点。中间点可右键删除。", {0: subjectTrack() ? t("人物") : t("画面")}) : t("在这个时刻调整画面会自动新增途经点；也可先添加点，再调整。"));
      remove.hidden = segment >= 0 || !selected || state.activeIndex === 0 || state.activeIndex === state.keys.length - 1;
      remove.disabled = state.readOnly || !!state.pendingPreview;
      hold.wrap.hidden = segment >= 0 || !selected;
      const travelIndex = segment >= 0 ? segment : state.activeIndex;
      travel.wrap.hidden = travelIndex < 0 || travelIndex >= state.keys.length - 1;
      if (selected) {
        const index = state.activeIndex;
        bind(hold.name, 'textContent', ()=>index === state.keys.length - 1 ? t("结束前停留") : t("在这里停留"));
        const [min, max] = holdBounds(state, index);
        setRange(hold, min, max, selected.hold, state.readOnly || !!state.pendingPreview);
      }
      if (travelIndex >= 0 && travelIndex < state.keys.length - 1) {
        const key = state.keys[travelIndex], departure = key.time + key.hold;
        const bounds = arrivalBounds(state, travelIndex + 1);
        bind(travel.name, 'textContent', ()=>segment >= 0 ? t("这一段用时") : subjectTrack() ? t("走到下个位置") : t("到下个构图"));
        setRange(travel, Math.max(1 / state.fps, bounds[0] - departure), Math.max(1 / state.fps, bounds[1] - departure),
          state.keys[travelIndex + 1].time - departure, state.readOnly || !!state.pendingPreview);
      }
      const minDuration = Math.max(1 / state.fps, number(state.minDuration, .25));
      setRange(total, minDuration, Math.max(state.duration, number(state.maxDuration, 30)), state.duration, state.readOnly || !!state.pendingPreview);
    }
    if(scope.addEventListener)on(scope,'stage-language-change',render);
    render();
    return {render, select, destroy() {
      destroyed = true;
      if (drag && drag.kind !== "seek") end(drag.kind);
      if (rangeEdit) end(rangeEdit);
      listen.forEach(dispose => dispose());
      keyListen.forEach(dispose => dispose());
      container.replaceChildren();
    }};
  }
  scope.StageTimeline = {create, helpers};
})(typeof window === "undefined" ? globalThis : window);
