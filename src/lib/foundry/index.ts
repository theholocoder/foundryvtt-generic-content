export { toJQuery } from "./jquery";
export { injectActorDirectoryFooterButton } from "./actor-directory-footer";

export function deepClone<T>(v: T): T {
  return (foundry.utils as any).deepClone(v) as T;
}
