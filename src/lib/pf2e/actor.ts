export async function finalizeHp(actor: Actor, hp: number): Promise<void> {
  if (!hp) return;
  try {
    // Two separate updates: PF2e may clamp value = min(old_value, new_max) during
    // preUpdateActor hooks, so setting both in one call can leave value at the old default.
    await actor.update({ "system.attributes.hp.max": hp } as any);
    const valueUpdate: Record<string, unknown> = { "system.attributes.hp.value": hp };
    if (foundry.utils.getProperty((actor as any).system, "attributes.hp.temp") !== undefined) {
      valueUpdate["system.attributes.hp.temp"] = 0;
    }
    await actor.update(valueUpdate as any);
  } catch (err) {
    console.error("LGC | Failed to finalize HP", err, { actor: actor?.name, hp });
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
