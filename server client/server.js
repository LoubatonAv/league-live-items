const express = require("express");
const cors = require("cors");
const axios = require("axios");
const https = require("https");
const { getAPMidBuildAdvice } = require("./advisor/apMidAdvisor");

const app = express();
const PORT = 3001;

app.use(cors());

const USE_MOCK = true;
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

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    mode: USE_MOCK ? "mock" : "live",
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
    let playerList = [];
    let activePlayerName = "";

    if (USE_MOCK) {
      playerList = mockData.playerList || [];
      activePlayerName = mockData.activePlayerName || "";
    } else {
      const [playerListResponse, activePlayerNameResponse] = await Promise.all([
        leagueApi.get("/playerlist"),
        leagueApi.get("/activeplayername"),
      ]);

      playerList = playerListResponse.data || [];
      activePlayerName = activePlayerNameResponse.data || "";
    }

    const currentPlayer = findCurrentPlayer(playerList, activePlayerName);

    if (!currentPlayer) {
      return res.json({
        myTeam: null,
        myPlayer: null,
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

    const myPlayer = {
      summonerName:
        currentPlayer.summonerName ||
        currentPlayer.riotIdGameName ||
        "Unknown Player",
      championName: currentPlayer.championName || "Unknown Champion",
      team: currentPlayer.team,
      items: (currentPlayer.items || [])
        .sort((a, b) => a.slot - b.slot)
        .map(enrichItem),
    };

    const enemyPlayers = playerList
      .filter((player) => player.team !== myTeam)
      .map((player) => ({
        summonerName:
          player.summonerName || player.riotIdGameName || "Unknown Player",
        championName: player.championName || "Unknown Champion",
        team: player.team,
        items: (player.items || [])
          .sort((a, b) => a.slot - b.slot)
          .map(enrichItem),
      }));

    res.json({
      myTeam,
      myPlayer,
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
    let playerList = [];
    let activePlayerName = "";

    if (USE_MOCK) {
      playerList = mockData.playerList || [];
      activePlayerName = mockData.activePlayerName || "";
    } else {
      const [playerListResponse, activePlayerNameResponse] = await Promise.all([
        leagueApi.get("/playerlist"),
        leagueApi.get("/activeplayername"),
      ]);

      playerList = playerListResponse.data || [];
      activePlayerName = activePlayerNameResponse.data || "";
    }

    const currentPlayer = findCurrentPlayer(playerList, activePlayerName);

    if (!currentPlayer) {
      return res.status(400).json({
        error: "Could not determine current player",
      });
    }

    const myTeam = currentPlayer.team;

    const enemyPlayers = playerList
      .filter((player) => player.team !== myTeam)
      .map((player) => ({
        summonerName:
          player.summonerName || player.riotIdGameName || "Unknown Player",
        championName: player.championName || "Unknown Champion",
        team: player.team,
        items: (player.items || [])
          .sort((a, b) => a.slot - b.slot)
          .map(enrichItem),
      }));

    const myItems = (currentPlayer.items || [])
      .sort((a, b) => a.slot - b.slot)
      .map(enrichItem);

    const championName =
      req.query.championName || currentPlayer.championName || "LeBlanc";

    const advice = getAPMidBuildAdvice({
      championName,
      enemyPlayers,
      currentItems: myItems,
    });

    res.json({
      championName,
      currentItems: myItems,
      advice,
    });
  } catch (error) {
    res.status(500).json({
      error: "Could not build AP mid advice",
      details: error.message,
    });
  }
});

loadItemDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Mode: ${USE_MOCK ? "mock" : "live"}`);
  });
});
