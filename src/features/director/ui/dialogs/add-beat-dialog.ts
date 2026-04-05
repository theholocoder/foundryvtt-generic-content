import { toJQuery } from "../../../../lib/foundry";

const t = (k: string) => game.i18n?.localize(k) ?? k;

export interface BeatDialogResult {
  name: string;
  description: string;
}

export function openAddBeatDialog(onSubmit: (result: BeatDialogResult) => Promise<void>): void {
  const content = `
    <form class="lgc-director-dialog-form">
      <div class="form-group">
        <label>${t("LGC.Director.Dialog.Beat.Name")}</label>
        <input type="text" name="name" placeholder="${t("LGC.Director.Dialog.Beat.NamePlaceholder")}" autofocus />
      </div>
      <div class="form-group">
        <label>${t("LGC.Director.Dialog.Beat.Description")}</label>
        <textarea name="description" rows="3" placeholder="${t("LGC.Director.Dialog.Beat.DescPlaceholder")}"></textarea>
      </div>
    </form>
  `;

  const dlg = new Dialog({
    title: t("LGC.Director.Dialog.Beat.Title"),
    content,
    buttons: {
      cancel: {
        icon: '<i class="fa-solid fa-xmark"></i>',
        label: t("LGC.Director.Cancel"),
      },
      confirm: {
        icon: '<i class="fa-solid fa-check"></i>',
        label: t("LGC.Director.Dialog.Beat.Create"),
        callback: async (html: unknown) => {
          const $html = toJQuery(html);
          const name = ($html.find('input[name="name"]').val() as string)?.trim();
          if (!name) {
            ui?.notifications?.warn(t("LGC.Director.Dialog.Beat.NameRequired"));
            return false;
          }
          const description = ($html.find('textarea[name="description"]').val() as string)?.trim() ?? "";
          await onSubmit({ name, description });
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
