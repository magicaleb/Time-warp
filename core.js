export const INPUT_VALUES = Object.freeze({
  topLeft: 1,
  topRight: 2,
  middleLeft: 5,
  middleRight: 10,
});

export const MIN_CHOICE = 1;
export const MAX_CHOICE = 180;

export function getInputZone(x, y, width, height, zones = { x: 50, y: 100 / 3, confirm: 200 / 3, values: [1, 2, 5, 10] }) {
  if (y >= height * zones.confirm / 100) return { kind: "confirm", value: 0 };

  const isLeft = x < width * zones.x / 100;
  const isTop = y < height * zones.y / 100;

  return { kind: "value", value: zones.values[(isTop ? 0 : 2) + (isLeft ? 0 : 1)] };
}

export function parseMinutes(text) {
  if (typeof text !== "string" || !/^\d{1,3}$/.test(text.trim())) return null;
  const value = Number(text.trim());
  return isValidChoice(value) ? value : null;
}

export function isValidChoice(value) {
  return Number.isInteger(value) && value >= MIN_CHOICE && value <= MAX_CHOICE;
}

export function minuteStamp(value = Date.now()) {
  const time = value instanceof Date ? value.getTime() : Number(value);
  return Math.floor(time / 60000);
}

export function dateFromMinute(stamp) {
  return new Date(stamp * 60000);
}

export function fakeMinuteFromNow(choice, value = Date.now()) {
  return minuteStamp(value) + choice;
}

export function nextRewindMinute(cursorMinute, liveMinute) {
  if (cursorMinute <= liveMinute) return liveMinute;
  return Math.max(cursorMinute - 1, liveMinute);
}

export function formatClock(date, use24Hour = false) {
  if (use24Hour) {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(date);
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(date)
    .replace(/\s?[AP]M$/i, "");
}

export function formatLockDate(date, style = "long") {
  if (style === "day-first") {
    return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(date);
  }
  if (style === "short") {
    return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(date).replace(/,/g, "");
  }
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function findInputRecipes() {
  const zones = [
    ["TL", INPUT_VALUES.topLeft],
    ["TR", INPUT_VALUES.topRight],
    ["ML", INPUT_VALUES.middleLeft],
    ["MR", INPUT_VALUES.middleRight],
  ];
  const recipes = new Map();

  for (let length = 1; length <= 3; length += 1) {
    const visit = (parts, total) => {
      if (parts.length === length) {
        if (isValidChoice(total) && !recipes.has(total)) recipes.set(total, parts);
        return;
      }
      for (const [name, value] of zones) visit([...parts, name], total + value);
    };
    visit([], 0);
  }

  return recipes;
}
