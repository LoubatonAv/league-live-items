const EnemyInventory = ({ enemyPlayers, onSelectItem }) => {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {enemyPlayers.map((player) => (
        <section
          key={`${player.summonerName}-${player.championName}`}
          className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg"
        >
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-white">
              {player.championName || "Unknown champion"}
            </h2>
            <p className="text-sm text-slate-400">
              {player.summonerName || "Unknown player"}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {(player.items || []).map((item) => (
              <button
                key={`${player.summonerName}-${item.slot}-${item.itemID}`}
                type="button"
                onClick={() => onSelectItem(item)}
                className="group rounded-xl border border-slate-800 bg-slate-950 p-2 text-left transition hover:border-red-500 hover:bg-slate-900"
              >
                <div className="mb-2 overflow-hidden rounded-lg border border-slate-700">
                  <img
                    src={item.iconUrl}
                    alt={item.displayName || "Item"}
                    className="h-14 w-14 object-cover"
                  />
                </div>
                <div className="truncate text-xs font-medium text-slate-200">
                  {item.displayName || "Unknown item"}
                </div>
                <div className="text-[11px] text-slate-500">
                  Slot {item.slot ?? "-"}
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default EnemyInventory;
