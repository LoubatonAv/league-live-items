const buildDocument = require("../data/builds/championBuilds.json");

const SUPPORTED_ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
const CHAMPION_BUILDS = buildDocument.champions || buildDocument;
const BUILD_METADATA = {
  schemaVersion: buildDocument.schemaVersion || "legacy",
  lastUpdated: buildDocument.lastUpdated || null,
  source: buildDocument.source || "unknown",
  sourceVersion: buildDocument.sourceVersion || "unknown",
};

// TODO(importer-lolalytics): Map LoLalytics build exports into this schema.
// TODO(importer-ugg): Map U.GG build exports into this schema.
// TODO(importer-opgg): Map OP.GG build exports into this schema.
// TODO(importer): Validate imported item names against active Data Dragon data.

const getChampionBuild = ({ championName, role }) => {
  if (!SUPPORTED_ROLES.includes(role)) {
    return null;
  }

  return CHAMPION_BUILDS[championName]?.[role] || null;
};

const getDefaultRole = (championName) => {
  const roles = Object.keys(CHAMPION_BUILDS[championName] || {});
  return roles.find((role) => SUPPORTED_ROLES.includes(role)) || null;
};

const getChampionCandidates = ({ championName, role }) => {
  const build = getChampionBuild({ championName, role });

  if (!build) {
    return [];
  }

  const avoidedItems = new Set(build.avoid || []);

  return [
    ...new Set([
      ...(build.core || []),
      ...(build.situational || []),
    ]),
  ].filter((itemName) => !avoidedItems.has(itemName));
};

module.exports = {
  SUPPORTED_ROLES,
  CHAMPION_BUILDS,
  BUILD_METADATA,
  getChampionBuild,
  getDefaultRole,
  getChampionCandidates,
};
