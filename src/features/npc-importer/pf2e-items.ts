import type { NormalizedNpc } from "./types";
import { deepClone, escapeHtml } from "./utils";

export function buildEmbeddedItems(npc: NormalizedNpc): any[] {
  const items: any[] = [];

  for (const s of npc.strikes) {
    const sysModel = deepClone((game as any).system?.model?.Item?.melee) ?? {};

    const data: any = {
      name: s.name,
      type: "melee",
      system: sysModel,
    };

    if (!data.system.description) data.system.description = { value: "" };
    if (data.system.description && typeof data.system.description === "string") {
      data.system.description = { value: data.system.description };
    }
    if (!data.system.traits) data.system.traits = { value: [] };

    if (foundry.utils.getProperty(data.system, "traits.value") !== undefined) {
      data.system.traits.value = s.traits;
    }

    if (s.attack !== null) {
      setFirstExisting(
        data.system,
        ["bonus.value", "bonus", "attack.value"],
        s.attack,
        { allowCreate: true, debugLabel: "melee.bonus" },
      );

      if (typeof data.system.bonus === "number") data.system.bonus = { value: data.system.bonus };
      if (
        data.system.bonus &&
        typeof data.system.bonus === "object" &&
        data.system.bonus.value === undefined
      ) {
        data.system.bonus.value = s.attack;
      }
    }

    if (s.damageParsed.formula) {
      const dmgKey = foundry.utils.randomID();
      const dmg = { damage: s.damageParsed.formula } as any;
      if (s.damageParsed.damageType) dmg.damageType = s.damageParsed.damageType;

      if (!data.system.damageRolls || typeof data.system.damageRolls !== "object" || Array.isArray(data.system.damageRolls)) {
        data.system.damageRolls = {};
      }
      data.system.damageRolls[dmgKey] = {
        ...(data.system.damageRolls[dmgKey] ?? {}),
        ...dmg,
      };
    }

    const descParts: string[] = [];
    if (s.kind === "ranged") descParts.push("<p><strong>Type</strong> Ranged</p>");
    if (s.attack !== null) descParts.push(`<p><strong>Attack</strong> +${s.attack}</p>`);
    if (s.damageRaw) descParts.push(`<p><strong>Damage</strong> ${escapeHtml(s.damageRaw)}</p>`);
    if (s.damageParsed.note) {
      descParts.push(`<p><strong>Note</strong> ${escapeHtml(s.damageParsed.note)}</p>`);
    }

    if (descParts.length) {
      const existing =
        foundry.utils.getProperty(data.system, "description.value") ??
        foundry.utils.getProperty(data.system, "description") ??
        "";

      const html = `${existing ?? ""}${descParts.join("\n")}`;
      if (!data.system.description) data.system.description = { value: "" };
      if (typeof data.system.description === "string") {
        data.system.description = { value: data.system.description };
      }
      if (data.system.description && typeof data.system.description === "object") {
        data.system.description.value = html;
      }
    }

    items.push(data);
  }

  for (const sp of npc.specials) {
    const sysModel = deepClone((game as any).system?.model?.Item?.action) ?? {};

    const data: any = {
      name: sp.name,
      type: "action",
      system: sysModel,
    };

    if (!data.system.description) data.system.description = { value: "" };
    if (data.system.description && typeof data.system.description === "string") {
      data.system.description = { value: data.system.description };
    }
    if (!data.system.traits) data.system.traits = { value: [] };

    if (foundry.utils.getProperty(data.system, "traits.value") !== undefined) {
      data.system.traits.value = sp.traits;
    }

    applyActionCost(data.system, sp.actions);

    if (!data.system.description) data.system.description = { value: "" };
    if (typeof data.system.description === "string") {
      data.system.description = { value: data.system.description };
    }
    if (data.system.description && typeof data.system.description === "object") {
      data.system.description.value = sp.descriptionHtml;
    }

    items.push(data);
  }

  return items;
}

function applyActionCost(systemData: any, raw: string | null): void {
  const v = (raw ?? "").trim().toLowerCase();

  if (!systemData.actions || typeof systemData.actions !== "object") {
    systemData.actions = { value: null, type: "passive" };
  }

  if (v === "free") {
    systemData.actions.type = "free";
    systemData.actions.value = null;
    setFirstExisting(systemData, ["actionType.value", "actionType"], "free", {
      allowCreate: true,
      debugLabel: "action.actionType",
    });
    return;
  }

  if (v === "reaction") {
    systemData.actions.type = "reaction";
    systemData.actions.value = null;
    setFirstExisting(systemData, ["actionType.value", "actionType"], "reaction", {
      allowCreate: true,
      debugLabel: "action.actionType",
    });
    return;
  }

  if (!v || v === "none") {
    systemData.actions.type = "passive";
    systemData.actions.value = null;
    setFirstExisting(systemData, ["actionType.value", "actionType"], "passive", {
      allowCreate: true,
      debugLabel: "action.actionType",
    });
    return;
  }

  const toCount: Record<string, number> = { one: 1, two: 2, three: 3 };
  if (v in toCount) {
    systemData.actions.type = "action";
    systemData.actions.value = toCount[v];
    setFirstExisting(systemData, ["actionType.value", "actionType"], "action", {
      allowCreate: true,
      debugLabel: "action.actionType",
    });
  }
}

export function setFirstExisting(
  target: any,
  paths: string[],
  value: unknown,
  options?: { allowCreate?: boolean; debugLabel?: string },
): boolean {
  for (const p of paths) {
    const cur = foundry.utils.getProperty(target, p);
    if (cur !== undefined) {
      foundry.utils.setProperty(target, p, value);
      return true;
    }
  }

  if (options?.allowCreate && paths.length) {
    foundry.utils.setProperty(target, paths[0], value);
    return true;
  }

  if (paths.length) {
    console.debug(
      "LGC | Missing target paths for setFirstExisting",
      options?.debugLabel ?? "",
      paths,
    );
  }
  return false;
}
