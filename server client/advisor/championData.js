const AP_MID_ARCHETYPES = {
  LeBlanc: { primary: "mobile_burst", secondary: ["pick", "snowball"] },
  Ahri: { primary: "mobile_burst", secondary: ["pick", "utility"] },
  Syndra: { primary: "burst_control", secondary: ["pick", "scaling"] },
  Orianna: { primary: "burst_control", secondary: ["teamfight", "scaling"] },
  Viktor: { primary: "scaling_control", secondary: ["aoe", "front_to_back"] },
  Anivia: {
    primary: "scaling_control",
    secondary: ["zone_control", "anti_dive"],
  },
  Cassiopeia: { primary: "battlemage", secondary: ["dps", "anti_tank"] },
  Ryze: { primary: "battlemage", secondary: ["dps", "scaling"] },
  Ziggs: { primary: "poke_mage", secondary: ["siege", "aoe"] },
  Xerath: { primary: "poke_mage", secondary: ["siege", "long_range"] },
  Veigar: { primary: "burst_control", secondary: ["pick", "scaling"] },
  Annie: { primary: "burst_control", secondary: ["pick"] },
  Taliyah: { primary: "burst_control", secondary: ["pick", "roam"] },
};

const DEFAULT_ARCHETYPE = {
  primary: "burst_control",
  secondary: [],
};

const ENEMY_CHAMPION_PROFILES = {
  Ornn: {
    classes: ["tank", "engage"],
    damageType: "mixed",
    cc: 3,
    engage: 3,
    shield: 0,
    dive: 1,
  },
  Nautilus: {
    classes: ["tank", "engage", "pick"],
    damageType: "ap",
    cc: 3,
    engage: 3,
    shield: 1,
    dive: 1,
  },
  Vi: {
    classes: ["fighter", "engage", "dive"],
    damageType: "ad",
    cc: 2,
    engage: 3,
    shield: 1,
    dive: 3,
  },
  Jinx: {
    classes: ["marksman", "squishy"],
    damageType: "ad",
    cc: 1,
    engage: 0,
    shield: 0,
    dive: 0,
  },
  Syndra: {
    classes: ["mage", "burst", "pick", "squishy"],
    damageType: "ap",
    cc: 2,
    engage: 0,
    shield: 0,
    dive: 0,
  },
  Ahri: {
    classes: ["mage", "pick", "mobile", "squishy"],
    damageType: "ap",
    cc: 1,
    engage: 1,
    shield: 0,
    dive: 1,
  },
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
  return AP_MID_ARCHETYPES[championName] || DEFAULT_ARCHETYPE;
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
  AP_MID_ARCHETYPES,
  DEFAULT_ARCHETYPE,
  ENEMY_CHAMPION_PROFILES,
  ARCHETYPE_ITEM_RULES,
  getChampionArchetype,
  getEnemyChampionProfile,
  getArchetypeItemRules,
};
