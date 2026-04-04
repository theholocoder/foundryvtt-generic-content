export function normalizeBlank(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  if (t === "-") return null;
  return t;
}

export function asNonEmptyString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

export function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return null;
    const n = Number(t);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function splitCsv(raw: string | null | undefined): string[] {
  const src = normalizeBlank(raw);
  if (!src) return [];
  return src
    .split(/[,;]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function slugifyTrait(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export function toHtml(text: string): string {
  // Minimal markdown-ish conversion: **bold**, newlines.
  const escaped = escapeHtml(text);
  const strong = escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return `<p>${strong.replace(/\n/g, "<br />")}</p>`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function deepClone<T>(v: T): T {
  return foundry.utils.deepClone(v);
}
