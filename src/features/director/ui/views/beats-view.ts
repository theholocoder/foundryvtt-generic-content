import { escapeHtml } from "../../../../lib/html";
import type { DirectorSession } from "../../types";
import { resolveSceneThumbnail } from "../utils";

const t = (k: string) => game.i18n?.localize(k) ?? k;

export async function buildBeatsView(session: DirectorSession): Promise<string> {
  const thumbs = await Promise.all(
    session.beats.map((b) => (b.sceneUuid ? resolveSceneThumbnail(b.sceneUuid) : Promise.resolve(null))),
  );

  const activeSceneUuid = (game.scenes as any)?.active?.uuid as string | undefined;

  const cards = session.beats.length
    ? session.beats
        .map((b, i) => {
          const thumb = thumbs[i];
          const bg = thumb ? `style="background-image: url('${escapeHtml(thumb)}')"` : "";
          const isActive = b.sceneUuid && b.sceneUuid === activeSceneUuid;
          const activeIcon = isActive
            ? `<span class="lgc-director-card-active" title="${t("LGC.Director.ActiveScene")}"><i class="fa-solid fa-location-dot"></i></span>`
            : "";
          return `
          <div class="lgc-director-card lgc-director-beat-card${isActive ? " lgc-director-beat-card--active" : ""}" data-beat-id="${escapeHtml(b.id)}" ${bg}>
            ${activeIcon}
            <span class="lgc-director-card-name">${escapeHtml(b.name)}</span>
            <button class="lgc-director-card-remove" data-beat-id="${escapeHtml(b.id)}" title="${t("LGC.Director.RemoveBeat")}">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>`;
        })
        .join("")
    : `<p class="lgc-director-empty">${t("LGC.Director.NoBeats")}</p>`;

  const desc = session.description
    ? `<p class="lgc-director-session-desc">${escapeHtml(session.description)}</p>`
    : "";

  return `
    <div class="lgc-director-view lgc-director-beats-view">
      <div class="lgc-director-view-header">
        <button class="lgc-director-back" title="${t("LGC.Director.Back")}">
          <i class="fa-solid fa-arrow-left"></i>
        </button>
        <h3>${escapeHtml(session.name)}</h3>
      </div>
      ${desc}
      <div class="lgc-director-card-list">
        ${cards}
      </div>
      <div class="lgc-director-view-footer">
        <button class="lgc-director-add-beat">
          <i class="fa-solid fa-plus"></i> ${t("LGC.Director.AddBeat")}
        </button>
      </div>
    </div>
  `;
}
