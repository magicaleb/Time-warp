import { formatClock, formatLockDate, getInputZone, isValidChoice, parseMinutes } from "./core.js?v=17";
import { SETTINGS_KEY, LEGACY_KEY, normalizeSettings, clamp } from "./settings.js?v=17";
import { readMedia, writeMedia, validateImage } from "./media.js?v=17";
import { Round } from "./round.js?v=17";
import { Calculator } from "./calculator.js?v=17";

const $ = (id) => document.getElementById(id);
const stage = $("stage");
const lockView = $("lockView");
const setup = $("setupScreen");
let settings;
try { settings = normalizeSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) || localStorage.getItem(LEGACY_KEY) || "{}"), innerWidth / innerHeight); }
catch { settings = normalizeSettings(); }
let mode = "setup";
let selectedPart = "clock";
let ready = false;
let total = 0;
let tapCount = 0;
let drag = null;
let wakeLock = null;
let wantWakeLock = false;
let toastTimer;
let saveTimer;
let calcHoldTimer;
let calcHoldTriggered = false;
let calcPointer = null;
let roundSource = "taps";
let roundCovered = true;
let lastPhase = "setup";
let referenceOpacity = 50;
const pointers = new Map();
let swipe = null;
let multiTouch = false;
const assets = { wallpaper: null, reference: null, cover: null };
const uploadGeneration = { wallpaper: 0, reference: 0, cover: 0 };
const mediaWrites = {};
const calculator = new Calculator();
const round = new Round({ change: renderRound });

function saveSettings() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
    catch { showToast("Settings could not be saved on this device."); }
  }, 120);
}
function showToast(message) {
  clearTimeout(toastTimer);
  $("toast").textContent = message;
  $("toast").hidden = false;
  toastTimer = setTimeout(() => { $("toast").hidden = true; }, 2600);
}
function showError(message) {
  $("setupError").textContent = message;
  $("setupError").hidden = !message;
}
function tab(name) {
  document.querySelectorAll("[data-tab]").forEach(el => el.setAttribute("aria-pressed", String(el.dataset.tab === name)));
  document.querySelectorAll("[data-panel]").forEach(el => { el.hidden = el.dataset.panel !== name; });
  document.querySelector(".settings-content").scrollTop = 0;
}
function syncSettings() {
  document.querySelectorAll("[data-setting]").forEach(el => {
    const value = settings[el.dataset.setting];
    if (el.type === "checkbox") el.checked = value;
    else el.value = String(value);
  });
  // Keep a previously saved custom pace available instead of silently changing it.
  const pace = $("rewindSpeed");
  if (!pace.value) {
    pace.add(new Option(settings.rewindSpeed + " ms", settings.rewindSpeed));
    pace.value = settings.rewindSpeed;
  }
  syncInput();
  syncZones();
  syncEditor();
}
function syncInput() {
  const method = settings.inputMethod;
  $("calculatorOption").hidden = !settings.calculatorEnabled;
  $("calculatorOption").disabled = !settings.calculatorEnabled;
  $("inputMethod").value = method;
  $("numberRow").hidden = method !== "number";
  $("editZones").hidden = method !== "taps";
  $("autoConfirmRow").hidden = method !== "taps";
  $("coverImageRow").hidden = !settings.useCover;
  $("shortcutHelp").hidden = method !== "shortcut";
  if (method !== "clipboard") $("pasteFallback").hidden = true;
  $("dateFormat").disabled = !settings.showDate;
  const cover = settings.useCover;
  const messages = {
    taps: cover ? "Enter minutes using your invisible zones, then confirm to wake the clock." : "Enter minutes on the visible tap map, then confirm to reveal.",
    clipboard: cover ? "Start, run your Shortcut, then return and tap the cover. The app reads the clipboard, validates the number, then fades in the clock. iOS may ask you to tap Paste." : "Run your Shortcut first. Paste & perform reads and validates the clipboard before showing the clock. iOS may ask you to tap Paste.",
    shortcut: cover ? "The link loads the minutes and opens the cover. Tap once to reveal." : "The link loads the minutes, then reveals immediately.",
    number: cover ? "Load the minutes, then tap the cover to reveal." : "The clock appears as soon as you start.",
    calculator: "Enter their number as part of a calculation. Hold = for 0.7 seconds to use the last number entered." + (cover ? " Tap the cover to reveal." : " The clock then appears."),
  };
  $("inputHelp").textContent = messages[method];
  $("performButton").textContent = method === "clipboard" && !cover ? "Paste & perform" : method === "calculator" ? "Open calculator" : method === "shortcut" ? "Open using your Shortcut" : "Start performance";
  $("performButton").disabled = !ready || method === "shortcut" || round.phase === "reading";
  const url = new URL(location.href);
  url.search = "";
  url.hash = "minutes=NUMBER";
  $("shortcutURL").value = url.href;
}
function syncEditor() {
  const isText = selectedPart !== "wallpaper";
  $("textControls").hidden = !isText;
  $("imageControls").hidden = isText;
  document.querySelectorAll("[data-part-tab]").forEach(el => el.setAttribute("aria-pressed", String(el.dataset.partTab === selectedPart)));
  document.querySelectorAll(".lock-text").forEach(el => el.classList.toggle("selected", el.dataset.part === selectedPart));
  if (isText) {
    const part = settings[selectedPart];
    $("textSize").min = selectedPart === "clock" ? 8 : 2;
    $("textSize").max = selectedPart === "clock" ? 34 : 12;
    for (const [id, key] of [["textSize","size"],["textWeight","weight"],["textOpacity","opacity"],["textStyle","style"],["textColor","color"]]) $(id).value = part[key];
    $("sizeValue").textContent = String(Number(part.size.toFixed(1)));
    $("weightValue").textContent = part.weight;
    $("opacityValue").textContent = part.opacity + "%";
  }
  $("zoomValue").textContent = settings.wallpaperZoom + "%";
  $("referenceRow").hidden = !assets.reference;
  $("referenceLayer").hidden = mode !== "edit" || !assets.reference || referenceOpacity === 0;
  $("referenceLayer").style.opacity = referenceOpacity / 100;
}
function selectPart(part) {
  selectedPart = part;
  if (part === "date" && !settings.showDate) {
    settings.showDate = true;
    $("showDate").checked = true;
    saveSettings();
  }
  syncEditor();
  applyAppearance();
}
function applyAppearance() {
  const root = document.documentElement.style;
  root.setProperty("--wallpaper-zoom", settings.wallpaperZoom / 100);
  root.setProperty("--wallpaper-x", settings.wallpaperX + "%");
  root.setProperty("--wallpaper-y", settings.wallpaperY + "%");
  for (const part of ["clock","date"]) {
    const s = settings[part];
    const el = $(part + "Text");
    root.setProperty("--" + part + "-size", s.size);
    Object.assign(el.style, { left: s.x + "%", top: s.y + "%", fontWeight: s.weight, color: s.color, opacity: s.opacity / 100, fontSize: "" });
    el.dataset.style = s.style;
  }
  $("dateText").hidden = !settings.showDate;
  renderTime(["holding","rewinding","landed"].includes(round.phase) ? round.date() : new Date());
}
function renderTime(date) {
  $("clockText").textContent = formatClock(date, settings.use24Hour);
  $("dateText").textContent = formatLockDate(date, settings.dateFormat);
  if (stage.hidden) return;
  for (const part of ["clock","date"]) {
    const el = $(part + "Text");
    if (el.hidden) continue;
    el.style.fontSize = "";
    const box = lockView.getBoundingClientRect();
    if (!box.width) continue;
    const width = el.scrollWidth;
    if (width > box.width * .98) el.style.fontSize = settings[part].size * box.width / 100 * box.width * .98 / width + "px";
    const bounds = el.getBoundingClientRect();
    const halfX = bounds.width / box.width * 50;
    const halfY = bounds.height / box.height * 50;
    el.style.left = clamp(settings[part].x, halfX, 100-halfX) + "%";
    el.style.top = clamp(settings[part].y, halfY, 100-halfY) + "%";
  }
}
function syncZones() {
  for (const key of ["x","y","confirm"]) $("zoneMap").style.setProperty("--zone-" + key, settings.zones[key] + "%");
  document.querySelectorAll("[data-zone-value]").forEach(el => {
    el.value = settings.zones.values[Number(el.dataset.zoneValue)];
    el.disabled = mode === "performance";
  });
}
function setAsset(kind, blob) {
  if (assets[kind]) URL.revokeObjectURL(assets[kind]);
  assets[kind] = blob ? URL.createObjectURL(blob) : null;
  const image = assets[kind] ? 'url("' + assets[kind] + '")' : "";
  if (kind === "wallpaper") {
    if (blob) document.documentElement.style.setProperty("--wallpaper-image", image);
    else document.documentElement.style.removeProperty("--wallpaper-image");
    document.querySelector(".wallpaper-layer").style.removeProperty("background-image");
    document.querySelector(".mini-wallpaper").style.removeProperty("background-image");
  } else if (kind === "cover") {
    $("coverLayer").style.backgroundImage = image;
    $("removeCover").hidden = !blob;
    document.documentElement.style.setProperty("--cover-image", image || "none");
  } else {
    if (blob) $("referenceLayer").src = assets.reference;
    else $("referenceLayer").removeAttribute("src");
    $("removeReference").hidden = !blob;
  }
  $(kind + "Label").textContent = blob ? "Replace" : "Choose";
  syncEditor();
}
async function upload(kind, file) {
  if (!file) return;
  const generation = ++uploadGeneration[kind];
  try {
    await validateImage(file);
    if (generation !== uploadGeneration[kind]) return;
    setAsset(kind, file);
    if (kind === "reference") { referenceOpacity = 50; $("referenceOpacity").value = 50; $("referenceValue").textContent = "50%"; syncEditor(); }
    mediaWrites[kind] = (mediaWrites[kind] || Promise.resolve()).catch(() => {}).then(() => writeMedia(kind, file));
    await mediaWrites[kind];
  } catch (error) { showToast(assets[kind] && generation === uploadGeneration[kind] ? error.message + " The current image remains available for this session." : error.message); }
}
async function removeAsset(kind) {
  uploadGeneration[kind]++;
  setAsset(kind, null);
  try {
    mediaWrites[kind] = (mediaWrites[kind] || Promise.resolve()).catch(() => {}).then(() => writeMedia(kind, null));
    await mediaWrites[kind];
  } catch { showToast("The saved image could not be removed. Try again."); }
}
function cleanStage() {
  stage.classList.remove("editing","entering","waking");
  for (const id of ["editorUI","zoneEditor","visibleInput","coverLayer","calculator","referenceLayer"]) $(id).hidden = true;
  lockView.hidden = false;
}
function openEditor() {
  mode = "edit";
  cleanStage();
  setup.hidden = true;
  stage.hidden = false;
  stage.classList.add("editing");
  $("editorUI").hidden = false;
  applyAppearance();
  syncEditor();
}
function openZones() {
  mode = "zones";
  cleanStage();
  setup.hidden = true;
  stage.hidden = false;
  lockView.hidden = true;
  $("coverLayer").hidden = false;
  $("zoneEditor").hidden = false;
  syncZones();
}
function showSetup() {
  mode = "setup";
  round.reset();
  clearTimeout(calcHoldTimer);
  calcPointer = null;
  total = 0; tapCount = 0; drag = null;
  cleanStage();
  stage.hidden = true;
  setup.hidden = false;
  $("pasteNumber").value = "";
  $("pasteFallback").hidden = true;
  showError("");
  syncSettings();
  releaseWakeLock();
}
async function requestWakeLock() {
  wantWakeLock = true;
  if (!navigator.wakeLock || document.visibilityState !== "visible" || wakeLock) return;
  try {
    const lock = await navigator.wakeLock.request("screen");
    if (!wantWakeLock) { await lock.release(); return; }
    wakeLock = lock;
    lock.addEventListener("release", () => { if (wakeLock === lock) wakeLock = null; });
  } catch { /* Wake lock is optional. */ }
}
function releaseWakeLock() {
  wantWakeLock = false;
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}
function prepareRound(source, choice = null) {
  showError("");
  $("toast").hidden = true;
  cleanStage();
  total = 0; tapCount = 0;
  $("tapTotal").textContent = "0";
  roundSource = source;
  roundCovered = settings.useCover;
  mode = "performance";
  round.arm(settings, choice);
  requestWakeLock();
}
function renderRound() {
  if (!round) return;
  if (mode !== "performance") { lastPhase = round.phase; return; }
  const revealed = ["holding","rewinding","landed"].includes(round.phase);
  const visibleMap = !roundCovered && roundSource === "taps" && !revealed;
  const onStage = revealed || roundCovered || visibleMap;
  stage.hidden = !onStage;
  setup.hidden = onStage;
  lockView.hidden = !revealed;
  $("coverLayer").hidden = revealed || !roundCovered;
  $("zoneEditor").hidden = !visibleMap;
  $("visibleInput").hidden = !visibleMap;
  stage.classList.toggle("entering", visibleMap);
  if (visibleMap) syncZones();
  if (revealed) {
    $("calculator").hidden = true;
    applyAppearance();
    if (round.phase === "holding" && lastPhase !== "holding") {
      stage.classList.remove("waking");
      void stage.offsetWidth;
      stage.classList.add("waking");
    }
  }
  lastPhase = round.phase;
  syncInput();
}
function startPerformance() {
  if (!ready) return;
  if (settings.inputMethod === "calculator") {
    prepareRound("calculator");
    mode = "calculator";
    cleanStage();
    setup.hidden = true;
    stage.hidden = false;
    lockView.hidden = true;
    $("calculator").hidden = false;
    calculator.clear();
    renderCalculator();
  } else if (settings.inputMethod === "number") {
    const number = parseMinutes($("chosenNumber").value);
    if (number === null) { tab("input"); showError("Enter a whole number from 1 to 180."); return; }
    prepareRound("number", number);
    if (!roundCovered) round.reveal();
  } else if (settings.inputMethod === "clipboard") {
    prepareRound("clipboard");
    if (!roundCovered) readClipboard();
  } else if (settings.inputMethod === "taps") prepareRound("taps");
}
async function readClipboard() {
  if (round.phase !== "armed" || roundSource !== "clipboard") return;
  try {
    await round.readClipboard(() => {
      if (!navigator.clipboard?.readText) throw new Error("Clipboard access is unavailable here.");
      return navigator.clipboard.readText();
    });
  } catch (error) {
    showSetup();
    tab("input");
    $("pasteFallback").hidden = false;
    showError(error.message.includes("whole number") ? error.message : "Clipboard access was not allowed. Try again, or paste the number below. Pasting a valid number starts the reveal.");
  }
}
function handlePerformanceTap(x, y) {
  if (round.phase !== "armed") return;
  if (round.choice !== null) { round.reveal(); return; }
  if (roundSource === "clipboard") { readClipboard(); return; }
  if (roundSource !== "taps") return;
  const bounds = stage.getBoundingClientRect();
  const zone = getInputZone(x-bounds.left,y-bounds.top,bounds.width,bounds.height,settings.zones);
  if (zone.kind === "confirm") {
    if (isValidChoice(total)) round.reveal(total);
    return;
  }
  total += zone.value;
  tapCount++;
  if (total > 180) { total = 0; tapCount = 0; }
  $("tapTotal").textContent = total;
  if (settings.autoConfirm > 0 && tapCount >= settings.autoConfirm && isValidChoice(total)) round.reveal(total);
}
function renderCalculator() {
  $("calculatorDisplay").textContent = calculator.display;
  $("calculatorDisplay").classList.toggle("small", calculator.display.length > 7);
}
function useCalculatorNumber() {
  if (mode !== "calculator") return;
  calcHoldTriggered = true;
  if (!isValidChoice(calculator.lastEntered)) {
    showSetup(); tab("input"); showError("The last calculator number must be a whole number from 1 to 180."); return;
  }
  const value = calculator.lastEntered;
  prepareRound("calculator", value);
  if (!roundCovered) round.reveal();
}
function consumeShortcut() {
  const url = new URL(location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  if (!url.searchParams.has("minutes") && !hash.has("minutes")) return undefined;
  const values = [...url.searchParams.getAll("minutes"), ...hash.getAll("minutes")];
  const choice = values.length === 1 ? parseMinutes(values[0]) : null;
  url.searchParams.delete("minutes");
  hash.delete("minutes");
  url.hash = hash.toString();
  history.replaceState(null, "", url);
  return choice;
}
function acceptShortcut(choice) {
  if (choice === undefined) return;
  if (["holding","rewinding","landed"].includes(round.phase)) return;
  if (choice === null) { showSetup(); tab("input"); showError("Shortcut minutes must be a whole number from 1 to 180."); return; }
  prepareRound("shortcut", choice);
  if (!roundCovered) round.reveal();
}

// Pointer tracking shares a cancellation path across dragging, secret taps, and the exit gesture.
stage.addEventListener("pointerdown", event => {
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY });
  if (pointers.size >= 2) {
    multiTouch = true;
    const points = [...pointers.values()].slice(0,2);
    swipe = { x: (points[0].x+points[1].x)/2, y: (points[0].y+points[1].y)/2 };
    drag = null;
    clearTimeout(calcHoldTimer);
    calcPointer = null;
    return;
  }
  if (mode === "performance" && !event.target.closest("button")) event.preventDefault();
  if (event.target.closest("#editorUI, #zoneEditor input, #zoneEditor header")) return;
  const partElement = event.target.closest("[data-part]");
  const divider = event.target.closest("[data-divider]");
  if (mode === "edit" && (partElement || selectedPart === "wallpaper")) {
    if (partElement && selectedPart !== "wallpaper") selectPart(partElement.dataset.part);
    const bounds = stage.getBoundingClientRect();
    const part = selectedPart;
    const p = part === "wallpaper" ? { x: settings.wallpaperX, y: settings.wallpaperY } : settings[part];
    drag = { id: event.pointerId, part, startX: event.clientX, startY: event.clientY, x: p.x, y: p.y, bounds };
    event.target.setPointerCapture?.(event.pointerId);
  } else if (mode === "zones" && divider) {
    drag = { id: event.pointerId, divider: divider.dataset.divider, bounds: stage.getBoundingClientRect() };
    divider.setPointerCapture(event.pointerId);
  } else if (mode === "preview") {
    // A tap returns to the editor without adding a visible preview-only control.
    event.preventDefault();
  }
});
stage.addEventListener("pointermove", event => {
  const pointer = pointers.get(event.pointerId);
  if (pointer) Object.assign(pointer, { x: event.clientX, y: event.clientY });
  if (multiTouch && pointers.size >= 2 && swipe) {
    const points = [...pointers.values()].slice(0,2);
    const dx = (points[0].x+points[1].x)/2-swipe.x;
    const dy = (points[0].y+points[1].y)/2-swipe.y;
    if (dy > 90 && Math.abs(dx) < 100) { swipe = null; showSetup(); }
    return;
  }
  if (!drag || drag.id !== event.pointerId || multiTouch) return;
  event.preventDefault();
  const b = drag.bounds;
  if (drag.divider) {
    if (drag.divider === "x") settings.zones.x = clamp((event.clientX-b.left)/b.width*100,20,80);
    if (drag.divider === "y") settings.zones.y = clamp((event.clientY-b.top)/b.height*100,18,settings.zones.confirm-15);
    if (drag.divider === "confirm") settings.zones.confirm = clamp((event.clientY-b.top)/b.height*100,settings.zones.y+15,85);
    syncZones();
  } else {
    const dx = (event.clientX-drag.startX)/b.width*100;
    const dy = (event.clientY-drag.startY)/b.height*100;
    if (drag.part === "wallpaper") {
      settings.wallpaperX = clamp(drag.x-dx,0,100);
      settings.wallpaperY = clamp(drag.y-dy,0,100);
    } else {
      const el = $(drag.part+"Text");
      const box = el.getBoundingClientRect();
      settings[drag.part].x = clamp(drag.x+dx,box.width/b.width*50,100-box.width/b.width*50);
      settings[drag.part].y = clamp(drag.y+dy,box.height/b.height*50,100-box.height/b.height*50);
    }
    applyAppearance();
  }
});
function finishPointer(event, cancelled = false) {
  const p = pointers.get(event.pointerId);
  const wasDrag = drag?.id === event.pointerId;
  if (wasDrag) { drag = null; saveSettings(); }
  if (!cancelled && p && !multiTouch && !wasDrag && Math.hypot(event.clientX-p.startX,event.clientY-p.startY) < 16) {
    if (mode === "preview") openEditor();
    else if (mode === "performance" && !event.target.closest("button")) handlePerformanceTap(event.clientX,event.clientY);
  }
  pointers.delete(event.pointerId);
  if (!pointers.size) { multiTouch = false; swipe = null; }
}
stage.addEventListener("pointerup", event => finishPointer(event));
stage.addEventListener("pointercancel", event => finishPointer(event,true));
stage.addEventListener("contextmenu", event => { if (mode !== "zones") event.preventDefault(); });
stage.addEventListener("animationend", () => stage.classList.remove("waking"));

document.querySelectorAll("[data-tab]").forEach(el => el.addEventListener("click", () => tab(el.dataset.tab)));
document.querySelectorAll("[data-part-tab]").forEach(el => el.addEventListener("click", () => selectPart(el.dataset.partTab)));
document.querySelectorAll("[data-setting]").forEach(el => el.addEventListener("input", () => {
  const key = el.dataset.setting;
  if (el.type === "number" && (!el.value || !el.validity.valid)) return;
  settings[key] = el.type === "checkbox" ? el.checked : ["number","range"].includes(el.type) || ["rewindSpeed","autoConfirm"].includes(key) ? Number(el.value) : el.value;
  if (!settings.calculatorEnabled && settings.inputMethod === "calculator") settings.inputMethod = "taps";
  showError("");
  syncInput(); syncEditor(); applyAppearance(); saveSettings();
}));
document.querySelectorAll("[data-setting][type=number]").forEach(el => el.addEventListener("change", () => { if (!el.value || !el.validity.valid) el.value = settings[el.dataset.setting]; }));
for (const [id,key] of [["textSize","size"],["textWeight","weight"],["textOpacity","opacity"],["textStyle","style"],["textColor","color"]]) {
  $(id).addEventListener("input", () => {
    if (selectedPart === "wallpaper") return;
    settings[selectedPart][key] = $(id).type === "range" ? Number($(id).value) : $(id).value;
    syncEditor(); applyAppearance(); saveSettings();
  });
}
document.querySelectorAll("[data-zone-value]").forEach(el => el.addEventListener("change", () => {
  const value = parseMinutes(el.value);
  if (value !== null) settings.zones.values[Number(el.dataset.zoneValue)] = value;
  syncZones(); saveSettings();
}));
for (const kind of ["wallpaper","reference","cover"]) {
  $(kind+"Input").addEventListener("change", () => {
    upload(kind, $(kind+"Input").files[0]);
    $(kind+"Input").value = "";
  });
}
$("removeCover").addEventListener("click", () => removeAsset("cover"));
$("removeReference").addEventListener("click", () => removeAsset("reference"));
$("referenceOpacity").addEventListener("input", () => {
  referenceOpacity = Number($("referenceOpacity").value);
  $("referenceValue").textContent = referenceOpacity + "%";
  syncEditor();
});
$("editClock").addEventListener("click", openEditor);
$("editZones").addEventListener("click", openZones);
$("editorDone").addEventListener("click", showSetup);
$("zonesDone").addEventListener("click", () => { showSetup(); tab("input"); });
$("entryBack").addEventListener("click", showSetup);
$("editorPreview").addEventListener("click", () => {
  mode = "preview";
  cleanStage();
  renderTime(new Date());
});
$("movePanel").addEventListener("click", () => {
  const top = $("editorPanel").classList.toggle("at-top");
  $("movePanel").setAttribute("aria-label", top ? "Move controls to bottom" : "Move controls to top");
  $("movePanel").title = $("movePanel").getAttribute("aria-label");
});
$("performButton").addEventListener("click", startPerformance);
$("shortcutURL").addEventListener("click", () => $("shortcutURL").select());
$("pasteNumber").addEventListener("paste", event => {
  if (settings.inputMethod !== "clipboard") return;
  event.preventDefault();
  const number = parseMinutes(event.clipboardData.getData("text/plain"));
  if (number === null) { showError("Paste only a whole number from 1 to 180."); return; }
  $("pasteNumber").blur();
  prepareRound("clipboard", number);
  if (!roundCovered) round.reveal();
});
document.querySelectorAll("[data-calc]").forEach(el => el.addEventListener("click", () => {
  if (mode !== "calculator" || (el.dataset.calc === "=" && calcHoldTriggered)) { calcHoldTriggered = false; return; }
  calculator.press(el.dataset.calc); renderCalculator();
}));
$("calculatorEquals").addEventListener("pointerdown", event => {
  calcHoldTriggered = false;
  if (event.isPrimary === false) return;
  calcPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  calcHoldTimer = setTimeout(useCalculatorNumber,700);
});
$("calculatorEquals").addEventListener("pointermove", event => {
  if (calcPointer && Math.hypot(event.clientX-calcPointer.x,event.clientY-calcPointer.y) > 14) clearTimeout(calcHoldTimer);
});
for (const type of ["pointerup","pointercancel","pointerleave"]) $("calculatorEquals").addEventListener(type, () => { clearTimeout(calcHoldTimer); calcPointer = null; });
window.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    if (mode === "preview") openEditor();
    else showSetup();
  }
});
window.addEventListener("resize", () => { if (!stage.hidden) applyAppearance(); });
window.addEventListener("hashchange", () => { if (ready) acceptShortcut(consumeShortcut()); });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    pointers.clear(); multiTouch = false; swipe = null; drag = null;
    clearTimeout(calcHoldTimer);
    if (round.phase === "reading") round.arm(settings);
  } else {
    if (wantWakeLock && !wakeLock) requestWakeLock();
    if (["edit","preview"].includes(mode)) renderTime(new Date());
  }
});
window.addEventListener("pagehide", () => {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Already reported on save. */ }
});
async function initialize() {
  const incoming = consumeShortcut();
  syncSettings();
  applyAppearance();
  const media = await Promise.allSettled(["wallpaper","reference","cover"].map(async kind => {
    const blob = await readMedia(kind);
    if (blob) setAsset(kind,blob);
  }));
  if (media.some(r => r.status === "rejected")) showToast("Images cannot be restored in this browser session.");
  ready = true;
  syncInput();
  $("installNote").hidden = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  acceptShortcut(incoming);
  setInterval(() => { if (["edit","preview"].includes(mode)) renderTime(new Date()); },1000);
  if ("serviceWorker" in navigator) {
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (mode === "setup" && !refreshing) { refreshing = true; location.reload(); }
    });
    navigator.serviceWorker.register("./sw.js", { scope: "./", updateViaCache: "none" }).then(registration => registration.update()).catch(() => {});
  }
}
initialize();
