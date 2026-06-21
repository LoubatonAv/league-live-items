const API_BASE_URL = "http://localhost:3001";

const fetchJson = async (path) => {
  const response = await fetch(`${API_BASE_URL}${path}`);

  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }

  return response.json();
};

export const fetchPlayers = () => fetchJson("/api/players");
export const fetchAdvice = () => fetchJson("/api/advice");
