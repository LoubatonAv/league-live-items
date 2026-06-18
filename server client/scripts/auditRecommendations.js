const fs = require("fs");
const path = require("path");

const workspaceRoot = path.resolve(__dirname, "..");
const reportPath = path.join(
  workspaceRoot,
  "reports",
  "recommendationAccuracy.json",
);

if (!fs.existsSync(reportPath)) {
  console.error("Missing recommendationAccuracy.json. Run npm run scenario:test.");
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const results = report.results || [];
const strongest = [...results]
  .filter((result) => result.pass)
  .sort((a, b) => b.confidence - a.confidence)
  .slice(0, 5);
const weakest = [...results]
  .sort((a, b) => {
    if (a.pass !== b.pass) return a.pass ? 1 : -1;
    return a.confidence - b.confidence;
  })
  .slice(0, 5);
const unstable = results.filter((result) => !result.stable);
const confidenceFlags = results.filter(
  (result) => result.confidenceInconsistent,
);

console.log("Strongest recommendations");
console.table(
  strongest.map((result) => ({
    scenario: result.scenario,
    recommendation: result.actual,
    confidence: `${result.confidence} ${result.confidenceBand}`,
  })),
);

console.log("Weakest recommendations");
console.table(
  weakest.map((result) => ({
    scenario: result.scenario,
    recommendation: result.actual,
    expected: result.expected.join(" | "),
    pass: result.pass,
    confidence: `${result.confidence} ${result.confidenceBand}`,
  })),
);

console.log("Unstable recommendations");
if (unstable.length === 0) {
  console.log("None");
} else {
  console.table(
    unstable.map((result) => ({
      scenario: result.scenario,
      original: result.actual,
      perturbed: result.perturbedActual,
    })),
  );
}

console.log("High-confidence inconsistencies");
if (confidenceFlags.length === 0) {
  console.log("None");
} else {
  console.table(confidenceFlags);
}

console.log(
  `Overall accuracy: ${report.summary.accuracy}% | Stable: ${report.summary.stable}/${report.summary.scenarioCount}`,
);
