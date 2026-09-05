export const SETTINGS_KEY = "time-warp.settings.v4";
export const LEGACY_KEY = "time-warp.settings.v3";
export const clamp = (n, low, high) => Math.min(high, Math.max(low, n));
const number = (n, fallback, low, high) => Number.isFinite(Number(n)) ? clamp(Number(n), low, high) : fallback;
const member = (value, choices, fallback) => choices.includes(value) ? value : fallback;
const styles = ["system", "rounded", "serif", "mono", "glass"];
const defaults = {
  clock: { x: 50, y: 22, size: 24, weight: 520, opacity: 100, color: "#ffffff", style: "system" },
  date: { x: 50, y: 14, size: 4.25, weight: 560, opacity: 100, color: "#ffffff", style: "system" },
  wallpaperZoom: 100, wallpaperX: 50, wallpaperY: 50,
  showDate: true, use24Hour: false, dateFormat: "long",
  inputMethod: "taps", useCover: true, autoConfirm: 0,
  rewindDelay: 6, rewindSpeed: 500, calculatorEnabled: false,
  zones: { x: 50, y: 100 / 3, confirm: 200 / 3, values: [1, 2, 5, 10] },
};
export function normalizeSettings(raw = {}, ratio = 390 / 844) {
  const value = raw && typeof raw === "object" ? raw : {};
  const result = structuredClone(defaults);
  if (!value.clock && value.clockSize !== undefined) {
    const position = number(value.clockPosition, 13, 0, 100);
    value.clock = { x: 50, y: position + (5.7 + number(value.clockSize, 24, 8, 34) * .44) * ratio, size: value.clockSize, weight: value.clockWeight, color: value.clockColor, opacity: value.clockOpacity, style: value.clockStyle };
    value.date = { ...result.date, y: position + 2.55 * ratio, color: value.clockColor, opacity: value.clockOpacity };
  }
  for (const part of ["clock", "date"]) {
    const old = value[part] || {};
    const next = result[part];
    for (const [key, lo, hi] of [["x",0,100],["y",0,100],["size",part === "clock" ? 8 : 2,part === "clock" ? 34 : 12],["weight",100,900],["opacity",0,100]]) {
      next[key] = number(old[key], next[key], lo, hi);
    }
    next.color = /^#[0-9a-f]{6}$/i.test(old.color) ? old.color : next.color;
    next.style = member(old.style, styles, next.style);
  }
  for (const [key, lo, hi] of [["wallpaperZoom",100,200],["wallpaperX",0,100],["wallpaperY",0,100],["rewindDelay",0,60],["rewindSpeed",150,900]]) result[key] = number(value[key], result[key], lo, hi);
  for (const key of ["showDate","use24Hour","useCover","calculatorEnabled"]) if (typeof value[key] === "boolean") result[key] = value[key];
  result.inputMethod = member(value.inputMethod, ["taps","clipboard","shortcut","number","calculator"], "taps");
  if (!result.calculatorEnabled && result.inputMethod === "calculator") result.inputMethod = "taps";
  result.dateFormat = member(value.dateFormat, ["long","short","day-first"], "long");
  result.autoConfirm = Number(value.autoConfirm) === 3 ? 3 : 0;
  const z = value.zones || {};
  result.zones.x = number(z.x, 50, 20, 80);
  result.zones.confirm = number(z.confirm, 200/3, 45, 85);
  result.zones.y = number(z.y, 100/3, 18, result.zones.confirm - 15);
  result.zones.values = result.zones.values.map((v, i) => Math.round(number(z.values?.[i], v, 1, 180)));
  return result;
}
