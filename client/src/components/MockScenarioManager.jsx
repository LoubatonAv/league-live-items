import { useEffect, useState } from "react";
import { fetchMockScenarios, selectMockScenario } from "../api.js";

const MockScenarioManager = ({ onScenarioChange }) => {
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState("");
  const [changingScenario, setChangingScenario] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMockScenarios()
      .then((result) => {
        setScenarios(result.scenarios || []);
        setSelectedScenario(result.selectedScenario || "");
      })
      .catch((requestError) => {
        setError(requestError.message || "Could not load mock scenarios");
      });
  }, []);

  const handleSelect = async (scenarioId) => {
    setChangingScenario(scenarioId);
    setError("");

    try {
      const result = await selectMockScenario(scenarioId);
      setSelectedScenario(result.selectedScenario);
      await onScenarioChange();
    } catch (requestError) {
      setError(requestError.message || "Could not change mock scenario");
    } finally {
      setChangingScenario("");
    }
  };

  return (
    <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-3">
        <h2 className="font-semibold text-slate-100">Mock Scenario</h2>
        <p className="text-xs text-slate-400">
          Changes apply immediately to players and advice.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {scenarios.map((scenario) => {
          const selected = selectedScenario === scenario.id;
          const changing = changingScenario === scenario.id;

          return (
            <button
              key={scenario.id}
              type="button"
              disabled={Boolean(changingScenario)}
              onClick={() => handleSelect(scenario.id)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition disabled:cursor-wait disabled:opacity-60 ${
                selected
                  ? "border-red-400 bg-red-500/20 text-red-200"
                  : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500"
              }`}
            >
              {changing ? "Switching..." : scenario.label}
            </button>
          );
        })}
      </div>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
    </section>
  );
};

export default MockScenarioManager;
