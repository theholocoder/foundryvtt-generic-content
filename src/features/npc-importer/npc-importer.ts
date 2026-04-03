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
  customTraits: string[];
  rarity: string | null;
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

type ImportContext = {
  spellIndex: Map<string, { pack: any; id: string }> | null;
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

  const ctx: ImportContext = { spellIndex: null };

  const created = await createPf2eNpcActor(ctx, npc);
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

  // PF2e can reset current HP after later actor updates (e.g. setFlag) due to
  // derived-data prep timing. Re-apply max/value at the very end of import.
  if (npc.hp !== null) {
    await finalizeHp(actor, npc.hp);
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

  const rawTraitTokens = splitCsv(asNonEmptyString(o.traits));
  const rarityCandidates = rawTraitTokens
    .map((t) => t.toLowerCase())
    .filter((t) => t === "common" || t === "uncommon" || t === "rare" || t === "unique");
  if (rarityCandidates.length > 1) {
    console.warn("LGC | Multiple rarity tokens found in traits", rarityCandidates, rawTraitTokens);
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
  const spelltypeRaw = normalizeBlank(asNonEmptyString(o.spelltype));
  const spelltype = spelltypeRaw ? spelltypeRaw.trim().toLowerCase() : null;

  // Default decision: occult/innate when spells present.
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

  // Traits + rarity
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

  // Resistances / weaknesses / immunities
  applyIwr(
    updatesPre,
    sysInitial,
    "attributes.resistances",
    parseIwrWithValues(npc.resistancesRaw),
  );
  applyIwr(
    updatesPre,
    sysInitial,
    "attributes.weaknesses",
    parseIwrWithValues(npc.weaknessesRaw),
  );
  applyIwr(
    updatesPre,
    sysInitial,
    "attributes.immunities",
    parseIwrNoValues(npc.immunitiesRaw),
  );

  // Skills: map pf2.tools skill keys onto PF2e skills object.
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

      const possible = [
        `system.skills.${skillKey}.mod`,
        `system.skills.${skillKey}.mod.value`,
        `system.skills.${skillKey}.value`,
        `system.skills.${skillKey}.modifier`,
        `system.skills.${skillKey}.totalModifier`,
      ];
      for (const p of possible) {
        const rel = p.replace(/^system\./, "");
        const cur = foundry.utils.getProperty(sysInitial, rel);
        if (cur !== undefined) {
          updatesPre[p] = mod;
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
      await createSpellcasting(ctx, actor, npc);
    } catch (err) {
      console.error("LGC | Spellcasting creation failed", err, { npc });
      ui.notifications?.warn("LGC | Actor created but spells failed (see console)");
    }
  }

  // Post-embedded finalize: these can be affected by PF2e prepare.
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

  // Finalize HP last: PF2e prepare can reset current HP.
  if (npc.hp !== null) {
    await finalizeHp(actor, npc.hp);
  }

  return { actor };
}

async function finalizeHp(actor: Actor, hp: number): Promise<void> {
  try {
    const hpUpdate: Record<string, unknown> = {
      "system.attributes.hp.max": hp,
      "system.attributes.hp.value": hp,
    };
    if (foundry.utils.getProperty((actor as any).system, "attributes.hp.temp") !== undefined) {
      hpUpdate["system.attributes.hp.temp"] = 0;
    }
    await actor.update(hpUpdate);
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

  for (const t of npc.customTraits ?? []) {
    const v = normalizeBlank(t);
    if (!v) continue;
    addCustomTrait(v);
  }
}

function applyRarity(
  updates: Record<string, unknown>,
  sys: any,
  rarity: string | null,
): void {
  const r = normalizeBlank(rarity);
  if (!r) return;

  // Only set if the field exists on this PF2e version.
  if (foundry.utils.getProperty(sys, "traits.rarity.value") !== undefined) {
    updates["system.traits.rarity.value"] = r;
    return;
  }
  if (foundry.utils.getProperty(sys, "traits.rarity") !== undefined) {
    updates["system.traits.rarity"] = r;
  }
}

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

  // Fallback direct
  if (foundry.utils.getProperty(sys, "details.languages.value") !== undefined) {
    updates["system.details.languages.value"] = knownUniq;
  }
  if (customUniq.length && foundry.utils.getProperty(sys, "details.languages.custom") !== undefined) {
    updates["system.details.languages.custom"] = customUniq.join(", ");
  }
}

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
    if (k === "low-light" || k === "lowlight" || k === "low-light vision" || k === "low light") {
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

function applySenses(
  updates: Record<string, unknown>,
  sys: any,
  raw: string | null,
): void {
  const parsed = parseSenses(raw);
  if (!parsed.slugs.length && !parsed.custom.length) return;

  // 1) Perception special senses (this is what the NPC sheet shows)
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

    const makeSense = (type: string, label: string): any => {
      const next = { ...baseTemplate };
      next.type = type;
      next.label = label;
      // Keep these stable defaults unless template already differs
      if (next.acuity === undefined) next.acuity = "precise";
      if (next.range === undefined) next.range = null;
      if (next.source === undefined) next.source = null;
      if (next.emphasizeLabel === undefined) next.emphasizeLabel = false;
      return next;
    };

    const desired: any[] = [];
    for (const slug of parsed.slugs) {
      if (slug === "darkvision") desired.push(makeSense("darkvision", getSenseLabel("darkvision")));
      else if (slug === "lowLightVision") {
        desired.push(makeSense("lowLightVision", getSenseLabel("lowLightVision")));
      }
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
        const next = curDetails ? `${curDetails}\n${suffix}` : suffix;
        updates["system.perception.details"] = next;
      }
    }
  }

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

function getSenseLabel(type: string): string {
  const cfg = (globalThis as any).CONFIG?.PF2E;
  const senses = cfg?.senses;
  const direct = senses?.[type] ?? senses?.[String(type).toLowerCase()];
  if (typeof direct === "string") return game.i18n?.localize(direct) ?? direct;

  const fallback = type === "darkvision"
    ? "Darkvision"
    : type === "lowLightVision"
      ? "Low-Light Vision"
      : type;
  return game.i18n?.localize(fallback) ?? fallback;
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
      setFirstExisting(
        data.system,
        ["bonus.value", "bonus", "attack.value"],
        s.attack,
        { allowCreate: true, debugLabel: "melee.bonus" },
      );
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
    setFirstExisting(systemData, ["actionType.value", "actionType"], "free", {
      allowCreate: true,
      debugLabel: "action.actionType",
    });
    return;
  }

  if (v === "reaction") {
    systemData.actions.type = "reaction";
    systemData.actions.value = null;
    setFirstExisting(systemData, ["actionType.value", "actionType"], "reaction", {
      allowCreate: true,
      debugLabel: "action.actionType",
    });
    return;
  }

  if (!v || v === "none") {
    systemData.actions.type = "passive";
    systemData.actions.value = null;
    setFirstExisting(systemData, ["actionType.value", "actionType"], "passive", {
      allowCreate: true,
      debugLabel: "action.actionType",
    });
    return;
  }

  const toCount: Record<string, number> = { one: 1, two: 2, three: 3 };
  if (v in toCount) {
    systemData.actions.type = "action";
    systemData.actions.value = toCount[v];
    setFirstExisting(systemData, ["actionType.value", "actionType"], "action", {
      allowCreate: true,
      debugLabel: "action.actionType",
    });
  }
}

function setFirstExisting(
  target: any,
  paths: string[],
  value: unknown,
  options?: { allowCreate?: boolean; debugLabel?: string },
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

  if (paths.length) {
    console.debug(
      "LGC | Missing target paths for setFirstExisting",
      options?.debugLabel ?? "",
      paths,
    );
  }
  return false;
}

async function createSpellcasting(
  ctx: ImportContext,
  actor: Actor,
  npc: NormalizedNpc,
): Promise<void> {
  const tradition = npc.spellcasting.tradition ?? "occult";
  const preparation = npc.spellcasting.preparation ?? "innate";

  const entryModel = deepClone((game as any).system?.model?.Item?.spellcastingEntry) ?? {};
  const entryData: any = {
    name: `${npc.name} Spellcasting`,
    type: "spellcastingEntry",
    system: entryModel,
  };

  // Best-effort assign common spellcasting entry fields.
  setFirstExisting(entryData.system, ["tradition.value", "tradition"], tradition, {
    allowCreate: true,
    debugLabel: "spellcasting.tradition",
  });
  setFirstExisting(entryData.system, ["preparation.value", "preparation"], preparation, {
    allowCreate: true,
    debugLabel: "spellcasting.preparation",
  });
  setFirstExisting(entryData.system, ["prepared.value", "prepared"], preparation, {
    allowCreate: true,
    debugLabel: "spellcasting.prepared",
  });

  if (npc.spellcasting.spellAttack !== null) {
    setFirstExisting(
      entryData.system,
      ["spellcasting.statistic.attack", "statistic.attack"],
      npc.spellcasting.spellAttack,
      { allowCreate: true, debugLabel: "spellcasting.attack" },
    );
    setFirstExisting(entryData.system, ["attack.value", "attack"], npc.spellcasting.spellAttack, {
      allowCreate: true,
      debugLabel: "spellcasting.attack",
    });
  }
  if (npc.spellcasting.spellDc !== null) {
    setFirstExisting(
      entryData.system,
      ["spellcasting.statistic.dc", "statistic.dc"],
      npc.spellcasting.spellDc,
      { allowCreate: true, debugLabel: "spellcasting.dc" },
    );
    setFirstExisting(entryData.system, ["dc.value", "dc"], npc.spellcasting.spellDc, {
      allowCreate: true,
      debugLabel: "spellcasting.dc",
    });
  }

  const [entry] = (await actor.createEmbeddedDocuments("Item", [entryData])) as any[];
  if (!entry) return;

  // PF2e uses system.spelldc for displayed spell attack/DC on the entry.
  // Set the canonical fields explicitly after creation.
  try {
    const entrySys: any = (entry as any).system;
    const upd: Record<string, unknown> = {};

    // Preparation type (innate/prepared/spontaneous)
    if (foundry.utils.getProperty(entrySys, "prepared.value") !== undefined) {
      upd["system.prepared.value"] = preparation;
    }
    if (foundry.utils.getProperty(entrySys, "preparation.value") !== undefined) {
      upd["system.preparation.value"] = preparation;
    }
    if (foundry.utils.getProperty(entrySys, "prepared.flexible") !== undefined) {
      upd["system.prepared.flexible"] = false;
    }
    if (npc.spellcasting.spellAttack !== null) {
      if (foundry.utils.getProperty(entrySys, "spelldc.value") !== undefined) {
        upd["system.spelldc.value"] = npc.spellcasting.spellAttack;
      }
      if (foundry.utils.getProperty(entrySys, "attack.value") !== undefined) {
        upd["system.attack.value"] = npc.spellcasting.spellAttack;
      }
      if (foundry.utils.getProperty(entrySys, "spellcasting.statistic.attack") !== undefined) {
        upd["system.spellcasting.statistic.attack"] = npc.spellcasting.spellAttack;
      }
    }
    if (npc.spellcasting.spellDc !== null) {
      if (foundry.utils.getProperty(entrySys, "spelldc.dc") !== undefined) {
        upd["system.spelldc.dc"] = npc.spellcasting.spellDc;
      }
      if (foundry.utils.getProperty(entrySys, "dc.value") !== undefined) {
        upd["system.dc.value"] = npc.spellcasting.spellDc;
      }
      if (foundry.utils.getProperty(entrySys, "spellcasting.statistic.dc") !== undefined) {
        upd["system.spellcasting.statistic.dc"] = npc.spellcasting.spellDc;
      }
    }

    if (Object.keys(upd).length) {
      await (entry as any).update(upd);
    }
  } catch (err) {
    console.error("LGC | Failed to finalize spellcasting entry attack/DC", err, {
      actor: actor.name,
      entryId: (entry as any).id,
    });
  }

  const spells: any[] = [];
  for (const group of npc.spellcasting.spellsByLevel) {
    for (const spellName of group.names) {
      const spell = await findSpellByName(ctx, spellName);
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
      setFirstExisting(spellData.system, ["location.value", "location"], entry.id, {
        allowCreate: true,
        debugLabel: "spell.location",
      });
      setFirstExisting(spellData.system, ["level.value", "level"], group.level, {
        allowCreate: true,
        debugLabel: "spell.level",
      });
      spells.push(spellData);
    }
  }

  let createdSpells: any[] = [];
  if (spells.length) {
    createdSpells = (await actor.createEmbeddedDocuments("Item", spells)) as any[];
  }

  // For prepared/spontaneous: set slot maxima based on spells listed.
  // For prepared: also pre-fill prepared slots with the spells.
  if (preparation === "prepared" || preparation === "spontaneous") {
    try {
      const entrySys: any = (entry as any).system;
      const slots = foundry.utils.getProperty(entrySys, "slots") as any;
      if (slots && typeof slots === "object") {
        const createdByLevel = new Map<number, string[]>();
        for (const sp of createdSpells) {
          const lvl = Number(foundry.utils.getProperty(sp, "system.level.value") ?? foundry.utils.getProperty(sp, "system.level") ?? NaN);
          if (!Number.isFinite(lvl)) continue;
          const arr = createdByLevel.get(lvl) ?? [];
          arr.push(String(sp.id));
          createdByLevel.set(lvl, arr);
        }

        const slotUpdates: Record<string, unknown> = {};
        for (const [lvl, ids] of createdByLevel.entries()) {
          const key = `slot${lvl}`;
          const slot = slots[key];
          if (!slot || typeof slot !== "object") continue;

          if (slot.max !== undefined) slotUpdates[`system.slots.${key}.max`] = ids.length;
          if (slot.value !== undefined) slotUpdates[`system.slots.${key}.value`] = 0;

          if (preparation === "prepared" && Array.isArray(slot.prepared)) {
            slotUpdates[`system.slots.${key}.prepared`] = ids.map((id) => ({ id }));
          }
        }

        if (Object.keys(slotUpdates).length) {
          await (entry as any).update(slotUpdates);
        }
      }
    } catch (err) {
      console.error("LGC | Failed to apply spell slots", err, { actor: actor.name, entryId: (entry as any).id });
    }
  }
}

async function findSpellByName(ctx: ImportContext, name: string): Promise<Item | null> {
  const target = name.trim().toLowerCase();
  if (!target) return null;

  const index = await getSpellIndex(ctx);
  const hit = index.get(target);
  if (!hit) return null;

  try {
    return (await hit.pack.getDocument(hit.id)) as Item;
  } catch {
    return null;
  }
}

async function getSpellIndex(
  ctx: ImportContext,
): Promise<Map<string, { pack: any; id: string }>> {
  if (ctx.spellIndex) return ctx.spellIndex;

  const map = new Map<string, { pack: any; id: string }>();
  const packs = Array.from((game as any).packs?.values?.() ?? []) as any[];

  // Prefer spells-srd first if present.
  const preferred = (game as any).packs?.get?.("pf2e.spells-srd");
  const ordered = preferred
    ? [preferred, ...packs.filter((p) => p !== preferred)]
    : packs;

  for (const pack of ordered) {
    try {
      if (pack.documentName !== "Item") continue;
      const index = await pack.getIndex({ fields: ["name", "type"] } as any);
      for (const e of index as any[]) {
        if (String(e.type) !== "spell") continue;
        const key = String(e.name ?? "").trim().toLowerCase();
        if (!key) continue;
        if (!map.has(key)) map.set(key, { pack, id: e._id });
      }
    } catch (err) {
      console.debug("LGC | Skipping pack during spell index build", err);
    }
  }

  ctx.spellIndex = map;
  return map;
}

function normalizeSpellsByLevel(raw: unknown): Array<{ level: number; names: string[] }> {
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
  const sensesLabel = formatSensesForJournalFromActor(actor) ?? "-";
  const languagesLabel = formatLanguagesForJournalFromActor(actor) ?? "-";

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

  return [simpleNpc, influence, actorLink].filter(Boolean).join("\n<hr />\n");
}

function buildInfluenceStatblockHtml(npc: NormalizedNpc): string {
  const traits: string[] = [];
  if (npc.creatureType) traits.push(npc.creatureType);
  if (npc.size) traits.push(sizeCodeToLabel(npc.size) ?? npc.size);
  if (npc.rarity && npc.rarity !== "common") traits.push(npc.rarity);
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

function sizeCodeToLabel(size: string | null): string | null {
  const s = normalizeBlank(size);
  if (!s) return null;
  const v = s.trim().toLowerCase();

  const map: Record<string, string> = {
    sm: "small",
    med: "medium",
    lg: "large",
    grg: "gargantuan",
  };

  return map[v] ?? s;
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

function formatSensesForJournalFromActor(actor: Actor): string | null {
  const senses = foundry.utils.getProperty(
    (actor as any).system,
    "perception.senses",
  ) as any;
  const details = foundry.utils.getProperty(
    (actor as any).system,
    "perception.details",
  );

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

  const out = parts.map((s) => s.trim()).filter(Boolean).join(", ");
  return out ? out : null;
}

function formatLanguagesForJournalFromActor(actor: Actor): string | null {
  const sys: any = (actor as any).system;
  if (!sys) return null;

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

  const out = parts.map((s) => s.trim()).filter(Boolean).join(", ");
  return out ? out : null;
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

function splitCsv(raw: string | null | undefined): string[] {
  const src = normalizeBlank(raw);
  if (!src) return [];
  return src
    .split(/[,;]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function deepClone<T>(v: T): T {
  return foundry.utils.deepClone(v);
}
