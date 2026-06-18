const fs = require("fs");
const path = require("path");
const { getBuildAdvice } = require("../advisor/apMidAdvisor");
const { clearRecommendationHistory } = require("../advisor/recommendationHistory");

const workspaceRoot = path.resolve(__dirname, "..");
const scenariosDirectory = path.join(workspaceRoot, "data", "scenarios");
const reportsDirectory = path.join(workspaceRoot, "reports");
const reportPath = path.join(reportsDirectory, "recommendationAccuracy.json");

const ITEM_STATS = {
  "Force of Nature": { FlatSpellBlockMod: 55, FlatHPPoolMod: 400 },
  "Mercury's Treads": { FlatSpellBlockMod: 20 },
  "Kaenic Rookern": { FlatSpellBlockMod: 80, FlatHPPoolMod: 400 },
  "Spirit Visage": { FlatSpellBlockMod: 40, FlatHPPoolMod: 400 },
  "Abyssal Mask": { FlatSpellBlockMod: 40, FlatHPPoolMod: 300 },
  Heartsteel: { FlatHPPoolMod: 700 },
  "Warmog's Armor": { FlatHPPoolMod: 1000 },
  "Sunfire Aegis": { FlatHPPoolMod: 350, FlatArmorMod: 50 },
  "Sterak's Gage": { FlatHPPoolMod: 400 },
  "Giant's Belt": { FlatHPPoolMod: 350 },
  "Ruby Crystal": { FlatHPPoolMod: 150 },
  "Hollow Radiance": { FlatHPPoolMod: 400, FlatSpellBlockMod: 40 },
  "Maw of Malmortius": { FlatSpellBlockMod: 40 },
};

const completedItem = (name) => ({
  displayName: name,
  meta: {
    name,
    gold: { total: 3000 },
  },
});

const enemyItem = (name) => ({
  displayName: name,
  meta: {
    name,
    stats: ITEM_STATS[name] || {},
    gold: { total: 2800 },
  },
});

const toEnemyPlayers = (scenario) => {
  return scenario.enemyPlayers.map((player, index) => ({
    summonerName: `ScenarioEnemy${index + 1}`,
    championName: player.champion,
    team: "CHAOS",
    items: player.items.map(enemyItem),
  }));
};

const perturbEnemyPlayers = (enemyPlayers) => {
  let removed = false;

  return enemyPlayers.map((player) => {
    if (!removed && player.items.length > 0) {
      removed = true;
      return { ...player, items: player.items.slice(0, -1) };
    }

    return player;
  });
};

const runScenario = (scenario) => {
  clearRecommendationHistory();
  const currentItems = scenario.ownedItems.map(completedItem);
  const enemyPlayers = toEnemyPlayers(scenario);
  const historyKey = `scenario:${scenario.name}`;
  const advice = getBuildAdvice({
    championName: scenario.champion,
    role: scenario.role,
    enemyPlayers,
    currentItems,
    currentGold: scenario.gameContext?.currentGold || 0,
    gameContext: scenario.gameContext || {},
    historyKey,
  });
  const perturbedAdvice = getBuildAdvice({
    championName: scenario.champion,
    role: scenario.role,
    enemyPlayers: perturbEnemyPlayers(enemyPlayers),
    currentItems,
    currentGold: scenario.gameContext?.currentGold || 0,
    gameContext: scenario.gameContext || {},
    historyKey,
  });
  const actual = advice.nextItem.best.item;
  const expected = scenario.expectedRecommendationCandidates;
  const passed = expected.includes(actual);
  const stable =
    actual === perturbedAdvice.nextItem.best.item ||
    expected.includes(perturbedAdvice.nextItem.best.item);
  const highConfidence = ["Very High", "High"].includes(
    advice.nextItem.best.confidenceBand,
  );
  const confidenceInconsistent = highConfidence && !passed;

  return {
    scenario: scenario.name,
    description: scenario.description,
    champion: scenario.champion,
    role: scenario.role,
    expected,
    actual,
    confidence: advice.nextItem.best.confidence,
    confidenceBand: advice.nextItem.best.confidenceBand,
    pass: passed,
    stable,
    perturbedActual: perturbedAdvice.nextItem.best.item,
    confidenceInconsistent,
    enemyStyle: advice.nextItem.debug.teamStyle.primary,
    buildPhase: advice.nextItem.buildPath.currentBuildPhase,
    targetItem: advice.nextItem.buildPath.currentTargetItem,
  };
};

const scenarioFiles = fs
  .readdirSync(scenariosDirectory)
  .filter((fileName) => fileName.endsWith(".json"))
  .sort();
const results = scenarioFiles.map((fileName) => {
  const scenario = JSON.parse(
    fs.readFileSync(path.join(scenariosDirectory, fileName), "utf8"),
  );
  return runScenario(scenario);
});
const regressionChampions = ["LeBlanc", "Veigar", "Briar", "Evelynn", "Leona"];
const regression = regressionChampions.map((champion) => {
  const championResults = results.filter((result) => result.champion === champion);
  return {
    champion,
    covered: championResults.length > 0,
    passed:
      championResults.length > 0 &&
      championResults.every((result) => result.pass && result.stable),
    scenarios: championResults.map((result) => result.scenario),
  };
});
const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    scenarioCount: results.length,
    passed: results.filter((result) => result.pass).length,
    failed: results.filter((result) => !result.pass).length,
    stable: results.filter((result) => result.stable).length,
    unstable: results.filter((result) => !result.stable).length,
    confidenceFlags: results.filter((result) => result.confidenceInconsistent)
      .length,
    accuracy:
      results.length > 0
        ? Math.round(
            (results.filter((result) => result.pass).length / results.length) *
              100,
          )
        : 0,
  },
  regression,
  results,
};

fs.mkdirSync(reportsDirectory, { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.table(
  results.map((result) => ({
    scenario: result.scenario,
    champion: result.champion,
    expected: result.expected.join(" | "),
    actual: result.actual,
    confidence: `${result.confidence} ${result.confidenceBand}`,
    pass: result.pass,
    stable: result.stable,
  })),
);
console.log(
  `Accuracy: ${report.summary.accuracy}% (${report.summary.passed}/${report.summary.scenarioCount})`,
);
console.log(`Report: ${path.relative(workspaceRoot, reportPath)}`);

if (
  report.summary.failed > 0 ||
  report.summary.unstable > 0 ||
  report.summary.confidenceFlags > 0 ||
  regression.some((entry) => !entry.passed)
) {
  process.exit(1);
}
