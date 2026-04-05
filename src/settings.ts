export const MODULE_ID = "lazybobcat-generic-content";

export const SETTINGS = {
  NPC_NAME_ROLL_TABLE_UUID: "npcNameRollTableUuid",
  NPC_PERSONALITY_ROLL_TABLE_UUID: "npcPersonalityRollTableUuid",
  NPC_SPEECH_ROLL_TABLE_UUID: "npcSpeechRollTableUuid",
  NPC_FOOD_ROLL_TABLE_UUID: "npcFoodRollTableUuid",
} as const;

export const DEFAULTS = {
  NPC_NAME_ROLL_TABLE_UUID: "Compendium.lazybobcat-generic-content.tables.RollTable.xDVHa48EN6PXUzK2",
  NPC_PERSONALITY_ROLL_TABLE_UUID: "Compendium.lazybobcat-generic-content.tables.RollTable.lgcPersonality01",
  NPC_SPEECH_ROLL_TABLE_UUID: "Compendium.lazybobcat-generic-content.tables.RollTable.lgcElocutionTbl1",
  NPC_FOOD_ROLL_TABLE_UUID: "Compendium.lazybobcat-generic-content.tables.RollTable.lgcFoodTableXXX1",
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

  (game.settings as any).register(MODULE_ID, SETTINGS.NPC_PERSONALITY_ROLL_TABLE_UUID, {
    name: game.i18n?.localize("LGC.Settings.PersonalityRollTableUuid") ?? "Personality Traits RollTable UUID",
    hint: game.i18n?.localize("LGC.Settings.PersonalityRollTableHint") ?? "",
    scope: "world",
    config: true,
    type: String,
    default: DEFAULTS.NPC_PERSONALITY_ROLL_TABLE_UUID,
  });

  (game.settings as any).register(MODULE_ID, SETTINGS.NPC_SPEECH_ROLL_TABLE_UUID, {
    name: game.i18n?.localize("LGC.Settings.SpeechRollTableUuid") ?? "Speech / Verbal Ticks RollTable UUID",
    hint: game.i18n?.localize("LGC.Settings.SpeechRollTableHint") ?? "",
    scope: "world",
    config: true,
    type: String,
    default: DEFAULTS.NPC_SPEECH_ROLL_TABLE_UUID,
  });

  (game.settings as any).register(MODULE_ID, SETTINGS.NPC_FOOD_ROLL_TABLE_UUID, {
    name: game.i18n?.localize("LGC.Settings.FoodRollTableUuid") ?? "Favorite Food RollTable UUID",
    hint: game.i18n?.localize("LGC.Settings.FoodRollTableHint") ?? "",
    scope: "world",
    config: true,
    type: String,
    default: DEFAULTS.NPC_FOOD_ROLL_TABLE_UUID,
  });
}
