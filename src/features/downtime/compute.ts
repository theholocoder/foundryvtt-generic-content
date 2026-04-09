import type { Activity } from "./types";

export function computeDowntimeDays(
  lastActiveTime: number | null | undefined,
  currentTime: number,
): number {
  if (lastActiveTime == null) return 0;
  return Math.floor((currentTime - lastActiveTime) / 86400);
}

export function computeUsedDays(activities: Activity[]): number {
  return activities.reduce((sum, a) => sum + (a.days ?? 0), 0);
}
