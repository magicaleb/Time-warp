/* performance engine */
function clearPerformanceTimer() { if (performance.timer) clearTimeout(performance.timer); performance.timer = null; }

function preparePerformance(source, choice = null) {
  clearPerformanceTimer();
  setError("");
  total = 0; tapCount = 0;
  performance = { source, choice, phase: choice ? "armed" : "entry", displayMs:null, timer:null };
  mode = "performance";
  $("setup").hidden = true;
  $("stage").hidden = false;
  $("stage").className = "stage";
  $("editor").hidden = true;
  $("zoneEditor").hidden = true;
  $("calculator").hidden = true;
  $("manualPaste").hidden = true;
  $("clockText").hidden = true;
  $("dateText").hidden = true;
  const covered = settings.useCover;
  $("cover").hidden = !covered;
  if (!covered && source !== "taps" && choice) reveal(choice);
}

function reveal(choice = performance.choice) {
  choice = parseChoice(choice);
  if (choice === null) { toast("Choose a whole number from 1 to 180."); return false; }
  clearPerformanceTimer();
  performance.choice = choice;
  performance.phase = "holding";
  performance.displayMs = floorMinute() + choice * MINUTE;
  $("cover").hidden = true;
  $("clockText").hidden = false;
  $("dateText").hidden = !settings.showDate;
  $("reference").hidden = true;
  $("stage").className = "stage revealing";
  applyAppearance();
  renderClock(performance.displayMs);
  performance.timer = setTimeout(beginRewind, settings.holdDuration * 1000);
  return true;
}

function beginRewind() {
  if (mode !== "performance" || performance.phase !== "holding") return;
  performance.phase = "rewinding";
  rewindTick();
}

function rewindTick() {
  if (mode !== "performance" || performance.phase !== "rewinding") return;
  const now = floorMinute();
  const next = performance.displayMs - MINUTE;
  if (next <= now) {
    performance.displayMs = now;
    performance.phase = "landed";
    renderClock(now);
    clearPerformanceTimer();
    return;
  }
  performance.displayMs = next;
  renderClock(next);
  performance.timer = setTimeout(rewindTick, settings.rewindSpeed);
}

async function readClipboardChoice() {
  if (!navigator.clipboard?.readText) throw new Error("Clipboard access is unavailable.");
  const text = await navigator.clipboard.readText();
  const value = parseChoice(text);
  if (value === null) throw new Error("Clipboard must contain only a whole number from 1 to 180.");
  return value;
}

async function startClipboardFromSetup() {
  const pasted = parseChoice($("pasteNumber").value);
  if (!$("pasteFallback").hidden && pasted !== null) { preparePerformance("clipboard",pasted); reveal(pasted); return; }
  try {
    const value = await readClipboardChoice();
    preparePerformance("clipboard",value);
    reveal(value);
  } catch (error) {
    $("pasteFallback").hidden = false;
    setError(error.message + " Paste the number below, then press Paste & perform again.");
    $("pasteNumber").focus();
  }
}

async function readClipboardFromCover() {
  try {
    const value = await readClipboardChoice();
    performance.choice = value;
    reveal(value);
  } catch (error) {
    $("manualPaste").hidden = false;
    $("performancePaste").value = "";
    $("performancePaste").focus();
    toast(error.message);
  }
}

function startPerformance() {
  setError("");
  const method = settings.inputMethod;
  if (method === "taps") { preparePerformance("taps"); return; }
  if (method === "clipboard") {
    if (settings.useCover) preparePerformance("clipboard"); else startClipboardFromSetup();
    return;
  }
  if (method === "shortcut") {
    if (shortcutChoice === null) { selectMainTab("input"); setError("Open the Shortcut URL with a valid minutes value first."); return; }
    preparePerformance("shortcut",shortcutChoice);
    if (!settings.useCover) reveal(shortcutChoice);
    return;
  }
  if (method === "direct") {
    const n = parseChoice($("directNumber").value);
    if (n === null) { selectMainTab("input"); setError("Enter a whole number from 1 to 180."); return; }
    preparePerformance("direct",n);
    if (!settings.useCover) reveal(n);
    return;
  }
  if (method === "calculator") {
    if (!settings.calculatorEnabled) { selectMainTab("timing"); setError("Enable Calculator disguise first."); return; }
    openCalculator();
  }
}

function performanceTap(event) {
  if (mode !== "performance" || suppressTap || activePointers.size > 0) return;
  if (performance.phase === "holding" || performance.phase === "rewinding" || performance.phase === "landed") return;
  if (performance.source === "clipboard") { if (!$("cover").hidden) readClipboardFromCover(); return; }
  if (["direct","shortcut","calculator"].includes(performance.source)) { if (!$("cover").hidden && performance.choice) reveal(performance.choice); return; }
  if (performance.source !== "taps") return;
  const zone = zoneAt(event.clientX,event.clientY);
  if (zone.type === "confirm") {
    if (settings.confirmMode === "zone") {
      const choice = parseChoice(total);
      if (choice === null) { toast("Enter at least 1 minute first."); return; }
      reveal(choice);
    }
    return;
  }
  total += zone.value;
  tapCount += 1;
  if (total > 180) { total -= zone.value; tapCount -= 1; toast("Tap total would exceed 180."); return; }
  if (settings.confirmMode === "three" && tapCount >= 3) reveal(total);
}

/* calculator disguise */
function renderCalculator() { $("calcDisplay").textContent = calculator.display.length > 10 ? Number(calculator.display).toPrecision(8).replace(/\.0+$/,'') : calculator.display; }
function openCalculator() {
  mode = "calculator";
  calculator = freshCalculator();
  $("setup").hidden = true;
  $("stage").hidden = false;
  $("stage").className = "stage";
  $("calculator").hidden = false;
  $("editor").hidden = true;
  $("zoneEditor").hidden = true;
  $("cover").hidden = true;
  $("clockText").hidden = true;
  $("dateText").hidden = true;
  renderCalculator();
}
function calcNumber(ch) {
  if (calculator.waiting || calculator.justCalculated) { calculator.display = ch === "." ? "0." : ch; calculator.waiting = false; calculator.justCalculated = false; }
  else if (ch === ".") { if (!calculator.display.includes(".")) calculator.display += "."; }
  else calculator.display = calculator.display === "0" ? ch : calculator.display + ch;
  const n = Number(calculator.display);
  if (Number.isFinite(n)) calculator.lastEntry = n;
  renderCalculator();
}
function calcApply(a,b,op) { if (op === "+") return a+b; if (op === "-") return a-b; if (op === "*") return a*b; if (op === "/") return b === 0 ? NaN : a/b; return b; }
function calcOperator(op) {
  const current = Number(calculator.display);
  if (calculator.stored !== null && calculator.operator && !calculator.waiting) {
    const result = calcApply(calculator.stored,current,calculator.operator);
    calculator.display = Number.isFinite(result) ? String(Number(result.toPrecision(12))) : "Error";
    calculator.stored = Number.isFinite(result) ? result : null;
  } else calculator.stored = current;
  calculator.operator = op; calculator.waiting = true; calculator.justCalculated = false; renderCalculator();
}
function calcEquals() {
  if (calculator.operator === null || calculator.stored === null) return;
  const current = Number(calculator.display);
  if (Number.isFinite(current)) calculator.lastEntry = current;
  const result = calcApply(calculator.stored,current,calculator.operator);
  calculator.display = Number.isFinite(result) ? String(Number(result.toPrecision(12))) : "Error";
  calculator.stored = null; calculator.operator = null; calculator.waiting = false; calculator.justCalculated = true; renderCalculator();
}
function calculatorKey(key) {
  if (/^\d$/.test(key) || key === ".") calcNumber(key);
  else if (["+","-","*","/"].includes(key)) calcOperator(key);
  else if (key === "=") calcEquals();
  else if (key === "clear") { calculator = freshCalculator(); renderCalculator(); }
  else if (key === "sign") { const n=Number(calculator.display); if(Number.isFinite(n)){ calculator.display=String(-n); calculator.lastEntry=-n; renderCalculator(); } }
  else if (key === "percent") { const n=Number(calculator.display); if(Number.isFinite(n)){ calculator.display=String(n/100); calculator.lastEntry=n/100; renderCalculator(); } }
}
function secretCalculatorCapture() {
  const choice = parseChoice(Math.abs(Math.trunc(calculator.lastEntry)));
  if (choice === null) { toast("Last entered number must be a whole number from 1 to 180."); return; }
  preparePerformance("calculator",choice);
  if (!settings.useCover) reveal(choice);
}

/* URL / Shortcut */
function shortcutChoiceFromUrl(urlLike) {
  const url = new URL(urlLike, location.href);
  const hashParams = new URLSearchParams(url.hash.replace(/^#/,""));
  const raw = url.searchParams.get("minutes") ?? url.searchParams.get("n") ?? hashParams.get("minutes") ?? hashParams.get("n");
  return parseChoice(raw);
}
function consumeShortcutValue() {
  const url = new URL(location.href);
  const hashParams = new URLSearchParams(url.hash.replace(/^#/,""));
  const choice = shortcutChoiceFromUrl(url);
  if (choice === null) return false;
  shortcutChoice = choice;
  settings.inputMethod = "shortcut";
  saveSettings();
  url.searchParams.delete("minutes"); url.searchParams.delete("n");
  hashParams.delete("minutes"); hashParams.delete("n");
  const newHash = hashParams.toString();
  history.replaceState(null,"",url.pathname + (url.searchParams.toString()?`?${url.searchParams}`:"") + (newHash?`#${newHash}`:""));
  return true;
}
