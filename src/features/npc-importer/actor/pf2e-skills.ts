export function normalizeKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function indexActorSkills(skillsObj: Record<string, any>): Map<string, string> {
  const out = new Map<string, string>();

  for (const [key, data] of Object.entries(skillsObj)) {
    const candidates: string[] = [key];
    if (data && typeof data === "object") {
      for (const p of ["slug", "name", "label"]) {
        const v = data[p];
        if (typeof v === "string") candidates.push(v);
      }
      const nestedLabel = foundry.utils.getProperty(data, "label");
      if (typeof nestedLabel === "string") candidates.push(nestedLabel);
    }

    for (const c of candidates) {
      const nk = normalizeKey(c);
      if (!nk) continue;
      if (!out.has(nk)) out.set(nk, key);
    }
  }

  for (const [k, v] of Array.from(out.entries())) {
    if (!v) out.delete(k);
  }

  return out;
}
