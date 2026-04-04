import type { ImportContext, NormalizedNpc } from "./types";
import { normalizeBlank, slugifyTrait, toHtml } from "./utils";
import { buildEmbeddedItems } from "./pf2e-items";
import { createSpellcasting } from "./pf2e-spellcasting";
import { parseIwrNoValues, parseIwrWithValues } from "./pf2e-iwr";
import { applyLanguages } from "./pf2e-languages";
import { applySenses } from "./pf2e-senses";
import { applySpeed } from "./pf2e-speed";
import { indexActorSkills, normalizeKey } from "./pf2e-skills";

const SKILL_UPDATE_PATHS = [
  "mod",
  "mod.value",
  "value",
  "modifier",
  "totalModifier",
];

export async function createPf2eNpcActor(
  ctx: ImportContext,
  npc: NormalizedNpc,
): Promise<{ actor: Actor } | null> {
  let actor: Actor;
  try {
    const img = npc.img ?? "icons/svg/mystery-man.svg";
    actor = (await Actor.create({
      name: npc.name,
      type: "npc",
      img,
    } as any)) as Actor;
  } catch (err) {
    console.error("LGC | Actor creation failed", err, { npc });
    ui.notifications?.error("LGC | Failed to create actor (see console)");
    return null;
  }

  const sysInitial: any = (actor as any).system;
  if (!sysInitial) return { actor };

  const updatesPre: Record<string, unknown> = {};
  const setIfExistsPre = (relativePath: string, value: unknown) => {
    if (value === null || value === undefined) return;
    const cur = foundry.utils.getProperty(sysInitial, relativePath);
    if (cur === undefined) return;
    updatesPre[`system.${relativePath}`] = value;
  };

  setIfExistsPre("details.level.value", npc.level);
  setIfExistsPre("traits.size.value", npc.size);
  applyActorTraits(updatesPre, sysInitial, npc);
  applyRarity(updatesPre, sysInitial, npc.rarity);

  setAbilityMod(setIfExistsPre, sysInitial, "str", npc.abilities.str);
  setAbilityMod(setIfExistsPre, sysInitial, "dex", npc.abilities.dex);
  setAbilityMod(setIfExistsPre, sysInitial, "con", npc.abilities.con);
  setAbilityMod(setIfExistsPre, sysInitial, "int", npc.abilities.int);
  setAbilityMod(setIfExistsPre, sysInitial, "wis", npc.abilities.wis);
  setAbilityMod(setIfExistsPre, sysInitial, "cha", npc.abilities.cha);

  setIfExistsPre("attributes.ac.value", npc.ac);
  setIfExistsPre("perception.mod", npc.perception);
  setIfExistsPre("saves.fortitude.value", npc.saves.fortitude);
  setIfExistsPre("saves.reflex.value", npc.saves.reflex);
  setIfExistsPre("saves.will.value", npc.saves.will);

  applyIwr(updatesPre, sysInitial, "attributes.resistances", parseIwrWithValues(npc.resistancesRaw));
  applyIwr(updatesPre, sysInitial, "attributes.weaknesses", parseIwrWithValues(npc.weaknessesRaw));
  applyIwr(updatesPre, sysInitial, "attributes.immunities", parseIwrNoValues(npc.immunitiesRaw));

  // Skills
  const skillsObj = foundry.utils.getProperty(sysInitial, "skills") as
    | Record<string, unknown>
    | undefined;
  if (skillsObj && typeof skillsObj === "object") {
    const index = indexActorSkills(skillsObj as any);
    for (const [rawKey, mod] of Object.entries(npc.skillsRaw)) {
      const skillKey = index.get(normalizeKey(rawKey));
      if (!skillKey) continue;
      const base = (skillsObj as any)[skillKey];
      if (!base || typeof base !== "object") continue;

      for (const suffix of SKILL_UPDATE_PATHS) {
        const rel = `skills.${skillKey}.${suffix}`;
        const cur = foundry.utils.getProperty(sysInitial, rel);
        if (cur !== undefined) {
          updatesPre[`system.${rel}`] = mod;
          break;
        }
      }
    }
  }

  if (Object.keys(updatesPre).length) {
    try {
      await actor.update(updatesPre);
    } catch (err) {
      console.error("LGC | Actor system update failed", err, { updates: updatesPre, npc });
      ui.notifications?.warn("LGC | Actor created but some fields not applied");
    }
  }

  // Embedded items
  const items = buildEmbeddedItems(npc);
  if (items.length) {
    try {
      await actor.createEmbeddedDocuments("Item", items);
    } catch (err) {
      console.error("LGC | Embedded item creation failed", err, { items, npc });
      ui.notifications?.warn("LGC | Actor created but items failed (see console)");
    }
  }

  if (npc.spellcasting.spellsByLevel.some((g) => g.names.length)) {
    try {
      await createSpellcasting(ctx, actor, npc);
    } catch (err) {
      console.error("LGC | Spellcasting creation failed", err, { npc });
      ui.notifications?.warn("LGC | Actor created but spells failed (see console)");
    }
  }

  // Post-embedded finalize
  const sysPost: any = (actor as any).system;
  if (sysPost) {
    const updatesPost: Record<string, unknown> = {};
    applySpeed(updatesPost, sysPost, npc.speedRaw);
    applySenses(updatesPost, sysPost, npc.sensesRaw);
    applyLanguages(updatesPost, sysPost, npc.languagesRaw);
    applyActorDescription(updatesPost, sysPost, npc);

    if (Object.keys(updatesPost).length) {
      try {
        await actor.update(updatesPost);
      } catch (err) {
        console.error("LGC | Actor finalize update failed", err, { updates: updatesPost, npc });
      }
    }
  }

  if (npc.hp !== null) {
    await finalizeHp(actor, npc.hp);
  }

  return { actor };
}

export async function finalizeHp(actor: Actor, hp: number): Promise<void> {
  try {
    // Two separate updates: PF2e may clamp value = min(old_value, new_max) during
    // preUpdateActor hooks, so setting both in one call can leave value at the old default.
    await actor.update({ "system.attributes.hp.max": hp });
    const valueUpdate: Record<string, unknown> = { "system.attributes.hp.value": hp };
    if (foundry.utils.getProperty((actor as any).system, "attributes.hp.temp") !== undefined) {
      valueUpdate["system.attributes.hp.temp"] = 0;
    }
    await actor.update(valueUpdate);
  } catch (err) {
    console.error("LGC | Failed to finalize HP", err, { actor: actor?.name, hp });
  }
}

function setAbilityMod(
  setIfExists: (relativePath: string, value: unknown) => void,
  sys: any,
  abil: "str" | "dex" | "con" | "int" | "wis" | "cha",
  mod: number | null,
): void {
  if (mod === null) return;
  const base = foundry.utils.getProperty(sys, `abilities.${abil}`) as any;
  if (!base || typeof base !== "object") return;

  if (foundry.utils.getProperty(base, "mod") !== undefined) {
    setIfExists(`abilities.${abil}.mod`, mod);
  } else if (foundry.utils.getProperty(base, "value") !== undefined) {
    setIfExists(`abilities.${abil}.value`, mod);
  }
}

export function mapSizeToPf2e(raw: string | null): string | null {
  const v = normalizeBlank(raw);
  if (!v) return null;
  const s = v.trim().toLowerCase();
  if (["tiny", "sm", "med", "lg", "huge", "grg"].includes(s)) return s;
  const map: Record<string, string> = {
    tiny: "tiny",
    small: "sm",
    medium: "med",
    large: "lg",
    huge: "huge",
    gargantuan: "grg",
  };
  return map[s] ?? null;
}

function applyActorTraits(
  updates: Record<string, unknown>,
  sys: any,
  npc: NormalizedNpc,
): void {
  const traitsObj = foundry.utils.getProperty(sys, "traits") as any;
  if (!traitsObj || typeof traitsObj !== "object") return;

  const existing = foundry.utils.getProperty(sys, "traits.value");
  if (npc.creatureType && Array.isArray(existing)) {
    updates["system.traits.value"] = Array.from(
      new Set([...(existing as string[]), slugifyTrait(npc.creatureType)]),
    );
  }

  const addCustom = (label: string) => {
    const other = foundry.utils.getProperty(sys, "traits.otherTags");
    if (Array.isArray(other)) {
      updates["system.traits.otherTags"] = Array.from(new Set([...(other as string[]), label]));
      return;
    }
    const custom = foundry.utils.getProperty(sys, "traits.custom");
    if (typeof custom === "string") {
      const parts = custom
        .split(/[,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      updates["system.traits.custom"] = Array.from(new Set([...parts, label])).join(", ");
    }
  };

  for (const t of npc.customTraits ?? []) {
    const v = normalizeBlank(t);
    if (v) addCustom(v);
  }
}

function applyRarity(updates: Record<string, unknown>, sys: any, rarity: string | null): void {
  const r = normalizeBlank(rarity);
  if (!r) return;
  if (foundry.utils.getProperty(sys, "traits.rarity.value") !== undefined) {
    updates["system.traits.rarity.value"] = r;
  } else if (foundry.utils.getProperty(sys, "traits.rarity") !== undefined) {
    updates["system.traits.rarity"] = r;
  }
}

function applyActorDescription(
  updates: Record<string, unknown>,
  sys: any,
  npc: NormalizedNpc,
): void {
  const desc = normalizeBlank(npc.description);
  if (!desc) return;
  const html = toHtml(desc);

  for (const rel of [
    "details.publicNotes",
    "details.biography.value",
    "details.biography",
    "details.description",
  ]) {
    const cur = foundry.utils.getProperty(sys, rel);
    if (cur !== undefined) {
      updates[`system.${rel}`] = html;
      return;
    }
  }
}

// IWR applicator (schema-probed)
type IwrWithValue = { type: string; value: number; exceptions?: string };
type IwrNoValue = { type: string; exceptions?: string };

function applyIwr(
  updates: Record<string, unknown>,
  sys: any,
  relativePath: string,
  entries: Array<IwrWithValue | IwrNoValue>,
): void {
  if (!entries.length) return;
  const existing = foundry.utils.getProperty(sys, relativePath);
  if (existing === undefined) return;

  const buildArrayEntry = (base: any, e: any): any => {
    const next: any = base && typeof base === "object" ? { ...base } : {};
    next.type = e.type;
    if ("value" in e) next.value = e.value;
    if (e.exceptions !== undefined) next.exceptions = e.exceptions;
    return next;
  };

  if (Array.isArray(existing)) {
    const base = existing.find((v) => v && typeof v === "object") ?? {};
    updates[`system.${relativePath}`] = entries.map((e) => buildArrayEntry(base, e));
    return;
  }

  if (existing && typeof existing === "object" && Array.isArray((existing as any).value)) {
    const base = ((existing as any).value as any[]).find((v) => v && typeof v === "object") ?? {};
    updates[`system.${relativePath}.value`] = entries.map((e) => buildArrayEntry(base, e));
    return;
  }

  if (existing && typeof existing === "object") {
    const obj = existing as Record<string, any>;
    const sample = Object.values(obj).find((v) => v !== undefined);
    const next: any = { ...obj };

    if (typeof sample === "number") {
      for (const e of entries) next[e.type] = "value" in e ? (e as any).value : 1;
      updates[`system.${relativePath}`] = next;
      return;
    }
    if (sample && typeof sample === "object") {
      for (const e of entries) next[e.type] = buildArrayEntry(sample, e);
      updates[`system.${relativePath}`] = next;
    }
  }
}
