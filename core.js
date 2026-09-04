export const INPUT_VALUES = Object.freeze({
  topLeft: 1,
  topRight: 2,
  middleLeft: 5,
  middleRight: 10,
});

export const MIN_CHOICE = 5;
export const MAX_CHOICE = 15;

export function getInputZone(x, y, width, height) {
  if (y >= height * (2 / 3)) return { kind: "confirm", value: 0 };

  const isLeft = x < width / 2;
  const isTop = y < height / 3;

  if (isTop && isLeft) return { kind: "value", value: INPUT_VALUES.topLeft };
  if (isTop && !isLeft) return { kind: "value", value: INPUT_VALUES.topRight };
  if (!isTop && isLeft) return { kind: "value", value: INPUT_VALUES.middleLeft };
  return { kind: "value", value: INPUT_VALUES.middleRight };
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

export function formatLockDate(date) {
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
