import { importNpcFromJson } from "./importer";
import { injectImportButton, openNpcImportDialog } from "./ui";

const BTN_ID = "lgc-import-npc-json";

export function registerNpcImporter(): void {
  Hooks.on("renderActorDirectory" as any, (_app: any, html: any) => {
    try {
      injectImportButton(html, {
        buttonId: BTN_ID,
        label: "Import NPC JSON",
        onClick: () =>
          openNpcImportDialog((raw, opts) => importNpcFromJson(raw, opts)),
      });
    } catch (err) {
      console.error("LGC | Failed to inject NPC import button", err);
    }
  });
}
