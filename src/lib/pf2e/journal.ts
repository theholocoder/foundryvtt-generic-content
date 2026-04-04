import { escapeHtml } from "../html";

const t = (k: string): string => game.i18n?.localize(k) ?? k;

// ─── NPC block (simple-npc template) ─────────────────────────────────────────

export interface NpcBlockOptions {
  appearance: string;    // HTML content (e.g. "<p>TODO</p>" or built HTML)
  info: string;          // HTML content
  ancestry: string;      // plain text, will be escaped
  status: string;        // plain text, will be escaped
  languages?: string;    // optional — rendered in attributes section if provided
  senses?: string;       // optional — rendered in attributes section if provided
}

export function buildNpcBlockHtml(opts: NpcBlockOptions): string {
  const attributes: string[] = [
    "      <div>",
    `        <p><strong>${t("LGC.NpcWizard.Journal.Ancestry")}</strong> <span>${escapeHtml(opts.ancestry)}</span></p>`,
    "      </div>",
    "      <div>",
    `        <p><strong>${t("LGC.NpcWizard.Journal.Status")}</strong> <span>${escapeHtml(opts.status)}</span></p>`,
    "      </div>",
  ];

  if (opts.languages !== undefined) {
    attributes.push(
      "      <div>",
      `        <p><strong>${t("LGC.NpcWizard.Journal.Languages")}</strong> <span>${escapeHtml(opts.languages)}</span></p>`,
      "      </div>",
    );
  }

  if (opts.senses !== undefined) {
    attributes.push(
      "      <div>",
      `        <p><strong>${t("LGC.NpcWizard.Journal.Senses")}</strong> <span>${escapeHtml(opts.senses)}</span></p>`,
      "      </div>",
    );
  }

  return [
    '<div class="lgc-box-text simple-npc">',
    '  <div class="simple-npc__description">',
    `    <h2>${t("LGC.NpcWizard.Journal.Appearance")}</h2>`,
    `    ${opts.appearance}`,
    `    <h2>${t("LGC.NpcWizard.Journal.Information")}</h2>`,
    `    ${opts.info}`,
    "  </div>",
    '  <div class="simple-npc__attributes">',
    "    <section>",
    ...attributes,
    "    </section>",
    "  </div>",
    "</div>",
  ].join("\n");
}

// ─── Influence statblock ──────────────────────────────────────────────────────

export interface InfluenceBlockOptions {
  name: string;
  traits: string[];     // display labels (already capitalised)
  perception: string;   // e.g. "+5" or "TODO"
  will: string;         // e.g. "+3" or "TODO"
  thresholds: Array<{ number: number | string; description: string }>;
}

export function buildInfluenceBlockHtml(opts: InfluenceBlockOptions): string {
  const thresholds =
    opts.thresholds.length > 0
      ? opts.thresholds
          .map(
            (th) =>
              `    <p><strong>${t("LGC.NpcWizard.Journal.InfluenceAt")} ${th.number}</strong> ${escapeHtml(th.description)}</p>`,
          )
          .join("\n")
      : `    <p><strong>${t("LGC.NpcWizard.Journal.InfluenceAt")} ?</strong> TODO</p>`;

  return [
    '<div class="lgc-box-text statblock-influence">',
    `  <h4 class="statblock-influence__name">${escapeHtml(opts.name)}</h4>`,
    '  <section class="statblock-influence__content">',
    '    <section class="traits">',
    ...opts.traits.map((label) => `      <p>${escapeHtml(label)}</p>`),
    "    </section>",
    `    <p><strong>${t("LGC.NpcWizard.Journal.Perception")}</strong> ${escapeHtml(opts.perception)}</p>`,
    `    <p><strong>${t("LGC.NpcWizard.Journal.Will")}</strong> ${escapeHtml(opts.will)}</p>`,
    "    <hr>",
    `    <p><strong>${t("LGC.NpcWizard.Journal.Background")}</strong> TODO</p>`,
    `    <p><strong>${t("LGC.NpcWizard.Journal.Appearance")}</strong> TODO</p>`,
    `    <p><strong>${t("LGC.NpcWizard.Journal.Personality")}</strong> TODO</p>`,
    `    <p><strong>${t("LGC.NpcWizard.Journal.DistinctiveFeature")}</strong> TODO</p>`,
    "    <hr>",
    `    <p><strong>${t("LGC.NpcWizard.Journal.Discovery")}</strong> TODO</p>`,
    `    <p><strong>${t("LGC.NpcWizard.Journal.InfluenceSkills")}</strong> TODO</p>`,
    thresholds,
    `    <p><strong>${t("LGC.NpcWizard.Journal.Resistances")}</strong> TODO</p>`,
    `    <p><strong>${t("LGC.NpcWizard.Journal.Weaknesses")}</strong> TODO</p>`,
    "  </section>",
    "</div>",
  ].join("\n");
}

// ─── Actor helpers for journal rendering ─────────────────────────────────────

export function formatSensesFromActor(actor: Actor): string {
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
      const label = s && typeof s === "object" ? (s.label ?? s.type) : s;
      if (typeof label === "string" && label.trim()) {
        parts.push(game.i18n?.localize(label) ?? label);
      }
    }
  }
  if (typeof details === "string" && details.trim()) parts.push(details.trim());

  return parts.map((s) => s.trim()).filter(Boolean).join(", ") || "-";
}

export function formatLanguagesFromActor(actor: Actor): string {
  const sys: any = (actor as any).system;
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

  return parts.map((s) => s.trim()).filter(Boolean).join(", ") || "-";
}

// ─── Journal entry creation ───────────────────────────────────────────────────

export interface JournalPageSpec {
  name: string;
  type: "text" | "image";
  content?: string;   // for text pages
  src?: string;       // for image pages
}

export async function createJournalEntry(
  name: string,
  pages: JournalPageSpec[],
): Promise<JournalEntry | null> {
  const pageData = pages.map((p) => {
    if (p.type === "text") {
      return {
        name: p.name,
        type: "text",
        text: {
          format: (CONST as any).JOURNAL_ENTRY_PAGE_FORMATS?.HTML ?? 1,
          content: p.content ?? "",
        },
      };
    }
    return { name: p.name, type: "image", src: p.src };
  });

  try {
    return (await JournalEntry.create({ name, pages: pageData } as any)) as JournalEntry;
  } catch (err) {
    console.error("LGC | Journal creation failed", err);
    ui.notifications?.warn(
      game.i18n?.localize("LGC.NpcWizard.ActorCreatedButJournal") ??
        "Actor created but journal failed (see console)",
    );
    return null;
  }
}
