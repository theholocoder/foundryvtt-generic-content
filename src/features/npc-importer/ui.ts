export function toJQuery(html: unknown): JQuery {
  // Foundry hook callbacks vary between Application (jQuery) and ApplicationV2 (HTMLElement).
  if ((globalThis as any).jQuery && html instanceof (globalThis as any).jQuery) {
    return html as JQuery;
  }
  return $(html as any);
}

export function injectImportButton(
  html: unknown,
  opts: {
    buttonId: string;
    label: string;
    onClick: () => void;
  },
): void {
  const $html = toJQuery(html);
  if (!$html?.length) return;
  if ($html.find(`#${opts.buttonId}`).length) return;

  const footer = $html.find(".directory-footer");
  if (!footer.length) return;

  const btn = $(
    `<button type="button" id="${opts.buttonId}" class="lgc-btn-import-npc">
      <i class="fa-solid fa-file-import"></i>
      ${opts.label}
    </button>`,
  );

  btn.on("click", opts.onClick);
  footer.append(btn);
}

export function openNpcImportDialog(
  onSubmit: (rawJson: string, opts: { createJournal: boolean; createInfluence: boolean }) =>
    Promise<void>,
): void {
  const content = [
    '<form class="lgc-npc-import">',
    "  <div class=\"form-group\">",
    "    <label>pf2.tools JSON</label>",
    "    <textarea name=\"npcJson\" rows=\"18\" style=\"font-family: monospace;\" placeholder=\"Paste JSON here\"></textarea>",
    "  </div>",
    "  <hr>",
    "  <div class=\"form-group\">",
    "    <label>",
    "      <input type=\"checkbox\" name=\"createJournal\" checked>",
    "      Create journal entry",
    "    </label>",
    "  </div>",
    "  <div class=\"form-group\">",
    "    <label>",
    "      <input type=\"checkbox\" name=\"createInfluence\">",
    "      Add influence statblock",
    "    </label>",
    "  </div>",
    "</form>",
  ].join("\n");

  const dlg = new Dialog({
    title: "Import NPC (pf2.tools JSON)",
    content,
    buttons: {
      create: {
        icon: '<i class="fa-solid fa-wand-magic-sparkles"></i>',
        label: "Create",
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
        label: "Cancel",
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
