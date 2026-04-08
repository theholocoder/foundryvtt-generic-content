import { pickRandomPlaceImage } from "../../../lib/random-place-image";
import { getFilePicker } from "../../../lib/foundry";

const DialogV2 = (foundry as any).applications.api.DialogV2;

export const BIOMES = [
  "castle", "cave", "forest", "hills", "manor", "mountain",
  "plains", "ruins", "shop", "tavern", "temple", "tower",
] as const;

export type Biome = typeof BIOMES[number];

export interface PlaceWizardResult {
  name: string;
  regionUuid: string;
  biome: Biome | "";
  img: string;
  sceneUuid: string;
}

const t = (k: string) => game.i18n?.localize(k) ?? k;

export function openPlaceWizard(onSubmit: (result: PlaceWizardResult) => Promise<void>): void {
  const state = { regionUuid: "", sceneUuid: "" };

  DialogV2.wait({
    window: { title: t("LGC.PlaceWizard.WizardTitle") },
    content: buildFormHtml(),
    classes: ["lgc-dialog", "lgc-wizard-dialog"],
    rejectClose: false,
    render: (_event: Event, dialog: any) => {
      const $html = $(dialog.element);
      bindFormEvents($html, state);
    },
    buttons: [
      {
        action: "cancel",
        icon: "fa-solid fa-xmark",
        label: t("LGC.PlaceWizard.Cancel"),
        type: "button",
      },
      {
        action: "create",
        icon: "fa-solid fa-map-location-dot",
        label: t("LGC.PlaceWizard.Create"),
        default: true,
        callback: async (_event: Event, _button: HTMLButtonElement, dialog: any) => {
          const $html = $(dialog.element);
          const result = collectForm($html, state);
          if (result) {
            await onSubmit(result);
          }
        },
      },
    ],
  });
}

function buildFormHtml(): string {
  return [
    '<form class="lgc-wizard-form">',

    '<div class="form-group">',
    `<label>${t("LGC.PlaceWizard.Name")}</label>`,
    '<div class="form-fields">',
    '<input type="text" name="name" />',
    "</div>",
    "</div>",

    '<div class="form-group">',
    `<label>${t("LGC.PlaceWizard.Region")}</label>`,
    '<div class="form-fields">',
    buildDropZoneHtml("JournalEntry", t("LGC.PlaceWizard.RegionDrop"), "lgc-place-region-zone"),
    "</div>",
    "</div>",

    '<div class="form-group">',
    `<label>${t("LGC.PlaceWizard.BiomeLabel")}</label>`,
    '<div class="form-fields">',
    `<select name="biome"><option value="">${t("LGC.PlaceWizard.BiomeNone")}</option>${buildBiomeOptions()}</select>`,
    "</div>",
    "</div>",

    '<div class="form-group">',
    `<label>${t("LGC.PlaceWizard.Image")}</label>`,
    '<div class="form-fields">',
    '<div class="lgc-file-picker-row">',
    '<input type="text" name="img" />',
    `<button type="button" class="lgc-browse-btn">${t("LGC.PlaceWizard.Browse")}</button>`,
    `<button type="button" class="lgc-random-image-btn" title="${t("LGC.PlaceWizard.RandomImage")}"><i class="fa-solid fa-dice"></i></button>`,
    "</div>",
    "</div>",
    "</div>",

    '<div class="form-group">',
    `<label>${t("LGC.PlaceWizard.Scene")}</label>`,
    '<div class="form-fields">',
    buildDropZoneHtml("Scene", t("LGC.PlaceWizard.SceneDrop"), "lgc-place-scene-zone"),
    "</div>",
    "</div>",

    "</form>",
  ].join("\n");
}

function buildDropZoneHtml(dropType: string, placeholder: string, extraClass: string): string {
  return (
    `<div class="lgc-wizard-drop-zone ${extraClass}" data-drop-type="${dropType}" data-placeholder="${placeholder}">` +
    `<i class="fa-solid fa-hand-point-down"></i>` +
    `<span class="lgc-drop-label">${placeholder}</span>` +
    `<button type="button" class="lgc-drop-clear" style="display:none;" title="${t("LGC.PlaceWizard.ClearDrop")}">×</button>` +
    `</div>`
  );
}

function buildBiomeOptions(): string {
  return BIOMES.map(
    (b) => `<option value="${b}">${t(`LGC.PlaceWizard.Biome.${b}`)}</option>`,
  ).join("\n");
}

function bindFormEvents($html: JQuery, state: { regionUuid: string; sceneUuid: string }): void {
  const $createBtn = $html.find('[data-action="create"]');
  $createBtn.prop("disabled", true);
  $html.find('input[name="name"]').on("input", function () {
    $createBtn.prop("disabled", String($(this).val() ?? "").trim().length === 0);
  });

  bindDropZone(
    $html,
    ".lgc-place-region-zone",
    "JournalEntry",
    (uuid) => { state.regionUuid = uuid; },
    () => { state.regionUuid = ""; },
  );

  bindDropZone(
    $html,
    ".lgc-place-scene-zone",
    "Scene",
    (uuid) => { state.sceneUuid = uuid; },
    () => { state.sceneUuid = ""; },
  );

  $html.find(".lgc-browse-btn").on("click", () => {
    const fp = new (getFilePicker())({
      type: "image",
      current: $html.find('input[name="img"]').val() as string,
      callback: (path: string) => {
        $html.find('input[name="img"]').val(path);
      },
    });
    fp.render(true);
  });

  $html.find(".lgc-random-image-btn").on("click", async () => {
    try {
      const biome = String($html.find('select[name="biome"]').val() ?? "");
      const img = await pickRandomPlaceImage(biome);
      $html.find('input[name="img"]').val(img);
    } catch (err) {
      console.error("LGC | Random place image failed", err);
    }
  });
}

function bindDropZone(
  $html: JQuery,
  selector: string,
  expectedType: string,
  onSet: (uuid: string) => void,
  onClear: () => void,
): void {
  const $zone = $html.find(selector);

  $zone.on("dragover", (ev) => {
    ev.preventDefault();
    $zone.addClass("lgc-drag-over");
  });

  $zone.on("dragleave", (ev) => {
    if ($zone.has((ev.originalEvent as DragEvent).relatedTarget as Element).length) return;
    $zone.removeClass("lgc-drag-over");
  });

  $zone.on("drop", async (ev) => {
    ev.preventDefault();
    $zone.removeClass("lgc-drag-over");
    try {
      const raw = (ev.originalEvent as DragEvent).dataTransfer?.getData("text/plain");
      if (!raw) return;
      const data = JSON.parse(raw) as { type?: string; uuid?: string };
      if (!data.type || !data.uuid) return;
      if (data.type !== expectedType) return;
      const doc = await fromUuid(data.uuid);
      const name = (doc as any)?.name ?? data.uuid;
      onSet(data.uuid);
      $zone.find(".lgc-drop-label").text(name);
      $zone.addClass("lgc-drop-zone--set");
      $zone.find(".lgc-drop-clear").show();
    } catch (err) {
      console.error("LGC | Place wizard drop error", err);
    }
  });

  $zone.find(".lgc-drop-clear").on("click", (ev) => {
    ev.stopPropagation();
    onClear();
    const placeholder = String($zone.data("placeholder") ?? "");
    $zone.find(".lgc-drop-label").text(placeholder);
    $zone.removeClass("lgc-drop-zone--set");
    $zone.find(".lgc-drop-clear").hide();
  });
}

function collectForm(
  $html: JQuery,
  state: { regionUuid: string; sceneUuid: string },
): PlaceWizardResult | null {
  const name = String($html.find('input[name="name"]').val() ?? "").trim();
  if (!name) {
    ui.notifications?.error(t("LGC.PlaceWizard.NameRequired"));
    return null;
  }

  const biome = String($html.find('select[name="biome"]').val() ?? "") as Biome | "";
  const img = String($html.find('input[name="img"]').val() ?? "").trim();

  return {
    name,
    regionUuid: state.regionUuid,
    biome,
    img,
    sceneUuid: state.sceneUuid,
  };
}
