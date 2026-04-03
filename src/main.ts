import { registerProseMirrorBoxes } from "./features/prosemirror-boxes/prosemirror-boxes";
import { registerNpcGenerator } from "./features/npc-generator/npc-generator";

import "./styles/main.scss";

Hooks.once("init", async function () {
  console.log("LGC | Initializing...");
  registerProseMirrorBoxes();
  registerNpcGenerator();
});

Hooks.once("ready", async function () {
  console.log("LGC | Ready...");
});
