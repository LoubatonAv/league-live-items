const fs = require("fs");
const path = require("path");
const {
  normalizeBuildDocument,
  validateBuildDocument,
} = require("./lib/buildSchema");

const workspaceRoot = path.resolve(__dirname, "..");
const inputPath = path.resolve(
  workspaceRoot,
  process.argv[2] || "data/builds/championBuilds.json",
);
const outputPath = path.resolve(
  workspaceRoot,
  process.argv[3] || "data/builds/championBuilds.json",
);
const reportsDirectory = path.join(workspaceRoot, "reports");
const reportPath = path.join(reportsDirectory, "buildValidationReport.json");

// TODO(importer-lolalytics): Add a source adapter that returns raw build records.
// TODO(importer-ugg): Add a source adapter that returns raw build records.
// TODO(importer-opgg): Add a source adapter that returns raw build records.
// External requests are intentionally not implemented in this offline importer.

const rawDocument = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const normalizedDocument = normalizeBuildDocument(rawDocument);
const validationReport = validateBuildDocument(normalizedDocument);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.mkdirSync(reportsDirectory, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(normalizedDocument, null, 2)}\n`);
fs.writeFileSync(
  reportPath,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      inputPath,
      outputPath,
      ...validationReport,
    },
    null,
    2,
  )}\n`,
);

console.log("Build import complete.");
console.table([
  {
    schemaVersion: normalizedDocument.schemaVersion,
    champions: validationReport.summary.championCount,
    builds: validationReport.summary.buildCount,
    valid: validationReport.valid,
    output: path.relative(workspaceRoot, outputPath),
  },
]);
console.log(`Validation report: ${path.relative(workspaceRoot, reportPath)}`);

if (!validationReport.valid) {
  validationReport.errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
