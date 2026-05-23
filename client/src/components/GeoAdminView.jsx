export default function GeoAdminView({
    mode,
    onSwitchMode,
    phase,
    gameState,
    questionList,
    currentQuestionIndex,
    roundResult,
    error,
    onStart,
    onClose,
    onNext,
    onReset,
    onJumpGeo,
    formatDistance
}) {
    const phaseLabelMap = {
        waiting: "待機中",
        active: "回答受付中",
        closed: "締切",
        finished: "全問終了"
    };
    const phaseLabel = phaseLabelMap[phase] || "待機中";
    const questionCount = gameState.totalQuestions || 1;
    const currentQuestionNo = Math.min(gameState.currentQuestionIndex + 1, questionCount);

    return (
        <main className="page-shell min-h-screen p-3 md:p-6">
            <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 lg:grid-cols-12">
                <section className="glass-card p-5 lg:col-span-4">
                    <div className="mb-4 flex flex-wrap gap-2">
                        <button
                            className={mode === "geo" ? "btn-main rounded-lg px-4 py-2 text-sm font-bold" : "btn-outline rounded-lg px-4 py-2 text-sm font-bold"}
                            onClick={() => onSwitchMode("geo")}
                            disabled={mode === "geo"}
                        >
                            ジオゲッサー
                        </button>
                        <button
                            className={mode === "good" ? "btn-main rounded-lg px-4 py-2 text-sm font-bold" : "btn-outline rounded-lg px-4 py-2 text-sm font-bold"}
                            onClick={() => onSwitchMode("good")}
                            disabled={mode === "good"}
                        >
                            ゴッドタレント
                        </button>
                    </div>

                    <h2 className="text-4xl font-extrabold text-[var(--main-color)]">運営コントロール</h2>
                    <p className="mt-2 text-muted">問題 {currentQuestionNo} / {questionCount}</p>
                    <p className="mt-1 text-muted">状態: {phaseLabel}</p>

                    <div className="mt-5 space-y-2">
                        <button className="btn-main w-full rounded-lg px-4 py-3 font-bold" onClick={onStart}>
                            ゲーム開始
                        </button>
                        <button
                            className="btn-main w-full rounded-lg px-4 py-3 font-bold disabled:opacity-50"
                            onClick={onClose}
                            disabled={phase !== "active"}
                        >
                            制限時間終了・回答締切
                        </button>
                        <button
                            className="btn-main w-full rounded-lg px-4 py-3 font-bold disabled:opacity-50"
                            onClick={onNext}
                            disabled={phase !== "closed"}
                        >
                            次の問題へ
                        </button>
                        <button className="btn-dark w-full rounded-lg px-4 py-3 font-bold" onClick={onReset}>
                            進行を完全リセット
                        </button>
                    </div>

                    {error && <p className="alert-error mt-4 rounded-lg p-2 text-sm">{error}</p>}

                    <div className="mt-5">
                        <h3 className="text-xl font-bold text-[var(--main-color)]">ランキング</h3>
                        <ul className="mt-2 space-y-2">
                            {gameState.leaderboard?.map((row, i) => (
                                <li key={row.name + i} className="bg-card-soft flex items-center justify-between rounded-lg px-3 py-2">
                                    <span className="font-semibold text-primary">
                                        {i + 1}. {row.name}
                                    </span>
                                    <span className="font-bold">{row.totalScore}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {phase === "finished" && (
                        <div className="bg-card mt-5 rounded-xl p-4 text-primary">
                            <p className="text-sm opacity-80">最終結果</p>
                            <p className="text-xl font-bold">全問終了です。お疲れさまでした。</p>
                        </div>
                    )}

                    <div className="mt-5">
                        <h3 className="text-xl font-bold text-[var(--main-color)]">問題リスト</h3>
                        <ul className="mt-2 space-y-2">
                            {(questionList || []).map((row) => (
                                <li key={row.index} className="bg-card-soft flex items-center justify-between rounded-lg px-3 py-2">
                                    <div>
                                        <p className="text-sm text-muted">{row.label}</p>
                                    </div>
                                    <button
                                        className="btn-outline rounded-lg px-3 py-1 text-xs font-bold disabled:opacity-60"
                                        onClick={() => onJumpGeo(row.index)}
                                        disabled={row.index === currentQuestionIndex}
                                    >
                                        移動
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>
            </div>

            {roundResult.length > 0 && (
                <section className="glass-card mx-auto mt-4 max-w-7xl p-4">
                    <h3 className="text-xl font-bold text-[var(--main-color)]">直近問題の集計</h3>
                    <div className="mt-3 overflow-auto">
                        <table className="min-w-full text-left">
                            <thead>
                                <tr className="border-b border-theme text-muted">
                                    <th className="px-2 py-1">名前</th>
                                    <th className="px-2 py-1">距離</th>
                                    <th className="px-2 py-1">今回得点</th>
                                    <th className="px-2 py-1">合計</th>
                                </tr>
                            </thead>
                            <tbody>
                                {roundResult.map((row) => (
                                    <tr key={row.name} className="border-b border-theme text-primary">
                                        <td className="px-2 py-1">{row.name}</td>
                                        <td className="px-2 py-1">{formatDistance(row.distanceKm)}</td>
                                        <td className="px-2 py-1">{row.gained}</td>
                                        <td className="px-2 py-1 font-bold">{row.totalScore}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
        </main>
    );
}
