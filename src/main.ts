import { registerProseMirrorBoxes } from "./features/prosemirror-boxes/prosemirror-boxes";
import { registerNpcImporter } from "./features/npc-importer/npc-importer";

import "./styles/main.scss";

Hooks.once("init", async function () {
  console.log("LGC | Initializing...");
  registerProseMirrorBoxes();
  registerNpcImporter();
});

Hooks.once("ready", async function () {
  console.log("LGC | Ready...");
});
