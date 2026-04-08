import { escapeHtml } from "../../../../lib/html";
import type { DirectorBeat } from "../../types";
import { buildEntityList, resolveEntity, resolveSceneThumbnail } from "../utils";

const t = (k: string) => game.i18n?.localize(k) ?? k;

function formatRealTime(ms: number): string {
  return new Date(ms).toLocaleString();
}

function formatWorldTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export async function buildBeatDetailView(beat: DirectorBeat, sessionName: string): Promise<string> {
  // Scene section
  let sceneSection: string;
  if (beat.sceneUuid) {
    const entity = await resolveEntity(beat.sceneUuid);
    const thumb = await resolveSceneThumbnail(beat.sceneUuid);
    const thumbHtml = thumb
      ? `<img class="lgc-director-scene-thumb" src="${escapeHtml(thumb)}" alt="${escapeHtml(entity.name)}" />`
      : `<i class="fa-solid fa-map lgc-director-scene-icon"></i>`;
    sceneSection = `
      <div class="lgc-director-scene lgc-director-scene--filled" data-uuid="${escapeHtml(beat.sceneUuid)}">
        ${thumbHtml}
        <span class="lgc-director-scene-name">${escapeHtml(entity.name)}</span>
        <div class="lgc-director-scene-actions">
          <button class="lgc-director-scene-view" title="${t("LGC.Director.ViewScene")}">
            <i class="fa-solid fa-eye"></i>
          </button>
          <button class="lgc-director-scene-play" title="${t("LGC.Director.PlayScene")}">
            <i class="fa-solid fa-play"></i>
          </button>
          <button class="lgc-director-scene-remove" title="${t("LGC.Director.RemoveScene")}">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>`;
  } else {
    sceneSection = `
      <div class="lgc-director-scene lgc-director-scene--empty lgc-director-drop-zone" data-drop-type="Scene">
        <i class="fa-solid fa-map"></i>
        <span>${t("LGC.Director.DropScene")}</span>
      </div>`;
  }

  // Entity lists
  const journalEntities = await Promise.all(beat.journalUuids.map(resolveEntity));
  const actorEntities = await Promise.all(beat.actorUuids.map(resolveEntity));
  const itemEntities = await Promise.all(beat.itemUuids.map(resolveEntity));

  const journalsSection = buildEntityList(t("LGC.Director.Journals"), beat.journalUuids, journalEntities, "JournalEntry", "journalUuids");
  const actorsSection = buildEntityList(t("LGC.Director.Actors"), beat.actorUuids, actorEntities, "Actor", "actorUuids");
  const itemsSection = buildEntityList(t("LGC.Director.Items"), beat.itemUuids, itemEntities, "Item", "itemUuids");

  // Notes
  const notesHtml = beat.notes.length
    ? beat.notes
        .map(
          (n) => `
        <div class="lgc-director-note" data-note-id="${escapeHtml(n.id)}">
          <p class="lgc-director-note-text">${escapeHtml(n.text)}</p>
          <div class="lgc-director-note-meta">
            <span>${formatRealTime(n.realTimestamp)}</span>
            <span class="lgc-director-note-world-time">${formatWorldTime(n.foundryWorldTime)}</span>
            <button class="lgc-director-note-remove" title="${t("LGC.Director.Remove")}">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>`,
        )
        .join("")
    : "";

  const desc = beat.description
    ? `<p class="lgc-director-beat-desc">${escapeHtml(beat.description)}</p>`
    : "";

  return `
    <div class="lgc-director-view lgc-director-beat-detail-view">
      <div class="lgc-director-view-header">
        <button class="lgc-director-back" title="${t("LGC.Director.Back")}">
          <i class="fa-solid fa-arrow-left"></i>
        </button>
        <div class="lgc-director-header-titles">
          <span class="lgc-director-header-sub">${escapeHtml(sessionName)}</span>
          <h3>${escapeHtml(beat.name)}</h3>
        </div>
      </div>
      ${desc}

      <div class="lgc-director-scene-section">
        <h4>${t("LGC.Director.Scene")}</h4>
        ${sceneSection}
      </div>

      ${journalsSection}
      ${actorsSection}
      ${itemsSection}

      <div class="lgc-director-notes-section">
        <div class="lgc-director-notes-header">
          <h4>${t("LGC.Director.Notes")}</h4>
          <button class="lgc-director-add-note">
            <i class="fa-solid fa-plus"></i> ${t("LGC.Director.AddNote")}
          </button>
        </div>
        <div class="lgc-director-notes-list">
          ${notesHtml}
        </div>
      </div>
    </div>
  `;
}
