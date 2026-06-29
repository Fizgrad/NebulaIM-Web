export function createId(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function maskToken(token?: string): string {
  if (!token) return "";
  return token.length <= 8 ? `${token.slice(0, 4)}...` : `${token.slice(0, 8)}...`;
}
