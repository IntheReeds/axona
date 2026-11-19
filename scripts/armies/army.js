import { MODULE_ID, ARMY_SHEET_ID } from "../constants.js";
import { getDivision } from "../divisions/division.js";
import { getUnit } from "../units/unit.js";

export function getArmy(actor) {
  return actor?.getFlag(MODULE_ID, "army") ?? null;
}

export function getDivisionArmy(division) {
  return getArmy(game.actors.get(getDivision(division)?.armyId));
}

export async function makeArmy(actor) {
  if (getUnit(actor) || getDivision(actor) || getArmy(actor)) {
    ui.notifications.warn("This actor is already an Axona unit, division, or army.");
    return;
  }
  await actor.update({
    [`flags.${MODULE_ID}.army`]: { enabled: true },
    "flags.core.sheetClass": ARMY_SHEET_ID
  });
}

export async function removeArmy(actor) {
  if (game.actors.contents.some(division => getDivision(division)?.armyId === actor.id)) {
    ui.notifications.warn("Remove all divisions from this army before removing it.");
    return;
  }
  await actor.update({
    [`flags.${MODULE_ID}.-=army`]: null,
    "flags.core.-=sheetClass": null
  });
}
