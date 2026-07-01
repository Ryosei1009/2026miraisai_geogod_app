import WebSocket from "ws";
import https from "https";
import fs from "fs";

const WS_URL = "wss://miraisaiapi.shino.zip";
const ORIGIN = "https://miraisai.shino.zip";
const N = Number(process.argv[2] || 200);

const env = Object.fromEntries(
  fs.readFileSync(new URL("./.env", import.meta.url), "utf8")
    .split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).split(" #")[0].trim()]; })
);
const ADMIN_KEY = env.ADMIN_KEY;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function health() {
  return new Promise((resolve) => {
    const t = Date.now();
    const req = https.get(WS_URL.replace("wss", "https") + "/api/health", { timeout: 8000 }, (res) => {
      res.on("data", () => {}); res.on("end", () => resolve(`${res.statusCode}/${Date.now() - t}ms`));
    });
    req.on("error", (e) => resolve("ERR " + e.message));
    req.on("timeout", () => { req.destroy(); resolve("TIMEOUT"); });
  });
}

const A = { states: 0, phase: null, mode: null, ann: null, revealStep: 0, lb: 0, rank: 0, recent: 0,
            totalQ: 0, qIdx: 0, goodPhase: null, goodIdx: -1, goodStats: [], role: null, err: null };
let adminWs;
function connectAdmin() {
  return new Promise((resolve) => {
    const ws = new WebSocket(WS_URL, { origin: ORIGIN, handshakeTimeout: 15000 });
    ws.on("open", () => ws.send(JSON.stringify({ type: "join", role: "admin", adminKey: ADMIN_KEY })));
    ws.on("message", (raw) => {
      let m; try { m = JSON.parse(raw.toString()); } catch { return; }
      if (m.type === "error") A.err = m.payload;
      if (m.type !== "state") return;
      A.states++; const p = m.payload || {};
      A.role = p.selfRole ?? A.role; A.mode = p.mode ?? A.mode;
      if (p.mode === "geo") {
        A.phase = p.phase; A.ann = p.announcement ?? null; A.revealStep = p.revealStep ?? 0;
        A.totalQ = p.totalQuestions ?? A.totalQ; A.qIdx = p.currentQuestionIndex ?? A.qIdx;
        if (Array.isArray(p.leaderboard)) A.lb = p.leaderboard.length;
        if (Array.isArray(p.ranking)) A.rank = p.ranking.length;
        if (Array.isArray(p.recentResults)) A.recent = p.recentResults.length;
      } else if (p.mode === "good") {
        A.goodPhase = p.phase; A.goodIdx = p.currentIndex; A.revealStep = p.revealStep ?? 0;
        if (Array.isArray(p.stats)) A.goodStats = p.stats.map((s) => s.goodCount);
      }
    });
    ws.on("error", () => resolve(ws));
    setTimeout(() => resolve(ws), 1500);
  });
}
const send = (o) => adminWs.send(JSON.stringify(o));

const parts = [];
const P = { open: 0, errBusy: 0, errOther: 0, pins: 0, votes: 0, errSamples: new Set() };
function connectPart(i) {
  return new Promise((resolve) => {
    const ws = new WebSocket(WS_URL, { origin: ORIGIN, handshakeTimeout: 20000 });
    ws.on("open", () => { P.open++; ws.send(JSON.stringify({ type: "join", role: "participant", clientId: "mt_" + i, name: "u" + i })); parts.push(ws); resolve(); });
    ws.on("message", (raw) => {
      let m; try { m = JSON.parse(raw.toString()); } catch { return; }
      if (m.type === "error") { if (String(m.payload).includes("受け付け")) P.errBusy++; else P.errOther++; P.errSamples.add(String(m.payload).slice(0, 40)); }
    });
    ws.on("error", () => resolve());
  });
}
function live() { return parts.filter((w) => w.readyState === 1); }
async function pinBurst(rounds = 3) {
  for (let r = 0; r < rounds; r++) {
    for (const ws of live()) { try { ws.send(JSON.stringify({ type: "answer:update", lat: 35 + Math.random() * 3, lng: 135 + Math.random() * 6 })); P.pins++; } catch {} }
    await sleep(400);
  }
}
async function voteBurst() {
  for (const ws of live()) { try { ws.send(JSON.stringify({ type: "good" })); P.votes++; } catch {} }
  await sleep(1000);
}

const issues = [];
function check(cond, msg) { if (!cond) issues.push(msg); }

(async () => {
  if (!ADMIN_KEY) { console.log("no ADMIN_KEY"); process.exit(1); }
  console.log("=== MEGA FULL TEST (geo 全問 + good 全出演者) ===");
  adminWs = await connectAdmin(); await sleep(1500);
  console.log(`admin role=${A.role} mode=${A.mode}`);
  if (A.role !== "admin") { console.log("!! admin auth failed. abort."); process.exit(2); }

  console.log(`connecting ${N} participants...`);
  for (let i = 0; i < N; i++) { connectPart(i); await sleep(35); }
  await sleep(2500);
  console.log(`participants open=${P.open} live=${live().length}`);

  try {
    // ---------- GEO: 全問 ----------
    if (A.mode !== "geo") { send({ type: "admin:mode", mode: "geo" }); await sleep(1000); }
    send({ type: "admin:start" }); await sleep(1200);
    const totalQ = A.totalQ || 11;
    console.log(`\n--- GEO: ${totalQ} 問 ---  phase=${A.phase}`);
    for (let q = 0; q < totalQ; q++) {
      A.recent = 0;
      await pinBurst(3);
      const hb = await health();
      send({ type: "admin:close" }); await sleep(700);
      send({ type: "admin:revealAnswer" }); await sleep(900);
      send({ type: "admin:revealRanking" }); await sleep(700);
      const isJapanFinal = q === 5, isWorldFinal = q === totalQ - 1;
      let annNote = "";
      if (isJapanFinal || isWorldFinal) {
        send({ type: "admin:showRanking" }); await sleep(600);
        for (let s = 0; s < 4; s++) { send({ type: "admin:revealNext" }); await sleep(350); }
        annNote = ` ann=${A.ann} step=${A.revealStep}`;
        if (isWorldFinal) {
          send({ type: "admin:showFinalRanking" }); await sleep(600);
          for (let s = 0; s < 4; s++) { send({ type: "admin:revealNext" }); await sleep(350); }
          annNote += ` -> combined ann=${A.ann} step=${A.revealStep}`;
        }
      }
      console.log(`  Q${q + 1}/${totalQ} phase=${A.phase} rank=${A.rank} recent=${A.recent} health=${hb} busyErr=${P.errBusy}${annNote}`);
      check(A.rank === N, `Q${q + 1}: ranking=${A.rank} (expected ${N})`);
      check(P.errBusy === 0, `Q${q + 1}: busy errors=${P.errBusy}`);
      if (!isWorldFinal) { send({ type: "admin:next" }); await sleep(800); }
    }
    console.log(`GEO done. finalPhase=${A.phase} ann=${A.ann} ranking=${A.rank}`);

    // ---------- GOOD: 全出演者 ----------
    send({ type: "admin:mode", mode: "good" }); await sleep(1200);
    send({ type: "admin:start" }); await sleep(1200);
    const perfCount = A.goodStats.length || 5;
    console.log(`\n--- GOOD: ${perfCount} 出演者 ---  phase=${A.goodPhase} idx=${A.goodIdx}`);
    for (let pf = 0; pf < perfCount; pf++) {
      await voteBurst();
      const hb = await health();
      send({ type: "admin:next" }); await sleep(900); // live -> review (locks votes)
      const gc = A.goodStats[pf] ?? 0;
      console.log(`  出演者${pf + 1}/${perfCount} votes~${gc} phase=${A.goodPhase} health=${hb}`);
      check(gc >= N * 0.9, `出演者${pf + 1}: goodCount=${gc} (expected ~${N})`);
      send({ type: "admin:next" }); await sleep(900); // review -> next performer OR ranking
    }
    console.log(`  after last performer: phase=${A.goodPhase} (expect ranking)`);
    check(A.goodPhase === "ranking", `good final phase=${A.goodPhase} (expected ranking)`);
    for (let s = 0; s < perfCount; s++) { send({ type: "admin:revealNext" }); await sleep(400); }
    console.log(`  ranking reveal done. revealStep=${A.revealStep} health=${await health()}`);
    send({ type: "admin:finishGood" }); await sleep(800);
    console.log(`GOOD done. phase=${A.goodPhase}`);
  } catch (e) {
    console.log("ERROR during flow:", e.message);
  } finally {
    console.log("\n--- CLEANUP ---");
    send({ type: "admin:resetGood" }); await sleep(800);
    send({ type: "admin:mode", mode: "geo" }); await sleep(800);
    send({ type: "admin:reset" }); await sleep(1500);
    console.log(`cleanup: mode=${A.mode} phase=${A.phase} leaderboard=${A.lb}`);
  }

  console.log("\n===== SUMMARY =====");
  console.log(`participants open=${P.open} pinsSent=${P.pins} votesSent=${P.votes}`);
  console.log(`participant errors: busy=${P.errBusy} other=${P.errOther} ${[...P.errSamples].join(",")}`);
  console.log(`ISSUES (${issues.length}):`); issues.forEach((s) => console.log("  - " + s));
  console.log(`final health: ${await health()}`);
  for (const w of parts) { try { w.close(); } catch {} }
  try { adminWs.close(); } catch {}
  await sleep(1500);
  process.exit(0);
})();
