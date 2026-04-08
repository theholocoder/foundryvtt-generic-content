import { toJQuery } from "../../lib/foundry/jquery";
import { escapeHtml } from "../../lib/html";
import { computeDowntimeDays } from "./compute";

const MODULE_ID = "lazybobcat-generic-content";
const TAB_NAME = "lgc-downtime";
const t = (k: string) => game.i18n?.localize(k) ?? k;

export function registerDowntime(): void {
  Hooks.on("renderCharacterSheetPF2e" as any, (app: any, html: any) => {
    const actor = app.actor ?? app.document;
    if (!actor) return;

    const $html = toJQuery(html);
    // Guard: avoid double-injecting on re-renders
    if ($html.find(`section[data-tab="${TAB_NAME}"]`).length) return;

    const lastActive = actor.getFlag(MODULE_ID, "downtime.lastActiveTime") as number | undefined;
    const currentTime: number = (game as any).time?.worldTime ?? 0;
    const availableDays = computeDowntimeDays(lastActive, currentTime);
    const lastActiveDisplay = lastActive != null
      ? formatWorldDay(lastActive)
      : t("LGC.Downtime.NotSet");

    // Inject tab link after the spellcasting tab (falls back to appending to nav)
    const spellTab = $html.find('nav.sheet-navigation a[data-tab="spellcasting"]');
    const tabLink = `<a class="item" data-tab="${TAB_NAME}" data-group="primary" role="tab" aria-label="${t("LGC.Downtime.Title")}" data-tooltip="${t("LGC.Downtime.Title")}">
        <i class="fa-solid fa-hourglass-half"></i>
      </a>`;
    if (spellTab.length) {
      spellTab.after(tabLink);
    } else {
      $html.find("nav.sheet-navigation").append(tabLink);
    }

    // Inject tab content section after the spellcasting section (falls back to sibling append)
    const spellSection = $html.find('section.tab[data-tab="spellcasting"]');
    const tabSection = buildTabSection(lastActiveDisplay, availableDays, !!actor.isOwner);
    if (spellSection.length) {
      spellSection.after(tabSection);
    } else {
      $html.find('section.tab[data-group="primary"]').first().parent().append(tabSection);
    }

    // Events — update in-place to avoid resetting the active tab
    $html.find(".lgc-downtime-set-active").on("click", async () => {
      const worldTime: number = (game as any).time?.worldTime ?? 0;
      await actor.setFlag(MODULE_ID, "downtime.lastActiveTime", worldTime);
      $html.find(".lgc-downtime-val-last-active").text(formatWorldDay(worldTime));
      $html.find(".lgc-downtime-val-days").text(String(computeDowntimeDays(worldTime, worldTime)));
    });

    $html.find(".lgc-downtime-recalculate").on("click", () => {
      const stored = actor.getFlag(MODULE_ID, "downtime.lastActiveTime") as number | undefined;
      const now: number = (game as any).time?.worldTime ?? 0;
      $html.find(".lgc-downtime-val-days").text(String(computeDowntimeDays(stored, now)));
    });
  });
}

/** Display world time as "Day X  HH:MM:SS"; use Simple Calendar if available */
function formatWorldDay(seconds: number): string {
  const sc = (globalThis as any).SimpleCalendar?.api;
  if (sc?.formatDateTime) {
    try {
      return sc.formatDateTime(sc.timestampToDate(seconds));
    } catch {
      // fall through to raw format
    }
  }
  const day = Math.floor(seconds / 86400);
  const h = String(Math.floor((seconds % 86400) / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${t("LGC.Downtime.Day")} ${day}  ${h}:${m}:${s}`;
}

function buildTabSection(lastActiveDisplay: string, availableDays: number, canEdit: boolean): string {
  const buttons = canEdit
    ? `<div class="lgc-downtime-actions">
        <button type="button" class="lgc-downtime-set-active">
          <i class="fa-solid fa-clock"></i> ${t("LGC.Downtime.SetActiveNow")}
        </button>
        <button type="button" class="lgc-downtime-recalculate">
          <i class="fa-solid fa-rotate"></i> ${t("LGC.Downtime.Recalculate")}
        </button>
      </div>`
    : "";

  return `
    <section class="tab major lgc-downtime-tab" data-tab="${TAB_NAME}" data-group="primary">
      <div class="lgc-downtime-content">
        <dl class="lgc-downtime-stats">
          <dt>${t("LGC.Downtime.LastActive")}</dt>
          <dd class="lgc-downtime-val-last-active">${escapeHtml(lastActiveDisplay)}</dd>
          <dt>${t("LGC.Downtime.AvailableDays")}</dt>
          <dd class="lgc-downtime-val-days">${availableDays}</dd>
        </dl>
        ${buttons}
      </div>
    </section>`;
}
