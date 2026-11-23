import { MODULE_ID, DIVISION_SHEET_ID } from "../constants.js";
import { getUnit } from "../units/unit.js";

export function getDivision(actor) {
  return actor?.getFlag(MODULE_ID, "division") ?? null;
}

export function getDivisions() {
  return game.actors.contents
    .filter(actor => actor.visible && getDivision(actor))
    .map(actor => ({ id: actor.id, name: actor.name, img: actor.img }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getPlacedUnits({ visibleOnly = true } = {}) {
  return game.scenes.contents
    .filter(scene => !visibleOnly || scene.visible)
    .flatMap(scene => scene.tokens.contents)
    .filter(token => {
      if (!getUnit(token.actor)) return false;
      if (!visibleOnly) return true;
      return token.actor.visible && (!token.hidden || token.isOwner || game.user.isGM);
    });
}

export function getTokenDivisionId(token) {
  return token.getFlag(MODULE_ID, "divisionId") ?? "";
}

export function getTokenDivision(token) {
  return getDivision(game.actors.get(getTokenDivisionId(token)));
}

export function sortDivisionUnits(units, division) {
  const saved = getDivision(division)?.unitOrder;
  const order = new Map((Array.isArray(saved) ? saved : []).map((id, index) => [id, index]));
  return units.sort((a, b) => {
    const aIndex = order.get(a.id) ?? Infinity;
    const bIndex = order.get(b.id) ?? Infinity;
    return aIndex - bIndex || a.scene.localeCompare(b.scene) || a.name.localeCompare(b.name);
  });
}

export function getSubunitParentId(token) {
  return token.getFlag(MODULE_ID, "subunitOf") ?? "";
}

export function isSubunitsCollapsed(token) {
  return !!token.getFlag(MODULE_ID, "subunitsCollapsed");
}

export function hasSubunitLinks(tokenUuid) {
  return getPlacedUnits({ visibleOnly: false }).some(token => getSubunitParentId(token) === tokenUuid);
}

// Places each subunit directly after its parent. A link is ignored when its parent is not in the division
// or is itself a subunit, so that unit is listed as a normal unit.
export function arrangeSubunits(entries) {
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const parentOf = new Map();
  for (const entry of entries) {
    const parentId = getSubunitParentId(entry.token);
    if (byId.has(parentId) && parentId !== entry.id && !byId.has(getSubunitParentId(byId.get(parentId).token))) {
      parentOf.set(entry.id, parentId);
    }
  }
  const arranged = [];
  for (const entry of entries) {
    if (parentOf.has(entry.id)) continue;
    arranged.push({ ...entry, parentId: "" });
    for (const child of entries) {
      if (parentOf.get(child.id) === entry.id) arranged.push({ ...child, parentId: entry.id });
    }
  }
  return arranged;
}

export function getDivisionEntries(division) {
  const entries = getPlacedUnits()
    .filter(token => getTokenDivisionId(token) === division.id)
    .map(token => ({ id: token.uuid, token, scene: token.parent.name, name: token.name }));
  return arrangeSubunits(sortDivisionUnits(entries, division));
}

// Returns the parent a unit takes when placed at targetId (null for the end of a division).
// A unit with subunits always stays top-level.
export function getDropParentId(entries, targetId, hasSubunits) {
  if (hasSubunits || targetId === null) return "";
  return entries.find(entry => entry.id === targetId)?.parentId ?? "";
}

export function getDivisionUnitOrder(division, sourceId, targetId, after) {
  const saved = getDivision(division)?.unitOrder;
  const order = [...new Set(Array.isArray(saved) ? saved : [])];
  const units = getPlacedUnits()
    .filter(token => getTokenDivisionId(token) === division.id)
    .map(token => ({ id: token.uuid, scene: token.parent.name, name: token.name }));
  for (const unit of sortDivisionUnits(units, division)) {
    if (!order.includes(unit.id)) order.push(unit.id);
  }
  const sourceIndex = order.indexOf(sourceId);
  if (sourceIndex !== -1) order.splice(sourceIndex, 1);
  if (targetId === null) order.push(sourceId);
  else {
    const targetIndex = order.indexOf(targetId);
    if (targetIndex === -1) throw new Error("The target unit is no longer in the division.");
    order.splice(targetIndex + (after ? 1 : 0), 0, sourceId);
  }
  return order;
}

export async function makeDivision(actor) {
  if (getUnit(actor) || getDivision(actor) || actor.getFlag(MODULE_ID, "army")) {
    ui.notifications.warn("This actor is already an Axona unit, division, or army.");
    return;
  }
  await actor.update({
    [`flags.${MODULE_ID}.division`]: { enabled: true },
    "flags.core.sheetClass": DIVISION_SHEET_ID
  });
}

export async function removeDivision(actor) {
  const members = getPlacedUnits({ visibleOnly: false })
    .filter(token => getTokenDivisionId(token) === actor.id);
  if (getDivision(actor)?.armyId && game.actors.get(getDivision(actor).armyId)?.getFlag(MODULE_ID, "army")) {
    ui.notifications.warn("Remove this division from its army before removing the division.");
    return;
  }
  if (members.length) {
    ui.notifications.warn("Remove all units from this division before removing it.");
    return;
  }
  await actor.update({
    [`flags.${MODULE_ID}.-=division`]: null,
    "flags.core.-=sheetClass": null
  });
}

export function registerDivisionHooks() {
  // Several hooks fire for one change; coalescing them avoids overlapping renders leaving a sheet stale.
  // Renders open windows directly, because actor.sheet can be a different instance from the window on screen.
  const renderOpenSheets = predicate => {
    for (const app of foundry.applications.instances.values()) {
      if (app.rendered && app.document?.documentName === "Actor" && predicate(app.document)) app.render();
    }
  };
  const refresh = foundry.utils.debounce(() => {
    renderOpenSheets(candidate => !!getDivision(candidate) || !!getUnit(candidate) || !!candidate.getFlag(MODULE_ID, "army"));
  }, 50);
  const refreshTokenSheets = foundry.utils.debounce(() => {
    renderOpenSheets(actor => actor.isToken);
  }, 50);
  Hooks.on("createActor", () => {
    refresh();
    refreshTokenSheets();
  });
  Hooks.on("updateActor", (actor, changes) => {
    const expanded = foundry.utils.expandObject(changes);
    if (["name", "img", "prototypeToken", `flags.${MODULE_ID}.army`, `flags.${MODULE_ID}.-=army`,
      `flags.${MODULE_ID}.division`, `flags.${MODULE_ID}.-=division`,
      `flags.${MODULE_ID}.unit.divisionId`, `flags.${MODULE_ID}.unit`, `flags.${MODULE_ID}.-=unit`]
      .some(path => foundry.utils.hasProperty(expanded, path)) ||
      foundry.utils.hasProperty(expanded, `flags.${MODULE_ID}.unit.battle`)) {
      refresh();
      if (!getUnit(actor) || getDivision(actor) ||
          foundry.utils.hasProperty(expanded, `flags.${MODULE_ID}.-=division`)) refreshTokenSheets();
    }
  });
  Hooks.on("deleteActor", () => {
    refresh();
    refreshTokenSheets();
  });
  Hooks.on("createToken", refresh);
  Hooks.on("updateToken", (token, changes) => {
    const expanded = foundry.utils.expandObject(changes);
    if (["name", "hidden", "actorId", "actorLink", "texture.src", "delta",
      `flags.${MODULE_ID}.divisionId`, `flags.${MODULE_ID}.subunitOf`, `flags.${MODULE_ID}.subunitsCollapsed`]
      .some(path => foundry.utils.hasProperty(expanded, path))) {
      refresh();
      renderOpenSheets(actor => actor.isToken && actor.token?.uuid === token.uuid);
    }
  });
  Hooks.on("deleteToken", refresh);
  Hooks.on("updateScene", refresh);
  Hooks.on("createScene", refresh);
  Hooks.on("deleteScene", refresh);
}
