import { escapeHtml } from "../../../../lib/html";
import type { DirectorData } from "../../types";

const t = (k: string) => game.i18n?.localize(k) ?? k;

export function buildSessionsView(data: DirectorData): string {
  const sessions = [...data.sessions]; // already newest-first (unshift on create)

  const cards = sessions.length
    ? sessions
        .map((s) => {
          const bg = s.image ? `style="background-image: url('${escapeHtml(s.image)}')"` : "";
          return `
          <div class="lgc-director-card lgc-director-session-card" data-session-id="${escapeHtml(s.id)}" ${bg}>
            <span class="lgc-director-card-name">${escapeHtml(s.name)}</span>
            <button class="lgc-director-card-remove" data-session-id="${escapeHtml(s.id)}" title="${t("LGC.Director.RemoveSession")}">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>`;
        })
        .join("")
    : `<p class="lgc-director-empty">${t("LGC.Director.NoSessions")}</p>`;

  return `
    <div class="lgc-director-view lgc-director-sessions-view">
      <div class="lgc-director-view-header">
        <h3>${t("LGC.Director.Sessions")}</h3>
      </div>
      <div class="lgc-director-card-list">
        ${cards}
      </div>
      <div class="lgc-director-view-footer">
        <button class="lgc-director-add-session">
          <i class="fa-solid fa-plus"></i> ${t("LGC.Director.AddSession")}
        </button>
      </div>
    </div>
  `;
}
