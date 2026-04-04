import type { WizardResult } from "../ui/wizard-dialog";
import CONCEPTS from "../data/concepts.json";
import {
  getAc,
  getHp,
  getPerception,
  getSave,
  getSkill,
  getAttackBonus,
  getDamageFormula,
  getSpellAttack,
  getSpellDc,
  getAbilityMod,
  rankFromUi,
} from "../data/creature-numbers";
import { deepClone } from "../utils";

const MODULE_ID = "lazybobcat-generic-content";

interface Concept {
  id: string;
  localizationKey: string;
  group: string;
  stats: {
    ac: string | null;
    hp: string | null;
    attack: string | null;
    damage: string | null;
    perception: string | null;
    fortitude: string | null;
    reflex: string | null;
    will: string | null;
    skill: string | null;
    spellAttack: string | null;
    spellDc: string | null;
  };
  abilities: {
    str: string;
    dex: string;
    con: string;
    int: string;
    wis: string;
    cha: string;
  };
  strikes: Array<{
    name: string;
    type: "melee" | "ranged";
    bonusRank: string;
    damageRank: string;
    damageType: string;
  }>;
  spellcasting: {
    tradition: string;
    preparation: string;
    /** Number, or "dynamic" = ceil(level/2) - 1 (minimum 1) */
    maxSpellLevel: number | "dynamic";
  } | null;
}

export async function generateNpc(result: WizardResult): Promise<void> {
  if ((game as any)?.system?.id !== "pf2e") {
    ui.notifications?.error("LGC.NpcWizard.Pf2eRequired");
    return;
  }

  const concept = CONCEPTS.find((c) => c.id === result.conceptId) as Concept | undefined;
  if (!concept) {
    ui.notifications?.error("Unknown concept: " + result.conceptId);
    return;
  }

  const level = result.level;
  const tblLevel = Math.max(-1, Math.min(24, level));
  const img = result.img || "icons/svg/mystery-man.svg";

  const actor = await createActor(result.name, level, img);
  if (!actor) return;

  const hpRank = rankFromUi(concept.stats.hp ?? "") ?? "moderate";
  await applyStats(actor, level, concept, result);

  // Finalize HP last — PF2e may clamp hp.value when max and value are updated
  // together in the same call, so two sequential updates ensure value is set correctly.
  await finalizeHp(actor, getHp(tblLevel, hpRank) ?? 0);

  if (result.tier >= 2) {
    const journal = await createJournal(result, actor, concept);
    if (journal) {
      await (actor as any).setFlag(MODULE_ID, "journalUuid", journal.uuid);
      await (journal as any).setFlag(MODULE_ID, "actorUuid", actor.uuid);
      journal.sheet?.render(true);
    }
  }

  actor.sheet?.render(true);
  ui.notifications?.info((game.i18n?.localize("LGC.NpcWizard.ActorCreated") ?? "Created NPC: {name}").replace("{name}", actor.name));
}

async function finalizeHp(actor: Actor, hp: number): Promise<void> {
  if (!hp) return;
  try {
    // Two separate updates: PF2e may clamp value = min(old_value, new_max) during
    // preUpdateActor hooks, so setting both in one call can leave value at the old default.
    await actor.update({ "system.attributes.hp.max": hp });
    await actor.update({ "system.attributes.hp.value": hp });
  } catch (err) {
    console.error("LGC | Failed to finalize HP", err, { actor: actor?.name, hp });
  }
}

async function createActor(name: string, level: number, img: string): Promise<Actor | null> {
  try {
    return (await Actor.create({
      name,
      type: "npc",
      img,
    } as any)) as Actor;
  } catch (err) {
    console.error("LGC | Actor creation failed", err);
    ui.notifications?.error("Failed to create actor");
    return null;
  }
}

async function applyStats(
  actor: Actor,
  level: number,
  concept: Concept,
  result: WizardResult,
): Promise<void> {
  const sys = (actor as any).system;
  if (!sys) return;

  const updates: Record<string, unknown> = {};

  const setIf = (path: string, value: unknown) => {
    if (value === null || value === undefined) return;
    const cur = foundry.utils.getProperty(sys, path);
    if (cur === undefined) return;
    updates[`system.${path}`] = value;
  };

  const rank = (r: string | null) => (r ? rankFromUi(r) : null);
  // Clamp to the range covered by the creature-building tables (-1..24).
  // The actor keeps its real level; stats are derived from the nearest valid level.
  const tblLevel = Math.max(-1, Math.min(24, level));

  setIf("details.level.value", level);

  if (result.traits.length > 0) {
    const existing = foundry.utils.getProperty(sys, "traits.value") as string[] | undefined;
    if (Array.isArray(existing)) {
      updates["system.traits.value"] = Array.from(new Set([...existing, ...result.traits]));
    }
  }

  const ac = getAc(tblLevel, rank(concept.stats.ac) ?? "moderate");
  setIf("attributes.ac.value", ac);

  // HP is applied last via finalizeHp() to avoid PF2e clamping hp.value prematurely.

  const perc = getPerception(tblLevel, rank(concept.stats.perception) ?? "moderate");
  setIf("perception.mod", perc);

  setIf("saves.fortitude.value", getSave("fortitude", tblLevel, rank(concept.stats.fortitude) ?? "moderate"));
  setIf("saves.reflex.value", getSave("reflex", tblLevel, rank(concept.stats.reflex) ?? "moderate"));
  setIf("saves.will.value", getSave("will", tblLevel, rank(concept.stats.will) ?? "moderate"));

  // Per-ability modifiers from the concept's abilities definition
  for (const [abil, abilRank] of Object.entries(concept.abilities) as [string, string][]) {
    const mod = getAbilityMod(tblLevel, rank(abilRank) ?? "moderate");
    if (mod === null) continue;
    const base = foundry.utils.getProperty(sys, `abilities.${abil}`) as any;
    if (!base || typeof base !== "object") continue;
    if (foundry.utils.getProperty(base, "mod") !== undefined) {
      updates[`system.abilities.${abil}.mod`] = mod;
    } else if (foundry.utils.getProperty(base, "value") !== undefined) {
      updates[`system.abilities.${abil}.value`] = mod;
    }
  }

  applySkills(updates, sys, tblLevel, concept, result);

  if (Object.keys(updates).length) {
    try {
      await actor.update(updates);
    } catch (err) {
      console.error("LGC | Actor update failed", err);
    }
  }

  await createStrikes(actor, tblLevel, concept);

  if (concept.spellcasting) {
    await createSpellcastingEntry(actor, tblLevel, concept);
  }
}

function applySkills(
  updates: Record<string, unknown>,
  sys: any,
  level: number,
  concept: Concept,
  result: WizardResult,
): void {
  const skillsObj = foundry.utils.getProperty(sys, "skills") as Record<string, any> | undefined;
  if (!skillsObj || typeof skillsObj !== "object") return;

  const skillPaths = ["mod", "mod.value", "value", "modifier", "totalModifier"];

  for (const row of result.skills) {
    const skillKey = normalizeSkillKey(row.skill);
    const base = skillsObj[skillKey];
    if (!base || typeof base !== "object") continue;

    const r = rankFromUi(row.rank) ?? "moderate";
    const mod = getSkill(level, r);
    if (mod === null) continue;

    for (const suffix of skillPaths) {
      const rel = `skills.${skillKey}.${suffix}`;
      const cur = foundry.utils.getProperty(sys, rel);
      if (cur !== undefined) {
        updates[`system.${rel}`] = mod;
        break;
      }
    }
  }
}

function normalizeSkillKey(display: string): string {
  return display.toLowerCase().replace(/\s+/g, "");
}


async function createStrikes(
  actor: Actor,
  level: number,
  concept: Concept,
): Promise<void> {
  for (const s of concept.strikes) {
    const model = deepClone((game as any).system?.model?.Item?.melee) ?? {};
    const data: any = {
      name: s.name,
      type: "melee",
      system: model,
    };

    if (!data.system.description) data.system.description = { value: "" };
    if (!data.system.traits) data.system.traits = { value: [] };

    const bonus = getAttackBonus(level, rankFromUi(s.bonusRank) ?? "moderate");
    const dmgFormula = getDamageFormula(level, rankFromUi(s.damageRank) ?? "moderate");

    if (bonus !== null) {
      setFirstExisting(data.system, ["bonus.value", "bonus", "attack.value"], bonus, { allowCreate: true });
      if (typeof data.system.bonus === "number") data.system.bonus = { value: data.system.bonus };
      if (data.system.bonus && typeof data.system.bonus === "object" && data.system.bonus.value === undefined) {
        data.system.bonus.value = bonus;
      }
    }

    if (dmgFormula !== null) {
      const dmgKey = foundry.utils.randomID();
      data.system.damageRolls = data.system.damageRolls || {};
      data.system.damageRolls[dmgKey] = {
        damage: dmgFormula,
        damageType: s.damageType,
      };
    }

    const descParts: string[] = [];
    descParts.push(`<p><strong>Type</strong> ${s.type === "ranged" ? "Ranged" : "Melee"}</p>`);
    if (bonus !== null) descParts.push(`<p><strong>Attack</strong> +${bonus}</p>`);
    if (dmgFormula !== null) descParts.push(`<p><strong>Damage</strong> ${dmgFormula} ${s.damageType}</p>`);
    data.system.description.value = descParts.join("\n");

    try {
      await actor.createEmbeddedDocuments("Item", [data]);
    } catch (err) {
      console.error("LGC | Strike creation failed", err, { strike: s.name });
    }
  }
}

async function createSpellcastingEntry(
  actor: Actor,
  level: number,
  concept: Concept,
): Promise<void> {
  const sc = concept.spellcasting;
  if (!sc) return;

  const model = deepClone((game as any).system?.model?.Item?.spellcastingEntry) ?? {};
  const data: any = {
    name: `${actor.name} Spellcasting`,
    type: "spellcastingEntry",
    system: model,
  };

  setFirstExisting(data.system, ["tradition.value", "tradition"], sc.tradition, { allowCreate: true });
  setFirstExisting(data.system, ["preparation.value", "preparation"], sc.preparation, { allowCreate: true });
  setFirstExisting(data.system, ["prepared.value", "prepared"], sc.preparation, { allowCreate: true });

  const [entry] = (await actor.createEmbeddedDocuments("Item", [data])) as any[];
  if (!entry) return;

  try {
    const entrySys = (entry as any).system;
    const upd: Record<string, unknown> = {};

    const spAtkRank = concept.stats.spellAttack ? rankFromUi(concept.stats.spellAttack) : null;
    const spDcRank = concept.stats.spellDc ? rankFromUi(concept.stats.spellDc) : null;
    const spAtk = getSpellAttack(level, spAtkRank ?? "moderate");
    const spDc = getSpellDc(level, spDcRank ?? "moderate");

    if (spAtk !== null) {
      if (foundry.utils.getProperty(entrySys, "spelldc.value") !== undefined) upd["system.spelldc.value"] = spAtk;
      if (foundry.utils.getProperty(entrySys, "attack.value") !== undefined) upd["system.attack.value"] = spAtk;
    }
    if (spDc !== null) {
      if (foundry.utils.getProperty(entrySys, "spelldc.dc") !== undefined) upd["system.spelldc.dc"] = spDc;
      if (foundry.utils.getProperty(entrySys, "dc.value") !== undefined) upd["system.dc.value"] = spDc;
    }

    const maxSL = sc.maxSpellLevel === "dynamic"
      ? Math.max(1, Math.ceil(level / 2) - 1)
      : sc.maxSpellLevel;

    if (sc.preparation === "prepared" || sc.preparation === "spontaneous") {
      const slots = foundry.utils.getProperty(entrySys, "slots") as any;
      if (slots && typeof slots === "object") {
        for (let lvl = 1; lvl <= maxSL; lvl++) {
          const key = `slot${lvl}`;
          const slot = slots[key];
          if (!slot || typeof slot !== "object") continue;
          if (slot.max !== undefined) upd[`system.slots.${key}.max`] = 1;
          if (slot.value !== undefined) upd[`system.slots.${key}.value`] = 0;
          if (sc.preparation === "prepared" && Array.isArray(slot.prepared)) {
            upd[`system.slots.${key}.prepared`] = [];
          }
        }
        for (let lvl = maxSL + 1; lvl <= 10; lvl++) {
          const key = `slot${lvl}`;
          const slot = slots[key];
          if (slot && typeof slot === "object" && slot.max !== undefined) {
            upd[`system.slots.${key}.max`] = 0;
          }
        }
      }
    }

    if (Object.keys(upd).length) {
      await (entry as any).update(upd);
    }
  } catch (err) {
    console.error("LGC | Spellcasting entry setup failed", err);
  }
}

function setFirstExisting(
  target: any,
  paths: string[],
  value: unknown,
  options?: { allowCreate?: boolean },
): boolean {
  for (const p of paths) {
    const cur = foundry.utils.getProperty(target, p);
    if (cur !== undefined) {
      foundry.utils.setProperty(target, p, value);
      return true;
    }
  }
  if (options?.allowCreate && paths.length) {
    foundry.utils.setProperty(target, paths[0], value);
    return true;
  }
  return false;
}

async function createJournal(
  result: WizardResult,
  actor: Actor,
  concept: Concept,
): Promise<JournalEntry | null> {
  const t = (k: string) => game.i18n?.localize(k) ?? k;
  const conceptLabel = game.i18n?.localize(concept.localizationKey) ?? concept.id;

  const pages: any[] = [];

  const npcBlock = buildNpcBlock(result.name, conceptLabel, result.traits, actor);
  const influenceBlock = result.tier === 3 ? buildInfluenceBlock(result, actor) : "";
  const actorLink = actor?.uuid
    ? `<p>@UUID[${escapeHtml(actor.uuid)}]{${escapeHtml(actor.name)}}</p>`
    : "";

  const page1Content = [npcBlock, influenceBlock, actorLink].filter(Boolean).join("\n<hr />\n");

  pages.push({
    name: result.name,
    type: "text",
    text: {
      format: (CONST as any).JOURNAL_ENTRY_PAGE_FORMATS?.HTML ?? 1,
      content: page1Content,
    },
  });

  if (result.img && result.img !== "icons/svg/mystery-man.svg") {
    pages.push({
      name: "Image",
      type: "image",
      src: result.img,
    });
  }

  try {
    return (await JournalEntry.create({
      name: result.name,
      pages,
    } as any)) as JournalEntry;
  } catch (err) {
    console.error("LGC | Journal creation failed", err);
    ui.notifications?.warn(t("LGC.NpcWizard.ActorCreatedButJournal"));
    return null;
  }
}

function buildNpcBlock(name: string, concept: string, traits: string[], actor: Actor): string {
  const t = (k: string) => game.i18n?.localize(k) ?? k;
  const ancestryLabel = traits.map((slug) => slug.charAt(0).toUpperCase() + slug.slice(1)).join(", ") || "-";

  return [
    '<div class="lgc-box-text simple-npc">',
    '  <div class="simple-npc__description">',
    `    <h2>${t("LGC.NpcWizard.Journal.Appearance")}</h2>`,
    "    <p>TODO</p>",
    `    <h2>${t("LGC.NpcWizard.Journal.Information")}</h2>`,
    "    <p>TODO</p>",
    "  </div>",
    '  <div class="simple-npc__attributes">',
    "    <section>",
    "      <div>",
    `        <p><strong>${t("LGC.NpcWizard.Journal.Ancestry")}</strong> <span>${escapeHtml(ancestryLabel)}</span></p>`,
    "      </div>",
    "      <div>",
    `        <p><strong>${t("LGC.NpcWizard.Journal.Status")}</strong> <span>TODO</span></p>`,
    "      </div>",
    "    </section>",
    "  </div>",
    "</div>",
  ].join("\n");
}

function buildInfluenceBlock(result: WizardResult, actor: Actor): string {
  const t = (k: string) => game.i18n?.localize(k) ?? k;

  // Creature traits: from result + size + rarity
  const traitLabels: string[] = [];
  const creatureTraits = foundry.utils.getProperty((actor as any).system, "traits.value") as string[] | undefined;
  if (Array.isArray(creatureTraits)) {
    for (const slug of creatureTraits) {
      traitLabels.push(slug.charAt(0).toUpperCase() + slug.slice(1));
    }
  }
  const size = (actor as any).system?.traits?.size?.value;
  if (size) traitLabels.push(sizeCodeToLabel(size));
  const rarity = (actor as any).system?.traits?.rarity?.value;
  if (rarity && rarity !== "common") traitLabels.push(rarity);

  const perception = (actor as any).system?.perception?.mod;
  const will = (actor as any).system?.saves?.will?.value;

  const thresholds = result.thresholds
    .map((th) => `    <p><strong>${t("LGC.NpcWizard.Journal.InfluenceAt")} ${th.number}</strong> ${escapeHtml(th.description)}</p>`)
    .join("\n");

  return [
    '<div class="lgc-box-text statblock-influence">',
    `  <h4 class="statblock-influence__name">${escapeHtml(result.name)}</h4>`,
    '  <section class="statblock-influence__content">',
    '    <section class="traits">',
    ...traitLabels.map((label) => `      <p>${escapeHtml(label)}</p>`),
    "    </section>",
    `    <p><strong>${t("LGC.NpcWizard.Journal.Perception")}</strong> ${perception !== undefined ? `+${perception}` : "TODO"}</p>`,
    `    <p><strong>${t("LGC.NpcWizard.Journal.Will")}</strong> ${will !== undefined ? `+${will}` : "TODO"}</p>`,
    "    <hr>",
    `    <p><strong>${t("LGC.NpcWizard.Journal.Background")}</strong> TODO</p>`,
    `    <p><strong>${t("LGC.NpcWizard.Journal.Appearance")}</strong> TODO</p>`,
    `    <p><strong>${t("LGC.NpcWizard.Journal.Personality")}</strong> TODO</p>`,
    `    <p><strong>${t("LGC.NpcWizard.Journal.DistinctiveFeature")}</strong> TODO</p>`,
    "    <hr>",
    `    <p><strong>${t("LGC.NpcWizard.Journal.Discovery")}</strong> TODO</p>`,
    `    <p><strong>${t("LGC.NpcWizard.Journal.InfluenceSkills")}</strong> TODO</p>`,
    thresholds || `    <p><strong>${t("LGC.NpcWizard.Journal.InfluenceAt")} ?</strong> TODO</p>`,
    `    <p><strong>${t("LGC.NpcWizard.Journal.Resistances")}</strong> TODO</p>`,
    `    <p><strong>${t("LGC.NpcWizard.Journal.Weaknesses")}</strong> TODO</p>`,
    "  </section>",
    "</div>",
  ].join("\n");
}

function sizeCodeToLabel(code: string): string {
  const map: Record<string, string> = {
    tiny: "Tiny", sm: "Small", med: "Medium", lg: "Large", huge: "Huge", grg: "Gargantuan",
  };
  return map[code] ?? code;
}

function formatSensesFromActor(actor: Actor): string {
  const senses = foundry.utils.getProperty((actor as any).system, "perception.senses") as any;
  const details = foundry.utils.getProperty((actor as any).system, "perception.details");
  const parts: string[] = [];
  if (Array.isArray(senses)) {
    for (const s of senses) {
      const label = (s && typeof s === "object") ? (s.label ?? s.type) : s;
      if (typeof label === "string" && label.trim()) {
        parts.push(game.i18n?.localize(label) ?? label);
      }
    }
  }
  if (typeof details === "string" && details.trim()) parts.push(details.trim());
  return parts.join(", ") || "-";
}

function formatLanguagesFromActor(actor: Actor): string {
  const sys = (actor as any).system;
  if (!sys) return "-";
  const langs = foundry.utils.getProperty(sys, "details.languages.value") as any;
  const custom = foundry.utils.getProperty(sys, "details.languages.custom");
  const parts: string[] = [];
  if (Array.isArray(langs)) {
    for (const slug of langs) {
      if (typeof slug !== "string" || !slug.trim()) continue;
      const cfg = (globalThis as any).CONFIG?.PF2E?.languages?.[slug];
      const label = typeof cfg === "string" ? cfg : slug;
      parts.push(game.i18n?.localize(label) ?? label);
    }
  }
  if (typeof custom === "string" && custom.trim()) parts.push(custom.trim());
  return parts.join(", ") || "-";
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
