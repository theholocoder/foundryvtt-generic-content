export type JSONObject = Record<string, unknown>;

export type NormalizedStrike = {
  name: string;
  kind: "melee" | "ranged";
  traits: string[];
  attack: number | null;
  damageRaw: string | null;
  damageParsed: {
    formula: string | null;
    damageType: string | null;
    note: string | null;
  };
};

export type NormalizedSpecial = {
  name: string;
  traits: string[];
  actions: string | null;
  descriptionRaw: string;
  descriptionHtml: string;
};

export type NormalizedNpc = {
  name: string;
  level: number | null;
  alignment: string | null;
  size: string | null;
  creatureType: string | null;
  ancestryLike: string | null;
  customTraits: string[];
  rarity: string | null;
  img: string | null;
  description: string | null;
  info: string | null;
  speedRaw: string | null;
  languagesRaw: string | null;
  sensesRaw: string | null;
  ac: number | null;
  hp: number | null;
  perception: number | null;
  saves: {
    fortitude: number | null;
    reflex: number | null;
    will: number | null;
  };
  abilities: {
    str: number | null;
    dex: number | null;
    con: number | null;
    int: number | null;
    wis: number | null;
    cha: number | null;
  };
  skills: Record<string, number>; // legacy slugs if they match
  skillsRaw: Record<string, number>; // pf2.tools keys (intimidation, nature, ...)
  resistancesRaw: string | null;
  weaknessesRaw: string | null;
  immunitiesRaw: string | null;
  strikes: NormalizedStrike[];
  specials: NormalizedSpecial[];
  spellcasting: {
    tradition: "occult" | "arcane" | "divine" | "primal" | null;
    preparation:
      | "innate"
      | "prepared"
      | "spontaneous"
      | "focus"
      | "ritual"
      | null;
    spellAttack: number | null;
    spellDc: number | null;
    focusPoints: number | null;
    cantripLevel: number | null;
    spellsByLevel: Array<{ level: number; names: string[] }>;
  };
  raw: unknown;
};

export type ImportContext = {
  spellIndex: Map<string, { pack: any; id: string }> | null;
};
