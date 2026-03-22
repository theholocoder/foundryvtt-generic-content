type PMDispatch = (tr: any) => void;
type PMCommand = (state: any, dispatch: PMDispatch | undefined, view: any) => boolean;

const DROPDOWN_KEY = "lgcBoxes";

function insertHtmlCommand(html: string): PMCommand {
  return (state, dispatch): boolean => {
    if (!dispatch) return true;

    try {
      const wrap = document.createElement("div");
      wrap.innerHTML = html.trim();

      const parser = foundry.prosemirror.DOMParser.fromSchema(state.schema) as any;
      const slice = parser.parseSlice(wrap);

      dispatch(state.tr.replaceSelection(slice).scrollIntoView());
      return true;
    } catch (err) {
      console.error("LGC | Failed to insert ProseMirror HTML block", err);
      ui.notifications?.error("LGC | Failed to insert block");
      return false;
    }
  };
}

export function registerProseMirrorBoxes(): void {
  Hooks.on("getProseMirrorMenuDropDowns" as any, (_menu: any, dropdowns: any) => {
    const cfg = dropdowns as any;
    if (cfg[DROPDOWN_KEY]) return;

    const entries = [
      {
        action: "lgc-box-narration",
        title: "Narration",
        icon: '<i class="fa-solid fa-book-open"></i>',
        cmd: insertHtmlCommand(
          [
            '<blockquote class="lgc-box-text narrative">',
            "  <p>The content of the narrative<br>Can span across multiple lines</p>",
            "</blockquote>",
          ].join("\n"),
        ),
      },
      {
        action: "lgc-box-citation",
        title: "Citation",
        icon: '<i class="fa-solid fa-quote-left"></i>',
        cmd: insertHtmlCommand(
          [
            '<blockquote class="lgc-box-text citation">',
            "    <p>\u00ab Dans les cendres du monde br\u00fbl\u00e9, le Psylith s\u2019\u00e9l\u00e8ve \u2014 une seule volont\u00e9, des milliers de corps, une perfection \u00e9ternelle. \u00bb</p>",
            "    <p><strong>\u2014 Auteur.</strong></p>",
            "</blockquote>",
          ].join("\n"),
        ),
      },
      {
        action: "lgc-box-fvtt",
        title: "FVTT",
        icon: '<i class="fa-solid fa-dice-d20"></i>',
        cmd: insertHtmlCommand(
          [
            '<section class="lgc-box-text fvtt">',
            "    <header>",
            '        <img src="icons/vtt-512.png" width="100">',
            "        <h2>Foundry VTT Advice</h2>",
            "    </header>",
            "    <article>",
            "        <p>One of the most commonly used call-outs, a box which looks like this one will give you instructions specific to using features of Foundry VTT.</p>",
            "    </article>",
            "</section>",
          ].join("\n"),
        ),
      },
      {
        action: "lgc-box-encounter",
        title: "Rencontre",
        icon: '<i class="fa-solid fa-dragon"></i>',
        cmd: insertHtmlCommand(
          [
            '<section class="lgc-box-text encounter">',
            "    <header>",
            '        <img src="modules/pf2e-beginner-box/assets/artwork-other/icon-monster.webp" width="100">',
            "        <h2>Encounters</h2>",
            "    </header>",
            "    <article>",
            "        <p>A box which looks like this one contains references to creatures or threats that are dangerous to the player characters, as well as tactics and advice for how to facilitate the encounter. Usually, the top of the box will contain a dynamic link to relevant Actor sheets so that you can quickly reference character stats or make rolls.</p>",
            "    </article>",
            "</section>",
          ].join("\n"),
        ),
      },
      {
        action: "lgc-box-treasure",
        title: "Tr\u00e9sor",
        icon: '<i class="fa-solid fa-gem"></i>',
        cmd: insertHtmlCommand(
          [
            '<section class="lgc-box-text treasure">',
            "    <header>",
            '        <img src="modules/pf2e-beginner-box/assets/artwork-other/icon-treasure.webp" width="100">',
            "        <h2>Treasure</h2>",
            "    </header>",
            "    <article>",
            "        <p>Treasure text boxes contain a summary of special items and goods to reward your players for their successes, and usually follow an encounter. You will find that most of these link to a special type of Actor Sheet called a \"Loot Sheet\" which contains all the special items and currency to be shared.</p>",
            "    </article>",
            "</section>",
          ].join("\n"),
        ),
      },
    ];

    cfg[DROPDOWN_KEY] = {
      action: "lgc-boxes",
      title: "LGC",
      cssClass: "lgc-prosemirror-dropdown",
      icon: '<i class="fa-solid fa-cat fa-fw"></i>',
      entries,
    };
  });
}
