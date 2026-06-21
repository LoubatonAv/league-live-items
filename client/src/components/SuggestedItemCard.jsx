import RecommendationDebugPanel from "./RecommendationDebugPanel.jsx";

const formatLabel = (value, fallback = "Not available") => {
  if (!value) return fallback;
  return String(value).replaceAll("_", " ");
};

const ScoreFactorList = ({ factors, emptyMessage, tone }) => {
  if (!factors?.length) {
    return <p className="mt-2 text-sm text-slate-500">{emptyMessage}</p>;
  }

  const valueClass = tone === "negative" ? "text-red-300" : "text-emerald-300";

  return (
    <ul className="mt-2 space-y-2">
      {factors.map((factor, index) => (
        <li
          key={`${factor.source}-${factor.value}-${index}`}
          className="flex gap-3 text-sm"
        >
          <span className={`min-w-10 font-semibold ${valueClass}`}>
            {factor.value > 0 ? "+" : ""}
            {factor.value}
          </span>
          <span className="text-slate-400">{factor.impact}</span>
        </li>
      ))}
    </ul>
  );
};

const SuggestedItemCard = ({ myPlayer, advice, onSelectItem }) => {
  if (!myPlayer) return null;

  const nextItem = advice?.nextItem || {};
  const best = nextItem.best || {};
  const alternatives = nextItem.alternatives || [];
  const component = nextItem.component;
  const buildPath = nextItem.buildPath;
  const recommendationChange = nextItem.recommendationChange;
  const enemyStyle = advice?.enemyAnalysis?.teamStyle?.primary;
  const explanation = best.explanation || {};
  const confidence = best.confidenceBand
    ? `${best.confidenceBand}${typeof best.confidence === "number" ? ` - ${best.confidence}%` : ""}`
    : "Confidence unavailable";

  return (
    <section className="mb-6 rounded-2xl border border-red-900 bg-slate-900 p-5 shadow-lg">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            My Champion / Next Item
          </div>
          <h2 className="mt-1 text-2xl font-bold text-red-400">
            {myPlayer.championName || "Unknown champion"}
          </h2>
          <p className="text-sm text-slate-400">
            {myPlayer.summonerName || "Unknown player"}
          </p>
        </div>

        <div className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
          {advice?.role || "Role unknown"} Coach
        </div>
      </div>

      <div className="mb-5">
        <div className="mb-2 text-sm font-semibold text-slate-300">
          Current items
        </div>
        {(myPlayer.items || []).length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {myPlayer.items.map((item) => (
              <button
                key={`${item.itemID}-${item.slot}`}
                type="button"
                onClick={() => onSelectItem(item)}
                className="rounded-xl border border-slate-700 bg-slate-950 p-2 transition hover:border-red-500"
              >
                <img
                  src={item.iconUrl}
                  alt={item.displayName || "Item"}
                  className="h-14 w-14 rounded-lg"
                />
                <div className="mt-1 max-w-[72px] truncate text-[11px] text-slate-300">
                  {item.displayName || "Unknown item"}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No items detected yet.</p>
        )}
      </div>

      <div className="rounded-2xl border border-red-800 bg-red-950/30 p-4">
        <div className="text-sm font-semibold text-slate-300">Best buy now</div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div className="text-2xl font-bold text-red-300">
            {best.item || "Waiting for a recommendation"}
          </div>
          <span className="rounded-full border border-red-800 bg-red-950/50 px-3 py-1 text-xs font-semibold text-red-200">
            {confidence}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Building toward
          </div>
          <div className="mt-1 font-semibold text-white">
            {buildPath?.currentTargetItem || best.item || "Not available"}
          </div>
          {buildPath?.nextTargetItem && (
            <div className="mt-1 text-xs text-slate-400">
              Then {buildPath.nextTargetItem}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Buy this component
          </div>
          <div className="mt-1 font-semibold text-white">
            {component?.suggestedPurchase?.name || "Save for the next component"}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {component?.suggestedPurchase
              ? `${component.suggestedPurchase.cost ?? "?"} gold`
              : component?.reason || "Component data unavailable"}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Enemy style
          </div>
          <div className="mt-1 font-semibold capitalize text-white">
            {formatLabel(enemyStyle)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Game phase
          </div>
          <div className="mt-1 font-semibold capitalize text-white">
            {formatLabel(advice?.gamePhase)}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
        <div className="text-sm font-semibold text-slate-200">
          Why this recommendation?
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
              Top positive factors
            </div>
            <ScoreFactorList
              factors={explanation.positiveFactors}
              emptyMessage="No positive score adjustments are available."
              tone="positive"
            />
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-red-400">
              Top negative factors
            </div>
            <ScoreFactorList
              factors={explanation.negativeFactors}
              emptyMessage="No meaningful negative factors were detected."
              tone="negative"
            />
          </div>
        </div>

        <div className="mt-4 border-t border-slate-800 pt-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Confidence explanation
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            {explanation.confidence?.summary ||
              "Confidence reasoning is not available yet."}
          </p>
          <ScoreFactorList
            factors={explanation.confidence?.factors}
            emptyMessage="No confidence factors are available."
            tone="positive"
          />
        </div>
      </div>

      {recommendationChange?.changed && (
        <div className="mt-4 rounded-xl border border-amber-800 bg-amber-950/30 p-4">
          <div className="text-sm font-semibold text-amber-200">
            What changed?
          </div>
          <div className="mt-1 text-sm text-slate-300">
            {recommendationChange.previousItem || "Previous item"} to{" "}
            {recommendationChange.currentItem || best.item}
          </div>
          <ul className="mt-2 space-y-1 text-sm text-slate-400">
            {(recommendationChange.reasons || []).map((reason) => (
              <li key={reason}>- {reason}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <div className="mb-2 text-sm font-semibold text-slate-300">
          Alternatives
        </div>
        {alternatives.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {alternatives.map((option) => (
              <div
                key={`${option.item}-${option.reason}`}
                className="rounded-xl border border-slate-800 bg-slate-950 p-4"
              >
                <div className="font-semibold text-white">
                  {option.item || "Unknown item"}
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  {option.reason || "Alternative reasoning unavailable."}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-400">
            No alternatives are currently available.
          </div>
        )}
      </div>

      <RecommendationDebugPanel debug={nextItem.debug} />
    </section>
  );
};

export default SuggestedItemCard;
