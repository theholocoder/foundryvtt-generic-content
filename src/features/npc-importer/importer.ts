import type { ImportContext } from "./types";
import { normalizePf2ToolsNpc } from "./normalize";
import { createPf2eNpcActor, finalizeHp } from "./pf2e-actor";
import { createNpcJournal } from "./journal";

const MODULE_ID = "lazybobcat-generic-content";
const t = (k: string) => game.i18n?.localize(k) ?? k;

export async function importNpcFromJson(
  rawJson: string,
  options: { createJournal: boolean; createInfluence: boolean },
): Promise<void> {
  if (!rawJson) {
    ui.notifications?.error(t("LGC.NpcImporter.PasteJson"));
    return;
  }

  if ((game as any)?.system?.id !== "pf2e") {
    ui.notifications?.error(t("LGC.NpcImporter.Pf2eRequired"));
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    console.error("LGC | Invalid JSON", err);
    ui.notifications?.error(t("LGC.NpcImporter.InvalidJson"));
    return;
  }

  let npc;
  try {
    npc = normalizePf2ToolsNpc(parsed);
  } catch (err) {
    console.error("LGC | JSON normalization failed", err, { parsed });
    ui.notifications?.error(t("LGC.NpcImporter.UnsupportedJson"));
    return;
  }

  if (!npc.name) {
    ui.notifications?.error(t("LGC.NpcImporter.MissingName"));
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

  if (npc.hp !== null) {
    await finalizeHp(actor, npc.hp);
  }

  actor.sheet?.render(true);
  ui.notifications?.info(t("LGC.NpcImporter.ActorCreated").replace("{name}", actor.name));
}
