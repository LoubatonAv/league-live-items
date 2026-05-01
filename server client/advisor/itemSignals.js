const normalizeText = (value = "") => value.toLowerCase();

const includesAny = (text, values) => {
  const normalized = normalizeText(text);
  return values.some((value) => normalized.includes(normalizeText(value)));
};

const getItemName = (item) => {
  return item?.meta?.name || item?.displayName || "";
};

const getItemStats = (item) => {
  return item?.meta?.stats || {};
};

const getStatValue = (item, key) => {
  return getItemStats(item)?.[key] || 0;
};

const flattenEnemyItems = (enemyPlayers = []) => {
  return enemyPlayers.flatMap((player) => player.items || []);
};

const MR_NAME_HINTS = [
  "Null-Magic Mantle",
  "Negatron Cloak",
  "Spectre's Cowl",
  "Force of Nature",
  "Spirit Visage",
  "Abyssal Mask",
  "Kaenic",
  "Wit's End",
  "Mercury's Treads",
];

const HP_NAME_HINTS = [
  "Ruby Crystal",
  "Giant's Belt",
  "Sunfire",
  "Warmog",
  "Heartsteel",
  "Hollow Radiance",
  "Sterak",
];

const SHIELD_NAME_HINTS = ["Locket", "Sterak", "Seraph", "Maw", "Shieldbow"];

const ARMOR_NAME_HINTS = [
  "Cloth Armor",
  "Chain Vest",
  "Plated Steelcaps",
  "Thornmail",
  "Dead Man's Plate",
  "Frozen Heart",
  "Randuin",
];

const isMRItem = (item) => {
  const name = getItemName(item);

  return (
    getStatValue(item, "FlatSpellBlockMod") > 0 ||
    includesAny(name, MR_NAME_HINTS)
  );
};

const isHPItem = (item) => {
  const name = getItemName(item);

  return (
    getStatValue(item, "FlatHPPoolMod") >= 150 ||
    includesAny(name, HP_NAME_HINTS)
  );
};

const isShieldItem = (item) => {
  const name = getItemName(item);
  return includesAny(name, SHIELD_NAME_HINTS);
};

const isArmorItem = (item) => {
  const name = getItemName(item);

  return (
    getStatValue(item, "FlatArmorMod") > 0 ||
    includesAny(name, ARMOR_NAME_HINTS)
  );
};

const countItems = (items, predicate) => {
  return items.filter(predicate).length;
};

const sumItems = (items, selector) => {
  return items.reduce((sum, item) => sum + selector(item), 0);
};

const getItemSignals = (enemyPlayers = []) => {
  const items = flattenEnemyItems(enemyPlayers);

  const totalMRItems = countItems(items, isMRItem);
  const totalHPItems = countItems(items, isHPItem);
  const totalShieldItems = countItems(items, isShieldItem);
  const totalArmorItems = countItems(items, isArmorItem);

  const totalMR = sumItems(items, (item) =>
    getStatValue(item, "FlatSpellBlockMod"),
  );
  const totalHP = sumItems(items, (item) =>
    getStatValue(item, "FlatHPPoolMod"),
  );
  const totalArmor = sumItems(items, (item) =>
    getStatValue(item, "FlatArmorMod"),
  );

  return {
    items,
    totalMRItems,
    totalHPItems,
    totalShieldItems,
    totalArmorItems,
    totalMR,
    totalHP,
    totalArmor,
  };
};

module.exports = {
  flattenEnemyItems,
  getItemSignals,
  getItemName,
  getItemStats,
  getStatValue,
  isMRItem,
  isHPItem,
  isShieldItem,
  isArmorItem,
};
