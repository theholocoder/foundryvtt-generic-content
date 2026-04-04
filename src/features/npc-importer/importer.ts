import type { ImportContext } from "./types";
import { normalizePf2ToolsNpc } from "./normalize";
import { createPf2eNpcActor, finalizeHp } from "./pf2e-actor";
import { createNpcJournal } from "./journal";

const MODULE_ID = "lazybobcat-generic-content";

export async function importNpcFromJson(
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

  let npc;
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
