import { MODULE_ID } from "../constants.js";
import { applyDamage } from "../units/unit.js";

const BASE_HIT = 4;
const MELEE_STATS = ["clash", "sustained"];

const esc = value => foundry.utils.escapeHTML(String(value));
const signed = value => (value > 0 ? `+${value}` : String(value));
const clampTarget = value => Math.min(6, Math.max(2, value));

let busy = false;

async function rollDice(count) {
  if (count <= 0) return [];
  const roll = await new Roll(`${count}d6`).evaluate();
  game.dice3d?.showForRoll(roll, game.user, true);
  return roll.dice[0].results.map(result => result.result);
}

// A positive modifier helps, so it lowers the number that has to be rolled. 2+ to 6+ is the limit.
// A cap is a best-case number: the enemy can never need less than cap.min.
function makeTarget(base, mods, caps = []) {
  const active = mods.filter(mod => mod.value);
  const raw = base - active.reduce((sum, mod) => sum + mod.value, 0);
  let need = clampTarget(raw);
  const limited = need !== raw;
  const applied = caps.filter(cap => need < cap.min);
  if (applied.length) need = Math.max(...applied.map(cap => cap.min));
  return { base, mods: active, need, limited, caps: applied.map(cap => `${cap.label}: capped at ${cap.min}+`) };
}

function tooltip(target) {
  const lines = [`Base ${target.base}+`, ...target.mods.map(mod => `${mod.label} ${signed(mod.value)}`)];
  if (!target.mods.length) lines.push("No modifiers");
  if (target.limited) lines.push("Limited to between 2+ and 6+");
  lines.push(...(target.caps ?? []));
  lines.push(`Result ${target.need}+`);
  return esc(lines.map(esc).join("<br>"));
}

// Saves belong to the dice that hit: a die that now hits gets a save, a die that now misses loses it.
async function syncSaves(entry) {
  const sets = [
    [entry.atk, entry.hitTarget.need, entry.atkSaves],
    [entry.sup, entry.supTarget.need, entry.supSaves]
  ];
  for (const [dice, need, saves] of sets) {
    const missing = [];
    dice.forEach((die, i) => {
      if (die < need) saves[i] = null;
      else if (saves[i] == null) missing.push(i);
    });
    const rolled = await rollDice(missing.length);
    missing.forEach((i, j) => { saves[i] = rolled[j]; });
  }
}

const talentTier = (attacker, key) => Math.max(1, Math.floor(Number(attacker.talentTiers?.[key])) || 1);

export async function createClash({ target, attackers }) {
  const defenderNotes = target.talents?.includes("stubborn") ? [{ label: "Stubborn", count: 1 }] : [];
  const state = {
    target: { name: target.name, uuid: target.uuid },
    attackers: [],
    defenderRerolls: defenderNotes.reduce((sum, note) => sum + note.count, 0),
    defenderRerollNotes: defenderNotes.map(note => `${note.label}: ${note.count}`),
    applied: null
  };
  for (const attacker of attackers) {
    const melee = MELEE_STATS.includes(attacker.stat);
    const has = key => attacker.talents?.includes(key);
    const conditionLabel = [attacker.shaken && "Shaken", attacker.disordered && "Disordered"]
      .filter(Boolean).join(" / ");
    const saveCaps = [];
    if (melee && has("halberds")) saveCaps.push({ label: "Halberds", min: 5 });
    if (!melee && has("crossbows")) saveCaps.push({ label: "Crossbows", min: 5 });
    if (!melee && has("matchlocks")) saveCaps.push({ label: "Matchlocks", min: 6 });
    if (!melee && has("firelocks")) saveCaps.push({ label: "Firelocks", min: 6 });

    const rerollNotes = [];
    if (melee && has("toughfighters")) rerollNotes.push({ label: "Tough Fighters", count: 1 });
    if (!melee && has("marksman")) rerollNotes.push({ label: "Marksman", count: 1 });
    const usesWildFighters = attacker.charging && has("wildfighters");
    if (usesWildFighters) {
      const tier = talentTier(attacker, "wildfighters");
      rerollNotes.push({ label: `Wild Fighters (${tier})`, count: tier });
    }
    // First Fire is the ranged counterpart: an extra attack die and +1 to hit on the first volley.
    const usesFirstFire = !melee && has("firstFire");
    const usesShIntegration = attacker.stat === "clash" && has("shIntegration");
    const notes = usesFirstFire ? ["First Fire +1"] : [];
    if (usesShIntegration) notes.push("S/H Integration +1");

    // Freshly Raised rolls once, in the unit's first fight of the game: 1 terror, 2-3 panic, 4-5 no effect, 6 inspired.
    const usesFreshlyRaised = has("freshlyRaised");
    const freshRoll = usesFreshlyRaised ? (await rollDice(1))[0] : null;
    const needsSix = usesFreshlyRaised && freshRoll <= 3;
    const becomesDisordered = freshRoll === 1 && !attacker.disordered;
    if (usesFreshlyRaised) {
      const outcome = [null, "Terror: all attacks need 6s and the unit becomes disordered",
        "Panic: all attacks need 6s", "Panic: all attacks need 6s", "Determined: no effect",
        "Determined: no effect", "Inspired: +1 attack die"][freshRoll];
      notes.push(`Freshly Raised (rolled ${freshRoll}) - ${outcome}`);
    }

    const entry = {
      name: attacker.name,
      notes,
      rerolls: rerollNotes.reduce((sum, note) => sum + note.count, 0),
      rerollNotes: rerollNotes.map(note => `${note.label}: ${note.count}`),
      // Shaken and disordered share one -1, and momentum does not stack with a charge.
      hitTarget: makeTarget(BASE_HIT, [
        { label: "Hit modifier", value: attacker.hit },
        { label: "Charging", value: attacker.charging ? 1 : 0 },
        { label: "Momentum", value: attacker.momentum && !attacker.charging ? 1 : 0 },
        { label: "First Fire", value: usesFirstFire ? 1 : 0 },
        { label: "Flanked", value: attacker.flanked ? -1 : 0 },
        { label: "Short range", value: attacker.rangeBand === "short" ? 1 : 0 },
        { label: "Long range", value: attacker.rangeBand === "long" ? -1 : 0 },
        { label: conditionLabel, value: conditionLabel ? -1 : 0 },
        { label: "Open Order vs. non-Open Order", value: attacker.openOrder && !target.openOrder ? -1 : 0 }
      ]),
      supTarget: makeTarget(BASE_HIT, []),
      saveTarget: makeTarget(target.morale, [
        { label: "Target modifier", value: target.moraleMod },
        { label: "Testudo vs. ranged", value: !melee && target.testudo ? 2 : 0 },
        { label: `${attacker.name} morale modifier`, value: attacker.moraleMod },
        { label: "Pilum", value: attacker.stat === "clash" && has("pilum") ? -1 : 0 },
        { label: "Lances (charging)", value: melee && attacker.charging && has("lances") ? -1 : 0 },
        { label: "S/H Integration", value: usesShIntegration ? -1 : 0 }
      ], saveCaps),
      supSaveTarget: makeTarget(target.morale, [
        { label: "Target modifier", value: target.moraleMod },
        { label: "Testudo vs. ranged", value: !melee && target.testudo ? 2 : 0 }
      ])
    };
    // Terror and panic make every attack die, including support dice, need a 6.
    if (needsSix) {
      for (const dieTarget of [entry.hitTarget, entry.supTarget]) {
        dieTarget.need = 6;
        dieTarget.caps = [...(dieTarget.caps ?? []), "Freshly Raised: all attacks need 6s"];
      }
    }
    const bonusDice = (usesFirstFire ? 1 : 0) + (usesShIntegration ? 1 : 0) + (freshRoll === 6 ? 1 : 0);
    entry.atk = await rollDice(attacker.role + bonusDice);
    entry.sup = await rollDice(attacker.sup);
    entry.atkSaves = entry.atk.map(() => null);
    entry.supSaves = entry.sup.map(() => null);
    await syncSaves(entry);
    state.attackers.push(entry);
    // Wild Fighters, First Fire and Freshly Raised work once per battle, so using one switches the talent off.
    const updates = {};
    const used = [
      usesWildFighters && "wildfighters",
      usesFirstFire && "firstFire",
      usesFreshlyRaised && "freshlyRaised"
    ].filter(Boolean);
    for (const key of used) updates[`flags.${MODULE_ID}.unit.talentActive.${key}`] = false;
    if (becomesDisordered) updates[`flags.${MODULE_ID}.unit.disordered`] = true;
    if (Object.keys(updates).length) await attacker.actor?.update(updates);
  }
  return ChatMessage.implementation.create({
    speaker: ChatMessage.getSpeaker(),
    content: renderClash(state),
    flags: { [MODULE_ID]: { clash: state } }
  });
}

// Only failed dice can be rerolled, and only while the matching pool has rerolls left.
function dieButton(kind, attackerIndex, dieIndex, value, need, canReroll) {
  const failed = value < need;
  const reroll = canReroll && failed
    ? ` data-reroll="${kind}" data-attacker="${attackerIndex}" data-index="${dieIndex}" data-tooltip="Click to reroll"`
    : "";
  return `<span class="axona-die ${failed ? "fail" : "success"}${reroll ? " rerollable" : ""}"${reroll}>${value}</span>`;
}

function rollLine(label, target, buttons, hover = []) {
  const body = buttons.length
    ? `<span class="axona-brk">[</span>${buttons.join(", ")}<span class="axona-brk">]</span>`
    : "&mdash;";
  const labelTip = hover.length ? ` data-tooltip="${esc(hover.map(esc).join("<br>"))}"` : "";
  return `<div class="axona-clash-line">
    <span class="axona-clash-label"${labelTip}>${label}</span><span class="axona-clash-sep">|</span>
    <span class="axona-clash-need" data-tooltip="${tooltip(target)}">${target.need}+</span>
    <span class="axona-clash-dice">${body}</span>
  </div>`;
}


// Saves are stored per die and are null where that die missed, so only real saves get a button.
function diceButtons(kind, attackerIndex, dice, need, canReroll = false) {
  return dice
    .map((value, i) => (value == null ? null : dieButton(kind, attackerIndex, i, value, need, canReroll)))
    .filter(Boolean);
}

function failedSaves(entry) {
  return entry.atkSaves.filter(v => v != null && v < entry.saveTarget.need).length
    + entry.supSaves.filter(v => v != null && v < entry.supSaveTarget.need).length;
}

const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

export function renderClash(state) {
  const total = state.attackers.reduce((sum, entry) => sum + failedSaves(entry), 0);
  const applied = state.applied != null;
  const defenderRerolls = applied ? 0 : state.defenderRerolls ?? 0;
  const boxes = state.attackers.map((entry, a) => {
    const attackRerolls = applied ? 0 : entry.rerolls ?? 0;
    const atkSaves = diceButtons("save", a, entry.atkSaves, entry.saveTarget.need, defenderRerolls > 0);
    const supSaves = diceButtons("supSave", a, entry.supSaves, entry.supSaveTarget.need, defenderRerolls > 0);
    const noHits = !atkSaves.length && !supSaves.length;
    const rerollInfo = entry.rerollNotes?.length
      ? ` <span class="axona-clash-sep">|</span> <span class="axona-clash-need" data-tooltip="${esc(entry.rerollNotes.map(esc).join("<br>"))}">${plural(entry.rerolls, "Reroll")} available</span>`
      : "";
    return `<section class="axona-clash-box">
      <h4>${esc(entry.name)}${rerollInfo}</h4>
      <div class="axona-clash-block">
        ${rollLine("Atk", entry.hitTarget, diceButtons("atk", a, entry.atk, entry.hitTarget.need, attackRerolls > 0), entry.notes ?? [])}
        ${entry.sup.length ? rollLine("Sup", entry.supTarget, diceButtons("sup", a, entry.sup, entry.supTarget.need)) : ""}
      </div>
      <div class="axona-clash-block">
        ${noHits ? `<div class="axona-clash-note">No hits.</div>` : ""}
        ${atkSaves.length ? rollLine("Save", entry.saveTarget, atkSaves) : ""}
        ${supSaves.length ? rollLine("SSup", entry.supSaveTarget, supSaves) : ""}
      </div>
    </section>`;
  }).join("");

  const defenderNotes = state.defenderRerollNotes?.length
    ? ` data-tooltip="${esc(state.defenderRerollNotes.map(esc).join("<br>"))}"` : "";
  const label = applied
    ? `${state.applied} damage applied to ${esc(state.target.name)}`
    : `${total} damage to ${esc(state.target.name)}`;
  return `<div class="axona-clash">
    <h3>Attack on ${esc(state.target.name)}</h3>
    ${boxes}
    <div class="axona-clash-summary">
      <div>Total failed saves: ${total}</div>
      <div${defenderNotes}>Available rerolls: ${state.defenderRerolls ?? 0}</div>
    </div>
    <button type="button" class="axona-clash-apply" data-apply${applied || !total ? " disabled" : ""}>${label}</button>
  </div>`;
}

async function updateClash(message, state) {
  await message.update({
    content: renderClash(state),
    [`flags.${MODULE_ID}.clash`]: state
  });
}

async function reroll(message, button) {
  if (!message.isOwner) {
    ui.notifications.warn("Only the attacker or the GM can reroll these dice.");
    return;
  }
  if (busy) return;
  busy = true;
  try {
    const state = foundry.utils.deepClone(message.getFlag(MODULE_ID, "clash"));
    if (state.applied != null) {
      ui.notifications.warn("Damage has already been applied for this attack.");
      return;
    }
    const entry = state.attackers[Number(button.dataset.attacker)];
    const kind = button.dataset.reroll;
    const index = Number(button.dataset.index);
    const dice = {
      atk: entry.atk, save: entry.atkSaves, supSave: entry.supSaves
    }[kind];
    if (!dice) return;
    // The click is checked against the stored state, because the rendered button can be stale.
    if (kind === "atk") {
      if (entry.rerolls <= 0 || dice[index] >= entry.hitTarget.need) return;
      entry.rerolls = Math.max(0, entry.rerolls - 1);
    } else {
      const need = kind === "save" ? entry.saveTarget.need : entry.supSaveTarget.need;
      if (state.defenderRerolls <= 0 || dice[index] >= need) return;
      state.defenderRerolls = Math.max(0, state.defenderRerolls - 1);
    }
    const [value] = await rollDice(1);
    dice[index] = value;
    await syncSaves(entry);
    await updateClash(message, state);
  } finally {
    busy = false;
  }
}

async function applyClashDamage(message) {
  if (!message.isOwner) {
    ui.notifications.warn("Only the attacker or the GM can apply this damage.");
    return;
  }
  if (busy) return;
  busy = true;
  try {
    const state = foundry.utils.deepClone(message.getFlag(MODULE_ID, "clash"));
    if (state.applied != null) return;
    const actor = (await fromUuid(state.target.uuid))?.actor;
    if (!actor) {
      ui.notifications.warn("The target unit is no longer available.");
      return;
    }
    const total = state.attackers.reduce((sum, entry) => sum + failedSaves(entry), 0);
    state.applied = total;
    await updateClash(message, state);
    await applyDamage(actor, total);
  } finally {
    busy = false;
  }
}

export function registerClashHooks() {
  Hooks.on("renderChatMessageHTML", (message, html) => {
    if (!message.getFlag(MODULE_ID, "clash")) return;
    html.querySelectorAll("[data-reroll]").forEach(button => {
      button.addEventListener("click", () => reroll(message, button));
    });
    html.querySelector("[data-apply]")?.addEventListener("click", () => applyClashDamage(message));
  });
}

