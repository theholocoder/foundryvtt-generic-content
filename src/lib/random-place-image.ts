const MODULE_ID = "lazybobcat-generic-content";
const PLACE_ART_DIR = `modules/${MODULE_ID}/artwork/places`;

export async function pickRandomPlaceImage(biome: string): Promise<string> {
  try {
    const result = await FilePicker.browse("data", PLACE_ART_DIR);
    const files: string[] = result.files ?? [];
    if (!files.length) return "icons/svg/mystery-man.svg";

    if (biome) {
      const prefix = biome.toLowerCase().replace(/\s+/g, "-") + "-";
      const matching = files.filter((f) => (f.split("/").pop() ?? "").startsWith(prefix));
      if (matching.length) return matching[Math.floor(Math.random() * matching.length)]!;
    }

    return files[Math.floor(Math.random() * files.length)]!;
  } catch {
    return "icons/svg/mystery-man.svg";
  }
}
