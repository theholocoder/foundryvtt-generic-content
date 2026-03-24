type PMDispatch = (tr: any) => void;
type PMCommand = (
  state: any,
  dispatch: PMDispatch | undefined,
  view: any,
) => boolean;

const DROPDOWN_KEY = "lgcBoxes";

function insertHtmlCommand(html: string): PMCommand {
  return (state, dispatch): boolean => {
    if (!dispatch) return true;

    try {
      const wrap = document.createElement("div");
      wrap.innerHTML = html.trim();

      const parser = foundry.prosemirror.DOMParser.fromSchema(
        state.schema,
      ) as any;
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
  Hooks.on(
    "getProseMirrorMenuDropDowns" as any,
    (_menu: any, dropdowns: any) => {
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
              "  <p>Une description d'une scène ou un élément à donner aux joueurs.<br>Peut-être sur plusieurs lignes.</p>",
              "</blockquote>",
              "<p></p>",
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
              "    <p>« Dans les cendres du monde brûlé, le Psylith s’élève — une seule volonté, des milliers de corps, une perfection éternelle. »</p>",
              "    <p><strong>— Auteur.</strong></p>",
              "</blockquote>",
              "<p></p>",
            ].join("\n"),
          ),
        },
        {
          action: "lgc-box-fvtt",
          title: "Bloc : jets possibles",
          icon: '<i class="fa-solid fa-dice-d20"></i>',
          cmd: insertHtmlCommand(
            [
              '<section class="lgc-box-text dice-roll">',
              "    <header>",
              '        <img src="icons/svg/d20.svg" width="96">',
              "        <h2>Jets possibles</h2>",
              "    </header>",
              "    <article>",
              "        <p>Lister les jets possibles à effectuer et les résultats attendus ici.</p>",
              "        <table><tbody><tr><th>Rechercher</th><td>@Check[type:perception|dc:25]</td></tr></tbody></table>",
              "    </article>",
              "</section>",
              "<p></p>",
            ].join("\n"),
          ),
        },
        {
          action: "lgc-box-encounter",
          title: "Bloc : rencontre",
          icon: '<i class="fa-solid fa-dragon"></i>',
          cmd: insertHtmlCommand(
            [
              '<section class="lgc-box-text encounter">',
              "    <header>",
              '        <img src="icons/svg/sword.svg" width="96">',
              "        <h2>Rencontre</h2>",
              "    </header>",
              "    <article>",
              "        <p>Il peut s'agit d'une rencontre de combat ou d'une rencontre \"roleplay\". Vous pouvez lister les adversaires ici et laisser quelques notes sur leur stratégie.</p>",
              "    </article>",
              "</section>",
              "<p></p>",
            ].join("\n"),
          ),
        },
        {
          action: "lgc-box-treasure",
          title: "Bloc : trésor",
          icon: '<i class="fa-solid fa-gem"></i>',
          cmd: insertHtmlCommand(
            [
              '<section class="lgc-box-text treasure">',
              "    <header>",
              '        <img src="icons/svg/coins.svg" width="96">',
              "        <h2>Récompenses</h2>",
              "    </header>",
              "    <article>",
              "        <p>Listez ici les objets et pièces d'or trouvés par les personnages.</p>",
              "    </article>",
              "</section>",
              "<p></p>",
            ].join("\n"),
          ),
        },
        {
          action: "lgc-box-investigation",
          title: "Bloc : investigation",
          icon: '<i class="fa-solid fa-gem"></i>',
          cmd: insertHtmlCommand(
            [
              '<section class="lgc-box-text investigation">',
              "    <header>",
              '        <img src="icons/svg/door-locked-outline.svg" width="96">',
              "        <h2>Investigation</h2>",
              "    </header>",
              "    <article>",
              "        <p>Lister les informations à trouver et le type de jet à effectuer ici.</p>",
              "        <table><tbody><tr><th>Rechercher</th><td>@Check[type:perception|dc:25]</td></tr></tbody></table>",
              "    </article>",
              "</section>",
              "<p></p>",
            ].join("\n"),
          ),
        },
        {
          action: "lgc-box-simple-npc",
          title: "Bloc : PNJ",
          icon: '<i class="fa-solid fa-user"></i>',
          cmd: insertHtmlCommand(
            [
              '<div class="lgc-box-text simple-npc">',
              '    <div class="simple-npc__description">',
              "        <h2>Apparence</h2>",
              "        <p>TODO</p>",
              "        <h2>Informations</h2>",
              "        <p>TODO</p>",
              "    </div>",
              '    <div class="simple-npc__attributes">',
              "        <section>",
              "            <div>",
              "                <p><strong>Ascendance</strong> <span>humain</span></p>",
              "            </div>",
              "            <div>",
              "                <p><strong>Statut</strong> <span>vivant</span></p>",
              "            </div>",
              "        </section>",
              "    </div>",
              "</div>",
              "<p></p>",
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
    },
  );
}
