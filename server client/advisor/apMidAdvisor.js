const {
  getChampionArchetype,
  getEnemyChampionProfile,
  getArchetypeItemRules,
} = require("./championData");

const {
  getChampionBuild,
  getDefaultRole,
  getChampionCandidates,
} = require("./championBuilds");
const { getItemSignals } = require("./itemSignals");
const { createItemLookup, getRecommendedComponent } = require("./itemBuildPaths");
const {
  getRecommendationHistory,
  setRecommendationHistory,
} = require("./recommendationHistory");

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const normalizeText = (value = "") => value.toLowerCase();
const SEVERITY_RANK = { low: 0, medium: 1, high: 2, extreme: 3 };

const getSeverityTier = (value, thresholds) => {
  if (value >= thresholds.extreme) return "extreme";
  if (value >= thresholds.high) return "high";
  if (value >= thresholds.medium) return "medium";
  return "low";
};

const isTierAtLeast = (tier, minimum) => {
  return SEVERITY_RANK[tier] >= SEVERITY_RANK[minimum];
};

const hasItemByName = (items = [], itemName) =>
  items.some((item) => {
    const name = item?.meta?.name || item?.displayName || "";
    return normalizeText(name) === normalizeText(itemName);
  });


const ROLE_ALIASES = {
  MID: "MIDDLE",
  SUPPORT: "UTILITY",
  SUP: "UTILITY",
  ADC: "BOTTOM",
  BOT: "BOTTOM",
};

const resolveRole = (championName, requestedRole) => {
  const normalizedRole = requestedRole
    ? ROLE_ALIASES[String(requestedRole).toUpperCase()] ||
      String(requestedRole).toUpperCase()
    : null;

  if (
    normalizedRole &&
    getChampionBuild({ championName, role: normalizedRole })
  ) {
    return normalizedRole;
  }

  return getDefaultRole(championName);
};

const formatItemEvidence = (itemNames = [], fallback = "multiple items") => {
  const visibleItems = itemNames.slice(0, 3);

  if (visibleItems.length === 0) return fallback;
  if (itemNames.length > visibleItems.length) {
    return `${visibleItems.join(", ")}, and additional items`;
  }
  if (visibleItems.length === 1) return visibleItems[0];

  return `${visibleItems.slice(0, -1).join(", ")} and ${visibleItems.at(-1)}`;
};

const TEAM_STYLE_WEIGHTS = {
  dive: {
    "Banshee's Veil": 14,
    "Zhonya's Hourglass": 18,
    "Death's Dance": 10,
    "Guardian Angel": 10,
  },
  front_to_back: {
    "Void Staff": 16,
    Cryptbloom: 12,
    "Black Cleaver": 16,
    "Liandry's Torment": 12,
  },
  poke: {
    "Banshee's Veil": 10,
    "Spirit Visage": 10,
    Redemption: 12,
    "Moonstone Renewer": 10,
  },
  pick: {
    "Banshee's Veil": 12,
    "Edge of Night": 12,
    "Zhonya's Hourglass": 8,
  },
  wombo: {
    "Zhonya's Hourglass": 14,
    "Locket of the Iron Solari": 14,
    "Banshee's Veil": 10,
  },
  protect_the_carry: {
    "Knight's Vow": 14,
    "Locket of the Iron Solari": 12,
    "Mikael's Blessing": 12,
  },
};

const GAME_STATE_WEIGHTS = {
  phases: {
    early: {
      core_progression: 22,
      enemyAnalysisMultiplier: 0.75,
    },
    mid: {
      core_progression: 8,
      enemyAnalysisMultiplier: 1,
    },
    late: {
      core_progression: 0,
      enemyAnalysisMultiplier: 1.3,
    },
  },
  performance: {
    ahead: {
      greedy_damage: 16,
      burst: 12,
      snowball: 18,
      survival: -6,
    },
    behind: {
      survival: 18,
      team_survival: 14,
      ally_protection: 10,
      greedy_damage: -14,
      snowball: -12,
    },
    highDeaths: {
      survival: 14,
      team_survival: 10,
      greedy_damage: -8,
    },
    highKills: {
      burst: 8,
      greedy_damage: 10,
      snowball: 14,
    },
  },
};

const KEY_DEFENSIVE_ITEMS = new Set([
  "Force of Nature",
  "Kaenic Rookern",
  "Spirit Visage",
  "Abyssal Mask",
  "Thornmail",
  "Frozen Heart",
  "Randuin's Omen",
  "Warmog's Armor",
  "Heartsteel",
  "Sterak's Gage",
  "Maw of Malmortius",
  "Locket of the Iron Solari",
  "Seraph's Embrace",
  "Immortal Shieldbow",
]);

const normalizeGameContext = (gameContext = {}) => {
  const gameTime = Number(gameContext.gameTime || 0);
  const kills = Number(gameContext.kills || 0);
  const deaths = Number(gameContext.deaths || 0);
  const assists = Number(gameContext.assists || 0);
  const phase = gameTime >= 1800 ? "late" : gameTime >= 900 ? "mid" : "early";
  const ahead = kills >= deaths + 2;
  const behind = deaths >= kills + 2;

  return {
    gameTime,
    currentGold: Number(gameContext.currentGold || 0),
    level: Number(gameContext.level || 0),
    kills,
    deaths,
    assists,
    phase,
    performance: ahead ? "ahead" : behind ? "behind" : "even",
    highDeaths: deaths >= 5,
    highKills: kills >= 5,
  };
};

const ITEM_STAT_MATCHERS = {
  ability_power: (item) => (item?.stats?.FlatMagicDamageMod || 0) > 0,
  attack_damage: (item) => (item?.stats?.FlatPhysicalDamageMod || 0) > 0,
  attack_speed: (item) => (item?.stats?.PercentAttackSpeedMod || 0) > 0,
  health: (item) => (item?.stats?.FlatHPPoolMod || 0) > 0,
  armor: (item) => (item?.stats?.FlatArmorMod || 0) > 0,
  magic_resist: (item) => (item?.stats?.FlatSpellBlockMod || 0) > 0,
  movement_speed: (item) =>
    (item?.stats?.FlatMovementSpeedMod || 0) > 0 ||
    (item?.stats?.PercentMovementSpeedMod || 0) > 0,
  mana: (item) => (item?.stats?.FlatMPPoolMod || 0) > 0,
  critical_strike: (item) => (item?.stats?.FlatCritChanceMod || 0) > 0,
  magic_penetration: (item) =>
    /magic penetration|magic pen/i.test(
      `${item?.description || ""} ${item?.plainText || ""}`,
    ),
  ability_haste: (item) =>
    /ability haste/i.test(`${item?.description || ""} ${item?.plainText || ""}`),
  heal_shield_power: (item) =>
    /heal and shield power|healing and shielding/i.test(
      `${item?.description || ""} ${item?.plainText || ""}`,
    ),
  mana_regen: (item) =>
    /mana regen/i.test(`${item?.description || ""} ${item?.plainText || ""}`),
};

const getTeamStyle = ({ profiles, scores, tankCount, squishyCount }) => {
  const classCount = (className) =>
    profiles.filter((profile) => profile.classes.includes(className)).length;
  const styleScores = {
    front_to_back:
      tankCount * 18 +
      classCount("marksman") * 14 +
      (tankCount >= 2 && squishyCount >= 1 ? 18 : 0),
    dive: scores.diveScore + classCount("fighter") * 8,
    pick: classCount("pick") * 20 + scores.ccScore * 0.5,
    poke:
      classCount("poke") * 24 +
      classCount("long_range") * 18 +
      classCount("mage") * 5,
    wombo:
      scores.engageScore * 0.6 +
      scores.ccScore * 0.6 +
      classCount("aoe") * 18,
    protect_the_carry:
      classCount("marksman") * 18 +
      classCount("enchanter") * 22 +
      scores.shieldScore,
  };
  const rankedStyles = Object.entries(styleScores).sort((a, b) => b[1] - a[1]);

  return {
    primary: rankedStyles[0]?.[0] || "balanced",
    secondary: rankedStyles[1]?.[0] || null,
    scores: Object.fromEntries(
      rankedStyles.map(([style, score]) => [style, Math.round(score)]),
    ),
  };
};

const analyzeEnemyTeam = (enemyPlayers = []) => {
  const itemSignals = getItemSignals(enemyPlayers);
  const profiles = [];

  let adCount = 0;
  let apCount = 0;
  let tankCount = 0;
  let bruiserCount = 0;
  let squishyCount = 0;
  let ccRaw = 0;
  let engageRaw = 0;
  let diveRaw = 0;
  let shieldRaw = 0;

  enemyPlayers.forEach((player) => {
    const profile = getEnemyChampionProfile(player.championName);
    profiles.push(profile);

    if (profile.damageType === "ad") adCount += 1;
    if (profile.damageType === "ap") apCount += 1;
    if (profile.damageType === "mixed") {
      adCount += 0.5;
      apCount += 0.5;
    }

    if (profile.classes.includes("tank")) tankCount += 1;
    if (profile.classes.includes("fighter")) bruiserCount += 1;

    if (
      profile.classes.includes("marksman") ||
      profile.classes.includes("mage") ||
      profile.classes.includes("squishy")
    ) {
      squishyCount += 1;
    }

    ccRaw += profile.cc || 0;
    engageRaw += profile.engage || 0;
    diveRaw += profile.dive || 0;
    shieldRaw += profile.shield || 0;
  });

  const scores = {
    adScore: adCount * 10,
    apScore: apCount * 10,

    tankScore: tankCount * 16 + bruiserCount * 8,
    squishyScore: squishyCount * 9,

    ccScore: ccRaw * 4,
    engageScore: engageRaw * 5,
    diveScore: diveRaw * 6,

    shieldScore: shieldRaw * 4 + itemSignals.totalShieldItems * 5,

    mrScore: itemSignals.totalMR + itemSignals.totalMRItems * 12,
    armorScore: itemSignals.totalArmor + itemSignals.totalArmorItems * 8,

    hpScore:
      itemSignals.totalHP / 20 +
      itemSignals.totalHPItems * 8 +
      tankCount * 10 +
      bruiserCount * 6,
  };

  const tiers = {
    mr: getSeverityTier(scores.mrScore, {
      medium: 25,
      high: 70,
      extreme: 180,
    }),
    armor: getSeverityTier(scores.armorScore, {
      medium: 25,
      high: 90,
      extreme: 220,
    }),
    hp: getSeverityTier(scores.hpScore, {
      medium: 30,
      high: 80,
      extreme: 180,
    }),
    shields: getSeverityTier(scores.shieldScore, {
      medium: 8,
      high: 16,
      extreme: 28,
    }),
    engage: getSeverityTier(scores.engageScore, {
      medium: 15,
      high: 30,
      extreme: 50,
    }),
    dive: getSeverityTier(scores.diveScore, {
      medium: 12,
      high: 24,
      extreme: 42,
    }),
    cc: getSeverityTier(scores.ccScore, {
      medium: 16,
      high: 32,
      extreme: 52,
    }),
  };
  const teamStyle = getTeamStyle({
    profiles,
    scores,
    tankCount,
    squishyCount,
  });

  return {
    damageProfile: {
      adCount,
      apCount,
      heavyAD: adCount >= 3,
      heavyAP: apCount >= 3,
      mixedDamage: adCount >= 2 && apCount >= 2,
    },

    durabilityProfile: {
      tankCount,
      bruiserCount,
      squishyCount,
      mrTier: tiers.mr,
      armorTier: tiers.armor,
      hpTier: tiers.hp,
      mrStacking: isTierAtLeast(tiers.mr, "medium"),
      hardMRStacking: isTierAtLeast(tiers.mr, "high"),
      armorStacking: isTierAtLeast(tiers.armor, "medium"),
      hpStacking: isTierAtLeast(tiers.hp, "medium"),
      hardFrontline: tankCount + bruiserCount >= 3,
      squishyTeam: squishyCount >= 3 && tankCount <= 1,
    },

    threatProfile: {
      ccTier: tiers.cc,
      engageTier: tiers.engage,
      diveTier: tiers.dive,
      shieldTier: tiers.shields,
      heavyCC: isTierAtLeast(tiers.cc, "high"),
      heavyEngage: isTierAtLeast(tiers.engage, "high"),
      diveThreat: isTierAtLeast(tiers.dive, "high"),
      shieldHeavy: isTierAtLeast(tiers.shields, "high"),
    },

    itemSignals,
    scores,
    tiers,
    teamStyle,
  };
};

const getOwnedFlags = (currentItems = []) => ({
  shadowflame: hasItemByName(currentItems, "Shadowflame"),
  stormsurge: hasItemByName(currentItems, "Stormsurge"),
  deathcap: hasItemByName(currentItems, "Rabadon's Deathcap"),
  voidStaff: hasItemByName(currentItems, "Void Staff"),
  cryptbloom: hasItemByName(currentItems, "Cryptbloom"),
  zhonyas: hasItemByName(currentItems, "Zhonya's Hourglass"),
  banshee: hasItemByName(currentItems, "Banshee's Veil"),
  liandry: hasItemByName(currentItems, "Liandry's Torment"),
  seraph: hasItemByName(currentItems, "Seraph's Embrace"),
  rylais: hasItemByName(currentItems, "Rylai's Crystal Scepter"),
  cosmic: hasItemByName(currentItems, "Cosmic Drive"),
  lichBane: hasItemByName(currentItems, "Lich Bane"),
  horizon: hasItemByName(currentItems, "Horizon Focus"),
});

const getBuildStage = (currentItems = [], buildProgress = null) => {
  const completedItems = currentItems.filter((item) => {
    const totalGold = item?.meta?.gold?.total || 0;
    return totalGold >= 2500;
  }).length;

  let inventoryStage = 1;
  if (completedItems === 2) inventoryStage = 2;
  if (completedItems === 3) inventoryStage = 3;
  if (completedItems >= 4) inventoryStage = 4;

  let coreStage = 1;
  if ((buildProgress?.completedCorePercentage || 0) >= 50) coreStage = 2;
  if ((buildProgress?.completedCorePercentage || 0) >= 75) coreStage = 3;
  if ((buildProgress?.completedCorePercentage || 0) >= 100) coreStage = 4;

  return Math.max(inventoryStage, coreStage);
};

const addReason = (reasons, condition, text) => {
  if (condition) reasons.push(text);
};

const scoreArchetypeFit = (championName, itemName) => {
  const rules = getArchetypeItemRules(championName);

  if (rules.preferred.includes(itemName)) return 18;
  if (rules.allowed.includes(itemName)) return 6;
  if (rules.avoid.includes(itemName)) return -28;

  return 0;
};

const PERCENT_MAGIC_PEN_ITEMS = new Set(["Void Staff", "Cryptbloom"]);
const ARMOR_COUNTER_ITEMS = new Set(["Black Cleaver"]);
const DEFENSIVE_COUNTER_ITEMS = new Set([
  "Banshee's Veil",
  "Zhonya's Hourglass",
  "Death's Dance",
  "Spirit Visage",
  "Maw of Malmortius",
  "Guardian Angel",
  "Thornmail",
  "Frozen Heart",
  "Kaenic Rookern",
  "Abyssal Mask",
]);
const ITEM_STRATEGIES = {
  "Void Staff": "penetration",
  Cryptbloom: "penetration_utility",
  "Black Cleaver": "penetration",
  "Banshee's Veil": "survival",
  "Zhonya's Hourglass": "survival",
  "Death's Dance": "survival",
  "Spirit Visage": "survival",
  "Maw of Malmortius": "survival",
  "Guardian Angel": "survival",
  Thornmail: "survival",
  "Frozen Heart": "survival",
  "Kaenic Rookern": "survival",
  "Abyssal Mask": "utility",
  "Rabadon's Deathcap": "greedy_damage",
  Shadowflame: "burst",
  Stormsurge: "burst",
  "Lich Bane": "burst",
  "Mejai's Soulstealer": "snowball",
  "Locket of the Iron Solari": "team_survival",
  "Knight's Vow": "ally_protection",
  "Zeke's Convergence": "utility",
};

const getBuildProgress = (championBuild, currentItems = []) => {
  const coreItems = championBuild?.core || [];
  const ownedCoreItems = coreItems.filter((itemName) =>
    hasItemByName(currentItems, itemName),
  );
  const missingCoreItems = coreItems.filter(
    (itemName) => !hasItemByName(currentItems, itemName),
  );
  const nextCoreItem = missingCoreItems[0] || null;
  const completedCorePercentage =
    coreItems.length > 0
      ? Math.round((ownedCoreItems.length / coreItems.length) * 100)
      : 0;

  return {
    ownedCoreItems,
    missingCoreItems,
    nextCoreItem,
    completedCorePercentage,
  };
};

const isExtremeEnemyAnswer = (itemName, enemyAnalysis) => {
  const { tiers } = enemyAnalysis;

  if (PERCENT_MAGIC_PEN_ITEMS.has(itemName)) {
    return tiers.mr === "extreme";
  }

  if (ARMOR_COUNTER_ITEMS.has(itemName)) {
    return tiers.armor === "extreme";
  }

  if (DEFENSIVE_COUNTER_ITEMS.has(itemName)) {
    return (
      tiers.cc === "extreme" ||
      tiers.engage === "extreme" ||
      tiers.dive === "extreme"
    );
  }

  return false;
};

const getBuildStageAdjustment = ({
  itemName,
  championBuild,
  buildStage,
  buildProgress,
  enemyAnalysis,
}) => {
  const coreItems = championBuild?.core || [];
  const situationalItems = championBuild?.situational || [];
  const coreIndex = coreItems.indexOf(itemName);
  const isCore = coreIndex >= 0;
  const isSituational = situationalItems.includes(itemName);
  const isNextCore = buildProgress.nextCoreItem === itemName;
  const extremeEnemyAnswer = isExtremeEnemyAnswer(itemName, enemyAnalysis);
  const coreCompletion = buildProgress.completedCorePercentage;

  if (buildStage === 1) {
    if (isNextCore) {
      return {
        points: 100,
        reason: "Stage 1 prioritizes the next realistic core item.",
      };
    }

    if (isCore) {
      const nextCoreIndex = coreItems.indexOf(buildProgress.nextCoreItem);
      const distance =
        nextCoreIndex >= 0 ? Math.max(1, coreIndex - nextCoreIndex) : coreIndex;
      let points = Math.max(4, 30 - distance * 10);

      if (PERCENT_MAGIC_PEN_ITEMS.has(itemName) && !extremeEnemyAnswer) {
        points -= 55;
      }

      return {
        points,
        reason:
          points < 0
            ? "Stage 1 delays late penetration until core progression is established."
            : "Stage 1 still values core progression, but this is not the next core item.",
      };
    }

    if (isSituational) {
      return {
        points: extremeEnemyAnswer ? 5 : -30,
        reason: extremeEnemyAnswer
          ? "The enemy state is extreme enough to consider an early situational answer."
          : "Stage 1 delays situational items until core progression is established.",
      };
    }
  }

  if (buildStage === 2) {
    if (isNextCore) {
      return {
        points: coreCompletion >= 50 ? 32 : 40,
        reason: "Stage 2 still prioritizes the next core item.",
      };
    }

    if (isCore) {
      return {
        points: 18,
        reason: "Stage 2 continues to value core build progression.",
      };
    }

    if (isSituational) {
      return {
        points: 4,
        reason: "Stage 2 allows matchup needs to influence situational choices.",
      };
    }
  }

  if (buildStage >= 3) {
    if (isNextCore) {
      return {
        points: coreCompletion >= 75 ? 8 : 16,
        reason:
          "Most core items are complete, so this remains valuable without blocking matchup adaptation.",
      };
    }

    if (isCore) {
      return {
        points: 8,
        reason: "This remains a valid core item at the current build stage.",
      };
    }

    if (isSituational) {
      return {
        points: coreCompletion >= 75 ? 18 : 10,
        reason:
          "With most core items complete, matchup-specific options receive more weight.",
      };
    }
  }

  return {
    points: 0,
    reason: null,
  };
};

const getBuildQualityAdjustment = ({
  itemName,
  championBuild,
  itemLookup,
}) => {
  const item = itemLookup?.byName?.[normalizeText(itemName)];
  if (!item) {
    return { points: 0, reasons: [] };
  }

  let points = 0;
  const reasons = [];

  (championBuild?.preferredStats || []).forEach((statName) => {
    if (ITEM_STAT_MATCHERS[statName]?.(item)) {
      points += 3;
      reasons.push(`${itemName} supplies preferred ${statName.replaceAll("_", " ")}.`);
    }
  });

  (championBuild?.avoidedStats || []).forEach((statName) => {
    if (ITEM_STAT_MATCHERS[statName]?.(item)) {
      points -= 6;
      reasons.push(`${itemName} spends gold on avoided ${statName.replaceAll("_", " ")}.`);
    }
  });

  const itemStrategy = ITEM_STRATEGIES[itemName] || "core_progression";
  const playstyleMatches = {
    burst: ["burst", "assassination", "pick"],
    snowball: ["snowball", "assassination"],
    penetration: ["front_to_back", "scaling"],
    penetration_utility: ["front_to_back", "utility"],
    survival: ["dive", "front_to_back", "disengage"],
    team_survival: ["protect", "front_to_back", "teamfight"],
    ally_protection: ["protect", "enchant"],
    utility: ["utility", "control", "wombo"],
  }[itemStrategy] || [];

  if (
    (championBuild?.preferredPlaystyle || []).some((playstyle) =>
      playstyleMatches.includes(playstyle),
    )
  ) {
    points += 5;
    reasons.push(`${itemName} fits the champion's preferred playstyle.`);
  }

  return { points, reasons };
};

const getCounterStrategyAdjustment = (itemName, teamStyle) => {
  const primaryPoints =
    TEAM_STYLE_WEIGHTS[teamStyle?.primary]?.[itemName] || 0;
  const secondaryPoints =
    (TEAM_STYLE_WEIGHTS[teamStyle?.secondary]?.[itemName] || 0) * 0.5;
  const points = primaryPoints + secondaryPoints;

  return {
    points,
    reason:
      points > 0
        ? `${itemName} directly answers the enemy's ${teamStyle.primary.replaceAll("_", " ")} style.`
        : null,
  };
};

const getGameStateAdjustment = ({
  itemName,
  strategy,
  buildProgress,
  gameContext,
}) => {
  const phaseRules = GAME_STATE_WEIGHTS.phases[gameContext.phase];
  let points = 0;
  const reasons = [];

  if (
    itemName === buildProgress.nextCoreItem &&
    phaseRules?.core_progression
  ) {
    points += phaseRules.core_progression;
    reasons.push(
      `${gameContext.phase} game timing keeps core progression valuable.`,
    );
  }

  const performanceRules = GAME_STATE_WEIGHTS.performance;
  const addStrategyWeight = (rules, reason) => {
    const value = rules?.[strategy] || 0;
    points += value;
    if (value !== 0) reasons.push(reason);
  };

  if (gameContext.performance === "ahead") {
    addStrategyWeight(
      performanceRules.ahead,
      "Your current lead supports a greedier damage option.",
    );
  }

  if (gameContext.performance === "behind") {
    addStrategyWeight(
      performanceRules.behind,
      "Your current KDA favors a safer, defensive purchase.",
    );
  }

  if (gameContext.highDeaths) {
    addStrategyWeight(
      performanceRules.highDeaths,
      "High deaths increase the value of survival tools.",
    );
  }

  if (gameContext.highKills) {
    addStrategyWeight(
      performanceRules.highKills,
      "High kills support an aggressive snowball purchase.",
    );
  }

  return {
    points,
    reasons,
    enemyAnalysisMultiplier: phaseRules?.enemyAnalysisMultiplier || 1,
  };
};

const getEnemySnapshot = (enemyAnalysis) => {
  const signals = enemyAnalysis.itemSignals;

  return {
    allItemNames: (signals.items || [])
      .map((item) => item?.meta?.name || item?.displayName)
      .filter(Boolean),
    mrItemNames: signals.mrItemNames || [],
    armorItemNames: signals.armorItemNames || [],
    hpItemNames: signals.hpItemNames || [],
    shieldItemNames: signals.shieldItemNames || [],
    tiers: enemyAnalysis.tiers,
  };
};

const getNewValues = (current = [], previous = []) => {
  const previousCounts = previous.reduce((counts, value) => {
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});

  return current.filter((value) => {
    if ((previousCounts[value] || 0) > 0) {
      previousCounts[value] -= 1;
      return false;
    }
    return true;
  });
};

const detectEnemyItemDeltas = (previousSnapshot, currentSnapshot) => {
  if (!previousSnapshot) {
    return {
      newItems: [],
      newMRItems: [],
      newArmorItems: [],
      newHPItems: [],
      newShieldItems: [],
      keyDefensiveItems: [],
    };
  }

  const newItems = getNewValues(
    currentSnapshot.allItemNames,
    previousSnapshot.allItemNames,
  );

  const mrNames = new Set(currentSnapshot.mrItemNames);
  const armorNames = new Set(currentSnapshot.armorItemNames);
  const hpNames = new Set(currentSnapshot.hpItemNames);
  const shieldNames = new Set(currentSnapshot.shieldItemNames);

  return {
    newItems,
    newMRItems: newItems.filter((itemName) => mrNames.has(itemName)),
    newArmorItems: newItems.filter((itemName) => armorNames.has(itemName)),
    newHPItems: newItems.filter((itemName) => hpNames.has(itemName)),
    newShieldItems: newItems.filter((itemName) => shieldNames.has(itemName)),
    keyDefensiveItems: newItems.filter((itemName) =>
      KEY_DEFENSIVE_ITEMS.has(itemName),
    ),
  };
};

const scoreItem = ({
  itemName,
  championName,
  championBuild,
  archetype,
  enemyAnalysis,
  currentItems,
  owned,
  buildStage,
  buildProgress,
  itemLookup,
  previousRecommendation,
  gameContext,
}) => {
  const {
    durabilityProfile,
    threatProfile,
    damageProfile,
    itemSignals,
    tiers,
  } = enemyAnalysis;

  let score = 50;
  const reasonEntries = [];
  const scoreBreakdown = {
    base: 50,
    archetype: 0,
    buildStage: 0,
    coreBaseline: 0,
    synergy: 0,
    buildQuality: 0,
    counterStrategy: 0,
    gameState: 0,
    historyStability: 0,
    enemyAnalysis: 0,
    redundancy: 0,
  };

  const add = (points, reason, category = "enemyAnalysis") => {
    score += points;
    scoreBreakdown[category] = (scoreBreakdown[category] || 0) + points;
    if (reason) reasonEntries.push({ points, reason });
  };

  add(
    scoreArchetypeFit(championName, itemName),
    null,
    "archetype",
  );

  const stageAdjustment = getBuildStageAdjustment({
    itemName,
    championBuild,
    buildStage,
    buildProgress,
    enemyAnalysis,
  });
  add(stageAdjustment.points, stageAdjustment.reason, "buildStage");

  if (championBuild?.core?.includes(itemName)) {
    add(
      28,
      "This item is part of the champion's ordered core build.",
      "coreBaseline",
    );
  }

  if (championBuild?.situational?.includes(itemName)) {
    add(
      14,
      "This item is a realistic situational option for this champion.",
      "coreBaseline",
    );
  }

  if (championBuild?.avoid?.includes(itemName)) {
    return {
      item: itemName,
      score: -999,
      confidence: 0,
      reasons: ["This item is unrealistic for this champion and role."],
    };
  }

  if (hasItemByName(currentItems, itemName)) {
    return {
      item: itemName,
      score: -999,
      confidence: 0,
      reasons: ["Already owned."],
      scoreBreakdown,
    };
  }

  const synergyRule = championBuild?.synergy?.[itemName];
  const ownsSnowballComponent =
    hasItemByName(currentItems, "Dark Seal") ||
    hasItemByName(currentItems, "Mejai's Soulstealer");
  const synergyConditionMet =
    !synergyRule?.condition ||
    (synergyRule.condition === "snowball" &&
      (ownsSnowballComponent || enemyAnalysis.durabilityProfile.squishyTeam));

  if (synergyRule && synergyConditionMet) {
    add(synergyRule.score, synergyRule.reason, "synergy");
  }

  const buildQualityAdjustment = getBuildQualityAdjustment({
    itemName,
    championBuild,
    itemLookup,
  });
  add(
    buildQualityAdjustment.points,
    buildQualityAdjustment.reasons[0] || null,
    "buildQuality",
  );

  const counterStrategyAdjustment = getCounterStrategyAdjustment(
    itemName,
    enemyAnalysis.teamStyle,
  );
  add(
    counterStrategyAdjustment.points,
    counterStrategyAdjustment.reason,
    "counterStrategy",
  );

  const strategy = ITEM_STRATEGIES[itemName] || "core_progression";
  const gameStateAdjustment = getGameStateAdjustment({
    itemName,
    strategy,
    buildProgress,
    gameContext,
  });
  add(
    gameStateAdjustment.points,
    gameStateAdjustment.reasons[0] || null,
    "gameState",
  );

  if (
    previousRecommendation?.lastRecommendedItem === itemName &&
    previousRecommendation?.lastTargetItem === buildProgress.nextCoreItem
  ) {
    add(
      10,
      "This remains consistent with the previous recommendation.",
      "historyStability",
    );
  }

  if (championBuild?.archetype === "ad_diver") {
    if (itemName === "Black Cleaver" && isTierAtLeast(tiers.armor, "medium")) {
      const armorPoints = {
        medium: 18,
        high: 30,
        extreme: 42,
      }[tiers.armor];
      add(
        armorPoints,
        `Enemy armor is ${tiers.armor} through ${formatItemEvidence(itemSignals.armorItemNames, "multiple defensive items")}, increasing Black Cleaver's value.`,
      );
    }

    if (itemName === "Sundered Sky" && isTierAtLeast(tiers.hp, "high")) {
      add(
        tiers.hp === "extreme" ? 20 : 12,
        `Enemy health stacking is ${tiers.hp}, favoring a durable skirmishing pattern.`,
      );
    }

    if (
      ["Sterak's Gage", "Death's Dance"].includes(itemName) &&
      threatProfile.diveThreat
    ) {
      add(18, "Extra durability is valuable in committed dive fights.");
    }

    if (
      ["Spirit Visage", "Maw of Malmortius"].includes(itemName) &&
      damageProfile.heavyAP
    ) {
      add(24, "The enemy team has a heavy magic-damage profile.");
    }
  }

  if (championBuild?.archetype === "tank_engage_support") {
    if (
      ["Frozen Heart", "Thornmail"].includes(itemName) &&
      (damageProfile.heavyAD || isTierAtLeast(tiers.armor, "high"))
    ) {
      add(
        24,
        `The enemy physical profile is threatening, and ${formatItemEvidence(itemSignals.armorItemNames, "their builds")} signals extended physical fights.`,
      );
    }

    if (
      ["Kaenic Rookern", "Abyssal Mask"].includes(itemName) &&
      damageProfile.heavyAP
    ) {
      add(24, "Magic resistance is valuable against the enemy composition.");
    }

    if (
      itemName === "Locket of the Iron Solari" &&
      (threatProfile.heavyEngage || threatProfile.diveThreat)
    ) {
      add(20, "Locket helps the team survive enemy engage and dive.");
    }
  }

  switch (itemName) {
    case "Void Staff": {
      if (tiers.mr === "extreme") {
        add(
          44,
          `Enemy frontline owns ${formatItemEvidence(itemSignals.mrItemNames, "several MR items")}, making percentage magic penetration extremely valuable.`,
        );
      } else if (tiers.mr === "high") {
        add(
          32,
          `Enemy champions have built ${formatItemEvidence(itemSignals.mrItemNames, "multiple MR items")}, making percentage magic penetration highly valuable.`,
        );
      } else if (tiers.mr === "medium") {
        add(
          20,
          `Enemy champions are adding magic resistance through ${formatItemEvidence(itemSignals.mrItemNames, "their current builds")}.`,
        );
      }

      if (durabilityProfile.hardFrontline) {
        add(12, "Enemy has multiple durable frontline champions.");
      }

      if (durabilityProfile.squishyTeam && !durabilityProfile.mrStacking) {
        add(
          -18,
          "Enemy team is still mostly squishy, so flat burst is likely better.",
        );
      }

      if (buildStage <= 1 && !durabilityProfile.hardMRStacking) {
        add(
          -12,
          "Void Staff is usually not ideal too early unless MR is already a real problem.",
        );
      }

      break;
    }

    case "Cryptbloom": {
      if (tiers.mr === "extreme") {
        add(
          32,
          `Enemy MR from ${formatItemEvidence(itemSignals.mrItemNames, "multiple items")} makes penetration necessary; Cryptbloom adds utility.`,
        );
      } else if (tiers.mr === "high") {
        add(
          24,
          `Enemy MR from ${formatItemEvidence(itemSignals.mrItemNames, "multiple items")} makes percentage penetration valuable.`,
        );
      } else if (tiers.mr === "medium") {
        add(14, "Enemy MR is high enough for percentage penetration to matter.");
      }

      if (durabilityProfile.hardFrontline) {
        add(8, "Extended fights make Cryptbloom more attractive.");
      }

      if (owned.voidStaff) {
        add(
          -35,
          "You already have Void Staff, so another percentage penetration item is redundant.",
        );
      }

      break;
    }

    case "Shadowflame": {
      if (durabilityProfile.squishyTeam) {
        add(24, "Enemy team has multiple squishy targets that can be bursted.");
      }

      if (!durabilityProfile.mrStacking) {
        add(12, "Enemy MR is low enough for flat burst to stay valuable.");
      }

      if (isTierAtLeast(tiers.shields, "high")) {
        add(
          tiers.shields === "extreme" ? 12 : 8,
          `Enemy shielding from ${formatItemEvidence(itemSignals.shieldItemNames, "champion kits and shield items")} increases the value of reliable execute pressure.`,
        );
      }

      if (durabilityProfile.hardMRStacking) {
        add(
          -26,
          "Enemy MR stacking makes Void Staff more important than flat burst.",
        );
      }

      if (durabilityProfile.hardFrontline && !durabilityProfile.squishyTeam) {
        add(
          -14,
          "Enemy team is too durable for pure burst to be the main answer.",
        );
      }

      break;
    }

    case "Stormsurge": {
      if (durabilityProfile.squishyTeam) {
        add(18, "Good tempo burst item into squishy teams.");
      }

      if (buildStage <= 2) {
        add(8, "Earlier stages favor cheaper burst tempo.");
      }

      if (durabilityProfile.mrStacking || durabilityProfile.hardFrontline) {
        add(
          -22,
          "Stormsurge loses value when enemies are too durable or stacking MR.",
        );
      }

      break;
    }

    case "Rabadon's Deathcap": {
      if (buildStage >= 2) {
        add(
          24,
          "You have enough items for Rabadon's to become a strong AP multiplier.",
        );
      }

      if (buildStage <= 1) {
        add(-28, "Rabadon's is usually too greedy this early.");
      }

      if (
        durabilityProfile.hardMRStacking &&
        !owned.voidStaff &&
        !owned.cryptbloom
      ) {
        add(
          -22,
          "Enemy MR is not solved yet, so penetration should usually come first.",
        );
      }

      if (
        !threatProfile.diveThreat &&
        !threatProfile.heavyCC &&
        !threatProfile.heavyEngage
      ) {
        add(10, "No urgent defensive problem is forcing a safer item.");
      }

      break;
    }

    case "Zhonya's Hourglass": {
      if (isTierAtLeast(tiers.dive, "high")) {
        add(
          tiers.dive === "extreme" ? 40 : 30,
          `Enemy dive pressure is ${tiers.dive}; stasis can deny committed all-ins.`,
        );
      }

      if (damageProfile.heavyAD) {
        add(16, "Enemy damage profile is AD-heavy, so armor has extra value.");
      }

      if (isTierAtLeast(tiers.engage, "high")) {
        add(
          tiers.engage === "extreme" ? 20 : 14,
          `Enemy engage pressure is ${tiers.engage}, creating frequent stasis windows.`,
        );
      }

      if (archetype.secondary.includes("anti_dive")) {
        add(10, "Your champion archetype benefits from anti-dive tools.");
      }

      if (threatProfile.heavyCC && !threatProfile.diveThreat) {
        add(-6, "If CC/pick is the main issue, Banshee may be cleaner.");
      }

      break;
    }

    case "Banshee's Veil": {
      if (isTierAtLeast(tiers.cc, "high")) {
        add(
          tiers.cc === "extreme" ? 38 : 28,
          `Enemy crowd control is ${tiers.cc}; the spell shield protects key engage and escape windows.`,
        );
      }

      if (isTierAtLeast(tiers.engage, "high")) {
        add(
          tiers.engage === "extreme" ? 24 : 18,
          `Enemy engage pressure is ${tiers.engage}, so blocking the first spell has high value.`,
        );
      }

      if (damageProfile.heavyAP) {
        add(16, "Enemy damage profile is AP-heavy, so MR has extra value.");
      }

      if (threatProfile.diveThreat && !threatProfile.heavyCC) {
        add(
          -10,
          "If enemies are diving through you, Zhonya is usually stronger.",
        );
      }

      break;
    }

    case "Liandry's Torment": {
      if (durabilityProfile.hpStacking) {
        add(24, "Enemy HP stacking increases Liandry value.");
      }

      if (durabilityProfile.hardFrontline) {
        add(
          20,
          "Multiple tanks/bruisers make sustained burn damage more valuable.",
        );
      }

      if (archetype.primary === "battlemage") {
        add(24, "Battlemages can keep Liandry ticking in extended fights.");
      }

      if (archetype.primary === "mobile_burst") {
        add(
          -34,
          "Mobile burst champions usually lose identity when forced into Liandry.",
        );
      }

      if (durabilityProfile.squishyTeam) {
        add(-18, "Enemy team is squishy, so burst items are usually better.");
      }

      break;
    }

    case "Seraph's Embrace": {
      if (
        archetype.primary === "battlemage" ||
        archetype.secondary.includes("scaling")
      ) {
        add(18, "Scaling/mana-heavy mages can use Seraph well.");
      }

      if (threatProfile.diveThreat) {
        add(8, "The shield helps against burst and dive.");
      }

      if (archetype.primary === "mobile_burst") {
        add(
          -30,
          "Mobile burst champions usually do not want slow mana scaling.",
        );
      }

      break;
    }

    case "Rylai's Crystal Scepter": {
      if (archetype.primary === "battlemage") {
        add(16, "Battlemages can apply Rylai repeatedly.");
      }

      if (durabilityProfile.hardFrontline) {
        add(10, "Slows help kite durable melee champions.");
      }

      if (archetype.primary.includes("burst")) {
        add(
          -22,
          "Burst mages usually prefer damage or defensive utility over Rylai.",
        );
      }

      break;
    }

    case "Cosmic Drive": {
      if (archetype.primary === "battlemage") {
        add(16, "Battlemages value movement and repeated spell uptime.");
      }

      if (threatProfile.diveThreat) {
        add(6, "Movement speed can help kite dive champions.");
      }

      if (archetype.primary === "mobile_burst") {
        add(-14, "Burst assassins usually prefer direct damage spikes.");
      }

      break;
    }

    case "Lich Bane": {
      if (archetype.primary === "mobile_burst") {
        add(18, "Mobile burst champions can use spellblade patterns well.");
      }

      if (durabilityProfile.hardFrontline) {
        add(
          -16,
          "Spellblade burst is weaker when the enemy frontline is too durable.",
        );
      }

      break;
    }

    case "Horizon Focus": {
      if (archetype.primary === "poke_mage") {
        add(20, "Long-range poke mages use Horizon Focus well.");
      }

      if (durabilityProfile.squishyTeam) {
        add(8, "Extra burst amplification is good into squishy targets.");
      }

      break;
    }

    default:
      break;
  }

  if (owned.voidStaff && itemName === "Cryptbloom") {
    add(-40, "Void Staff already covers percentage penetration.", "redundancy");
  }
  if (owned.cryptbloom && itemName === "Void Staff") {
    add(-30, "Cryptbloom already covers percentage penetration.", "redundancy");
  }
  if (owned.zhonyas && itemName === "Banshee's Veil") {
    add(-8, null, "redundancy");
  }
  if (owned.banshee && itemName === "Zhonya's Hourglass") {
    add(-8, null, "redundancy");
  }

  if (gameStateAdjustment.enemyAnalysisMultiplier !== 1) {
    const originalEnemyScore = scoreBreakdown.enemyAnalysis;
    const adjustedEnemyScore = Math.round(
      originalEnemyScore * gameStateAdjustment.enemyAnalysisMultiplier,
    );
    score += adjustedEnemyScore - originalEnemyScore;
    scoreBreakdown.enemyAnalysis = adjustedEnemyScore;
  }
  const confidence = clamp(Math.round(score), 0, 100);
  const reasons = reasonEntries
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
    .map((entry) => entry.reason)
    .slice(0, 4);

  return {
    item: itemName,
    score,
    confidence,
    reasons,
    strategy,
    scoreBreakdown,
  };
};

const explainAvoids = ({ scored }) => {
  return scored
    .filter((item) => item.score > 0)
    .slice(-3)
    .map((item) => ({
      item: item.item,
      reason: item.reasons[0] || "Lower value in the current game state.",
    }));
};

const selectStrategicAlternatives = (scored, best, limit = 3) => {
  const alternatives = [];
  const usedStrategies = new Set([best?.strategy]);
  const strongestAlternativeScore = scored[1]?.score ?? -Infinity;
  const diversityScoreFloor = strongestAlternativeScore - 35;

  scored.slice(1).forEach((item) => {
    if (
      alternatives.length < limit &&
      item.score >= diversityScoreFloor &&
      !usedStrategies.has(item.strategy)
    ) {
      alternatives.push(item);
      usedStrategies.add(item.strategy);
    }
  });

  scored.slice(1).forEach((item) => {
    if (
      alternatives.length < limit &&
      !alternatives.some((alternative) => alternative.item === item.item)
    ) {
      alternatives.push(item);
    }
  });

  return alternatives;
};

const getConfidenceBand = (value) => {
  if (value >= 85) return "Very High";
  if (value >= 70) return "High";
  if (value >= 50) return "Medium";
  return "Low";
};

const calculateRecommendationConfidence = ({
  scored,
  buildProgress,
  enemyAnalysis,
}) => {
  const scoreGap = Math.max(0, (scored[0]?.score || 0) - (scored[1]?.score || 0));
  const progressionCertainty =
    scored[0]?.item === buildProgress.nextCoreItem
      ? 35
      : buildProgress.completedCorePercentage >= 75
        ? 22
        : 12;
  const strongestEnemyTier = Math.max(
    ...Object.values(enemyAnalysis.tiers).map((tier) => SEVERITY_RANK[tier]),
  );
  const enemySignalStrength = [4, 10, 18, 25][strongestEnemyTier] || 4;
  const value = clamp(
    Math.round(25 + Math.min(scoreGap, 30) + progressionCertainty + enemySignalStrength),
    0,
    100,
  );

  return {
    value,
    band: getConfidenceBand(value),
    scoreGap: Math.round(scoreGap),
    progressionCertainty,
    enemySignalStrength,
  };
};

const getBuildPathProgress = ({
  championBuild,
  buildProgress,
  buildStage,
  targetItem,
}) => {
  const targetIndex = championBuild?.core?.indexOf(targetItem) ?? -1;
  const nextTargetItem =
    targetIndex >= 0
      ? championBuild.core[targetIndex + 1] || null
      : buildProgress.nextCoreItem;
  const phases = {
    1: "early_core",
    2: "core_completion",
    3: "adaptive_late_build",
    4: "final_slots",
  };

  return {
    currentTargetItem: targetItem,
    nextTargetItem,
    currentBuildPhase: phases[buildStage] || "adaptive_late_build",
    completedBuildPercentage: buildProgress.completedCorePercentage,
  };
};

const getRecommendationChange = ({
  previousRecommendation,
  currentItem,
  buildProgress,
  gameContext,
  enemyAnalysis,
  enemyItemDeltas,
}) => {
  const previousItem = previousRecommendation?.lastRecommendedItem || null;
  const changed = Boolean(previousItem && previousItem !== currentItem);
  const reasons = [];
  const signalLabels = {
    mr: "MR",
    armor: "armor",
    hp: "HP",
    shields: "shielding",
    engage: "engage",
    dive: "dive",
    cc: "CC",
  };

  if (!changed) {
    return {
      changed: false,
      previousItem,
      currentItem,
      reasons,
    };
  }

  const previousTiers = previousRecommendation?.enemySnapshot?.tiers || {};
  Object.entries(enemyAnalysis.tiers).forEach(([signal, currentTier]) => {
    const previousTier = previousTiers[signal];
    if (
      previousTier &&
      previousTier !== currentTier &&
      SEVERITY_RANK[currentTier] > SEVERITY_RANK[previousTier]
    ) {
      reasons.push(
        `Enemy ${signalLabels[signal] || signal} crossed from ${previousTier} to ${currentTier}.`,
      );
    }
  });

  enemyItemDeltas.keyDefensiveItems.slice(0, 2).forEach((itemName) => {
    reasons.push(`Enemy completed ${itemName}.`);
  });

  const previousCoreItems = previousRecommendation?.ownedCoreItems || [];
  const newlyOwnedCoreItems = buildProgress.ownedCoreItems.filter(
    (itemName) => !previousCoreItems.includes(itemName),
  );
  newlyOwnedCoreItems.slice(0, 2).forEach((itemName) => {
    reasons.push(
      `You completed ${itemName}, so ${buildProgress.nextCoreItem || "a situational item"} is now the next build target.`,
    );
  });

  const previousPhase = previousRecommendation?.gamePhase;
  if (previousPhase && previousPhase !== gameContext.phase) {
    reasons.push(
      `Game reached ${gameContext.phase} phase, changing build priorities.`,
    );
  }

  if (
    previousRecommendation?.performance &&
    previousRecommendation.performance !== gameContext.performance
  ) {
    reasons.push(
      `Your game state changed from ${previousRecommendation.performance} to ${gameContext.performance}.`,
    );
  }

  if (reasons.length === 0) {
    reasons.push(
      "The combined build progression and enemy threat scores now favor a different item.",
    );
  }

  return {
    changed,
    previousItem,
    currentItem,
    reasons: reasons.slice(0, 4),
  };
};

const getNextItemRecommendation = ({
  championName,
  role,
  enemyPlayers = [],
  currentItems = [],
  currentGold = 0,
  itemDatabase = {},
  historyKey,
  persistHistory = true,
  gameContext = {},
}) => {
  const enemyAnalysis = analyzeEnemyTeam(enemyPlayers);
  const normalizedGameContext = normalizeGameContext({
    ...gameContext,
    currentGold,
  });
  const archetype = getChampionArchetype(championName);
  const resolvedRole = resolveRole(championName, role);
  const championBuild = getChampionBuild({
    championName,
    role: resolvedRole,
  });
  const candidateItems = getChampionCandidates({
    championName,
    role: resolvedRole,
  });
  const owned = getOwnedFlags(currentItems);
  const buildProgress = getBuildProgress(championBuild, currentItems);
  const buildStage = getBuildStage(currentItems, buildProgress);
  const itemLookup = createItemLookup(itemDatabase);
  const previousRecommendation = getRecommendationHistory(historyKey);
  const enemySnapshot = getEnemySnapshot(enemyAnalysis);
  const enemyItemDeltas = detectEnemyItemDeltas(
    previousRecommendation?.enemySnapshot,
    enemySnapshot,
  );

  if (!championBuild || candidateItems.length === 0) {
    return {
      best: {
        item: null,
        confidence: 0,
        reason: `No supported build exists for ${championName} ${resolvedRole || "UNKNOWN"}.`,
        reasons: [],
        score: 0,
      },
      alternatives: [],
      avoidForNow: [],
      debug: {
        buildStage,
        candidatePool: candidateItems,
        completedCorePercentage: buildProgress.completedCorePercentage,
        ownedCoreItems: buildProgress.ownedCoreItems,
        missingCoreItems: buildProgress.missingCoreItems,
        nextCoreItem: buildProgress.nextCoreItem,
        enemyScores: enemyAnalysis.scores,
        enemyTiers: enemyAnalysis.tiers,
        teamStyle: enemyAnalysis.teamStyle,
      },
    };
  }

  const scored = candidateItems.map((itemName) =>
    scoreItem({
      itemName,
      championName,
      championBuild,
      archetype,
      enemyAnalysis,
      currentItems,
      owned,
      buildStage,
      buildProgress,
      itemLookup,
      previousRecommendation,
      gameContext: normalizedGameContext,
    }),
  )
    .filter((item) => item.score > -900)
    .sort((a, b) => b.score - a.score);

  const best = scored[0] || {
    item: "Elixir / situational slot upgrade",
    confidence: 0,
    reasons: ["No clear next item found."],
  };
  const alternatives = selectStrategicAlternatives(scored, best);
  const confidence = calculateRecommendationConfidence({
    scored,
    buildProgress,
    enemyAnalysis,
  });
  const buildPath = getBuildPathProgress({
    championBuild,
    buildProgress,
    buildStage,
    targetItem: best.item,
  });
  const recommendedComponent = getRecommendedComponent({
    targetItemName: best.item,
    currentGold,
    currentItems,
    itemDatabase,
  });
  const recommendationChange = getRecommendationChange({
    previousRecommendation,
    currentItem: best.item,
    buildProgress,
    gameContext: normalizedGameContext,
    enemyAnalysis,
    enemyItemDeltas,
  });

  if (persistHistory && historyKey && best.item) {
    setRecommendationHistory(historyKey, {
      lastRecommendedItem: best.item,
      lastTargetItem: buildProgress.nextCoreItem,
      enemySnapshot,
      ownedCoreItems: buildProgress.ownedCoreItems,
      gamePhase: normalizedGameContext.phase,
      performance: normalizedGameContext.performance,
    });
  }

  return {
    best: {
      item: best.item,
      confidence: confidence.value,
      confidenceBand: confidence.band,
      reason: best.reasons[0] || "Highest overall score for this game state.",
      reasons: best.reasons,
      score: Math.round(best.score),
    },

    alternatives: alternatives.map((item) => ({
      item: item.item,
      confidence: item.confidence,
      confidenceBand: getConfidenceBand(item.confidence),
      reason: item.reasons[0] || "Good alternative depending on preference.",
      reasons: item.reasons,
      score: Math.round(item.score),
    })),

    component: recommendedComponent,
    buildPath,
    recommendationChange,
    avoidForNow: explainAvoids({ scored }),

    debug: {
      buildStage,
      candidatePool: candidateItems,
      nextCoreItem: buildProgress.nextCoreItem,
      ownedCoreItems: buildProgress.ownedCoreItems,
      missingCoreItems: buildProgress.missingCoreItems,
      completedCorePercentage: buildProgress.completedCorePercentage,
      candidateScores: scored.map((item) => ({
        item: item.item,
        score: Math.round(item.score),
        strategy: item.strategy,
        scoreBreakdown: item.scoreBreakdown,
      })),
      enemyScores: enemyAnalysis.scores,
      enemyTiers: enemyAnalysis.tiers,
      teamStyle: enemyAnalysis.teamStyle,
      buildPath,
      currentGold,
      gameContext: normalizedGameContext,
      recommendedComponent,
      enemyItemDeltas,
      recommendationChange,
      recommendationConfidence: confidence,
      recommendationHistory: {
        previous: previousRecommendation,
        current: {
          lastRecommendedItem: best.item,
          lastTargetItem: buildProgress.nextCoreItem,
          gamePhase: normalizedGameContext.phase,
          performance: normalizedGameContext.performance,
        },
      },
    },
  };
};

const getAPMidBuildAdvice = ({
  championName,
  role,
  enemyPlayers = [],
  currentItems = [],
  currentGold = 0,
  itemDatabase = {},
  historyKey,
  persistHistory = true,
  gameContext = {},
}) => {
  const resolvedRole = resolveRole(championName, role);
  const championBuild = getChampionBuild({
    championName,
    role: resolvedRole,
  });
  const archetype = getChampionArchetype(championName);
  const enemyAnalysis = analyzeEnemyTeam(enemyPlayers);
  const nextItem = getNextItemRecommendation({
    championName,
    role: resolvedRole,
    enemyPlayers,
    currentItems,
    currentGold,
    itemDatabase,
    historyKey,
    persistHistory,
    gameContext,
  });
  const normalizedGameContext = normalizeGameContext({
    ...gameContext,
    currentGold,
  });

  return {
    championName,
    role: resolvedRole,
    championBuild,
    archetype,
    enemyAnalysis,
    currentItems,
    currentGold,
    gameTime: normalizedGameContext.gameTime,
    level: normalizedGameContext.level,
    kills: normalizedGameContext.kills,
    deaths: normalizedGameContext.deaths,
    assists: normalizedGameContext.assists,
    gamePhase: normalizedGameContext.phase,
    recommendationChange: nextItem.recommendationChange,
    nextItem,
  };
};

const getBuildAdvice = getAPMidBuildAdvice;

module.exports = {
  analyzeEnemyTeam,
  getBuildAdvice,
  getAPMidBuildAdvice,
  getNextItemRecommendation,
  getRecommendedComponent,
  normalizeGameContext,
};
