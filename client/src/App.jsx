import React, { useCallback, useEffect, useState } from "react";
import { fetchAdvice, fetchPlayers } from "./api.js";
import EnemyInventory from "./components/EnemyInventory.jsx";
import ItemDetailsPanel from "./components/ItemDetailsPanel.jsx";
import MockScenarioManager from "./components/MockScenarioManager.jsx";
import SuggestedItemCard from "./components/SuggestedItemCard.jsx";

const POLL_INTERVAL_MS = 2000;

const App = () => {
  const [myPlayer, setMyPlayer] = useState(null);
  const [enemyPlayers, setEnemyPlayers] = useState([]);
  const [advice, setAdvice] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playersError, setPlayersError] = useState("");
  const [adviceError, setAdviceError] = useState("");

  const refresh = useCallback(async () => {
    const [playersResult, adviceResult] = await Promise.allSettled([
      fetchPlayers(),
      fetchAdvice(),
    ]);

    if (playersResult.status === "fulfilled") {
      setMyPlayer(playersResult.value.myPlayer || null);
      setEnemyPlayers(playersResult.value.enemyPlayers || []);
      setPlayersError("");
    } else {
      setPlayersError(
        playersResult.reason?.message || "Could not load player inventory",
      );
    }

    if (adviceResult.status === "fulfilled") {
      setAdvice(adviceResult.value.advice || null);
      setAdviceError("");
    } else {
      setAdviceError(
        adviceResult.reason?.message || "Could not load recommendation",
      );
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const initialRefresh = setTimeout(refresh, 0);
    const interval = setInterval(refresh, POLL_INTERVAL_MS);

    return () => {
      clearTimeout(initialRefresh);
      clearInterval(interval);
    };
  }, [refresh]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <main className="mx-auto max-w-7xl px-6 py-8">
        <h1 className="mb-2 text-3xl font-bold text-red-400">
          League Item Coach
        </h1>
        <p className="mb-8 text-sm text-slate-400">
          Live recommendation and enemy inventory
        </p>

        <MockScenarioManager onScenarioChange={refresh} />

        <SuggestedItemCard
          myPlayer={myPlayer}
          advice={advice}
          onSelectItem={setSelectedItem}
        />

        {adviceError && (
          <div className="mb-6 rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
            Recommendation unavailable: {adviceError}
          </div>
        )}

        {loading && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            Loading live game data...
          </div>
        )}

        {!loading && playersError && (
          <div className="rounded-2xl border border-red-900 bg-red-950/40 p-6 text-red-300">
            Player inventory unavailable: {playersError}
          </div>
        )}

        {!loading && !playersError && !myPlayer && (
          <div className="mb-6 rounded-2xl border border-yellow-900 bg-yellow-950/30 p-4 text-yellow-200">
            Could not identify the current player.
          </div>
        )}

        {!loading && !playersError && enemyPlayers.length === 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-300">
            No enemy players found.
          </div>
        )}

        {!loading && !playersError && enemyPlayers.length > 0 && (
          <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <EnemyInventory
              enemyPlayers={enemyPlayers}
              onSelectItem={setSelectedItem}
            />
            <ItemDetailsPanel selectedItem={selectedItem} />
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
