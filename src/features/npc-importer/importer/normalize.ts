import type { JSONObject, NormalizedNpc, NormalizedSpecial, NormalizedStrike } from "./types";
import { asNonEmptyString, asNumber, normalizeBlank, splitCsv, toHtml } from "../utils";
import { mapSizeToPf2e } from "../actor/pf2e-actor";

const SKILL_MAP: Record<string, string> = {
  acrobatics: "acr",
  arcana: "arc",
  athletics: "ath",
  crafting: "cra",
  deception: "dec",
  diplomacy: "dip",
  intimidation: "itm",
  medicine: "med",
  nature: "nat",
  occultism: "occ",
  performance: "prf",
  religion: "rel",
  society: "soc",
  stealth: "ste",
  survival: "sur",
  thievery: "thi",
};

export function normalizePf2ToolsNpc(raw: unknown): NormalizedNpc {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Expected object JSON");
  }
  const o = raw as JSONObject;

  const name = asNonEmptyString(o.name) ?? "";
  const level = asNumber(o.level);
  const alignment = normalizeBlank(asNonEmptyString(o.alignment));
  const size = mapSizeToPf2e(normalizeBlank(asNonEmptyString(o.size)));
  const creatureType = normalizeBlank(asNonEmptyString(o.type));

  const rawTraitTokens = splitCsv(asNonEmptyString(o.traits));
  const rarityCandidates = rawTraitTokens
    .map((t) => t.toLowerCase())
    .filter((t) => t === "common" || t === "uncommon" || t === "rare" || t === "unique");
  if (rarityCandidates.length > 1) {
    console.warn(
      "LGC | Multiple rarity tokens found in traits",
      rarityCandidates,
      rawTraitTokens,
    );
  }
  const rarityToken = rarityCandidates[0] ?? null;
  const rarity = rarityToken ?? null;
  const customTraits = rawTraitTokens.filter((t) => t.toLowerCase() !== rarityToken);
  const ancestryLike = customTraits[0] ? normalizeBlank(customTraits[0]) : null;

  const img = normalizeBlank(asNonEmptyString(o.imgurl));
  const description = normalizeBlank(asNonEmptyString(o.description));
  const info = normalizeBlank(asNonEmptyString(o.info));
  const speedRaw = normalizeBlank(asNonEmptyString(o.speed));
  const languagesRaw = normalizeBlank(asNonEmptyString(o.languages));
  const sensesRaw = normalizeBlank(
    asNonEmptyString((o.perception as JSONObject | undefined)?.note),
  );

  const ac = asNumber((o.ac as JSONObject | undefined)?.value);
  const hp = asNumber((o.hp as JSONObject | undefined)?.value);
  const perception = asNumber((o.perception as JSONObject | undefined)?.value);

  const saves = {
    fortitude: asNumber((o.fortitude as JSONObject | undefined)?.value),
    reflex: asNumber((o.reflex as JSONObject | undefined)?.value),
    will: asNumber((o.will as JSONObject | undefined)?.value),
  };

  const abilities = {
    str: asNumber((o.strength as JSONObject | undefined)?.value),
    dex: asNumber((o.dexterity as JSONObject | undefined)?.value),
    con: asNumber((o.constitution as JSONObject | undefined)?.value),
    int: asNumber((o.intelligence as JSONObject | undefined)?.value),
    wis: asNumber((o.wisdom as JSONObject | undefined)?.value),
    cha: asNumber((o.charisma as JSONObject | undefined)?.value),
  };

  const resistancesRaw = normalizeBlank(
    asNonEmptyString((o.resistance as JSONObject | undefined)?.value),
  );
  const weaknessesRaw = normalizeBlank(
    asNonEmptyString((o.weakness as JSONObject | undefined)?.value),
  );
  const immunitiesRaw = normalizeBlank(
    asNonEmptyString((o.immunity as JSONObject | undefined)?.value),
  );

  const skills: Record<string, number> = {};
  const skillsRaw: Record<string, number> = {};
  for (const [k, slug] of Object.entries(SKILL_MAP)) {
    const v = asNumber((o[k] as JSONObject | undefined)?.value);
    if (typeof v === "number") {
      skills[slug] = v;
      skillsRaw[k] = v;
    }
  }

  const strikes: NormalizedStrike[] = [];
  if (Array.isArray(o.strikes)) {
    for (const s of o.strikes) {
      if (!s || typeof s !== "object" || Array.isArray(s)) continue;
      const so = s as JSONObject;
      const strikeName = asNonEmptyString(so.name);
      if (!strikeName) continue;

      const kind =
        String(so.type ?? "").toLowerCase() === "ranged" ? "ranged" : "melee";
      const traits = parseTraits(asNonEmptyString(so.traits));
      const attack = asNumber(so.attack);
      const damageRaw = normalizeBlank(asNonEmptyString(so.damage));
      const damageParsed = parseDamageString(damageRaw ?? "");

      strikes.push({
        name: strikeName,
        kind,
        traits,
        attack: typeof attack === "number" ? attack : null,
        damageRaw,
        damageParsed,
      });
    }
  }

  const specials: NormalizedSpecial[] = [];
  if (Array.isArray(o.specials)) {
    for (const sp of o.specials) {
      if (!sp || typeof sp !== "object" || Array.isArray(sp)) continue;
      const spo = sp as JSONObject;
      const spName = asNonEmptyString(spo.name);
      const descriptionRaw = asNonEmptyString(spo.description) ?? "";
      if (!spName) continue;

      specials.push({
        name: spName,
        traits: parseTraits(asNonEmptyString(spo.traits)),
        actions: normalizeBlank(asNonEmptyString(spo.actions)),
        descriptionRaw,
        descriptionHtml: toHtml(descriptionRaw),
      });
    }
  }

  const spellAttack = asNumber((o.spellattack as JSONObject | undefined)?.value);
  const spellDc = asNumber((o.spelldc as JSONObject | undefined)?.value);
  const focusPoints = asNumber(o.focuspoints);
  const cantripLevel = asNumber(o.cantriplevel);

  const spellsByLevel = normalizeSpellsByLevel(o.spells);
  const spelltypeRaw = normalizeBlank(asNonEmptyString(o.spelltype));
  const spelltype = spelltypeRaw ? spelltypeRaw.trim().toLowerCase() : null;

  const hasAnySpells = spellsByLevel.some((g) => g.names.length);
  const tradition: NormalizedNpc["spellcasting"]["tradition"] = hasAnySpells
    ? "occult"
    : null;
  const preparation: NormalizedNpc["spellcasting"]["preparation"] = hasAnySpells
    ? (spelltype === "prepared" ||
        spelltype === "innate" ||
        spelltype === "spontaneous"
        ? (spelltype as any)
        : "innate")
    : null;

  return {
    name,
    level: typeof level === "number" ? level : null,
    alignment,
    size,
    creatureType,
    ancestryLike,
    customTraits,
    rarity,
    img,
    description,
    info,
    speedRaw,
    languagesRaw,
    sensesRaw,
    ac: typeof ac === "number" ? ac : null,
    hp: typeof hp === "number" ? hp : null,
    perception: typeof perception === "number" ? perception : null,
    saves,
    abilities,
    skills,
    skillsRaw,
    resistancesRaw,
    weaknessesRaw,
    immunitiesRaw,
    strikes,
    specials,
    spellcasting: {
      tradition,
      preparation,
      spellAttack: typeof spellAttack === "number" ? spellAttack : null,
      spellDc: typeof spellDc === "number" ? spellDc : null,
      focusPoints: typeof focusPoints === "number" ? focusPoints : null,
      cantripLevel: typeof cantripLevel === "number" ? cantripLevel : null,
      spellsByLevel,
    },
    raw,
  };
}

export function normalizeSpellsByLevel(
  raw: unknown,
): Array<{ level: number; names: string[] }> {
  if (!Array.isArray(raw)) return [];

  // pf2.tools export assumption:
  // array tail contains the lowest levels/cantrips. We interpret last element as cantrips (0),
  // previous as 1st, previous as 2nd, etc.
  // If this ever changes upstream, spell levels will be mis-assigned.
  const first = raw[0];
  const last = raw[raw.length - 1];
  if (typeof first === "string" && first.trim() && typeof last === "string" && last.trim()) {
    console.debug("LGC | Spells array has non-empty head and tail; export ordering may differ", {
      head: first,
      tail: last,
    });
  }

  const out: Array<{ level: number; names: string[] }> = [];
  const len = raw.length;
  for (let i = 0; i < len; i++) {
    const fromEnd = len - 1 - i;
    const level = i === 0 ? 0 : i;
    const cell = raw[fromEnd];
    if (typeof cell !== "string") continue;
    const names = cell
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    out.push({ level, names });
  }
  return out;
}

export function parseDamageString(raw: string): {
  formula: string | null;
  damageType: string | null;
  note: string | null;
} {
  const src = normalizeBlank(raw) ?? "";
  if (!src) return { formula: null, damageType: null, note: null };

  const m = src.match(/^\s*(\d+d\d+(?:\s*[+-]\s*\d+)*)\s*(.*)$/i);
  if (!m) return { formula: null, damageType: null, note: null };

  const formula = m[1].replace(/\s+/g, "");
  let rest = (m[2] ?? "").trim();

  let note: string | null = null;
  const paren = rest.match(/\(([^)]+)\)/);
  if (paren) {
    note = normalizeBlank(paren[1].trim());
    rest = rest.replace(paren[0], "").trim();
  }

  const typeMatch = rest.match(/^([a-z]+)\b/i);
  const maybeType = typeMatch ? typeMatch[1].toLowerCase() : null;
  const damageType = isLikelyDamageType(maybeType) ? maybeType : null;

  return { formula, damageType, note };
}

export function isLikelyDamageType(t: string | null): boolean {
  if (!t) return false;
  return (
    t === "bludgeoning" ||
    t === "piercing" ||
    t === "slashing" ||
    t === "mental" ||
    t === "fire" ||
    t === "cold" ||
    t === "acid" ||
    t === "electricity" ||
    t === "sonic" ||
    t === "poison" ||
    t === "force" ||
    t === "negative" ||
    t === "positive"
  );
}

export function parseTraits(raw: string | null | undefined): string[] {
  const src = normalizeBlank(raw) ?? "";
  if (!src) return [];
  return src
    .split(/[,;]+/g)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) =>
      s
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, ""),
    );
}
