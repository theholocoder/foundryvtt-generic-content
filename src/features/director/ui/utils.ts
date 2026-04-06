export async function resolveSceneThumbnail(uuid: string): Promise<string | null> {
  try {
    const doc = await fromUuid(uuid);
    return (doc as any)?.thumb ?? (doc as any)?.background?.src ?? null;
  } catch {
    return null;
  }
}
