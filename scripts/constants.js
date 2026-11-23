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
  heavyCavalry: "Heavy Cavalry",
  horseArcher: "Horse Archer"
};

export const UNIT_SIZES = {
  large: "Large",
  standard: "Standard",
  small: "Small"
};

// Movement by unit class. Max movement is movement x 3.
export const MOVEMENT_BY_CLASS = {
  skirmisher: 6,
  lightInfantry: 6,
  mediumInfantry: 6,
  heavyInfantry: 6,
  lightCavalry: 9,
  mediumCavalry: 9,
  heavyCavalry: 9,
  horseArcher: 9
};

// Movement while the Open Order stance is active, for the classes it applies to.
export const OPEN_ORDER_MOVEMENT = {
  lightCavalry: 12,
  horseArcher: 12
};

export const UNIT_CONDITIONS = [
  { key: "shaken", label: "Shaken", image: `modules/${MODULE_ID}/assets/shaken.png` },
  { key: "disordered", label: "Disordered", image: `modules/${MODULE_ID}/assets/disordered.png` },
  { key: "momentum", label: "Momentum", image: `modules/${MODULE_ID}/assets/momentum.png`, belowStance: true },
  { key: "charging", label: "Charging", image: `modules/${MODULE_ID}/assets/charging.png`, belowStance: true },
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
    key: "stubborn",
    label: "Stubborn",
    image: `modules/${MODULE_ID}/assets/stubborn.png`,
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
    tiered: true,
    description: "The first time this unit takes a charge action, it can reroll a number of failed hit dice based on the tier of this talent."
  },

  {
    key: "toughfighters",
    label: "Tough Fighters",
    image: `modules/${MODULE_ID}/assets/toughfighters.png`,
    type: "persistent",
    description: "Unit can reroll one failed attack role."
  },

  {
    key: "swords",
    label: "Swords",
    image: `modules/${MODULE_ID}/assets/swords.png`,
    category: "weapon",
    type: "persistent",
    description: ""
  },
  {
    key: "spears",
    label: "Spears",
    image: `modules/${MODULE_ID}/assets/spears.png`,
    category: "weapon",
    type: "persistent",
    description: ""
  },
  {
    key: "shields",
    label: "Shields",
    image: `modules/${MODULE_ID}/assets/shields.png`,
    category: "weapon",
    type: "persistent",
    description: ""
  },
  {
    key: "lances",
    label: "Lances",
    image: `modules/${MODULE_ID}/assets/lances.png`,
    category: "weapon",
    type: "persistent",
    description: ""
  },
  {
    key: "longbows",
    label: "Longbows",
    image: `modules/${MODULE_ID}/assets/longbows.png`,
    category: "weapon",
    type: "persistent",
    description: ""
  },
  {
    key: "pikes",
    label: "Pikes",
    image: `modules/${MODULE_ID}/assets/pikes.png`,
    category: "weapon",
    type: "persistent",
    description: "Cavalry receive no combat bonuses when fighting a unit armed with pikes.\n\nPike-armed units double their Hand-to-Hand value when fighting charging cavalry.\n\nPikes are not allowed to attempt to turn-to-face a charging enemy.\n\nChargers lose the charge bonus (except pikes).\n\nHas Phalanx (2)."
  },
  {
    key: "halberds",
    label: "Halberds",
    image: `modules/${MODULE_ID}/assets/halberds.png`,
    category: "weapon",
    type: "persistent",
    description: "Cap the enemy morale save at 5+ when attacking in melee."
  },
  {
    key: "elfBows",
    label: "Elf Bows",
    image: `modules/${MODULE_ID}/assets/elfBows.png`,
    category: "weapon",
    type: "persistent",
    description: "Range = 24\".\n\n-1 Morale at less than 12\"."
  },
  {
    key: "bows",
    label: "Bows",
    image: `modules/${MODULE_ID}/assets/bows.png`,
    category: "weapon",
    type: "persistent",
    description: "Long Range distance is 18\"-20\"."
  },
  {
    key: "crossbows",
    label: "Crossbows",
    image: `modules/${MODULE_ID}/assets/crossbows.png`,
    category: "weapon",
    type: "persistent",
    description: "Cap the enemy morale save at 5+ when attacking at range."
  },
  {
    key: "longSpears",
    label: "Long Spears",
    image: `modules/${MODULE_ID}/assets/longSpears.png`,
    category: "weapon",
    type: "persistent",
    description: "Charging cavalry/chariots are disordered on a roll of 1, 2, or 3 (except kontos).\n\nChargers lose the charge bonus (except other long spears and pikes).\n\nBroadly speaking, troops with this rule are not given a ranged attack value unless also armed with missile weapons."
  },
  {
    key: "shortBows",
    label: "Short Bows",
    image: `modules/${MODULE_ID}/assets/shortBows.png`,
    category: "weapon",
    type: "persistent",
    description: "Long Range is 10-12\"."
  },
  {
    key: "axes",
    label: "Axes",
    image: `modules/${MODULE_ID}/assets/axes.png`,
    category: "weapon",
    type: "persistent",
    description: ""
  },
  {
    key: "matchlocks",
    label: "Matchlocks",
    image: `modules/${MODULE_ID}/assets/matchlocks.png`,
    category: "weapon",
    type: "persistent",
    description: "Long Range 16\"-18\".\n\nReceive +1 to hit at 6\" or less."
  },
  {
    key: "firelocks",
    label: "Firelocks",
    image: `modules/${MODULE_ID}/assets/firelocks.png`,
    category: "weapon",
    type: "persistent",
    description: "Long Range 16\"-18\".\n\nReceive +1 to hit at 12\" or less."
  },
  {
    key: "shIntegration",
    label: "S/H Integration",
    image: `modules/${MODULE_ID}/assets/shintegration.png`,
    type: "persistent",
    description: "+1 hand-to-hand combat die for the pike block.\n\n−1 to the enemy's morale save when the ability is used.\n\nUsed on the clash."
  },
  {
    key: "drilled",
    label: "Drilled",
    image: `modules/${MODULE_ID}/assets/drilled.png`,
    type: "persistent",
    description: "Free move on failed order.\n\nMove through or out of the way of friends without risk of disorder.\n\nDrilled units make one free move if they fail their order or unless a blunder is rolled, in which case this takes precedence. If a division order encompasses units that are drilled and units that are not, then only drilled units are entitled to this free move.\n\nDrilled units do not risk becoming disordered when moving through other drilled units where both are in a battle line formation, and neither is already disordered.\n\nDrilled units that are giving ground in hand-to-hand combat do not risk becoming disordered when moving through other drilled units where both are in a battle line formation, and neither is already disordered."
  },
  {
    key: "eager",
    label: "Eager",
    image: `modules/${MODULE_ID}/assets/eager.png`,
    type: "persistent",
    description: "Free move on charge order.\n\nUnits given an order to charge an enemy within charge range make one move if they fail their order and assuming they don't blunder.\n\nIf a blunder is rolled, the result is always taken as 6 on the blunder result table – charge!\n\nIf a division order encompasses units that are eager and units that are not, then only the eager units are affected by the rule."
  },
  {
    key: "elite",
    label: "Elite",
    image: `modules/${MODULE_ID}/assets/elite.png`,
    type: "persistent",
    description: "Recover from disorder on roll of 4+ at start of Command.\n\nAt the start of the Command part of the player's turn, before any units are moved or orders given, a dice is rolled for each elite unit that is currently disordered and which is not already engaged in hand-to-hand combat."
  },
  {
    key: "feignedFlight",
    label: "Feigned Flight",
    image: `modules/${MODULE_ID}/assets/feignedFlight.png`,
    type: "persistent",
    description: "Can move out of combat engagement.\n\nA unit with the feigned flight ability can be given orders to move, or can use its initiative to move, when it is engaged in combat. This enables a unit that is either fighting or supporting in a combat engagement to move out of combat during the Command part of the player's turn."
  },
  {
    key: "frenziedCharge",
    label: "Frenzied Charge",
    image: `modules/${MODULE_ID}/assets/frenziedCharge.png`,
    type: "persistent",
    description: "Must charge with three moves allowed.\n\n1 free move on failed order. Not applied to shaken or disordered units."
  },
  {
    key: "freshlyRaised",
    label: "Freshly Raised",
    image: `modules/${MODULE_ID}/assets/freshlyRaised.png`,
    type: "once",
    description: "Check unit in first round of combat.\n\nThe unit's capabilities are uncertain and its behaviour in battle cannot be entirely predicted.\n\nDuring the unit's first round of melee or ranged fighting of the game, roll a dice at the start of the combat.\n\n1 Terror. The unit is momentarily overcome with terror – for this round only, all attacks need 6s to hit and the unit becomes disordered if it is not already so.\n\n2–3 Panic. The unit is momentarily overcome by panic – for this round only, all attacks need 6s to hit.\n\n4–5 Determined. The troops do their duty – no effect.\n\n6 Inspired! The unit fights with unexpected fervour – the unit gets an extra bonus attack this round.\n\nThe result applies for the first round fought during the game – thereafter the unit fights normally except where it becomes disordered, in which case it remains disordered as is usual for disordered units in combat."
  },
  {
    key: "firstFire",
    label: "First Fire",
    image: `modules/${MODULE_ID}/assets/firstFire.png`,
    type: "once",
    description: "First Fire grants +1 to a unit's Shooting Value the first time it fires during the game."
  },
  {
    key: "levy",
    label: "Levy",
    image: `modules/${MODULE_ID}/assets/levy.png`,
    type: "persistent",
    description: "Must roll 4+ to recover disorder at end of turn.\n\nLevies are ill-disciplined or poorly trained troops. When they fall into confusion they can mill about uselessly in the face of the enemy.\n\nUnits that are designated as levy do not automatically recover from disorder at the end of their turn but must roll a dice and only recover successfully on the roll of a 4, 5, or 6.\n\nPlayers and umpires who wish to do so can vary the score required to represent different degrees of competence. For example, a unit that only recovered on a 6 would be fortunate ever to do so. For practical purposes 4+ is the default value and works well in most situations."
  },
  {
    key: "marauder",
    label: "Marauder",
    image: `modules/${MODULE_ID}/assets/marauder.png`,
    type: "persistent",
    description: "Ignore distance penalty for command."
  },
  {
    key: "marksman",
    label: "Marksman",
    image: `modules/${MODULE_ID}/assets/marksman.png`,
    type: "persistent",
    description: "Re-roll one missed shot.\n\nThis rule represents the abilities of expert missile men be they archers, slingers, artillerymen or the like.\n\nThe unit can re-roll a single failed ranged attack each time it 'shoots' in the Ranged Combat part of the turn, or from closing or traversing shots."
  },
  {
    key: "militia",
    label: "Militia",
    image: `modules/${MODULE_ID}/assets/militia.png`,
    type: "persistent",
    description: "No move on equal leadership roll.\n\nThis represents ill-disciplined or poorly trained troops, citizen militias, and perhaps levies of not overly enthusiastic subject peoples.\n\nWhere a division consists of militia and other units, then only the militia will fail their order on an equal dice roll – other units move once as normal."
  },
  {
    key: "phalanx",
    label: "Phalanx",
    image: `modules/${MODULE_ID}/assets/phalanx.png`,
    type: "persistent",
    tiered: true,
    description: "Hand-to-hand combat defeats by up to 2 casualties are treated as a draw.\n\nWhere a unit with the phalanx rule does have to take a break test, the full difference in casualties counts against it in the usual way.\n\nThe phalanx rule only applies where the unit is fighting over open ground. It no longer applies if a unit is fighting within rough ground, over an obstacle, within a wood or over a building."
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
  },
  {
    key: "pikewall",
    label: "Pikewall",
    image: `modules/${MODULE_ID}/assets/pike.png`,
    type: "stance",
    description: ""
  },
  {
    key: "hedgehog",
    label: "Hedgehog",
    image: `modules/${MODULE_ID}/assets/hedgehog.png`,
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
