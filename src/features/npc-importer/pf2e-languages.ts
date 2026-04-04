import { normalizeBlank, slugifyTrait } from "./utils";

function mapLanguageSlug(slug: string): string | null {
  if (!slug) return null;
  // Only aliases: other slugs passthrough.
  if (slug === "elvish" || slug === "elven") return "elven";
  if (slug === "dwarvish" || slug === "dwarven") return "dwarven";
  return slug;
}

export function applyLanguages(
  updates: Record<string, unknown>,
  sys: any,
  raw: string | null,
): void {
  const src = normalizeBlank(raw);
  if (!src) return;

  const allowedLangs = new Set(
    Object.keys(((globalThis as any).CONFIG?.PF2E?.languages as any) ?? {}),
  );
  const enforce = allowedLangs.size > 0;

  const parts = src
    .split(/[,;\n]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const known: string[] = [];
  const custom: string[] = [];
  for (const p of parts) {
    const slug = mapLanguageSlug(slugifyTrait(p));
    if (!slug) {
      custom.push(p);
      continue;
    }
    if (!enforce || allowedLangs.has(slug)) known.push(slug);
    else custom.push(p);
  }

  const knownUniq = Array.from(new Set(known));
  const customUniq = Array.from(new Set(custom));
  if (!knownUniq.length && !customUniq.length) return;

  const langObj = foundry.utils.getProperty(sys, "details.languages") as any;
  if (langObj && typeof langObj === "object") {
    const next: any = { ...langObj };
    if (Array.isArray(langObj.value)) next.value = knownUniq;
    if (typeof langObj.custom === "string" && customUniq.length) {
      next.custom = customUniq.join(", ");
    }
    updates["system.details.languages"] = next;
    return;
  }

  if (foundry.utils.getProperty(sys, "details.languages.value") !== undefined) {
    updates["system.details.languages.value"] = knownUniq;
  }
  if (
    customUniq.length &&
    foundry.utils.getProperty(sys, "details.languages.custom") !== undefined
  ) {
    updates["system.details.languages.custom"] = customUniq.join(", ");
  }
}
