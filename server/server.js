const express = require("express");
const cors = require("cors");
const axios = require("axios");
const https = require("https");
const fs = require("fs/promises");
const path = require("path");
const { getBuildAdvice, resolveRole } = require("./advisor/itemAdvisor");
const {
  logRecommendationTelemetry,
} = require("./advisor/recommendationTelemetry");

const app = express();
const PORT = 3001;
const MOCK_DATA_PATH = path.join(__dirname, "mockGameData.json");
const SCENARIOS_PATH = path.join(__dirname, "data", "scenarios");
const MOCK_SCENARIOS = {
  heavy_mr: { label: "Heavy MR", file: "heavy_mr.json" },
  heavy_hp: { label: "Heavy HP", file: "heavy_hp.json" },
  dive: { label: "Dive", file: "dive_comp.json" },
  poke: { label: "Poke", file: "poke_comp.json" },
  squishy: { label: "Squishy", file: "squishy_comp.json" },
  shield: { label: "Shield", file: "shield_comp.json" },
};
const SCENARIO_ITEM_ALIASES = {
  "Luden's Companion": 6655,
};

app.use(cors());
app.use(express.json());

const USE_MOCK = String(process.env.USE_MOCK || "").toLowerCase() === "true";
let selectedMockScenario = null;

const readMockData = async () => {
  let contents;

  try {
    contents = await fs.readFile(MOCK_DATA_PATH, "utf8");
  } catch (error) {
    const mockError = new Error(`Could not read ${MOCK_DATA_PATH}: ${error.message}`);
    mockError.code = "MOCK_DATA_READ_ERROR";
    throw mockError;
  }

  try {
    return JSON.parse(contents);
  } catch (error) {
    const mockError = new Error(
      `Invalid JSON in ${MOCK_DATA_PATH}: ${error.message}`,
    );
    mockError.code = "MOCK_DATA_INVALID_JSON";
    throw mockError;
  }
};

const readJsonFile = async (filePath, description) => {
  let contents;

  try {
    contents = await fs.readFile(filePath, "utf8");
  } catch (error) {
    const dataError = new Error(`Could not read ${description}: ${error.message}`);
    dataError.code = "MOCK_DATA_READ_ERROR";
    throw dataError;
  }

  try {
    return JSON.parse(contents);
  } catch (error) {
    const dataError = new Error(`Invalid JSON in ${description}: ${error.message}`);
    dataError.code = "MOCK_DATA_INVALID_JSON";
    throw dataError;
  }
};

const leagueApi = axios.create({
  baseURL: "https://127.0.0.1:2999/liveclientdata",
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
  }),
  timeout: 2000,
});

const ddragonApi = axios.create({
  baseURL: "https://ddragon.leagueoflegends.com",
  timeout: 5000,
});

const getGameSnapshot = async ({ includeActivePlayer = false } = {}) => {
  if (!USE_MOCK && !selectedMockScenario) {
    try {
      const requests = [
        leagueApi.get("/playerlist"),
        leagueApi.get("/activeplayername"),
      ];

      if (includeActivePlayer) {
        requests.push(
          leagueApi.get("/activeplayer"),
          leagueApi.get("/gamestats"),
        );
      }

      const responses = await Promise.all(requests);

      return {
        mode: "live",
        playerList: responses[0].data || [],
        activePlayerName: responses[1].data || "",
        activePlayerData: responses[2]?.data || {},
        gameTime: responses[3]?.data?.gameTime || 0,
        currentGold: responses[2]?.data?.currentGold || 0,
      };
    } catch (error) {
      console.warn(
        `Live Client unavailable; using mock data: ${error.message}`,
      );
    }
  }

  const mockData = selectedMockScenario
    ? await readSelectedScenarioData()
    : await readMockData();

  return {
    mode: "mock",
    playerList: mockData.playerList || [],
    activePlayerName: mockData.activePlayerName || "",
    activePlayerData: {},
    gameTime: mockData.gameTime || 0,
    currentGold: mockData.currentGold || 0,
  };
};

let latestDdragonVersion = "16.5.1";
let itemDatabase = {};
let itemDatabaseByName = {};

const getLatestDdragonVersion = async () => {
  try {
    const response = await ddragonApi.get("/api/versions.json");
    const versions = response.data;

    if (Array.isArray(versions) && versions.length > 0) {
      return versions[0];
    }

    return latestDdragonVersion;
  } catch (error) {
    console.error("Failed to fetch Data Dragon versions:", error.message);
    return latestDdragonVersion;
  }
};

const stripHtml = (text = "") => {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?li>/gi, "\n")
    .replace(/<\/?ul>/gi, "\n")
    .replace(/<\/?p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
};

const buildItemDatabase = (rawItemData, version) => {
  const db = {};

  Object.entries(rawItemData || {}).forEach(([itemId, item]) => {
    db[itemId] = {
      id: Number(itemId),
      name: item.name,
      description: stripHtml(item.description),
      plainText: item.plaintext || "",
      gold: item.gold || {},
      tags: item.tags || [],
      maps: item.maps || {},
      stats: item.stats || {},
      effect: item.effect || {},
      from: item.from || [],
      into: item.into || [],
      depth: item.depth || 0,
      image: item.image || null,
      iconUrl: `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${itemId}.png`,
    };
  });

  return db;
};

const buildScenarioItem = (itemName, slot) => {
  const itemMeta =
    itemDatabaseByName[itemName.toLowerCase()] ||
    itemDatabase[String(SCENARIO_ITEM_ALIASES[itemName])];

  return {
    itemID: itemMeta?.id || 0,
    displayName: itemName,
    slot,
  };
};

const readSelectedScenarioData = async () => {
  const scenarioConfig = MOCK_SCENARIOS[selectedMockScenario];
  const scenarioPath = path.join(SCENARIOS_PATH, scenarioConfig.file);
  const scenario = await readJsonFile(
    scenarioPath,
    `mock scenario ${scenarioConfig.file}`,
  );
  const context = scenario.gameContext || {};
  const activePlayerName = `Scenario ${scenario.champion}`;

  return {
    activePlayerName,
    currentGold: context.currentGold || 0,
    gameTime: context.gameTime || 0,
    playerList: [
      {
        summonerName: activePlayerName,
        team: "ORDER",
        championName: scenario.champion,
        position: scenario.role,
        role: scenario.role,
        level: context.level || 0,
        scores: {
          kills: context.kills || 0,
          deaths: context.deaths || 0,
          assists: context.assists || 0,
        },
        items: (scenario.ownedItems || []).map(buildScenarioItem),
      },
      ...(scenario.enemyPlayers || []).map((player, index) => ({
        summonerName: `ScenarioEnemy${index + 1}`,
        team: "CHAOS",
        championName: player.champion,
        items: (player.items || []).map(buildScenarioItem),
      })),
    ],
  };
};

const loadItemDatabase = async () => {
  try {
    latestDdragonVersion = await getLatestDdragonVersion();

    const response = await ddragonApi.get(
      `/cdn/${latestDdragonVersion}/data/en_US/item.json`,
    );

    itemDatabase = buildItemDatabase(response.data.data, latestDdragonVersion);
    itemDatabaseByName = Object.values(itemDatabase).reduce((index, item) => {
      index[item.name.toLowerCase()] = item;
      return index;
    }, {});

    console.log(
      `Loaded ${Object.keys(itemDatabase).length} items from Data Dragon ${latestDdragonVersion}`,
    );
  } catch (error) {
    console.error("Failed to load item database:", error.message);
  }
};

const findCurrentPlayer = (playerList, activePlayerName) => {
  return playerList.find((player) => {
    return (
      player.summonerName === activePlayerName ||
      player.riotIdGameName === activePlayerName ||
      `${player.riotIdGameName || ""}#${player.riotIdTagLine || ""}` ===
        activePlayerName
    );
  });
};

const enrichItem = (item) => {
  const itemMeta = itemDatabase[String(item.itemID)];

  return {
    ...item,
    meta: itemMeta || null,
    iconUrl:
      itemMeta?.iconUrl ||
      `https://ddragon.leagueoflegends.com/cdn/${latestDdragonVersion}/img/item/${item.itemID}.png`,
  };
};

const getSortedItems = (player) => {
  return [...(player?.items || [])]
    .sort((a, b) => a.slot - b.slot)
    .map(enrichItem);
};

const getPlayerName = (player) => {
  return player?.summonerName || player?.riotIdGameName || "Unknown Player";
};

const buildPlayerView = ({
  player,
  role = null,
  currentGold = null,
}) => {
  const items = getSortedItems(player);

  return {
    summonerName: getPlayerName(player),
    championName: player?.championName || "Unknown Champion",
    role,
    team: player?.team || null,
    currentGold,
    items,
  };
};

const buildEnemyPlayerView = (player) => ({
  summonerName: getPlayerName(player),
  championName: player?.championName || "Unknown Champion",
  team: player?.team || null,
  items: getSortedItems(player),
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    mode:
      USE_MOCK || selectedMockScenario ? "mock" : "live-with-mock-fallback",
    selectedMockScenario,
    ddragonVersion: latestDdragonVersion,
    itemCount: Object.keys(itemDatabase).length,
  });
});

app.get("/api/mock/scenarios", (req, res) => {
  res.json({
    selectedScenario: selectedMockScenario,
    scenarios: Object.entries(MOCK_SCENARIOS).map(([id, scenario]) => ({
      id,
      label: scenario.label,
    })),
  });
});

app.post("/api/mock/scenarios", (req, res) => {
  const scenarioId = req.body?.scenario;

  if (!MOCK_SCENARIOS[scenarioId]) {
    return res.status(400).json({
      error: "Unknown mock scenario",
      availableScenarios: Object.keys(MOCK_SCENARIOS),
    });
  }

  selectedMockScenario = scenarioId;

  res.json({
    selectedScenario: selectedMockScenario,
  });
});

app.get("/api/items/:itemId", (req, res) => {
  const item = itemDatabase[req.params.itemId];

  if (!item) {
    return res.status(404).json({
      error: "Item not found",
    });
  }

  res.json(item);
});

app.get("/api/players", async (req, res) => {
  try {
    const snapshot = await getGameSnapshot({ includeActivePlayer: true });
    const { playerList, activePlayerName, currentGold } = snapshot;

    const currentPlayer = findCurrentPlayer(playerList, activePlayerName);

    if (!currentPlayer) {
      return res.json({
        myTeam: null,
        myPlayer: null,
        currentGold,
        enemyPlayers: [],
        debug: {
          message: "Could not determine current player",
          activePlayerName,
          players: playerList.map((player) => ({
            summonerName: player.summonerName,
            riotIdGameName: player.riotIdGameName,
            riotIdTagLine: player.riotIdTagLine,
            team: player.team,
            championName: player.championName,
          })),
        },
      });
    }

    const myTeam = currentPlayer.team;
    const role = resolveRole(
      currentPlayer.championName,
      currentPlayer.position || currentPlayer.role,
    );

    const myPlayer = buildPlayerView({
      player: currentPlayer,
      role,
      currentGold,
    });

    const enemyPlayers = playerList
      .filter((player) => player.team !== myTeam)
      .map(buildEnemyPlayerView);

    res.json({
      myTeam,
      myPlayer,
      currentGold,
      ddragonVersion: latestDdragonVersion,
      enemyPlayers,
    });
  } catch (error) {
    if (error.code?.startsWith("MOCK_DATA_")) {
      return res.status(500).json({
        error: "Could not load mock game data",
        details: error.message,
      });
    }

    res.status(500).json({
      error: "Could not reach League Live Client Data API",
      details: error.message,
    });
  }
});

app.get("/api/advice", async (req, res) => {
  try {
    const snapshot = await getGameSnapshot({ includeActivePlayer: true });
    const {
      playerList,
      activePlayerName,
      currentGold,
      gameTime,
      activePlayerData,
    } = snapshot;

    const currentPlayer = findCurrentPlayer(playerList, activePlayerName);

    if (!currentPlayer) {
      return res.status(400).json({
        error: "Could not determine current player",
      });
    }

    const myTeam = currentPlayer.team;

    const enemyPlayers = playerList
      .filter((player) => player.team !== myTeam)
      .map(buildEnemyPlayerView);

    const myItems = getSortedItems(currentPlayer);

    const championName =
      req.query.championName || currentPlayer.championName || "LeBlanc";
    const role =
      req.query.role || currentPlayer.position || currentPlayer.role || undefined;
    const scores = currentPlayer.scores || {};
    const gameContext = {
      gameTime,
      currentGold,
      level: activePlayerData.level || currentPlayer.level || 0,
      kills: scores.kills || currentPlayer.kills || 0,
      deaths: scores.deaths || currentPlayer.deaths || 0,
      assists: scores.assists || currentPlayer.assists || 0,
    };

    const advice = getBuildAdvice({
      championName,
      role,
      enemyPlayers,
      currentItems: myItems,
      currentGold,
      gameContext,
      itemDatabase,
      historyKey: `${getPlayerName(currentPlayer)}:${championName}:${
        role || "default"
      }`,
    });
    const myPlayer = buildPlayerView({
      player: currentPlayer,
      role: advice.role,
      currentGold: advice.currentGold,
    });

    logRecommendationTelemetry({
      champion: championName,
      role: advice.role,
      enemyStyle: advice.nextItem.debug?.teamStyle?.primary || null,
      bestRecommendation: advice.nextItem.best?.item || null,
      confidence: {
        value: advice.nextItem.best?.confidence || 0,
        band: advice.nextItem.best?.confidenceBand || "Low",
      },
    });

    // Keep the existing root fields for API compatibility. New clients should
    // consume the canonical recommendation payload from `advice`.
    res.json({
      championName,
      role: advice.role,
      myPlayer,
      currentItems: myItems,
      gameTime: advice.gameTime,
      currentGold: advice.currentGold,
      level: advice.level,
      kills: advice.kills,
      deaths: advice.deaths,
      assists: advice.assists,
      recommendationChange: advice.recommendationChange,
      recommendationExplanation:
        advice.nextItem.best?.explanation || null,
      advice,
    });
  } catch (error) {
    if (error.code?.startsWith("MOCK_DATA_")) {
      return res.status(500).json({
        error: "Could not load mock game data",
        details: error.message,
      });
    }

    res.status(500).json({
      error: "Could not build item advice",
      details: error.message,
    });
  }
});

loadItemDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(
      `Mode: ${USE_MOCK ? "mock" : "live with automatic mock fallback"}`,
    );
  });
});
