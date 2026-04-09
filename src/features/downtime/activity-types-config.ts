import { MODULE_ID } from "../../settings";
import { escapeHtml } from "../../lib/html";

const t = (k: string) => game.i18n?.localize(k) ?? k;

const AppV2 = (foundry as any).applications.api.ApplicationV2 as new (options?: object) => {
  rendered: boolean;
  element: HTMLElement;
  render(options?: object): Promise<unknown>;
  close(options?: object): Promise<unknown>;
};

export class ActivityTypesConfig extends AppV2 {
  static DEFAULT_OPTIONS = {
    id: "lgc-activity-types-config",
    classes: ["lgc-dialog", "lgc-activity-types-config"],
    window: { title: "LGC.Settings.ActivityTypeTitle", resizable: false },
    position: { width: 360 },
  };

  protected async _renderHTML(): Promise<Record<string, HTMLElement>> {
    const types = ((game.settings as any).get(MODULE_ID, "downtimeActivityTypes") as string[]) ?? [];
    const rows = types
      .map(
        (type, i) => `
      <li class="lgc-type-row">
        <input type="text" name="type-${i}" value="${escapeHtml(type)}"
               placeholder="${t("LGC.Settings.ActivityTypePlaceholder")}" />
        <button type="button" class="lgc-type-delete" title="${t("LGC.Downtime.Delete")}">
          <i class="fa-solid fa-trash"></i>
        </button>
      </li>`,
      )
      .join("");

    const html = `
      <form class="lgc-activity-types-form">
        <ul class="lgc-activity-types-list">${rows}</ul>
        <button type="button" class="lgc-type-add">
          <i class="fa-solid fa-plus"></i> ${t("LGC.Settings.ActivityTypeAdd")}
        </button>
        <div class="lgc-config-footer">
          <button type="button" class="lgc-type-save">${t("LGC.Settings.ActivityTypeSave")}</button>
          <button type="button" class="lgc-type-cancel">${t("LGC.Settings.ActivityTypeCancel")}</button>
        </div>
      </form>`;

    const el = document.createElement("div");
    el.innerHTML = html;
    return { main: el.firstElementChild as HTMLElement };
  }

  protected _replaceHTML(result: Record<string, HTMLElement>, content: HTMLElement): void {
    content.replaceChildren(result.main);
    this._bindListeners($(content));
  }

  private _bindListeners($el: JQuery): void {
    $el.on("click", ".lgc-type-delete", (ev) => {
      $(ev.currentTarget).closest("li").remove();
    });

    $el.find(".lgc-type-add").on("click", () => {
      const i = $el.find(".lgc-type-row").length;
      const li = $(`<li class="lgc-type-row">
        <input type="text" name="type-${i}" placeholder="${t("LGC.Settings.ActivityTypePlaceholder")}" />
        <button type="button" class="lgc-type-delete" title="${t("LGC.Downtime.Delete")}">
          <i class="fa-solid fa-trash"></i>
        </button>
      </li>`);
      $el.find(".lgc-activity-types-list").append(li);
    });

    $el.find(".lgc-type-save").on("click", async () => {
      const types = $el
        .find("input[type='text']")
        .toArray()
        .map((el) => ($(el).val() as string).trim())
        .filter(Boolean);
      await (game.settings as any).set(MODULE_ID, "downtimeActivityTypes", types);
      await this.close();
    });

    $el.find(".lgc-type-cancel").on("click", () => this.close());
  }
}
