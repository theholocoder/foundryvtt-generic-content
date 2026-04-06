const t = (k: string) => game.i18n?.localize(k) ?? k;
const DialogV2 = (foundry as any).applications.api.DialogV2;

export interface NoteDialogResult {
  text: string;
}

export function openAddNoteDialog(onSubmit: (result: NoteDialogResult) => Promise<void>): void {
  const content = `
    <form class="lgc-director-dialog-form">
      <div class="form-group">
        <textarea name="text" rows="5" placeholder="${t("LGC.Director.Dialog.Note.Placeholder")}" required autofocus></textarea>
      </div>
    </form>
  `;

  DialogV2.wait({
    window: { title: t("LGC.Director.Dialog.Note.Title") },
    content,
    classes: ["lgc-dialog", "lgc-director-dialog"],
    rejectClose: false,
    buttons: [
      {
        action: "cancel",
        icon: "fa-solid fa-xmark",
        label: t("LGC.Director.Cancel"),
        type: "button",
      },
      {
        action: "confirm",
        icon: "fa-solid fa-check",
        label: t("LGC.Director.Dialog.Note.Add"),
        default: true,
        callback: async (_event: Event, _button: HTMLButtonElement, dialog: any) => {
          const $html = $(dialog.element);
          const text = ($html.find('textarea[name="text"]').val() as string)?.trim();
          if (!text) {
            ui?.notifications?.warn(t("LGC.Director.Dialog.Note.TextRequired"));
            return;
          }
          await onSubmit({ text });
        },
      },
    ],
  });
}
