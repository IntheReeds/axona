// Run with Node and the path to Foundry's resources/app directory.
const path = require("node:path");

const app = process.argv[2];
if (!app) throw new Error("Provide the path to Foundry's resources/app directory.");
const { ClassicLevel } = require(path.join(app, "node_modules", "classic-level"));

const outcomes = {
  hold: "Remain in position without penalty.",
  retreat: "Retreat in good order.",
  retreatDisordered: "Retreat while disordered.",
  holdOrRetreat: "Remain in position disordered, or retreat in good order.",
  giveGround: "Give ground in good order along with supporting units.",
  giveGroundDisordered: "Give ground while disordered.",
  giveGroundWithSupports: "Give ground while disordered, together with supporting units.",
  breakIfShakenRetreat: "If shaken, break; otherwise retreat while disordered.",
  breakIfShakenGround: "If shaken, break; otherwise give ground while disordered.",
  breakIfShakenSupports: "If shaken, break; otherwise give ground with supporting units; all are disordered.",
  breakIfCasualties: "If the unit has suffered casualties, break; otherwise retreat while disordered.",
  break: "Break."
};

// Scores are ordered from 2 or less to 10 or more.
const definitions = [
  ["InfantryRanged01", "Infantry - Ranged", [
    "breakIfCasualties", "breakIfShakenRetreat", "retreatDisordered", "holdOrRetreat",
    "holdOrRetreat", "hold", "hold", "hold", "hold"
  ]],
  ["InfantryMelee001", "Infantry - Melee", [
    "break", "breakIfShakenSupports", "breakIfShakenSupports", "giveGroundWithSupports",
    "giveGround", "giveGround", "hold", "hold", "hold"
  ]],
  ["CavalryRanged001", "Cavalry - Ranged", [
    "breakIfCasualties", "breakIfShakenRetreat", "breakIfShakenRetreat", "retreatDisordered",
    "retreatDisordered", "retreat", "hold", "hold", "hold"
  ]],
  ["CavalryMelee0001", "Cavalry - Melee", [
    "break", "break", "breakIfShakenSupports", "breakIfShakenSupports",
    "giveGroundWithSupports", "giveGroundWithSupports", "giveGround", "giveGround", "hold"
  ]],
  ["SkirmishRanged01", "Skirmishers - Ranged", [
    "break", "break", "breakIfCasualties", "breakIfShakenRetreat",
    "retreatDisordered", "retreatDisordered", "retreatDisordered", "retreat", "hold"
  ]],
  ["SkirmishMelee001", "Skirmishers - Melee", [
    "break", "break", "break", "break", "break", "break",
    "breakIfShakenGround", "giveGroundDisordered", "hold"
  ]]
];

async function build() {
  const db = new ClassicLevel(path.join(__dirname, "..", "packs", "break-tests"), {
    keyEncoding: "utf8",
    valueEncoding: "json"
  });
  const tables = db.sublevel("tables", { valueEncoding: "json" });
  const results = db.sublevel("tables.results", { valueEncoding: "json" });
  try {
    if ((await db.keys().all()).length) throw new Error("Refusing to overwrite an existing pack.");
    for (const [id, name, rows] of definitions) {
      const ids = rows.map((_, index) => `Result${String(index + 1).padStart(10, "0")}`);
      await tables.put(id, {
        _id: id,
        name: `Break Test: ${name}`,
        description: "",
        img: "icons/svg/d20-grey.svg",
        formula: "2d6",
        replacement: true,
        displayRoll: true,
        results: ids,
        ownership: { default: 0 },
        flags: {},
        _stats: { coreVersion: "14", systemId: null, systemVersion: null }
      });
      for (let index = 0; index < rows.length; index++) {
        const score = index + 2;
        await results.put(`${id}.${ids[index]}`, {
          _id: ids[index],
          type: "text",
          name: "",
          description: outcomes[rows[index]],
          img: "icons/svg/d20-black.svg",
          weight: 1,
          range: [score, score],
          drawn: false,
          flags: {},
          _stats: { coreVersion: "14", systemId: null, systemVersion: null }
        });
      }
    }
  } finally {
    await db.close();
  }
}

build().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
