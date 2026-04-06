const DialogV2 = (foundry as any).applications.api.DialogV2;

export function openNpcImportDialog(
  onSubmit: (rawJson: string, opts: { createJournal: boolean; createInfluence: boolean }) =>
    Promise<void>,
): void {
  const t = (k: string) => game.i18n?.localize(k) ?? k;

  const content = [
    '<form class="lgc-npc-import">',
    '  <div class="form-group">',
    `    <label>${t("LGC.NpcImporter.PasteJson")}</label>`,
    '    <textarea name="npcJson" rows="18" style="font-family: monospace;" placeholder="Paste JSON here" required></textarea>',
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

  DialogV2.wait({
    window: { title: t("LGC.NpcImporter.DialogTitle") },
    content,
    classes: ["lgc-dialog"],
    rejectClose: false,
    render: (_event: Event, dialog: any) => {
      const $html = $(dialog.element);
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
    buttons: [
      {
        action: "cancel",
        icon: "fa-solid fa-xmark",
        label: t("LGC.NpcImporter.Cancel"),
        type: "button",
      },
      {
        action: "create",
        icon: "fa-solid fa-wand-magic-sparkles",
        label: t("LGC.NpcImporter.Create"),
        default: true,
        callback: async (_event: Event, _button: HTMLButtonElement, dialog: any) => {
          const $html = $(dialog.element);
          const raw = String($html.find("textarea[name=npcJson]").val() ?? "").trim();
          const createJournal = Boolean($html.find("input[name=createJournal]").prop("checked"));
          const createInfluence =
            createJournal && Boolean($html.find("input[name=createInfluence]").prop("checked"));
          await onSubmit(raw, { createJournal, createInfluence });
        },
      },
    ],
  });
}
