export function createId(prefix = "id") {
  return `${prefix}_${globalThis.crypto.randomUUID()}`;
}
