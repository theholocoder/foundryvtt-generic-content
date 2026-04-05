import { escapeHtml } from "../../../../lib/html";
import type { DirectorSession } from "../../types";

const t = (k: string) => game.i18n?.localize(k) ?? k;

async function resolveSceneThumbnail(uuid: string): Promise<string | null> {
  try {
    const doc = await fromUuid(uuid);
    return (doc as any)?.thumb ?? (doc as any)?.background?.src ?? null;
  } catch {
    return null;
  }
}

export async function buildBeatsView(session: DirectorSession): Promise<string> {
  const thumbs = await Promise.all(
    session.beats.map((b) => (b.sceneUuid ? resolveSceneThumbnail(b.sceneUuid) : Promise.resolve(null))),
  );

  const cards = session.beats.length
    ? session.beats
        .map((b, i) => {
          const thumb = thumbs[i];
          const bg = thumb ? `style="background-image: url('${escapeHtml(thumb)}')"` : "";
          return `
          <div class="lgc-director-card lgc-director-beat-card" data-beat-id="${escapeHtml(b.id)}" ${bg}>
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
