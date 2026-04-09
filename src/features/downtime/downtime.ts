import { toJQuery } from "../../lib/foundry/jquery";
import { escapeHtml } from "../../lib/html";
import { computeDowntimeDays, computeUsedDays } from "./compute";
import { openActivityDialog } from "./activity-dialog";
import { openDatePickerDialog } from "./date-dialog";
import type { Activity, ActivityRoll, DowntimeData, HistoryEntry } from "./types";

const MODULE_ID = "lazybobcat-generic-content";
const TAB_NAME = "lgc-downtime";
const t = (k: string) => game.i18n?.localize(k) ?? k;

/**
 * Tracks the last active primary tab per sheet instance (keyed by app.appId).
 * Persists across re-renders so any flag change (by any user) restores the
 * correct tab rather than jumping to the default "character" tab.
 */
const activeTabByApp = new Map<number, string>();

export function registerDowntime(): void {
  Hooks.on("closeCharacterSheetPF2e" as any, (app: any) => {
    activeTabByApp.delete(app.appId);
  });

  Hooks.on("renderCharacterSheetPF2e" as any, (app: any, html: any) => {
    const actor = app.actor ?? app.document;
    if (!actor) return;

    const $html = toJQuery(html);
    const isGM: boolean = !!(game as any).user?.isGM;
    const canEdit: boolean = !!actor.isOwner;

    if ($html.find(`section[data-tab="${TAB_NAME}"]`).length) return;

    // ── Inject tab nav link ──────────────────────────────────────────────

    const tabLink = `<a class="item" data-tab="${TAB_NAME}" data-group="primary" role="tab"
        aria-label="${t("LGC.Downtime.Title")}" data-tooltip="${t("LGC.Downtime.Title")}">
        <i class="fa-solid fa-hourglass-half"></i>
      </a>`;
    const spellTab = $html.find('nav.sheet-navigation a[data-tab="spellcasting"]');
    if (spellTab.length) spellTab.after(tabLink);
    else $html.find("nav.sheet-navigation").append(tabLink);

    // ── Inject tab content section ───────────────────────────────────────

    const derived = getDerived(actor);
    const tabSection = buildTabSection(derived, isGM, canEdit);
    const spellSection = $html.find('section.tab[data-tab="spellcasting"]');
    if (spellSection.length) spellSection.after(tabSection);
    else $html.find('section.tab[data-group="primary"]').first().parent().append(tabSection);

    // ── Restore active tab if it was our tab before the re-render ────────

    if (activeTabByApp.get(app.appId) === TAB_NAME) {
      activateDowntimeTab($html);
    }

    // Track which primary tab the user navigates to (survives re-renders)
    $html.find("nav.sheet-navigation").on("click", ".item", function () {
      const tab = $(this).data("tab") as string | undefined;
      if (tab) activeTabByApp.set(app.appId, tab);
    });

    // ── Event wiring ─────────────────────────────────────────────────────

    if (isGM) {
      $html.find(".lgc-downtime-set-active").on("click", (ev) => {
        ev.stopPropagation();
        const data = actor.getFlag(MODULE_ID, "downtime") as DowntimeData | undefined;
        const current = data?.lastActiveTime ?? currentWorldTime();
        openDatePickerDialog(t("LGC.Downtime.SetActiveDate"), current, async (ts) => {
          await actor.setFlag(MODULE_ID, "downtime.lastActiveTime", ts);
        });
      });

      $html.find(".lgc-downtime-set-end").on("click", (ev) => {
        ev.stopPropagation();
        const data = actor.getFlag(MODULE_ID, "downtime") as DowntimeData | undefined;
        const current = data?.endTime ?? currentWorldTime();
        openDatePickerDialog(t("LGC.Downtime.SetEndDate"), current, async (ts) => {
          await actor.setFlag(MODULE_ID, "downtime.endTime", ts);
        });
      });

      $html.find(".lgc-downtime-finalize").on("click", async (ev) => {
        ev.stopPropagation();
        const data = actor.getFlag(MODULE_ID, "downtime") as DowntimeData | undefined;
        const startTime = data?.lastActiveTime;
        const endTime = data?.endTime;
        if (startTime == null || endTime == null) {
          ui?.notifications?.warn(t("LGC.Downtime.FinalizeError"));
          return;
        }
        const entry: HistoryEntry = {
          id: (foundry.utils as any).randomID() as string,
          startTime,
          endTime,
          activities: data?.activities ?? [],
        };
        const newData: DowntimeData = {
          lastActiveTime: endTime,
          endTime: null,
          activities: [],
          history: [...(data?.history ?? []), entry],
        };
        await actor.setFlag(MODULE_ID, "downtime", newData);
      });
    }

    if (canEdit) {
      $html.find(".lgc-downtime-add-activity").on("click", (ev) => {
        ev.stopPropagation();
        openActivityDialog(async (result) => {
          const data = actor.getFlag(MODULE_ID, "downtime") as DowntimeData | undefined;
          const activities: Activity[] = [
            ...(data?.activities ?? []),
            { id: (foundry.utils as any).randomID() as string, ...result },
          ];
  
          await actor.setFlag(MODULE_ID, "downtime.activities", activities);
        });
      });
    }

    // Edit (GM only) and delete (GM or owner of planned activity) via event delegation
    if (isGM) {
      $html.find(".lgc-downtime-activities-list").on("click", ".lgc-downtime-edit-btn", (ev) => {
        ev.stopPropagation();
        const id = $(ev.currentTarget).data("id") as string;
        const data = actor.getFlag(MODULE_ID, "downtime") as DowntimeData | undefined;
        const activity = data?.activities?.find((a: Activity) => a.id === id);
        if (!activity) return;
        openActivityDialog(async (result) => {
          const current = actor.getFlag(MODULE_ID, "downtime") as DowntimeData | undefined;
          const activities = (current?.activities ?? []).map((a: Activity) =>
            a.id === id ? { ...a, ...result } : a,
          );

          await actor.setFlag(MODULE_ID, "downtime.activities", activities);
        }, activity);
      });

      $html.find(".lgc-downtime-activities-list").on("click", ".lgc-downtime-success-btn", async (ev) => {
        ev.stopPropagation();
        const id = $(ev.currentTarget).data("id") as string;
        const data = actor.getFlag(MODULE_ID, "downtime") as DowntimeData | undefined;
        const activities = (data?.activities ?? []).map((a: Activity) =>
          a.id === id ? { ...a, outcome: "success" as const } : a,
        );
        await actor.setFlag(MODULE_ID, "downtime.activities", activities);
      });

      $html.find(".lgc-downtime-activities-list").on("click", ".lgc-downtime-failure-btn", async (ev) => {
        ev.stopPropagation();
        const id = $(ev.currentTarget).data("id") as string;
        const data = actor.getFlag(MODULE_ID, "downtime") as DowntimeData | undefined;
        const activities = (data?.activities ?? []).map((a: Activity) =>
          a.id === id ? { ...a, outcome: "failure" as const } : a,
        );
        await actor.setFlag(MODULE_ID, "downtime.activities", activities);
      });

      $html.find(".lgc-downtime-activities-list").on("click", ".lgc-downtime-reset-btn", async (ev) => {
        ev.stopPropagation();
        const id = $(ev.currentTarget).data("id") as string;
        const data = actor.getFlag(MODULE_ID, "downtime") as DowntimeData | undefined;
        const activities = (data?.activities ?? []).map((a: Activity) =>
          a.id === id ? { ...a, status: "planned" as const, outcome: null, rolls: [] } : a,
        );
        await actor.setFlag(MODULE_ID, "downtime.activities", activities);
      });
    }

    if (canEdit) {
      $html.find(".lgc-downtime-activities-list").on("click", ".lgc-downtime-delete-btn", async (ev) => {
        ev.stopPropagation();
        const id = $(ev.currentTarget).data("id") as string;
        const data = actor.getFlag(MODULE_ID, "downtime") as DowntimeData | undefined;
        const activity = data?.activities?.find((a: Activity) => a.id === id);
        // Players can only delete planned activities; GMs can delete any
        if (!activity || (!isGM && activity.status !== "planned")) return;
        const activities = (data?.activities ?? []).filter((a: Activity) => a.id !== id);

        await actor.setFlag(MODULE_ID, "downtime.activities", activities);
      });

      $html.find(".lgc-downtime-activities-list").on("click", ".lgc-downtime-roll-btn", async (ev) => {
        ev.stopPropagation();
        const id = $(ev.currentTarget).data("id") as string;
        const data = actor.getFlag(MODULE_ID, "downtime") as DowntimeData | undefined;
        const activity = data?.activities?.find((a: Activity) => a.id === id);
        if (!activity?.formula) {
          ui?.notifications?.warn(t("LGC.Downtime.NoFormula"));
          return;
        }
        try {
          const roll = await new (Roll as any)(activity.formula, actor).roll({ async: true });
          await roll.toMessage({
            speaker: (ChatMessage as any).getSpeaker({ actor }),
            flavor: `${activity.type} — ${t("LGC.Downtime.Title")}`,
          });
          const rollData: ActivityRoll = {
            formula: activity.formula,
            result: roll.total as number,
            timestamp: currentWorldTime(),
          };
          const newRolls = [...(activity.rolls ?? []), rollData];
          const rollCount = activity.rollCount ?? 1;
          const nowComplete = newRolls.length >= rollCount;
          const activities = (data?.activities ?? []).map((a: Activity) =>
            a.id === id
              ? { ...a, rolls: newRolls, ...(nowComplete ? { status: "completed" as const } : {}) }
              : a,
          );
          await actor.setFlag(MODULE_ID, "downtime.activities", activities);
        } catch (err) {
          console.error("LGC | Downtime roll failed:", err);
          ui?.notifications?.error(t("LGC.Downtime.RollFailed"));
        }
      });
    }
  });
}

// ── Private helpers ──────────────────────────────────────────────────────────

function currentWorldTime(): number {
  return (game as any).time?.worldTime ?? 0;
}


/** Activate the downtime tab in the current sheet DOM without a full re-render. */
function activateDowntimeTab($html: JQuery): void {
  $html.find("nav.sheet-navigation .item.active").removeClass("active");
  $html.find(`nav.sheet-navigation a[data-tab="${TAB_NAME}"]`).addClass("active");
  $html.find('section.tab.active[data-group="primary"]').removeClass("active");
  $html.find(`section[data-tab="${TAB_NAME}"]`).addClass("active");
}


interface Derived {
  lastActive: number | null;
  endTime: number | null;
  activities: Activity[];
  history: HistoryEntry[];
  availableDays: number;
  usedDays: number;
  remainingDays: number;
  exceeded: boolean;
  lastActiveDisplay: string;
  endTimeDisplay: string;
}

function getDerived(actor: any): Derived {
  const data = actor.getFlag(MODULE_ID, "downtime") as DowntimeData | undefined;
  const lastActive = data?.lastActiveTime ?? null;
  const endTime = data?.endTime ?? null;
  const activities = data?.activities ?? [];
  const history = data?.history ?? [];
  const now = currentWorldTime();
  const availableDays = computeDowntimeDays(lastActive, endTime ?? now);
  const usedDays = computeUsedDays(activities);
  return {
    lastActive,
    endTime,
    activities,
    history,
    availableDays,
    usedDays,
    remainingDays: availableDays - usedDays,
    exceeded: usedDays > availableDays,
    lastActiveDisplay: lastActive != null ? formatWorldDay(lastActive) : t("LGC.Downtime.NotSet"),
    endTimeDisplay: endTime != null ? formatWorldDay(endTime) : t("LGC.Downtime.NotSet"),
  };
}

function formatWorldDay(seconds: number): string {
  const sc = (globalThis as any).SimpleCalendar?.api;
  if (sc) {
    try {
      const date = sc.timestampToDate(seconds);
      return date.display?.date ?? `${date.day} ${date.monthName ?? date.month + 1} ${date.year}`;
    } catch {
      // fall through
    }
  }
  const day = Math.floor(seconds / 86400);
  return `${t("LGC.Downtime.Day")} ${day}`;
}

function buildActivitiesList(activities: Activity[], isGM: boolean): string {
  if (!activities.length) {
    return `<p class="lgc-downtime-empty">${t("LGC.Downtime.NoActivities")}</p>`;
  }
  return activities
    .map((a) => {
      const statusLabel =
        a.status === "completed"
          ? `${t("LGC.Downtime.StatusCompleted")}${
              a.outcome
                ? ` (${t(a.outcome === "success" ? "LGC.Downtime.OutcomeSuccess" : "LGC.Downtime.OutcomeFailure")})`
                : ""
            }`
          : t("LGC.Downtime.StatusPlanned");
      // Every cell is always rendered so the grid always has 10 children per row.
      const outcomeBtns = isGM && a.status === "completed"
        ? `<span class="lgc-downtime-outcome-btns">
            <button type="button" class="lgc-downtime-success-btn ${a.outcome === "success" ? "lgc-active" : ""}"
              data-id="${escapeHtml(a.id)}" title="${t("LGC.Downtime.OutcomeSuccess")}">
              <i class="fa-solid fa-check"></i>
            </button>
            <button type="button" class="lgc-downtime-failure-btn ${a.outcome === "failure" ? "lgc-active" : ""}"
              data-id="${escapeHtml(a.id)}" title="${t("LGC.Downtime.OutcomeFailure")}">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </span>`
        : `<span class="lgc-downtime-cell-placeholder"></span>`;
      const notesHtml = a.notes
        ? `<p class="lgc-downtime-activity-notes-text">${escapeHtml(a.notes)}</p>`
        : "";
      const rolls = a.rolls ?? [];
      const rollCount = a.rollCount ?? 1;
      const rollsRemaining = rollCount - rolls.length;
      const rollResult = rolls.length
        ? `<span class="lgc-downtime-activity-roll">
            <i class="fa-solid fa-dice-d20"></i> ${rolls.map((r) => r.result).join(" · ")}
            ${rollCount > 1 ? `<em>(${rolls.length}/${rollCount})</em>` : ""}
          </span>`
        : `<span class="lgc-downtime-activity-roll"></span>`;
      const rollBtn = a.formula && a.status !== "completed" && rollsRemaining > 0
        ? `<button type="button" class="lgc-downtime-roll-btn" data-id="${escapeHtml(a.id)}"
            title="${t("LGC.Downtime.Roll")} (${rollsRemaining} ${t("LGC.Downtime.RollsRemaining")})">
            <i class="fa-solid fa-dice-d20"></i>
          </button>`
        : `<span class="lgc-downtime-cell-placeholder"></span>`;
      const outcomeClass =
        a.status === "completed"
          ? a.outcome === "success"
            ? "lgc-downtime-outcome-success"
            : a.outcome === "failure"
              ? "lgc-downtime-outcome-failure"
              : "lgc-downtime-outcome-pending"
          : "";
      const canDelete = isGM || (a.status === "planned" && !rolls.length);
      const resetBtn = isGM && rolls.length > 0
        ? `<button type="button" class="lgc-downtime-reset-btn" data-id="${escapeHtml(a.id)}" title="${t("LGC.Downtime.Reset")}">
            <i class="fa-solid fa-arrow-rotate-left"></i>
          </button>`
        : `<span class="lgc-downtime-cell-placeholder"></span>`;
      const editBtn = isGM
        ? `<button type="button" class="lgc-downtime-edit-btn" data-id="${escapeHtml(a.id)}" title="${t("LGC.Downtime.DialogEditTitle")}">
            <i class="fa-solid fa-pencil"></i>
          </button>`
        : `<span class="lgc-downtime-cell-placeholder"></span>`;
      const deleteBtn = canDelete
        ? `<button type="button" class="lgc-downtime-delete-btn" data-id="${escapeHtml(a.id)}" title="${t("LGC.Downtime.Delete")}">
            <i class="fa-solid fa-trash"></i>
          </button>`
        : `<span class="lgc-downtime-cell-placeholder"></span>`;
      return `
        <div class="lgc-downtime-activity ${outcomeClass}">
          <span class="lgc-downtime-activity-type">${escapeHtml(a.type)}</span>
          <span class="lgc-downtime-activity-days">${a.days}d</span>
          <span class="lgc-downtime-activity-status lgc-downtime-status-${a.status}">${escapeHtml(statusLabel)}</span>
          ${outcomeBtns}
          ${rollBtn}
          ${resetBtn}
          ${editBtn}
          ${deleteBtn}
          ${rollResult}
          ${notesHtml}
        </div>`;
    })
    .join("");
}

function buildHistorySection(history: HistoryEntry[]): string {
  if (!history.length) {
    return `<p class="lgc-downtime-empty">${t("LGC.Downtime.NoHistory")}</p>`;
  }
  return history
    .slice()
    .reverse()
    .map((entry) => {
      const days = computeDowntimeDays(entry.startTime, entry.endTime);
      const startLabel = formatWorldDay(entry.startTime);
      const endLabel = formatWorldDay(entry.endTime);
      const rows = entry.activities
        .map((a) => {
          const outcomeLabel = a.outcome
            ? t(a.outcome === "success" ? "LGC.Downtime.OutcomeSuccess" : "LGC.Downtime.OutcomeFailure")
            : "—";
          return `<li class="lgc-downtime-history-activity">${escapeHtml(a.type)} (${a.days}d) → ${escapeHtml(outcomeLabel)}</li>`;
        })
        .join("");
      return `
        <details class="lgc-downtime-history-entry">
          <summary class="lgc-downtime-history-summary">
            ${escapeHtml(startLabel)} → ${escapeHtml(endLabel)}
            <em class="lgc-downtime-history-days">(${days} ${t("LGC.Downtime.Day")})</em>
          </summary>
          <ul class="lgc-downtime-history-list">${rows || `<li><em>${t("LGC.Downtime.NoActivities")}</em></li>`}</ul>
        </details>`;
    })
    .join("");
}

function buildTabSection(d: Derived, isGM: boolean, canEdit: boolean): string {
  const gmButtons = isGM
    ? `<button type="button" class="lgc-downtime-set-active">
          <i class="fa-solid fa-calendar-days"></i> ${t("LGC.Downtime.SetActiveDate")}
        </button>
        <button type="button" class="lgc-downtime-set-end">
          <i class="fa-solid fa-calendar-check"></i> ${t("LGC.Downtime.SetEndDate")}
        </button>
        <button type="button" class="lgc-downtime-finalize">
          <i class="fa-solid fa-flag-checkered"></i> ${t("LGC.Downtime.FinalizeDowntime")}
        </button>`
    : "";

  const addButton = canEdit
    ? `<button type="button" class="lgc-downtime-add-activity">
          <i class="fa-solid fa-plus"></i> ${t("LGC.Downtime.AddActivity")}
        </button>`
    : "";

  return `
    <section class="tab major lgc-downtime-tab" data-tab="${TAB_NAME}" data-group="primary">
      <div class="lgc-downtime-content">

        <div class="lgc-downtime-header">
          <dl class="lgc-downtime-dates">
            <dt>${t("LGC.Downtime.LastActive")}</dt>
            <dd class="lgc-downtime-val-last-active">${escapeHtml(d.lastActiveDisplay)}</dd>
            <dt>${t("LGC.Downtime.EndDate")}</dt>
            <dd class="lgc-downtime-val-end">${escapeHtml(d.endTimeDisplay)}</dd>
          </dl>
          <div class="lgc-downtime-header-actions">
            ${gmButtons}
          </div>
        </div>

        <div class="lgc-downtime-available">
          ${t("LGC.Downtime.AvailableDays")}: <strong class="lgc-downtime-val-days">${d.availableDays}</strong>
        </div>

        <div class="lgc-downtime-activities-section">
          <div class="lgc-downtime-activities-header">
            <h4>${t("LGC.Downtime.Activities")}</h4>
            ${addButton}
          </div>
          <div class="lgc-downtime-activities-list">
            ${buildActivitiesList(d.activities, isGM)}
          </div>
        </div>

        <div class="lgc-downtime-summary">
          <span>${t("LGC.Downtime.UsedDays")}: <strong class="lgc-downtime-val-used">${d.usedDays}</strong> / <strong class="lgc-downtime-val-available">${d.availableDays}</strong></span>
          <span>${t("LGC.Downtime.RemainingDays")}: <strong class="lgc-downtime-val-remaining">${d.remainingDays}</strong></span>
          <span class="lgc-downtime-warning" style="display:${d.exceeded ? "inline" : "none"}">
            <i class="fa-solid fa-triangle-exclamation"></i> ${t("LGC.Downtime.ExceededWarning")}
          </span>
        </div>

        <div class="lgc-downtime-history-section">
          <h4 class="lgc-downtime-history-title">${t("LGC.Downtime.History")}</h4>
          ${buildHistorySection(d.history)}
        </div>

      </div>
    </section>`;
}
