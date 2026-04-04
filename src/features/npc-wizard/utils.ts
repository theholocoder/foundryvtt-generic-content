export function deepClone<T>(obj: T): T {
  return (foundry.utils as any).deepClone(obj) as T;
}
