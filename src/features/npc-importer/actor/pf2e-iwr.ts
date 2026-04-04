import { normalizeBlank, slugifyTrait } from "../utils";

export type IwrWithValue = { type: string; value: number; exceptions?: string };
export type IwrNoValue = { type: string; exceptions?: string };

export function parseIwrWithValues(raw: string | null): IwrWithValue[] {
  const src = normalizeBlank(raw);
  if (!src) return [];

  const parts = src
    .split(/[\n,;]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const out: IwrWithValue[] = [];
  for (const p of parts) {
    const m = p.match(/^([a-zA-Z\-\s]+?)\s+(\d+)\s*(?:\(([^)]+)\))?$/);
    if (!m) continue;
    out.push({
      type: slugifyTrait(m[1]),
      value: Number(m[2]),
      exceptions: normalizeBlank(m[3]?.trim() ?? null) ?? undefined,
    });
  }
  return out;
}

export function parseIwrNoValues(raw: string | null): IwrNoValue[] {
  const src = normalizeBlank(raw);
  if (!src) return [];

  const parts = src
    .split(/[\n,;]+/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const out: IwrNoValue[] = [];
  for (const p of parts) {
    const m = p.match(/^([a-zA-Z\-\s]+?)\s*(?:\(([^)]+)\))?$/);
    if (!m) continue;
    out.push({
      type: slugifyTrait(m[1]),
      exceptions: normalizeBlank(m[2]?.trim() ?? null) ?? undefined,
    });
  }
  return out;
}
