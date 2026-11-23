import { MODULE_ID } from "./scripts/constants.js";
import {
  createUnitData,
  getUnit,
  getMaxHp,
  makeUnit,
  removeUnit,
  applyDamage,
  registerUnitHooks
} from "./scripts/units/unit.js";
import { ArmyUnitSheet } from "./scripts/units/unit-sheet.js";
import { registerActorMenu } from "./scripts/menu.js";
import { registerTokenHud } from "./scripts/token-hud.js";
import { registerBreakTests, rollSelectedBreakTest } from "./scripts/break-tests.js";
import { registerDivisionHooks, getDivision, makeDivision, removeDivision } from "./scripts/divisions/division.js";
import { deployDivision, returnDivision } from "./scripts/divisions/deploy.js";
import { assignCommander, registerCommanderMacro } from "./scripts/divisions/commander.js";
import { rollAttack, registerAttackMacro } from "./scripts/attacks/attack.js";
import { registerClashHooks } from "./scripts/attacks/clash.js";
import { DivisionSheet } from "./scripts/divisions/division-sheet.js";
import { getArmy, makeArmy, removeArmy } from "./scripts/armies/army.js";
import { ArmySheet } from "./scripts/armies/army-sheet.js";

Hooks.once("init", () => {
  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    Actor,
    MODULE_ID,
    ArmyUnitSheet,
    { makeDefault: false, label: "Axona Army Unit" }
  );
  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    Actor,
    MODULE_ID,
    DivisionSheet,
    { makeDefault: false, label: "Axona Division" }
  );
  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    Actor,
    MODULE_ID,
    ArmySheet,
    { makeDefault: false, label: "Axona Army" }
  );

  game.modules.get(MODULE_ID).api = {
    createUnitData,
    getUnit,
    getMaxHp,
    makeUnit,
    removeUnit,
    applyDamage,
    rollSelectedBreakTest,
    getDivision,
    makeDivision,
    removeDivision,
    deployDivision,
    returnDivision,
    assignCommander,
    rollAttack,
    getArmy,
    makeArmy,
    removeArmy
  };
});

registerUnitHooks();
registerActorMenu();
registerTokenHud();
registerBreakTests();
registerDivisionHooks();
registerCommanderMacro();
registerAttackMacro();
registerClashHooks();
