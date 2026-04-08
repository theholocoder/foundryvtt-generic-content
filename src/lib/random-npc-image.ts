import { getFilePicker } from "./foundry";

const MODULE_ID = "lazybobcat-generic-content";
const NPC_ART_DIR = `modules/${MODULE_ID}/artwork/npc`;

export async function pickRandomNpcImage(traits: string[] = []): Promise<string> {
  try {
    const result = await getFilePicker().browse("data", NPC_ART_DIR);
    const files: string[] = result.files ?? [];
    if (!files.length) return "icons/svg/mystery-man.svg";

    for (const trait of traits) {
      const prefix = trait.toLowerCase().replace(/\s+/g, "-") + "-";
      const matching = files.filter((f) => (f.split("/").pop() ?? "").startsWith(prefix));
      if (matching.length) return matching[Math.floor(Math.random() * matching.length)]!;
    }

    return files[Math.floor(Math.random() * files.length)]!;
  } catch {
    return "icons/svg/mystery-man.svg";
  }
}
