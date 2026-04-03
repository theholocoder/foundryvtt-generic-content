type JSONObject = Record<string, unknown>;

type NormalizedStrike = {
  name: string;
  kind: "melee" | "ranged";
  traits: string[];
  attack: number | null;
  damageRaw: string | null;
  damageParsed: {
    formula: string | null;
    damageType: string | null;
    note: string | null;
  };
};

type NormalizedSpecial = {
  name: string;
  traits: string[];
  actions: string | null;
  descriptionRaw: string;
  descriptionHtml: string;
};

type NormalizedNpc = {
  name: string;
  level: number | null;
  alignment: string | null;
  size: string | null;
  creatureType: string | null;
  ancestryLike: string | null;
  img: string | null;
  description: string | null;
  info: string | null;
  speedRaw: string | null;
  languagesRaw: string | null;
  sensesRaw: string | null;
  ac: number | null;
  hp: number | null;
  perception: number | null;
  saves: {
    fortitude: number | null;
    reflex: number | null;
    will: number | null;
  };
  abilities: {
    str: number | null;
    dex: number | null;
    con: number | null;
    int: number | null;
    wis: number | null;
    cha: number | null;
  };
  skills: Record<string, number>; // legacy slugs if they match
  skillsRaw: Record<string, number>; // pf2.tools keys (intimidation, nature, ...)
  resistancesRaw: string | null;
  weaknessesRaw: string | null;
  immunitiesRaw: string | null;
  strikes: NormalizedStrike[];
  specials: NormalizedSpecial[];
  spellcasting: {
    tradition: "occult" | "arcane" | "divine" | "primal" | null;
    preparation:
      | "innate"
      | "prepared"
      | "spontaneous"
      | "focus"
      | "ritual"
      | null;
    spellAttack: number | null;
    spellDc: number | null;
    focusPoints: number | null;
    cantripLevel: number | null;
    spellsByLevel: Array<{ level: number; names: string[] }>;
  };
  raw: unknown;
};

const MODULE_ID = "lazybobcat-generic-content";
const BTN_ID = "lgc-import-npc-json";

export function registerNpcImporter(): void {
  Hooks.on("renderActorDirectory" as any, (_app: any, html: any) => {
    try {
      const $html = toJQuery(html);
      if (!$html?.length) return;
      if ($html.find(`#${BTN_ID}`).length) return;

      const footer = $html.find(".directory-footer");
      if (!footer.length) return;

      const btn = $(
        `<button type="button" id="${BTN_ID}" class="lgc-btn-import-npc">
          <i class="fa-solid fa-file-import"></i>
          Import NPC JSON
        </button>`,
      );

      btn.on("click", () => openNpcImportDialog());
      footer.append(btn);
    } catch (err) {
      console.error("LGC | Failed to inject NPC import button", err);
    }
  });
}

function openNpcImportDialog(): void {
  const content = [
    '<form class="lgc-npc-import">',
    "  <div class=\"form-group\">",
    "    <label>pf2.tools JSON</label>",
    "    <textarea name=\"npcJson\" rows=\"18\" style=\"font-family: monospace;\" placeholder=\"Paste JSON here\"></textarea>",
    "  </div>",
    "  <hr>",
    "  <div class=\"form-group\">",
    "    <label>",
    "      <input type=\"checkbox\" name=\"createJournal\" checked>",
    "      Create journal entry",
    "    </label>",
    "  </div>",
    "  <div class=\"form-group\">",
    "    <label>",
    "      <input type=\"checkbox\" name=\"createInfluence\">",
    "      Add influence statblock",
    "    </label>",
    "  </div>",
    "</form>",
  ].join("\n");

  const dlg = new Dialog({
    title: "Import NPC (pf2.tools JSON)",
    content,
    buttons: {
      create: {
        icon: '<i class="fa-solid fa-wand-magic-sparkles"></i>',
        label: "Create",
        callback: async (html: any) => {
          const $html = toJQuery(html);
          const raw = String($html.find("textarea[name=npcJson]").val() ?? "").trim();
          const createJournal = Boolean(
            $html.find("input[name=createJournal]").prop("checked"),
          );
          const createInfluence =
            createJournal &&
            Boolean($html.find("input[name=createInfluence]").prop("checked"));
          await importNpcFromJson(raw, { createJournal, createInfluence });
        },
      },
      cancel: {
        icon: '<i class="fa-solid fa-xmark"></i>',
        label: "Cancel",
      },
    },
    default: "create",
    render: (html: any) => {
      const $html = toJQuery(html);
      const $createJournal = $html.find("input[name=createJournal]");
      const $createInfluence = $html.find("input[name=createInfluence]");

      const sync = () => {
        const enabled = Boolean($createJournal.prop("checked"));
        $createInfluence.prop("disabled", !enabled);
        if (!enabled) $createInfluence.prop("checked", false);
      };

      $createJournal.on("change", sync);
      sync();
    },
  });

  dlg.render(true);
}

function toJQuery(html: unknown): JQuery {
  // Foundry hook callbacks vary between Application (jQuery) and ApplicationV2 (HTMLElement).
  if ((globalThis as any).jQuery && html instanceof (globalThis as any).jQuery) {
    return html as JQuery;
  }
  return $(html as any);
}

async function importNpcFromJson(
  rawJson: string,
  options: { createJournal: boolean; createInfluence: boolean },
): Promise<void> {
  if (!rawJson) {
    ui.notifications?.error("LGC | Paste JSON first");
    return;
  }

  if ((game as any)?.system?.id !== "pf2e") {
    ui.notifications?.error("LGC | PF2e system required to import NPCs");
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    console.error("LGC | Invalid JSON", err);
    ui.notifications?.error("LGC | Invalid JSON");
    return;
  }

  let npc: NormalizedNpc;
  try {
    npc = normalizePf2ToolsNpc(parsed);
  } catch (err) {
    console.error("LGC | JSON normalization failed", err, { parsed });
    ui.notifications?.error("LGC | Unsupported JSON shape (see console)");
    return;
  }

  if (!npc.name) {
    ui.notifications?.error("LGC | JSON missing required field: name");
    return;
  }

  const created = await createPf2eNpcActor(npc);
  if (!created) return;

  const { actor } = created;

  if (options.createJournal) {
    const journal = await createNpcJournal(npc, actor, {
      createInfluence: options.createInfluence,
    });
    if (journal) {
      await (actor as any).setFlag(MODULE_ID, "journalUuid", journal.uuid);
      await (journal as any).setFlag(MODULE_ID, "actorUuid", actor.uuid);
      journal.sheet?.render(true);
    }
  }

  actor.sheet?.render(true);
  ui.notifications?.info(`LGC | Created NPC: ${actor.name}`);
}

function normalizePf2ToolsNpc(raw: unknown): NormalizedNpc {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Expected object JSON");
  }
  const o = raw as JSONObject;

  const name = asNonEmptyString(o.name) ?? "";
  const level = asNumber(o.level);
  const alignment = normalizeBlank(asNonEmptyString(o.alignment));
  const size = mapSizeToPf2e(normalizeBlank(asNonEmptyString(o.size)));
  const creatureType = normalizeBlank(asNonEmptyString(o.type));
  const ancestryLike = normalizeBlank(asNonEmptyString(o.traits));
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
  const rawStrikes = o.strikes;
  if (Array.isArray(rawStrikes)) {
    for (const s of rawStrikes) {
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
  const rawSpecials = o.specials;
  if (Array.isArray(rawSpecials)) {
    for (const sp of rawSpecials) {
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

  // Default decision: occult/innate when spells present.
  const hasAnySpells = spellsByLevel.some((g) => g.names.length);
  const tradition: NormalizedNpc["spellcasting"]["tradition"] = hasAnySpells
    ? "occult"
    : null;
  const preparation: NormalizedNpc["spellcasting"]["preparation"] = hasAnySpells
    ? "innate"
    : null;

  return {
    name,
    level: typeof level === "number" ? level : null,
    alignment,
    size,
    creatureType,
    ancestryLike,
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

async function createPf2eNpcActor(
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

  const sys: any = (actor as any).system;
  if (!sys) return { actor };

  const updates: Record<string, unknown> = {};
  const setIfExists = (relativePath: string, value: unknown) => {
    if (value === null || value === undefined) return;
    const cur = foundry.utils.getProperty(sys, relativePath);
    if (cur === undefined) return;
    updates[`system.${relativePath}`] = value;
  };

  setIfExists("details.level.value", npc.level);
  setIfExists("traits.size.value", npc.size);

  // Traits: set creature type into system trait list if present.
  applyActorTraits(updates, sys, npc);

  // Speed
  applySpeed(updates, sys, npc.speedRaw);

  // Senses + languages
  applySenses(updates, sys, npc.sensesRaw);
  applyLanguages(updates, sys, npc.languagesRaw);

  // Actor description (HTML)
  applyActorDescription(updates, sys, npc);

  setAbilityMod(setIfExists, sys, "str", npc.abilities.str);
  setAbilityMod(setIfExists, sys, "dex", npc.abilities.dex);
  setAbilityMod(setIfExists, sys, "con", npc.abilities.con);
  setAbilityMod(setIfExists, sys, "int", npc.abilities.int);
  setAbilityMod(setIfExists, sys, "wis", npc.abilities.wis);
  setAbilityMod(setIfExists, sys, "cha", npc.abilities.cha);

  setIfExists("attributes.ac.value", npc.ac);

  // HP: try multiple shapes; ensure value == max.
  if (npc.hp !== null) {
    const hpObj = foundry.utils.getProperty(sys, "attributes.hp") as any;
    if (hpObj && typeof hpObj === "object") {
      const next: any = { ...hpObj };
      if (hpObj.max !== undefined) next.max = npc.hp;
      if (hpObj.value !== undefined) next.value = npc.hp;
      if (hpObj.temp !== undefined && typeof hpObj.temp !== "number") next.temp = 0;
      updates["system.attributes.hp"] = next;
    }
    // Also try direct keys, if present
    if (foundry.utils.getProperty(sys, "attributes.hp.max") !== undefined) {
      updates["system.attributes.hp.max"] = npc.hp;
    }
    if (foundry.utils.getProperty(sys, "attributes.hp.value") !== undefined) {
      updates["system.attributes.hp.value"] = npc.hp;
    }
  }

  setIfExists("perception.mod", npc.perception);
  setIfExists("saves.fortitude.value", npc.saves.fortitude);
  setIfExists("saves.reflex.value", npc.saves.reflex);
  setIfExists("saves.will.value", npc.saves.will);

  // Resistances / weaknesses / immunities
  applyIwr(updates, sys, "attributes.resistances", parseIwrWithValues(npc.resistancesRaw));
  applyIwr(updates, sys, "attributes.weaknesses", parseIwrWithValues(npc.weaknessesRaw));
  applyIwr(updates, sys, "attributes.immunities", parseIwrNoValues(npc.immunitiesRaw));

  // Skills: map pf2.tools skill keys onto PF2e skills object.
  const skillsObj = foundry.utils.getProperty(sys, "skills") as
    | Record<string, unknown>
    | undefined;
  if (skillsObj && typeof skillsObj === "object") {
    const index = indexActorSkills(skillsObj as any);
    for (const [rawKey, mod] of Object.entries(npc.skillsRaw)) {
      const skillKey = index.get(normalizeKey(rawKey));
      if (!skillKey) continue;
      const base = (skillsObj as any)[skillKey];
      if (!base || typeof base !== "object") continue;

      const possible = [
        `system.skills.${skillKey}.mod`,
        `system.skills.${skillKey}.mod.value`,
        `system.skills.${skillKey}.value`,
        `system.skills.${skillKey}.modifier`,
        `system.skills.${skillKey}.totalModifier`,
      ];
      for (const p of possible) {
        const rel = p.replace(/^system\./, "");
        const cur = foundry.utils.getProperty(sys, rel);
        if (cur !== undefined) {
          updates[p] = mod;
          break;
        }
      }
    }
  }

  if (Object.keys(updates).length) {
    try {
      await actor.update(updates);
    } catch (err) {
      console.error("LGC | Actor system update failed", err, { updates, npc });
      ui.notifications?.warn("LGC | Actor created but some fields not applied");
    }
  }

  // Embedded items: strikes + specials first
  const items = buildEmbeddedItems(npc);
  if (items.length) {
    try {
      await actor.createEmbeddedDocuments("Item", items);
    } catch (err) {
      console.error("LGC | Embedded item creation failed", err, { items, npc });
      ui.notifications?.warn("LGC | Actor created but items failed (see console)");
    }
  }

  // Spellcasting entry + spells
  if (npc.spellcasting.spellsByLevel.some((g) => g.names.length)) {
    try {
      await createSpellcasting(actor, npc);
    } catch (err) {
      console.error("LGC | Spellcasting creation failed", err, { npc });
      ui.notifications?.warn("LGC | Actor created but spells failed (see console)");
    }
  }

  return { actor };
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

function mapSizeToPf2e(raw: string | null): string | null {
  const v = normalizeBlank(raw);
  if (!v) return null;
  const s = v.trim().toLowerCase();

  // Already PF2e-like codes
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

  const addSystemTrait = (slug: string) => {
    const existing = foundry.utils.getProperty(sys, "traits.value");
    if (!Array.isArray(existing)) return;
    const next = Array.from(new Set([...(existing as string[]), slug]));
    updates["system.traits.value"] = next;
  };

  const addCustomTrait = (label: string) => {
    // PF2e often stores custom traits in traits.otherTags (array of labels)
    const other = foundry.utils.getProperty(sys, "traits.otherTags");
    if (Array.isArray(other)) {
      const next = Array.from(new Set([...(other as string[]), label]));
      updates["system.traits.otherTags"] = next;
      return;
    }

    // Fallback: traits.custom (string)
    const custom = foundry.utils.getProperty(sys, "traits.custom");
    if (typeof custom === "string") {
      const parts = custom
        .split(/[,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const next = Array.from(new Set([...parts, label])).join(", ");
      updates["system.traits.custom"] = next;
    }
  };

  if (npc.creatureType) {
    addSystemTrait(slugifyTrait(npc.creatureType));
  }

  if (npc.ancestryLike) {
    // This might not exist in PF2e's trait dictionary; store as custom.
    addCustomTrait(npc.ancestryLike);
  }
}

type ParsedSpeed = {
  land: number | null;
  other: Array<{ type: "fly" | "swim" | "climb" | "burrow"; value: number }>;
};

function parseSpeed(raw: string | null): ParsedSpeed {
  const src = normalizeBlank(raw);
  if (!src) return { land: null, other: [] };

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

function applySpeed(
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

  // Fallback
  if (parsed.land !== null) {
    updates["system.attributes.speed.value"] = parsed.land;
  }
}

type ParsedLanguages = {
  known: string[];
  custom: string[];
};

function parseLanguages(raw: string | null): ParsedLanguages {
  const src = normalizeBlank(raw);
  if (!src) return { known: [], custom: [] };

  const parts = src
    .split(/[,;\n]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const known: string[] = [];
  const custom: string[] = [];

  for (const p of parts) {
    const slug = slugifyTrait(p);
    const mapped = mapLanguageSlug(slug);
    if (mapped) known.push(mapped);
    else custom.push(p);
  }

  return {
    known: Array.from(new Set(known)),
    custom: Array.from(new Set(custom)),
  };
}

function mapLanguageSlug(slug: string): string | null {
  if (!slug) return null;
  // Common PF2e language slugs
  if (slug === "common") return "common";
  if (slug === "elvish" || slug === "elven") return "elven";
  if (slug === "dwarvish" || slug === "dwarven") return "dwarven";
  if (slug === "gnomish") return "gnomish";
  if (slug === "goblin") return "goblin";
  if (slug === "halfling") return "halfling";
  if (slug === "orc") return "orc";
  if (slug === "draconic") return "draconic";
  return slug;
}

function applyLanguages(
  updates: Record<string, unknown>,
  sys: any,
  raw: string | null,
): void {
  const parsed = parseLanguages(raw);
  if (!parsed.known.length && !parsed.custom.length) return;

  const langObj = foundry.utils.getProperty(sys, "details.languages") as any;
  if (langObj && typeof langObj === "object") {
    const next: any = { ...langObj };
    if (Array.isArray(langObj.value)) next.value = parsed.known;
    if (typeof langObj.custom === "string" && parsed.custom.length) {
      next.custom = parsed.custom.join(", ");
    }
    updates["system.details.languages"] = next;
    return;
  }

  // Fallback direct
  if (foundry.utils.getProperty(sys, "details.languages.value") !== undefined) {
    updates["system.details.languages.value"] = parsed.known;
  }
  if (parsed.custom.length && foundry.utils.getProperty(sys, "details.languages.custom") !== undefined) {
    updates["system.details.languages.custom"] = parsed.custom.join(", ");
  }
}

type ParsedSenses = {
  slugs: string[];
  custom: string[];
  frLabels: string[];
};

function parseSenses(raw: string | null): ParsedSenses {
  const src = normalizeBlank(raw);
  if (!src) return { slugs: [], custom: [], frLabels: [] };

  const parts = src
    .split(/[,;\n]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const slugs: string[] = [];
  const custom: string[] = [];
  const frLabels: string[] = [];

  for (const p of parts) {
    const k = p.trim().toLowerCase();
    if (k === "darkvision") {
      slugs.push("darkvision");
      frLabels.push("vision dans le noir");
      continue;
    }
    if (k === "low-light" || k === "lowlight" || k === "low-light vision" || k === "low light") {
      slugs.push("lowLightVision");
      frLabels.push("vision en faible luminosite");
      continue;
    }

    custom.push(p);
  }

  return {
    slugs: Array.from(new Set(slugs)),
    custom: Array.from(new Set(custom)),
    frLabels: Array.from(new Set(frLabels)),
  };
}

function applySenses(
  updates: Record<string, unknown>,
  sys: any,
  raw: string | null,
): void {
  const parsed = parseSenses(raw);
  if (!parsed.slugs.length && !parsed.custom.length) return;

  const sensesObj = foundry.utils.getProperty(sys, "traits.senses") as any;
  if (sensesObj && typeof sensesObj === "object") {
    const next: any = { ...sensesObj };
    if (Array.isArray(sensesObj.value)) {
      // Only set if array is string-ish.
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
  if (parsed.custom.length && foundry.utils.getProperty(sys, "traits.senses.custom") !== undefined) {
    updates["system.traits.senses.custom"] = parsed.custom.join(", ");
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

  const candidates = [
    "details.publicNotes",
    "details.biography.value",
    "details.biography",
    "details.description",
  ];

  for (const rel of candidates) {
    const cur = foundry.utils.getProperty(sys, rel);
    if (cur !== undefined) {
      updates[`system.${rel}`] = html;
      return;
    }
  }
}

type IwrWithValue = { type: string; value: number; exceptions?: string };
type IwrNoValue = { type: string; exceptions?: string };

function parseIwrWithValues(raw: string | null): IwrWithValue[] {
  const src = normalizeBlank(raw);
  if (!src) return [];
  const parts = src
    .split(/[\n,;]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const out: IwrWithValue[] = [];
  for (const p of parts) {
    const m = p.match(/^([a-zA-Z\-\s]+?)\s+(\d+)\s*(?:\(([^)]+)\))?$/);
    if (!m) continue;
    out.push({
      type: slugifyTrait(m[1]),
      value: Number(m[2]),
      exceptions: normalizeBlank(m[3]?.trim() ?? null) ?? undefined,
    });
  }
  return out;
}

function parseIwrNoValues(raw: string | null): IwrNoValue[] {
  const src = normalizeBlank(raw);
  if (!src) return [];
  const parts = src
    .split(/[\n,;]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const out: IwrNoValue[] = [];
  for (const p of parts) {
    const m = p.match(/^([a-zA-Z\-\s]+?)\s*(?:\(([^)]+)\))?$/);
    if (!m) continue;
    out.push({
      type: slugifyTrait(m[1]),
      exceptions: normalizeBlank(m[2]?.trim() ?? null) ?? undefined,
    });
  }
  return out;
}

function applyIwr(
  updates: Record<string, unknown>,
  sys: any,
  relativePath: string,
  entries: Array<IwrWithValue | IwrNoValue>,
): void {
  if (!entries.length) return;

  const existing = foundry.utils.getProperty(sys, relativePath);
  if (existing === undefined) return;

  const setArray = (arr: any[], path: string) => {
    updates[`system.${path}`] = arr;
  };

  const buildArrayEntry = (
    base: any,
    e: IwrWithValue | IwrNoValue,
  ): any => {
    const next: any = base && typeof base === "object" ? { ...base } : {};
    next.type = (e as any).type;
    if ("value" in e) next.value = (e as IwrWithValue).value;
    if ((e as any).exceptions !== undefined) next.exceptions = (e as any).exceptions;
    return next;
  };

  // Case 1: direct array
  if (Array.isArray(existing)) {
    const base = existing.find((v) => v && typeof v === "object") ?? {};
    const next = entries.map((e) => buildArrayEntry(base, e));
    setArray(next, relativePath);
    return;
  }

  // Case 2: wrapper object with .value array
  if (existing && typeof existing === "object" && Array.isArray((existing as any).value)) {
    const base = ((existing as any).value as any[]).find(
      (v) => v && typeof v === "object",
    ) ?? {};
    const nextValue = entries.map((e) => buildArrayEntry(base, e));
    updates[`system.${relativePath}.value`] = nextValue;
    return;
  }

  // Case 3: record/object
  if (existing && typeof existing === "object") {
    const obj = existing as Record<string, any>;
    const sample = Object.values(obj).find((v) => v !== undefined);
    const next: any = { ...obj };

    if (typeof sample === "number") {
      for (const e of entries) {
        if ("value" in e) next[(e as any).type] = (e as IwrWithValue).value;
        else next[(e as any).type] = 1;
      }
      updates[`system.${relativePath}`] = next;
      return;
    }

    if (sample && typeof sample === "object") {
      for (const e of entries) {
        const base = sample;
        const built = buildArrayEntry(base, e);
        next[(e as any).type] = built;
      }
      updates[`system.${relativePath}`] = next;
      return;
    }
  }
}

function indexActorSkills(skillsObj: Record<string, any>): Map<string, string> {
  const out = new Map<string, string>();

  for (const [key, data] of Object.entries(skillsObj)) {
    const candidates: string[] = [key];
    if (data && typeof data === "object") {
      for (const p of ["slug", "name", "label"]) {
        const v = data[p];
        if (typeof v === "string") candidates.push(v);
      }
      const nestedLabel = foundry.utils.getProperty(data, "label");
      if (typeof nestedLabel === "string") candidates.push(nestedLabel);
    }

    for (const c of candidates) {
      const nk = normalizeKey(c);
      if (!nk) continue;
      if (!out.has(nk)) out.set(nk, key);
    }
  }

  // Clean empties
  for (const [k, v] of Array.from(out.entries())) {
    if (!v) out.delete(k);
  }

  return out;
}

function normalizeKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function buildEmbeddedItems(npc: NormalizedNpc): any[] {
  const items: any[] = [];

  // Strikes -> PF2e melee items (best-effort).
  for (const s of npc.strikes) {
    const sysModel = deepClone((game as any).system?.model?.Item?.melee) ?? {};

    const data: any = {
      name: s.name,
      type: "melee",
      system: sysModel,
    };

    // Ensure common PF2e fields exist even if model is sparse.
    if (!data.system.description) data.system.description = { value: "" };
    if (data.system.description && typeof data.system.description === "string") {
      data.system.description = { value: data.system.description };
    }
    if (!data.system.traits) data.system.traits = { value: [] };

    // Traits
    if (foundry.utils.getProperty(data.system, "traits.value") !== undefined) {
      data.system.traits.value = s.traits;
    }

    // Attack bonus
    if (s.attack !== null) {
      // PF2e NPC strikes typically use system.bonus.value.
      setFirstExisting(data.system, ["bonus.value", "bonus", "attack.value"], s.attack);
      // Some schemas wrap bonus as object.
      if (typeof data.system.bonus === "number") data.system.bonus = { value: data.system.bonus };
      if (data.system.bonus && typeof data.system.bonus === "object" && data.system.bonus.value === undefined) {
        data.system.bonus.value = s.attack;
      }
    }

    // Damage (decision #2: only set damageType if explicit in string)
    if (s.damageParsed.formula) {
      const dmgKey = foundry.utils.randomID();
      const dmg = { damage: s.damageParsed.formula } as any;
      if (s.damageParsed.damageType) dmg.damageType = s.damageParsed.damageType;

      if (!data.system.damageRolls || typeof data.system.damageRolls !== "object" || Array.isArray(data.system.damageRolls)) {
        data.system.damageRolls = {};
      }
      data.system.damageRolls[dmgKey] = {
        ...(data.system.damageRolls[dmgKey] ?? {}),
        ...dmg,
      };
    }

    const descParts: string[] = [];
    if (s.kind === "ranged") descParts.push("<p><strong>Type</strong> Ranged</p>");
    if (s.attack !== null) descParts.push(`<p><strong>Attack</strong> +${s.attack}</p>`);
    if (s.damageRaw) descParts.push(`<p><strong>Damage</strong> ${escapeHtml(s.damageRaw)}</p>`);
    if (s.damageParsed.note) {
      descParts.push(`<p><strong>Note</strong> ${escapeHtml(s.damageParsed.note)}</p>`);
    }

    if (descParts.length) {
      const existing =
        foundry.utils.getProperty(data.system, "description.value") ??
        foundry.utils.getProperty(data.system, "description") ??
        "";

      const html = `${existing ?? ""}${descParts.join("\n")}`;
      if (!data.system.description) data.system.description = { value: "" };
      if (typeof data.system.description === "string") data.system.description = { value: data.system.description };
      if (data.system.description && typeof data.system.description === "object") {
        data.system.description.value = html;
      }
    }

    items.push(data);
  }

  // Specials -> PF2e action items (best-effort).
  for (const sp of npc.specials) {
    const sysModel = deepClone((game as any).system?.model?.Item?.action) ?? {};

    const data: any = {
      name: sp.name,
      type: "action",
      system: sysModel,
    };

    if (!data.system.description) data.system.description = { value: "" };
    if (data.system.description && typeof data.system.description === "string") {
      data.system.description = { value: data.system.description };
    }
    if (!data.system.traits) data.system.traits = { value: [] };

    // Traits
    if (foundry.utils.getProperty(data.system, "traits.value") !== undefined) {
      data.system.traits.value = sp.traits;
    }

    // Action cost/type mapping
    applyActionCost(data.system, sp.actions);

    // Description
    if (!data.system.description) data.system.description = { value: "" };
    if (typeof data.system.description === "string") data.system.description = { value: data.system.description };
    if (data.system.description && typeof data.system.description === "object") {
      data.system.description.value = sp.descriptionHtml;
    }

    items.push(data);
  }

  return items;
}

function applyActionCost(systemData: any, raw: string | null): void {
  const v = (raw ?? "").trim().toLowerCase();

  // PF2e uses system.actions for action cost in many item types.
  if (!systemData.actions || typeof systemData.actions !== "object") {
    systemData.actions = { value: null, type: "passive" };
  }

  if (v === "free") {
    systemData.actions.type = "free";
    systemData.actions.value = null;
    setFirstExisting(systemData, ["actionType.value", "actionType"], "free");
    return;
  }

  if (v === "reaction") {
    systemData.actions.type = "reaction";
    systemData.actions.value = null;
    setFirstExisting(systemData, ["actionType.value", "actionType"], "reaction");
    return;
  }

  if (!v || v === "none") {
    systemData.actions.type = "passive";
    systemData.actions.value = null;
    setFirstExisting(systemData, ["actionType.value", "actionType"], "passive");
    return;
  }

  const toCount: Record<string, number> = { one: 1, two: 2, three: 3 };
  if (v in toCount) {
    systemData.actions.type = "action";
    systemData.actions.value = toCount[v];
    setFirstExisting(systemData, ["actionType.value", "actionType"], "action");
  }
}

function setFirstExisting(target: any, paths: string[], value: unknown): void {
  for (const p of paths) {
    const cur = foundry.utils.getProperty(target, p);
    if (cur !== undefined) {
      foundry.utils.setProperty(target, p, value);
      return;
    }
  }
  // If none exist, set first path anyway (best-effort)
  if (paths.length) foundry.utils.setProperty(target, paths[0], value);
}

async function createSpellcasting(actor: Actor, npc: NormalizedNpc): Promise<void> {
  const tradition = npc.spellcasting.tradition ?? "occult";
  const preparation = npc.spellcasting.preparation ?? "innate";

  const entryModel = deepClone((game as any).system?.model?.Item?.spellcastingEntry) ?? {};
  const entryData: any = {
    name: `${npc.name} Spellcasting`,
    type: "spellcastingEntry",
    system: entryModel,
  };

  // Best-effort assign common spellcasting entry fields.
  setFirstExisting(entryData.system, ["tradition.value", "tradition"], tradition);
  setFirstExisting(entryData.system, ["preparation.value", "preparation"], preparation);
  setFirstExisting(entryData.system, ["prepared.value", "prepared"], preparation);

  if (npc.spellcasting.spellAttack !== null) {
    setFirstExisting(entryData.system, ["spellcasting.statistic.attack", "statistic.attack"], npc.spellcasting.spellAttack);
    setFirstExisting(entryData.system, ["attack.value", "attack"], npc.spellcasting.spellAttack);
  }
  if (npc.spellcasting.spellDc !== null) {
    setFirstExisting(entryData.system, ["spellcasting.statistic.dc", "statistic.dc"], npc.spellcasting.spellDc);
    setFirstExisting(entryData.system, ["dc.value", "dc"], npc.spellcasting.spellDc);
  }

  const [entry] = (await actor.createEmbeddedDocuments("Item", [entryData])) as any[];
  if (!entry) return;

  const spells: any[] = [];
  for (const group of npc.spellcasting.spellsByLevel) {
    for (const spellName of group.names) {
      const spell = await findSpellByName(spellName);
      const spellData = spell
        ? spell.toObject()
        : {
            name: spellName,
            type: "spell",
            system: deepClone((game as any).system?.model?.Item?.spell) ?? {
              description: { value: "" },
            },
          };

      // Ensure linked to entry
      setFirstExisting(spellData.system, ["location.value", "location"], entry.id);
      setFirstExisting(spellData.system, ["level.value", "level"], group.level);
      spells.push(spellData);
    }
  }

  if (spells.length) {
    await actor.createEmbeddedDocuments("Item", spells);
  }
}

async function findSpellByName(name: string): Promise<Item | null> {
  const target = name.trim().toLowerCase();
  if (!target) return null;

  const preferred = (game as any).packs?.get?.("pf2e.spells-srd") as any;
  if (preferred) {
    const doc = await findInPack(preferred, target);
    if (doc) return doc;
  }

  const packs = Array.from((game as any).packs?.values?.() ?? []) as any[];
  for (const pack of packs) {
    try {
      if (pack.documentName !== "Item") continue;
      const doc = await findInPack(pack, target);
      if (doc) return doc;
    } catch {
      // ignore
    }
  }

  return null;
}

async function findInPack(pack: any, targetLower: string): Promise<Item | null> {
  const index = await pack.getIndex({ fields: ["name", "type"] } as any);
  const hit = (index as any[]).find(
    (e) => String(e.type) === "spell" && String(e.name).trim().toLowerCase() === targetLower,
  );
  if (!hit?._id) return null;
  return (await pack.getDocument(hit._id)) as Item;
}

function normalizeSpellsByLevel(raw: unknown): Array<{ level: number; names: string[] }> {
  if (!Array.isArray(raw)) return [];

  // pf2.tools exports an array where the *end* contains the lowest levels/cantrips.
  // We interpret last element as cantrips (0), previous as 1st, previous as 2nd, etc.
  const out: Array<{ level: number; names: string[] }> = [];
  const len = raw.length;
  for (let i = 0; i < len; i++) {
    const fromEnd = len - 1 - i;
    const level = i === 0 ? 0 : i; // i=0 -> cantrips(0), i=1 -> 1st, ...
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

async function createNpcJournal(
  npc: NormalizedNpc,
  actor: Actor,
  options: { createInfluence: boolean },
): Promise<JournalEntry | null> {
  const pageContent = buildNpcJournalHtml(npc, actor, options);

  try {
    const journal = (await JournalEntry.create({
      name: npc.name,
      pages: [
        {
          name: npc.name,
          type: "text",
          text: {
            format: (CONST as any).JOURNAL_ENTRY_PAGE_FORMATS?.HTML ?? (1 as any),
            content: pageContent,
          },
        },
      ],
    } as any)) as JournalEntry;

    return journal;
  } catch (err) {
    console.error("LGC | Journal creation failed", err, { npc });
    ui.notifications?.warn("LGC | Actor created but journal failed (see console)");
    return null;
  }
}

function buildNpcJournalHtml(
  npc: NormalizedNpc,
  actor: Actor,
  options: { createInfluence: boolean },
): string {
  const appearance = npc.description ? toHtml(npc.description) : "<p>TODO</p>";
  const info = npc.info ? toHtml(npc.info) : "<p>TODO</p>";
  const ancestry = npc.ancestryLike ?? npc.creatureType ?? "TODO";
  const sensesLabel = formatSensesFr(npc.sensesRaw) ?? "-";
  const languagesLabel = formatLanguagesForJournal(npc.languagesRaw) ?? "-";

  const simpleNpc = [
    '<div class="lgc-box-text simple-npc">',
    '  <div class="simple-npc__description">',
    "    <h2>Apparence</h2>",
    `    ${appearance}`,
    "    <h2>Informations</h2>",
    `    ${info}`,
    "  </div>",
    '  <div class="simple-npc__attributes">',
    "    <section>",
    "      <div>",
    "        <p><strong>Ascendance</strong> ",
    `          <span>${escapeHtml(ancestry)}</span></p>`,
    "      </div>",
    "      <div>",
    "        <p><strong>Statut</strong> ",
    "          <span>vivant</span></p>",
    "      </div>",
    "      <div>",
    "        <p><strong>Langues</strong> ",
    `          <span>${escapeHtml(languagesLabel)}</span></p>`,
    "      </div>",
    "      <div>",
    "        <p><strong>Sens</strong> ",
    `          <span>${escapeHtml(sensesLabel)}</span></p>`,
    "      </div>",
    "    </section>",
    "  </div>",
    "</div>",
  ].join("\n");

  const actorLink = actor?.uuid
    ? `<p>@UUID[${escapeHtml(actor.uuid)}]{${escapeHtml(actor.name)}}</p>`
    : "";

  const influence = options.createInfluence
    ? buildInfluenceStatblockHtml(npc)
    : "";

  return [actorLink, simpleNpc, influence].filter(Boolean).join("\n<hr />\n");
}

function buildInfluenceStatblockHtml(npc: NormalizedNpc): string {
  const traits: string[] = [];
  if (npc.creatureType) traits.push(npc.creatureType);
  if (npc.size) traits.push(npc.size);
  if (npc.alignment) traits.push(npc.alignment);

  const perception = npc.perception !== null ? `+${npc.perception}` : "TODO";
  const will = npc.saves.will !== null ? `+${npc.saves.will}` : "TODO";
  const desc = npc.description ? toHtml(npc.description) : "<p>Description</p>";

  return [
    '<div class="lgc-box-text statblock-influence">',
    `  <h4 class="statblock-influence__name">${escapeHtml(npc.name)}</h4>`,
    '  <section class="statblock-influence__content">',
    '    <section class="traits">',
    ...traits.map((t) => `      <p>${escapeHtml(t)}</p>`),
    "    </section>",
    `    ${desc}`,
    `    <p><strong>Perception</strong> ${escapeHtml(perception)}</p>`,
    `    <p><strong>Volonte</strong> ${escapeHtml(will)}</p>`,
    "    <hr>",
    "    <p><strong>Historique</strong> TODO</p>",
    "    <p><strong>Apparence</strong> TODO</p>",
    "    <p><strong>Personnalite</strong> TODO</p>",
    "    <p><strong>Oral, signe distinctif</strong> TODO</p>",
    "    <hr>",
    "    <p><strong>Decouverte</strong> TODO</p>",
    "    <p><strong>Competences d'influence</strong> TODO</p>",
    "    <p><strong>Influence 2</strong> TODO</p>",
    "    <p><strong>Influence 4</strong> TODO</p>",
    "    <p><strong>Influence 6</strong> TODO</p>",
    "    <p><strong>Influence 8</strong> TODO</p>",
    "    <p><strong>Resistances</strong> TODO</p>",
    "    <p><strong>Faiblesses</strong> TODO</p>",
    "  </section>",
    "</div>",
  ].join("\n");
}

function parseDamageString(raw: string): {
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

  // Extract parenthetical note (keep text, drop parentheses)
  let note: string | null = null;
  const paren = rest.match(/\(([^)]+)\)/);
  if (paren) {
    note = normalizeBlank(paren[1].trim());
    rest = rest.replace(paren[0], "").trim();
  }

  // Decision #2: only set type if explicitly present in string.
  const typeMatch = rest.match(/^([a-z]+)\b/i);
  const maybeType = typeMatch ? typeMatch[1].toLowerCase() : null;
  const damageType = isLikelyDamageType(maybeType) ? maybeType : null;

  return { formula, damageType, note };
}

function isLikelyDamageType(t: string | null): boolean {
  if (!t) return false;
  // conservative allowlist; extend later.
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

function parseTraits(raw: string | null | undefined): string[] {
  const src = normalizeBlank(raw) ?? "";
  if (!src) return [];
  return src
    .split(/[,;]+/g)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => slugifyTrait(s));
}

function slugifyTrait(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function toHtml(text: string): string {
  // Minimal markdown-ish conversion: **bold**, newlines.
  const escaped = escapeHtml(text);
  const strong = escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return `<p>${strong.replace(/\n/g, "<br />")}</p>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatSensesFr(raw: string | null): string | null {
  const parsed = parseSenses(raw);
  const parts: string[] = [];
  if (parsed.frLabels.length) parts.push(...parsed.frLabels);
  if (parsed.custom.length) parts.push(...parsed.custom);
  const out = parts.map((s) => s.trim()).filter(Boolean).join(", ");
  return out ? out : null;
}

function formatLanguagesForJournal(raw: string | null): string | null {
  const src = normalizeBlank(raw);
  if (!src) return null;
  return src
    .split(/[,;\n]+/g)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
}

function normalizeBlank(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  if (t === "-") return null;
  return t;
}

function asNonEmptyString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return null;
    const n = Number(t);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function deepClone<T>(v: T): T {
  return foundry.utils.deepClone(v);
}
