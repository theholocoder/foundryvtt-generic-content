import { registerProseMirrorBoxes } from "./features/prosemirror-boxes/prosemirror-boxes";

import "./styles/main.scss";

Hooks.once("init", async function () {
  console.log("LGC | Initializing...");
  registerProseMirrorBoxes();
});

Hooks.once("ready", async function () {
  console.log("LGC | Ready...");
});
