export const DEFAULT_DURATION_SECONDS = 5;
export const MIN_DURATION_SECONDS = 4;
export const MAX_DURATION_SECONDS = 15;

export function normalizeDurationSeconds(value: unknown) {
  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue)) return DEFAULT_DURATION_SECONDS;

  return Math.min(
    MAX_DURATION_SECONDS,
    Math.max(MIN_DURATION_SECONDS, Math.round(numericValue)),
  );
}
