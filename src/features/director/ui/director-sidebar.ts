import {
  addNote,
  addUuidToBeat,
  createBeat,
  createSession,
  deleteBeat,
  deleteNote,
  deleteSession,
  loadDirectorData,
  removeUuidFromBeat,
  setBeatScene,
} from "../storage";
import type { DirectorView } from "../types";
import { openAddBeatDialog } from "./dialogs/add-beat-dialog";
import { openAddNoteDialog } from "./dialogs/add-note-dialog";
import { openAddSessionDialog } from "./dialogs/add-session-dialog";
import { buildBeatDetailView } from "./views/beat-detail-view";
import { buildBeatsView } from "./views/beats-view";
import { buildSessionsView } from "./views/sessions-view";

const t = (k: string) => game.i18n?.localize(k) ?? k;

export class DirectorSidebar extends Application {
  private static _instance: DirectorSidebar | null = null;
  private _view: DirectorView = { name: "sessions" };

  static getInstance(): DirectorSidebar {
    if (!DirectorSidebar._instance) {
      DirectorSidebar._instance = new DirectorSidebar();
    }
    return DirectorSidebar._instance;
  }

  static toggle(): void {
    const inst = DirectorSidebar.getInstance();
    if (inst.rendered) {
      inst.close();
    } else {
      inst.render(true);
    }
  }

  static override get defaultOptions(): Application.Options {
    return (foundry.utils as any).mergeObject(super.defaultOptions, {
      id: "lgc-director-sidebar",
      classes: ["lgc-director-sidebar"],
      title: "Director",
      width: 320,
      height: 600,
      resizable: true,
      minimizable: true,
    }) as Application.Options;
  }

  override get title(): string {
    return t("LGC.Director.Title");
  }

  // Suppress the v13 jQuery deprecation warning — we have no context menus
  protected override _contextMenu(_html: JQuery): void {}

  override async _renderInner(_data: object): Promise<JQuery> {
    const data = loadDirectorData();
    let html: string;

    if (this._view.name === "sessions") {
      html = buildSessionsView(data);
    } else if (this._view.name === "beats") {
      const view = this._view as { name: "beats"; sessionId: string };
      const session = data.sessions.find((s) => s.id === view.sessionId);
      if (!session) {
        this._view = { name: "sessions" };
        html = buildSessionsView(data);
      } else {
        html = await buildBeatsView(session);
      }
    } else {
      const view = this._view as { name: "beat-detail"; sessionId: string; beatId: string };
      const session = data.sessions.find((s) => s.id === view.sessionId);
      const beat = session?.beats.find((b) => b.id === view.beatId);
      if (!session || !beat) {
        this._view = { name: "sessions" };
        html = buildSessionsView(data);
      } else {
        html = await buildBeatDetailView(beat, session.name);
      }
    }

    return $(`<div class="lgc-director-content">${html}</div>`);
  }

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);
    if (this._view.name === "sessions") {
      this._bindSessionsListeners(html);
    } else if (this._view.name === "beats") {
      this._bindBeatsListeners(html);
    } else {
      this._bindBeatDetailListeners(html);
    }
  }

  private _navigateTo(view: DirectorView): void {
    this._view = view;
    this.render();
  }

  // --- Sessions listeners ---

  private _bindSessionsListeners(html: JQuery): void {
    html.find(".lgc-director-add-session").on("click", () => {
      openAddSessionDialog(async ({ name, description, image }) => {
        await createSession(name, description || undefined, image || undefined);
        this.render();
      });
    });

    html.find(".lgc-director-session-card").on("click", (ev) => {
      if ($(ev.target).closest(".lgc-director-card-remove").length) return;
      const sessionId = $(ev.currentTarget).data("session-id") as string;
      this._navigateTo({ name: "beats", sessionId });
    });

    html.find(".lgc-director-card-remove[data-session-id]").on("click", async (ev) => {
      ev.stopPropagation();
      const sessionId = $(ev.currentTarget).data("session-id") as string;
      const confirmed = await Dialog.confirm({
        title: t("LGC.Director.RemoveSession"),
        content: `<p>${t("LGC.Director.ConfirmRemoveSession")}</p>`,
      });
      if (!confirmed) return;
      await deleteSession(sessionId);
      this.render();
    });
  }

  // --- Beats listeners ---

  private _bindBeatsListeners(html: JQuery): void {
    const view = this._view as { name: "beats"; sessionId: string };

    html.find(".lgc-director-back").on("click", () => {
      this._navigateTo({ name: "sessions" });
    });

    html.find(".lgc-director-add-beat").on("click", () => {
      openAddBeatDialog(async ({ name, description }) => {
        await createBeat(view.sessionId, name, description || undefined);
        this.render();
      });
    });

    html.find(".lgc-director-beat-card").on("click", (ev) => {
      if ($(ev.target).closest(".lgc-director-card-remove").length) return;
      const beatId = $(ev.currentTarget).data("beat-id") as string;
      this._navigateTo({ name: "beat-detail", sessionId: view.sessionId, beatId });
    });

    html.find(".lgc-director-card-remove[data-beat-id]").on("click", async (ev) => {
      ev.stopPropagation();
      const beatId = $(ev.currentTarget).data("beat-id") as string;
      const confirmed = await Dialog.confirm({
        title: t("LGC.Director.RemoveBeat"),
        content: `<p>${t("LGC.Director.ConfirmRemoveBeat")}</p>`,
      });
      if (!confirmed) return;
      await deleteBeat(view.sessionId, beatId);
      this.render();
    });
  }

  // --- Beat detail listeners ---

  private _bindBeatDetailListeners(html: JQuery): void {
    const view = this._view as { name: "beat-detail"; sessionId: string; beatId: string };

    html.find(".lgc-director-back").on("click", () => {
      this._navigateTo({ name: "beats", sessionId: view.sessionId });
    });

    // Scene actions
    html.find(".lgc-director-scene-view").on("click", async () => {
      const data = loadDirectorData();
      const beat = data.sessions.find((s) => s.id === view.sessionId)?.beats.find((b) => b.id === view.beatId);
      if (!beat?.sceneUuid) return;
      const scene = await fromUuid(beat.sceneUuid);
      await (scene as any)?.view?.();
    });

    html.find(".lgc-director-scene-play").on("click", async () => {
      const data = loadDirectorData();
      const beat = data.sessions.find((s) => s.id === view.sessionId)?.beats.find((b) => b.id === view.beatId);
      if (!beat?.sceneUuid) return;
      const scene = await fromUuid(beat.sceneUuid);
      await (scene as any)?.activate?.();
      for (const uuid of beat.journalUuids) {
        const journal = await fromUuid(uuid);
        (journal as any)?.sheet?.render(true);
      }
    });

    html.find(".lgc-director-scene-remove").on("click", async () => {
      await setBeatScene(view.sessionId, view.beatId, null);
      this.render();
    });

    // Entity items — click row or eye button to open sheet
    const openEntity = async (uuid: string) => {
      const doc = await fromUuid(uuid);
      (doc as any)?.sheet?.render(true);
    };
    html.find(".lgc-director-entity-item").on("click", async (ev) => {
      if ($(ev.target).closest(".lgc-director-entity-actions").length) return;
      await openEntity($(ev.currentTarget).data("uuid") as string);
    });
    html.find(".lgc-director-entity-open").on("click", async (ev) => {
      ev.stopPropagation();
      await openEntity($(ev.currentTarget).closest(".lgc-director-entity-item").data("uuid") as string);
    });

    // Entity remove buttons
    html.find(".lgc-director-entity-remove").on("click", async (ev) => {
      ev.stopPropagation();
      const $item = $(ev.currentTarget).closest(".lgc-director-entity-item");
      const uuid = $item.data("uuid") as string;
      const field = $item.data("field") as "journalUuids" | "actorUuids" | "itemUuids";
      await removeUuidFromBeat(view.sessionId, view.beatId, field, uuid);
      this.render();
    });

    // Notes
    html.find(".lgc-director-add-note").on("click", () => {
      openAddNoteDialog(async ({ text }) => {
        await addNote(view.sessionId, view.beatId, text);
        this.render();
      });
    });

    html.find(".lgc-director-note-remove").on("click", async (ev) => {
      const noteId = $(ev.currentTarget).closest(".lgc-director-note").data("note-id") as string;
      await deleteNote(view.sessionId, view.beatId, noteId);
      this.render();
    });

    // Drag & drop zones
    this._activateDropZone(html, ".lgc-director-scene--empty", ["Scene"], async (uuid) => {
      await setBeatScene(view.sessionId, view.beatId, uuid);
      this.render();
    });

    this._activateDropZone(html, '.lgc-director-entity-list[data-drop-type="JournalEntry"]', ["JournalEntry"], async (uuid) => {
      await addUuidToBeat(view.sessionId, view.beatId, "journalUuids", uuid);
      this.render();
    });

    this._activateDropZone(html, '.lgc-director-entity-list[data-drop-type="Actor"]', ["Actor"], async (uuid) => {
      await addUuidToBeat(view.sessionId, view.beatId, "actorUuids", uuid);
      this.render();
    });

    this._activateDropZone(html, '.lgc-director-entity-list[data-drop-type="Item"]', ["Item"], async (uuid) => {
      await addUuidToBeat(view.sessionId, view.beatId, "itemUuids", uuid);
      this.render();
    });
  }

  private _activateDropZone(
    html: JQuery,
    selector: string,
    types: string[],
    handler: (uuid: string) => Promise<void>,
  ): void {
    const $zones = html.find(selector);

    $zones.on("dragover", (ev) => {
      ev.preventDefault();
      $(ev.currentTarget).addClass("lgc-drag-over");
    });

    $zones.on("dragleave", (ev) => {
      $(ev.currentTarget).removeClass("lgc-drag-over");
    });

    $zones.on("drop", async (ev) => {
      ev.preventDefault();
      $(ev.currentTarget).removeClass("lgc-drag-over");
      try {
        const raw = (ev.originalEvent as DragEvent).dataTransfer?.getData("text/plain");
        if (!raw) return;
        const data = JSON.parse(raw) as { type?: string; uuid?: string };
        if (!data.type || !data.uuid) return;
        if (!types.includes(data.type)) return;
        await handler(data.uuid);
      } catch (err) {
        console.error("LGC | Director drop error", err);
      }
    });
  }

  // Keep the singleton alive on close so the view state is preserved on reopen
  override async close(options?: Application.CloseOptions): Promise<void> {
    await super.close(options);
  }
}
