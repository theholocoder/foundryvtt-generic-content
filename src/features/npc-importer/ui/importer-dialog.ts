import { toJQuery } from "../../../lib/foundry";

export function openNpcImportDialog(
  onSubmit: (rawJson: string, opts: { createJournal: boolean; createInfluence: boolean }) =>
    Promise<void>,
): void {
  const t = (k: string) => game.i18n?.localize(k) ?? k;

  const content = [
    '<form class="lgc-npc-import">',
    '  <div class="form-group">',
    `    <label>${t("LGC.NpcImporter.PasteJson")}</label>`,
    '    <textarea name="npcJson" rows="18" style="font-family: monospace;" placeholder="Paste JSON here"></textarea>',
    "  </div>",
    "  <hr>",
    '  <div class="form-group">',
    "    <label>",
    '      <input type="checkbox" name="createJournal" checked>',
    `      ${t("LGC.NpcImporter.CreateJournal")}`,
    "    </label>",
    "  </div>",
    '  <div class="form-group">',
    "    <label>",
    '      <input type="checkbox" name="createInfluence">',
    `      ${t("LGC.NpcImporter.CreateInfluence")}`,
    "    </label>",
    "  </div>",
    "</form>",
  ].join("\n");

  const dlg = new Dialog({
    title: t("LGC.NpcImporter.DialogTitle"),
    content,
    buttons: {
      create: {
        icon: '<i class="fa-solid fa-wand-magic-sparkles"></i>',
        label: t("LGC.NpcImporter.Create"),
        callback: async (html: any) => {
          const $html = toJQuery(html);
          const raw = String($html.find("textarea[name=npcJson]").val() ?? "").trim();
          const createJournal = Boolean(
            $html.find("input[name=createJournal]").prop("checked"),
          );
          const createInfluence =
            createJournal &&
            Boolean($html.find("input[name=createInfluence]").prop("checked"));
          await onSubmit(raw, { createJournal, createInfluence });
        },
      },
      cancel: {
        icon: '<i class="fa-solid fa-xmark"></i>',
        label: t("LGC.NpcImporter.Cancel"),
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
