export function createId(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomItem<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)];
}
