import { MODULE_ID, SIZE_MARKERS } from "../constants.js";
import { getDivision, getDivisionEntries, getDivisionUnitOrder, getDropParentId, getPlacedUnits, getSubunitParentId, getTokenDivisionId, hasSubunitLinks } from "../divisions/division.js";
import { getUnit, getMaxHp, getHpColor, resourcePercent, hpBarLength } from "../units/unit.js";
import { getDivisionArmy } from "./army.js";
import { getCommander } from "../divisions/commander.js";

export class ArmySheet extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ActorSheetV2
) {
  #contextMenuContainers = new WeakSet();
  #draggedUnit = null;
  #movingUnit = false;

  static get DEFAULT_OPTIONS() {
    return {
      classes: ["axona", "axona-army-sheet"],
      position: { width: "auto", height: "auto" },
      form: { submitOnChange: true },
      actions: {
        openDivision: ArmySheet.#openDivision,
        openUnit: ArmySheet.#openUnit
      }
    };
  }

  static PARTS = {
    army: { template: `modules/${MODULE_ID}/templates/armies/army-sheet.hbs` }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const divisions = game.actors.contents.filter(actor => actor.visible && getDivision(actor));
    context.divisions = divisions
      .filter(actor => getDivision(actor).armyId === this.document.id)
      .map(actor => {
        const entries = getDivisionEntries(actor);
        return {
          id: actor.id, name: actor.name, img: actor.img, canEdit: actor.isOwner,
          commanderName: getCommander(actor)?.name ?? "",
          units: entries.map(entry => {
            const token = entry.token;
            const unit = getUnit(token.actor);
            const maxHp = getMaxHp(unit);
            return {
              id: token.uuid, name: token.name, scene: entry.scene, img: token.texture.src,
              sizeMarker: SIZE_MARKERS[unit.unitSize] ?? SIZE_MARKERS.standard,
              sizeClass: SIZE_MARKERS[unit.unitSize] ? unit.unitSize : "standard",
              subunit: !!entry.parentId,
              hp: unit.hp.value, maxHp, hpPercent: resourcePercent(unit.hp.value, maxHp), hpColor: getHpColor(unit, maxHp),
              usesMagic: unit.usesMagic, mp: unit.mp?.value, maxMp: unit.mp?.max, mpPercent: resourcePercent(unit.mp?.value, unit.mp?.max),
              barLength: hpBarLength(maxHp)
            };
          })
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    context.availableDivisions = divisions
      .filter(actor => !getDivisionArmy(actor))
      .map(actor => ({ id: actor.id, name: actor.name, canEdit: actor.isOwner }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const picker = this.element.querySelector("[data-army-division]");
    if (picker) picker.onchange = () => this.#addDivision(picker);
    const chart = this.element.querySelector(".axona-army-chart");
    if (!chart || this.#contextMenuContainers.has(chart)) return;
    this.#contextMenuContainers.add(chart);
    new foundry.applications.ux.ContextMenu.implementation(chart, ".axona-army-division-heading .axona-army-entry", [
      {
        label: "Remove",
        icon: "fa-solid fa-trash",
        visible: target => {
          const actor = game.actors.get(target.dataset.divisionId);
          return this.isEditable && actor?.visible && actor.isOwner &&
            getDivision(actor)?.armyId === this.document.id;
        },
        onClick: (event, target) => this.#removeDivision(target)
      }
    ], { jQuery: false, fixed: true });

    for (const entry of chart.querySelectorAll(".axona-army-division-heading .axona-army-entry")) {
      entry.disabled = false;
      entry.onkeydown = event => {
        if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
        event.preventDefault();
        const bounds = entry.getBoundingClientRect();
        entry.dispatchEvent(new MouseEvent("contextmenu", {
          bubbles: true, cancelable: true, clientX: bounds.left, clientY: bounds.bottom
        }));
      };
    }
    for (const row of chart.querySelectorAll(".axona-army-unit")) {
      row.ondragstart = event => {
        const division = game.actors.get(row.closest(".axona-army-division").dataset.divisionId);
        if (!this.isEditable || this.#movingUnit || !division?.isOwner) {
          event.preventDefault();
          return;
        }
        event.stopPropagation();
        this.#draggedUnit = { id: row.dataset.unitId, divisionId: division.id };
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", row.dataset.unitId);
        row.classList.add("axona-dragging");
      };
      row.ondragend = () => {
        this.#draggedUnit = null;
        row.classList.remove("axona-dragging");
        this.#clearDropIndicators(chart);
      };
    }
    for (const column of chart.querySelectorAll(".axona-army-division")) {
      column.ondragover = event => {
        if (!this.#draggedUnit || !this.isEditable) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        this.#clearDropIndicators(chart);
        const row = event.target.closest(".axona-army-unit");
        if (row && row.closest(".axona-army-division") === column) {
          const bounds = row.getBoundingClientRect();
          row.classList.add(event.clientY >= bounds.top + bounds.height / 2 ? "axona-drop-after" : "axona-drop-before");
        } else column.classList.add("axona-drop-target");
      };
      column.ondragleave = event => {
        if (!column.contains(event.relatedTarget)) this.#clearDropIndicators(chart);
      };
      column.ondrop = event => {
        if (!this.#draggedUnit || !this.isEditable) return;
        event.preventDefault();
        event.stopPropagation();
        const source = this.#draggedUnit;
        this.#draggedUnit = null;
        this.#clearDropIndicators(chart);
        const row = event.target.closest(".axona-army-unit");
        const target = row && row.closest(".axona-army-division") === column ? row : null;
        const bounds = target?.getBoundingClientRect();
        this.#moveUnit(source, column.dataset.divisionId, target?.dataset.unitId ?? null,
          bounds ? event.clientY >= bounds.top + bounds.height / 2 : true);
      };
    }
  }

  #clearDropIndicators(chart) {
    for (const element of chart.querySelectorAll(".axona-drop-before, .axona-drop-after, .axona-drop-target")) {
      element.classList.remove("axona-drop-before", "axona-drop-after", "axona-drop-target");
    }
  }

  async #moveUnit(source, destinationId, targetId, after) {
    if (this.#movingUnit) return;
    this.#movingUnit = true;
    try {
      const sourceDivision = game.actors.get(source.divisionId);
      const destination = game.actors.get(destinationId);
      const units = getPlacedUnits();
      const token = units.find(unit => unit.uuid === source.id);
      const target = targetId === null ? null : units.find(unit => unit.uuid === targetId);
      if (!this.isEditable || !sourceDivision?.visible || !sourceDivision.isOwner ||
          getDivision(sourceDivision)?.armyId !== this.document.id ||
          !destination?.visible || !destination.isOwner ||
          getDivision(destination)?.armyId !== this.document.id ||
          !token || getTokenDivisionId(token) !== source.divisionId ||
          (source.divisionId !== destinationId && !token.canUserModify(game.user, "update")) ||
          (targetId !== null && (!target || getTokenDivisionId(target) !== destinationId))) {
        ui.notifications.warn("You cannot move this unit to the selected division.");
        return;
      }
      if (targetId === source.id) return;
      const divisionChanged = source.divisionId !== destinationId;
      const parentId = getDropParentId(getDivisionEntries(destination), targetId, hasSubunitLinks(source.id));
      const children = divisionChanged
        ? getPlacedUnits().filter(unit => getSubunitParentId(unit) === source.id && getTokenDivisionId(unit) === source.divisionId)
        : [];
      const tokenChanges = {};
      if (divisionChanged) tokenChanges[`flags.${MODULE_ID}.divisionId`] = destinationId;
      if (getSubunitParentId(token) !== parentId) tokenChanges[`flags.${MODULE_ID}.subunitOf`] = parentId;
      if ((Object.keys(tokenChanges).length && !token.canUserModify(game.user, "update")) ||
          children.some(child => !child.canUserModify(game.user, "update"))) {
        ui.notifications.warn("You cannot move this unit to the selected division.");
        return;
      }
      const order = getDivisionUnitOrder(destination, source.id, targetId, after);
      const saved = getDivision(destination).unitOrder;
      if (!Array.isArray(saved) || order.length !== saved.length || order.some((id, i) => id !== saved[i])) {
        const updated = await destination.update({ [`flags.${MODULE_ID}.division.unitOrder`]: order });
        if (!updated) throw new Error("The destination division's order was not saved.");
      }
      if (Object.keys(tokenChanges).length) {
        if (!this.isEditable || !sourceDivision.isOwner || !destination.isOwner ||
            getDivision(sourceDivision)?.armyId !== this.document.id ||
            getDivision(destination)?.armyId !== this.document.id ||
            getTokenDivisionId(token) !== source.divisionId ||
            !token.canUserModify(game.user, "update")) {
          throw new Error("The unit or division changed before the move could be completed.");
        }
        const updated = await token.update(tokenChanges);
        if (!updated) throw new Error("The unit was not moved.");
      }
      for (const child of children) {
        const updated = await child.update({ [`flags.${MODULE_ID}.divisionId`]: destinationId });
        if (!updated) throw new Error(`${child.name} was not moved.`);
      }
    } catch (error) {
      console.error("Axona | Failed to move unit in army chart", error);
      ui.notifications.error(`Failed to move unit: ${error.message}`);
    } finally {
      this.#movingUnit = false;
      await this.render();
    }
  }

  async #addDivision(picker) {
    if (!picker.value) return;
    if (!this.isEditable) {
      ui.notifications.warn("You do not have permission to edit this army.");
      picker.value = "";
      return;
    }
    const actor = game.actors.get(picker.value);
    if (!actor?.visible || !actor.isOwner || !getDivision(actor) || getDivisionArmy(actor)) {
      ui.notifications.warn("Select an available, unassigned division you can edit.");
      picker.value = "";
      return;
    }
    await actor.update({ [`flags.${MODULE_ID}.division.armyId`]: this.document.id });
    await this.render();
  }

  async #removeDivision(target) {
    const actor = game.actors.get(target.dataset.divisionId);
    if (!this.isEditable || !actor?.visible || !actor.isOwner ||
        getDivision(actor)?.armyId !== this.document.id) {
      ui.notifications.warn("You cannot remove this division from the army.");
      return;
    }
    await actor.update({ [`flags.${MODULE_ID}.division.armyId`]: "" });
    await this.render();
  }

  static #openDivision(event, target) {
    const actor = game.actors.get(target.dataset.divisionId);
    if (!actor?.visible || getDivision(actor)?.armyId !== this.document.id) {
      ui.notifications.warn("This division is no longer available in the army.");
      return;
    }
    actor.sheet.render(true);
  }

  static #openUnit(event, target) {
    const token = getPlacedUnits().find(unit => unit.uuid === target.dataset.unitId);
    const division = token && game.actors.get(getTokenDivisionId(token));
    if (!token || !division?.visible || getDivision(division)?.armyId !== this.document.id) {
      ui.notifications.warn("This unit is no longer available in the army.");
      return;
    }
    token.actor.sheet.render(true);
  }
}
