const fs = require("fs");
const path = require("path");

const telemetryEnabled = () => {
  return String(process.env.RECOMMENDATION_TELEMETRY || "").toLowerCase() ===
    "true";
};

const getTelemetryPath = () => {
  return path.resolve(
    process.cwd(),
    process.env.RECOMMENDATION_TELEMETRY_PATH ||
      "data/telemetry/recommendations.jsonl",
  );
};

const logRecommendationTelemetry = ({
  champion,
  role,
  enemyStyle,
  bestRecommendation,
  confidence,
}) => {
  if (!telemetryEnabled()) {
    return false;
  }

  try {
    const telemetryPath = getTelemetryPath();
    fs.mkdirSync(path.dirname(telemetryPath), { recursive: true });
    fs.appendFileSync(
      telemetryPath,
      `${JSON.stringify({
        timestamp: new Date().toISOString(),
        champion,
        role,
        enemyStyle,
        bestRecommendation,
        confidence,
      })}\n`,
    );
    return true;
  } catch (error) {
    console.error("Failed to write recommendation telemetry:", error.message);
    return false;
  }
};

module.exports = {
  telemetryEnabled,
  logRecommendationTelemetry,
};
