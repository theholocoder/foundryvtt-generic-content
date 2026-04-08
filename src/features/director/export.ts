import type { DirectorNote, DirectorSession } from "./types";


/** Resolves the display name for a UUID, preferring direct collection lookup over fromUuid. */
async function resolveName(uuid: string): Promise<string> {
  if (uuid.startsWith("Actor.")) {
    const name = (game.actors as any)?.get(uuid.slice(6))?.name;
    if (name) return name;
  }
  if (uuid.startsWith("Scene.")) {
    const name = (game.scenes as any)?.get(uuid.slice(6))?.name;
    if (name) return name;
  }
  if (uuid.startsWith("Item.")) {
    const name = (game.items as any)?.get(uuid.slice(5))?.name;
    if (name) return name;
  }
  // Fallback for compendium UUIDs or anything not matched above
  try {
    return (await fromUuid(uuid) as any)?.name ?? uuid;
  } catch {
    return uuid;
  }
}

const t = (k: string) => game.i18n?.localize(k) ?? k;

const DialogV2 = (foundry as any).applications.api.DialogV2;

export async function exportSessionToMarkdown(session: DirectorSession): Promise<string> {
  const lines: string[] = [];

  lines.push(`# ${session.name}`, "");

  // Overview section
  lines.push(`## ${t("LGC.Director.Export.Overview")}`, "");
  if (session.description) lines.push(session.description, "");

  // Scenes section
  lines.push(`## ${t("LGC.Director.Export.Scenes")}`, "");

  for (const beat of session.beats) {
    lines.push(`### ${beat.name}`, "");

    if (beat.sceneUuid) {
      const name = await resolveName(beat.sceneUuid);
      lines.push(`**${t("LGC.Director.Export.Scene")}** : ${name}`, "");
    }

    if (beat.actorUuids.length) {
      const names = await Promise.all(beat.actorUuids.map(resolveName));
      lines.push(`**${t("LGC.Director.Export.Actors")}** : ${names.join(", ")}`, "");
    }

    if (beat.itemUuids.length) {
      const names = await Promise.all(beat.itemUuids.map(resolveName));
      lines.push(`**${t("LGC.Director.Export.Items")}** : ${names.join(", ")}`, "");
    }

    if (beat.description) lines.push(beat.description, "");
  }

  // Notes section — all beats combined, sorted by real time ascending
  const allNotes: DirectorNote[] = session.beats
    .flatMap((b) => b.notes)
    .sort((a, b) => a.realTimestamp - b.realTimestamp);

  if (allNotes.length) {
    lines.push(`## ${t("LGC.Director.Export.Notes")}`, "");
    for (const note of allNotes) {
      lines.push(`- **[${new Date(note.realTimestamp).toLocaleString()}]** ${note.text}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function showExportDialog(_sessionName: string, markdown: string): void {
  const escaped = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  DialogV2.wait({
    window: { title: t("LGC.Director.ExportSession") },
    classes: ["lgc-dialog", "lgc-director-dialog"],
    content: `
      <div style="display:flex;flex-direction:column;gap:8px;padding:8px 0;">
        <textarea readonly style="width:100%;height:320px;resize:vertical;font-family:monospace;font-size:11px;background:#111;color:#ddd;border:1px solid #444;border-radius:4px;padding:8px;box-sizing:border-box;">${escaped}</textarea>
        <button type="button" class="lgc-export-copy-btn">
          <i class="fa-solid fa-clipboard"></i> ${t("LGC.Director.Export.CopyToClipboard")}
        </button>
      </div>`,
    render: (_event: Event, dialog: any) => {
      $(dialog.element)
        .find(".lgc-export-copy-btn")
        .on("click", async () => {
          await navigator.clipboard.writeText(markdown);
          (ui as any).notifications?.info(t("LGC.Director.Export.Copied"));
        });
    },
    buttons: [
      {
        action: "close",
        icon: "fa-solid fa-xmark",
        label: t("LGC.Director.Export.Close"),
        type: "button",
      },
    ],
    rejectClose: false,
  });
}
