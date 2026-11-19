import { MODULE_ID, UNIT_CONDITIONS, UNIT_TALENTS } from "./constants.js";
import { getUnit, getMaxHp } from "./units/unit.js";
import { getTokenDivisionId } from "./divisions/division.js";

// HP bar and condition badges are drawn on the token art itself, so they rotate and scale with it.
const BAR_POSITION = 0.8;
const BADGE_RADIUS = 9;
// Shifts the Shattered overlay as a fraction of the token art's size (negative is left / up).
const OVERLAY_OFFSET_X = -0.04;
const OVERLAY_OFFSET_Y = -0.58;

export function registerTokenHud() {
  function drawUnitHud(token) {
    const unit = getUnit(token.actor);
    let hud = token._axonaHud;

    const visible = unit
      && !token.document.isSecret
      && token.mesh && !token.mesh.destroyed
      && (game.user.isGM || token.actor.testUserPermission(game.user, "OBSERVER"));

    if (!visible) {
      if (hud && !hud.destroyed) hud.visible = false;
      return;
    }

    if (!hud || hud.destroyed || hud.parent !== token) {
      hud = token._axonaHud = token.addChild(new PIXI.Container());
      hud._axonaOverlay = hud.addChild(new PIXI.Container());
      hud._axonaBar = hud.addChild(new PIXI.Graphics());
      hud._axonaBadges = hud.addChild(new PIXI.Container());
      hud._axonaImages = new Map();
    }

    const mesh = token.mesh;
    const s = canvas.dimensions.uiScale;
    const artWidth = Math.abs(mesh.width);
    const artHeight = Math.abs(mesh.height);
    const left = -mesh.anchor.x * artWidth;
    const top = -mesh.anchor.y * artHeight;

    // Art has local space: origin at the art's anchor point, rotated with the art.
    hud.position.set(mesh.x - token.x, mesh.y - token.y);
    hud.rotation = mesh.rotation;
    hud.visible = true;

    const margin = 4 * s;
    const maxHp = getMaxHp(unit);
    const pct = maxHp ? Math.clamp(unit.hp.value, 0, maxHp) / maxHp : 0;
    const barWidth = 8 * (token.document.width >= 2 ? 1.5 : 1) * s;
    const barHeight = artHeight - margin * 2;
    const barX = left + artWidth * BAR_POSITION - barWidth / 2;
    const fill = pct * barHeight;
    const color = unit.shaken ? 0xc0392b : foundry.utils.Color.mix(0xc0392b, 0x3a9b4a, pct);

    const activeConditions = UNIT_CONDITIONS.filter(({ key, setting }) => unit[key] && (!setting || unit[setting]));
    const overlay = activeConditions.find(condition => condition.overlay);
    const activeImages = new Set();
    const updateIcon = entry => {
      const { icon, layout } = entry;
      if (!icon) return;
      if (layout.overlay) {
        const scale = Math.min(layout.width / icon.texture.width, layout.height / icon.texture.height);
        icon.width = icon.texture.width * scale;
        icon.height = icon.texture.height * scale;
        icon.rotation = 0;
      } else {
        icon.width = icon.height = layout.size;
        icon.rotation = -hud.rotation;
      }
    };
    const drawImage = (key, image, layout) => {
      activeImages.add(key);
      let entry = hud._axonaImages.get(key);
      if (entry && entry.image !== image) {
        entry.container.destroy({ children: true });
        hud._axonaImages.delete(key);
        entry = null;
      }
      if (!entry) {
        const container = new PIXI.Container();
        (layout.overlay ? hud._axonaOverlay : hud._axonaBadges).addChild(container);
        entry = { image, container, icon: null, layout };
        hud._axonaImages.set(key, entry);
        foundry.canvas.loadTexture(image, { fallback: "icons/svg/mystery-man.svg" })
          .then(texture => {
            if (!texture || container.destroyed) return;
            entry.icon = new PIXI.Sprite(texture);
            entry.icon.anchor.set(0.5, 0.5);
            updateIcon(entry);
            container.addChild(entry.icon);
          })
          .catch(error => {
            console.error(`Axona | Failed to load token image: ${image}`, error);
            if (hud._axonaImages.get(key) === entry) {
              hud._axonaImages.delete(key);
              if (!container.destroyed) container.destroy({ children: true });
            }
          });
      }
      entry.layout = layout;
      entry.container.position.set(layout.x, layout.y);
      updateIcon(entry);
    };
    if (overlay) {
      drawImage(`condition:${overlay.key}`, overlay.image, {
        overlay: true, x: left + artWidth * (0.5 + OVERLAY_OFFSET_X), y: top + artHeight * (0.5 + OVERLAY_OFFSET_Y),
        width: artWidth, height: artHeight
      });
    }

    const bar = hud._axonaBar;
    bar.clear();
    bar.lineStyle(s, 0x000000, 1.0);
    bar.beginFill(0x000000, 0.5).drawRoundedRect(barX, top + margin, barWidth, barHeight, 3 * s);
    bar.beginFill(color, 1.0).drawRoundedRect(barX, top + margin + barHeight - fill, barWidth, fill, 2 * s);

    // Badges stack downward just left of the bar, with their contents kept upright.
    const radius = BADGE_RADIUS * s;
    let row = 0;
    const badges = activeConditions.filter(condition => !condition.overlay && !condition.belowStance);
    const stance = UNIT_TALENTS.find(talent =>
      talent.type === "stance" &&
      talent.key === unit.activeStance &&
      Array.isArray(unit.talents) &&
      unit.talents.includes(talent.key)
    );
    const drawBadge = (key, image, x, y) =>
      drawImage(key, image, { x, y, size: radius * 2, overlay: false });
    for (const { key, image } of badges) {
      drawBadge(`condition:${key}`, image, barX - 3 * s - radius, top + margin + radius + row * (radius * 2 + 3 * s));
      row++;
    }
    const conditionX = barX - 3 * s - radius;
    const stanceX = 2 * (left + artWidth / 2) - conditionX;
    if (stance) {
      drawBadge(`stance:${stance.key}`, stance.image, stanceX, top + margin + radius);
    }
    const belowStance = activeConditions.filter(condition => condition.belowStance);
    belowStance.forEach(({ key, image }, index) => {
      drawBadge(`condition:${key}`, image, stanceX, top + margin + radius + (index + 1) * (radius * 2 + 3 * s));
    });
    const divisionImage = game.actors.get(getTokenDivisionId(token.document))?.img;
    if (divisionImage) {
      drawBadge("division", divisionImage, stanceX - (radius * 2 + 3 * s), top + margin + radius);
    }
    for (const [key, entry] of hud._axonaImages) {
      if (activeImages.has(key)) continue;
      entry.container.destroy({ children: true });
      hud._axonaImages.delete(key);
    }
  }

  Hooks.on("refreshToken", token => drawUnitHud(token));

  Hooks.on("updateActor", (actor, changes) => {
    if (!foundry.utils.hasProperty(changes, `flags.${MODULE_ID}`)) return;
    for (const token of actor.getActiveTokens()) token.renderFlags.set({ refreshBars: true });
  });
}
