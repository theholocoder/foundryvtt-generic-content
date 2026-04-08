export { toJQuery } from "./jquery";
export { injectActorDirectoryFooterButton } from "./actor-directory-footer";
export { injectJournalDirectoryFooterButton } from "./journal-directory-footer";
export { rollOnTable } from "./rolltable";

export function deepClone<T>(v: T): T {
  return (foundry.utils as any).deepClone(v) as T;
}

/** Returns the FilePicker class, using the v13+ namespaced path when available. */
export function getFilePicker(): typeof FilePicker {
  return (foundry as any).applications?.apps?.FilePicker?.implementation ?? FilePicker;
}
