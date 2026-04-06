const t = (k: string) => game.i18n?.localize(k) ?? k;
const DialogV2 = (foundry as any).applications.api.DialogV2;

export interface SessionDialogResult {
  name: string;
  description: string;
  image: string;
}

export function openAddSessionDialog(onSubmit: (result: SessionDialogResult) => Promise<void>): void {
  const content = `
    <form class="lgc-director-dialog-form">
      <div class="form-group">
        <label>${t("LGC.Director.Dialog.Session.Name")}</label>
        <input type="text" name="name" placeholder="${t("LGC.Director.Dialog.Session.NamePlaceholder")}" required autofocus />
      </div>
      <div class="form-group">
        <label>${t("LGC.Director.Dialog.Session.Description")}</label>
        <textarea name="description" rows="3" placeholder="${t("LGC.Director.Dialog.Session.DescPlaceholder")}"></textarea>
      </div>
      <div class="form-group">
        <label>${t("LGC.Director.Dialog.Session.Image")}</label>
        <div class="lgc-director-image-picker">
          <input type="text" name="image" placeholder="${t("LGC.Director.Dialog.Session.ImagePlaceholder")}" />
          <button type="button" class="lgc-director-browse-btn">
            <i class="fa-solid fa-folder-open"></i>
          </button>
        </div>
      </div>
    </form>
  `;

  DialogV2.wait({
    window: { title: t("LGC.Director.Dialog.Session.Title") },
    content,
    classes: ["lgc-dialog", "lgc-director-dialog"],
    rejectClose: false,
    render: (_event: Event, dialog: any) => {
      $(dialog.element).find(".lgc-director-browse-btn").on("click", () => {
        const $input = $(dialog.element).find('input[name="image"]');
        const fp = new FilePicker({
          type: "image",
          current: ($input.val() as string) || "",
          callback: (path: string) => {
            $input.val(path);
          },
        });
        fp.browse();
      });
    },
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
        label: t("LGC.Director.Dialog.Session.Create"),
        default: true,
        callback: async (_event: Event, _button: HTMLButtonElement, dialog: any) => {
          const $html = $(dialog.element);
          const name = ($html.find('input[name="name"]').val() as string)?.trim();
          if (!name) {
            ui?.notifications?.warn(t("LGC.Director.Dialog.Session.NameRequired"));
            return;
          }
          const description = ($html.find('textarea[name="description"]').val() as string)?.trim() ?? "";
          const image = ($html.find('input[name="image"]').val() as string)?.trim() ?? "";
          await onSubmit({ name, description, image });
        },
      },
    ],
  });
}
