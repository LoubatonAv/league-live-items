const normalizeText = (value = "") => String(value).toLowerCase();

const createItemLookup = (itemDatabase = {}) => {
  const byId = itemDatabase;
  const byName = {};

  Object.values(itemDatabase).forEach((item) => {
    if (item?.name) {
      const key = normalizeText(item.name);
      const existing = byName[key];
      const isSummonersRiftItem = item.maps?.["11"] !== false;
      const existingIsSummonersRiftItem = existing?.maps?.["11"] !== false;

      if (
        !existing ||
        (isSummonersRiftItem && !existingIsSummonersRiftItem)
      ) {
        byName[key] = item;
      }
    }
  });

  return { byId, byName };
};

const getOwnedItemIds = (currentItems = []) => {
  return new Set(
    currentItems
      .map((item) => item?.meta?.id || item?.itemID)
      .filter(Boolean)
      .map(String),
  );
};

const collectBuildPath = (item, lookup, seen = new Set()) => {
  if (!item || seen.has(String(item.id))) {
    return [];
  }

  seen.add(String(item.id));

  return (item.from || []).flatMap((componentId) => {
    const component = lookup.byId[String(componentId)];
    if (!component) return [];

    return [
      {
        id: component.id,
        name: component.name,
        gold: component.gold?.total || 0,
        purchasable: component.gold?.purchasable !== false,
      },
      ...collectBuildPath(component, lookup, seen),
    ];
  });
};

const getRemainingCost = (item, lookup, ownedItemIds, seen = new Set()) => {
  if (!item || ownedItemIds.has(String(item.id))) {
    return 0;
  }

  if (seen.has(String(item.id)) || !(item.from || []).length) {
    return item.gold?.total || 0;
  }

  const nextSeen = new Set(seen);
  nextSeen.add(String(item.id));
  const componentCost = (item.from || []).reduce((sum, componentId) => {
    return (
      sum +
      getRemainingCost(
        lookup.byId[String(componentId)],
        lookup,
        ownedItemIds,
        nextSeen,
      )
    );
  }, 0);

  return (item.gold?.base || 0) + componentCost;
};

const getRecommendedComponent = ({
  targetItemName,
  currentGold = 0,
  currentItems = [],
  itemDatabase = {},
}) => {
  const lookup = createItemLookup(itemDatabase);
  const targetItem = lookup.byName[normalizeText(targetItemName)];

  if (!targetItem) {
    return null;
  }

  const ownedItemIds = getOwnedItemIds(currentItems);
  const directComponents = (targetItem.from || [])
    .map((componentId) => lookup.byId[String(componentId)])
    .filter(Boolean);
  const buildPath = collectBuildPath(targetItem, lookup);
  const purchaseCandidates = [
    ...directComponents,
    ...buildPath.map((component) => lookup.byId[String(component.id)]),
  ]
    .filter(Boolean)
    .filter((component) => component.gold?.purchasable !== false)
    .filter((component) => !ownedItemIds.has(String(component.id)));

  const affordableComponents = [
    ...new Map(
      purchaseCandidates
        .map((component) => ({
          item: component,
          remainingCost: getRemainingCost(
            component,
            lookup,
            ownedItemIds,
          ),
        }))
        .filter((component) => component.remainingCost <= currentGold)
        .map((component) => [String(component.item.id), component]),
    ).values(),
  ].sort((a, b) => b.remainingCost - a.remainingCost);

  const suggestedComponent = affordableComponents[0] || null;

  return {
    targetItem: targetItem.name,
    currentGold,
    suggestedPurchase: suggestedComponent
      ? {
          id: suggestedComponent.item.id,
          name: suggestedComponent.item.name,
          cost: suggestedComponent.remainingCost,
          iconUrl: suggestedComponent.item.iconUrl || null,
        }
      : null,
    affordablePurchases: affordableComponents.map(({ item, remainingCost }) => ({
      id: item.id,
      name: item.name,
      cost: remainingCost,
      iconUrl: item.iconUrl || null,
    })),
    componentPath: buildPath,
    reason: suggestedComponent
      ? `Fastest affordable path toward ${targetItem.name}.`
      : `Save gold for the next component toward ${targetItem.name}.`,
  };
};

module.exports = {
  createItemLookup,
  getRecommendedComponent,
};
