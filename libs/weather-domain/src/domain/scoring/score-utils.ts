export function clampScore(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)));
}
