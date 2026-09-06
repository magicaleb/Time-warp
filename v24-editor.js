/* IndexedDB image persistence */
function db() {
  return new Promise((resolve,reject) => {
    const req = indexedDB.open(DB_NAME,1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function storeAsset(kind, blob) {
  const database = await db();
  await new Promise((resolve,reject) => {
    const tx = database.transaction(DB_STORE,"readwrite");
    const store = tx.objectStore(DB_STORE);
    blob ? store.put(blob,kind) : store.delete(kind);
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
  });
  database.close();
}
async function loadAsset(kind) {
  try {
    const database = await db();
    const result = await new Promise((resolve,reject) => {
      const req = database.transaction(DB_STORE).objectStore(DB_STORE).get(kind);
      req.onsuccess = () => resolve(req.result || null); req.onerror = () => reject(req.error);
    });
    database.close();
    return result;
  } catch { return null; }
}

function setAsset(kind, blob) {
  if (objectUrls[kind]) URL.revokeObjectURL(objectUrls[kind]);
  assets[kind] = blob || null;
  objectUrls[kind] = blob ? URL.createObjectURL(blob) : null;
  if (kind === "wallpaper") {
    if (blob) document.documentElement.style.setProperty("--wallpaper-image", `url("${objectUrls[kind]}")`);
    else document.documentElement.style.removeProperty("--wallpaper-image");
    $("wallpaperLabel").textContent = blob ? "Replace" : "Choose";
    $("removeWallpaper").hidden = !blob;
  } else if (kind === "reference") {
    if (blob) $("reference").src = objectUrls[kind]; else $("reference").removeAttribute("src");
    $("referenceLabel").textContent = blob ? "Replace" : "Choose";
    $("removeReference").hidden = !blob;
  } else if (kind === "cover") {
    $("cover").style.backgroundImage = blob ? `url("${objectUrls[kind]}")` : "";
    $("coverLabel").textContent = blob ? "Replace" : "Choose";
    $("removeCover").hidden = !blob;
  }
  applyAppearance(); syncSetup();
}

async function handleUpload(kind, file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) { toast("Choose an image file."); return; }
  try {
    const bitmap = await createImageBitmap(file);
    if (bitmap.width < 250 || bitmap.height < 400) { bitmap.close(); toast("Use a larger image for a clean lock screen."); return; }
    bitmap.close();
  } catch { toast("That image could not be opened."); return; }
  setAsset(kind,file);
  try { await storeAsset(kind,file); } catch { toast("Image is in use, but could not be saved locally."); }
}
async function removeAsset(kind) { setAsset(kind,null); try { await storeAsset(kind,null); } catch {} }

/* full-screen editor */
function openEditor() {
  mode = "edit";
  $("setup").hidden = true;
  $("stage").hidden = false;
  $("stage").className = "stage editing";
  $("editor").hidden = false;
  $("zoneEditor").hidden = true;
  $("calculator").hidden = true;
  $("cover").hidden = true;
  selectEditPart("clock");
  applyAppearance();
}

function selectEditPart(part) {
  editPart = part;
  if (part === "date" && !settings.showDate) { settings.showDate = true; saveSettings(); syncSetup(); }
  document.querySelectorAll("[data-edit-tab]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.editTab === part)));
  $("textEditor").hidden = !["clock","date"].includes(part);
  $("wallpaperEditor").hidden = part !== "wallpaper";
  $("referenceEditor").hidden = part !== "reference";
  document.querySelectorAll(".lock-text").forEach(el => el.classList.toggle("selected", el.dataset.drag === part));
  if (["clock","date"].includes(part)) {
    const s = settings[part];
    $("textStyle").value = s.style;
    $("textColor").value = s.color;
    $("textSize").min = part === "clock" ? "8" : "2";
    $("textSize").max = part === "clock" ? "34" : "12";
    $("textSize").value = String(s.size);
    $("textWeight").value = String(s.weight);
    $("textOpacity").value = String(s.opacity);
  }
  syncEditorControls(); applyAppearance();
}

function syncEditorControls() {
  $("editorOverlay").classList.toggle("top", settings.overlayPosition === "top");
  $("editorOverlay").classList.toggle("bottom", settings.overlayPosition !== "top");
  $("moveOverlay").setAttribute("aria-label", settings.overlayPosition === "top" ? "Move controls to bottom" : "Move controls to top");
  if (["clock","date"].includes(editPart)) {
    const s = settings[editPart];
    $("textSizeValue").textContent = s.size.toFixed(1);
    $("textWeightValue").textContent = String(s.weight);
    $("textOpacityValue").textContent = `${s.opacity}%`;
  }
  $("wallpaperZoom").value = String(settings.wallpaperZoom);
  $("wallpaperX").value = String(settings.wallpaperX);
  $("wallpaperY").value = String(settings.wallpaperY);
  $("wallpaperZoomValue").textContent = `${settings.wallpaperZoom}%`;
  $("wallpaperXValue").textContent = `${settings.wallpaperX}%`;
  $("wallpaperYValue").textContent = `${settings.wallpaperY}%`;
  $("referenceOpacity").value = String(settings.referenceOpacity);
  $("referenceOpacityValue").textContent = `${settings.referenceOpacity}%`;
}

function startPreview() {
  mode = "preview";
  $("stage").className = "stage preview-mode";
  $("editor").hidden = true;
  $("reference").hidden = true;
  renderClock(Date.now());
}

function exitPreview() {
  if (mode !== "preview") return;
  mode = "edit";
  $("stage").className = "stage editing";
  $("editor").hidden = false;
  applyAppearance();
}

/* tap-zone editor */
function openZones() {
  mode = "zones";
  $("setup").hidden = true;
  $("stage").hidden = false;
  $("stage").className = "stage";
  $("editor").hidden = true;
  $("zoneEditor").hidden = false;
  $("calculator").hidden = true;
  $("cover").hidden = true;
  syncZones();
}
function syncZones() {
  const map = $("zoneMap");
  map.style.setProperty("--zx", `${settings.zones.x}%`);
  map.style.setProperty("--zy", `${settings.zones.y}%`);
  map.style.setProperty("--zc", `${settings.zones.confirm}%`);
  document.querySelectorAll("[data-zone-value]").forEach(el => { el.value = String(settings.zones.values[Number(el.dataset.zoneValue)]); });
}

function zoneAt(clientX, clientY) {
  const r = $("stage").getBoundingClientRect();
  const x = clamp((clientX-r.left)/r.width*100,0,100);
  const y = clamp((clientY-r.top)/r.height*100,0,100);
  if (y >= settings.zones.confirm) return { type:"confirm" };
  const left = x < settings.zones.x;
  const top = y < settings.zones.y;
  const idx = top ? (left ? 0 : 1) : (left ? 2 : 3);
  return { type:"increment", value:settings.zones.values[idx], index:idx };
}
