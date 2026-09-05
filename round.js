import { dateFromMinute, fakeMinuteFromNow, minuteStamp, nextRewindMinute, isValidChoice, parseMinutes } from "./core.js?v=15";

// Every round owns its timers and async input. Cancellation invalidates late clipboard results.
export class Round {
  constructor({ now = Date.now, schedule = (callback, delay) => setTimeout(callback, delay), cancel = timer => clearTimeout(timer), change = () => {} } = {}) {
    this.now = now;
    this.schedule = schedule;
    this.cancelTimer = cancel;
    this.change = change;
    this.generation = 0;
    this.phase = "setup";
    this.choice = null;
    this.cursor = null;
    this.timer = null;
  }
  reset() {
    this.generation++;
    this.cancelTimer(this.timer);
    this.timer = null;
    this.choice = null;
    this.cursor = null;
    this.phase = "setup";
    this.change(this);
  }
  arm(settings, choice = null) {
    this.reset();
    this.settings = { ...settings };
    if (choice !== null && !isValidChoice(choice)) throw new Error("Use a whole number from 1 to 180.");
    this.choice = choice;
    this.phase = "armed";
    this.change(this);
  }
  async readClipboard(read) {
    if (this.phase !== "armed") return false;
    const generation = this.generation;
    this.phase = "reading";
    // Invoke immediately in the user's event handler, before any await.
    let pending;
    try { pending = read(); } catch (error) { pending = Promise.reject(error); }
    this.change(this);
    try {
      const value = parseMinutes(await pending);
      if (generation !== this.generation || this.phase !== "reading") return false;
      if (value === null) throw new Error("Clipboard must contain only a whole number from 1 to 180.");
      this.choice = value;
      this.phase = "armed";
      this.reveal(value);
      return true;
    } catch (error) {
      if (generation !== this.generation || this.phase !== "reading") return false;
      this.phase = "armed";
      this.change(this);
      throw error;
    }
  }
  reveal(choice = this.choice) {
    if (this.phase !== "armed" || !isValidChoice(choice)) return false;
    this.choice = choice;
    this.cursor = fakeMinuteFromNow(choice, this.now());
    this.phase = "holding";
    this.change(this);
    this.timer = this.schedule(() => {
      this.phase = "rewinding";
      this.tick();
    }, 450 + this.settings.rewindDelay * 1000);
    return true;
  }
  tick() {
    if (!["rewinding","landed"].includes(this.phase)) return;
    const live = minuteStamp(this.now());
    this.cursor = this.phase === "landed" ? live : nextRewindMinute(this.cursor, live);
    if (this.cursor <= live) this.phase = "landed";
    this.change(this);
    this.timer = this.schedule(() => this.tick(), this.phase === "landed" ? 1000 : this.settings.rewindSpeed);
  }
  date() { return this.cursor === null ? new Date(this.now()) : dateFromMinute(this.cursor); }
}
