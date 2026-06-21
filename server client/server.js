const express = require("express");
const cors = require("cors");
const axios = require("axios");
const https = require("https");
const { getBuildAdvice, resolveRole } = require("./advisor/itemAdvisor");
const {
  logRecommendationTelemetry,
} = require("./advisor/recommendationTelemetry");

const app = express();
const PORT = 3001;

app.use(cors());

const USE_MOCK = String(process.env.USE_MOCK || "").toLowerCase() === "true";
const mockData = require("./mockGameData.json");

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
  if (!USE_MOCK) {
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

const loadItemDatabase = async () => {
  try {
    latestDdragonVersion = await getLatestDdragonVersion();

    const response = await ddragonApi.get(
      `/cdn/${latestDdragonVersion}/data/en_US/item.json`,
    );

    itemDatabase = buildItemDatabase(response.data.data, latestDdragonVersion);

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
    mode: USE_MOCK ? "mock" : "live-with-mock-fallback",
    ddragonVersion: latestDdragonVersion,
    itemCount: Object.keys(itemDatabase).length,
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
