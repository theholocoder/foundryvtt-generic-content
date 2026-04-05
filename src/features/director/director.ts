import { DirectorSidebar } from "./ui/director-sidebar";

export function registerDirector(): void {
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
