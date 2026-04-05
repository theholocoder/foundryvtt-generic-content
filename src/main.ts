import { registerProseMirrorBoxes } from "./features/prosemirror-boxes/prosemirror-boxes";
import { registerNpcImporter } from "./features/npc-importer/npc-importer";
import { registerNpcWizard } from "./features/npc-wizard/npc-wizard";
import { registerSettings } from "./settings";

import "./styles/main.scss";

Hooks.once("init", async function () {
  console.log("LGC | Initializing...");
  registerProseMirrorBoxes();
  registerSettings();
  registerNpcImporter();
  registerNpcWizard();
});

Hooks.once("ready", async function () {
  console.log("LGC | Ready...");
});
