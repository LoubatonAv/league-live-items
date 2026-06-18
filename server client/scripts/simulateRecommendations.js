const fs = require("fs");
const path = require("path");
const mockData = require("../mockGameData.json");
const { getBuildAdvice } = require("../advisor/apMidAdvisor");
const { CHAMPION_BUILDS } = require("../advisor/championBuilds");

const workspaceRoot = path.resolve(__dirname, "..");
const reportsDirectory = path.join(workspaceRoot, "reports");
const currentPlayer = mockData.playerList.find(
  (player) => player.summonerName === mockData.activePlayerName,
);
const enemyPlayers = mockData.playerList.filter(
  (player) => player.team !== currentPlayer.team,
);
const starterItems = {
  TOP: "Doran's Shield",
  JUNGLE: "Gustwalker Hatchling",
  MIDDLE: "Doran's Ring",
  BOTTOM: "Doran's Blade",
  UTILITY: "World Atlas",
};

const simulations = Object.entries(CHAMPION_BUILDS).flatMap(
  ([championName, roles]) =>
    Object.keys(roles).map((role) => {
      const starterName = starterItems[role] || "Starter Item";
      const advice = getBuildAdvice({
        championName,
        role,
        enemyPlayers,
        currentItems: [
          {
            displayName: starterName,
            meta: { name: starterName, gold: { total: 400 } },
          },
        ],
        currentGold: mockData.currentGold || 0,
        persistHistory: false,
      });

      return {
        champion: championName,
        role,
        bestItem: advice.nextItem.best.item,
        confidence: advice.nextItem.best.confidence,
        confidenceBand: advice.nextItem.best.confidenceBand,
        buildPhase: advice.nextItem.buildPath.currentBuildPhase,
        targetItem: advice.nextItem.buildPath.currentTargetItem,
      };
    }),
);

fs.mkdirSync(reportsDirectory, { recursive: true });
fs.writeFileSync(
  path.join(reportsDirectory, "recommendationSimulation.json"),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      simulationCount: simulations.length,
      simulations,
    },
    null,
    2,
  )}\n`,
);

console.table(simulations);
