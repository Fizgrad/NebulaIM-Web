export function maskToken(token?: string | null) {
  if (!token) return "Not issued";
  if (token.length <= 12) return `${token.slice(0, 4)}...`;
  return `${token.slice(0, 10)}...${token.slice(-4)}`;
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en").format(value);
}

export function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}
