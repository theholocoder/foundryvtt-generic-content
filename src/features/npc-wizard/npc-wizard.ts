import { injectActorDirectoryFooterButton } from "../../lib/foundry";
import { openNpcWizard } from "./ui/wizard-dialog";
import { generateNpc } from "./generator/generate-npc";

const BTN_ID = "lgc-create-npc";

export function registerNpcWizard(): void {
  Hooks.on("renderActorDirectory" as any, (_app: any, html: any) => {
    try {
      if (!(game as any).user?.isGM) return;
      injectActorDirectoryFooterButton(html, {
        buttonId: BTN_ID,
        label: game.i18n?.localize("LGC.NpcWizard.ButtonLabel") ?? "Create NPC",
        iconClass: "fa-solid fa-wand-magic-sparkles",
        onClick: () => openNpcWizard(async (result) => generateNpc(result)),
      });
    } catch (err) {
      console.error("LGC | Failed to inject NPC wizard button", err);
    }
  });
}
