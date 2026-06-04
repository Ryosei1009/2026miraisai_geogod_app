import { useEffect, useMemo, useRef, useState } from "react";
import AdminView from "./components/AdminView";
import ConfirmModal from "./components/ConfirmModal";
import PlayerView from "./components/PlayerView";
import RankingView from "./components/RankingView";

const STORAGE_KEYS = {
    clientId: "geoguessr.clientId",
    name: "geoguessr.name",
    gameId: "geoguessr.gameId"
};

const getStored = (key) => window.localStorage.getItem(key) || "";
const setStored = (key, value) => window.localStorage.setItem(key, value);
const clearStored = () => {
    window.localStorage.removeItem(STORAGE_KEYS.clientId);
    window.localStorage.removeItem(STORAGE_KEYS.name);
    window.localStorage.removeItem(STORAGE_KEYS.gameId);
};

const getOrCreateClientId = () => {
    const existing = getStored(STORAGE_KEYS.clientId);
    if (existing) return existing;
    const fresh = `client_${Math.random().toString(36).slice(2, 10)}`;
    setStored(STORAGE_KEYS.clientId, fresh);
    return fresh;
};

const buildInitialGameState = () => ({
    mode: "geo",
    phase: "waiting",
    selfRole: "guest",
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

const categoryFromIndex = (index) => {
    if (index === 0) return "trial";
    if (index >= 1 && index <= 5) return "japan";
    if (index >= 6) return "world";
    return null;
};

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
    const isRankView = useMemo(() => new URLSearchParams(window.location.search).get("rank") === "1", []);

    const [socketReady, setSocketReady] = useState(false);
    const [joined, setJoined] = useState(false);
    const [name, setName] = useState("");
    const [wantsAdmin, setWantsAdmin] = useState(false);
    const [adminKey, setAdminKey] = useState("");
    const [showAdminPanel, setShowAdminPanel] = useState(false);
    const [pin, setPin] = useState(null);
    const [gameState, setGameState] = useState(buildInitialGameState);
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

    const isAdmin = gameState.selfRole === "admin";

    const wsRef = useRef(null);
    const joinedRef = useRef(false);
    const autoJoinRef = useRef(false);
    const lastModeRef = useRef("geo");
    const desiredModeRef = useRef(null);
    const pendingAdminRef = useRef(false);
    const isAdminRef = useRef(false);
    const wantsAdminRef = useRef(false);
    const reconnectAttemptsRef = useRef(0);
    const reconnectTimeoutRef = useRef(null);
    const heartbeatIntervalRef = useRef(null);
    const heartbeatTimeoutRef = useRef(null);
    const adminKeyRef = useRef("");

    useEffect(() => {
        joinedRef.current = joined;
    }, [joined]);

    useEffect(() => {
        isAdminRef.current = isAdmin;
    }, [isAdmin]);

    useEffect(() => {
        wantsAdminRef.current = wantsAdmin;
    }, [wantsAdmin]);

    useEffect(() => {
        adminKeyRef.current = adminKey;
    }, [adminKey]);

    useEffect(() => {
        const savedName = getStored(STORAGE_KEYS.name);
        if (savedName && !isAdmin) {
            setName(savedName);
        }
    }, [isAdmin]);

    useEffect(() => {
        if (!wantsAdmin) {
            setAdminKey("");
        }
    }, [wantsAdmin]);

    useEffect(() => {
        if (!showAdminPanel) {
            setWantsAdmin(false);
        }
    }, [showAdminPanel]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get("admin") === "1") {
            setShowAdminPanel(true);
            setWantsAdmin(true);
        }

        // WebSocket接続開始
        connectWebSocket();

        // バックグラウンド/フォアグラウンド遷移の検出
        const handleVisibilityChange = () => {
            if (!document.hidden && (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)) {
                // フォアグラウンドに戻ってきて、WebSocketが接続されていない場合は再接続
                reconnectAttemptsRef.current = 0;
                connectWebSocket();
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        // オンライン/オフライン遷移の検出
        const handleOnline = () => {
            if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
                reconnectAttemptsRef.current = 0;
                connectWebSocket();
            }
        };

        window.addEventListener("online", handleOnline);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("online", handleOnline);
            clearReconnectTimeout();
            clearHeartbeatInterval();
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, []);

    const send = (payload) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        wsRef.current.send(JSON.stringify(payload));
    };

    const clearReconnectTimeout = () => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
    };

    const clearHeartbeatInterval = () => {
        if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
        }
        if (heartbeatTimeoutRef.current) {
            clearTimeout(heartbeatTimeoutRef.current);
            heartbeatTimeoutRef.current = null;
        }
    };

    const connectWebSocket = () => {
        clearReconnectTimeout();
        clearHeartbeatInterval();

        const ws = new WebSocket(wsUrlFromWindow());
        wsRef.current = ws;

        ws.onopen = () => {
            reconnectAttemptsRef.current = 0;
            setSocketReady(true);

            // 再接続時に join メッセージを再送
            if (joinedRef.current) {
                // 既に参加していた場合は再度 join を送信
                const clientId = getStored(STORAGE_KEYS.clientId);
                const savedName = getStored(STORAGE_KEYS.name);

                if (isAdminRef.current) {
                    // 管理者の場合
                    const adminKey = String(adminKeyRef?.current || "").trim();
                    send({ type: "join", role: "admin", adminKey });
                } else if (clientId && savedName) {
                    // 参加者（geo）の場合
                    send({ type: "join", role: "participant", name: savedName, clientId });
                } else if (clientId) {
                    // オーディエンス（good）の場合
                    send({ type: "join", role: "audience", clientId });
                } else {
                    // 参加していなかった場合は自動再加入フラグをリセット
                    autoJoinRef.current = false;
                }
            }

            // ハートビート送信の開始（30秒ごと）
            heartbeatIntervalRef.current = setInterval(() => {
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    send({ type: "ping" });

                    // ハートビート応答タイムアウト設定（30秒以内にpongが来ないと再接続）
                    // サーバー負荷時にも余裕を持たせるため長めに設定
                    heartbeatTimeoutRef.current = setTimeout(() => {
                        console.warn("Heartbeat timeout - reconnecting...");
                        clearHeartbeatInterval();
                        setSocketReady(false);

                        // ハートビート失敗時は即座に再接続
                        reconnectAttemptsRef.current = 0;
                        reconnectTimeoutRef.current = setTimeout(() => {
                            connectWebSocket();
                        }, 500);
                    }, 30000);  // 30秒でタイムアウト（負荷時の余裕を確保）
                }
            }, 30000); // 30秒ごと
        };

        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);

            // ハートビート応答を受け取ったらタイムアウトをクリア
            if (msg.type === "pong") {
                if (heartbeatTimeoutRef.current) {
                    clearTimeout(heartbeatTimeoutRef.current);
                    heartbeatTimeoutRef.current = null;
                }
                return;
            }

            if (msg.type === "state") {
                const payload = msg.payload || {};
                setGameState(payload);

                if (pendingAdminRef.current) {
                    if (payload.selfRole === "admin") {
                        pendingAdminRef.current = false;
                    } else {
                        pendingAdminRef.current = false;
                        setJoined(false);
                        setError("管理者認証に失敗しました。");
                    }
                }

                if (isAdminRef.current && desiredModeRef.current && payload.mode && payload.mode !== desiredModeRef.current) {
                    send({ type: "admin:mode", mode: desiredModeRef.current });
                }

                if (payload.mode && payload.mode !== lastModeRef.current) {
                    handleModeChange(payload.mode, { updateState: false });
                }

                if (payload.mode === "geo") {
                    const incomingGameId = payload.gameId || "";
                    const storedGameId = getStored(STORAGE_KEYS.gameId);
                    if (incomingGameId && storedGameId && incomingGameId !== storedGameId) {
                        clearStored();
                        setJoined(false);
                        setPin(null);
                        autoJoinRef.current = false;
                    }
                    if (incomingGameId && incomingGameId !== storedGameId) {
                        setStored(STORAGE_KEYS.gameId, incomingGameId);
                    }

                    if (!isAdminRef.current && joinedRef.current && !payload.player) {
                        setJoined(false);
                        setPin(null);
                    }
                    if (payload.phase === "waiting") {
                        setRoundResult([]);
                    }
                    if (payload.phase !== "active") {
                        setPin(null);
                    }

                    if (!isAdminRef.current && !joinedRef.current && !autoJoinRef.current && !wantsAdminRef.current) {
                        const clientId = getStored(STORAGE_KEYS.clientId);
                        const savedName = getStored(STORAGE_KEYS.name);
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
                if (pendingAdminRef.current) {
                    pendingAdminRef.current = false;
                    setJoined(false);
                }
                setError(msg.payload || "不明なエラー");
            }
        };

        ws.onclose = () => {
            clearHeartbeatInterval();
            setSocketReady(false);

            // 自動再接続（初期遅延は短く、指数バックオフで段階的に増加）
            const delay = reconnectAttemptsRef.current === 0
                ? 500  // 最初は500msで即座に再接続
                : Math.min(500 * Math.pow(2, reconnectAttemptsRef.current - 1), 30000);

            reconnectAttemptsRef.current += 1;
            reconnectTimeoutRef.current = setTimeout(() => {
                connectWebSocket();
            }, delay);
        };

        ws.onerror = (error) => {
            clearHeartbeatInterval();
            setSocketReady(false);

            // エラーが発生した場合も即座に再接続を試みる
            const delay = reconnectAttemptsRef.current === 0
                ? 500  // 最初は500msで即座に再接続
                : Math.min(500 * Math.pow(2, reconnectAttemptsRef.current - 1), 30000);

            reconnectAttemptsRef.current += 1;
            reconnectTimeoutRef.current = setTimeout(() => {
                connectWebSocket();
            }, delay);
        };

        return () => {
            clearReconnectTimeout();
            clearHeartbeatInterval();
            ws.close();
        };
    };

    useEffect(() => {
        if (!socketReady) return;
        // 状態ポーリングの頻度を10秒に削減（サーバー負荷軽減）
        // 重要な状態変更はサーバーからpushされるため、これはバックアップ用
        const timer = window.setInterval(() => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                send({ type: "state:request" });
            }
        }, 10000);

        return () => window.clearInterval(timer);
    }, [socketReady]);

    const mode = gameState.mode || "geo";
    const phase = gameState.phase;
    const performers = gameState.performers || [];
    const currentIndex = Number.isFinite(gameState.currentIndex) ? gameState.currentIndex : -1;
    const stats = gameState.stats || [];
    const player = gameState.player;
    const canGood = !isAdmin && joined && mode === "good" && phase === "live";
    const canAnswer = !isAdmin && mode === "geo" && phase === "active";
    const revealedAnswer = gameState.revealedAnswer;

    const handleModeChange = (nextMode, { updateState } = { updateState: false }) => {
        if (!nextMode) return;
        lastModeRef.current = nextMode;
        if (updateState) {
            setGameState((prev) => ({ ...prev, mode: nextMode }));
        }
        if (!isAdmin && !wantsAdminRef.current) {
            if (nextMode === "good") {
                const clientId = getOrCreateClientId();
                send({ type: "join", role: "audience", clientId });
                setJoined(true);
            } else if (nextMode === "geo") {
                const clientId = getStored(STORAGE_KEYS.clientId);
                const savedName = getStored(STORAGE_KEYS.name) || name;
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
        const role = wantsAdmin ? "admin" : mode === "geo" ? "participant" : "audience";
        if (wantsAdmin) {
            pendingAdminRef.current = true;
        }
        send({
            type: "join",
            role,
            name: wantsAdmin || mode !== "geo" ? null : name,
            clientId: wantsAdmin ? null : clientId,
            adminKey: wantsAdmin ? adminKey : undefined
        });
        if (!wantsAdmin && mode === "geo") {
            setStored(STORAGE_KEYS.name, name);
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

    const resetConfirmState = () => {
        setConfirmState({ open: false, title: "", message: "", confirmLabel: "", cancelLabel: "", payload: null });
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
        resetConfirmState();
    };

    const handleCancel = () => {
        resetConfirmState();
    };

    useEffect(() => {
        if (mode !== "good" || phase !== "live") {
            setGoodFlash(false);
        }
    }, [mode, phase, currentIndex]);

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

    if (!joined) {
        return (
            <>
                {socketReady ? null : (
                    <div className="fixed w-full top-0 left-0 right-0 bg-amber-100 text-amber-800 p-4 text-center font-semibold z-50">接続されていません。</div>
                )}
                <main className={`page-shell min-h-screen p-4 md:p-10`}>
                    <section className="glass-card mx-auto mt-10 max-w-xl p-8">
                        <h1 className="mt-2 text-3xl font-extrabold text-primary">{mode === "good" ? "ゴッドタレント" : "ジオゲッサー"}</h1>
                        <p className="">司会者の指示に従ってください。</p>

                        {!wantsAdmin && mode === "geo" && (
                            <div className="mt-7">
                                <label className="block text-sm font-bold text-muted">ニックネーム</label>
                                <input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    maxLength={24}
                                    className="input-field mt-2 w-full rounded-xl border px-4 py-3 outline-none ring-0 transition"
                                />
                            </div>
                        )}

                        {!joined && showAdminPanel && (
                            <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
                                <label className="block text-sm font-bold text-muted">管理者キー</label>
                                <input
                                    value={adminKey}
                                    onChange={(e) => setAdminKey(e.target.value)}
                                    type="password"
                                    className="input-field mt-2 w-full rounded-xl border px-4 py-3 outline-none ring-0 transition"
                                />
                                <div className="mt-3 flex items-center justify-end gap-2">
                                    <button
                                        onClick={() => setShowAdminPanel(false)}
                                        className="rounded-lg border border-white/10 px-3 py-1 text-xs font-semibold text-muted"
                                    >
                                        閉じる
                                    </button>
                                    <button
                                        onClick={() => setWantsAdmin(true)}
                                        className="rounded-lg bg-white/10 px-3 py-1 text-xs font-semibold"
                                    >
                                        運営者として入る
                                    </button>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={joinAs}
                            disabled={
                                !socketReady ||
                                (wantsAdmin ? !adminKey.trim() : mode === "geo" && !name.trim())
                            }
                            className="btn-main mt-8 w-full rounded-xl px-4 py-3 text-lg font-bold disabled:cursor-not-allowed"
                        >
                            {wantsAdmin ? "管理画面に入る" : "参加する"}
                        </button>
                    </section>
                </main>
            </>
        );
    }

    if (isRankView) {
        return (
            <>
                {socketReady ? null : (
                    <div className="fixed w-full top-0 left-0 right-0 bg-amber-100 text-amber-800 p-4 text-center font-semibold z-50">接続されていません。</div>
                )}
                {!isAdmin ? (
                    <main className="page-shell min-h-screen p-4 md:p-10">
                        <section className="glass-card mx-auto mt-10 max-w-xl p-8">
                            <h1 className="mt-2 text-2xl font-extrabold text-primary">ランキング</h1>
                            <p className="mt-3 text-muted">このページは運営のみ閲覧できます。</p>
                        </section>
                    </main>
                ) : mode !== "geo" ? (
                    <main className="page-shell min-h-screen p-4 md:p-10">
                        <section className="glass-card mx-auto mt-10 max-w-xl p-8">
                            <h1 className="mt-2 text-2xl font-extrabold text-primary">ランキング</h1>
                            <p className="mt-3 text-muted">ジオゲッサー企画でのみ表示されます。</p>
                        </section>
                    </main>
                ) : (
                    <RankingView
                        ranking={gameState.ranking || []}
                        scoreMode={gameState.scoreMode || "separate"}
                        currentCategory={gameState.currentCategory || gameState.currentQuestion?.category || "trial"}
                        socketReady={socketReady}
                    />
                )}
            </>
        );
    }

    if (isAdmin) {
        return (
            <>
                {socketReady ? null : (
                    <div className="fixed w-full top-0 left-0 right-0 bg-amber-100 text-amber-800 p-4 text-center font-semibold z-50">接続されていません。</div>
                )}
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
                            phase === "live"
                                ? "この出演者の集計を締め切って締め切り後画面へ進みますか？"
                                : currentIndex >= performers.length - 1
                                    ? "待機画面へ戻りますか？"
                                    : "次の出演者へ進みますか？",
                            { type: "admin:next" },
                            "進む",
                            "進まない"
                        )
                    }
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
        <>
            {socketReady ? null : (
                <div className="fixed w-full top-0 left-0 right-0 bg-amber-100 text-amber-800 p-4 text-center font-semibold z-50">接続されていません。</div>
            )}
            <PlayerView
                mode={mode}
                phase={phase}
                player={player}
                currentCategory={
                    gameState.currentCategory ||
                    gameState.currentQuestion?.category ||
                    categoryFromIndex(gameState.currentQuestionIndex)
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
                socketReady={socketReady}
            />
        </>
    );
}
