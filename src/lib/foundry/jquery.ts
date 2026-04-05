export function toJQuery(html: unknown): JQuery {
  if ((globalThis as any).jQuery && html instanceof (globalThis as any).jQuery) {
    return html as JQuery;
  }
  return $(html as any);
}
