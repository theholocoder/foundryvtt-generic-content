export function computeDowntimeDays(
  lastActiveTime: number | null | undefined,
  currentTime: number,
): number {
  if (lastActiveTime == null) return 0;
  return Math.floor((currentTime - lastActiveTime) / 86400);
}
