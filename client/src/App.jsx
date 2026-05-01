import React, { useEffect, useState } from "react";

const formatStats = (stats) => {
  if (!stats) return [];

  const statLabels = {
    FlatHPPoolMod: "Health",
    FlatMPPoolMod: "Mana",
    FlatPhysicalDamageMod: "Attack Damage",
    FlatMagicDamageMod: "Ability Power",
    FlatArmorMod: "Armor",
    FlatSpellBlockMod: "Magic Resist",
    FlatCritChanceMod: "Crit Chance",
    FlatAttackSpeedMod: "Attack Speed",
    PercentAttackSpeedMod: "Attack Speed %",
    FlatMovementSpeedMod: "Move Speed",
    PercentMovementSpeedMod: "Move Speed %",
    FlatHPRegenMod: "HP Regen",
    FlatMPRegenMod: "Mana Regen",
    FlatAbilityHasteMod: "Ability Haste",
    PercentLifeStealMod: "Life Steal",
    PercentOmnivampMod: "Omnivamp",
  };

  return Object.entries(stats)
    .filter(([, value]) => value && value !== 0)
    .map(([key, value]) => ({
      label: statLabels[key] || key,
      value,
    }));
};

const AP_MID_OPTIONS = [
  "LeBlanc",
  "Ahri",
  "Syndra",
  "Orianna",
  "Viktor",
  "Anivia",
  "Cassiopeia",
  "Ryze",
  "Ziggs",
  "Xerath",
  "Veigar",
  "Annie",
  "Taliyah",
];

const AdviceCard = ({ title, recommendation }) => {
  if (!recommendation) return null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <div className="mb-1 text-sm font-semibold text-slate-200">{title}</div>
      <div className="text-sm font-medium text-red-300">
        {recommendation.label}
      </div>
      <div className="mt-2 text-xs text-slate-500">
        Confidence: {Math.round((recommendation.confidence || 0) * 100)}%
      </div>
      <ul className="mt-3 space-y-1 text-sm text-slate-300">
        {(recommendation.reasons || []).map((reason) => (
          <li key={reason}>• {reason}</li>
        ))}
      </ul>
    </div>
  );
};

const SuggestedItemCard = ({ myPlayer, advice, onSelectItem }) => {
  if (!myPlayer || !advice?.nextItem?.best) return null;

  const best = advice.nextItem.best;
  const alternatives = advice.nextItem.alternatives || [];

  return (
    <div className="mb-6 rounded-2xl border border-red-900 bg-slate-900 p-5 shadow-lg">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-red-400">
            {myPlayer.championName} — Next Item
          </h2>
          <p className="text-sm text-slate-400">{myPlayer.summonerName}</p>
        </div>

        <div className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
          AP Mid Advisor
        </div>
      </div>

      <div className="mb-5">
        <div className="mb-2 text-sm font-semibold text-slate-300">
          Current Items
        </div>

        <div className="flex flex-wrap gap-3">
          {(myPlayer.items || []).map((item) => (
            <button
              key={`${item.itemID}-${item.slot}`}
              type="button"
              onClick={() => onSelectItem(item)}
              className="rounded-xl border border-slate-700 bg-slate-950 p-2 transition hover:border-red-500"
            >
              <img
                src={item.iconUrl}
                alt={item.displayName}
                className="h-14 w-14 rounded-lg"
              />
              <div className="mt-1 max-w-[72px] truncate text-[11px] text-slate-300">
                {item.displayName}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-red-800 bg-red-950/30 p-4">
        <div className="mb-2 text-sm font-semibold text-slate-300">
          Best now →
        </div>

        <div className="text-2xl font-bold text-red-300">{best.item}</div>

        <p className="mt-2 text-sm leading-6 text-slate-300">{best.reason}</p>
      </div>

      {alternatives.length > 0 && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {alternatives.map((option) => (
            <div
              key={`${option.item}-${option.reason}`}
              className="rounded-xl border border-slate-800 bg-slate-950 p-4"
            >
              <div className="text-sm font-semibold text-slate-400">
                Alternative →
              </div>

              <div className="mt-1 text-lg font-bold text-white">
                {option.item}
              </div>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                {option.reason}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300">
          MR stacking:{" "}
          <span className="font-semibold text-white">
            {advice.enemyAnalysis?.durabilityProfile?.mrStacking ? "Yes" : "No"}
          </span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300">
          HP stacking:{" "}
          <span className="font-semibold text-white">
            {advice.enemyAnalysis?.durabilityProfile?.hpStacking ? "Yes" : "No"}
          </span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300">
          Heavy engage:{" "}
          <span className="font-semibold text-white">
            {advice.enemyAnalysis?.threatProfile?.heavyEngage ? "Yes" : "No"}
          </span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300">
          Dive threat:{" "}
          <span className="font-semibold text-white">
            {advice.enemyAnalysis?.threatProfile?.diveThreat ? "Yes" : "No"}
          </span>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [myPlayer, setMyPlayer] = useState(null);
  const [enemyPlayers, setEnemyPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedChampion, setSelectedChampion] = useState("LeBlanc");
  const [advice, setAdvice] = useState(null);
  const [adviceError, setAdviceError] = useState("");

  const fetchEnemyPlayers = async () => {
    try {
      const response = await fetch("http://localhost:3001/api/players");

      if (!response.ok) {
        throw new Error("Failed to fetch players");
      }

      const data = await response.json();

      setEnemyPlayers(data.enemyPlayers || []);
      setMyPlayer(data.myPlayer || null);
      setError("");
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const fetchAdvice = async (championName) => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/advice?championName=${encodeURIComponent(
          championName,
        )}`,
      );

      if (!response.ok) {
        throw new Error("Failed to fetch advice");
      }

      const data = await response.json();
      setAdvice(data.advice || null);
      setAdviceError("");
    } catch (err) {
      setAdviceError(err.message || "Could not load advice");
    }
  };

  useEffect(() => {
    fetchEnemyPlayers();
    fetchAdvice(selectedChampion);

    const interval = setInterval(() => {
      fetchEnemyPlayers();
      fetchAdvice(selectedChampion);
    }, 2000);

    return () => clearInterval(interval);
  }, [selectedChampion]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <h1 className="mb-2 text-3xl font-bold text-red-400">
          Enemy Team Items
        </h1>

        <p className="mb-8 text-sm text-slate-400">
          Live tracker for enemy inventory
        </p>

        <SuggestedItemCard
          myPlayer={myPlayer}
          advice={advice}
          onSelectItem={setSelectedItem}
        />

        {!myPlayer && !loading && (
          <div className="mb-6 rounded-2xl border border-yellow-900 bg-yellow-950/30 p-4 text-yellow-200">
            Could not find my player. Check that <code>/api/players</code>{" "}
            returns a <code>myPlayer</code> object.
          </div>
        )}

        <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">
                AP Mid Champion
              </label>

              <select
                value={selectedChampion}
                onChange={(e) => setSelectedChampion(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none"
              >
                {AP_MID_OPTIONS.map((champion) => (
                  <option key={champion} value={champion}>
                    {champion}
                  </option>
                ))}
              </select>
            </div>

            {advice?.archetype && (
              <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300">
                Archetype:{" "}
                <span className="font-semibold text-red-300">
                  {advice.archetype.primary}
                </span>
              </div>
            )}

            {advice?.nextItem?.best && (
              <div className="rounded-xl border border-red-800 bg-red-950/40 p-4">
                <div className="text-sm text-slate-300">
                  Recommended Next Item
                </div>

                <div className="mt-1 text-xl font-bold text-red-400">
                  {advice.nextItem.best.item}
                </div>

                <div className="mt-2 text-sm text-slate-400">
                  {advice.nextItem.best.reason}
                </div>
              </div>
            )}
          </div>

          {adviceError && (
            <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
              {adviceError}
            </div>
          )}

          {advice && advice.recommendations && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <AdviceCard
                title="Chapter / First Core Direction"
                recommendation={advice.recommendations?.chapterItem}
              />
              <AdviceCard
                title="2nd Item Direction"
                recommendation={advice.recommendations?.secondItem}
              />
              <AdviceCard
                title="Deathcap vs % Pen"
                recommendation={advice.recommendations?.penetrationTiming}
              />
              <AdviceCard
                title="Defensive Timing"
                recommendation={advice.recommendations?.defensiveTiming}
              />
              <AdviceCard
                title="Boots"
                recommendation={advice.recommendations?.boots}
              />

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <div className="mb-2 text-sm font-semibold text-slate-200">
                  Enemy Analysis Snapshot
                </div>

                <div className="space-y-1 text-sm text-slate-300">
                  <div>
                    Heavy AD:{" "}
                    {advice.enemyAnalysis?.damageProfile?.heavyAD
                      ? "Yes"
                      : "No"}
                  </div>
                  <div>
                    Heavy AP:{" "}
                    {advice.enemyAnalysis?.damageProfile?.heavyAP
                      ? "Yes"
                      : "No"}
                  </div>
                  <div>
                    MR stacking:{" "}
                    {advice.enemyAnalysis?.durabilityProfile?.mrStacking
                      ? "Yes"
                      : "No"}
                  </div>
                  <div>
                    HP stacking:{" "}
                    {advice.enemyAnalysis?.durabilityProfile?.hpStacking
                      ? "Yes"
                      : "No"}
                  </div>
                  <div>
                    Heavy CC:{" "}
                    {advice.enemyAnalysis?.threatProfile?.heavyCC
                      ? "Yes"
                      : "No"}
                  </div>
                  <div>
                    Heavy Engage:{" "}
                    {advice.enemyAnalysis?.threatProfile?.heavyEngage
                      ? "Yes"
                      : "No"}
                  </div>
                  <div>
                    Dive Threat:{" "}
                    {advice.enemyAnalysis?.threatProfile?.diveThreat
                      ? "Yes"
                      : "No"}
                  </div>
                  <div>
                    Shield Heavy:{" "}
                    {advice.enemyAnalysis?.threatProfile?.shieldHeavy
                      ? "Yes"
                      : "No"}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {loading && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            Loading enemy team...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-900 bg-red-950/40 p-6 text-red-300">
            Error: {error}
          </div>
        )}

        {!loading && !error && enemyPlayers.length === 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
            No enemy players found.
          </div>
        )}

        {!loading && !error && enemyPlayers.length > 0 && (
          <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {enemyPlayers.map((player) => (
                <div
                  key={`${player.summonerName}-${player.championName}`}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg"
                >
                  <div className="mb-4">
                    <h2 className="text-xl font-semibold text-white">
                      {player.championName}
                    </h2>
                    <p className="text-sm text-slate-400">
                      {player.summonerName}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {player.items.map((item) => (
                      <button
                        key={`${player.summonerName}-${item.slot}-${item.itemID}`}
                        type="button"
                        onClick={() => setSelectedItem(item)}
                        className="group rounded-xl border border-slate-800 bg-slate-950 p-2 text-left transition hover:border-red-500 hover:bg-slate-900"
                      >
                        <div className="mb-2 overflow-hidden rounded-lg border border-slate-700">
                          <img
                            src={item.iconUrl}
                            alt={item.displayName}
                            className="h-14 w-14 object-cover"
                          />
                        </div>

                        <div className="truncate text-xs font-medium text-slate-200">
                          {item.displayName}
                        </div>

                        <div className="text-[11px] text-slate-500">
                          Slot {item.slot}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg">
              <h3 className="mb-4 text-lg font-semibold text-white">
                Item Details
              </h3>

              {!selectedItem && (
                <p className="text-sm text-slate-400">
                  Click an item to see its stats, gold, tags, and description.
                </p>
              )}

              {selectedItem && (
                <div>
                  <div className="mb-4 flex items-center gap-4">
                    <img
                      src={selectedItem.iconUrl}
                      alt={selectedItem.displayName}
                      className="h-16 w-16 rounded-xl border border-slate-700"
                    />

                    <div>
                      <h4 className="text-xl font-bold text-white">
                        {selectedItem.meta?.name || selectedItem.displayName}
                      </h4>

                      <p className="text-sm text-slate-400">
                        Item ID: {selectedItem.itemID}
                      </p>
                    </div>
                  </div>

                  <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <div className="mb-2 text-sm font-semibold text-slate-200">
                      Gold
                    </div>

                    <div className="space-y-1 text-sm text-slate-300">
                      <div>Total: {selectedItem.meta?.gold?.total ?? "-"}</div>
                      <div>Base: {selectedItem.meta?.gold?.base ?? "-"}</div>
                      <div>Sell: {selectedItem.meta?.gold?.sell ?? "-"}</div>
                    </div>
                  </div>

                  <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <div className="mb-2 text-sm font-semibold text-slate-200">
                      Tags
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(selectedItem.meta?.tags || []).length === 0 ? (
                        <span className="text-sm text-slate-500">No tags</span>
                      ) : (
                        selectedItem.meta.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-300"
                          >
                            {tag}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <div className="mb-2 text-sm font-semibold text-slate-200">
                      Stats
                    </div>

                    <div className="space-y-1 text-sm text-slate-300">
                      {formatStats(selectedItem.meta?.stats).length === 0 ? (
                        <div className="text-slate-500">No raw stats found</div>
                      ) : (
                        formatStats(selectedItem.meta?.stats).map((stat) => (
                          <div key={`${stat.label}-${stat.value}`}>
                            {stat.label}: {stat.value}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <div className="mb-2 text-sm font-semibold text-slate-200">
                      Description
                    </div>

                    <p className="whitespace-pre-line text-sm leading-6 text-slate-300">
                      {selectedItem.meta?.description ||
                        "No description available"}
                    </p>

                    {selectedItem.meta?.plainText && (
                      <p className="mt-3 text-sm text-slate-400">
                        {selectedItem.meta.plainText}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
