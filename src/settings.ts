const MODULE_ID = "lazybobcat-generic-content";

export const SETTINGS = {
  NPC_NAME_ROLL_TABLE_UUID: "npcNameRollTableUuid",
} as const;

export const DEFAULTS = {
  NPC_NAME_ROLL_TABLE_UUID: "Compendium.lazybobcat-generic-content.tables.RollTable.xDVHa48EN6PXUzK2",
} as const;

export function registerSettings(): void {
  (game.settings as any).register(MODULE_ID, SETTINGS.NPC_NAME_ROLL_TABLE_UUID, {
    name: game.i18n?.localize("LGC.Settings.NameRollTableUuid") ?? "NPC Name RollTable UUID",
    hint: game.i18n?.localize("LGC.Settings.NameRollTableHint") ?? "",
    scope: "world",
    config: true,
    type: String,
    default: DEFAULTS.NPC_NAME_ROLL_TABLE_UUID,
  });
}
