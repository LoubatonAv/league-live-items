const formatLabel = (value, fallback = "Not available") => {
  if (!value) return fallback;
  return String(value).replaceAll("_", " ");
};

const RecommendationDebugPanel = ({ debug }) => {
  if (!debug) return null;

  const candidateScores = debug.candidateScores || [];
  const enemyTiers = debug.enemyTiers || {};
  const targetItem =
    debug.buildPath?.currentTargetItem || debug.nextCoreItem || "Not available";

  return (
    <details className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm">
      <summary className="cursor-pointer font-semibold text-slate-300">
        Development details
      </summary>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Build stage
          </div>
          <div className="mt-1 text-slate-200">
            {debug.buildStage ?? "Not available"}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Target item
          </div>
          <div className="mt-1 text-slate-200">{targetItem}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Enemy tiers
          </div>
          <div className="mt-1 text-slate-200">
            {Object.entries(enemyTiers)
              .map(([name, tier]) => `${formatLabel(name)}: ${tier}`)
              .join(" | ") || "Not available"}
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="text-slate-500">
            <tr>
              <th className="pb-2 pr-4">Candidate</th>
              <th className="pb-2 pr-4">Score</th>
              <th className="pb-2 pr-4">Strategy</th>
              <th className="pb-2">Score breakdown</th>
            </tr>
          </thead>
          <tbody className="text-slate-300">
            {candidateScores.map((candidate) => (
              <tr
                key={candidate.item}
                className="border-t border-slate-800 align-top"
              >
                <td className="py-2 pr-4 font-medium text-white">
                  {candidate.item}
                </td>
                <td className="py-2 pr-4">{candidate.score}</td>
                <td className="py-2 pr-4">
                  {formatLabel(candidate.strategy)}
                </td>
                <td className="py-2">
                  {Object.entries(candidate.scoreBreakdown || {})
                    .filter(([, score]) => score !== 0)
                    .map(
                      ([category, score]) =>
                        `${formatLabel(category)}: ${score > 0 ? "+" : ""}${score}`,
                    )
                    .join(" | ") || "No score adjustments"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
};

export default RecommendationDebugPanel;
