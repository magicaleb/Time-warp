const $ = (id) => document.getElementById(id);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const MINUTE = 60_000;
const SETTINGS_KEY = "timewarp.v24.settings";
const DB_NAME = "timewarp-media-v2";
const DB_STORE = "images";

function freshCalculator() { return { display:"0", stored:null, operator:null, waiting:false, lastEntry:null, justCalculated:false }; }

const DEFAULTS = {
  use24: false,
  showDate: true,
  dateFormat: "long",
  inputMethod: "taps",
  confirmMode: "zone",
  useCover: true,
  calculatorEnabled: false,
  holdDuration: 3,
  rewindSpeed: 500,
  overlayPosition: "bottom",
  wallpaperZoom: 100,
  wallpaperX: 50,
  wallpaperY: 50,
  referenceOpacity: 50,
  zones: { x: 50, y: 47, confirm: 84, values: [1, 2, 5, 10] },
  clock: { x: 50, y: 18, style: "system", size: 22, weight: 300, color: "#ffffff", opacity: 100 },
  date: { x: 50, y: 11.7, style: "system", size: 4.7, weight: 600, color: "#ffffff", opacity: 100 },
};

function normalizeSettings(raw = {}) {
  const s = structuredClone(DEFAULTS);
  const bools = ["use24", "showDate", "useCover", "calculatorEnabled"];
  bools.forEach(k => { if (typeof raw[k] === "boolean") s[k] = raw[k]; });
  if (["long","compact","dayFirst","numeric"].includes(raw.dateFormat)) s.dateFormat = raw.dateFormat;
  if (["taps","clipboard","shortcut","direct","calculator"].includes(raw.inputMethod)) s.inputMethod = raw.inputMethod;
  if (["zone","three"].includes(raw.confirmMode)) s.confirmMode = raw.confirmMode;
  if (["top","bottom"].includes(raw.overlayPosition)) s.overlayPosition = raw.overlayPosition;
  s.holdDuration = clamp(Number(raw.holdDuration ?? s.holdDuration), 0, 15);
  s.rewindSpeed = clamp(Number(raw.rewindSpeed ?? s.rewindSpeed), 120, 1500);
  s.wallpaperZoom = clamp(Number(raw.wallpaperZoom ?? s.wallpaperZoom), 100, 240);
  s.wallpaperX = clamp(Number(raw.wallpaperX ?? s.wallpaperX), 0, 100);
  s.wallpaperY = clamp(Number(raw.wallpaperY ?? s.wallpaperY), 0, 100);
  s.referenceOpacity = clamp(Number(raw.referenceOpacity ?? s.referenceOpacity), 0, 100);
  if (raw.zones && typeof raw.zones === "object") {
    s.zones.x = clamp(Number(raw.zones.x ?? s.zones.x), 20, 80);
    s.zones.y = clamp(Number(raw.zones.y ?? s.zones.y), 20, 72);
    s.zones.confirm = clamp(Number(raw.zones.confirm ?? s.zones.confirm), 62, 94);
    if (s.zones.confirm < s.zones.y + 12) s.zones.confirm = s.zones.y + 12;
    if (Array.isArray(raw.zones.values)) s.zones.values = raw.zones.values.slice(0,4).map((v,i) => clamp(Math.round(Number(v) || DEFAULTS.zones.values[i]),1,180));
  }
  for (const part of ["clock","date"]) {
    if (!raw[part] || typeof raw[part] !== "object") continue;
    const r = raw[part];
    s[part].x = clamp(Number(r.x ?? s[part].x), 0, 100);
    s[part].y = clamp(Number(r.y ?? s[part].y), 0, 100);
    s[part].size = clamp(Number(r.size ?? s[part].size), part === "clock" ? 8 : 2, part === "clock" ? 34 : 12);
    s[part].weight = clamp(Math.round(Number(r.weight ?? s[part].weight) / 10) * 10, 100, 900);
    s[part].opacity = clamp(Number(r.opacity ?? s[part].opacity), 0, 100);
    if (["system","rounded","serif","mono","condensed"].includes(r.style)) s[part].style = r.style;
    if (/^#[0-9a-f]{6}$/i.test(r.color || "")) s[part].color = r.color;
  }
  if (!s.calculatorEnabled && s.inputMethod === "calculator") s.inputMethod = "taps";
  return s;
}

let settings;
try { settings = normalizeSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")); }
catch { settings = normalizeSettings(); }

let mode = "setup"; // setup | edit | preview | zones | performance | calculator
let editPart = "clock";
let assets = { wallpaper: null, reference: null, cover: null };
let objectUrls = { wallpaper: null, reference: null, cover: null };
let dragState = null;
let zoneDrag = null;
let toastTimer = null;
let shortcutChoice = null;
let total = 0;
let tapCount = 0;
let performance = { source: null, choice: null, phase: "idle", displayMs: null, timer: null };
let activePointers = new Map();
let swipeStart = null;
let suppressTap = false;
let calculator = freshCalculator();
let equalsHoldTimer = null;
let equalsHeld = false;

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
  catch { toast("Settings could not be saved on this device."); }
}

function toast(message) {
  clearTimeout(toastTimer);
  $("toast").textContent = message;
  $("toast").hidden = false;
  toastTimer = setTimeout(() => { $("toast").hidden = true; }, 2600);
}

function setError(message = "") {
  $("setupError").textContent = message;
  $("setupError").hidden = !message;
}

function floorMinute(date = new Date()) { return Math.floor(date.getTime() / MINUTE) * MINUTE; }
function parseChoice(value) {
  const text = String(value ?? "").trim();
  if (!/^\d{1,3}$/.test(text)) return null;
  const n = Number(text);
  return Number.isInteger(n) && n >= 1 && n <= 180 ? n : null;
}

function formatTime(ms = Date.now()) {
  const d = new Date(ms);
  const minutes = String(d.getMinutes()).padStart(2,"0");
  if (settings.use24) return `${String(d.getHours()).padStart(2,"0")}:${minutes}`;
  const hours = d.getHours() % 12 || 12;
  return `${hours}:${minutes}`;
}

function formatDate(ms = Date.now()) {
  const d = new Date(ms);
  const weekdays = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const shortWeekdays = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const shortMonths = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  if (settings.dateFormat === "compact") return `${shortWeekdays[d.getDay()]}, ${shortMonths[d.getMonth()]} ${d.getDate()}`;
  if (settings.dateFormat === "dayFirst") return `${weekdays[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
  if (settings.dateFormat === "numeric") return `${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}/${d.getFullYear()}`;
  return `${weekdays[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

function renderClock(ms = Date.now()) {
  $("clockText").textContent = formatTime(ms);
  $("dateText").textContent = formatDate(ms);
  $("dateText").hidden = !settings.showDate;
}

function applyAppearance() {
  const root = document.documentElement.style;
  root.setProperty("--wallpaper-zoom", String(settings.wallpaperZoom / 100));
  root.setProperty("--wallpaper-x", `${settings.wallpaperX}%`);
  root.setProperty("--wallpaper-y", `${settings.wallpaperY}%`);
  for (const part of ["clock","date"]) {
    const s = settings[part];
    const el = $(part + "Text");
    root.setProperty(`--${part}-x`, `${s.x}%`);
    root.setProperty(`--${part}-y`, `${s.y}%`);
    const stageWidth = $("stage").getBoundingClientRect().width || innerWidth;
    el.style.fontSize = `${stageWidth * s.size / 100}px`;
    el.style.fontWeight = s.weight;
    el.style.color = s.color;
    el.style.opacity = String(s.opacity / 100);
    el.dataset.style = s.style;
  }
  $("dateText").hidden = !settings.showDate;
  $("reference").style.opacity = String(settings.referenceOpacity / 100);
  $("reference").hidden = !assets.reference || mode !== "edit";
  $("wallpaper").classList.toggle("wallpaper-selected", mode === "edit" && editPart === "wallpaper");
  renderClock(["holding","rewinding","landed"].includes(performance.phase) && performance.displayMs ? performance.displayMs : Date.now());
}

function syncSetup() {
  document.querySelectorAll("[data-setting]").forEach(el => {
    const v = settings[el.dataset.setting];
    if (el.type === "checkbox") el.checked = Boolean(v);
    else el.value = String(v);
  });
  $("dateFormat").disabled = !settings.showDate;
  $("calculatorEnabled").checked = settings.calculatorEnabled;
  $("inputMethod").querySelector('option[value="calculator"]').disabled = !settings.calculatorEnabled;
  if (!settings.calculatorEnabled && settings.inputMethod === "calculator") settings.inputMethod = "taps";
  $("inputMethod").value = settings.inputMethod;
  const taps = settings.inputMethod === "taps";
  $("editZones").hidden = !taps;
  $("confirmModeRow").hidden = !taps;
  $("directBlock").hidden = settings.inputMethod !== "direct";
  $("clipboardBlock").hidden = settings.inputMethod !== "clipboard";
  $("shortcutBlock").hidden = settings.inputMethod !== "shortcut";
  $("coverMediaRow").hidden = !settings.useCover;
  $("holdValue").textContent = `${settings.holdDuration.toFixed(settings.holdDuration % 1 ? 2 : 0)}s`;
  $("speedValue").textContent = `${settings.rewindSpeed}ms / minute`;
  const hints = {
    taps: settings.useCover ? "Tap invisible zones on the cover, then confirm. With three-tap confirmation, the third increment reveals automatically." : "Tap the wallpaper invisibly; the fake clock stays hidden until confirmation.",
    clipboard: settings.useCover ? "Start, copy the chosen number, then tap the cover. The app validates clipboard content before reveal." : "Start reads the clipboard immediately. If iOS blocks it, a manual paste field appears without revealing the lock screen.",
    shortcut: shortcutChoice ? `Shortcut value loaded: ${shortcutChoice} minutes.` : "Open the generated URL from Shortcuts with a whole number from 1–180.",
    direct: "Enter the number directly for rehearsal or a controlled performance.",
    calculator: settings.calculatorEnabled ? "Use Calculator normally. Hold = for 0.7 seconds to secretly capture the last number entered." : "Enable Calculator disguise in Timing first.",
  };
  $("inputHint").textContent = hints[settings.inputMethod];
  $("perform").textContent = settings.inputMethod === "clipboard" && !settings.useCover ? "Paste & perform" : settings.inputMethod === "calculator" ? "Open calculator" : "Start performance";
  $("perform").disabled = settings.inputMethod === "calculator" && !settings.calculatorEnabled;
  const base = new URL(location.href);
  base.search = "";
  base.hash = "minutes=NUMBER";
  $("shortcutUrl").value = base.href;
  $("coverLabel").textContent = assets.cover ? "Replace" : "Choose";
  $("removeCover").hidden = !assets.cover;
}

function selectMainTab(name) {
  document.querySelectorAll("[data-tab]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.tab === name)));
  document.querySelectorAll("[data-panel]").forEach(p => { p.hidden = p.dataset.panel !== name; });
}

function showSetup() {
  clearPerformanceTimer();
  mode = "setup";
  performance = { source:null, choice:null, phase:"idle", displayMs:null, timer:null };
  total = 0; tapCount = 0;
  activePointers.clear(); swipeStart = null; suppressTap = false;
  $("stage").hidden = true;
  $("setup").hidden = false;
  $("editor").hidden = true;
  $("zoneEditor").hidden = true;
  $("calculator").hidden = true;
  $("manualPaste").hidden = true;
  $("cover").hidden = true;
  $("stage").className = "stage";
  setError("");
  syncSetup();
}
