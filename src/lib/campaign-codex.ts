export function getCampaignCodexFlags(
  type: "npc" | "location",
  description: string,
): Record<string, Record<string, unknown>> | null {
  if (!(game.modules as any)?.get("campaign-codex")?.active) return null;
  const sheetClass = type === "npc" ? "campaign-codex.NPCSheet" : "campaign-codex.LocationSheet";
  return {
    core: { sheetClass },
    "campaign-codex": { type, data: { description } },
  };
}
