import { normalizeBlank } from "./utils";

export function sizeCodeToLabel(size: string | null): string {
  const s = normalizeBlank(size);
  if (!s) return "";
  const v = s.trim().toLowerCase();

  const map: Record<string, string> = {
    sm: "small",
    med: "medium",
    lg: "large",
    grg: "gargantuan",
  };

  return map[v] ?? s;
}
