const CHAMPION_BUILDS = {
  LeBlanc: {
    MIDDLE: {
      archetype: "mobile_burst",
      core: ["Luden's Companion", "Shadowflame", "Rabadon's Deathcap", "Void Staff"],
      situational: ["Banshee's Veil", "Stormsurge", "Cryptbloom", "Lich Bane"],
      avoid: ["Liandry's Torment", "Rylai's Crystal Scepter", "Cosmic Drive"],
      source: "seed"
    }
  },

  Briar: {
    JUNGLE: {
      archetype: "ad_diver",
      core: ["Stridebreaker", "Sundered Sky", "Black Cleaver", "Sterak's Gage"],
      situational: ["Death's Dance", "Spirit Visage", "Maw of Malmortius", "Guardian Angel"],
      avoid: [],
      source: "seed"
    }
  },

  Veigar: {
    MIDDLE: {
      archetype: "scaling_burst",
      core: ["Rod of Ages", "Seraph's Embrace", "Rabadon's Deathcap", "Void Staff"],
      situational: ["Zhonya's Hourglass", "Banshee's Veil", "Cryptbloom", "Shadowflame"],
      avoid: ["Liandry's Torment", "Rylai's Crystal Scepter"],
      source: "seed"
    }
  },

  Leona: {
    UTILITY: {
      archetype: "tank_engage_support",
      core: ["Celestial Opposition", "Locket of the Iron Solari", "Knight's Vow", "Zeke's Convergence"],
      situational: ["Thornmail", "Frozen Heart", "Kaenic Rookern", "Abyssal Mask"],
      avoid: [],
      source: "seed"
    }
  },

  Evelynn: {
    JUNGLE: {
      archetype: "ap_assassin_jungle",
      core: ["Lich Bane", "Sorcerer's Shoes", "Shadowflame", "Rabadon's Deathcap", "Void Staff"],
      situational: ["Banshee's Veil", "Zhonya's Hourglass", "Cryptbloom", "Mejai's Soulstealer"],
      avoid: ["Liandry's Torment", "Rylai's Crystal Scepter", "Cosmic Drive"],
      source: "seed"
    }
  }
};

const getChampionBuild = ({ championName, role }) => {
  return CHAMPION_BUILDS[championName]?.[role] || null;
};

module.exports = {
  CHAMPION_BUILDS,
  getChampionBuild,
};
