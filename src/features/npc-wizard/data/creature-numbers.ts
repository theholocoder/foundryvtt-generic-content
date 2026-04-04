import RAW from "./pf2e-creature-numbers.json";

const LEVEL_INDEX: Record<number, number> = {};
RAW.levels.forEach((lvl, i) => { LEVEL_INDEX[lvl] = i; });

type Rank = "low" | "moderate" | "high" | "extreme" | "terrible";
type TableKey = keyof typeof RAW.tables;

const RANK_MAP: Record<string, Rank> = {
  LOW: "low",
  MEDIUM: "moderate",
  MODERATE: "moderate",
  HIGH: "high",
  EXTREME: "extreme",
  TERRIBLE: "terrible",
};

export function rankFromUi(ui: string): Rank | null {
  return RANK_MAP[ui.toUpperCase()] ?? null;
}

export function getCreatureNumber(table: TableKey, level: number, rank: Rank): number | null {
  const idx = LEVEL_INDEX[level];
  if (idx === undefined) return null;
  const t = RAW.tables[table];
  if (!t) return null;
  const vals = t.ranks[rank];
  if (!vals) return null;
  return vals[idx] ?? null;
}

export function getAttackBonus(level: number, rank: Rank): number | null {
  return getCreatureNumber("attack", level, rank);
}

export function getAc(level: number, rank: Rank): number | null {
  return getCreatureNumber("ac", level, rank);
}

export function getHp(level: number, rank: Rank): number | null {
  return getCreatureNumber("hp", level, rank);
}

export function getPerception(level: number, rank: Rank): number | null {
  return getCreatureNumber("perception", level, rank);
}

export function getSave(table: "fortitude" | "reflex" | "will", level: number, rank: Rank): number | null {
  return getCreatureNumber(table, level, rank);
}

export function getSkill(level: number, rank: Rank): number | null {
  return getCreatureNumber("skill", level, rank);
}

export function getDamageFormula(level: number, rank: Rank): string | null {
  const idx = LEVEL_INDEX[level];
  if (idx === undefined) return null;
  const t = RAW.tables["damage"];
  if (!t) return null;
  const vals = t.ranks[rank] as unknown as string[];
  if (!vals) return null;
  return vals[idx] ?? null;
}

export function getSpellAttack(level: number, rank: Rank): number | null {
  return getCreatureNumber("spellAttack", level, rank);
}

export function getSpellDc(level: number, rank: Rank): number | null {
  return getCreatureNumber("spellDc", level, rank);
}

export function getAbilityMod(level: number, rank: Rank): number | null {
  return getCreatureNumber("abilityMod", level, rank);
}
