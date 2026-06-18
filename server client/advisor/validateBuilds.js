const mockData = require("../mockGameData.json");
const { getBuildAdvice } = require("./apMidAdvisor");
const { getRecommendedComponent } = require("./itemBuildPaths");
const { clearRecommendationHistory } = require("./recommendationHistory");
const {
  CHAMPION_BUILDS,
  SUPPORTED_ROLES,
  getChampionBuild,
  getChampionCandidates,
} = require("./championBuilds");

const currentPlayer = mockData.playerList.find(
  (player) => player.summonerName === mockData.activePlayerName,
);
const enemyPlayers = mockData.playerList.filter(
  (player) => player.team !== currentPlayer.team,
);

const failures = [];
let buildCount = 0;
let recommendationCaseCount = 0;

const validateRecommendationCase = ({
  championName,
  role,
  currentItems,
  label,
}) => {
  recommendationCaseCount += 1;

  const build = getChampionBuild({ championName, role });
  const candidatePool = getChampionCandidates({ championName, role });
  const candidateSet = new Set(candidatePool);
  const avoidedSet = new Set(build.avoid || []);
  const ownedSet = new Set(
    currentItems.map((item) => item.meta?.name || item.displayName),
  );
  const advice = getBuildAdvice({
    championName,
    role,
    enemyPlayers,
    currentItems,
    persistHistory: false,
  });
  const recommendations = [
    advice.nextItem.best,
    ...advice.nextItem.alternatives,
  ].filter((recommendation) => recommendation?.item);

  recommendations.forEach((recommendation) => {
    if (!candidateSet.has(recommendation.item)) {
      failures.push(
        `${championName} ${role} (${label}) recommended outside pool: ${recommendation.item}`,
      );
    }

    if (avoidedSet.has(recommendation.item)) {
      failures.push(
        `${championName} ${role} (${label}) recommended avoided item: ${recommendation.item}`,
      );
    }

    if (ownedSet.has(recommendation.item)) {
      failures.push(
        `${championName} ${role} (${label}) recommended owned item: ${recommendation.item}`,
      );
    }
  });
};

Object.entries(CHAMPION_BUILDS).forEach(([championName, roles]) => {
  Object.entries(roles).forEach(([role, build]) => {
    buildCount += 1;

    if (!SUPPORTED_ROLES.includes(role)) {
      failures.push(`${championName} uses unsupported role ${role}`);
    }

    if (build.role !== role) {
      failures.push(`${championName} ${role} has mismatched role metadata`);
    }

    if (!Array.isArray(build.core) || build.core.length === 0) {
      failures.push(`${championName} ${role} must define a non-empty core array`);
    }

    if (!Array.isArray(build.situational)) {
      failures.push(`${championName} ${role} must define a situational array`);
    }

    if (!Array.isArray(build.preferredStats)) {
      failures.push(`${championName} ${role} must define preferredStats`);
    }

    if (!Array.isArray(build.avoidedStats)) {
      failures.push(`${championName} ${role} must define avoidedStats`);
    }

    if (!Array.isArray(build.preferredPlaystyle)) {
      failures.push(`${championName} ${role} must define preferredPlaystyle`);
    }

    if (!build.source || !build.sourceVersion) {
      failures.push(`${championName} ${role} must define source metadata`);
    }

    const candidates = getChampionCandidates({ championName, role });
    if (candidates.length < 3) {
      failures.push(
        `${championName} ${role} has only ${candidates.length} candidates`,
      );
    }

    validateRecommendationCase({
      championName,
      role,
      currentItems: [],
      label: "empty inventory",
    });

    const firstCoreItem = build.core[0];
    validateRecommendationCase({
      championName,
      role,
      currentItems: [
        {
          displayName: firstCoreItem,
          meta: { name: firstCoreItem, gold: { total: 3000 } },
        },
      ],
      label: "first core owned",
    });
  });
});

const componentItemDatabase = {
  "3089": {
    id: 3089,
    name: "Rabadon's Deathcap",
    from: ["1058", "1058"],
    gold: { total: 3600, purchasable: true },
  },
  "1058": {
    id: 1058,
    name: "Needlessly Large Rod",
    from: [],
    gold: { total: 1250, purchasable: true },
  },
};
const componentRecommendation = getRecommendedComponent({
  targetItemName: "Rabadon's Deathcap",
  currentGold: 1250,
  currentItems: [],
  itemDatabase: componentItemDatabase,
});

if (
  componentRecommendation?.suggestedPurchase?.name !== "Needlessly Large Rod"
) {
  failures.push("Component recommendation did not select Needlessly Large Rod");
}

const item = (name, total = 3000) => ({
  displayName: name,
  meta: { name, gold: { total } },
});
const progressionAdvice = getBuildAdvice({
  championName: "LeBlanc",
  role: "MIDDLE",
  enemyPlayers: [],
  currentItems: [
    item("Luden's Companion"),
    item("Shadowflame"),
  ],
  currentGold: 1250,
  itemDatabase: componentItemDatabase,
  persistHistory: false,
});

if (
  progressionAdvice.nextItem.buildPath.currentTargetItem !==
    "Rabadon's Deathcap" ||
  progressionAdvice.nextItem.buildPath.nextTargetItem !== "Void Staff"
) {
  failures.push("Build path progression did not advance Deathcap -> Void Staff");
}

if (
  !["Very High", "High", "Medium", "Low"].includes(
    progressionAdvice.nextItem.best.confidenceBand,
  )
) {
  failures.push("Recommendation confidence band is invalid");
}

const teamStyleAdvice = getBuildAdvice({
  championName: "LeBlanc",
  role: "MIDDLE",
  enemyPlayers,
  currentItems: [],
  persistHistory: false,
});

if (
  ![
    "front_to_back",
    "dive",
    "pick",
    "poke",
    "wombo",
    "protect_the_carry",
  ].includes(teamStyleAdvice.nextItem.debug.teamStyle.primary)
) {
  failures.push("Team-style detection returned an unsupported style");
}

clearRecommendationHistory();
const historyKey = "validation:stability";
const stableCurrentItems = [
  item("Luden's Companion"),
  item("Shadowflame"),
  item("Rabadon's Deathcap"),
];
const firstStableAdvice = getBuildAdvice({
  championName: "LeBlanc",
  role: "MIDDLE",
  enemyPlayers,
  currentItems: stableCurrentItems,
  historyKey,
});
const slightlyChangedEnemies = enemyPlayers.map((player, playerIndex) => ({
  ...player,
  items:
    playerIndex === 0 ? (player.items || []).slice(0, -1) : player.items,
}));
const secondStableAdvice = getBuildAdvice({
  championName: "LeBlanc",
  role: "MIDDLE",
  enemyPlayers: slightlyChangedEnemies,
  currentItems: stableCurrentItems,
  historyKey,
});

if (
  firstStableAdvice.nextItem.best.item !==
  secondStableAdvice.nextItem.best.item
) {
  failures.push("Recommendation stability changed after a minor enemy update");
}

if (failures.length > 0) {
  console.error(`Build validation failed with ${failures.length} issue(s):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(
  `Build validation passed: ${buildCount} builds, ${recommendationCaseCount} recommendation cases.`,
);
