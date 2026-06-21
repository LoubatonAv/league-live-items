const API_BASE_URL = "http://localhost:3001";

const fetchJson = async (path, options) => {
  const response = await fetch(`${API_BASE_URL}${path}`, options);

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Request failed (${response.status})`);
  }

  return response.json();
};

export const fetchPlayers = () => fetchJson("/api/players");
export const fetchAdvice = () => fetchJson("/api/advice");
export const fetchMockScenarios = () => fetchJson("/api/mock/scenarios");
export const selectMockScenario = (scenario) =>
  fetchJson("/api/mock/scenarios", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ scenario }),
  });
