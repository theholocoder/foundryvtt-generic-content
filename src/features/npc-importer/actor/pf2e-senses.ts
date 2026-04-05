import { normalizeBlank } from "../utils";

type ParsedSenses = {
  slugs: string[];
  custom: string[];
};

function parseSenses(raw: string | null): ParsedSenses {
  const src = normalizeBlank(raw);
  if (!src) return { slugs: [], custom: [] };

  const parts = src
    .split(/[,;\n]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const slugs: string[] = [];
  const custom: string[] = [];

  for (const p of parts) {
    const k = p.trim().toLowerCase();
    if (k === "darkvision") {
      slugs.push("darkvision");
      continue;
    }
    if (
      k === "low-light" ||
      k === "lowlight" ||
      k === "low-light vision" ||
      k === "low light"
    ) {
      slugs.push("lowLightVision");
      continue;
    }
    custom.push(p);
  }

  return {
    slugs: Array.from(new Set(slugs)),
    custom: Array.from(new Set(custom)),
  };
}

export function getSenseLabel(type: string): string {
  const cfg = (globalThis as any).CONFIG?.PF2E;
  const senses = cfg?.senses;
  const direct = senses?.[type] ?? senses?.[String(type).toLowerCase()];
  if (typeof direct === "string") return game.i18n?.localize(direct) ?? direct;

  const fallback =
    type === "darkvision"
      ? "Darkvision"
      : type === "lowLightVision"
        ? "Low-Light Vision"
        : type;
  return game.i18n?.localize(fallback) ?? fallback;
}

export function applySenses(
  updates: Record<string, unknown>,
  sys: any,
  raw: string | null,
): void {
  const parsed = parseSenses(raw);
  if (!parsed.slugs.length && !parsed.custom.length) return;

  const perceptionSenses = foundry.utils.getProperty(sys, "perception.senses") as any;
  if (Array.isArray(perceptionSenses)) {
    const baseTemplate =
      perceptionSenses.find((v) => v && typeof v === "object") ??
      {
        type: "darkvision",
        acuity: "precise",
        range: null,
        source: null,
        label: "Darkvision",
        emphasizeLabel: false,
      };

    const makeSense = (type: string): any => {
      const next = { ...baseTemplate };
      next.type = type;
      next.label = getSenseLabel(type);
      if (next.acuity === undefined) next.acuity = "precise";
      if (next.range === undefined) next.range = null;
      if (next.source === undefined) next.source = null;
      if (next.emphasizeLabel === undefined) next.emphasizeLabel = false;
      return next;
    };

    const desired: any[] = [];
    for (const slug of parsed.slugs) {
      if (slug === "darkvision") desired.push(makeSense("darkvision"));
      else if (slug === "lowLightVision") desired.push(makeSense("lowLightVision"));
    }

    const keyOf = (s: any) => `${String(s?.type ?? "").toLowerCase()}|${String(s?.range ?? "")}`;
    const merged = [...perceptionSenses];
    const existingKeys = new Set(merged.map(keyOf));
    for (const s of desired) {
      const k = keyOf(s);
      if (!existingKeys.has(k)) {
        merged.push(s);
        existingKeys.add(k);
      }
    }

    updates["system.perception.senses"] = merged;

    if (parsed.custom.length) {
      const curDetails = foundry.utils.getProperty(sys, "perception.details");
      if (typeof curDetails === "string") {
        const suffix = parsed.custom.join(", ");
        updates["system.perception.details"] = curDetails
          ? `${curDetails}\n${suffix}`
          : suffix;
      }
    }
  }

  const sensesObj = foundry.utils.getProperty(sys, "traits.senses") as any;
  if (sensesObj && typeof sensesObj === "object") {
    const next: any = { ...sensesObj };
    if (Array.isArray(sensesObj.value)) {
      const sample = sensesObj.value.find((v: any) => v !== undefined);
      if (sample === undefined || typeof sample === "string") {
        next.value = parsed.slugs;
      }
    }
    if (typeof sensesObj.custom === "string" && parsed.custom.length) {
      next.custom = parsed.custom.join(", ");
    }
    if (typeof sensesObj.details === "string" && parsed.custom.length) {
      next.details = parsed.custom.join(", ");
    }
    updates["system.traits.senses"] = next;
    return;
  }

  if (foundry.utils.getProperty(sys, "traits.senses.value") !== undefined) {
    updates["system.traits.senses.value"] = parsed.slugs;
  }
  if (
    parsed.custom.length &&
    foundry.utils.getProperty(sys, "traits.senses.custom") !== undefined
  ) {
    updates["system.traits.senses.custom"] = parsed.custom.join(", ");
  }
}
