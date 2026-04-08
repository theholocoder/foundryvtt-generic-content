export async function rollOnTable(uuid: string): Promise<string | null> {
  if (!uuid) return null;
  try {
    const table = (await fromUuid(uuid)) as any;
    if (!table) return null;
    const result = await table.roll();
    const entry = result?.results?.[0];
    const text = entry?.description ?? entry?.name ?? entry?.getChatText?.() ?? null;
    return typeof text === "string" && text.trim() ? text.trim() : null;
  } catch (err) {
    console.error("LGC | RollTable roll failed", err, { uuid });
    return null;
  }
}
