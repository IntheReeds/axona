import { MODULE_ID, SIZE_MARKERS } from "../constants.js";
import { getUnit, getMaxHp, getHpColor, resourcePercent, hpBarLength } from "../units/unit.js";
import {
  getDivisionEntries, getDivisionUnitOrder, getDropParentId, getPlacedUnits, getSubunitParentId, getTokenDivision,
  getTokenDivisionId, hasSubunitLinks, isSubunitsCollapsed
} from "./division.js";
import { getCommander, setCommander } from "./commander.js";
import { deployDivision, returnDivision } from "./deploy.js";

export class DivisionSheet extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ActorSheetV2
) {
  #contextMenuContainers = new WeakSet();
  #draggedUnitId = null;

  static DEFAULT_OPTIONS = {
    classes: ["axona", "axona-division-sheet"],
    position: { width: 440, height: "auto" },
    form: { submitOnChange: true },
    actions: {
      toggleVital: DivisionSheet.#onToggleVital,
      toggleSubunits: DivisionSheet.#onToggleSubunits,
      deployDivision: DivisionSheet.#onDeploy,
      returnDivision: DivisionSheet.#onReturn
    }
  };

  _getHeaderControls() {
    const controls = super._getHeaderControls();
    if (game.user.isGM) {
      controls.push(
        { icon: "fa-solid fa-person-walking-arrow-right", label: "Deploy to Scene", action: "deployDivision" },
        { icon: "fa-solid fa-rotate-left", label: "Return from Scene", action: "returnDivision" }
      );
    }
    return controls;
  }

  static #onDeploy() {
    return deployDivision(this.document);
  }

  static #onReturn() {
    return returnDivision(this.document);
  }

  static PARTS = {
    division: { template: `modules/${MODULE_ID}/templates/divisions/division-sheet.hbs` }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.commander = getCommander(this.document);
    const units = getPlacedUnits();
    const entries = getDivisionEntries(this.document);
    const parentIds = new Set(entries.map(entry => entry.parentId).filter(Boolean));
    const members = entries.map(entry => {
      const token = entry.token;
      const unit = getUnit(token.actor);
      const maxHp = getMaxHp(unit);
      const hasSubunits = parentIds.has(entry.id);
      return {
        id: token.uuid, name: token.name, scene: entry.scene, img: token.texture.src,
        sizeMarker: SIZE_MARKERS[unit.unitSize] ?? SIZE_MARKERS.standard,
        canEdit: token.canUserModify(game.user, "update"),
        subunit: !!entry.parentId, parentId: entry.parentId, hasSubunits,
        collapsed: hasSubunits && isSubunitsCollapsed(token),
        hp: unit.hp.value, maxHp, hpPercent: resourcePercent(unit.hp.value, maxHp), hpColor: getHpColor(unit, maxHp),
        usesMagic: unit.usesMagic, mp: unit.mp?.value, maxMp: unit.mp?.max, mpPercent: resourcePercent(unit.mp?.value, unit.mp?.max),
        vital: !!unit.vital, shattered: !!unit.shattered,
        barLength: hpBarLength(maxHp)
      };
    });
    const collapsedParents = new Set(members.filter(m => m.collapsed).map(m => m.id));
    context.members = members;
    context.rows = members.filter(m => !(m.subunit && collapsedParents.has(m.parentId)));
    const vitalMembers = members.filter(m => m.vital);
    context.vitalCount = vitalMembers.length;
    context.vitalReadyCount = vitalMembers.filter(m => !m.shattered).length;
    context.availableUnits = units
      .filter(token => !getTokenDivision(token))
      .map(token => ({
        id: token.uuid, name: `${token.parent.name}: ${token.name} (${token.id})`,
        canEdit: token.canUserModify(game.user, "update")
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const commanderImg = this.element.querySelector(".axona-commander-img");
    if (commanderImg) {
      commanderImg.onclick = () => {
        const commander = getCommander(this.document);
        if (commander) game.actors.get(commander.id)?.sheet.render(true);
      };
    }
    const picker = this.element.querySelector("[data-division-unit]");
    if (picker) picker.onchange = () => this.#addUnit(picker);
    if (!this.#contextMenuContainers.has(this.element)) {
      this.#contextMenuContainers.add(this.element);
      new foundry.applications.ux.ContextMenu.implementation(this.element, ".axona-commander-img", [
        {
          label: "Remove Commander",
          icon: "fa-solid fa-trash",
          visible: () => this.isEditable,
          onClick: async () => {
            await setCommander(this.document, "");
            await this.render();
          }
        }
      ], { jQuery: false, fixed: true });
    }
    const list = this.element.querySelector(".axona-division-members");
    if (!list || this.#contextMenuContainers.has(list)) return;
    this.#contextMenuContainers.add(list);
    new foundry.applications.ux.ContextMenu.implementation(list, ".axona-division-member", [
      {
        label: "Move Up",
        icon: "fa-solid fa-arrow-up",
        visible: target => this.isEditable && !!target.previousElementSibling?.matches(".axona-division-member"),
        onClick: (event, target) => this.#reorderUnit(target.dataset.unitId, target.previousElementSibling.dataset.unitId, false)
      },
      {
        label: "Move Down",
        icon: "fa-solid fa-arrow-down",
        visible: target => this.isEditable && !!target.nextElementSibling?.matches(".axona-division-member"),
        onClick: (event, target) => this.#reorderUnit(target.dataset.unitId, target.nextElementSibling.dataset.unitId, true)
      },
      {
        label: "Make Subunit of Above",
        icon: "fa-solid fa-indent",
        visible: target => {
          if (!this.isEditable || target.dataset.hasSubunits === "true") return false;
          const parentId = this.#parentAboveId(target);
          return !!parentId && parentId !== target.dataset.parentId;
        },
        onClick: (event, target) => this.#setParent(target.dataset.unitId, this.#parentAboveId(target))
      },
      {
        label: "Remove Subunit",
        icon: "fa-solid fa-outdent",
        visible: target => this.isEditable && !!target.dataset.parentId,
        onClick: (event, target) => this.#setParent(target.dataset.unitId, "")
      },
      {
        label: "Remove",
        icon: "fa-solid fa-trash",
        visible: target => {
          const token = getPlacedUnits().find(unit => unit.uuid === target.dataset.unitId);
          return this.isEditable && token?.canUserModify(game.user, "update") &&
            getTokenDivisionId(token) === this.document.id;
        },
        onClick: (event, target) => this.#removeUnit(target)
      }
    ], { jQuery: false, fixed: true });

    for (const row of list.querySelectorAll(".axona-division-member")) {
      row.ondblclick = event => {
        if (event.target.closest("button")) return;
        this.#openUnit(row);
      };
      row.onkeydown = event => {
        if (event.target.closest("button")) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          this.#openUnit(row);
        } else if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
          event.preventDefault();
          const bounds = row.getBoundingClientRect();
          row.dispatchEvent(new MouseEvent("contextmenu", {
            bubbles: true, cancelable: true, clientX: bounds.left, clientY: bounds.bottom
          }));
        }
      };
      row.ondragstart = event => {
        if (!this.isEditable) {
          event.preventDefault();
          return;
        }
        event.stopPropagation();
        this.#draggedUnitId = row.dataset.unitId;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", this.#draggedUnitId);
        row.classList.add("axona-dragging");
      };
      row.ondragend = () => {
        this.#draggedUnitId = null;
        row.classList.remove("axona-dragging");
        for (const target of list.querySelectorAll(".axona-drop-before, .axona-drop-after")) {
          target.classList.remove("axona-drop-before", "axona-drop-after");
        }
      };
      row.ondragover = event => {
        if (!this.isEditable || !this.#draggedUnitId || this.#draggedUnitId === row.dataset.unitId) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        const bounds = row.getBoundingClientRect();
        const after = event.clientY >= bounds.top + bounds.height / 2;
        row.classList.toggle("axona-drop-before", !after);
        row.classList.toggle("axona-drop-after", after);
      };
      row.ondragleave = () => row.classList.remove("axona-drop-before", "axona-drop-after");
      row.ondrop = event => {
        if (!this.isEditable || !this.#draggedUnitId) return;
        event.preventDefault();
        event.stopPropagation();
        row.classList.remove("axona-drop-before", "axona-drop-after");
        const source = this.#draggedUnitId;
        this.#draggedUnitId = null;
        const bounds = row.getBoundingClientRect();
        this.#reorderUnit(source, row.dataset.unitId, event.clientY >= bounds.top + bounds.height / 2);
      };
    }
  }

  static async #onToggleSubunits(event, target) {
    const token = getPlacedUnits().find(unit => unit.uuid === target.dataset.unitId);
    if (!token?.canUserModify(game.user, "update")) {
      ui.notifications.warn("You cannot change the subunit view of this unit.");
      return;
    }
    await token.update({ [`flags.${MODULE_ID}.subunitsCollapsed`]: !isSubunitsCollapsed(token) });
  }

  static async #onToggleVital(event, target) {
    const token = getPlacedUnits().find(unit => unit.uuid === target.dataset.unitId);
    const unit = token ? getUnit(token.actor) : null;
    if (!this.isEditable || !token?.canUserModify(game.user, "update") || !unit) {
      ui.notifications.warn("You cannot change the vital status of this unit.");
      return;
    }
    await token.actor.update({ [`flags.${MODULE_ID}.unit.vital`]: !unit.vital });
  }

  #parentAboveId(target) {
    const previous = target.previousElementSibling;
    if (!previous?.matches(".axona-division-member")) return null;
    return previous.dataset.parentId || previous.dataset.unitId;
  }

  async #setParent(unitId, parentId) {
    const token = getPlacedUnits().find(unit => unit.uuid === unitId);
    if (!this.isEditable || !token?.canUserModify(game.user, "update") ||
        getTokenDivisionId(token) !== this.document.id) {
      ui.notifications.warn("You cannot change the subunits of this unit.");
      return;
    }
    if (parentId && hasSubunitLinks(unitId)) {
      ui.notifications.warn("A unit with subunits cannot become a subunit.");
      return;
    }
    await token.update({ [`flags.${MODULE_ID}.subunitOf`]: parentId });
    await this.render();
  }

  async #reorderUnit(sourceId, targetId, after) {
    const units = getPlacedUnits().filter(token => getTokenDivisionId(token) === this.document.id);
    if (!this.isEditable || sourceId === targetId ||
        !units.some(token => token.uuid === sourceId) || !units.some(token => token.uuid === targetId)) {
      ui.notifications.warn("These units are no longer available for reordering.");
      return;
    }
    const token = units.find(unit => unit.uuid === sourceId);
    const parentId = getDropParentId(getDivisionEntries(this.document), targetId, hasSubunitLinks(sourceId));
    if (getSubunitParentId(token) !== parentId && !token.canUserModify(game.user, "update")) {
      ui.notifications.warn("You cannot change the subunits of this unit.");
      return;
    }
    try {
      const order = getDivisionUnitOrder(this.document, sourceId, targetId, after);
      await this.document.update({ [`flags.${MODULE_ID}.division.unitOrder`]: order });
      if (getSubunitParentId(token) !== parentId) await token.update({ [`flags.${MODULE_ID}.subunitOf`]: parentId });
    } catch (error) {
      console.error("Axona | Failed to reorder division units", error);
      ui.notifications.error(`Failed to reorder division units: ${error.message}`);
    }
  }

  async #addUnit(picker) {
    if (!picker.value) return;
    if (!this.isEditable) {
      ui.notifications.warn("You do not have permission to edit this division.");
      picker.value = "";
      return;
    }
    const token = getPlacedUnits().find(unit => unit.uuid === picker.value);
    if (!token || !token.canUserModify(game.user, "update") || getTokenDivision(token)) {
      ui.notifications.warn("Select an available, unassigned unit token you can edit.");
      picker.value = "";
      return;
    }
    await token.update({ [`flags.${MODULE_ID}.divisionId`]: this.document.id });
    await this.render();
  }

  async #removeUnit(target) {
    const token = getPlacedUnits().find(unit => unit.uuid === target.dataset.unitId);
    if (!this.isEditable || !token?.canUserModify(game.user, "update") ||
        getTokenDivisionId(token) !== this.document.id) {
      ui.notifications.warn("You cannot remove this unit from the division.");
      return;
    }
    await token.update({ [`flags.${MODULE_ID}.divisionId`]: "", [`flags.${MODULE_ID}.subunitOf`]: "" });
    await this.render();
  }

  #openUnit(target) {
    const token = getPlacedUnits().find(unit => unit.uuid === target.dataset.unitId);
    if (!token || getTokenDivisionId(token) !== this.document.id) {
      ui.notifications.warn("This unit is no longer available in the division.");
      return;
    }
    token.actor.sheet.render(true);
  }
}
