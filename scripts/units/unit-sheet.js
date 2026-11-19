import {
  MODULE_ID,
  TEMPLATES,
  STATS,
  ATTACK_TYPES,
  UNIT_CLASSES,
  UNIT_SIZES,
  UNIT_CONDITIONS,
  UNIT_TALENTS
} from "../constants.js";
import { getUnit, getMaxHp, getHpColor, resourcePercent } from "./unit.js";
import { getDivisions, getTokenDivisionId } from "../divisions/division.js";
import { getCommander } from "../divisions/commander.js";

export class ArmyUnitSheet extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ActorSheetV2
) {
  #listSearch = { talents: "", stances: "", weapons: "" };
  #contextMenuContainers = new WeakSet();
  #divisionLabelObserver = null;

  static DEFAULT_OPTIONS = {
    classes: ["axona", "army-unit"],
    position: { width: 480, height: "auto" },
    form: { submitOnChange: true },
    actions: {
      toggleStance: ArmyUnitSheet.#onToggleStance,
      toggleVital: ArmyUnitSheet.#onToggleVital
    }
  };

  static TABS = {
    primary: {
      initial: "unit",
      tabs: [
        { id: "unit", label: "Unit" },
        { id: "talents", label: "Talents" },
        { id: "settings", label: "Settings" },
        { id: "flags", label: "Flags" }
      ]
    }
  };

  static PARTS = {
    summary: { template: TEMPLATES.summary },
    tabs: { template: TEMPLATES.tabs },
    unit: { template: TEMPLATES.unit },
    talents: { template: TEMPLATES.talents },
    settings: { template: TEMPLATES.settings },
    flags: { template: TEMPLATES.flags }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const unit = getUnit(this.document);
    if (!unit) return context;

    const maxHp = getMaxHp(unit);
    context.unit = unit;
    if (this.document.isToken) {
      const divisionId = getTokenDivisionId(this.document.token);
      const division = getDivisions().find(division => division.id === divisionId);
      context.tokenDivisionName = division?.name
        ?? (divisionId ? "Unavailable division" : "None");
      context.tokenDivisionImg = division?.img ?? null;
      context.tokenDivisionCommander = division ? getCommander(game.actors.get(division.id))?.name : null;
    }
    context.maxHp = maxHp;
    context.hpPercent = resourcePercent(unit.hp.value, maxHp);
    context.hpColor = getHpColor(unit, maxHp);
    context.mpPercent = resourcePercent(unit.mp?.value, unit.mp?.max);
    context.attackTypes = ATTACK_TYPES;
    context.unitClasses = UNIT_CLASSES;
    context.unitSizes = UNIT_SIZES;
    context.talentFallbackImage = "icons/svg/mystery-man.svg";
    context.conditions = UNIT_CONDITIONS
      .filter(condition => !condition.setting || unit[condition.setting])
      .map(condition => ({ ...condition, active: unit[condition.key] }));
    const selectedTalents = Array.isArray(unit.talents) ? unit.talents : [];
    const choices = UNIT_TALENTS.map(talent => ({
      ...talent,
      selected: selectedTalents.includes(talent.key)
    }));
    context.talents = choices.filter(talent => talent.type !== "stance" && talent.category !== "weapon");
    context.weapons = choices.filter(talent => talent.type !== "stance" && talent.category === "weapon");
    context.stances = choices.filter(talent => talent.type === "stance");
    context.selectedTalents = context.talents.filter(talent => talent.selected);
    context.selectedWeapons = context.weapons.filter(weapon => weapon.selected);
    context.selectedStances = context.stances
      .filter(stance => stance.selected)
      .map(stance => ({ ...stance, active: unit.activeStance === stance.key }));
    context.activeStance = context.selectedStances.find(stance => stance.active);
    context.inactiveStances = context.selectedStances.filter(stance => !stance.active);
    context.stats = STATS.map(s => ({ ...s, value: unit.battle[s.key] ?? s.initial }));
    context.flagsJson = JSON.stringify(
      this.document.flags[MODULE_ID] ?? {},
      null,
      2
    );
    return context;
  }

  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext?.(partId, context, options) ?? context;
    context.tab = context.tabs?.[partId];
    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.#divisionLabelObserver?.disconnect();
    this.#divisionLabelObserver = null;
    const divisionInfo = this.element.querySelector(".axona-unit-division-info");
    if (divisionInfo) {
      const ownerWindow = divisionInfo.ownerDocument.defaultView;
      const portrait = this.element.querySelector(".axona-unit-portrait");
      const updateDivisionLabels = () => {
        const width = portrait?.offsetWidth;
        if (width) divisionInfo.parentElement.style.setProperty("--axona-unit-portrait-width", `${width}px`);
        else divisionInfo.parentElement.style.removeProperty("--axona-unit-portrait-width");
        this.#fitDivisionLabels(divisionInfo);
      };
      this.#divisionLabelObserver = new ownerWindow.ResizeObserver(updateDivisionLabels);
      this.#divisionLabelObserver.observe(divisionInfo);
      if (portrait) this.#divisionLabelObserver.observe(portrait);
      updateDivisionLabels();
      divisionInfo.ownerDocument.fonts.ready.then(() => {
        if (divisionInfo.isConnected) updateDivisionLabels();
      });
    }
    for (const tab of this.element.querySelectorAll('section.tab[data-group="primary"][data-tab="unit"], section.tab[data-group="primary"][data-tab="talents"]')) {
      if (this.#contextMenuContainers.has(tab)) continue;
      this.#contextMenuContainers.add(tab);
      new foundry.applications.ux.ContextMenu.implementation(tab, ".axona-selected-talent, .axona-talent[data-talent-key]", [
        {
          label: "View",
          icon: "fa-solid fa-eye",
          onClick: (event, target) => this.#viewTalent(target)
        },
        {
          label: "Remove",
          icon: "fa-solid fa-trash",
          visible: target => this.isEditable && this.#isAssigned(target.dataset.talentKey),
          onClick: (event, target) => this.#removeTalent(target)
        }
      ], { jQuery: false, fixed: true });
    }
    for (const entry of this.element.querySelectorAll(".axona-selected-talent, .axona-talent[data-talent-key]")) {
      const selectedEntry = entry.matches(".axona-selected-talent");
      const input = selectedEntry ? null : entry.querySelector("input");
      const keyboardTarget = selectedEntry || input.disabled ? entry : input;
      if (selectedEntry) entry.disabled = false;
      keyboardTarget.onkeydown = event => {
        if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
        event.preventDefault();
        const bounds = entry.getBoundingClientRect();
        entry.dispatchEvent(new MouseEvent("contextmenu", {
          bubbles: true, cancelable: true, clientX: bounds.left, clientY: bounds.bottom
        }));
      };
    }
    for (const input of this.element.querySelectorAll("[data-list-search]")) {
      const group = input.closest("[data-search-group]");
      const key = input.dataset.listSearch;
      input.disabled = false;
      input.value = this.#listSearch[key];
      const filter = () => {
        this.#listSearch[key] = input.value;
        const query = input.value.trim().toLocaleLowerCase();
        const entries = group.querySelectorAll("[data-search-label]");
        let visible = 0;
        for (const entry of entries) {
          const matches = entry.dataset.searchLabel.toLocaleLowerCase().includes(query);
          entry.hidden = !matches;
          if (matches) visible++;
        }
        group.querySelector(".axona-search-empty").hidden = !query || !entries.length || visible > 0;
      };
      input.oninput = filter;
      input.onkeydown = event => {
        if (event.key === "Enter") event.preventDefault();
      };
      filter();
    }
  }

  _onClose(options) {
    this.#divisionLabelObserver?.disconnect();
    this.#divisionLabelObserver = null;
    super._onClose(options);
  }

  #fitDivisionLabels(divisionInfo) {
    const ownerWindow = divisionInfo.ownerDocument.defaultView;
    for (const label of divisionInfo.children) {
      label.style.removeProperty("font-size");
      const style = ownerWindow.getComputedStyle(label);
      const bounds = label.getBoundingClientRect();
      const width = parseFloat(style.width);
      if (!width || !bounds.width) continue;
      const scale = bounds.width / width;
      const available = bounds.width - (parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)) * scale;
      const range = label.ownerDocument.createRange();
      range.selectNodeContents(label);
      const textWidth = range.getBoundingClientRect().width;
      if (available > 0 && textWidth > available) {
        label.style.fontSize = `${parseFloat(style.fontSize) * available / textWidth * 0.995}px`;
      }
      if (label === divisionInfo.firstElementChild) {
        const offset = (range.getBoundingClientRect().left - bounds.left) / scale;
        divisionInfo.style.setProperty("--axona-commander-offset", `${Math.max(0, offset)}px`);
      }
    }
  }

  _onChangeForm(formConfig, event) {
    if (event.target.matches("[data-list-search]")) return;
    return super._onChangeForm(formConfig, event);
  }

  #isAssigned(key) {
    const talents = getUnit(this.document)?.talents;
    return Array.isArray(talents) && talents.includes(key);
  }

  #getTalent(target, requireAssigned) {
    const key = target.dataset.talentKey;
    const talent = UNIT_TALENTS.find(choice => choice.key === key);
    if (!talent || (requireAssigned && !this.#isAssigned(key))) {
      ui.notifications.warn("This entry is unavailable or no longer assigned to the unit.");
      return null;
    }
    return talent;
  }

  async #viewTalent(target) {
    const talent = this.#getTalent(target, target.matches(".axona-selected-talent"));
    if (!talent) return;
    const description = talent.description || "No description provided.";
    const image = foundry.utils.escapeHTML(talent.image || "icons/svg/mystery-man.svg");
    await foundry.applications.api.DialogV2.prompt({
      window: { title: talent.label },
      content: `<div style="display: flex; gap: 0.75rem; align-items: flex-start;">` +
        `<img src="${image}" alt="" style="width: 96px; height: 96px; flex: 0 0 96px; object-fit: cover; border-radius: 4px;">` +
        `<p style="margin: 0;">${foundry.utils.escapeHTML(description).replace(/\n/g, "<br>")}</p></div>`,
      ok: { label: "Close" },
      rejectClose: false
    });
  }

  async #removeTalent(target) {
    if (!this.isEditable) {
      ui.notifications.warn("You do not have permission to edit this unit.");
      return;
    }
    const talent = this.#getTalent(target, true);
    if (!talent) return;
    const talents = getUnit(this.document).talents;
    await this.document.update({
      [`flags.${MODULE_ID}.unit.talents`]: talents.filter(key => key !== talent.key)
    });
  }

  static async #onToggleVital(event, target) {
    const unit = getUnit(this.document);
    if (!unit) return;
    await this.document.update({
      [`flags.${MODULE_ID}.unit.vital`]: !unit.vital
    });
  }

  static async #onToggleStance(event, target) {
    const stanceKey = target.dataset.stanceKey;
    const unit = getUnit(this.document);
    const stance = UNIT_TALENTS.find(choice => choice.type === "stance" && choice.key === stanceKey);
    if (!unit || !stance || !Array.isArray(unit.talents) || !unit.talents.includes(stanceKey)) {
      ui.notifications.warn("A unit can only activate a stance assigned to it.");
      return;
    }

    await this.document.update({
      [`flags.${MODULE_ID}.unit.activeStance`]: unit.activeStance === stanceKey ? null : stanceKey
    });
  }
}
