import { escapeHtml } from "../../lib/html";
import type { Activity } from "./types";

const MODULE_ID = "lazybobcat-generic-content";
const t = (k: string) => game.i18n?.localize(k) ?? k;
const getActivityTypes = (): string[] =>
  ((game.settings as any).get(MODULE_ID, "downtimeActivityTypes") as string[] | undefined) ?? [];
const DialogV2 = (foundry as any).applications.api.DialogV2;

export type ActivityDialogResult = Omit<Activity, "id">;

/**
 * @param onSubmit       Called with the result when the user confirms.
 * @param initialValues  When provided, the dialog is in edit mode (pre-filled, GM fields shown).
 * @param remainingDays  When provided, shows a quick-fill button next to the days input.
 */
export function openActivityDialog(
  onSubmit: (result: ActivityDialogResult) => Promise<void>,
  initialValues?: Partial<Activity>,
  remainingDays?: number,
): void {
  const isEdit = initialValues !== undefined;
  const isGM: boolean = !!(game as any).user?.isGM;

  const title = isEdit ? t("LGC.Downtime.DialogEditTitle") : t("LGC.Downtime.DialogAddTitle");
  const confirmLabel = isEdit ? t("LGC.Downtime.DialogConfirmEdit") : t("LGC.Downtime.DialogConfirmAdd");

  const currentStatus = initialValues?.status ?? "planned";
  const currentOutcome = initialValues?.outcome ?? null;

  const typeOptions = getActivityTypes().map(
    (at) =>
      `<option value="${escapeHtml(at)}" ${initialValues?.type === at ? "selected" : ""}>${escapeHtml(at)}</option>`,
  ).join("");

  // Formula helper and formula field are GM-only
  const formulaRows = isGM
    ? `
      <div class="form-group">
        <label>${t("LGC.Downtime.FormulaHelper")}</label>
        <select name="formula-helper">
          <option value="">${t("LGC.Downtime.FormulaHelperSelect")}</option>
          <optgroup label="Perception">
            <option value="1d20+@perception.mod">Perception</option>
          </optgroup>
          <optgroup label="${t("LGC.Downtime.FormulaSaves")}">
            <option value="1d20+@saves.fortitude.mod">Fortitude</option>
            <option value="1d20+@saves.reflex.mod">Reflex</option>
            <option value="1d20+@saves.will.mod">Will</option>
          </optgroup>
          <optgroup label="${t("LGC.Downtime.FormulaSkills")}">
            <option value="1d20+@skills.acrobatics.mod">Acrobatics</option>
            <option value="1d20+@skills.arcana.mod">Arcana</option>
            <option value="1d20+@skills.athletics.mod">Athletics</option>
            <option value="1d20+@skills.crafting.mod">Crafting</option>
            <option value="1d20+@skills.deception.mod">Deception</option>
            <option value="1d20+@skills.diplomacy.mod">Diplomacy</option>
            <option value="1d20+@skills.intimidation.mod">Intimidation</option>
            <option value="1d20+@skills.medicine.mod">Medicine</option>
            <option value="1d20+@skills.nature.mod">Nature</option>
            <option value="1d20+@skills.occultism.mod">Occultism</option>
            <option value="1d20+@skills.performance.mod">Performance</option>
            <option value="1d20+@skills.religion.mod">Religion</option>
            <option value="1d20+@skills.society.mod">Society</option>
            <option value="1d20+@skills.stealth.mod">Stealth</option>
            <option value="1d20+@skills.survival.mod">Survival</option>
            <option value="1d20+@skills.thievery.mod">Thievery</option>
          </optgroup>
          <optgroup label="${t("LGC.Downtime.FormulaAbilities")}">
            <option value="1d20+@system.abilities.str.mod">Strength</option>
            <option value="1d20+@system.abilities.dex.mod">Dexterity</option>
            <option value="1d20+@system.abilities.con.mod">Constitution</option>
            <option value="1d20+@system.abilities.int.mod">Intelligence</option>
            <option value="1d20+@system.abilities.wis.mod">Wisdom</option>
            <option value="1d20+@system.abilities.cha.mod">Charisma</option>
          </optgroup>
        </select>
      </div>
      <div class="form-group">
        <label>${t("LGC.Downtime.ActivityFormula")}</label>
        <input type="text" name="formula" value="${escapeHtml(initialValues?.formula ?? "")}" placeholder="1d20+12" />
      </div>
      <div class="form-group">
        <label>${t("LGC.Downtime.RollCount")}</label>
        <input type="number" name="rollCount" value="${initialValues?.rollCount ?? 1}" min="1" step="1" />
      </div>`
    : "";

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
        <div class="lgc-days-row">
          <input type="number" name="days" value="${initialValues?.days ?? 1}" min="0" step="1" required />
          ${remainingDays != null && remainingDays > 0
            ? `<button type="button" class="lgc-days-fill-btn" title="${t("LGC.Downtime.UseAllDays")} (${remainingDays})"><i class="fa-solid fa-angles-right"></i></button>`
            : ""}
        </div>
      </div>
      <div class="form-group">
        <label>${t("LGC.Downtime.ActivityNotes")}</label>
        <textarea name="notes" rows="2">${escapeHtml(initialValues?.notes ?? "")}</textarea>
      </div>
      ${formulaRows}
      ${statusRows}
    </form>
  `;

  DialogV2.wait({
    window: { title },
    content,
    classes: ["lgc-dialog", "lgc-downtime-dialog"],
    rejectClose: false,
    render: (_event: Event, dialog: any) => {
      const $d = $(dialog.element);

      $d.find(".lgc-days-fill-btn").on("click", function () {
        $d.find('input[name="days"]').val(remainingDays ?? 0);
      });

      // Quick-fill helper: selecting an option copies the formula and resets the select
      $d.find('select[name="formula-helper"]').on("change", function () {
        const val = $(this).val() as string;
        if (val) {
          $d.find('input[name="formula"]').val(val);
          $(this).val("");
        }
      });

      if (!isEdit || !isGM) return;
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
          const formula = ($d.find('input[name="formula"]').val() as string)?.trim() ?? "";
          const rollCount = Math.max(1, Number($d.find('input[name="rollCount"]').val()) || 1);

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

          await onSubmit({ type, days, notes, formula, rollCount, status, outcome });
        },
      },
    ],
  });
}
