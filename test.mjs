import assert from "node:assert/strict";
import { getInputZone, parseMinutes } from "./core.js";
import { Calculator } from "./calculator.js";
import { normalizeSettings } from "./settings.js";
import { Round } from "./round.js";

assert.equal(parseMinutes("15"), 15);
assert.equal(parseMinutes(" 180 "), 180);
assert.equal(parseMinutes("0"), null);
assert.equal(parseMinutes("15 minutes"), null);

const zones = { x: 40, y: 25, confirm: 75, values: [3, 4, 7, 11] };
assert.deepEqual(getInputZone(10, 10, 100, 100, zones), { kind: "value", value: 3 });
assert.deepEqual(getInputZone(90, 50, 100, 100, zones), { kind: "value", value: 11 });
assert.deepEqual(getInputZone(50, 90, 100, 100, zones), { kind: "confirm", value: 0 });

const migrated = normalizeSettings({ clockSize: 26, clockPosition: 14, showControls: true });
assert.equal(migrated.clock.size, 26);
assert.ok(migrated.clock.y > 14);
assert.equal("showControls" in migrated, false);

const calc = new Calculator();
for (const key of ["1", "2", "+", "7", "="]) calc.press(key);
assert.equal(calc.display, "19");
assert.equal(calc.lastEntered, 7);
calc.press("=");
assert.equal(calc.display, "26");

let now = new Date(2026, 0, 1, 12, 0).getTime();
const timers = [];
const round = new Round({
  now: () => now,
  schedule: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
  cancel: () => {},
});
round.arm({ rewindDelay: 2, rewindSpeed: 500 }, 5);
assert.equal(round.reveal(), true);
assert.equal(round.phase, "holding");
assert.equal(timers.shift().delay, 2450);
round.phase = "rewinding";
round.tick();
assert.equal(round.phase, "rewinding");
assert.equal(timers.at(-1).delay, 500);
now += 5 * 60000;
round.tick();
assert.equal(round.phase, "landed");

const clipboardRound = new Round({ now: () => now, schedule: () => 1, cancel: () => {} });
clipboardRound.arm({ rewindDelay: 0, rewindSpeed: 500 });
await clipboardRound.readClipboard(() => Promise.resolve("12"));
assert.equal(clipboardRound.choice, 12);
assert.equal(clipboardRound.phase, "holding");

console.log("Time Warp core tests passed.");
