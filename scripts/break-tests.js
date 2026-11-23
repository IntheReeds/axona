import { MODULE_ID } from "./constants.js";
import { getUnit } from "./units/unit.js";

const TABLE_IDS = {
  infantry: { ranged: "InfantryRanged01", melee: "InfantryMelee001" },
  cavalry: { ranged: "CavalryRanged001", melee: "CavalryMelee0001" },
  skirmisher: { ranged: "SkirmishRanged01", melee: "SkirmishMelee001" }
};

const CLASS_CATEGORIES = {
  lightInfantry: "infantry",
  mediumInfantry: "infantry",
  heavyInfantry: "infantry",
  lightCavalry: "cavalry",
  mediumCavalry: "cavalry",
  heavyCavalry: "cavalry",
  horseArcher: "cavalry",
  skirmisher: "skirmisher"
};

const pendingMessages = new Set();
const DEFAULT_TABLE_DESCRIPTION = "Use 2 for scores of 2 or less and 10 for scores of 10 or more.";

async function rollBreakTest(actor, unitClass, attack) {
  const category = CLASS_CATEGORIES[unitClass];
  const tableId = TABLE_IDS[category]?.[attack];
  if (!tableId) throw new Error("The break test has an invalid unit class or attack type.");

  if (!actor.testUserPermission(game.user, "OWNER")) {
    ui.notifications.warn("You must own this unit to roll its break test.");
    return;
  }

  const pack = game.packs.get(`${MODULE_ID}.break-tests`);
  if (!pack) throw new Error("The Axona Break Tests compendium is unavailable. Restart Foundry after installing the module.");
  const table = await pack.getDocument(tableId);
  if (!table) throw new Error(`The ${category} ${attack} break-test table is missing.`);

  const modifier = await foundry.applications.api.DialogV2.prompt({
    window: { title: `${attack === "ranged" ? "Ranged" : "Melee"} Break Test` },
    content: `<div class="form-group">
        <label for="axona-break-modifier">Roll modifier</label>
        <input id="axona-break-modifier" name="modifier" type="number" step="1" value="0" required>
      </div>`,
    rejectClose: false,
    ok: {
      label: "Roll",
      callback: (event, button) => button.form.elements.modifier.value
    }
  });
  if (modifier === null || modifier === undefined) return;
  if (modifier === "" || !Number.isSafeInteger(Number(modifier))) {
    ui.notifications.warn("Enter a whole-number break-test modifier.");
    return;
  }

  const roll = await new Roll("2d6 + @modifier", { modifier: Number(modifier) }).evaluate();
  const score = Math.max(2, Math.min(10, roll.total));
  const results = table.getResultsForRoll(score);
  if (results.length !== 1 || results[0].type !== "text" || !results[0].description?.trim()) {
    throw new Error(`The ${table.name} table must have exactly one text result for score ${score}.`);
  }
  const displayTable = table.description === DEFAULT_TABLE_DESCRIPTION
    ? table.clone({ description: "" }, { keepId: true })
    : table;
  await displayTable.toMessage(results, {
    roll,
    messageData: {
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `<strong>${foundry.utils.escapeHTML(actor.name)}: ${attack === "ranged" ? "Ranged" : "Melee"} Break Test</strong>`
    }
  });
}

function reportBreakTestError(error) {
  console.error("Axona | Break test failed", error);
  ui.notifications.error(`Break test failed: ${error.message}`);
}

async function rollMessageBreakTest(message, attack) {
  if (pendingMessages.has(message.id)) return;
  pendingMessages.add(message.id);
  try {
    const data = message.getFlag(MODULE_ID, "breakTest");
    if (!data?.actorUuid) throw new Error("The break test has no unit.");
    const actor = await fromUuid(data.actorUuid);
    if (!actor) throw new Error("The unit for this break test no longer exists.");
    await rollBreakTest(actor, data.unitClass, attack);
  } catch (error) {
    reportBreakTestError(error);
  } finally {
    pendingMessages.delete(message.id);
  }
}

export async function rollSelectedBreakTest(attack) {
  const tokens = canvas.tokens?.controlled ?? [];
  if (tokens.length !== 1) {
    ui.notifications.warn("Select exactly one unit token to roll a break test.");
    return;
  }
  const actor = tokens[0].actor;
  const unit = getUnit(actor);
  if (!unit) {
    ui.notifications.warn("The selected token is not an Axona army unit.");
    return;
  }
  try {
    await rollBreakTest(actor, unit.unitClass, attack);
  } catch (error) {
    reportBreakTestError(error);
  }
}

export function registerBreakTests() {
  Hooks.on("renderChatMessageHTML", (message, html) => {
    if (!message.getFlag(MODULE_ID, "breakTest")) return;
    for (const button of html.querySelectorAll(".axona-break-test button[data-attack]")) {
      button.addEventListener("click", () => rollMessageBreakTest(message, button.dataset.attack));
    }
    const valiant = html.querySelector(".axona-break-test button[data-valiant]");
    if (valiant) setupValiantButton(message, valiant);
  });
}

// Valiant works once per battle. The button only switches the talent off; the reroll itself is done by hand.
function setupValiantButton(message, button) {
  const { actorUuid } = message.getFlag(MODULE_ID, "breakTest");
  const isUsed = actor => getUnit(actor)?.talentActive?.valiant === false;
  const markUsed = () => {
    button.disabled = true;
    button.textContent = "Valiant Reroll Used";
  };
  try {
    if (isUsed(fromUuidSync(actorUuid))) markUsed();
  } catch (error) {
    // The unit may not be loaded; the click handler checks again.
  }
  button.addEventListener("click", async () => {
    const actor = await fromUuid(actorUuid);
    if (!actor) {
      ui.notifications.warn("The unit for this break test no longer exists.");
      return;
    }
    if (!actor.testUserPermission(game.user, "OWNER")) {
      ui.notifications.warn("You must own this unit to use its Valiant reroll.");
      return;
    }
    if (!isUsed(actor)) {
      await actor.update({ [`flags.${MODULE_ID}.unit.talentActive.valiant`]: false });
    }
    markUsed();
  });
}
