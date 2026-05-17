import { useEffect, useMemo, useRef, useState } from "react";
import AdminView from "./components/AdminView";
import ConfirmModal from "./components/ConfirmModal";
import PlayerView from "./components/PlayerView";
import RankingView from "./components/RankingView";

function formatDistance(v) {
    if (typeof v !== "number") return "-";
    return `${v.toFixed(1)} km`;
}

function wsUrlFromWindow() {
    const envUrl = import.meta.env.VITE_WS_URL;
    if (envUrl) return envUrl;
    const apiBase = import.meta.env.VITE_API_BASE;
    if (apiBase) {
        try {
            const apiUrl = new URL(apiBase);
            apiUrl.protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
            return apiUrl.toString().replace(/\/$/, "");
        } catch {
            return apiBase;
        }
    }
    const isHttps = window.location.protocol === "https:";
    const protocol = isHttps ? "wss" : "ws";

    if (window.location.port === "5173") {
        return `${protocol}://localhost:3001`;
    }

    return `${protocol}://${window.location.host}`;
}

export default function App() {
    const isAdmin = useMemo(() => new URLSearchParams(window.location.search).get("admin0173") === "1", []);
    const isRankView = useMemo(() => new URLSearchParams(window.location.search).get("rank") === "1", []);

    const storageKeys = {
        clientId: "geoguessr.clientId",
        name: "geoguessr.name",
        gameId: "geoguessr.gameId"
    };

    const getStored = (key) => window.localStorage.getItem(key) || "";
    const setStored = (key, value) => window.localStorage.setItem(key, value);
    const clearStored = () => {
        window.localStorage.removeItem(storageKeys.clientId);
        window.localStorage.removeItem(storageKeys.name);
        window.localStorage.removeItem(storageKeys.gameId);
    };

    const getOrCreateClientId = () => {
        const existing = getStored(storageKeys.clientId);
        if (existing) return existing;
        const fresh = `client_${Math.random().toString(36).slice(2, 10)}`;
        setStored(storageKeys.clientId, fresh);
        return fresh;
    };

    const [socketReady, setSocketReady] = useState(false);
    const [joined, setJoined] = useState(false);
    const [name, setName] = useState("");
    const [pin, setPin] = useState(null);
    const [gameState, setGameState] = useState({
        mode: "geo",
        phase: "waiting",
        currentQuestionIndex: 0,
        totalQuestions: 0,
        questionList: [],
        leaderboard: [],
        ranking: [],
        scoreMode: "separate",
        currentQuestion: null,
        currentCategory: null,
        revealedAnswer: null,
        player: null,
        currentIndex: -1,
        totalPerformers: 0,
        performers: [],
        stats: [],
        audienceCount: 0,
        hasVotedCurrent: false
    });
    const [roundResult, setRoundResult] = useState([]);
    const [error, setError] = useState("");
    const [confirmState, setConfirmState] = useState({
        open: false,
        title: "",
        message: "",
        confirmLabel: "",
        cancelLabel: "",
        payload: null
    });
    const [goodFlash, setGoodFlash] = useState(false);

    const wsRef = useRef(null);
    const joinedRef = useRef(false);
    const autoJoinRef = useRef(false);
    const lastModeRef = useRef("geo");
    const desiredModeRef = useRef(null);

    useEffect(() => {
        joinedRef.current = joined;
    }, [joined]);

    useEffect(() => {
        const savedName = getStored(storageKeys.name);
        if (savedName && !isAdmin) {
            setName(savedName);
        }
    }, [isAdmin]);
    

    useEffect(() => {
        const ws = new WebSocket(wsUrlFromWindow());
        wsRef.current = ws;

        ws.onopen = () => setSocketReady(true);

        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);

            if (msg.type === "state") {
                const payload = msg.payload || {};
                setGameState(payload);

                if (isAdmin && desiredModeRef.current && payload.mode && payload.mode !== desiredModeRef.current) {
                    send({ type: "admin:mode", mode: desiredModeRef.current });
                }

                if (payload.mode && payload.mode !== lastModeRef.current) {
                    handleModeChange(payload.mode, { updateState: false });
                }

                if (payload.mode === "geo") {
                    const incomingGameId = payload.gameId || "";
                    const storedGameId = getStored(storageKeys.gameId);
                    if (incomingGameId && storedGameId && incomingGameId !== storedGameId) {
                        clearStored();
                        setJoined(false);
                        setPin(null);
                        autoJoinRef.current = false;
                    }
                    if (incomingGameId && incomingGameId !== storedGameId) {
                        setStored(storageKeys.gameId, incomingGameId);
                    }

                    if (!isAdmin && joinedRef.current && !payload.player) {
                        setJoined(false);
                        setPin(null);
                    }
                    if (payload.phase === "waiting") {
                        setRoundResult([]);
                    }
                    if (payload.phase !== "active") {
                        setPin(null);
                    }

                    if (!isAdmin && !joinedRef.current && !autoJoinRef.current) {
                        const clientId = getStored(storageKeys.clientId);
                        const savedName = getStored(storageKeys.name);
                        if (clientId && savedName && incomingGameId) {
                            autoJoinRef.current = true;
                            send({ type: "join", role: "participant", name: savedName, clientId });
                            setJoined(true);
                        }
                    }
                }
            }

            if (msg.type === "roundResult") {
                setRoundResult(msg.payload || []);
            }

            if (msg.type === "modeChanged") {
                const nextMode = msg.payload?.mode;
                if (nextMode && nextMode !== lastModeRef.current) {
                    handleModeChange(nextMode, { updateState: true });
                    if (isAdmin && desiredModeRef.current === nextMode) {
                        desiredModeRef.current = null;
                    }
                }
            }

            if (msg.type === "forceRejoin") {
                clearStored();
                setJoined(false);
                setPin(null);
                setRoundResult([]);
            }

            if (msg.type === "error") {
                setError(msg.payload || "不明なエラー");
            }
        };

        ws.onclose = () => setSocketReady(false);

        return () => ws.close();
    }, []);

    useEffect(() => {
        if (!socketReady) return;
        const timer = window.setInterval(() => {
            send({ type: "state:request" });
        }, 1500);

        return () => window.clearInterval(timer);
    }, [socketReady]);

    const mode = gameState.mode || "geo";
    const phase = gameState.phase;
    const performers = gameState.performers || [];
    const currentIndex = Number.isFinite(gameState.currentIndex) ? gameState.currentIndex : -1;
    const stats = gameState.stats || [];
    const player = gameState.player;
    const canGood = !isAdmin && joined && mode === "good" && (phase === "practice" || phase === "live");
    const canAnswer = !isAdmin && mode === "geo" && phase === "active";
    const revealedAnswer = gameState.revealedAnswer;

    const send = (payload) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        wsRef.current.send(JSON.stringify(payload));
    };

    const handleModeChange = (nextMode, { updateState } = { updateState: false }) => {
        if (!nextMode) return;
        lastModeRef.current = nextMode;
        if (updateState) {
            setGameState((prev) => ({ ...prev, mode: nextMode }));
        }
        if (!isAdmin) {
            if (nextMode === "good") {
                const clientId = getOrCreateClientId();
                send({ type: "join", role: "audience", clientId });
                setJoined(true);
            } else if (nextMode === "geo") {
                const clientId = getStored(storageKeys.clientId);
                const savedName = getStored(storageKeys.name) || name;
                if (clientId && savedName) {
                    send({ type: "join", role: "participant", name: savedName, clientId });
                    setJoined(true);
                } else {
                    setJoined(false);
                }
            }
        }
        send({ type: "state:request" });
    };

    const joinAs = () => {
        const clientId = getOrCreateClientId();
        send({
            type: "join",
            role: isAdmin ? "admin" : mode === "geo" ? "participant" : "audience",
            name: isAdmin || mode !== "geo" ? null : name,
            clientId: isAdmin ? null : clientId
        });
        if (!isAdmin && mode === "geo") {
            setStored(storageKeys.name, name);
        }
        setJoined(true);
        setError("");
    };

    const handlePick = (nextPin) => {
        setPin(nextPin);
        if (!canAnswer) return;
        send({ type: "answer:update", lat: nextPin.lat, lng: nextPin.lng });
    };

    const handleGood = () => {
        if (!canGood) return;
        if (phase === "live" && gameState.hasVotedCurrent) return;
        send({ type: "good" });
        setGoodFlash(true);
    };

    const confirmAndSend = (message, payload, confirmLabel = "実行", cancelLabel = "キャンセル") => {
        setConfirmState({
            open: true,
            title: "操作の確認",
            message,
            confirmLabel,
            cancelLabel,
            payload
        });
    };

    const handleConfirm = () => {
        if (confirmState.payload) {
            send(confirmState.payload);
            if (confirmState.payload.type === "admin:mode") {
                const nextMode = confirmState.payload.mode === "good" ? "good" : "geo";
                desiredModeRef.current = nextMode;
                setGameState((prev) => ({
                    ...prev,
                    mode: nextMode,
                    phase: "waiting",
                    currentIndex: -1,
                    stats: [],
                    audienceCount: 0,
                    hasVotedCurrent: false
                }));
                handleModeChange(nextMode, { updateState: false });
            }
        }
        setConfirmState({ open: false, title: "", message: "", confirmLabel: "", cancelLabel: "", payload: null });
    };

    const handleCancel = () => {
        setConfirmState({ open: false, title: "", message: "", confirmLabel: "", cancelLabel: "", payload: null });
    };

    useEffect(() => {
        if (mode !== "good") {
            setGoodFlash(false);
            return;
        }
        if (phase === "live") {
            setGoodFlash(false);
        }
    }, [mode, phase, currentIndex]);

    useEffect(() => {
        if (mode !== "good") {
            setGoodFlash(false);
            return;
        }
        if (phase !== "live" && phase !== "practice") {
            setGoodFlash(false);
        }
    }, [mode, phase]);

    useEffect(() => {
        if (goodFlash) {
            document.body.classList.add("good-flash");
        } else {
            document.body.classList.remove("good-flash");
        }

        return () => {
            document.body.classList.remove("good-flash");
        };
    }, [goodFlash]);

    if (isRankView) {
        if (!isAdmin) {
            return (
                <main className="page-shell min-h-screen p-4 md:p-10">
                    <section className="glass-card mx-auto mt-10 max-w-xl p-8">
                        <h1 className="mt-2 text-2xl font-extrabold text-primary">ランキング</h1>
                        <p className="mt-3 text-muted">このページは運営のみ閲覧できます。</p>
                    </section>
                </main>
            );
        }

        if (mode !== "geo") {
            return (
                <main className="page-shell min-h-screen p-4 md:p-10">
                    <section className="glass-card mx-auto mt-10 max-w-xl p-8">
                        <h1 className="mt-2 text-2xl font-extrabold text-primary">ランキング</h1>
                        <p className="mt-3 text-muted">ジオゲッサー企画でのみ表示されます。</p>
                    </section>
                </main>
            );
        }

        return (
            <RankingView
                ranking={gameState.ranking || []}
                scoreMode={gameState.scoreMode || "separate"}
                currentCategory={gameState.currentCategory || gameState.currentQuestion?.category || "trial"}
                socketReady={socketReady}
            />
        );
    }

    if (!joined) {
        return (
            <main className="page-shell min-h-screen p-4 md:p-10">
                <section className="glass-card mx-auto mt-10 max-w-xl p-8">
                    <h1 className="mt-2 text-3xl font-extrabold text-primary">{mode === "good" ? "ゴッドタレント" : "ジオゲッサー"}</h1>

                    {!isAdmin && mode === "geo" && (
                        <div className="mt-7">
                            <label className="block text-sm font-bold text-muted">ニックネーム</label>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                maxLength={24}
                                placeholder="例: しの"
                                className="input-field mt-2 w-full rounded-xl border px-4 py-3 outline-none ring-0 transition"
                            />
                        </div>
                    )}

                    <button
                        onClick={joinAs}
                        disabled={!socketReady || (!isAdmin && mode === "geo" && !name.trim())}
                        className="btn-main mt-8 w-full rounded-xl px-4 py-3 text-lg font-bold disabled:cursor-not-allowed"
                    >
                        {isAdmin ? "管理画面に入る" : "参加する"}
                    </button>

                    <p className="mt-3 text-sm text-muted">接続状態: {socketReady ? "接続済み" : "接続中..."}</p>
                </section>
            </main>
        );
    }

    if (isAdmin) {
        return (
            <>
                <AdminView
                    mode={mode}
                    onSwitchMode={(nextMode) =>
                        confirmAndSend(
                            nextMode === "geo" ? "ジオゲッサーに切り替えますか？" : "ゴッドタレントに切り替えますか？",
                            { type: "admin:mode", mode: nextMode },
                            "切り替える",
                            "やめる"
                        )
                    }
                    phase={phase}
                    gameState={gameState}
                    questionList={gameState.questionList || []}
                    currentQuestionIndex={gameState.currentQuestionIndex}
                    roundResult={roundResult}
                    performers={performers}
                    currentIndex={currentIndex}
                    stats={stats}
                    audienceCount={gameState.audienceCount || 0}
                    error={error}
                    onJumpGeo={(nextIndex) =>
                        confirmAndSend(
                            `第${nextIndex + 1}問へ移動して開始します。よろしいですか？`,
                            { type: "admin:jumpGeo", index: nextIndex },
                            "移動する",
                            "やめる"
                        )
                    }
                    onPractice={() => confirmAndSend("練習を開始します。よろしいですか？", { type: "admin:practice" }, "練習開始", "やめる")}
                    onStart={() => confirmAndSend("本番を開始します。よろしいですか？", { type: "admin:start" }, "本番開始", "やめる")}
                    onBack={() => confirmAndSend("前の出演者に戻ります。よろしいですか？", { type: "admin:back" }, "戻る", "戻らない")}
                    onJumpGood={(nextIndex) =>
                        confirmAndSend(
                            `${performers[nextIndex]?.name || "出演者"}に移動して開始します。よろしいですか？`,
                            { type: "admin:jumpGood", index: nextIndex },
                            "移動する",
                            "やめる"
                        )
                    }
                    onNext={() =>
                        confirmAndSend(
                            currentIndex >= performers.length - 1
                                ? "この出演者の集計を締め切って集計確認へ進みますか？"
                                : "この出演者の集計を締め切って次へ進みますか？",
                            { type: "admin:next" },
                            "進む",
                            "進まない"
                        )
                    }
                    onPublish={() => confirmAndSend("結果発表に進みます。よろしいですか？", { type: "admin:publish" }, "結果発表", "やめる")}
                    onClose={() => confirmAndSend("回答を締切ります。よろしいですか？", { type: "admin:close" })}
                    onReset={() => confirmAndSend("進行を完全にリセットします。参加者は再参加が必要です。続行しますか？", { type: "admin:reset" })}
                    onResetGood={() => confirmAndSend("ゴッドタレントの進行を完全にリセットします。続行しますか？", { type: "admin:resetGood" })}
                    formatDistance={formatDistance}
                />
                <ConfirmModal
                    open={confirmState.open}
                    title={confirmState.title}
                    message={confirmState.message}
                    confirmLabel={confirmState.confirmLabel}
                    cancelLabel={confirmState.cancelLabel}
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                />
            </>
        );
    }

    return (
        <PlayerView
            mode={mode}
            phase={phase}
            player={player}
            currentCategory={
                gameState.currentCategory ||
                gameState.currentQuestion?.category ||
                (gameState.currentQuestionIndex === 0
                    ? "trial"
                    : gameState.currentQuestionIndex >= 1 && gameState.currentQuestionIndex <= 5
                        ? "japan"
                        : gameState.currentQuestionIndex >= 6
                            ? "world"
                            : null)
            }
            playerAnswer={player?.currentAnswer || null}
            pin={pin}
            onPick={handlePick}
            canAnswer={canAnswer}
            revealedAnswer={revealedAnswer}
            performers={performers}
            currentIndex={currentIndex}
            stats={stats}
            audienceCount={gameState.audienceCount || 0}
            hasVotedCurrent={gameState.hasVotedCurrent}
            onGood={handleGood}
            canGood={canGood}
            error={error}
            formatDistance={formatDistance}
        />
    );
}
