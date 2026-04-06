# Lazybobcat - Generic Content

A Foundry VTT module focused on session preparation and game-mastering: ready-to-use compendium content plus lightweight tools to save time during improv.

## Features

### Compendiums

- **Journals, scenes, playlists, maps** — ready-to-drop content.
- **Random tables** — NPC names and other generators.
- **NPC pack** — pre-configured actors (PF2e-targeted).
- **Macros** — utility macros, including one to open the Director sidebar.

### ProseMirror Boxes

A dropdown in the journal/page editor to insert pre-styled HTML blocks:

- Narration
- Quote
- Dice rolls
- Encounter
- Treasure
- Investigation

### NPC Importer

Imports an NPC directly from [monster.pf2.tools](https://monster.pf2.tools) JSON export into a PF2e actor.

- Button added to the Actor Directory footer (GM only).
- Optionally creates a linked journal page and/or an influence stat block.

### NPC Creation Wizard

Generates a fully randomised NPC from roll tables (name, personality, speech pattern, favourite food) and populates a journal with the result.

- Button added to the Actor Directory footer (GM only).
- Roll tables are configurable in module settings.

### Director Sidebar

A GM-only planning tool for structuring sessions into **sessions → beats**, accessible via `Ctrl+Shift+D` or `DirectorSidebar.toggle()` from a macro.

**Sessions view** — cards with cover image, newest first. Add / remove sessions.

**Beats view** — ordered story beats for a session. Beat cards show the linked scene thumbnail. The beat whose scene is currently active is highlighted with an orange indicator that updates automatically on scene change.

**Beat detail view** — per-beat workspace:
- **Scene slot** — drag a scene from the sidebar; buttons to View (GM-only canvas switch), Play (activate scene + open all linked journals), or Remove.
- **Journals / Actors / Items** — drag from the sidebar to link documents; click to open their sheet.
- **Notes** — timestamped with real date/time and in-game world time; add / remove.

Data is stored as a world-scoped settings blob (`directorData`) and persists across sessions.

## Compatibility

- **Required:** Foundry VTT v13+
- **Optional:** PF2e system (required for NPC importer and NPC wizard features)

## Development

```bash
pnpm install       # install dependencies
pnpm dev           # watch + build
pnpm check         # TypeScript type check
pnpm build         # production build
pnpm packs:pack    # compile packs-src → compendium packs
pnpm packs:unpack  # extract compendium packs → packs-src
pnpm packs:status  # show pack diff status
```
