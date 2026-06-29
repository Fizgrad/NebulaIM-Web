export type RetryOptions = {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number, waitMs: number) => void;
};

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export async function retryWithBackoff<T>(operation: () => Promise<T>, options: RetryOptions = {}) {
  const retries = options.retries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 300;
  const maxDelayMs = options.maxDelayMs ?? 2400;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const canRetry = attempt < retries && (options.shouldRetry?.(error, attempt) ?? true);
      if (!canRetry) break;
      const waitMs = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      options.onRetry?.(error, attempt + 1, waitMs);
      await wait(waitMs);
    }
  }

  throw lastError;
}

export function isTransientError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("network") ||
    message.includes("disconnected") ||
    message.includes("not connected") ||
    message.includes("503") ||
    message.includes("504")
  );
}
