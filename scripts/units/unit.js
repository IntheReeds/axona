import {
  MODULE_ID,
  FLAG,
  SHEET_ID,
  STATS,
  SIZE_MODS,
  MOVEMENT_BY_CLASS,
  OPEN_ORDER_MOVEMENT,
  UNIT_TALENTS,
  ATTACK_TYPES,
  UNIT_CLASSES,
  UNIT_SIZES
} from "../constants.js";

function toStat(value, min) {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) ? Math.max(min, n) : min;
}

export function createUnitData(battle = {}) {
  const stats = Object.fromEntries(
    STATS.map(s => [s.key, toStat(battle[s.key] ?? s.initial, s.min)])
  );

  return {
    hp: { value: stats.stamina * 2 },
    mp: { value: 0, max: 0 },
    battle: stats,
    attackType: "melee",
    unitClass: "lightInfantry",
    unitSize: "standard",
    shaken: false,
    disordered: false,
    momentum: false,
    charging: false,
    engaged: false,
    shattered: false,
    closeRanks: false,
    usesCloseRanks: false,
    usesMagic: false,
    vital: false,
    talents: [],
    talentTiers: {},
    talentActive: {},
    activeStance: null
  };
}

export function getUnit(actor) {
  return actor?.getFlag(MODULE_ID, FLAG) ?? null;
}

export function getMaxHp(unit) {
  return unit.battle.stamina * 2;
}

export function getMovementFor(unitClass, activeStance) {
  if (activeStance === "openOrder" && OPEN_ORDER_MOVEMENT[unitClass]) return OPEN_ORDER_MOVEMENT[unitClass];
  return MOVEMENT_BY_CLASS[unitClass] ?? 6;
}

export function resourcePercent(value, max) {
  const current = Number(value);
  const maximum = Number(max);
  if (!Number.isFinite(current) || !Number.isFinite(maximum) || maximum <= 0) return 0;
  return Math.round(Math.max(0, Math.min(current / maximum, 1)) * 100);
}

// HP bar length in px, by the unit's max HP: up to 8 is short, up to 12 is medium, anything above is long.
export function hpBarLength(maxHp) {
  if (maxHp <= 8) return 48;
  if (maxHp <= 12) return 72;
  return 96;
}

export function getHpColor(unit, maxHp) {
  const fraction = maxHp ? Math.clamp(unit.hp.value, 0, maxHp) / maxHp : 0;
  return foundry.utils.Color.from(unit.shaken
    ? 0xc0392b
    : foundry.utils.Color.mix(0xc0392b, 0x3a9b4a, fraction)).css;
}

async function promptBattleStats(name) {
  const options = (entries, selected) => Object.entries(entries).map(([value, label]) =>
    `<option value="${value}"${String(value) === String(selected) ? " selected" : ""}>${label}</option>`).join("");
  const defaults = createUnitData();

  const statFields = STATS.filter(s => s.key !== "stamina").map(s => `
    <div class="form-group">
      <label>${s.label}</label>
      <div class="form-fields">
        <input type="number" name="${s.key}" value="${s.initial}" min="${s.min}" step="1">${s.suffix ?? ""}
      </div>
    </div>`).join("");

  const fields = `
    <div class="form-group">
      <label>Attack Type</label>
      <div class="form-fields"><select name="attackType">${options(ATTACK_TYPES, defaults.attackType)}</select></div>
    </div>
    <div class="form-group">
      <label>Unit Class</label>
      <div class="form-fields"><select name="unitClass">${options(UNIT_CLASSES, defaults.unitClass)}</select></div>
    </div>
    <div class="form-group">
      <label>Unit Size</label>
      <div class="form-fields"><select name="unitSize">${options(UNIT_SIZES, defaults.unitSize)}</select></div>
    </div>
    ${statFields}`;

  return foundry.applications.api.DialogV2.prompt({
    window: { title: `Make Army Unit: ${name}` },
    content: fields,
    rejectClose: false,
    ok: {
      label: "Create",
      callback: (event, button) =>
        new foundry.applications.ux.FormDataExtended(button.form).object
    }
  });
}

export async function makeUnit(actor, battle) {
  if (getUnit(actor) || actor.getFlag(MODULE_ID, "division") || actor.getFlag(MODULE_ID, "army")) {
    ui.notifications.warn(`${actor.name} is already an Axona unit, division, or army.`);
    return null;
  }

  battle ??= await promptBattleStats(actor.name);
  if (!battle) return null;

  const { attackType, unitClass, unitSize, ...battleStats } = battle;
  const staminaBase = STATS.find(s => s.key === "stamina").initial;
  battleStats.stamina = staminaBase + (SIZE_MODS[unitSize]?.stamina ?? 0);
  const unit = createUnitData(battleStats);
  if (attackType) unit.attackType = attackType;
  if (unitClass) unit.unitClass = unitClass;
  if (unitSize) unit.unitSize = unitSize;
  unit.movement = MOVEMENT_BY_CLASS[unit.unitClass] ?? 6;
  await actor.update({
    [`flags.${MODULE_ID}.${FLAG}`]: unit,
    "flags.core.sheetClass": SHEET_ID
  });
  return unit;
}

export async function removeUnit(actor) {
  await actor.update({
    [`flags.${MODULE_ID}.-=${FLAG}`]: null,
    "flags.core.-=sheetClass": null
  });
}


//Damage function which applies break test rolls,
//if function is not invoked break tests and shaken mechanics do not go
// ##break test and shaken mechanics should be checked even after manually HP input

export async function applyDamage(actor, amount) {
  const unit = getUnit(actor);
  if (!unit) return;
  if (!Number.isInteger(amount) || amount <= 0) return;

  const stamina = unit.battle.stamina;
  const oldHp = Math.min(unit.hp.value, getMaxHp(unit));
  const newHp = Math.max(0, oldHp - amount);

  if (newHp === oldHp) return;

  const crossedThreshold = oldHp > stamina && newHp <= stamina;
  const requiresBreakTest = crossedThreshold || unit.shaken;

  await actor.update({
    [`flags.${MODULE_ID}.${FLAG}.hp.value`]: newHp,
    [`flags.${MODULE_ID}.${FLAG}.shaken`]: requiresBreakTest
  });

  if (requiresBreakTest) {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      flags: {
        [MODULE_ID]: {
          breakTest: { actorUuid: actor.uuid, unitClass: unit.unitClass }
        }
      },
      content: `
        <h3>Unit Shaken!</h3>
        <p>
          ${foundry.utils.escapeHTML(actor.name)}
          is shaken! It must now roll
          the required break test!
        </p>
        <div class="axona-break-test">
          <button type="button" data-attack="ranged">Ranged</button>
          <button type="button" data-attack="melee">Melee</button>
          ${unit.talents?.includes("valiant") && unit.talentActive?.valiant !== false
            ? `<button type="button" data-valiant>Use Valiant Reroll</button>` : ""}
        </div>
      `
    });
  }
}

export function registerUnitHooks() {
  Hooks.on("preUpdateActor", (actor, changes) => {
    const unit = getUnit(actor);
    if (!unit) return;

    const path = `flags.${MODULE_ID}.${FLAG}`;
    const incoming = key => foundry.utils.getProperty(
      foundry.utils.expandObject(changes),
      `${path}.${key}`
    );

    // Changing the size tier shifts the battle stats by the difference between the two tiers.
    const newSize = incoming("unitSize");
    if (newSize !== undefined && newSize !== unit.unitSize && SIZE_MODS[newSize]) {
      const oldMods = SIZE_MODS[unit.unitSize] ?? SIZE_MODS.standard;
      const newMods = SIZE_MODS[newSize];

      for (const s of STATS) {
        const delta = (newMods[s.key] ?? 0) - (oldMods[s.key] ?? 0);
        if (!delta) continue;

        // A stat of 0 means the unit doesn't have it at all (e.g. no ranged attack), so size leaves it alone.
        if (s.zeroLocked && unit.battle[s.key] === 0) continue;

        // A stat edited in the same update keeps the user's value.
        const sent = incoming(`battle.${s.key}`);
        if (sent !== undefined && Number(sent) !== unit.battle[s.key]) continue;

        foundry.utils.setProperty(
          changes,
          `${path}.battle.${s.key}`,
          Math.max(s.min, unit.battle[s.key] + delta)
        );
      }
    }

    const incomingTalents = incoming("talents");
    let selectedTalents = Array.isArray(unit.talents) ? unit.talents : [];
    if (incomingTalents !== undefined) {
      selectedTalents = Array.isArray(incomingTalents)
        ? incomingTalents
        : [incomingTalents];
      const validKeys = new Set(UNIT_TALENTS.map(talent => talent.key));
      selectedTalents = selectedTalents.filter(key => validKeys.has(key));
      foundry.utils.setProperty(
        changes,
        `${path}.talents`,
        selectedTalents
      );
    }

    const stanceKeys = new Set(
      UNIT_TALENTS.filter(talent => talent.type === "stance").map(stance => stance.key)
    );
    const activeStance = incoming("activeStance");
    if (activeStance !== undefined && activeStance !== null &&
        (!stanceKeys.has(activeStance) || !selectedTalents.includes(activeStance))) {
      ui.notifications.warn("A unit can only activate a stance assigned to it.");
      return false;
    }
    if (incomingTalents !== undefined && activeStance === undefined &&
        unit.activeStance && !selectedTalents.includes(unit.activeStance)) {
      foundry.utils.setProperty(changes, `${path}.activeStance`, null);
    }

    // Movement follows the unit class, and Open Order raises light cavalry and horse archers. A class or stance change resets it.
    const newClass = incoming("unitClass") ?? unit.unitClass;
    const newStance = incoming("activeStance") !== undefined ? incoming("activeStance") : unit.activeStance;
    if (newClass !== unit.unitClass || newStance !== unit.activeStance) {
      foundry.utils.setProperty(changes, `${path}.movement`, getMovementFor(newClass, newStance));
    }

    // Changing Stamina moves current HP by the same amount as max HP.
    const newStamina = incoming("battle.stamina");
    if (newStamina === undefined || Number(newStamina) === unit.battle.stamina) return;

    const sentHp = incoming("hp.value");
    if (sentHp !== undefined && Number(sentHp) !== unit.hp.value) return;

    const value = unit.hp.value + (newStamina - unit.battle.stamina) * 2;
    foundry.utils.setProperty(
      changes,
      `${path}.hp.value`,
      Math.max(0, Math.min(newStamina * 2, value))
    );
  });
}
