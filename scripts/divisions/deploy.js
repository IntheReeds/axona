import { MODULE_ID } from "../constants.js";
import { getDivision, getDivisionEntries } from "./division.js";

const ORIGIN_KEY = "origin";

function getOrigin(token) {
  return token.getFlag(MODULE_ID, ORIGIN_KEY) ?? null;
}

// Lays the tokens out in a grid centered on the scene.
function layoutPositions(scene, tokens) {
  const size = scene.grid.size;
  const cell = Math.max(1, ...tokens.map(token => Math.max(token.width, token.height))) * size;
  const columns = Math.ceil(Math.sqrt(tokens.length));
  const rows = Math.ceil(tokens.length / columns);
  const rect = scene.dimensions.sceneRect;
  const startX = rect.x + rect.width / 2 - (columns * cell) / 2;
  const startY = rect.y + rect.height / 2 - (rows * cell) / 2;
  return tokens.map((token, index) => {
    const center = scene.grid.getSnappedPoint(
      { x: startX + ((index % columns) + 0.5) * cell, y: startY + (Math.floor(index / columns) + 0.5) * cell },
      { mode: CONST.GRID_SNAPPING_MODES.CENTER }
    );
    return { x: center.x - (token.width * size) / 2, y: center.y - (token.height * size) / 2 };
  });
}

// Recreates each token on its target scene and then deletes the original. The token data, including the
// unlinked actor delta and every flag, is copied as is. Token uuids change with the scene, so the division
// order and subunit links that point at moved tokens are remapped.
async function relocateTokens(division, moves) {
  const uuidMap = new Map();
  for (const move of moves) {
    move.newId = foundry.utils.randomID();
    uuidMap.set(move.token.uuid, `Scene.${move.scene.id}.Token.${move.newId}`);
  }

  const createdByScene = new Map();
  for (const move of moves) {
    const data = move.token.toObject();
    data._id = move.newId;
    if (data.delta) data.delta._id = move.newId;
    delete data.level;
    if (move.level) data.level = move.level;
    Object.assign(data, move.position);
    const flags = foundry.utils.getProperty(data, `flags.${MODULE_ID}`) ?? {};
    if (move.origin) flags[ORIGIN_KEY] = move.origin;
    else delete flags[ORIGIN_KEY];
    if (uuidMap.has(flags.subunitOf)) flags.subunitOf = uuidMap.get(flags.subunitOf);
    foundry.utils.setProperty(data, `flags.${MODULE_ID}`, flags);
    if (!createdByScene.has(move.scene)) createdByScene.set(move.scene, []);
    createdByScene.get(move.scene).push(data);
  }

  for (const [scene, data] of createdByScene) {
    await scene.createEmbeddedDocuments("Token", data, { keepId: true });
    // Modules such as Token Mold rewrite the name and token settings in preCreateToken, so the copied
    // values are written back to keep every token exactly as it was.
    const restore = data.map(({ delta, level, ...token }) => token);
    await scene.updateEmbeddedDocuments("Token", restore);
  }

  const order = getDivision(division)?.unitOrder;
  if (Array.isArray(order)) {
    await division.update({
      [`flags.${MODULE_ID}.division.unitOrder`]: order.map(id => uuidMap.get(id) ?? id)
    });
  }

  const deletions = new Map();
  for (const { token } of moves) {
    if (!deletions.has(token.parent)) deletions.set(token.parent, []);
    deletions.get(token.parent).push(token.id);
  }
  for (const [scene, ids] of deletions) await scene.deleteEmbeddedDocuments("Token", ids);
}

function requireGM() {
  if (game.user.isGM) return true;
  ui.notifications.warn("Only a GM can deploy or return divisions.");
  return false;
}

async function pickScene(division, count) {
  const scenes = game.scenes.contents.sort((a, b) => a.name.localeCompare(b.name));
  const escape = foundry.utils.escapeHTML;
  const options = scenes.map(scene => `<option value="${scene.id}">${escape(scene.name)}</option>`).join("");
  const result = await foundry.applications.api.DialogV2.prompt({
    window: { title: "Deploy to Scene" },
    content: `
      <p>Move <strong>${escape(division.name)}</strong> (${count} unit${count === 1 ? "" : "s"}) to:</p>
      <div class="form-group">
        <select name="sceneId" aria-label="Scene">${options}</select>
      </div>`,
    rejectClose: false,
    ok: {
      label: "Deploy",
      callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object
    }
  });
  return game.scenes.get(result?.sceneId);
}

export async function deployDivision(division, scene = null) {
  if (!requireGM()) return;
  if (!getDivision(division)) {
    ui.notifications.warn("Select a division to deploy.");
    return;
  }
  const entries = getDivisionEntries(division);
  if (!entries.length) {
    ui.notifications.warn(`${division.name} has no placed units.`);
    return;
  }
  scene ??= await pickScene(division, entries.length);
  if (!scene) return;

  const tokens = entries.map(entry => entry.token).filter(token => token.parent.id !== scene.id);
  if (!tokens.length) {
    ui.notifications.info(`${division.name} is already on ${scene.name}.`);
    return;
  }

  const positions = layoutPositions(scene, tokens);
  const moves = tokens.map((token, index) => ({
    token,
    scene,
    position: positions[index],
    // Keeps the earliest origin, so a unit moved twice still returns to where it started.
    origin: getOrigin(token) ?? {
      sceneId: token.parent.id, x: token.x, y: token.y,       elevation: token.elevation, level: token.level ?? null
    }
  }));

  try {
    await relocateTokens(division, moves);
    ui.notifications.info(`Deployed ${division.name} (${moves.length} units) to ${scene.name}.`);
  } catch (error) {
    console.error("Axona | Failed to deploy division", error);
    ui.notifications.error(`Failed to deploy ${division.name}: ${error.message}`);
  }
}

export async function returnDivision(division) {
  if (!requireGM()) return;
  if (!getDivision(division)) {
    ui.notifications.warn("Select a division to return.");
    return;
  }
  const entries = getDivisionEntries(division);
  const moves = [];
  let skipped = 0;
  for (const { token } of entries) {
    const origin = getOrigin(token);
    const scene = origin ? game.scenes.get(origin.sceneId) : null;
    if (!scene || scene.id === token.parent.id) {
      skipped++;
      continue;
    }
    moves.push({
      token,
      scene,
      position: { x: origin.x, y: origin.y, elevation: origin.elevation },
      level: scene.levels?.has?.(origin.level) ? origin.level : null,
      origin: null
    });
  }
  if (!moves.length) {
    ui.notifications.warn(`${division.name} has no deployed units to return.`);
    return;
  }

  try {
    await relocateTokens(division, moves);
    const note = skipped ? ` ${skipped} unit${skipped === 1 ? " was" : "s were"} not deployed from another scene and stayed put.` : "";
    ui.notifications.info(`Returned ${moves.length} units of ${division.name}.${note}`);
  } catch (error) {
    console.error("Axona | Failed to return division", error);
    ui.notifications.error(`Failed to return ${division.name}: ${error.message}`);
  }
}
