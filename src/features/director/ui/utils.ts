import { escapeHtml } from "../../../lib/html";

const t = (k: string) => game.i18n?.localize(k) ?? k;

export async function resolveSceneThumbnail(uuid: string): Promise<string | null> {
  try {
    const doc = await fromUuid(uuid);
    return (doc as any)?.thumb ?? (doc as any)?.background?.src ?? null;
  } catch {
    return null;
  }
}

export interface EntityInfo {
  name: string;
  img: string | null;
}

export async function resolveEntity(uuid: string): Promise<EntityInfo> {
  try {
    const doc = await fromUuid(uuid);
    return {
      name: (doc as any)?.name ?? uuid,
      img: (doc as any)?.img ?? (doc as any)?.thumb ?? null,
    };
  } catch {
    return { name: uuid, img: null };
  }
}

export function buildEntityList(
  label: string,
  uuids: string[],
  entities: EntityInfo[],
  dropType: string,
  field: string,
): string {
  const items = uuids
    .map((uuid, i) => {
      const { name, img } = entities[i] ?? { name: uuid, img: null };
      const imgHtml = img
        ? `<img class="lgc-director-entity-img" src="${escapeHtml(img)}" alt="${escapeHtml(name)}" />`
        : `<i class="fa-solid fa-question lgc-director-entity-img-placeholder"></i>`;
      return `
      <div class="lgc-director-entity-item" data-uuid="${escapeHtml(uuid)}" data-field="${escapeHtml(field)}">
        ${imgHtml}
        <span class="lgc-director-entity-name">${escapeHtml(name)}</span>
        <div class="lgc-director-entity-actions">
          <button class="lgc-director-entity-open" title="${t("LGC.Director.ViewEntity")}">
            <i class="fa-solid fa-eye"></i>
          </button>
          <button class="lgc-director-entity-remove" title="${t("LGC.Director.Remove")}">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>`;
    })
    .join("");

  return `
    <div class="lgc-director-entity-section">
      <h4>${label}</h4>
      <div class="lgc-director-entity-list lgc-director-drop-zone" data-drop-type="${escapeHtml(dropType)}" data-field="${escapeHtml(field)}">
        ${items}
        <div class="lgc-director-drop-hint">${t("LGC.Director.DropHere")}</div>
      </div>
    </div>`;
}
