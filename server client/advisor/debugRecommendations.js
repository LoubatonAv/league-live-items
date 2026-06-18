const mockData = require("../mockGameData.json");
const { getBuildAdvice } = require("./apMidAdvisor");
const {
  CHAMPION_BUILDS,
  getChampionBuild,
} = require("./championBuilds");

const STARTER_ITEMS_BY_ROLE = {
  TOP: "Doran's Shield",
  JUNGLE: "Gustwalker Hatchling",
  MIDDLE: "Doran's Ring",
  BOTTOM: "Doran's Blade",
  UTILITY: "World Atlas",
};

const currentPlayer = mockData.playerList.find(
  (player) => player.summonerName === mockData.activePlayerName,
);
const enemyPlayers = mockData.playerList.filter(
  (player) => player.team !== currentPlayer.team,
);

const supportedBuilds = Object.entries(CHAMPION_BUILDS).flatMap(
  ([championName, roles]) =>
    Object.keys(roles).map((role) => ({ championName, role })),
);

const output = supportedBuilds.map(({ championName, role }) => {
  const starterItem = STARTER_ITEMS_BY_ROLE[role] || "Starter Item";
  const currentItems = [
    {
      displayName: starterItem,
      meta: { name: starterItem, gold: { total: 400 } },
    },
  ];
  const advice = getBuildAdvice({
    championName,
    role,
    enemyPlayers,
    currentItems,
    currentGold: mockData.currentGold || 0,
    persistHistory: false,
  });
  const championBuild = getChampionBuild({ championName, role });

  return {
    champion: championName,
    role,
    currentItems: currentItems.map((item) => item.displayName),
    candidatePool: advice.nextItem.debug.candidatePool,
    ownedCoreItems: advice.nextItem.debug.ownedCoreItems,
    missingCoreItems: advice.nextItem.debug.missingCoreItems,
    nextCoreItem: advice.nextItem.debug.nextCoreItem,
    completedCorePercentage:
      advice.nextItem.debug.completedCorePercentage,
    bestItem: advice.nextItem.best,
    alternatives: advice.nextItem.alternatives,
    enemyTiers: advice.nextItem.debug.enemyTiers,
    teamStyle: advice.nextItem.debug.teamStyle,
    buildPath: advice.nextItem.buildPath,
    componentRecommendation: advice.nextItem.component,
    confidence: advice.nextItem.debug.recommendationConfidence,
    scoreBreakdown: advice.nextItem.debug.candidateScores,
    buildStage: advice.nextItem.debug.buildStage,
    archetype: championBuild?.archetype || null,
  };
});

console.log(JSON.stringify(output, null, 2));
