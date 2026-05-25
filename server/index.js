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

const ADMIN_KEY = String(process.env.ADMIN_KEY || "").trim();

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

const performers = [
  { id: 1, no: "No.1", name: "グループA" },
  { id: 2, no: "No.2", name: "グループB" },
  { id: 3, no: "No.3", name: "グループC" },
  { id: 4, no: "No.4", name: "グループD" },
  { id: 5, no: "No.5", name: "グループE" },
  { id: 6, no: "No.6", name: "グループF" }
];

let currentMode = "geo";

const geoState = {
  phase: "waiting",
  currentQuestionIndex: 0
};

const goodState = {
  phase: "waiting",
  currentIndex: -1
};

const clients = new Map();
const participantsById = new Map();
const performerStats = performers.map((performer) => ({
  id: performer.id,
  goodCount: 0,
  participantCount: 0,
  maxParticipantCount: 0,
  locked: false,
  voters: new Set()
}));

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

function getAllParticipants() {
  return [...participantsById.values()].filter((meta) => meta.role === "participant");
}

function buildLeaderboard() {
  return getAllParticipants()
    .map((p) => ({
      name: p.name,
      totalScore: totalScore(p.scores),
      submittedCurrent: Boolean(p.currentPin)
    }))
    .sort((a, b) => b.totalScore - a.totalScore);
}

function buildRanking() {
  return getAllParticipants()
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

function buildGeoStateFor(meta) {
  const currentQuestion = questions[geoState.currentQuestionIndex];
  const base = {
    mode: "geo",
    phase: geoState.phase,
    currentQuestionIndex: geoState.currentQuestionIndex,
    totalQuestions: questions.length,
    questionList: questions.map((q, index) => ({
      index,
      label: `第${index + 1}問 ${q.title}`
    })),
    currentQuestion: currentQuestion
      ? {
          id: currentQuestion.id,
          title: `第${geoState.currentQuestionIndex + 1}問`,
          category: currentQuestion.category || null
        }
      : null,
    currentCategory: currentQuestion?.category || null,
    leaderboard: buildLeaderboard(),
    ranking: buildRanking(),
    scoreMode: SCORE_MODE,
    gameId,
    revealedAnswer: geoState.phase === "closed" && currentQuestion
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
      currentAnswer: meta.answers[geoState.currentQuestionIndex] || null,
      hasSubmittedCurrent: Boolean(meta.currentPin),
      lastRound: meta.lastRound
    }
  };
}

function resetStats() {
  for (const stat of performerStats) {
    stat.goodCount = 0;
    stat.participantCount = 0;
    stat.maxParticipantCount = 0;
    stat.locked = false;
    stat.voters.clear();
  }
}

function resetGoodGame() {
  resetStats();
  goodState.phase = "waiting";
  goodState.currentIndex = -1;
}

function goodAudienceCount() {
  let count = 0;
  for (const meta of clients.values()) {
    if (meta.role !== "admin" && meta.role !== "guest") count += 1;
  }
  return count;
}

function buildStatsSummary() {
  const liveAudience = goodAudienceCount();
  return performerStats.map((stat, index) => {
    const isCurrent = goodState.phase === "live" && index === goodState.currentIndex;
    const goodCount = isCurrent && !stat.locked ? stat.voters.size : stat.goodCount;
    let participantCount = isCurrent && !stat.locked ? liveAudience : stat.participantCount;
    // 投票中は最大接続者数を更新
    if (isCurrent && !stat.locked) {
      stat.maxParticipantCount = Math.max(stat.maxParticipantCount, liveAudience);
    }
    return {
      id: stat.id,
      no: performers[index]?.no || "",
      name: performers[index]?.name || "",
      goodCount,
      participantCount,
      locked: stat.locked
    };
  });
}

function hasVotedCurrent(meta) {
  if (!meta || meta.role === "admin" || meta.role === "guest") return false;
  if (goodState.phase !== "live") return false;
  if (!Number.isFinite(goodState.currentIndex) || goodState.currentIndex < 0) return false;
  const stat = performerStats[goodState.currentIndex];
  if (!stat) return false;
  return Boolean(meta.clientId && stat.voters.has(meta.clientId));
}

function buildGoodStateFor(meta) {
  return {
    mode: "good",
    phase: goodState.phase,
    currentIndex: goodState.currentIndex,
    totalPerformers: performers.length,
    performers,
    stats: buildStatsSummary(),
    audienceCount: goodAudienceCount(),
    hasVotedCurrent: hasVotedCurrent(meta)
  };
}

function buildStateFor(meta) {
  const baseState = currentMode === "good" ? buildGoodStateFor(meta) : buildGeoStateFor(meta);
  return {
    ...baseState,
    selfRole: meta?.role || "guest"
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

function handleJoinMessage(ws, meta, msg) {
  if (msg.type !== "join") return false;

  if (msg.role === "admin") {
    const adminKey = String(msg.adminKey || "").trim();
    if (!ADMIN_KEY) {
      send(ws, { type: "error", payload: "管理者キーが未設定です。" });
      send(ws, { type: "state", payload: buildStateFor(meta) });
      return true;
    }
    if (adminKey !== ADMIN_KEY) {
      send(ws, { type: "error", payload: "管理者認証に失敗しました。" });
      send(ws, { type: "state", payload: buildStateFor(meta) });
      return true;
    }
    meta.role = "admin";
    meta.name = "運営";
    meta.clientId = null;
  } else if (msg.role === "participant") {
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

    // 同じclientIdでの古い接続があれば削除
    if (participant.clientId) {
      for (const [oldWs, oldMeta] of clients.entries()) {
        if (oldWs !== ws && oldMeta.clientId === participant.clientId && oldMeta.role === "participant") {
          oldWs.close();
          clients.delete(oldWs);
        }
      }
    }

    clients.set(ws, participant);
    if (participant.clientId) {
      participantsById.set(participant.clientId, participant);
    }
  } else {
    const clientId = String(msg.clientId || "").trim() || `guest_${Math.random().toString(36).slice(2, 10)}`;
    
    // 同じclientIdでの古い接続があれば削除
    for (const [oldWs, oldMeta] of clients.entries()) {
      if (oldWs !== ws && oldMeta.clientId === clientId && oldMeta.role === "audience") {
        oldWs.close();
        clients.delete(oldWs);
      }
    }
    
    meta.role = "audience";
    meta.clientId = clientId;
    clients.set(ws, meta);
  }

  broadcastState();
  return true;
}

function handleAdminModeMessage(msg) {
  if (msg.type !== "admin:mode") return false;
  const nextMode = msg.mode === "good" ? "good" : "geo";
  if (nextMode !== currentMode) {
    currentMode = nextMode;
    if (currentMode === "good") {
      resetGoodGame();
    }
    for (const [clientWs] of clients.entries()) {
      send(clientWs, { type: "modeChanged", payload: { mode: currentMode } });
    }
  }
  broadcastState();
  return true;
}

function handleAdminGeoMessage(msg) {
  if (msg.type === "admin:start") {
    resetGeoGame();
    geoState.phase = "active";
    clearCurrentPins();
    broadcastState();
    return true;
  }

  if (msg.type === "admin:reset") {
    resetGeoGame({ forceRejoin: true });
    broadcastForceRejoin();
    broadcastState();
    return true;
  }

  if (msg.type === "admin:close") {
    if (geoState.phase !== "active") return true;
    const roundResults = closeCurrentQuestionAndScore();

    const isLast = geoState.currentQuestionIndex >= questions.length - 1;
    geoState.phase = isLast ? "finished" : "closed";

    for (const [clientWs] of clients.entries()) {
      send(clientWs, { type: "roundResult", payload: roundResults });
    }
    broadcastState();
    return true;
  }

  if (msg.type === "admin:next") {
    if (geoState.phase !== "closed") return true;
    if (geoState.currentQuestionIndex >= questions.length - 1) return true;
    geoState.currentQuestionIndex += 1;
    geoState.phase = "active";
    clearCurrentPins();
    broadcastState();
    return true;
  }

  return false;
}

function handleAdminJumpMessage(msg) {
  if (msg.type === "admin:jumpGeo") {
    const nextIndex = Number(msg.index);
    if (Number.isFinite(nextIndex)) {
      const clamped = Math.max(0, Math.min(questions.length - 1, nextIndex));
      geoState.currentQuestionIndex = clamped;
      geoState.phase = "active";
      clearCurrentPins();
      broadcastState();
    }
    return true;
  }

  if (msg.type === "admin:jumpGood") {
    const nextIndex = Number(msg.index);
    if (Number.isFinite(nextIndex)) {
      const clamped = Math.max(0, Math.min(performers.length - 1, nextIndex));
      goodState.currentIndex = clamped;
      goodState.phase = "live";
      const stat = performerStats[clamped];
      if (stat) {
        stat.locked = false;
        // ジャンプした出演者の投票開始時に参加者数と最大参加者数を初期化
        const audienceCount = goodAudienceCount();
        stat.participantCount = audienceCount;
        stat.maxParticipantCount = audienceCount;
      }
      broadcastState();
    }
    return true;
  }

  return false;
}

function handleAdminGoodMessage(msg) {
  if (msg.type === "admin:resetGood") {
    resetGoodGame();
    broadcastState();
    return true;
  }

  if (msg.type === "admin:start") {
    resetStats();
    goodState.phase = "live";
    goodState.currentIndex = performers.length > 0 ? 0 : -1;
    // 投票開始時に参加者数と最大参加者数を初期化
    if (goodState.currentIndex >= 0 && goodState.currentIndex < performerStats.length) {
      const audienceCount = goodAudienceCount();
      performerStats[goodState.currentIndex].participantCount = audienceCount;
      performerStats[goodState.currentIndex].maxParticipantCount = audienceCount;
    }
    broadcastState();
    return true;
  }

  if (msg.type === "admin:next") {
    if (goodState.phase === "live") {
      lockCurrentStats();
      goodState.phase = "review";
      broadcastState();
      return true;
    }

    if (goodState.phase === "review") {
      const isLast = goodState.currentIndex >= performers.length - 1;
      if (isLast) {
        goodState.phase = "waiting";
        goodState.currentIndex = -1;
      } else {
        goodState.currentIndex += 1;
        goodState.phase = "live";
        const stat = performerStats[goodState.currentIndex];
        if (stat) {
          stat.locked = false;
          // 新しい出演者の投票開始時に参加者数と最大参加者数を初期化
          const audienceCount = goodAudienceCount();
          stat.participantCount = audienceCount;
          stat.maxParticipantCount = audienceCount;
        }
      }
      broadcastState();
      return true;
    }
    return true;
  }

  if (msg.type === "admin:back") {
    if (goodState.phase === "review") {
      goodState.phase = "live";
      const stat = performerStats[goodState.currentIndex];
      if (stat) {
        stat.locked = false;
        // 投票に戻るときは投票状態をリセット
        stat.voters.clear();
        stat.goodCount = 0;
        const audienceCount = goodAudienceCount();
        stat.participantCount = audienceCount;
        stat.maxParticipantCount = Math.max(stat.maxParticipantCount, audienceCount);
      }
      broadcastState();
      return true;
    }

    if (goodState.phase !== "live") return true;
    if (goodState.currentIndex <= 0) return true;
    goodState.currentIndex -= 1;
    const stat = performerStats[goodState.currentIndex];
    if (stat) {
      stat.locked = false;
      // 前の出演者に戻るときはロック状態をリセット
      const audienceCount = goodAudienceCount();
      stat.participantCount = audienceCount;
      stat.maxParticipantCount = Math.max(stat.maxParticipantCount, audienceCount);
    }
    broadcastState();
    return true;
  }

  return false;
}

function handleParticipantAnswer(ws, meta, msg) {
  if (currentMode !== "geo" || meta.role !== "participant" || msg.type !== "answer:update") return false;
  if (geoState.phase !== "active") {
    send(ws, { type: "error", payload: "現在は回答を受け付けていません。" });
    return true;
  }

  const lat = Number(msg.lat);
  const lng = Number(msg.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    send(ws, { type: "error", payload: "座標が不正です。" });
    return true;
  }

  meta.currentPin = { lat, lng };
  meta.answers[geoState.currentQuestionIndex] = { lat, lng };
  broadcastState();
  return true;
}

function handleGoodVote(meta, msg) {
  if (currentMode !== "good" || msg.type !== "good") return false;
  if (goodState.phase !== "live") {
    return true;
  }
  if (!Number.isFinite(goodState.currentIndex) || goodState.currentIndex < 0) return true;
  const stat = performerStats[goodState.currentIndex];
  if (!stat || !meta.clientId) return true;
  if (stat.voters.has(meta.clientId)) return true;
  if (meta.role === "admin" || meta.role === "guest") return true;
  stat.voters.add(meta.clientId);
  broadcastState();
  return true;
}

function closeCurrentQuestionAndScore() {
  const q = questions[geoState.currentQuestionIndex];
  const resultRows = [];

  for (const participant of getAllParticipants()) {
    const { name, currentPin, answers, scores } = participant;
    const qCategory = q.category || "japan";
    const ans = answers[geoState.currentQuestionIndex] || currentPin;
    let gained = 0;
    let distanceKm = null;

    if (ans) {
      distanceKm = haversineKm(ans.lat, ans.lng, q.answer.lat, q.answer.lng);
      const toleranceKm = toleranceKmForCategory(qCategory);
      gained = distanceKm <= toleranceKm ? scoreFromDistance(distanceKm, qCategory) : 0;
    }

    participant.scores[qCategory] += gained;
    participant.lastRound = {
      questionId: q.id,
      gained,
      distanceKm
    };
    participant.currentPin = null;

    resultRows.push({
      name,
      gained,
      distanceKm,
      totalScore: totalScore(participant.scores)
    });
  }

  return resultRows.sort((a, b) => b.totalScore - a.totalScore);
}

function clearCurrentPins() {
  for (const meta of getAllParticipants()) {
    meta.currentPin = null;
  }
}

function broadcastForceRejoin() {
  for (const [ws, meta] of clients.entries()) {
    if (meta.role !== "admin") {
      send(ws, { type: "forceRejoin" });
    }
  }
}

function resetGeoGame({ forceRejoin = false } = {}) {
  geoState.phase = "waiting";
  geoState.currentQuestionIndex = 0;
  if (forceRejoin) {
    gameId = createGameId();
    participantsById.clear();
  }
  for (const meta of getAllParticipants()) {
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

function lockCurrentStats() {
  if (!Number.isFinite(goodState.currentIndex) || goodState.currentIndex < 0) return;
  const stat = performerStats[goodState.currentIndex];
  if (!stat) return;
  stat.goodCount = stat.voters.size;
  // 投票期間中の最大接続者数を参加者数として固定
  stat.participantCount = stat.maxParticipantCount;
  stat.locked = true;
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

      if (msg.type === "state:request") {
        send(ws, { type: "state", payload: buildStateFor(meta) });
        return;
      }

      if (msg.type === "ping") {
        send(ws, { type: "pong" });
        return;
      }

      if (handleJoinMessage(ws, meta, msg)) return;
      if (handleAdminModeMessage(msg)) return;

      if (meta.role === "admin") {
        if (handleAdminJumpMessage(msg)) return;
        if (currentMode === "geo") {
          if (handleAdminGeoMessage(msg)) return;
          return;
        }

        if (currentMode === "good") {
          if (handleAdminGoodMessage(msg)) return;
          return;
        }

        return;
      }

      if (handleParticipantAnswer(ws, meta, msg)) return;
      if (handleGoodVote(meta, msg)) return;
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
