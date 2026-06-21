const SUPPORTED_ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
const CURRENT_SCHEMA_VERSION = "1.0.0";

const uniqueStrings = (values = []) => {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .filter((value) => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
};

const normalizeBuild = ({
  build,
  championName,
  role,
  documentMetadata,
}) => {
  return {
    role,
    archetype: String(build.archetype || "").trim(),
    preferredStats: uniqueStrings(build.preferredStats),
    avoidedStats: uniqueStrings(build.avoidedStats),
    preferredPlaystyle: uniqueStrings(build.preferredPlaystyle),
    core: uniqueStrings(build.core),
    situational: uniqueStrings(build.situational),
    avoid: uniqueStrings(build.avoid),
    synergy:
      build.synergy && typeof build.synergy === "object" ? build.synergy : {},
    source: build.source || documentMetadata.source,
    sourceVersion: build.sourceVersion || documentMetadata.sourceVersion,
    championName,
  };
};

const normalizeBuildDocument = (input, now = new Date().toISOString()) => {
  const rawChampions = input.champions || input;
  const documentMetadata = {
    schemaVersion: input.schemaVersion || CURRENT_SCHEMA_VERSION,
    lastUpdated: now,
    source: input.source || "manual-seed",
    sourceVersion: input.sourceVersion || "seed-1",
  };
  const champions = {};

  Object.keys(rawChampions)
    .filter((championName) => !["schemaVersion", "lastUpdated", "source", "sourceVersion"].includes(championName))
    .sort()
    .forEach((championName) => {
      const roles = rawChampions[championName] || {};
      champions[championName] = {};

      SUPPORTED_ROLES.filter((role) => roles[role]).forEach((role) => {
        champions[championName][role] = normalizeBuild({
          build: roles[role],
          championName,
          role,
          documentMetadata,
        });
      });
    });

  return {
    ...documentMetadata,
    champions,
  };
};

const validateBuildDocument = (document) => {
  const errors = [];
  const warnings = [];
  const buildRows = [];

  ["schemaVersion", "lastUpdated", "source", "sourceVersion"].forEach((field) => {
    if (!document[field]) {
      errors.push(`Document is missing ${field}`);
    }
  });

  if (!document.champions || typeof document.champions !== "object") {
    errors.push("Document is missing champions");
  }

  Object.entries(document.champions || {}).forEach(([championName, roles]) => {
    Object.entries(roles || {}).forEach(([role, build]) => {
      const prefix = `${championName} ${role}`;
      const buildErrors = [];

      if (!SUPPORTED_ROLES.includes(role)) {
        buildErrors.push("unsupported role");
      }
      if (build.role !== role) {
        buildErrors.push("role field does not match role key");
      }
      if (!build.archetype) {
        buildErrors.push("missing archetype");
      }
      if (!Array.isArray(build.core) || build.core.length === 0) {
        buildErrors.push("missing core items");
      }
      if (!Array.isArray(build.situational) || build.situational.length === 0) {
        buildErrors.push("missing situational items");
      }
      if (!Array.isArray(build.preferredStats) || build.preferredStats.length === 0) {
        buildErrors.push("missing preferred stats");
      }
      if (
        !Array.isArray(build.preferredPlaystyle) ||
        build.preferredPlaystyle.length === 0
      ) {
        buildErrors.push("missing preferred playstyle");
      }
      if (!build.source) {
        buildErrors.push("missing source");
      }

      buildErrors.forEach((error) => errors.push(`${prefix}: ${error}`));
      buildRows.push({
        champion: championName,
        role,
        valid: buildErrors.length === 0,
        errors: buildErrors,
      });
    });

    if (Object.keys(roles || {}).length === 0) {
      warnings.push(`${championName} has no supported roles`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    builds: buildRows,
    summary: {
      championCount: Object.keys(document.champions || {}).length,
      buildCount: buildRows.length,
      validBuildCount: buildRows.filter((build) => build.valid).length,
      invalidBuildCount: buildRows.filter((build) => !build.valid).length,
    },
  };
};

module.exports = {
  CURRENT_SCHEMA_VERSION,
  SUPPORTED_ROLES,
  normalizeBuildDocument,
  validateBuildDocument,
};
