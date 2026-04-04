import { importNpcFromJson } from "./importer";
import { openNpcImportDialog } from "./ui";
import { injectActorDirectoryFooterButton } from "../../lib/foundry";

const BTN_ID = "lgc-import-npc-json";

export function registerNpcImporter(): void {
  Hooks.on("renderActorDirectory" as any, (_app: any, html: any) => {
    try {
      if (!(game as any).user?.isGM) return;
      injectActorDirectoryFooterButton(html, {
        buttonId: BTN_ID,
        label: game.i18n?.localize("LGC.NpcImporter.ButtonLabel") ?? "Import NPC JSON",
        iconClass: "fa-solid fa-file-import",
        onClick: () =>
          openNpcImportDialog((raw, opts) => importNpcFromJson(raw, opts)),
      });
    } catch (err) {
      console.error("LGC | Failed to inject NPC import button", err);
    }
  });
}
