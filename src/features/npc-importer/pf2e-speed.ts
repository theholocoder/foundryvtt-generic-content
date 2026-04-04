import { normalizeBlank } from "./utils";

type ParsedSpeed = {
  land: number | null;
  other: Array<{ type: "fly" | "swim" | "climb" | "burrow"; value: number }>;
};

function parseSpeed(raw: string | null): ParsedSpeed {
  const src = normalizeBlank(raw);
  if (!src) return { land: null, other: [] };

  // Units are intentionally ignored; all values interpreted as feet.
  const parts = src
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  let land: number | null = null;
  const other: ParsedSpeed["other"] = [];

  for (const p of parts) {
    const n = Number((p.match(/(\d+)/)?.[1] ?? ""));
    if (!Number.isFinite(n)) continue;
    const lower = p.toLowerCase();

    const pick = (type: ParsedSpeed["other"][number]["type"]) => {
      other.push({ type, value: n });
    };

    if (lower.includes("fly")) pick("fly");
    else if (lower.includes("swim")) pick("swim");
    else if (lower.includes("climb")) pick("climb");
    else if (lower.includes("burrow")) pick("burrow");
    else land = n;
  }

  return { land, other };
}

export function applySpeed(
  updates: Record<string, unknown>,
  sys: any,
  raw: string | null,
): void {
  const parsed = parseSpeed(raw);
  if (parsed.land === null && !parsed.other.length) return;

  const speedObj = foundry.utils.getProperty(sys, "attributes.speed") as any;
  if (speedObj && typeof speedObj === "object") {
    const next: any = { ...speedObj };
    if (parsed.land !== null && speedObj.value !== undefined) next.value = parsed.land;

    if (parsed.other.length) {
      const curOther = speedObj.otherSpeeds;
      if (Array.isArray(curOther)) {
        const base = curOther.find((v: any) => v && typeof v === "object") ?? {};
        next.otherSpeeds = parsed.other.map((s) => ({ ...base, ...s }));
      } else {
        next.otherSpeeds = parsed.other.map((s) => ({ ...s }));
      }
    }

    updates["system.attributes.speed"] = next;
    return;
  }

  if (parsed.land !== null) {
    updates["system.attributes.speed.value"] = parsed.land;
  }
}
