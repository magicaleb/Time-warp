export class Calculator {
  constructor() { this.clear(); }
  clear() {
    this.display = "0"; this.left = null; this.operator = null;
    this.fresh = true; this.lastEntered = null; this.repeat = null;
  }
  calculate(a, op, b) {
    if (op === "+") return a + b;
    if (op === "-") return a - b;
    if (op === "*") return a * b;
    if (op === "/") return b === 0 ? NaN : a / b;
    return b;
  }
  show(n) { this.display = Number.isFinite(n) ? String(Number(n.toPrecision(10))) : "Error"; }
  press(key) {
    if (key === "clear") { this.clear(); return; }
    if (/^[0-9.]$/.test(key)) {
      if (this.fresh || this.display === "Error") this.display = key === "." ? "0." : key;
      else if (key === "." && this.display.includes(".")) return;
      else if (this.display.replace(/[-.]/g, "").length < 10) this.display = this.display === "0" && key !== "." ? key : this.display + key;
      this.fresh = false;
      this.lastEntered = Number(this.display);
      this.repeat = null;
      return;
    }
    if (this.display === "Error") return;
    if (key === "sign") { this.show(-Number(this.display)); if (!this.fresh) this.lastEntered = Number(this.display); return; }
    if (key === "%") {
      const n = Number(this.display);
      this.show(this.left !== null && ["+","-"].includes(this.operator) ? this.left * n / 100 : n / 100);
      return;
    }
    if (["+", "-", "*", "/"].includes(key)) {
      if (this.operator && !this.fresh) this.show(this.calculate(this.left, this.operator, Number(this.display)));
      this.left = Number(this.display); this.operator = key; this.fresh = true; this.repeat = null;
      return;
    }
    if (key === "=") {
      if (this.operator) {
        const right = Number(this.display);
        this.repeat = { op: this.operator, right };
        this.show(this.calculate(this.left, this.operator, right));
      } else if (this.repeat) this.show(this.calculate(Number(this.display), this.repeat.op, this.repeat.right));
      this.left = null; this.operator = null; this.fresh = true;
    }
  }
}
