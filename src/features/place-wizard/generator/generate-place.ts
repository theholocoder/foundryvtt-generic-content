import type { PlaceWizardResult } from "../ui/wizard-dialog";
import { pickRandomPlaceImage } from "../../../lib/random-place-image";
import { buildPlaceBlockHtml, createJournalEntry } from "../../../lib/pf2e/journal";
import type { JournalPageSpec } from "../../../lib/pf2e/journal";

const FALLBACK_IMG = "icons/svg/mystery-man.svg";

export async function generatePlace(result: PlaceWizardResult): Promise<void> {
  const img = result.img || (await pickRandomPlaceImage(result.biome));
  const biomeLabel = result.biome
    ? (game.i18n?.localize(`LGC.PlaceWizard.Biome.${result.biome}`) ?? result.biome)
    : "—";

  const placeBlock = buildPlaceBlockHtml({
    regionUuid: result.regionUuid,
    biomeLabel,
    sceneUuid: result.sceneUuid,
  });

  const pages: JournalPageSpec[] = [{ name: result.name, type: "text", content: placeBlock }];
  if (img && img !== FALLBACK_IMG) {
    pages.push({ name: "Image", type: "image", src: img });
  }

  const journal = await createJournalEntry(result.name, pages);
  if (!journal) return;

  journal.sheet?.render(true);
  ui.notifications?.info(
    (game.i18n?.localize("LGC.PlaceWizard.JournalCreated") ?? "Created place: {name}").replace(
      "{name}",
      result.name,
    ),
  );
}
