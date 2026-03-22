import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { extractPack } from "@foundryvtt/foundryvtt-cli";

import {
  getPacksFromManifest,
  isClassicLevelPackDir,
  listFilesRecursive,
  newestMtimeMs,
  readManifest,
} from "./packs-utils.mjs";

const root = process.cwd();
const stateDir = path.join(root, "packs-src", ".state");
mkdirSync(stateDir, { recursive: true });

const manifest = readManifest();
const packs = getPacksFromManifest(manifest);

for (const p of packs) {
  const distPackDir = path.join(root, "dist", p.path);
  if (!isClassicLevelPackDir(distPackDir)) {
    throw new Error(
      `[packs:unpack] Missing or invalid LevelDB pack at ${distPackDir}. If you are on a fresh clone, run pnpm packs:pack first.`
    );
  }

  const srcPackDir = distPackDir;
  const destDir = path.join(root, "packs-src", p.name);

  const tmpDir = path.join(root, ".tmp", "packs", p.name);

  console.log(`[packs:unpack] ${p.name} (${p.path}) -> ${path.relative(root, destDir)}`);

  mkdirSync(destDir, { recursive: true });

  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(path.dirname(tmpDir), { recursive: true });
  cpSync(srcPackDir, tmpDir, { recursive: true });
  // If Foundry is running, the source pack may be locked. Remove the lock in the copy.
  rmSync(path.join(tmpDir, "LOCK"), { force: true });

  try {
    await extractPack(tmpDir, destDir, {
      log: true,
      clean: true,
      folders: true,
      omitVolatile: true,
      jsonOptions: { space: 2 },
    });
  } catch (err) {
    console.error(`[packs:unpack] Failed for ${p.name} from ${srcPackDir}`);
    throw err;
  }

  rmSync(tmpDir, { recursive: true, force: true });

  // Update local stamp for safe packing.
  const files = listFilesRecursive(distPackDir);
  const stamp = {
    pack: p.name,
    distPath: p.path,
    distNewestMtimeMs: files.length ? newestMtimeMs(files) : 0,
    updatedAt: Date.now(),
  };
  writeFileSync(path.join(stateDir, `${p.name}.json`), JSON.stringify(stamp, null, 2));
}
