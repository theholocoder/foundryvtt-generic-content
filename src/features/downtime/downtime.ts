import { toJQuery } from "../../lib/foundry/jquery";
import { escapeHtml } from "../../lib/html";
import { computeDowntimeDays, computeUsedDays } from "./compute";
import { openActivityDialog } from "./activity-dialog";
import type { Activity, DowntimeData } from "./types";

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
      $html.find(".lgc-downtime-set-active").on("click", async (ev) => {
        ev.stopPropagation();

        await actor.setFlag(MODULE_ID, "downtime.lastActiveTime", currentWorldTime());
      });

      $html.find(".lgc-downtime-set-end").on("click", async (ev) => {
        ev.stopPropagation();

        await actor.setFlag(MODULE_ID, "downtime.endTime", currentWorldTime());
      });

      $html.find(".lgc-downtime-recalculate").on("click", (ev) => {
        ev.stopPropagation();
        refreshTabInPlace($html, actor);
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

/** Recalculate derived values in-place (used by Recalculate button — no flag change). */
function refreshTabInPlace($html: JQuery, actor: any): void {
  const d = getDerived(actor);
  $html.find(".lgc-downtime-val-last-active").text(d.lastActiveDisplay);
  $html.find(".lgc-downtime-val-end").text(d.endTimeDisplay);
  $html.find(".lgc-downtime-val-days").text(String(d.availableDays));
  $html.find(".lgc-downtime-val-used").text(String(d.usedDays));
  $html.find(".lgc-downtime-val-available").text(String(d.availableDays));
  $html.find(".lgc-downtime-val-remaining").text(String(d.remainingDays));
  $html.find(".lgc-downtime-warning").toggle(d.exceeded);
}

interface Derived {
  lastActive: number | null;
  endTime: number | null;
  activities: Activity[];
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
  const now = currentWorldTime();
  const availableDays = computeDowntimeDays(lastActive, endTime ?? now);
  const usedDays = computeUsedDays(activities);
  return {
    lastActive,
    endTime,
    activities,
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
  if (sc?.formatDateTime) {
    try {
      return sc.formatDateTime(sc.timestampToDate(seconds));
    } catch {
      // fall through
    }
  }
  const day = Math.floor(seconds / 86400);
  const h = String(Math.floor((seconds % 86400) / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${t("LGC.Downtime.Day")} ${day}  ${h}:${m}:${s}`;
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
      const notesHtml = a.notes
        ? `<span class="lgc-downtime-activity-notes" title="${escapeHtml(a.notes)}"><i class="fa-solid fa-note-sticky"></i></span>`
        : "";
      const canDelete = isGM || a.status === "planned";
      const editBtn = isGM
        ? `<button type="button" class="lgc-downtime-edit-btn" data-id="${escapeHtml(a.id)}" title="${t("LGC.Downtime.DialogEditTitle")}">
            <i class="fa-solid fa-pencil"></i>
          </button>`
        : "";
      const deleteBtn = canDelete
        ? `<button type="button" class="lgc-downtime-delete-btn" data-id="${escapeHtml(a.id)}" title="${t("LGC.Downtime.Delete")}">
            <i class="fa-solid fa-trash"></i>
          </button>`
        : "";
      const gmButtons = editBtn + deleteBtn;
      return `
        <div class="lgc-downtime-activity">
          <span class="lgc-downtime-activity-type">${escapeHtml(a.type)}</span>
          <span class="lgc-downtime-activity-days">${a.days}d</span>
          <span class="lgc-downtime-activity-status lgc-downtime-status-${a.status}">${escapeHtml(statusLabel)}</span>
          ${notesHtml}
          ${gmButtons}
        </div>`;
    })
    .join("");
}

function buildTabSection(d: Derived, isGM: boolean, canEdit: boolean): string {
  const gmButtons = isGM
    ? `<button type="button" class="lgc-downtime-set-active">
          <i class="fa-solid fa-clock"></i> ${t("LGC.Downtime.SetActiveNow")}
        </button>
        <button type="button" class="lgc-downtime-set-end">
          <i class="fa-solid fa-flag-checkered"></i> ${t("LGC.Downtime.SetEndNow")}
        </button>
        <button type="button" class="lgc-downtime-recalculate">
          <i class="fa-solid fa-rotate"></i> ${t("LGC.Downtime.Recalculate")}
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

      </div>
    </section>`;
}
