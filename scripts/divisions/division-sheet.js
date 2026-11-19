import { MODULE_ID, SIZE_MARKERS } from "../constants.js";
import { getUnit, getMaxHp, getHpColor, resourcePercent, hpBarLength } from "../units/unit.js";
import { getDivisionUnitOrder, getPlacedUnits, getTokenDivision, getTokenDivisionId, sortDivisionUnits } from "./division.js";
import { getCommander, setCommander } from "./commander.js";

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
      toggleVital: DivisionSheet.#onToggleVital
    }
  };

  static PARTS = {
    division: { template: `modules/${MODULE_ID}/templates/divisions/division-sheet.hbs` }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.commander = getCommander(this.document);
    const units = getPlacedUnits();
    const members = sortDivisionUnits(units
      .filter(token => getTokenDivisionId(token) === this.document.id)
      .map(token => {
        const unit = getUnit(token.actor);
        const maxHp = getMaxHp(unit);
        return {
          id: token.uuid, name: token.name, scene: token.parent.name, img: token.texture.src,
          sizeMarker: SIZE_MARKERS[unit.unitSize] ?? SIZE_MARKERS.standard,
          canEdit: token.canUserModify(game.user, "update"),
          hp: unit.hp.value, maxHp, hpPercent: resourcePercent(unit.hp.value, maxHp), hpColor: getHpColor(unit, maxHp),
          usesMagic: unit.usesMagic, mp: unit.mp?.value, maxMp: unit.mp?.max, mpPercent: resourcePercent(unit.mp?.value, unit.mp?.max),
          vital: !!unit.vital,
          barLength: hpBarLength(maxHp)
        };
      }), this.document);
    context.members = members;
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
      row.ondblclick = () => this.#openUnit(row);
      row.onkeydown = event => {
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

  static async #onToggleVital(event, target) {
    const token = getPlacedUnits().find(unit => unit.uuid === target.dataset.unitId);
    const unit = token ? getUnit(token.actor) : null;
    if (!this.isEditable || !token?.canUserModify(game.user, "update") || !unit) {
      ui.notifications.warn("You cannot change the vital status of this unit.");
      return;
    }
    await token.actor.update({ [`flags.${MODULE_ID}.unit.vital`]: !unit.vital });
  }

  async #reorderUnit(sourceId, targetId, after) {
    const units = getPlacedUnits().filter(token => getTokenDivisionId(token) === this.document.id);
    if (!this.isEditable || sourceId === targetId ||
        !units.some(token => token.uuid === sourceId) || !units.some(token => token.uuid === targetId)) {
      ui.notifications.warn("These units are no longer available for reordering.");
      return;
    }
    try {
      const order = getDivisionUnitOrder(this.document, sourceId, targetId, after);
      await this.document.update({ [`flags.${MODULE_ID}.division.unitOrder`]: order });
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
    await token.update({ [`flags.${MODULE_ID}.divisionId`]: "" });
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
