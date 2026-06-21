const STAT_LABELS = {
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

const formatStats = (stats = {}) => {
  return Object.entries(stats)
    .filter(([, value]) => value && value !== 0)
    .map(([key, value]) => ({
      label: STAT_LABELS[key] || key,
      value,
    }));
};

const ItemDetailsPanel = ({ selectedItem }) => {
  const stats = formatStats(selectedItem?.meta?.stats);

  return (
    <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg">
      <h3 className="mb-4 text-lg font-semibold text-white">Item Details</h3>

      {!selectedItem ? (
        <p className="text-sm text-slate-400">
          Click an item to see its stats, gold, tags, and description.
        </p>
      ) : (
        <div>
          <div className="mb-4 flex items-center gap-4">
            <img
              src={selectedItem.iconUrl}
              alt={selectedItem.displayName || "Item"}
              className="h-16 w-16 rounded-xl border border-slate-700"
            />
            <div>
              <h4 className="text-xl font-bold text-white">
                {selectedItem.meta?.name ||
                  selectedItem.displayName ||
                  "Unknown item"}
              </h4>
              <p className="text-sm text-slate-400">
                Item ID: {selectedItem.itemID ?? "-"}
              </p>
            </div>
          </div>

          <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="mb-2 text-sm font-semibold text-slate-200">Gold</div>
            <div className="space-y-1 text-sm text-slate-300">
              <div>Total: {selectedItem.meta?.gold?.total ?? "-"}</div>
              <div>Base: {selectedItem.meta?.gold?.base ?? "-"}</div>
              <div>Sell: {selectedItem.meta?.gold?.sell ?? "-"}</div>
            </div>
          </div>

          <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="mb-2 text-sm font-semibold text-slate-200">Tags</div>
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
              {stats.length === 0 ? (
                <div className="text-slate-500">No raw stats found</div>
              ) : (
                stats.map((stat) => (
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
              {selectedItem.meta?.description || "No description available"}
            </p>
            {selectedItem.meta?.plainText && (
              <p className="mt-3 text-sm text-slate-400">
                {selectedItem.meta.plainText}
              </p>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};

export default ItemDetailsPanel;
