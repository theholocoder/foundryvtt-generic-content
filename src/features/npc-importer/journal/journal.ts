import type { NormalizedNpc } from "../importer/types";
import { toHtml } from "../utils";
import {
  buildNpcBlockHtml,
  buildInfluenceBlockHtml,
  formatSensesFromActor,
  formatLanguagesFromActor,
  createJournalEntry,
} from "../../../lib/pf2e/journal";
import { escapeHtml } from "../../../lib/html";
import { sizeCodeToLabel } from "../../../lib/pf2e/traits";

export async function createNpcJournal(
  npc: NormalizedNpc,
  actor: Actor,
  options: { createInfluence: boolean },
): Promise<JournalEntry | null> {
  const appearance = npc.description ? toHtml(npc.description) : "<p>TODO</p>";
  const info = npc.info ? toHtml(npc.info) : "<p>TODO</p>";
  const ancestry = npc.ancestryLike ?? npc.creatureType ?? "TODO";

  const npcBlock = buildNpcBlockHtml({
    appearance,
    info,
    ancestry,
    status: "vivant",
    languages: formatLanguagesFromActor(actor),
    senses: formatSensesFromActor(actor),
  });

  const influenceBlock = options.createInfluence
    ? buildInfluenceStatblock(npc)
    : "";

  const actorLink = actor?.uuid
    ? `<p>@UUID[${escapeHtml(actor.uuid)}]{${escapeHtml(actor.name)}}</p>`
    : "";

  const pageContent = [npcBlock, influenceBlock, actorLink].filter(Boolean).join("\n<hr />\n");

  return createJournalEntry(npc.name, [{ name: npc.name, type: "text", content: pageContent }]);
}

function buildInfluenceStatblock(npc: NormalizedNpc): string {
  const traits: string[] = [];
  if (npc.creatureType) traits.push(npc.creatureType);
  if (npc.size) traits.push(sizeCodeToLabel(npc.size));
  if (npc.rarity && npc.rarity !== "common") traits.push(npc.rarity);
  if (npc.alignment) traits.push(npc.alignment);

  const perception = npc.perception !== null ? `+${npc.perception}` : "TODO";
  const will = npc.saves.will !== null ? `+${npc.saves.will}` : "TODO";

  return buildInfluenceBlockHtml({
    name: npc.name,
    traits,
    perception,
    will,
    thresholds: [],
  });
}
