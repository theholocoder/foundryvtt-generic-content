import { toJQuery } from "../../../../lib/foundry";

const t = (k: string) => game.i18n?.localize(k) ?? k;

export interface NoteDialogResult {
  text: string;
}

export function openAddNoteDialog(onSubmit: (result: NoteDialogResult) => Promise<void>): void {
  const content = `
    <form class="lgc-director-dialog-form">
      <div class="form-group">
        <textarea name="text" rows="5" placeholder="${t("LGC.Director.Dialog.Note.Placeholder")}" autofocus></textarea>
      </div>
    </form>
  `;

  const dlg = new Dialog({
    title: t("LGC.Director.Dialog.Note.Title"),
    content,
    buttons: {
      cancel: {
        icon: '<i class="fa-solid fa-xmark"></i>',
        label: t("LGC.Director.Cancel"),
      },
      confirm: {
        icon: '<i class="fa-solid fa-check"></i>',
        label: t("LGC.Director.Dialog.Note.Add"),
        callback: async (html: unknown) => {
          const $html = toJQuery(html);
          const text = ($html.find('textarea[name="text"]').val() as string)?.trim();
          if (!text) {
            ui?.notifications?.warn(t("LGC.Director.Dialog.Note.TextRequired"));
            return false;
          }
          await onSubmit({ text });
        },
      },
    },
    default: "confirm",
    render: (html: unknown) => {
      const $html = toJQuery(html);
      $html.closest(".app").addClass("lgc-director-dialog");
    },
  });
  dlg.render(true);
}
