import { escapeHtml } from "../../../../lib/html";

const t = (k: string) => game.i18n?.localize(k) ?? k;
const DialogV2 = (foundry as any).applications.api.DialogV2;

export interface BeatDialogResult {
  name: string;
  description: string;
}

export function openAddBeatDialog(
  onSubmit: (result: BeatDialogResult) => Promise<void>,
  initialValues?: Partial<BeatDialogResult>,
): void {
  const isEdit = initialValues !== undefined;
  const title = isEdit ? t("LGC.Director.Dialog.Beat.EditTitle") : t("LGC.Director.Dialog.Beat.Title");
  const confirmLabel = isEdit ? t("LGC.Director.Dialog.Beat.Update") : t("LGC.Director.Dialog.Beat.Create");

  const content = `
    <form class="lgc-director-dialog-form">
      <div class="form-group">
        <label>${t("LGC.Director.Dialog.Beat.Name")}</label>
        <input type="text" name="name" value="${escapeHtml(initialValues?.name ?? "")}" placeholder="${t("LGC.Director.Dialog.Beat.NamePlaceholder")}" required autofocus />
      </div>
      <div class="form-group">
        <label>${t("LGC.Director.Dialog.Beat.Description")}</label>
        <textarea name="description" rows="3" placeholder="${t("LGC.Director.Dialog.Beat.DescPlaceholder")}">${escapeHtml(initialValues?.description ?? "")}</textarea>
      </div>
    </form>
  `;

  DialogV2.wait({
    window: { title },
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
        label: confirmLabel,
        default: true,
        callback: async (_event: Event, _button: HTMLButtonElement, dialog: any) => {
          const $html = $(dialog.element);
          const name = ($html.find('input[name="name"]').val() as string)?.trim();
          if (!name) {
            ui?.notifications?.warn(t("LGC.Director.Dialog.Beat.NameRequired"));
            return;
          }
          const description = ($html.find('textarea[name="description"]').val() as string)?.trim() ?? "";
          await onSubmit({ name, description });
        },
      },
    ],
  });
}
