/* pointer gestures and dragging */
function stagePoint(event) {
  const r = $("stage").getBoundingClientRect();
  return { x:clamp((event.clientX-r.left)/r.width*100,0,100), y:clamp((event.clientY-r.top)/r.height*100,0,100), r };
}
function onStagePointerDown(event) {
  if (event.pointerType === "touch") {
    activePointers.set(event.pointerId,{x:event.clientX,y:event.clientY,startY:event.clientY});
    if (activePointers.size === 2) {
      const pts=[...activePointers.values()];
      swipeStart={ y:(pts[0].y+pts[1].y)/2, time:window.performance.now() };
      suppressTap=true;
    }
  }
  if (mode === "edit") {
    const part = event.target?.dataset?.drag;
    if (part === "clock" || part === "date") {
      selectEditPart(part);
      const p=stagePoint(event); dragState={ type:part, pointerId:event.pointerId, startX:p.x, startY:p.y, originX:settings[part].x, originY:settings[part].y };
      event.target.setPointerCapture?.(event.pointerId); event.preventDefault();
    } else if (editPart === "wallpaper" && (event.target === $("wallpaper") || event.target === $("stage"))) {
      const p=stagePoint(event); dragState={ type:"wallpaper", pointerId:event.pointerId, startX:p.x, startY:p.y, originX:settings.wallpaperX, originY:settings.wallpaperY };
      $("stage").setPointerCapture?.(event.pointerId); event.preventDefault();
    }
  }
}
function onStagePointerMove(event) {
  if (activePointers.has(event.pointerId)) {
    const p=activePointers.get(event.pointerId); p.x=event.clientX; p.y=event.clientY;
    if (activePointers.size >= 2 && swipeStart) {
      const pts=[...activePointers.values()].slice(0,2); const y=(pts[0].y+pts[1].y)/2;
      if (y-swipeStart.y > 85 && window.performance.now()-swipeStart.time < 1800) {
        swipeStart=null; suppressTap=true;
        if (mode === "preview") exitPreview(); else if (["performance","calculator"].includes(mode)) showSetup();
      }
    }
  }
  if (!dragState || dragState.pointerId !== event.pointerId || mode !== "edit") return;
  const p=stagePoint(event); const dx=p.x-dragState.startX; const dy=p.y-dragState.startY;
  if (dragState.type === "wallpaper") { settings.wallpaperX=clamp(dragState.originX+dx,0,100); settings.wallpaperY=clamp(dragState.originY+dy,0,100); }
  else { settings[dragState.type].x=clamp(dragState.originX+dx,0,100); settings[dragState.type].y=clamp(dragState.originY+dy,0,100); }
  applyAppearance(); syncEditorControls();
}
function onStagePointerUp(event) {
  const wasDragging = dragState && dragState.pointerId === event.pointerId;
  if (wasDragging) { dragState=null; saveSettings(); }
  if (activePointers.has(event.pointerId)) activePointers.delete(event.pointerId);
  const shouldTap = !wasDragging && mode === "performance" && !suppressTap;
  if (shouldTap) performanceTap(event);
  if (activePointers.size === 0) { swipeStart=null; setTimeout(() => { suppressTap=false; },0); }
}

/* bindings */
document.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click",() => selectMainTab(b.dataset.tab)));
document.querySelectorAll("[data-setting]").forEach(el => el.addEventListener("change",() => {
  const key=el.dataset.setting;
  settings[key] = el.type === "checkbox" ? el.checked : (["holdDuration","rewindSpeed"].includes(key) ? Number(el.value) : el.value);
  if (key === "calculatorEnabled" && !settings.calculatorEnabled && settings.inputMethod === "calculator") settings.inputMethod="taps";
  saveSettings(); syncSetup(); applyAppearance();
}));
$("inputMethod").addEventListener("change",() => { settings.inputMethod=$("inputMethod").value; saveSettings(); syncSetup(); });
$("confirmMode").addEventListener("change",() => { settings.confirmMode=$("confirmMode").value; saveSettings(); syncSetup(); });
$("openEditor").addEventListener("click",openEditor);
$("editorDone").addEventListener("click",showSetup);
$("preview").addEventListener("click",startPreview);
$("moveOverlay").addEventListener("click",() => { settings.overlayPosition=settings.overlayPosition==="top"?"bottom":"top"; saveSettings(); syncEditorControls(); });
document.querySelectorAll("[data-edit-tab]").forEach(b => b.addEventListener("click",() => selectEditPart(b.dataset.editTab)));
for (const [id,key] of [["textStyle","style"],["textColor","color"],["textSize","size"],["textWeight","weight"],["textOpacity","opacity"]]) {
  $(id).addEventListener("input",() => { if(!["clock","date"].includes(editPart))return; settings[editPart][key]=["size","weight","opacity"].includes(key)?Number($(id).value):$(id).value; applyAppearance(); syncEditorControls(); });
  $(id).addEventListener("change",saveSettings);
}
for (const [id,key] of [["wallpaperZoom","wallpaperZoom"],["wallpaperX","wallpaperX"],["wallpaperY","wallpaperY"],["referenceOpacity","referenceOpacity"]]) {
  $(id).addEventListener("input",() => { settings[key]=Number($(id).value); applyAppearance(); syncEditorControls(); });
  $(id).addEventListener("change",saveSettings);
}
$("editZones").addEventListener("click",openZones);
$("zoneDone").addEventListener("click",showSetup);
document.querySelectorAll("[data-zone-value]").forEach(el => el.addEventListener("change",() => { const i=Number(el.dataset.zoneValue); settings.zones.values[i]=clamp(Math.round(Number(el.value)||DEFAULTS.zones.values[i]),1,180); saveSettings(); syncZones(); }));
document.querySelectorAll("[data-divider]").forEach(el => el.addEventListener("pointerdown",event => { zoneDrag={key:el.dataset.divider,pointerId:event.pointerId}; el.setPointerCapture(event.pointerId); event.preventDefault(); }));
$("zoneMap").addEventListener("pointermove",event => {
  if(!zoneDrag||zoneDrag.pointerId!==event.pointerId)return;
  const r=$("zoneMap").getBoundingClientRect(); const x=clamp((event.clientX-r.left)/r.width*100,0,100); const y=clamp((event.clientY-r.top)/r.height*100,0,100);
  if(zoneDrag.key==="x")settings.zones.x=clamp(x,20,80);
  if(zoneDrag.key==="y")settings.zones.y=clamp(y,20,settings.zones.confirm-12);
  if(zoneDrag.key==="confirm")settings.zones.confirm=clamp(y,settings.zones.y+12,94);
  syncZones();
});
$("zoneMap").addEventListener("pointerup",event => { if(zoneDrag?.pointerId===event.pointerId){zoneDrag=null;saveSettings();} });

$("wallpaperInput").addEventListener("change",e => { handleUpload("wallpaper",e.target.files?.[0]); e.target.value=""; });
$("referenceInput").addEventListener("change",e => { handleUpload("reference",e.target.files?.[0]); e.target.value=""; });
$("coverInput").addEventListener("change",e => { handleUpload("cover",e.target.files?.[0]); e.target.value=""; });
$("removeWallpaper").addEventListener("click",() => removeAsset("wallpaper"));
$("removeReference").addEventListener("click",() => removeAsset("reference"));
$("removeCover").addEventListener("click",() => removeAsset("cover"));
$("perform").addEventListener("click",startPerformance);
$("copyShortcut").addEventListener("click",async() => { try{await navigator.clipboard.writeText($("shortcutUrl").value);toast("Shortcut template copied");}catch{ $("shortcutUrl").select(); toast("Copy the selected URL"); } });
$("acceptPaste").addEventListener("click",() => { const n=parseChoice($("performancePaste").value); if(n===null){toast("Paste a whole number from 1 to 180.");return;} $("manualPaste").hidden=true; performance.choice=n; reveal(n); });
$("cancelPaste").addEventListener("click",() => { $("manualPaste").hidden=true; });

document.querySelectorAll("[data-calc]").forEach(button => {
  if (button.id === "calcEquals") return;
  button.addEventListener("click",() => calculatorKey(button.dataset.calc));
});
$("calcEquals").addEventListener("pointerdown",event => { equalsHeld=false; equalsHoldTimer=setTimeout(()=>{equalsHeld=true;secretCalculatorCapture();},700); event.preventDefault(); });
$("calcEquals").addEventListener("pointerup",event => { clearTimeout(equalsHoldTimer); if(!equalsHeld && mode==="calculator") calculatorKey("="); equalsHeld=false; event.preventDefault(); });
$("calcEquals").addEventListener("pointercancel",()=>{clearTimeout(equalsHoldTimer);equalsHeld=false;});

$("stage").addEventListener("pointerdown",onStagePointerDown);
$("stage").addEventListener("pointermove",onStagePointerMove);
$("stage").addEventListener("pointerup",onStagePointerUp);
$("stage").addEventListener("pointercancel",onStagePointerUp);
document.addEventListener("keydown",event => { if(event.key==="Escape"){ if(mode==="preview")exitPreview(); else if(mode!=="setup")showSetup(); } });
document.addEventListener("visibilitychange",() => { if(document.visibilityState==="visible" && mode==="performance" && performance.phase==="landed"){ performance.displayMs=floorMinute(); renderClock(performance.displayMs); } });

async function init() {
  consumeShortcutValue();
  for (const kind of ["wallpaper","reference","cover"]) setAsset(kind,await loadAsset(kind));
  syncSetup(); applyAppearance(); syncZones();
  if (shortcutChoice !== null) {
    selectMainTab("input");
    setTimeout(() => {
      preparePerformance("shortcut",shortcutChoice);
      if (!settings.useCover) reveal(shortcutChoice);
    }, 80);
  }
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("./sw.js?v=24").catch(()=>{});
}

init();

// Minimal QA surface for automated browser checks; inert for normal use.
window.__TIMEWARP_QA__ = {
  settings: () => structuredClone(settings),
  state: () => ({ mode, performance:{...performance,timer:Boolean(performance.timer)}, total, tapCount, shortcutChoice }),
  parseChoice,
  shortcutChoiceFromUrl,
  zoneAt,
  reveal,
  showSetup,
};
