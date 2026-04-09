import { escapeHtml } from "../../lib/html";
import { ACTIVITY_TYPES } from "./activity-types";
import type { Activity } from "./types";

const t = (k: string) => game.i18n?.localize(k) ?? k;
const DialogV2 = (foundry as any).applications.api.DialogV2;

export type ActivityDialogResult = Omit<Activity, "id">;

/**
 * @param onSubmit   Called with the result when the user confirms.
 * @param initialValues  When provided, the dialog is in edit mode (pre-filled, GM fields shown).
 */
export function openActivityDialog(
  onSubmit: (result: ActivityDialogResult) => Promise<void>,
  initialValues?: Partial<Activity>,
): void {
  const isEdit = initialValues !== undefined;
  const isGM: boolean = !!(game as any).user?.isGM;

  const title = isEdit ? t("LGC.Downtime.DialogEditTitle") : t("LGC.Downtime.DialogAddTitle");
  const confirmLabel = isEdit ? t("LGC.Downtime.DialogConfirmEdit") : t("LGC.Downtime.DialogConfirmAdd");

  const currentStatus = initialValues?.status ?? "planned";
  const currentOutcome = initialValues?.outcome ?? null;

  const typeOptions = ACTIVITY_TYPES.map(
    (at) =>
      `<option value="${escapeHtml(at)}" ${initialValues?.type === at ? "selected" : ""}>${escapeHtml(at)}</option>`,
  ).join("");

  // Status and outcome rows are only shown to GM when editing
  const statusRows =
    isEdit && isGM
      ? `
      <div class="form-group">
        <label>${t("LGC.Downtime.ActivityStatus")}</label>
        <select name="status">
          <option value="planned" ${currentStatus === "planned" ? "selected" : ""}>${t("LGC.Downtime.StatusPlanned")}</option>
          <option value="completed" ${currentStatus === "completed" ? "selected" : ""}>${t("LGC.Downtime.StatusCompleted")}</option>
        </select>
      </div>
      <div class="form-group lgc-downtime-outcome-row">
        <label>${t("LGC.Downtime.ActivityOutcome")}</label>
        <select name="outcome">
          <option value="" ${!currentOutcome ? "selected" : ""}>&mdash;</option>
          <option value="success" ${currentOutcome === "success" ? "selected" : ""}>${t("LGC.Downtime.OutcomeSuccess")}</option>
          <option value="failure" ${currentOutcome === "failure" ? "selected" : ""}>${t("LGC.Downtime.OutcomeFailure")}</option>
        </select>
      </div>`
      : "";

  const content = `
    <form class="lgc-dialog-form lgc-downtime-dialog-form">
      <div class="form-group">
        <label>${t("LGC.Downtime.ActivityType")}</label>
        <select name="type" required>
          <option value="" disabled ${!initialValues?.type ? "selected" : ""}>${t("LGC.Downtime.SelectType")}</option>
          ${typeOptions}
        </select>
      </div>
      <div class="form-group">
        <label>${t("LGC.Downtime.ActivityDays")}</label>
        <input type="number" name="days" value="${initialValues?.days ?? 1}" min="0" step="1" required />
      </div>
      <div class="form-group">
        <label>${t("LGC.Downtime.ActivityNotes")}</label>
        <textarea name="notes" rows="2">${escapeHtml(initialValues?.notes ?? "")}</textarea>
      </div>
      ${statusRows}
    </form>
  `;

  DialogV2.wait({
    window: { title },
    content,
    classes: ["lgc-dialog", "lgc-downtime-dialog"],
    rejectClose: false,
    render: (_event: Event, dialog: any) => {
      if (!isEdit || !isGM) return;
      const $d = $(dialog.element);
      const $outcomeRow = $d.find(".lgc-downtime-outcome-row");
      const sync = () => {
        $outcomeRow.toggle($d.find('select[name="status"]').val() === "completed");
      };
      $d.find('select[name="status"]').on("change", sync);
      sync();
    },
    buttons: [
      {
        action: "cancel",
        icon: "fa-solid fa-xmark",
        label: t("LGC.Downtime.DialogCancel"),
        type: "button",
      },
      {
        action: "confirm",
        icon: "fa-solid fa-check",
        label: confirmLabel,
        default: true,
        callback: async (_event: Event, _button: HTMLButtonElement, dialog: any) => {
          const $d = $(dialog.element);
          const type = ($d.find('select[name="type"]').val() as string)?.trim();
          const days = Number($d.find('input[name="days"]').val());
          if (!type || isNaN(days) || days < 0) {
            ui?.notifications?.warn(t("LGC.Downtime.DaysRequired"));
            return;
          }
          const notes = ($d.find('textarea[name="notes"]').val() as string)?.trim() ?? "";

          let status: Activity["status"] = "planned";
          let outcome: Activity["outcome"] = null;
          if (isEdit && isGM) {
            status = $d.find('select[name="status"]').val() as Activity["status"];
            const rawOutcome = $d.find('select[name="outcome"]').val() as string;
            outcome =
              status === "completed" && (rawOutcome === "success" || rawOutcome === "failure")
                ? rawOutcome
                : null;
          }

          await onSubmit({ type, days, notes, status, outcome });
        },
      },
    ],
  });
}
