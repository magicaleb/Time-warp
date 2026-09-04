import {
  dateFromMinute,
  fakeMinuteFromNow,
  formatClock,
  formatLockDate,
  getInputZone,
  isValidChoice,
  minuteStamp,
  nextRewindMinute,
} from "./core.js";

const SETTINGS_KEY = "time-warp.settings.v3";
const DB_NAME = "time-warp-media";
const DB_VERSION = 1;
const STORE_NAME = "assets";

const DEFAULT_SETTINGS = Object.freeze({
  clockStyle: "system",
  clockColor: "#ffffff",
  clockSize: 24,
  clockWeight: 520,
  clockPosition: 17,
  clockOpacity: 100,
  wallpaperZoom: 100,
  wallpaperX: 50,
  wallpaperY: 50,
  showDate: true,
  showLock: true,
  showControls: true,
  use24Hour: false,
  rewindDelay: 6,
  rewindSpeed: 500,
});

const setupScreen = document.getElementById("setupScreen");
const armedScreen = document.getElementById("armedScreen");
const lockScreen = document.getElementById("lockScreen");
const previewLockView = document.getElementById("previewLockView");
const performanceLockView = document.getElementById("performanceLockView");
const lockViews = [previewLockView, performanceLockView];
const wallpaperLayers = [...document.querySelectorAll(".wallpaper-layer")];
const referenceLayer = document.getElementById("referenceLayer");
const referenceOpacityRow = document.getElementById("referenceOpacityRow");
const toggleReferenceButton = document.getElementById("toggleReferenceButton");
const wallpaperInput = document.getElementById("wallpaperInput");
const referenceInput = document.getElementById("referenceInput");
const wallpaperLabel = document.getElementById("wallpaperLabel");
const referenceLabel = document.getElementById("referenceLabel");
const readyPill = document.getElementById("readyPill");
const armStatus = document.getElementById("armStatus");
const armButton = document.getElementById("armButton");
const rehearseButton = document.getElementById("rehearseButton");
const assistDot = document.getElementById("assistDot");
const toast = document.getElementById("toast");
const confirmSheet = document.getElementById("confirmSheet");
const installNote = document.getElementById("installNote");

const controls = {
  clockStyle: document.getElementById("clockStyle"),
  clockColor: document.getElementById("clockColor"),
  clockSize: document.getElementById("clockSize"),
  clockWeight: document.getElementById("clockWeight"),
  clockPosition: document.getElementById("clockPosition"),
  clockOpacity: document.getElementById("clockOpacity"),
  wallpaperZoom: document.getElementById("wallpaperZoom"),
  wallpaperX: document.getElementById("wallpaperX"),
  wallpaperY: document.getElementById("wallpaperY"),
  showDate: document.getElementById("showDate"),
  showLock: document.getElementById("showLock"),
  showControls: document.getElementById("showControls"),
  use24Hour: document.getElementById("use24Hour"),
  rewindDelay: document.getElementById("rewindDelay"),
  rewindSpeed: document.getElementById("rewindSpeed"),
};

const outputs = {
  clockSize: document.getElementById("clockSizeValue"),
  clockWeight: document.getElementById("clockWeightValue"),
  clockPosition: document.getElementById("clockPositionValue"),
  clockOpacity: document.getElementById("clockOpacityValue"),
  wallpaperZoom: document.getElementById("wallpaperZoomValue"),
  rewindDelay: document.getElementById("rewindDelayValue"),
  rewindSpeed: document.getElementById("rewindSpeedValue"),
};

let settings = loadSettings();
let wallpaperBlob = null;
let wallpaperURL = null;
let referenceBlob = null;
let referenceURL = null;
let referenceVisible = false;
let toastTimer = null;
let previewTimer = null;
let wakeLock = null;
let wakeLockWanted = false;
let performanceMode = "setup";
let practiceMode = false;
let inputTotal = 0;
let inputTapCount = 0;
let activePointer = null;
let cancelHoldTimer = null;
let rewindStartTimer = null;
let rewindTimer = null;
let liveSyncTimer = null;
let cursorMinute = null;
let resetCornerTaps = [];

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function openMediaDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is unavailable"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readMedia(key) {
  const database = await openMediaDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

async function writeMedia(key, value) {
  const database = await openMediaDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(value, key);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

async function clearMedia() {
  const database = await openMediaDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).clear();
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

function replaceObjectURL(oldURL, blob) {
  if (oldURL) URL.revokeObjectURL(oldURL);
  return blob ? URL.createObjectURL(blob) : null;
}

function setWallpaper(blob) {
  wallpaperBlob = blob;
  wallpaperURL = replaceObjectURL(wallpaperURL, blob);
  for (const layer of wallpaperLayers) {
    layer.style.backgroundImage = wallpaperURL ? `url("${wallpaperURL}")` : "";
  }
  wallpaperLabel.textContent = blob ? "Wallpaper saved" : "Choose wallpaper";
  readyPill.classList.toggle("is-ready", Boolean(blob));
  readyPill.lastChild.textContent = blob ? " Ready" : " Demo ready";
  armStatus.textContent = blob ? "Personal wallpaper ready" : "Demo wallpaper active";
}

function setReference(blob) {
  referenceBlob = blob;
  referenceURL = replaceObjectURL(referenceURL, blob);
  if (referenceURL) referenceLayer.src = referenceURL;
  else referenceLayer.removeAttribute("src");
  referenceLabel.textContent = blob ? "Reference saved" : "Add reference";
  toggleReferenceButton.disabled = !blob;
  if (!blob) setReferenceVisible(false);
}

function setReferenceVisible(visible) {
  referenceVisible = Boolean(visible && referenceBlob);
  referenceLayer.classList.toggle("is-visible", referenceVisible);
  referenceOpacityRow.classList.toggle("is-hidden", !referenceVisible);
  toggleReferenceButton.textContent = referenceVisible ? "Hide reference" : "Show reference";
}

function valueFromControl(key, element) {
  if (element.type === "checkbox") return element.checked;
  if (element.type === "range") return Number(element.value);
  return element.value;
}

function syncControlsFromSettings() {
  for (const [key, element] of Object.entries(controls)) {
    if (element.type === "checkbox") element.checked = Boolean(settings[key]);
    else element.value = String(settings[key]);
  }
}

function applyAppearance() {
  const root = document.documentElement.style;
  root.setProperty("--clock-size", String(settings.clockSize));
  root.setProperty("--clock-color", settings.clockColor);
  root.setProperty("--clock-weight", String(settings.clockWeight));
  root.setProperty("--clock-y", `${settings.clockPosition}%`);
  root.setProperty("--clock-opacity", String(settings.clockOpacity / 100));
  root.setProperty("--wallpaper-zoom", String(settings.wallpaperZoom / 100));
  root.setProperty("--wallpaper-x", `${settings.wallpaperX}%`);
  root.setProperty("--wallpaper-y", `${settings.wallpaperY}%`);

  for (const view of lockViews) {
    view.classList.toggle("clock-rounded", settings.clockStyle === "rounded");
    view.classList.toggle("clock-glass", settings.clockStyle === "glass");
    view.classList.toggle("hide-date", !settings.showDate);
    view.classList.toggle("hide-lock", !settings.showLock);
    view.classList.toggle("hide-controls", !settings.showControls);
  }

  outputs.clockSize.textContent = Number(settings.clockSize).toFixed(1).replace(".0", "");
  outputs.clockWeight.textContent = String(settings.clockWeight);
  outputs.clockPosition.textContent = `${settings.clockPosition}%`;
  outputs.clockOpacity.textContent = `${settings.clockOpacity}%`;
  outputs.wallpaperZoom.textContent = `${settings.wallpaperZoom}%`;
  outputs.rewindDelay.textContent = `${Number(settings.rewindDelay).toFixed(1)}s`;
  outputs.rewindSpeed.textContent = `${settings.rewindSpeed}ms`;

  const approximateDuration = settings.rewindDelay + (10 * settings.rewindSpeed) / 1000;
  document.getElementById("timingSummary").textContent =
    `A 10-minute choice takes about ${approximateDuration.toFixed(1)} seconds from wake to landing.`;
}

function renderDateAndTime(view, date) {
  view.querySelector(".lock-time").textContent = formatClock(date, settings.use24Hour);
  view.querySelector(".lock-date").textContent = formatLockDate(date);
}

function refreshPreviewClock() {
  renderDateAndTime(previewLockView, new Date());
}

function showToast(message, duration = 2200) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), duration);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function vibrate(pattern = 12) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Vibration is optional and unsupported in iOS Safari.
  }
}

async function requestWakeLock() {
  wakeLockWanted = true;
  if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => {
      wakeLock = null;
    });
  } catch {
    wakeLock = null;
  }
}

async function releaseWakeLock() {
  wakeLockWanted = false;
  try {
    await wakeLock?.release();
  } catch {
    // A released lock needs no further handling.
  }
  wakeLock = null;
}

async function askForImmersiveMode() {
  try {
    if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    }
  } catch {
    // Installed iPhone web apps already use their standalone presentation.
  }
  try {
    await screen.orientation?.lock?.("portrait");
  } catch {
    // Orientation is already declared in the manifest.
  }
}

function clearPerformanceTimers() {
  clearTimeout(rewindStartTimer);
  clearTimeout(rewindTimer);
  clearInterval(liveSyncTimer);
  rewindStartTimer = null;
  rewindTimer = null;
  liveSyncTimer = null;
}

function resetSecretInput() {
  inputTotal = 0;
  inputTapCount = 0;
  activePointer = null;
  clearTimeout(cancelHoldTimer);
  cancelHoldTimer = null;
}

function showSetup() {
  clearPerformanceTimers();
  resetSecretInput();
  performanceMode = "setup";
  practiceMode = false;
  cursorMinute = null;
  resetCornerTaps = [];
  armedScreen.classList.remove("is-active");
  lockScreen.classList.remove("is-active", "is-waking");
  setupScreen.classList.remove("is-hidden");
  document.body.classList.remove("performance-active");
  releaseWakeLock();
  try {
    if (document.fullscreenElement) document.exitFullscreen();
  } catch {
    // Exiting full screen is best effort.
  }
}

function arm({ practice = false } = {}) {
  clearPerformanceTimers();
  resetSecretInput();
  performanceMode = "armed";
  practiceMode = practice;
  setupScreen.classList.add("is-hidden");
  lockScreen.classList.remove("is-active", "is-waking");
  armedScreen.classList.add("is-active");
  document.body.classList.add("performance-active");
  requestWakeLock();
  askForImmersiveMode();
}

function signalInvalidInput() {
  inputTotal = 0;
  inputTapCount = 0;
  vibrate([18, 45, 18]);
  assistDot.classList.remove("is-error");
  void assistDot.offsetWidth;
  assistDot.classList.add("is-error");
}

function confirmSecretInput() {
  const choice = inputTotal === 0 ? 5 : inputTotal;
  if (!isValidChoice(choice)) {
    signalInvalidInput();
    return;
  }

  vibrate(18);
  if (practiceMode) {
    showSetup();
    showToast(`Input read as ${choice}.`, 2600);
    return;
  }
  beginReveal(choice);
}

function handleSecretTap(x, y) {
  if (performanceMode !== "armed") return;
  const zone = getInputZone(x, y, window.innerWidth, window.innerHeight);

  if (zone.kind === "confirm") {
    confirmSecretInput();
    return;
  }

  inputTotal += zone.value;
  inputTapCount += 1;
  vibrate(8);

  if (inputTotal > 15) {
    signalInvalidInput();
    return;
  }

  if (inputTapCount >= 3) {
    if (isValidChoice(inputTotal)) confirmSecretInput();
    else signalInvalidInput();
  }
}

function renderPerformanceMinute(stamp) {
  renderDateAndTime(performanceLockView, dateFromMinute(stamp));
}

function beginLiveSync() {
  clearInterval(liveSyncTimer);
  liveSyncTimer = setInterval(() => {
    if (performanceMode !== "landed") return;
    renderPerformanceMinute(minuteStamp());
  }, 1000);
}

function finishRewind(liveMinute = minuteStamp()) {
  cursorMinute = liveMinute;
  renderPerformanceMinute(liveMinute);
  performanceMode = "landed";
  beginLiveSync();
}

function rewindTick() {
  if (performanceMode !== "rewinding" || cursorMinute === null) return;
  const liveMinute = minuteStamp();
  const nextMinute = nextRewindMinute(cursorMinute, liveMinute);

  if (nextMinute >= cursorMinute || nextMinute <= liveMinute) {
    finishRewind(liveMinute);
    return;
  }

  cursorMinute = nextMinute;
  renderPerformanceMinute(cursorMinute);
  rewindTimer = setTimeout(rewindTick, settings.rewindSpeed);
}

function beginReveal(choice) {
  resetSecretInput();
  cursorMinute = fakeMinuteFromNow(choice);
  renderPerformanceMinute(cursorMinute);
  armedScreen.classList.remove("is-active");
  lockScreen.classList.add("is-active", "is-waking");
  performanceMode = "holding";

  rewindStartTimer = setTimeout(() => {
    if (performanceMode !== "holding") return;
    performanceMode = "rewinding";
    rewindTick();
  }, settings.rewindDelay * 1000);

  setTimeout(() => lockScreen.classList.remove("is-waking"), 340);
}

function onArmedPointerDown(event) {
  if (performanceMode !== "armed" || activePointer) return;
  event.preventDefault();
  activePointer = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    cancelled: false,
  };
  armedScreen.setPointerCapture?.(event.pointerId);

  if (event.clientX < 74 && event.clientY < 116) {
    cancelHoldTimer = setTimeout(() => {
      if (!activePointer || activePointer.id !== event.pointerId) return;
      activePointer.cancelled = true;
      vibrate(20);
      showSetup();
      showToast("Performance disarmed.");
    }, 1250);
  }
}

function onArmedPointerUp(event) {
  if (!activePointer || activePointer.id !== event.pointerId) return;
  event.preventDefault();
  clearTimeout(cancelHoldTimer);
  const wasCancelled = activePointer.cancelled;
  activePointer = null;
  cancelHoldTimer = null;
  if (!wasCancelled && performanceMode === "armed") {
    handleSecretTap(event.clientX, event.clientY);
  }
}

function onArmedPointerCancel(event) {
  if (!activePointer || activePointer.id !== event.pointerId) return;
  clearTimeout(cancelHoldTimer);
  activePointer = null;
  cancelHoldTimer = null;
}

function onLockScreenPointerUp(event) {
  if (event.clientX >= 76 || event.clientY >= 126) return;
  const now = Date.now();
  resetCornerTaps = [...resetCornerTaps.filter((time) => now - time < 850), now];
  if (resetCornerTaps.length >= 3) {
    vibrate(20);
    showSetup();
    showToast("Ready for another performance.");
  }
}

async function acceptMediaFile(kind, file) {
  if (!file?.type.startsWith("image/")) {
    showToast("Choose an image file.");
    return;
  }
  if (file.size > 25 * 1024 * 1024) {
    showToast("That image is larger than 25 MB.");
    return;
  }

  try {
    await writeMedia(kind, file);
    if (kind === "wallpaper") setWallpaper(file);
    else setReference(file);
    showToast(kind === "wallpaper" ? "Wallpaper saved on this device." : "Reference screenshot saved.");
  } catch {
    showToast("This browser could not save the image. It will work until the page closes.");
    if (kind === "wallpaper") setWallpaper(file);
    else setReference(file);
  }
}

function resetAppearance() {
  settings = {
    ...settings,
    clockStyle: DEFAULT_SETTINGS.clockStyle,
    clockColor: DEFAULT_SETTINGS.clockColor,
    clockSize: DEFAULT_SETTINGS.clockSize,
    clockWeight: DEFAULT_SETTINGS.clockWeight,
    clockPosition: DEFAULT_SETTINGS.clockPosition,
    clockOpacity: DEFAULT_SETTINGS.clockOpacity,
    wallpaperZoom: DEFAULT_SETTINGS.wallpaperZoom,
    wallpaperX: DEFAULT_SETTINGS.wallpaperX,
    wallpaperY: DEFAULT_SETTINGS.wallpaperY,
    showDate: DEFAULT_SETTINGS.showDate,
    showLock: DEFAULT_SETTINGS.showLock,
    showControls: DEFAULT_SETTINGS.showControls,
    use24Hour: DEFAULT_SETTINGS.use24Hour,
  };
  syncControlsFromSettings();
  applyAppearance();
  refreshPreviewClock();
  saveSettings();
  showToast("Appearance reset.");
}

async function clearEverything() {
  try {
    await clearMedia();
  } catch {
    // Settings are still cleared if media storage is unavailable.
  }
  localStorage.removeItem(SETTINGS_KEY);
  settings = { ...DEFAULT_SETTINGS };
  setWallpaper(null);
  setReference(null);
  syncControlsFromSettings();
  applyAppearance();
  refreshPreviewClock();
  confirmSheet.classList.remove("is-active");
  confirmSheet.setAttribute("aria-hidden", "true");
  showToast("Saved setup cleared.");
}

function bindControls() {
  for (const [key, element] of Object.entries(controls)) {
    element.addEventListener("input", () => {
      settings[key] = valueFromControl(key, element);
      applyAppearance();
      refreshPreviewClock();
      saveSettings();
    });
    element.addEventListener("change", () => {
      settings[key] = valueFromControl(key, element);
      applyAppearance();
      refreshPreviewClock();
      saveSettings();
    });
  }

  wallpaperInput.addEventListener("change", () => {
    acceptMediaFile("wallpaper", wallpaperInput.files?.[0]);
    wallpaperInput.value = "";
  });

  referenceInput.addEventListener("change", () => {
    acceptMediaFile("reference", referenceInput.files?.[0]);
    referenceInput.value = "";
  });

  toggleReferenceButton.addEventListener("click", () => setReferenceVisible(!referenceVisible));
  document.getElementById("referenceOpacity").addEventListener("input", (event) => {
    document.documentElement.style.setProperty("--reference-opacity", String(Number(event.target.value) / 100));
  });
  document.getElementById("resetAppearanceButton").addEventListener("click", resetAppearance);
  armButton.addEventListener("click", () => arm());
  rehearseButton.addEventListener("click", () => arm({ practice: true }));

  document.getElementById("clearAllButton").addEventListener("click", () => {
    confirmSheet.classList.add("is-active");
    confirmSheet.setAttribute("aria-hidden", "false");
  });
  document.getElementById("cancelClearButton").addEventListener("click", () => {
    confirmSheet.classList.remove("is-active");
    confirmSheet.setAttribute("aria-hidden", "true");
  });
  document.getElementById("confirmClearButton").addEventListener("click", clearEverything);

  armedScreen.addEventListener("pointerdown", onArmedPointerDown, { passive: false });
  armedScreen.addEventListener("pointerup", onArmedPointerUp, { passive: false });
  armedScreen.addEventListener("pointercancel", onArmedPointerCancel);
  armedScreen.addEventListener("contextmenu", (event) => event.preventDefault());
  lockScreen.addEventListener("pointerup", onLockScreenPointerUp);
  lockScreen.addEventListener("contextmenu", (event) => event.preventDefault());

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && wakeLockWanted && !wakeLock) requestWakeLock();
  });
}

async function loadSavedMedia() {
  try {
    const [savedWallpaper, savedReference] = await Promise.all([
      readMedia("wallpaper"),
      readMedia("reference"),
    ]);
    setWallpaper(savedWallpaper);
    setReference(savedReference);
  } catch {
    setWallpaper(null);
    setReference(null);
    document.getElementById("mediaSavedLabel").textContent = "Available for this session";
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
  });
}

function exposeQAControls() {
  if (!new URLSearchParams(location.search).has("qa")) return;
  window.__TIMEWARP_QA__ = {
    arm,
    reveal: (choice) => {
      if (!isValidChoice(choice)) throw new Error("Choice must be between 5 and 15");
      arm();
      beginReveal(choice);
    },
    reset: showSetup,
    setSettings(next) {
      settings = { ...settings, ...next };
      syncControlsFromSettings();
      applyAppearance();
      refreshPreviewClock();
    },
    state() {
      return { performanceMode, inputTotal, inputTapCount, cursorMinute, settings: { ...settings } };
    },
  };
}

async function initialize() {
  syncControlsFromSettings();
  applyAppearance();
  refreshPreviewClock();
  previewTimer = setInterval(refreshPreviewClock, 1000);
  bindControls();
  await loadSavedMedia();
  if (isStandalone()) installNote.classList.add("is-hidden");
  registerServiceWorker();
  exposeQAControls();
}

initialize();
