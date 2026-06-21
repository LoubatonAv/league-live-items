const fs = require("fs");
const path = require("path");
const buildDocument = require("../data/builds/championBuilds.json");
const championMetadata = require("../data/champions/championMetadata.json");
const {
  SUPPORTED_ROLES,
  validateBuildDocument,
} = require("./lib/buildSchema");

const workspaceRoot = path.resolve(__dirname, "..");
const reportsDirectory = path.join(workspaceRoot, "reports");
const normalizedChampions = buildDocument.champions || {};
const supportedChampions = Object.keys(normalizedChampions).sort();
const supportedRoles = [
  ...new Set(
    Object.values(normalizedChampions).flatMap((roles) => Object.keys(roles)),
  ),
].sort();
const catalog = championMetadata.championCatalog || [];
const missingChampions = catalog.filter(
  (championName) => !supportedChampions.includes(championName),
);
const missingRoles = SUPPORTED_ROLES.filter(
  (role) => !supportedRoles.includes(role),
);
const validation = validateBuildDocument(buildDocument);
const roleBuildCounts = Object.fromEntries(
  SUPPORTED_ROLES.map((role) => [
    role,
    Object.values(normalizedChampions).filter((roles) => roles[role]).length,
  ]),
);
const report = {
  generatedAt: new Date().toISOString(),
  championCount: supportedChampions.length,
  roleCount: supportedRoles.length,
  buildCount: validation.summary.buildCount,
  lastUpdatedDates: [buildDocument.lastUpdated].filter(Boolean),
  schemaVersions: {
    builds: buildDocument.schemaVersion,
    championMetadata: championMetadata.schemaVersion,
  },
  validationStatus: validation.valid ? "valid" : "invalid",
  coverage: {
    supportedChampions,
    supportedRoles,
    missingChampions,
    missingRoles,
    roleBuildCounts,
  },
  validation,
};

fs.mkdirSync(reportsDirectory, { recursive: true });
fs.writeFileSync(
  path.join(reportsDirectory, "metaHealthReport.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
fs.writeFileSync(
  path.join(reportsDirectory, "championCoverageReport.json"),
  `${JSON.stringify(report.coverage, null, 2)}\n`,
);

console.table([
  {
    champions: report.championCount,
    roles: report.roleCount,
    builds: report.buildCount,
    schemaVersion: report.schemaVersions.builds,
    lastUpdated: buildDocument.lastUpdated,
    validation: report.validationStatus,
  },
]);
console.table(
  SUPPORTED_ROLES.map((role) => ({
    role,
    builds: roleBuildCounts[role],
    status: roleBuildCounts[role] > 0 ? "supported" : "missing",
  })),
);
console.log(JSON.stringify(report.coverage, null, 2));

if (!validation.valid) {
  process.exit(1);
}
