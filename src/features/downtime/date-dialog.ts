import { escapeHtml } from "../../lib/html";

const t = (k: string) => game.i18n?.localize(k) ?? k;
const DialogV2 = (foundry as any).applications.api.DialogV2;

/**
 * Opens a date-picker dialog for setting a downtime timestamp.
 * Uses Simple Calendar date fields when available; falls back to a day-number input.
 */
export function openDatePickerDialog(
  title: string,
  initialTimestamp: number,
  onConfirm: (timestamp: number) => Promise<void>,
): void {
  const sc = (globalThis as any).SimpleCalendar?.api;
  const now = (game as any).time?.worldTime ?? 0;

  let content: string;

  if (sc) {
    let date: { year: number; month: number; day: number } = { year: 0, month: 0, day: 1 };
    try {
      date = sc.timestampToDate(initialTimestamp);
    } catch {
      try {
        date = sc.timestampToDate(now);
      } catch { /* leave defaults */ }
    }

    const months = (sc.getAllMonths?.() ?? []) as Array<{ name: string }>;
    const monthOptions = months.length
      ? months.map((m, i) =>
          `<option value="${i}" ${date.month === i ? "selected" : ""}>${escapeHtml(m.name)}</option>`,
        ).join("")
      : `<option value="${date.month}" selected>${date.month + 1}</option>`;

    content = `
      <form class="lgc-dialog-form lgc-date-dialog-form">
        <div class="form-group">
          <label>${t("LGC.Downtime.Year")}</label>
          <input type="number" name="year" value="${date.year}" step="1" />
        </div>
        <div class="form-group">
          <label>${t("LGC.Downtime.Month")}</label>
          <select name="month">${monthOptions}</select>
        </div>
        <div class="form-group">
          <label>${t("LGC.Downtime.DayOfMonth")}</label>
          <input type="number" name="day" value="${date.day}" min="1" step="1" />
        </div>
        <div class="form-group">
          <label></label>
          <button type="button" class="lgc-date-use-now-btn">
            <i class="fa-solid fa-clock"></i> ${t("LGC.Downtime.UseCurrentTime")}
          </button>
        </div>
      </form>`;
  } else {
    const day = Math.floor(initialTimestamp / 86400);
    content = `
      <form class="lgc-dialog-form lgc-date-dialog-form">
        <div class="form-group">
          <label>${t("LGC.Downtime.DayNumber")}</label>
          <input type="number" name="day" value="${day}" min="0" step="1" />
        </div>
        <div class="form-group">
          <label></label>
          <button type="button" class="lgc-date-use-now-btn">
            <i class="fa-solid fa-clock"></i> ${t("LGC.Downtime.UseCurrentTime")}
          </button>
        </div>
      </form>`;
  }

  DialogV2.wait({
    window: { title },
    content,
    classes: ["lgc-dialog", "lgc-date-dialog"],
    rejectClose: false,
    render: (_event: Event, dialog: any) => {
      const $d = $(dialog.element);
      $d.find(".lgc-date-use-now-btn").on("click", () => {
        if (sc) {
          try {
            const nowDate = sc.timestampToDate(now);
            $d.find('input[name="year"]').val(nowDate.year);
            $d.find('select[name="month"]').val(nowDate.month);
            $d.find('input[name="day"]').val(nowDate.day);
          } catch { /* ignore */ }
        } else {
          $d.find('input[name="day"]').val(Math.floor(now / 86400));
        }
      });
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
        label: t("LGC.Downtime.Confirm"),
        default: true,
        callback: async (_event: Event, _button: HTMLButtonElement, dialog: any) => {
          const $d = $(dialog.element);
          let timestamp: number;
          if (sc) {
            const year = Number($d.find('input[name="year"]').val());
            const month = Number($d.find('select[name="month"]').val());
            const day = Number($d.find('input[name="day"]').val());
            try {
              timestamp = sc.dateToTimestamp({ year, month, day, hour: 0, minute: 0, seconds: 0 });
            } catch {
              timestamp = initialTimestamp;
            }
          } else {
            timestamp = Number($d.find('input[name="day"]').val()) * 86400;
          }
          await onConfirm(timestamp);
        },
      },
    ],
  });
}
