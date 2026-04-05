import { toJQuery } from "../../../../lib/foundry";

const t = (k: string) => game.i18n?.localize(k) ?? k;

export interface SessionDialogResult {
  name: string;
  description: string;
  image: string;
}

export function openAddSessionDialog(onSubmit: (result: SessionDialogResult) => Promise<void>): void {
  let imagePath = "";

  const content = `
    <form class="lgc-director-dialog-form">
      <div class="form-group">
        <label>${t("LGC.Director.Dialog.Session.Name")}</label>
        <input type="text" name="name" placeholder="${t("LGC.Director.Dialog.Session.NamePlaceholder")}" autofocus />
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

  const dlg = new Dialog({
    title: t("LGC.Director.Dialog.Session.Title"),
    content,
    buttons: {
      cancel: {
        icon: '<i class="fa-solid fa-xmark"></i>',
        label: t("LGC.Director.Cancel"),
      },
      confirm: {
        icon: '<i class="fa-solid fa-check"></i>',
        label: t("LGC.Director.Dialog.Session.Create"),
        callback: async (html: unknown) => {
          const $html = toJQuery(html);
          const name = ($html.find('input[name="name"]').val() as string)?.trim();
          if (!name) {
            ui?.notifications?.warn(t("LGC.Director.Dialog.Session.NameRequired"));
            return false;
          }
          const description = ($html.find('textarea[name="description"]').val() as string)?.trim() ?? "";
          const image = ($html.find('input[name="image"]').val() as string)?.trim() ?? imagePath;
          await onSubmit({ name, description, image });
        },
      },
    },
    default: "confirm",
    render: (html: unknown) => {
      const $html = toJQuery(html);
      $html.closest(".app").addClass("lgc-director-dialog");

      $html.find(".lgc-director-browse-btn").on("click", () => {
        const fp = new FilePicker({
          type: "image",
          current: imagePath,
          callback: (path: string) => {
            imagePath = path;
            $html.find('input[name="image"]').val(path);
          },
        });
        fp.browse();
      });
    },
  });
  dlg.render(true);
}
