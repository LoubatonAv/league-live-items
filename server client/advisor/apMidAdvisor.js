const {
  getChampionArchetype,
  getEnemyChampionProfile,
  getArchetypeItemRules,
} = require("./championData");
const { getItemSignals } = require("./itemSignals");

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const normalizeText = (value = "") => value.toLowerCase();

const hasItemByName = (items = [], itemName) => {
  return items.some((item) => {
    const name = item?.meta?.name || item?.displayName || "";
    return normalizeText(name) === normalizeText(itemName);
  });
};

const analyzeEnemyTeam = (enemyPlayers = []) => {
  const itemSignals = getItemSignals(enemyPlayers);

  let adCount = 0;
  let apCount = 0;
  let tankCount = 0;
  let bruiserCount = 0;
  let squishyCount = 0;
  let ccScore = 0;
  let engageScore = 0;
  let shieldChampionScore = 0;
  let diveScore = 0;

  enemyPlayers.forEach((player) => {
    const profile = getEnemyChampionProfile(player.championName);

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

    ccScore += profile.cc;
    engageScore += profile.engage;
    shieldChampionScore += profile.shield;
    diveScore += profile.dive;
  });

  const scores = {
    adScore: adCount * 10,
    apScore: apCount * 10,
    tankScore: tankCount * 14 + bruiserCount * 7,
    squishyScore: squishyCount * 8,
    ccScore: ccScore * 4,
    engageScore: engageScore * 5,
    diveScore: diveScore * 5,
    shieldScore: shieldChampionScore * 4 + itemSignals.totalShieldItems * 4,
    mrScore: itemSignals.totalMR + itemSignals.totalMRItems * 10,
    hpScore:
      itemSignals.totalHP / 20 +
      itemSignals.totalHPItems * 8 +
      tankCount * 8 +
      bruiserCount * 5,
  };

  return {
    damageProfile: {
      adCount,
      apCount,
      heavyAD: adCount >= 3,
      heavyAP: apCount >= 3,
    },
    durabilityProfile: {
      tankCount,
      bruiserCount,
      squishyCount,
      mrStacking: scores.mrScore >= 45,
      hpStacking: scores.hpScore >= 28,
      squishyTeam: squishyCount >= 3 && tankCount <= 1,
    },
    threatProfile: {
      heavyCC: scores.ccScore >= 20,
      heavyEngage: scores.engageScore >= 20,
      diveThreat: scores.diveScore >= 15,
      shieldHeavy: scores.shieldScore >= 10,
    },
    itemSignals,
    scores,
  };
};

const getOwnedFlags = (currentItems = []) => {
  return {
    shadowflame: hasItemByName(currentItems, "Shadowflame"),
    stormsurge: hasItemByName(currentItems, "Stormsurge"),
    deathcap: hasItemByName(currentItems, "Rabadon's Deathcap"),
    voidStaff: hasItemByName(currentItems, "Void Staff"),
    cryptbloom: hasItemByName(currentItems, "Cryptbloom"),
    zhonyas: hasItemByName(currentItems, "Zhonya's Hourglass"),
    banshee: hasItemByName(currentItems, "Banshee's Veil"),
    liandry: hasItemByName(currentItems, "Liandry's Torment"),
    lichBane: hasItemByName(currentItems, "Lich Bane"),
  };
};

const getBuildStage = (currentItems = []) => {
  const completedItems = currentItems.filter((item) => {
    const totalGold = item?.meta?.gold?.total || 0;
    return totalGold >= 2500;
  }).length;

  if (completedItems <= 1) return 1;
  if (completedItems === 2) return 2;
  if (completedItems === 3) return 3;
  return 4;
};

const scoreCandidateForChampion = (championName, itemName) => {
  const rules = getArchetypeItemRules(championName);

  if (rules.preferred.includes(itemName)) return 3;
  if (rules.allowed.includes(itemName)) return 1;
  if (rules.avoid.includes(itemName)) return -3;
  return 0;
};

const rankCandidates = ({ championName, currentItems, candidates }) => {
  const unique = [];
  const seen = new Set();

  candidates.forEach((candidate) => {
    if (!candidate?.item) return;
    if (seen.has(candidate.item)) return;
    if (hasItemByName(currentItems, candidate.item)) return;

    seen.add(candidate.item);

    unique.push({
      ...candidate,
      fitScore: scoreCandidateForChampion(championName, candidate.item),
    });
  });

  unique.sort((a, b) => b.fitScore - a.fitScore);

  return unique;
};

const buildRecommendation = ({
  championName,
  currentItems,
  candidates,
  enemyAnalysis,
  archetype,
}) => {
  const ranked = rankCandidates({
    championName,
    currentItems,
    candidates,
  });

  const best = ranked[0] || {
    item: "Elixir / situational slot upgrade",
    reason:
      "No strong standard upgrade was found, so the next decision is very situational.",
  };

  return {
    best: {
      item: best.item,
      reason: best.reason,
    },
    alternatives: ranked.slice(1, 4).map((candidate) => ({
      item: candidate.item,
      reason: candidate.reason,
    })),
    enemySnapshot: enemyAnalysis,
    archetype,
  };
};

const getNextItemRecommendation = ({
  championName,
  enemyPlayers = [],
  currentItems = [],
}) => {
  const enemyAnalysis = analyzeEnemyTeam(enemyPlayers);
  const archetype = getChampionArchetype(championName);
  const owned = getOwnedFlags(currentItems);
  const buildStage = getBuildStage(currentItems);

  const { durabilityProfile, threatProfile } = enemyAnalysis;

  // Stage 1 = first situational slot after chapter item
  if (buildStage === 1) {
    // Safety only if it is truly urgent
    if (
      (threatProfile.heavyEngage ||
        threatProfile.diveThreat ||
        threatProfile.heavyCC) &&
      !durabilityProfile.squishyTeam
    ) {
      return buildRecommendation({
        championName,
        currentItems,
        enemyAnalysis,
        archetype,
        candidates: [
          {
            item: "Banshee's Veil",
            reason:
              "Situational first → enemy has dangerous engage / pick / CC, and this is the least awkward defensive pivot for burst mages.",
          },
          {
            item: "Zhonya's Hourglass",
            reason:
              "Situational defensive alternative if the danger is more dive/all-in than pick.",
          },
          {
            item: "Shadowflame",
            reason:
              "Skip defense and keep tempo if you are still free to play aggressively.",
          },
        ],
      });
    }

    if (durabilityProfile.hpStacking) {
      return buildRecommendation({
        championName,
        currentItems,
        enemyAnalysis,
        archetype,
        candidates: [
          {
            item: "Void Staff",
            reason:
              "Situational first → your champion may not want Liandry, so % pen is the cleaner anti-frontline pivot.",
          },
          {
            item: "Cryptbloom",
            reason:
              "Alternative % pen option if you want a softer anti-frontline spike.",
          },
          {
            item: "Shadowflame",
            reason:
              "Still fine if the frontline is not yet the part that matters most.",
          },
          {
            item: "Liandry's Torment",
            reason:
              "Generic anti-HP option, but mainly for battlemages and DOT users.",
          },
        ],
      });
    }

    return buildRecommendation({
      championName,
      currentItems,
      enemyAnalysis,
      archetype,
      candidates: [
        {
          item: "Shadowflame",
          reason:
            "Default first situational item → best when you can get away with greed damage and enemies are still burstable.",
        },
        {
          item: "Stormsurge",
          reason:
            "Cheaper/easier Shadowflame-style spike if you want tempo and burst.",
        },
        {
          item: "Banshee's Veil",
          reason:
            "Take this earlier only if enemy engage or pick tools are too dangerous to ignore.",
        },
      ],
    });
  }

  // Stage 2 = first Dcap/%pen slot
  if (buildStage === 2) {
    if (durabilityProfile.mrStacking && !owned.voidStaff) {
      return buildRecommendation({
        championName,
        currentItems,
        enemyAnalysis,
        archetype,
        candidates: [
          {
            item: "Void Staff",
            reason:
              "First % pen slot → enemy MR is high enough that this beats greedier raw AP.",
          },
          {
            item: "Cryptbloom",
            reason:
              "Alternative % pen option if your champion is fine taking the lighter version.",
          },
          {
            item: "Rabadon's Deathcap",
            reason:
              "Only better if enemy MR is still not actually slowing your damage enough.",
          },
        ],
      });
    }

    return buildRecommendation({
      championName,
      currentItems,
      enemyAnalysis,
      archetype,
      candidates: [
        {
          item: "Rabadon's Deathcap",
          reason:
            "First Dcap/%pen slot → default raw AP spike when MR is not yet forcing penetration.",
        },
        {
          item: "Void Staff",
          reason: "Take this instead if the next fight already feels MR-gated.",
        },
      ],
    });
  }

  // Stage 3 = second Dcap/%pen slot
  if (buildStage === 3) {
    if (!owned.deathcap) {
      return buildRecommendation({
        championName,
        currentItems,
        enemyAnalysis,
        archetype,
        candidates: [
          {
            item: "Rabadon's Deathcap",
            reason:
              "Second Dcap/%pen slot → if you already handled pen or didn’t need it yet, this is the cleanest scaling spike.",
          },
          {
            item: "Void Staff",
            reason:
              "Take this first only if enemy MR became the more urgent problem.",
          },
        ],
      });
    }

    if (!owned.voidStaff) {
      return buildRecommendation({
        championName,
        currentItems,
        enemyAnalysis,
        archetype,
        candidates: [
          {
            item: "Void Staff",
            reason:
              "Second Dcap/%pen slot → this becomes the natural late-game pickup once frontline MR matters.",
          },
          {
            item: "Cryptbloom",
            reason:
              "Alternative % pen item if it fits your champion better in this game.",
          },
        ],
      });
    }
  }

  // Stage 4+ = later situational slot
  if (
    (threatProfile.heavyEngage ||
      threatProfile.diveThreat ||
      threatProfile.heavyCC) &&
    !owned.banshee &&
    !owned.zhonyas
  ) {
    return buildRecommendation({
      championName,
      currentItems,
      enemyAnalysis,
      archetype,
      candidates: [
        {
          item: "Banshee's Veil",
          reason:
            "Late situational slot → enemy pick/engage threat is now valuable enough to justify defense.",
        },
        {
          item: "Zhonya's Hourglass",
          reason:
            "Alternative if the problem is hard dive and stall timing rather than spell shield value.",
        },
      ],
    });
  }

  if (durabilityProfile.hpStacking && !owned.voidStaff) {
    return buildRecommendation({
      championName,
      currentItems,
      enemyAnalysis,
      archetype,
      candidates: [
        {
          item: "Void Staff",
          reason:
            "Late situational slot → frontline durability is now the thing you need to solve most cleanly.",
        },
        {
          item: "Cryptbloom",
          reason: "Alternative if you want a softer % pen option.",
        },
        {
          item: "Liandry's Torment",
          reason:
            "Mostly a battlemage/DOT solution if your champion actually likes it.",
        },
      ],
    });
  }

  if (threatProfile.shieldHeavy && !owned.shadowflame) {
    return buildRecommendation({
      championName,
      currentItems,
      enemyAnalysis,
      archetype,
      candidates: [
        {
          item: "Shadowflame",
          reason:
            "Late situational slot → still valuable if shields and low-MR targets are common.",
        },
        {
          item: "Void Staff",
          reason:
            "Take this instead if the game is now more about MR than shields.",
        },
      ],
    });
  }

  return buildRecommendation({
    championName,
    currentItems,
    enemyAnalysis,
    archetype,
    candidates: [
      {
        item: "Banshee's Veil",
        reason:
          "Generic late situational fallback for burst/control mages when no stronger forced pivot exists.",
      },
      {
        item: "Void Staff",
        reason:
          "Safe late-game fallback if enemy frontline keeps getting harder to burst.",
      },
      {
        item: "Elixir / situational slot upgrade",
        reason:
          "Your main item skeleton is mostly complete, so the next decision is highly game-specific.",
      },
    ],
  });
};

const getAPMidBuildAdvice = ({
  championName,
  enemyPlayers = [],
  currentItems = [],
}) => {
  const archetype = getChampionArchetype(championName);
  const enemyAnalysis = analyzeEnemyTeam(enemyPlayers);
  const nextItem = getNextItemRecommendation({
    championName,
    enemyPlayers,
    currentItems,
  });

  return {
    championName,
    archetype,
    enemyAnalysis,
    currentItems,
    nextItem,
  };
};

module.exports = {
  analyzeEnemyTeam,
  getAPMidBuildAdvice,
  getNextItemRecommendation,
};
