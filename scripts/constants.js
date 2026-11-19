export const MODULE_ID = "axona";
export const FLAG = "unit";
export const SHEET_ID = `${MODULE_ID}.ArmyUnitSheet`;
export const DIVISION_SHEET_ID = `${MODULE_ID}.DivisionSheet`;
export const ARMY_SHEET_ID = `${MODULE_ID}.ArmySheet`;

export const TEMPLATES = {
  tabs: `modules/${MODULE_ID}/templates/tabs.hbs`,
  summary: `modules/${MODULE_ID}/templates/units/unit-summary.hbs`,
  unit: `modules/${MODULE_ID}/templates/units/unit-tab.hbs`,
  talents: `modules/${MODULE_ID}/templates/units/talents-tab.hbs`,
  settings: `modules/${MODULE_ID}/templates/units/settings-tab.hbs`,
  flags: `modules/${MODULE_ID}/templates/units/flags-tab.hbs`
};

// Edit these lists to change the choices shown in the Unit tab dropdowns.
export const ATTACK_TYPES = {
  melee: "Melee",
  ranged: "Ranged"
};

export const UNIT_CLASSES = {
  skirmisher: "Skirmisher",
  lightInfantry: "Light Infantry",
  mediumInfantry: "Medium Infantry",
  heavyInfantry: "Heavy Infantry",
  lightCavalry: "Light Cavalry",
  mediumCavalry: "Medium Cavalry",
  heavyCavalry: "Heavy Cavalry"
};

export const UNIT_SIZES = {
  large: "Large",
  standard: "Standard",
  small: "Small"
};

export const UNIT_CONDITIONS = [
  { key: "shaken", label: "Shaken", image: `modules/${MODULE_ID}/assets/shaken.png` },
  { key: "disordered", label: "Disordered", image: `modules/${MODULE_ID}/assets/disordered.png` },
  { key: "momentum", label: "Momentum", image: `modules/${MODULE_ID}/assets/momentum.png` },
  { key: "charging", label: "Charging", image: `modules/${MODULE_ID}/assets/charging.png` },
  { key: "engaged", label: "Engaged", image: `modules/${MODULE_ID}/assets/engaged.png`, belowStance: true },
  { key: "shattered", label: "Shattered", image: `modules/${MODULE_ID}/assets/shattered.png`, overlay: true },
  { key: "closeRanks", label: "Close Ranks", setting: "usesCloseRanks", image: `modules/${MODULE_ID}/assets/closeranks.png` }
];

export const UNIT_TALENTS = [
  {
    key: "valiant",
    label: "Valiant",
    image: `modules/${MODULE_ID}/assets/valiant.png`,
    type: "once",
    description: "Unit can reroll."
  },
  {
    key: "pilum",
    label: "Pilum",
    image: `modules/${MODULE_ID}/assets/pilum.png`,
    category: "weapon",
    type: "persistent",
    description: "On the clash, the opposing unit gets -1 to its morale save."
  },
  {
    key: "toughfighters",
    label: "Tough Fighters",
    image: `modules/${MODULE_ID}/assets/toughfighters.png`,
    type: "persistent",
    description: "Unit can reroll one failed morale save."
  },

  {
    key: "parthianshot",
    label: "Parthian Shot",
    image: `modules/${MODULE_ID}/assets/parthianshot.png`,
    type: "persistent",
    description: "Unit can fire closing shots while taking an evasion reaction when charged. The normal -1 penalty to hit from closing shots still applies."
  },
  {
    key: "wildfighters",
    label: "Wild Fighters",
    image: `modules/${MODULE_ID}/assets/wildfighters.png`,
    type: "once",
    tier: "",
    description: "The first time this unit takes a charge action, it can reroll a number of failed hit dice based on the tier of this talent."
  },

  {
    key: "savageattackers",
    label: "Savage Attackers",
    image: `modules/${MODULE_ID}/assets/savageattackers.png`,
    type: "persistent",
    description: "Unit can reroll one failed attack role."
  },

  {
    key: "sword",
    label: "Sword",
    image: `modules/${MODULE_ID}/assets/sword.png`,
    category: "weapon",
    type: "persistent",
    description: ""
  },
  {
    key: "spear",
    label: "Spear",
    image: `modules/${MODULE_ID}/assets/spear.png`,
    category: "weapon",
    type: "persistent",
    description: ""
  },
  {
    key: "shield",
    label: "Shield",
    image: `modules/${MODULE_ID}/assets/shield.png`,
    category: "weapon",
    type: "persistent",
    description: ""
  },
  {
    key: "lance",
    label: "Lance",
    image: `modules/${MODULE_ID}/assets/lance.png`,
    category: "weapon",
    type: "persistent",
    description: ""
  },
  {
    key: "longbow",
    label: "Longbow",
    image: `modules/${MODULE_ID}/assets/longbow.png`,
    category: "weapon",
    type: "persistent",
    description: ""
  },
  {
    key: "battleline",
    label: "Battleline",
    image: `modules/${MODULE_ID}/assets/battleline.png`,
    type: "stance",
    description: ""
  },
  {
    key: "openOrder",
    label: "Open Order",
    image: `modules/${MODULE_ID}/assets/openorder.png`,
    type: "stance",
    description: ""
  },
  {
    key: "column",
    label: "Column",
    image: `modules/${MODULE_ID}/assets/column.png`,
    type: "stance",
    description: ""
  },
  {
    key: "warband",
    label: "Warband",
    image: `modules/${MODULE_ID}/assets/warband.png`,
    type: "stance",
    description: ""
  },
  {
    key: "square",
    label: "Square",
    image: `modules/${MODULE_ID}/assets/square.png`,
    type: "stance",
    description: ""
  },
  {
    key: "testudo",
    label: "Testudo",
    image: `modules/${MODULE_ID}/assets/testudo.png`,
    type: "stance",
    description: ""
  },
  {
    key: "wedge",
    label: "Wedge",
    image: `modules/${MODULE_ID}/assets/wedge.png`,
    type: "stance",
    description: ""
  }
];

// Stat changes relative to a Standard unit. Morale Save isnt affected by its size
export const SIZE_MARKERS = { small: "II", standard: "X", large: "XI" };

export const SIZE_MODS = {
  large: { clash: 2, sustained: 2, shortRange: 1, longRange: 1, stamina: 2 },
  standard: {},
  small: { clash: -2, sustained: -2, shortRange: -1, longRange: -1, stamina: -2 }
};

export const STATS = [
  { key: "clash", label: "Clash", sheetLabel: "C", min: 0, initial: 0 },
  { key: "sustained", label: "Sustained", sheetLabel: "Su", min: 0, initial: 0 },
  { key: "shortRange", label: "Short Range", sheetLabel: "SR", min: 0, initial: 0, zeroLocked: true },
  { key: "longRange", label: "Long Range", sheetLabel: "LR", min: 0, initial: 0, zeroLocked: true },
  { key: "morale", label: "Morale Save", sheetLabel: "M", min: 0, initial: 0, suffix: "+" },
  { key: "stamina", label: "Stamina", sheetLabel: "S", min: 1, initial: 6 }
];
