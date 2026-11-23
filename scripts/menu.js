import { getUnit, makeUnit, removeUnit } from "./units/unit.js";
import { getDivision, makeDivision, removeDivision } from "./divisions/division.js";
import { deployDivision, returnDivision } from "./divisions/deploy.js";
import { getArmy, makeArmy, removeArmy } from "./armies/army.js";

export function registerActorMenu() {
  Hooks.on("getActorContextOptions", (app, menuItems) => {
    const getActor = li =>
      app.collection.get(li.closest("[data-entry-id]").dataset.entryId);

    menuItems.push(
      {
        label: "Make Army Unit",
        icon: "fa-solid fa-chess-rook",
        visible: li => {
          const actor = getActor(li);
          return actor.isOwner && !getUnit(actor) && !getDivision(actor) && !getArmy(actor);
        },
        onClick: (event, li) => makeUnit(getActor(li))
      },
      {
        label: "Remove Army Unit",
        icon: "fa-solid fa-ban",
        visible: li => {
          const actor = getActor(li);
          return actor.isOwner && !!getUnit(actor);
        },
        onClick: (event, li) => removeUnit(getActor(li))
      },
      {
        label: "Make Division",
        icon: "fa-solid fa-flag",
        visible: li => {
          const actor = getActor(li);
          return actor.isOwner && !getUnit(actor) && !getDivision(actor) && !getArmy(actor);
        },
        onClick: (event, li) => makeDivision(getActor(li))
      },
      {
        label: "Remove Division",
        icon: "fa-solid fa-ban",
        visible: li => {
          const actor = getActor(li);
          return actor.isOwner && !!getDivision(actor);
        },
        onClick: (event, li) => removeDivision(getActor(li))
      },
      {
        label: "Deploy Division to Scene",
        icon: "fa-solid fa-person-walking-arrow-right",
        visible: li => game.user.isGM && !!getDivision(getActor(li)),
        onClick: (event, li) => deployDivision(getActor(li))
      },
      {
        label: "Return Division from Scene",
        icon: "fa-solid fa-rotate-left",
        visible: li => game.user.isGM && !!getDivision(getActor(li)),
        onClick: (event, li) => returnDivision(getActor(li))
      },
      {
        label: "Make Army",
        icon: "fa-solid fa-shield",
        visible: li => {
          const actor = getActor(li);
          return actor.isOwner && !getUnit(actor) && !getDivision(actor) && !getArmy(actor);
        },
        onClick: (event, li) => makeArmy(getActor(li))
      },
      {
        label: "Remove Army",
        icon: "fa-solid fa-ban",
        visible: li => {
          const actor = getActor(li);
          return actor.isOwner && !!getArmy(actor);
        },
        onClick: (event, li) => removeArmy(getActor(li))
      }
    );
  });
}
