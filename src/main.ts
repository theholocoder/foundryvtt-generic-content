import { registerProseMirrorBoxes } from "./features/prosemirror-boxes/prosemirror-boxes";
import { registerNpcImporter } from "./features/npc-importer/npc-importer";
import { registerNpcWizard } from "./features/npc-wizard/npc-wizard";
import { registerPlaceWizard } from "./features/place-wizard/place-wizard";
import { registerDirector } from "./features/director/director";
import { registerDowntime } from "./features/downtime/downtime";
import { DirectorSidebar } from "./features/director/ui/director-sidebar";
import { registerSettings } from "./settings";

import "./styles/main.scss";

Hooks.once("init", async function () {
  console.log("LGC | Initializing...");
  registerProseMirrorBoxes();
  registerSettings();
  registerNpcImporter();
  registerNpcWizard();
  registerPlaceWizard();
  registerDirector();
  registerDowntime();
});

Hooks.once("ready", async function () {
  console.log("LGC | Ready...");
  (globalThis as any).DirectorSidebar = DirectorSidebar;
});
