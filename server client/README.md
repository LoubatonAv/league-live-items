# League Live Item Advisor

Node/Express service for League of Legends live item recommendations. The service can read mock game data or Riot Live Client Data and enrich items with Data Dragon metadata.

## Champion-role builds

Build definitions live in `data/builds/championBuilds.json`. Each champion can define one or more supported roles:

- `TOP`
- `JUNGLE`
- `MIDDLE`
- `BOTTOM`
- `UTILITY`

Every build contains:

- `archetype`: scoring category used by the advisor.
- `core`: ordered core progression. The first missing item becomes the next core item.
- `situational`: realistic matchup-dependent candidates.
- `avoid`: items that must never be recommended.
- `synergy`: optional champion-specific item score adjustments.
- `source`: current data provenance.

The build document is versioned with `schemaVersion`, `lastUpdated`, `source`,
and `sourceVersion`. Champion reference metadata is stored separately in
`data/champions/championMetadata.json`.

`advisor/championBuilds.js` loads the JSON and exposes:

- `getChampionBuild`
- `getDefaultRole`
- `getChampionCandidates`

The candidate pool is always limited to unique `core + situational` items, excluding avoided items.

## Role detection

`/api/advice` resolves role in this order:

1. Explicit `?role=` query parameter.
2. `currentPlayer.position` from Riot Live Client Data.
3. `currentPlayer.role` when supplied by compatible mock/input data.
4. The champion's default role from `championBuilds.json`.

The resolved role is returned in the existing advice response.

## Recommendation behavior

Recommendations combine:

1. Ordered champion-role core progression.
2. Current build stage and core completion percentage.
3. Champion-specific item synergy.
4. Enemy composition and enemy item analysis.

Enemy MR, armor, HP, shields, engage, dive, and crowd control are classified as `low`, `medium`, `high`, or `extreme`. Early builds strongly favor the next core item. Once most core items are complete, enemy analysis can override the default order more aggressively.

Recommendations are restricted to the champion-role candidate pool and exclude already-owned or avoided items.

When Data Dragon item metadata is available, the advisor also resolves the recommended item's recipe, checks current gold, and suggests the strongest affordable component purchase. The debug output includes the current target, following target, build phase, and completion percentage.

Enemy champion profiles are also classified into a primary team style such as `front_to_back`, `dive`, `pick`, `poke`, `wombo`, or `protect_the_carry`. Configurable counter-strategy weights adjust realistic candidates without bypassing champion-role pools.

Recommendation confidence is returned as both a numeric value and a `Very High`, `High`, `Medium`, or `Low` band. A small in-memory history bonus reduces recommendation flipping when the target build and game state have only changed slightly.

## Adding a champion build

Add a new champion and role entry to `data/builds/championBuilds.json`:

```json
{
  "ChampionName": {
    "MIDDLE": {
      "archetype": "burst_control",
      "core": ["First Core", "Second Core", "Third Core"],
      "situational": ["Defensive Option", "Penetration Option"],
      "avoid": ["Unrealistic Item"],
      "synergy": {},
      "source": "seed"
    }
  }
}
```

Use exact Data Dragon item names. Then run validation and inspect debug output. Importing or scraping builds is intentionally not implemented yet; importer TODOs are kept in the loader module.

## Offline build import and reports

`scripts/importBuilds.js` loads the current build file, normalizes metadata and
arrays, validates the schema, and writes a normalized build document. It does
not make external requests. LoLalytics, U.GG, and OP.GG adapters are TODO hooks
only.

Generated reports are written to `reports/`:

- `buildValidationReport.json`
- `championCoverageReport.json`
- `metaHealthReport.json`
- `recommendationSimulation.json`

Optional local telemetry can be enabled with:

```powershell
$env:RECOMMENDATION_TELEMETRY="true"
node server.js
```

Telemetry is stored in `data/telemetry/recommendations.jsonl`. No analytics
service is used.

## Development commands

```powershell
npm.cmd run debug:advice
npm.cmd run validate:builds
npm.cmd run import:builds
npm.cmd run meta:report
npm.cmd run simulate
npm.cmd run check
```

- `debug:advice` prints recommendation details for every supported champion-role build.
- `validate:builds` checks build structure and recommendation safety invariants.
- `check` runs JavaScript syntax validation, build validation, and the debug matrix.
- `import:builds` normalizes and validates the versioned build document.
- `meta:report` prints coverage and metadata health and writes JSON reports.
- `simulate` runs all supported champion-role recommendations for regression testing.

## Recommendation evaluation

Quality scenarios live in `data/scenarios/`. Each scenario declares the
champion-role, owned items, enemy composition and items, and acceptable
recommendation candidates.

```powershell
npm.cmd run scenario:test
npm.cmd run audit
```

- `scenario:test` compares actual recommendations with expectations, applies a
  small enemy-state perturbation, checks stability, and flags inconsistent
  high-confidence results.
- `audit` summarizes the strongest, weakest, unstable, and confidence-flagged
  recommendations from `reports/recommendationAccuracy.json`.
