import { injectJournalDirectoryFooterButton } from "../../lib/foundry";
import { openPlaceWizard } from "./ui/wizard-dialog";
import { generatePlace } from "./generator/generate-place";

const BTN_ID = "lgc-create-place";

export function registerPlaceWizard(): void {
  Hooks.on("renderJournalDirectory" as any, (_app: any, html: any) => {
    try {
      if (!(game as any).user?.isGM) return;
      injectJournalDirectoryFooterButton(html, {
        buttonId: BTN_ID,
        label: game.i18n?.localize("LGC.PlaceWizard.ButtonLabel") ?? "Create Place",
        iconClass: "fa-solid fa-map-location-dot",
        onClick: () => openPlaceWizard(async (result) => generatePlace(result)),
      });
    } catch (err) {
      console.error("LGC | Failed to inject Place wizard button", err);
    }
  });
}
