import cors from "cors";
import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import { createServer } from "http";
import { createServer as createHttpsServer } from "https";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "";
const corsOptions = CLIENT_ORIGIN
  ? { origin: CLIENT_ORIGIN, credentials: true }
  : { origin: true };

app.use(cors(corsOptions));
app.use(express.json());

const SCORE_MODE = process.env.SCORE_MODE || "separate";

function createGameId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

let gameId = createGameId();

const questions = [
  { id: 1, title: "お試し: 東京駅", answer: { lat: 35.681236, lng: 139.767125 }, category: "trial" },
  { id: 2, title: "日本1: 姫路城", answer: { lat: 34.839449, lng: 134.693904 }, category: "japan" },
  { id: 3, title: "日本2: 阿蘇山", answer: { lat: 32.8847, lng: 131.1043 }, category: "japan" },
  { id: 4, title: "日本3: 金閣寺", answer: { lat: 35.03937, lng: 135.72924 }, category: "japan" },
  { id: 5, title: "日本4: 弘前城", answer: { lat: 40.60707, lng: 140.46412 }, category: "japan" },
  { id: 6, title: "日本5: 松山城", answer: { lat: 33.84584, lng: 132.7654 }, category: "japan" },
  { id: 7, title: "世界1: エッフェル塔", answer: { lat: 48.85837, lng: 2.29448 }, category: "world" },
  { id: 8, title: "世界2: 自由の女神", answer: { lat: 40.68925, lng: -74.0445 }, category: "world" },
  { id: 9, title: "世界3: コロッセオ", answer: { lat: 41.89021, lng: 12.49223 }, category: "world" },
  { id: 10, title: "世界4: ピラミッド", answer: { lat: 29.97924, lng: 31.1342 }, category: "world" },
  { id: 11, title: "世界5: シドニー・オペラハウス", answer: { lat: -33.85678, lng: 151.2153 }, category: "world" }
];

const gameState = {
  phase: "waiting",
  currentQuestionIndex: 0
};

const clients = new Map();
const participantsById = new Map();

function blankScores() {
  return { trial: 0, japan: 0, world: 0 };
}

function combinedScore(scores) {
  return scores.japan + scores.world;
}

function totalScore(scores) {
  return scores.trial + (SCORE_MODE === "combined" ? combinedScore(scores) : scores.japan + scores.world);
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function scoreFromDistance(distanceKm, category) {
  const distanceMeters = distanceKm * 1000;
  const metersPerPoint = category === "world" ? 150 : 25;
  return Math.max(0, Math.round(5000 - distanceMeters / metersPerPoint));
}

function toleranceKmForCategory(category) {
  if (category === "world") return 50;
  return 10;
}

function getParticipants() {
  return [...clients.entries()]
    .filter(([, meta]) => meta.role === "participant")
    .map(([ws, meta]) => ({ ws, ...meta }));
}

function buildLeaderboard() {
  return getParticipants()
    .map((p) => ({
      name: p.name,
      totalScore: totalScore(p.scores),
      submittedCurrent: Boolean(p.currentPin)
    }))
    .sort((a, b) => b.totalScore - a.totalScore);
}

function buildRanking() {
  return getParticipants()
    .map((p) => ({
      name: p.name,
      trialScore: p.scores.trial,
      japanScore: p.scores.japan,
      worldScore: p.scores.world,
      combinedScore: combinedScore(p.scores),
      totalScore: totalScore(p.scores)
    }))
    .sort((a, b) => b.totalScore - a.totalScore);
}

function buildStateFor(meta) {
  const currentQuestion = questions[gameState.currentQuestionIndex];
  const base = {
    phase: gameState.phase,
    currentQuestionIndex: gameState.currentQuestionIndex,
    totalQuestions: questions.length,
    currentQuestion: currentQuestion
      ? {
          id: currentQuestion.id,
          title: `第${gameState.currentQuestionIndex + 1}問`,
          category: currentQuestion.category || null
        }
      : null,
    currentCategory: currentQuestion?.category || null,
    leaderboard: buildLeaderboard(),
    ranking: buildRanking(),
    scoreMode: SCORE_MODE,
    gameId,
    revealedAnswer: gameState.phase === "closed" && currentQuestion
      ? currentQuestion.answer
      : null
  };

  if (!meta || meta.role !== "participant") {
    return base;
  }

  const currentCategory = currentQuestion?.category || "trial";

  return {
    ...base,
    player: {
      name: meta.name,
      totalScore: totalScore(meta.scores),
      scores: meta.scores,
      currentCategory,
      currentCategoryScore: meta.scores[currentCategory] ?? 0,
      currentAnswer: meta.answers[gameState.currentQuestionIndex] || null,
      hasSubmittedCurrent: Boolean(meta.currentPin),
      lastRound: meta.lastRound
    }
  };
}

function send(ws, message) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function broadcastState() {
  for (const [ws, meta] of clients.entries()) {
    send(ws, { type: "state", payload: buildStateFor(meta) });
  }
}

function closeCurrentQuestionAndScore() {
  const q = questions[gameState.currentQuestionIndex];
  const resultRows = [];

  for (const { ws, name, currentPin, answers, scores } of getParticipants()) {
    const qCategory = q.category || "japan";
    const ans = answers[gameState.currentQuestionIndex] || currentPin;
    let gained = 0;
    let distanceKm = null;

    if (ans) {
      distanceKm = haversineKm(ans.lat, ans.lng, q.answer.lat, q.answer.lng);
      const toleranceKm = toleranceKmForCategory(qCategory);
      gained = distanceKm <= toleranceKm ? scoreFromDistance(distanceKm, qCategory) : 0;
    }

    const updated = clients.get(ws);
    updated.scores[qCategory] += gained;
    updated.lastRound = {
      questionId: q.id,
      gained,
      distanceKm
    };
    updated.currentPin = null;

    resultRows.push({
      name,
      gained,
      distanceKm,
      totalScore: totalScore(updated.scores)
    });
  }

  return resultRows.sort((a, b) => b.totalScore - a.totalScore);
}

function clearCurrentPins() {
  for (const [, meta] of clients.entries()) {
    if (meta.role === "participant") {
      meta.currentPin = null;
    }
  }
}

function broadcastForceRejoin() {
  for (const [ws, meta] of clients.entries()) {
    if (meta.role !== "admin") {
      send(ws, { type: "forceRejoin" });
    }
  }
}

function resetGame({ forceRejoin = false } = {}) {
  gameState.phase = "waiting";
  gameState.currentQuestionIndex = 0;
  if (forceRejoin) {
    gameId = createGameId();
    participantsById.clear();
  }
  for (const [, meta] of clients.entries()) {
    if (meta.role === "participant") {
      meta.scores = blankScores();
      meta.answers = {};
      meta.lastRound = null;
      meta.currentPin = null;
      if (forceRejoin) {
        meta.role = "guest";
        meta.name = "";
      }
    }
  }
}

const useHttps = String(process.env.USE_HTTPS || "").toLowerCase() === "true";
let httpServer;

if (useHttps) {
  const keyPath = process.env.HTTPS_KEY_PATH || "";
  const certPath = process.env.HTTPS_CERT_PATH || "";
  if (!keyPath || !certPath) {
    throw new Error("USE_HTTPS is true, but HTTPS_KEY_PATH or HTTPS_CERT_PATH is missing.");
  }
  const key = fs.readFileSync(keyPath);
  const cert = fs.readFileSync(certPath);
  httpServer = createHttpsServer({ key, cert }, app);
} else {
  httpServer = createServer(app);
}
const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws) => {
  clients.set(ws, {
    role: "guest",
    name: "",
    scores: blankScores(),
    answers: {},
    lastRound: null,
    currentPin: null,
    clientId: null
  });

  send(ws, { type: "state", payload: buildStateFor(null) });

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      const meta = clients.get(ws);
      if (!meta) return;

      if (msg.type === "join") {
        if (msg.role === "admin") {
          meta.role = "admin";
          meta.name = "運営";
        } else {
          const clientId = String(msg.clientId || "").trim();
          const stored = clientId ? participantsById.get(clientId) : null;
          const name = String(msg.name || stored?.name || "名無し").trim().slice(0, 24) || "名無し";
          const participant = stored || {
            role: "participant",
            name,
            scores: blankScores(),
            answers: {},
            lastRound: null,
            currentPin: null,
            clientId
          };

          participant.role = "participant";
          participant.name = name;
          participant.clientId = clientId || participant.clientId;

          clients.set(ws, participant);
          if (participant.clientId) {
            participantsById.set(participant.clientId, participant);
          }
        }
        broadcastState();
        return;
      }

      if (meta.role === "admin") {
        if (msg.type === "admin:start") {
          resetGame();
          gameState.phase = "active";
          clearCurrentPins();
          broadcastState();
          return;
        }

        if (msg.type === "admin:reset") {
          resetGame({ forceRejoin: true });
          broadcastForceRejoin();
          broadcastState();
          return;
        }

        if (msg.type === "admin:close") {
          if (gameState.phase !== "active") return;
          const roundResults = closeCurrentQuestionAndScore();

          const isLast = gameState.currentQuestionIndex >= questions.length - 1;
          gameState.phase = isLast ? "finished" : "closed";

          for (const [clientWs] of clients.entries()) {
            send(clientWs, { type: "roundResult", payload: roundResults });
          }
          broadcastState();
          return;
        }

        if (msg.type === "admin:next") {
          if (gameState.phase !== "closed") return;
          if (gameState.currentQuestionIndex >= questions.length - 1) return;
          gameState.currentQuestionIndex += 1;
          gameState.phase = "active";
          clearCurrentPins();
          broadcastState();
          return;
        }

        return;
      }

      if (meta.role === "participant" && msg.type === "answer:update") {
        if (gameState.phase !== "active") {
          send(ws, { type: "error", payload: "現在は回答を受け付けていません。" });
          return;
        }

        const lat = Number(msg.lat);
        const lng = Number(msg.lng);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          send(ws, { type: "error", payload: "座標が不正です。" });
          return;
        }

        meta.currentPin = { lat, lng };
        meta.answers[gameState.currentQuestionIndex] = { lat, lng };
        broadcastState();
      }
    } catch {
      send(ws, { type: "error", payload: "メッセージ解析に失敗しました。" });
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    broadcastState();
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// const clientDistPath = path.join(__dirname, "../client/dist");
// app.use(express.static(clientDistPath));
// app.get("*", (_req, res) => {
//   res.sendFile(path.join(clientDistPath, "index.html"));
// });

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on https://${process.env.SERVER_DOMAIN}`);
});
