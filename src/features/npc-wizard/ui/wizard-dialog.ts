import { toJQuery } from "../../../lib/foundry";
import CONCEPTS from "../data/concepts.json";

type Tier = 1 | 2 | 3;

interface SkillRow {
  id: string;
  skill: string;
  rank: string;
}

interface ThresholdRow {
  id: string;
  number: number;
  description: string;
}

export interface WizardResult {
  tier: Tier;
  name: string;
  conceptId: string;
  level: number;
  img: string;
  traits: string[];
  skills: SkillRow[];
  thresholds: ThresholdRow[];
}

const t = (k: string) => game.i18n?.localize(k) ?? k;

export function openNpcWizard(onSubmit: (result: WizardResult) => Promise<void>): void {
  let selectedTier: Tier | null = null;

  showTierSelect();

  function showTierSelect(): void {
    const content = buildTierSelectHtml();
    const dlg = new Dialog({
      title: t("LGC.NpcWizard.ChooseTier"),
      content,
      buttons: {
        cancel: {
          icon: '<i class="fa-solid fa-xmark"></i>',
          label: t("LGC.NpcWizard.Cancel"),
        },
      },
      default: "cancel",
      render: (html: any) => {
        const $html = toJQuery(html);
        $html.closest(".app").addClass("lgc-wizard-dialog");
        $html.find(".lgc-tier-btn").on("click", function () {
          selectedTier = Number($(this).data("tier")) as Tier;
          dlg.close();
          showWizardForm(selectedTier!);
        });
      },
    });
    dlg.render(true);
  }

  function showWizardForm(tier: Tier): void {
    const traits: string[] = ["humanoid"];
    const skillRows: SkillRow[] = [];
    const thresholdRows: ThresholdRow[] = [];

    const dlg = new Dialog({
      title: t("LGC.NpcWizard.WizardTitle"),
      content: buildFormHtml(tier, traits, skillRows, thresholdRows),
      buttons: {
        back: {
          icon: '<i class="fa-solid fa-arrow-left"></i>',
          label: t("LGC.NpcWizard.Back"),
          callback: () => { showTierSelect(); },
        },
        cancel: {
          icon: '<i class="fa-solid fa-xmark"></i>',
          label: t("LGC.NpcWizard.Cancel"),
        },
        create: {
          icon: '<i class="fa-solid fa-wand-magic-sparkles"></i>',
          label: t("LGC.NpcWizard.Create"),
          callback: async (html: any) => {
            const $html = toJQuery(html);
            const result = collectForm($html, tier, traits, skillRows, thresholdRows);
            if (result) {
              await onSubmit(result);
            }
          },
        },
      },
      default: "create",
      render: (html: any) => {
        const $html = toJQuery(html);
        $html.closest(".app").addClass("lgc-wizard-dialog");
        bindFormEvents($html, traits, skillRows, thresholdRows);
      },
    });

    dlg.render(true);
  }
}

function buildTierSelectHtml(): string {
  const tiers = [
    { id: 1, label: t("LGC.NpcWizard.Tier1Label"), desc: t("LGC.NpcWizard.Tier1Desc"), icon: "fa-solid fa-user" },
    { id: 2, label: t("LGC.NpcWizard.Tier2Label"), desc: t("LGC.NpcWizard.Tier2Desc"), icon: "fa-solid fa-users" },
    { id: 3, label: t("LGC.NpcWizard.Tier3Label"), desc: t("LGC.NpcWizard.Tier3Desc"), icon: "fa-solid fa-crown" },
  ];

  return [
    '<div class="lgc-wizard-tier-select">',
    ...tiers.map(
      (t) =>
        `<button type="button" class="lgc-tier-btn" data-tier="${t.id}">` +
        `<i class="${t.icon}"></i>` +
        `<span class="lgc-tier-label">${t.label}</span>` +
        `<span class="lgc-tier-desc">${t.desc}</span>` +
        `</button>`,
    ),
    "</div>",
  ].join("\n");
}

function buildFormHtml(
  tier: Tier,
  traits: string[],
  skillRows: SkillRow[],
  thresholdRows: ThresholdRow[],
): string {
  const skills = getAvailableSkills();
  const ranks = [
    { value: "LOW", label: t("LGC.NpcWizard.RankLow") },
    { value: "MEDIUM", label: t("LGC.NpcWizard.RankMedium") },
    { value: "HIGH", label: t("LGC.NpcWizard.RankHigh") },
    { value: "EXTREME", label: t("LGC.NpcWizard.RankExtreme") },
  ];

  const concepts = buildConceptOptions();

  return [
    `<form class="lgc-wizard-form" data-tier="${tier}">`,

    '<div class="form-group">',
    `<label>${t("LGC.NpcWizard.Name")}</label>`,
    '<div class="form-fields">',
    '<div class="lgc-name-row">',
    '<input type="text" name="name" />',
    '<button type="button" class="lgc-random-name-btn" title="' + t("LGC.NpcWizard.RandomName") + '"><i class="fa-solid fa-dice"></i></button>',
    "</div>",
    "</div>",
    "</div>",

    '<div class="form-group">',
    `<label>${t("LGC.NpcWizard.Concept")}</label>`,
    '<div class="form-fields">',
    `<select name="concept">${concepts}</select>`,
    "</div>",
    "</div>",

    '<div class="form-group">',
    `<label>${t("LGC.NpcWizard.Level")}</label>`,
    '<div class="form-fields">',
    '<input type="number" name="level" value="1" />',
    `<p class="lgc-level-warning" style="display:none;">${t("LGC.NpcWizard.LevelOutOfRange")}</p>`,
    "</div>",
    "</div>",

    '<div class="form-group">',
    `<label>${t("LGC.NpcWizard.Image")}</label>`,
    '<div class="form-fields">',
    '<div class="lgc-file-picker-row">',
    '<input type="text" name="img" />',
    `<button type="button" class="lgc-browse-btn">${t("LGC.NpcWizard.Browse")}</button>`,
    "</div>",
    "</div>",
    "</div>",

    buildTraitsSection(traits),
    tier >= 2 ? buildSkillsSection(skills, ranks, skillRows) : "",
    tier >= 3 ? buildThresholdsSection(thresholdRows) : "",

    "</form>",
  ].join("\n");
}

function buildSkillsSection(
  skills: string[],
  ranks: { value: string; label: string }[],
  rows: SkillRow[],
): string {
  return [
    '<div class="lgc-skills-section">',
    `<label><strong>${t("LGC.NpcWizard.Skills")}</strong></label>`,
    '<div class="lgc-skill-rows">',
    ...rows.map((row) => skillRowHtml(row, skills, ranks)),
    "</div>",
    `<button type="button" class="lgc-add-skill-btn">${t("LGC.NpcWizard.AddSkill")}</button>`,
    "</div>",
  ].join("\n");
}

function skillRowHtml(row: SkillRow, skills: string[], ranks: { value: string; label: string }[]): string {
  const skillOpts = skills
    .map((s) => `<option value="${s}"${s === row.skill ? " selected" : ""}>${s}</option>`)
    .join("");
  const rankOpts = ranks
    .map((r) => `<option value="${r.value}"${r.value === row.rank ? " selected" : ""}>${r.label}</option>`)
    .join("");
  return (
    '<div class="lgc-skill-row" data-row-id="' + row.id + '">' +
    `<select name="skill_${row.id}">${skillOpts}</select>` +
    `<select name="rank_${row.id}">${rankOpts}</select>` +
    `<button type="button" class="lgc-remove-skill-btn" data-row-id="${row.id}">${t("LGC.NpcWizard.RemoveSkill")}</button>` +
    "</div>"
  );
}

function buildThresholdsSection(rows: ThresholdRow[]): string {
  return [
    '<div class="lgc-thresholds-section">',
    `<label><strong>${t("LGC.NpcWizard.InfluenceThresholds")}</strong></label>`,
    '<div class="lgc-threshold-rows">',
    ...rows.map(thresholdRowHtml),
    "</div>",
    `<button type="button" class="lgc-add-threshold-btn">${t("LGC.NpcWizard.AddThreshold")}</button>`,
    "</div>",
  ].join("\n");
}

function buildTraitsSection(traits: string[]): string {
  const allTraits = getAvailableTraits();
  const options = allTraits
    .map((entry) => `<option value="${entry.label}">`)
    .join("");
  return [
    '<div class="lgc-traits-section">',
    `<label><strong>${t("LGC.NpcWizard.Traits")}</strong></label>`,
    '<div class="lgc-traits-add-row">',
    `<input type="text" class="lgc-trait-input" list="lgc-trait-datalist" placeholder="${t("LGC.NpcWizard.TraitSearch")}" autocomplete="off" />`,
    `<datalist id="lgc-trait-datalist">${options}</datalist>`,
    `<button type="button" class="lgc-add-trait-btn">${t("LGC.NpcWizard.AddTrait")}</button>`,
    "</div>",
    '<div class="lgc-trait-tags">',
    ...traits.map(traitTagHtml),
    "</div>",
    "</div>",
  ].join("\n");
}

function traitTagHtml(slug: string): string {
  const allTraits = getAvailableTraits();
  const entry = allTraits.find((e) => e.slug === slug);
  const label = entry?.label ?? slug;
  return (
    `<span class="lgc-trait-tag" data-slug="${slug}">` +
    `${label}` +
    `<button type="button" class="lgc-remove-trait-btn" data-slug="${slug}" title="${t("LGC.NpcWizard.RemoveTrait")}">×</button>` +
    `</span>`
  );
}

function thresholdRowHtml(row: ThresholdRow): string {
  return (
    '<div class="lgc-threshold-row" data-row-id="' + row.id + '">' +
    `<input type="number" name="threshold_num_${row.id}" value="${row.number}" min="1" max="20" placeholder="${t("LGC.NpcWizard.ThresholdNumber")}" />` +
    `<input type="text" name="threshold_desc_${row.id}" value="${row.description}" placeholder="${t("LGC.NpcWizard.ThresholdDescription")}" />` +
    `<button type="button" class="lgc-remove-threshold-btn" data-row-id="${row.id}">${t("LGC.NpcWizard.RemoveThreshold")}</button>` +
    "</div>"
  );
}

function buildConceptOptions(): string {
  return CONCEPTS
    .map((c) => `<option value="${c.id}">${game.i18n?.localize(c.localizationKey) ?? c.id}</option>`)
    .join("\n");
}

function bindFormEvents(
  $html: JQuery,
  traits: string[],
  skillRows: SkillRow[],
  thresholdRows: ThresholdRow[],
): void {
  $html.find('input[name="level"]').on("input change", function () {
    const val = Number($(this).val());
    const outOfRange = val < -1 || val > 24;
    $html.find(".lgc-level-warning").toggle(outOfRange);
  });

  $html.find(".lgc-random-name-btn").on("click", async () => {
    const name = await rollRandomName();
    if (name) {
      $html.find('input[name="name"]').val(name);
    }
  });

  $html.find(".lgc-browse-btn").on("click", () => {
    const fp = new FilePicker({
      type: "image",
      current: $html.find('input[name="img"]').val() as string,
      callback: (path: string) => {
        $html.find('input[name="img"]').val(path);
      },
    });
    fp.render(true);
  });

  $html.find(".lgc-add-trait-btn").on("click", () => {
    const $input = $html.find(".lgc-trait-input");
    const inputVal = String($input.val() ?? "").trim();
    if (!inputVal) return;
    const allTraits = getAvailableTraits();
    const match = allTraits.find((e) => e.label.toLowerCase() === inputVal.toLowerCase());
    const slug = match?.slug ?? inputVal.toLowerCase().replace(/\s+/g, "-");
    if (!traits.includes(slug)) {
      traits.push(slug);
      refreshTraitsSection($html, traits);
    }
    $input.val("").trigger("focus");
  });

  $html.on("click", ".lgc-remove-trait-btn", function () {
    const slug = String($(this).data("slug"));
    const idx = traits.indexOf(slug);
    if (idx >= 0) traits.splice(idx, 1);
    refreshTraitsSection($html, traits);
  });

  $html.find(".lgc-add-skill-btn").on("click", () => {
    syncSkillRowsFromDom($html, skillRows);
    skillRows.push({ id: foundry.utils.randomID(), skill: "", rank: "MEDIUM" });
    refreshSkillsSection($html, skillRows);
  });

  $html.on("click", ".lgc-remove-skill-btn", function () {
    syncSkillRowsFromDom($html, skillRows);
    const id = $(this).data("row-id");
    const idx = skillRows.findIndex((r) => r.id === id);
    if (idx >= 0) skillRows.splice(idx, 1);
    refreshSkillsSection($html, skillRows);
  });

  $html.find(".lgc-add-threshold-btn").on("click", () => {
    syncThresholdRowsFromDom($html, thresholdRows);
    thresholdRows.push({ id: foundry.utils.randomID(), number: thresholdRows.length + 1, description: "" });
    refreshThresholdsSection($html, thresholdRows);
  });

  $html.on("click", ".lgc-remove-threshold-btn", function () {
    syncThresholdRowsFromDom($html, thresholdRows);
    const id = $(this).data("row-id");
    const idx = thresholdRows.findIndex((r) => r.id === id);
    if (idx >= 0) thresholdRows.splice(idx, 1);
    refreshThresholdsSection($html, thresholdRows);
  });
}

function syncSkillRowsFromDom($html: JQuery, skillRows: SkillRow[]): void {
  for (const row of skillRows) {
    row.skill = String($html.find(`select[name="skill_${row.id}"]`).val() ?? row.skill);
    row.rank = String($html.find(`select[name="rank_${row.id}"]`).val() ?? row.rank);
  }
}

function syncThresholdRowsFromDom($html: JQuery, thresholdRows: ThresholdRow[]): void {
  for (const row of thresholdRows) {
    row.number = Number($html.find(`input[name="threshold_num_${row.id}"]`).val() ?? row.number);
    row.description = String($html.find(`input[name="threshold_desc_${row.id}"]`).val() ?? row.description);
  }
}

function refreshTraitsSection($html: JQuery, traits: string[]): void {
  $html.find(".lgc-traits-section .lgc-trait-tags").html(traits.map(traitTagHtml).join("\n"));
}

function refreshSkillsSection($html: JQuery, skillRows: SkillRow[]): void {
  const skills = getAvailableSkills();
  const ranks = [
    { value: "LOW", label: t("LGC.NpcWizard.RankLow") },
    { value: "MEDIUM", label: t("LGC.NpcWizard.RankMedium") },
    { value: "HIGH", label: t("LGC.NpcWizard.RankHigh") },
    { value: "EXTREME", label: t("LGC.NpcWizard.RankExtreme") },
  ];
  $html
    .find(".lgc-skills-section .lgc-skill-rows")
    .html(skillRows.map((row) => skillRowHtml(row, skills, ranks)).join("\n"));
}

function refreshThresholdsSection($html: JQuery, thresholdRows: ThresholdRow[]): void {
  $html
    .find(".lgc-thresholds-section .lgc-threshold-rows")
    .html(thresholdRows.map(thresholdRowHtml).join("\n"));
}

function collectForm(
  $html: JQuery,
  tier: Tier,
  traits: string[],
  skillRows: SkillRow[],
  thresholdRows: ThresholdRow[],
): WizardResult | null {
  const name = String($html.find('input[name="name"]').val() ?? "").trim();
  const conceptId = String($html.find('select[name="concept"]').val() ?? "");
  const level = Number($html.find('input[name="level"]').val() ?? 1);
  const img = String($html.find('input[name="img"]').val() ?? "").trim() || "icons/svg/mystery-man.svg";

  if (!name) {
    ui.notifications?.error(t("LGC.NpcWizard.NameRequired"));
    return null;
  }
  if (!conceptId) {
    ui.notifications?.error(t("LGC.NpcWizard.ConceptRequired"));
    return null;
  }

  const skills: SkillRow[] = [];
  for (const row of skillRows) {
    const skill = String($html.find(`select[name="skill_${row.id}"]`).val() ?? "").trim();
    const rank = String($html.find(`select[name="rank_${row.id}"]`).val() ?? "MEDIUM");
    if (skill) skills.push({ id: row.id, skill, rank });
  }

  const thresholds: ThresholdRow[] = [];
  for (const row of thresholdRows) {
    const number = Number($html.find(`input[name="threshold_num_${row.id}"]`).val() ?? row.number);
    const description = String($html.find(`input[name="threshold_desc_${row.id}"]`).val() ?? "").trim();
    thresholds.push({ id: row.id, number, description });
  }

  return { tier, name, conceptId, level, img, traits: [...traits], skills, thresholds };
}

async function rollRandomName(): Promise<string | null> {
  try {
    const uuid = (game.settings as any)?.get("lazybobcat-generic-content", "npcNameRollTableUuid") as string | undefined;
    if (!uuid) return null;

    const table = (await fromUuid(uuid)) as RollTable | null;
    if (!table || !(table instanceof RollTable)) return null;

    const result = await table.draw({ displayChat: false } as any);
    const first = result.results?.[0];
    if (!first) return null;

    const text = (first as any).description ?? (first as any).text ?? (first as any).name ?? "";
    return String(text).replace(/<[^>]*>/g, "").trim() || null;
  } catch {
    ui.notifications?.warn(t("LGC.NpcWizard.NameRollFailed"));
    return null;
  }
}

function getAvailableSkills(): string[] {
  const skills = (game as any).system?.model?.Actor?.npc?.system?.skills;
  if (!skills || typeof skills !== "object") return DEFAULT_SKILLS;
  return Object.keys(skills)
    .filter((k) => k !== "additional")
    .map((k) => k.charAt(0).toUpperCase() + k.slice(1));
}

function getAvailableTraits(): { slug: string; label: string }[] {
  const cfg = (globalThis as any).CONFIG?.PF2E?.creatureTraits as Record<string, string> | undefined;
  if (cfg && typeof cfg === "object") {
    return Object.entries(cfg)
      .map(([slug, label]) => ({ slug, label: game.i18n?.localize(label) ?? label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }
  return DEFAULT_TRAITS.map((slug) => ({ slug, label: slug.charAt(0).toUpperCase() + slug.slice(1) }));
}

const DEFAULT_TRAITS = [
  "aberration", "beast", "celestial", "construct", "dragon",
  "elemental", "fey", "fiend", "humanoid", "monitor", "ooze",
  "plant", "spirit", "undead",
];

const DEFAULT_SKILLS = [
  "Acrobatics", "Arcana", "Athletics", "Crafting", "Deception",
  "Diplomacy", "Intimidation", "Medicine", "Nature", "Occultism",
  "Performance", "Religion", "Society", "Stealth", "Survival", "Thievery",
];
