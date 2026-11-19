import { MODULE_ID } from "../constants.js";
import { getDivision } from "./division.js";
import { getUnit } from "../units/unit.js";
import { getArmy } from "../armies/army.js";

const FALLBACK_IMAGE = "icons/svg/mystery-man.svg";
const MACRO_KEY = "assignCommander";

// A commander is a plain world actor, so only its name and token art are used. No system data is read.
export function getCommander(division) {
  const id = getDivision(division)?.commanderId;
  const actor = id ? game.actors.get(id) : null;
  if (!actor?.visible) return null;
  const tokenImage = actor.prototypeToken?.texture?.src;
  return {
    id: actor.id,
    name: actor.name,
    img: tokenImage && !tokenImage.includes("*") ? tokenImage : (actor.img || FALLBACK_IMAGE)
  };
}

export async function setCommander(division, actorId) {
  const commanderId = actorId || foundry.data.operators.ForcedDeletion.create();
  await division.update({ flags: { [MODULE_ID]: { division: { commanderId } } } });
}

export async function assignCommander() {
  const tokens = canvas.tokens?.controlled ?? [];
  if (tokens.length !== 1) {
    ui.notifications.warn("Select exactly one token to assign as a commander.");
    return;
  }

  const actor = game.actors.get(tokens[0].document.actorId);
  if (!actor) {
    ui.notifications.warn("The selected token has no actor.");
    return;
  }
  if (getUnit(actor) || getDivision(actor) || getArmy(actor)) {
    ui.notifications.warn("Army units, divisions and armies cannot be commanders.");
    return;
  }

  const divisions = game.actors.contents
    .filter(candidate => getDivision(candidate) && candidate.visible && candidate.isOwner)
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!divisions.length) {
    ui.notifications.warn("There are no divisions you can edit.");
    return;
  }

  const escape = foundry.utils.escapeHTML;
  const options = divisions.map(division => {
    const current = getCommander(division);
    const label = `${division.name}${current ? ` (commander: ${current.name})` : ""}`;
    return `<option value="${division.id}">${escape(label)}</option>`;
  }).join("");

  const result = await foundry.applications.api.DialogV2.prompt({
    window: { title: "Assign Commander" },
    content: `
      <p>Assign <strong>${escape(actor.name)}</strong> as commander of:</p>
      <div class="form-group">
        <select name="divisionId" aria-label="Division">${options}</select>
      </div>`,
    rejectClose: false,
    ok: {
      label: "Assign",
      callback: (event, button) =>
        new foundry.applications.ux.FormDataExtended(button.form).object
    }
  });
  if (!result?.divisionId) return;

  const division = game.actors.get(result.divisionId);
  if (!getDivision(division) || !division.isOwner) {
    ui.notifications.warn("You cannot edit that division.");
    return;
  }
  await setCommander(division, actor.id);
  ui.notifications.info(`${actor.name} is now the commander of ${division.name}.`);
}

// Creates the "Assign Commander" macro once so it appears in the macro directory.
export function registerCommanderMacro() {
  Hooks.once("ready", async () => {
    if (!game.user.isGM) return;
    if (game.macros.contents.some(macro => macro.getFlag(MODULE_ID, "macro") === MACRO_KEY)) return;
    await Macro.create({
      name: "Assign Commander",
      type: "script",
      img: "icons/svg/mystery-man.svg",
      command: `game.modules.get("${MODULE_ID}").api.assignCommander();`,
      flags: { [MODULE_ID]: { macro: MACRO_KEY } }
    });
  });
}
