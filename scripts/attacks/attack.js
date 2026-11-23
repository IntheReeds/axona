import { MODULE_ID, STATS } from "../constants.js";
import { getMaxHp, getUnit } from "../units/unit.js";
import { getTokenDivisionId } from "../divisions/division.js";
import { createClash } from "./clash.js";

const MACRO_KEY = "attack";

const esc = value => foundry.utils.escapeHTML(String(value));

const ROLE_STATS = ["clash", "sustained", "shortRange", "longRange"];
const RANGED_STATS = ["shortRange", "longRange"];

function numberInput(name) {
  return `<input name="${name}" type="number" step="1" value="0">`;
}

function targetBlock(token, unit) {
  return `<fieldset class="axona-attack-target">
    <legend>Target</legend>
    <div>${esc(token.name)}: HP ${esc(unit.hp.value)}/${esc(getMaxHp(unit))}</div>
    <div>Morale save: ${esc(unit.battle.morale)}+ Modifier ${numberInput("target.moraleMod")}</div>
  </fieldset>`;
}

function toggleBox(name, label, selected, exclusive = "") {
  const exclusiveAttr = exclusive ? ` data-exclusive="${exclusive}"` : "";
  return `<button type="button" class="axona-attack-toggle${selected ? " selected" : ""}" data-toggle-name="${name}"${exclusiveAttr}>${label}</button>
      <input type="hidden" name="${name}" value="${selected}">`;
}

function attackerCard(token, unit, index) {
  const defaultStat = unit.attackType === "ranged" ? "shortRange" : "clash";
  const defaultRole = unit.battle[defaultStat];
  const stats = STATS.map(stat => {
    const isRole = ROLE_STATS.includes(stat.key);
    const roleAttr = isRole ? ` data-role-stat="${stat.key}"` : "";
    const selected = stat.key === defaultStat ? " selected" : "";
    return `<label class="axona-stat${selected}" title="${esc(stat.label)}"${roleAttr}>
      <span>${esc(stat.sheetLabel)}</span>
      <span class="axona-stat-field">
        <input type="number" value="${esc(unit.battle[stat.key] ?? 0)}" disabled tabindex="-1">
        ${stat.suffix ? `<span class="axona-suffix">${esc(stat.suffix)}</span>` : ""}
      </span>
    </label>`;
  }).join("");
  const divisionImg = game.actors.get(getTokenDivisionId(token.document))?.img;
  const icons = `<div class="axona-attack-icons">
        <span class="axona-attack-icon">${token.actor?.img ? `<img src="${esc(token.actor.img)}" alt="">` : ""}</span>
        <span class="axona-attack-icon">${divisionImg ? `<img src="${esc(divisionImg)}" alt="">` : ""}</span>
      </div>`;
  return `<fieldset class="axona-attack-card">
    <legend>${esc(token.name)}</legend>
    <div class="axona-attack-top">
      <section class="axona-battle-box">
        <div class="axona-battle-row"><div class="axona-stats">${stats}</div></div>
      </section>
      ${icons}
    </div>
    <div class="axona-attack-row">
      <input type="hidden" name="attacker${index}.stat" value="${defaultStat}">
      <span>Atk Dice</span>
      <input name="attacker${index}.role" type="number" step="1" value="${esc(defaultRole ?? 0)}">
      <span>Hit</span> ${numberInput(`attacker${index}.hit`)}
      <span>Morale</span> ${numberInput(`attacker${index}.moraleMod`)}
    </div>
    <div class="axona-attack-controls">
      <div class="axona-attack-row">
        <span>Sup Dice</span>
        <input name="attacker${index}.sup" type="number" step="1" value="0">
      </div>
      <div class="axona-attack-toggles" data-mode="melee"${RANGED_STATS.includes(defaultStat) ? " hidden" : ""}>
        ${toggleBox(`attacker${index}.charging`, "Charging (+1)", Boolean(unit.charging))}
        ${toggleBox(`attacker${index}.flanked`, "Flanked (-1)", false)}
      </div>
      <div class="axona-attack-toggles" data-mode="ranged"${RANGED_STATS.includes(defaultStat) ? "" : " hidden"}>
        ${toggleBox(`attacker${index}.shortBand`, "Short range (+1)", false, `attacker${index}.longBand`)}
        ${toggleBox(`attacker${index}.longBand`, "Long range (-1)", false, `attacker${index}.shortBand`)}
      </div>
    </div>
  </fieldset>`;
}

// Talents that have been used up (isActive false) no longer apply.
const activeTalents = unit => (Array.isArray(unit.talents) ? unit.talents : [])
  .filter(key => unit.talentActive?.[key] !== false);

// Reads the dialog fields into the plain data the clash needs.
function readAttackForm(form, target, targetUnit, attackers, attackerUnits) {
  const num = name => Math.trunc(Number(form.elements.namedItem(name)?.value)) || 0;
  const flag = name => form.elements.namedItem(name)?.value === "true";
  return {
    target: {
      name: target.name,
      uuid: target.document.uuid,
      morale: targetUnit.battle.morale,
      moraleMod: num("target.moraleMod"),
      openOrder: targetUnit.activeStance === "openOrder",
      testudo: targetUnit.activeStance === "testudo",
      talents: activeTalents(targetUnit)
    },
    attackers: attackers.map((token, i) => {
      const stat = form.elements.namedItem(`attacker${i}.stat`)?.value;
      const ranged = RANGED_STATS.includes(stat);
      // Only the toggles shown for the chosen attack type count.
      let rangeBand = null;
      if (ranged && flag(`attacker${i}.shortBand`)) rangeBand = "short";
      else if (ranged && flag(`attacker${i}.longBand`)) rangeBand = "long";
      return {
        name: token.name,
        actor: token.actor,
        stat,
        rangeBand,
        role: Math.max(0, num(`attacker${i}.role`)),
        sup: Math.max(0, num(`attacker${i}.sup`)),
        hit: num(`attacker${i}.hit`),
        moraleMod: num(`attacker${i}.moraleMod`),
        charging: !ranged && flag(`attacker${i}.charging`),
        flanked: !ranged && flag(`attacker${i}.flanked`),
        shaken: Boolean(attackerUnits[i].shaken),
        disordered: Boolean(attackerUnits[i].disordered),
        momentum: Boolean(attackerUnits[i].momentum),
        openOrder: attackerUnits[i].activeStance === "openOrder",
        talents: activeTalents(attackerUnits[i]),
        talentTiers: attackerUnits[i].talentTiers ?? {}
      };
    })
  };
}

export async function rollAttack() {
  if (game.user.targets.size !== 1) {
    ui.notifications.warn("Target exactly one unit token to attack.");
    return;
  }
  const [target] = game.user.targets;
  const targetUnit = getUnit(target.actor);
  if (!targetUnit) {
    ui.notifications.warn("The target is not an Axona army unit.");
    return;
  }

  const attackers = (canvas.tokens?.controlled ?? []).filter(token => token.id !== target.id);
  if (!attackers.length) {
    ui.notifications.warn("Select at least one attacking unit token.");
    return;
  }
  const attackerUnits = attackers.map(token => getUnit(token.actor));
  if (attackerUnits.some(unit => !unit)) {
    ui.notifications.warn("Every selected token must be an Axona army unit.");
    return;
  }

  const clash = await foundry.applications.api.DialogV2.wait({
    window: { title: "Attack" },
    classes: ["axona-attack-dialog", "axona", "army-unit"],
    content: `<div class="axona-attack-dialog-body">${targetBlock(target, targetUnit)}`
      + `${attackers.map((token, i) => attackerCard(token, attackerUnits[i], i)).join("")}</div>`,
    rejectClose: false,
    render: (event, dialog) => {
      dialog.element.querySelectorAll(".axona-attack-card").forEach(card => {
        const role = card.querySelector('input[name$=".role"]');
        const selectedStat = card.querySelector('input[name$=".stat"]');
        card.querySelectorAll("[data-role-stat]").forEach(stat => {
          stat.addEventListener("click", () => {
            role.value = stat.querySelector("input").value;
            selectedStat.value = stat.dataset.roleStat;
            card.querySelectorAll("[data-role-stat]").forEach(other => {
              other.classList.toggle("selected", other === stat);
            });
            const mode = RANGED_STATS.includes(stat.dataset.roleStat) ? "ranged" : "melee";
            card.querySelectorAll("[data-mode]").forEach(group => {
              group.hidden = group.dataset.mode !== mode;
            });
          });
        });
        card.querySelectorAll("[data-toggle-name]").forEach(toggle => {
          toggle.addEventListener("click", () => {
            const input = card.querySelector(`input[name="${toggle.dataset.toggleName}"]`);
            input.value = String(input.value !== "true");
            toggle.classList.toggle("selected", input.value === "true");
            const other = toggle.dataset.exclusive;
            if (other && input.value === "true") {
              card.querySelector(`input[name="${other}"]`).value = "false";
              card.querySelector(`[data-toggle-name="${other}"]`).classList.remove("selected");
            }
          });
        });
      });
      dialog.element.querySelectorAll('input[type="number"]:not(:disabled)').forEach(input => {
        input.addEventListener("focus", () => input.select());
        input.addEventListener("mouseup", event => event.preventDefault());
      });
    },
    buttons: [
      {
        action: "attack",
        label: "Attack",
        default: true,
        callback: (event, button) => readAttackForm(button.form, target, targetUnit, attackers, attackerUnits)
      },
      { action: "cancel", label: "Cancel" }
    ]
  });
  if (!clash || typeof clash !== "object") return;
  await createClash(clash);
}

// Creates the "Attack" macro once so it appears in the macro directory.
export function registerAttackMacro() {
  Hooks.once("ready", async () => {
    if (!game.user.isGM) return;
    if (game.macros.contents.some(macro => macro.getFlag(MODULE_ID, "macro") === MACRO_KEY)) return;
    await Macro.create({
      name: "Attack",
      type: "script",
      img: "icons/svg/sword.svg",
      command: `game.modules.get("${MODULE_ID}").api.rollAttack();`,
      flags: { [MODULE_ID]: { macro: MACRO_KEY } }
    });
  });
}
