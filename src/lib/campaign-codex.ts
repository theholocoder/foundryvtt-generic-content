export function getCampaignCodexFlags(
  type: "npc" | "location",
  description: string,
  notes?: string,
): Record<string, Record<string, unknown>> | null {
  if (!(game.modules as any)?.get("campaign-codex")?.active) return null;
  const sheetClass = type === "npc" ? "campaign-codex.NPCSheet" : "campaign-codex.LocationSheet";
  const data: Record<string, unknown> = { description };
  if (notes) data.notes = notes;
  return {
    core: { sheetClass },
    "campaign-codex": { type, data },
  };
}
