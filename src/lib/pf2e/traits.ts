export function sizeCodeToLabel(code: string): string {
  const map: Record<string, string> = {
    tiny: "Tiny",
    sm: "Small",
    med: "Medium",
    lg: "Large",
    huge: "Huge",
    grg: "Gargantuan",
  };
  return map[code] ?? code;
}
