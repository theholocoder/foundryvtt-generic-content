import type { NormalizedNpc } from "./types";
import { escapeHtml, toHtml } from "./utils";
import { sizeCodeToLabel } from "./journal-helpers";

export async function createNpcJournal(
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
  if (npc.size) traits.push(sizeCodeToLabel(npc.size));
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
