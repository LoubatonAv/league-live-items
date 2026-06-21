const championMetadata = require("../data/champions/championMetadata.json");

const CHAMPION_ARCHETYPES = championMetadata.archetypes || {};
const ENEMY_CHAMPION_PROFILES = championMetadata.enemyProfiles || {};

const DEFAULT_ARCHETYPE = {
  primary: "burst_control",
  secondary: [],
};

const ARCHETYPE_ITEM_RULES = {
  mobile_burst: {
    preferred: [
      "Shadowflame",
      "Stormsurge",
      "Rabadon's Deathcap",
      "Void Staff",
      "Banshee's Veil",
      "Lich Bane",
    ],
    allowed: ["Cryptbloom", "Zhonya's Hourglass"],
    avoid: [
      "Liandry's Torment",
      "Rylai's Crystal Scepter",
      "Cosmic Drive",
      "Seraph's Embrace",
      "Rod of Ages",
      "Blackfire Torch",
    ],
  },
  burst_control: {
    preferred: [
      "Shadowflame",
      "Rabadon's Deathcap",
      "Void Staff",
      "Zhonya's Hourglass",
      "Banshee's Veil",
      "Stormsurge",
    ],
    allowed: ["Cryptbloom", "Seraph's Embrace"],
    avoid: ["Rylai's Crystal Scepter"],
  },
  scaling_control: {
    preferred: [
      "Rabadon's Deathcap",
      "Void Staff",
      "Zhonya's Hourglass",
      "Banshee's Veil",
      "Shadowflame",
    ],
    allowed: ["Seraph's Embrace", "Cryptbloom", "Liandry's Torment"],
    avoid: ["Stormsurge"],
  },
  battlemage: {
    preferred: [
      "Liandry's Torment",
      "Seraph's Embrace",
      "Rylai's Crystal Scepter",
      "Void Staff",
      "Rabadon's Deathcap",
      "Cosmic Drive",
    ],
    allowed: ["Zhonya's Hourglass", "Banshee's Veil", "Cryptbloom"],
    avoid: ["Stormsurge", "Lich Bane"],
  },
  poke_mage: {
    preferred: [
      "Shadowflame",
      "Void Staff",
      "Rabadon's Deathcap",
      "Horizon Focus",
    ],
    allowed: [
      "Zhonya's Hourglass",
      "Banshee's Veil",
      "Cryptbloom",
      "Liandry's Torment",
    ],
    avoid: ["Lich Bane", "Rylai's Crystal Scepter"],
  },
};

const getChampionArchetype = (championName) => {
  return CHAMPION_ARCHETYPES[championName] || DEFAULT_ARCHETYPE;
};

const getEnemyChampionProfile = (championName) => {
  return (
    ENEMY_CHAMPION_PROFILES[championName] || {
      classes: [],
      damageType: "mixed",
      cc: 0,
      engage: 0,
      shield: 0,
      dive: 0,
    }
  );
};

const getArchetypeItemRules = (championName) => {
  const archetype = getChampionArchetype(championName);
  return (
    ARCHETYPE_ITEM_RULES[archetype.primary] || {
      preferred: [],
      allowed: [],
      avoid: [],
    }
  );
};

module.exports = {
  CHAMPION_METADATA: championMetadata,
  CHAMPION_ARCHETYPES,
  DEFAULT_ARCHETYPE,
  ENEMY_CHAMPION_PROFILES,
  ARCHETYPE_ITEM_RULES,
  getChampionArchetype,
  getEnemyChampionProfile,
  getArchetypeItemRules,
};
