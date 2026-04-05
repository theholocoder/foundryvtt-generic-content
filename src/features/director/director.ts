import { DirectorSidebar } from "./ui/director-sidebar";

export function registerDirector(): void {
  // Re-render the sidebar when the active scene changes so the indicator stays current
  Hooks.on("canvasReady" as any, () => {
    const inst = DirectorSidebar.getInstance();
    if (inst.rendered) inst.render();
  });

  (game.keybindings as any)?.register("lazybobcat-generic-content", "toggleDirector", {
    name: "LGC.Director.ToggleKeybinding",
    hint: "",
    editable: [{ key: "KeyD", modifiers: ["Control", "Shift"] }],
    onDown: () => {
      if (!(game as any).user?.isGM) return;
      DirectorSidebar.toggle();
    },
  });
}
