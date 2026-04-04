import type { ImportContext, NormalizedNpc } from "../importer/types";
import { deepClone } from "../../../lib/foundry";
import { setFirstExisting } from "../../../lib/pf2e/actor";

export async function createSpellcasting(
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

  const [entry] = (await actor.createEmbeddedDocuments("Item", [entryData])) as any[];
  if (!entry) return;

  // PF2e uses system.spelldc for displayed spell attack/DC on the entry.
  // Set canonical fields explicitly after creation.
  try {
    const entrySys: any = (entry as any).system;
    const upd: Record<string, unknown> = {};

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
    console.error("LGC | Failed to finalize spellcasting entry", err, {
      actor: actor.name,
      entryId: (entry as any).id,
    });
  }

  // Create spells on actor
  const spellsToCreate: any[] = [];
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

      setFirstExisting(spellData.system, ["location.value", "location"], entry.id, {
        allowCreate: true,
        debugLabel: "spell.location",
      });
      setFirstExisting(spellData.system, ["level.value", "level"], group.level, {
        allowCreate: true,
        debugLabel: "spell.level",
      });

      spellsToCreate.push(spellData);
    }
  }

  let createdSpells: any[] = [];
  if (spellsToCreate.length) {
    createdSpells = (await actor.createEmbeddedDocuments(
      "Item",
      spellsToCreate,
    )) as any[];
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
          const lvl = Number(
            foundry.utils.getProperty(sp, "system.level.value") ??
              foundry.utils.getProperty(sp, "system.level") ??
              NaN,
          );
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
      console.error("LGC | Failed to apply spell slots", err, {
        actor: actor.name,
        entryId: (entry as any).id,
      });
    }
  }
}

async function findSpellByName(
  ctx: ImportContext,
  name: string,
): Promise<Item | null> {
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
