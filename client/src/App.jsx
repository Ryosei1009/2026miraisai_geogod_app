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
        phase: "waiting",
        currentQuestionIndex: 0,
        totalQuestions: 0,
        leaderboard: []
    });
    const [roundResult, setRoundResult] = useState([]);
    const [error, setError] = useState("");
    const [confirmState, setConfirmState] = useState({
        open: false,
        title: "",
        message: "",
        confirmLabel: "",
        payload: null
    });

    const wsRef = useRef(null);
    const joinedRef = useRef(false);
    const autoJoinRef = useRef(false);

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
                const incomingGameId = msg.payload.gameId || "";
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

                setGameState(msg.payload);
                if (!isAdmin && joinedRef.current && !msg.payload.player) {
                    setJoined(false);
                    setPin(null);
                }
                if (msg.payload.phase === "waiting") {
                    setRoundResult([]);
                }
                if (msg.payload.phase !== "active") {
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

            if (msg.type === "roundResult") {
                setRoundResult(msg.payload || []);
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

    const phase = gameState.phase;
    const player = gameState.player;
    const canAnswer = !isAdmin && phase === "active";
    const revealedAnswer = gameState.revealedAnswer;

    const send = (payload) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        wsRef.current.send(JSON.stringify(payload));
    };

    const joinAs = () => {
        const clientId = getOrCreateClientId();
        send({
            type: "join",
            role: isAdmin ? "admin" : "participant",
            name: isAdmin ? "運営" : name,
            clientId: isAdmin ? null : clientId
        });
        if (!isAdmin) {
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

    const confirmAndSend = (message, payload) => {
        setConfirmState({
            open: true,
            title: "操作の確認",
            message,
            confirmLabel: "実行",
            payload
        });
    };

    const handleConfirm = () => {
        if (confirmState.payload) {
            send(confirmState.payload);
        }
        setConfirmState({ open: false, title: "", message: "", confirmLabel: "", payload: null });
    };

    const handleCancel = () => {
        setConfirmState({ open: false, title: "", message: "", confirmLabel: "", payload: null });
    };

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
                    <h1 className="mt-2 text-3xl font-extrabold text-primary">ジオゲッサー</h1>

                    {!isAdmin && (
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
                        disabled={!socketReady || (!isAdmin && !name.trim())}
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
                    phase={phase}
                    gameState={gameState}
                    roundResult={roundResult}
                    error={error}
                    onStart={() => confirmAndSend("ゲームを開始します。よろしいですか？", { type: "admin:start" })}
                    onReset={() => confirmAndSend("進行を完全にリセットします。参加者は再参加が必要です。続行しますか？", { type: "admin:reset" })}
                    onClose={() => confirmAndSend("回答を締切ります。よろしいですか？", { type: "admin:close" })}
                    onNext={() => confirmAndSend("次の問題へ進みます。よろしいですか？", { type: "admin:next" })}
                    formatDistance={formatDistance}
                />
                <ConfirmModal
                    open={confirmState.open}
                    title={confirmState.title}
                    message={confirmState.message}
                    confirmLabel={confirmState.confirmLabel}
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                />
            </>
        );
    }

    const derivedCategory =
        gameState.currentCategory ||
        gameState.currentQuestion?.category ||
        (gameState.currentQuestionIndex === 0
            ? "trial"
            : gameState.currentQuestionIndex >= 1 && gameState.currentQuestionIndex <= 5
                ? "japan"
                : gameState.currentQuestionIndex >= 6
                    ? "world"
                    : null);

    return (
        <PlayerView
            phase={phase}
            player={player}
            currentCategory={derivedCategory}
            playerAnswer={player?.currentAnswer || null}
            pin={pin}
            onPick={handlePick}
            canAnswer={canAnswer}
            revealedAnswer={revealedAnswer}
            error={error}
            formatDistance={formatDistance}
        />
    );
}
