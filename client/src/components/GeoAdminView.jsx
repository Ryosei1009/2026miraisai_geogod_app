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
    onShowFinal,
    onRevealAnswer,
    onRevealRanking,
    onShowRanking,
    onRevealNext,
    onRevealPrev,
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

    // カテゴリ色：お試し＝黄 / 日本＝赤 / 世界＝青（未到達はグレー）
    const categoryColor = (index) => {
        if (index === 0) return "var(--expo-yellow)";
        if (index >= 1 && index <= 5) return "var(--expo-red)";
        return "var(--expo-blue)";
    };

    const primaryBtn = "btn-main w-full rounded-xl px-4 py-3 font-bold";
    const secondaryBtn = "btn-outline w-full rounded-xl px-4 py-3 font-bold disabled:opacity-40";

    // 締切→答え表示→その問題のランキング表示→（最終問なら）ランキング発表へ、の進行状態
    const isClosedPhase = phase === "closed" || phase === "finished";
    const answerRevealed = Boolean(gameState.answerRevealed);
    const rankingRevealed = Boolean(gameState.rankingRevealed);
    const canShowRanking = Boolean(gameState.canShowRanking);

    // ランキング段階発表（3位→2位→4〜8位→1位）の状態。announcement が立っている場面でのみ操作。
    const announcement = gameState.announcement || null;
    const revealStep = gameState.revealStep || 0;
    const announceTitleMap = { japan: "日本ランキング発表", world: "世界ランキング発表", combined: "総合ランキング発表" };
    const revealNextLabel = ["3位を発表", "2位を発表", "4〜8位を発表", "1位を発表"][revealStep] || "発表完了";
    const revealStatusLabel = ["まだ非表示", "3位まで公開", "2位まで公開", "4〜8位まで公開", "1位まで公開（完了）"][revealStep] || "";

    return (
        <main className="page-shell min-h-screen p-3 pt-6 md:p-6 md:pt-8">
            <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 lg:grid-cols-12">
                <section className="glass-card doc-card p-5 lg:col-span-4">
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

                    <h2 className="mt-2 text-3xl font-black text-primary">運営コントロール</h2>
                    <p className="num mt-2 text-muted">問題 {currentQuestionNo} / {questionCount}</p>
                    <p className="mt-1 text-muted">状態: {phaseLabel}</p>

                    <div className="mt-3 flex gap-1" aria-hidden="true">
                        {(questionList || []).map((row) => (
                            <div
                                key={row.index}
                                className="h-1.5 flex-1 rounded-full"
                                style={{
                                    background:
                                        row.index <= currentQuestionIndex ? categoryColor(row.index) : "var(--border-color)"
                                }}
                            />
                        ))}
                    </div>

                    <div className="mt-5 space-y-2">
                        <button className={phase === "waiting" ? primaryBtn : secondaryBtn} onClick={onStart}>
                            ゲーム開始
                        </button>
                        <button
                            className={phase === "active" ? primaryBtn : secondaryBtn}
                            onClick={onClose}
                            disabled={phase !== "active"}
                        >
                            制限時間終了・回答締切
                        </button>
                        <button
                            className={isClosedPhase && !answerRevealed ? primaryBtn : secondaryBtn}
                            onClick={onRevealAnswer}
                            disabled={!isClosedPhase || answerRevealed}
                        >
                            答えを表示
                        </button>
                        <button
                            className={isClosedPhase && answerRevealed && !rankingRevealed ? primaryBtn : secondaryBtn}
                            onClick={onRevealRanking}
                            disabled={!isClosedPhase || !answerRevealed || rankingRevealed}
                        >
                            その問題のランキングを表示
                        </button>
                        {canShowRanking && !announcement && (
                            <button className={primaryBtn} onClick={onShowRanking}>
                                ランキング発表へ
                            </button>
                        )}
                        <button
                            className={phase === "closed" && rankingRevealed ? primaryBtn : secondaryBtn}
                            onClick={onNext}
                            disabled={phase !== "closed" || !rankingRevealed}
                        >
                            次の問題へ
                        </button>
                    </div>

                    {error && <p className="alert-error mt-4 rounded-lg p-2 text-sm">{error}</p>}

                    {announcement && (
                        <div className="mt-5 rounded-xl border-2 border-theme bg-card-soft p-4">
                            <p className="heading-chip text-xs font-bold uppercase tracking-[0.18em] text-subtle">ANNOUNCEMENT</p>
                            <h3 className="mt-1 text-xl font-black text-primary">{announceTitleMap[announcement]}</h3>
                            <p className="mt-1 text-sm text-muted">投影画面: {revealStatusLabel}</p>
                            <button
                                className="btn-main mt-3 w-full rounded-xl px-4 py-3 text-lg font-bold disabled:opacity-40"
                                onClick={onRevealNext}
                                disabled={revealStep >= 4}
                            >
                                {revealNextLabel}
                            </button>
                            <button
                                className="btn-outline mt-2 w-full rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-40"
                                onClick={onRevealPrev}
                                disabled={revealStep <= 0}
                            >
                                1つ戻す
                            </button>
                            {/* 世界ランキングを最後まで発表したら、続けて総合ランキングへ */}
                            {announcement === "world" && (
                                <button
                                    className="btn-main mt-3 w-full rounded-xl px-4 py-3 text-lg font-bold disabled:opacity-40"
                                    onClick={onShowFinal}
                                    disabled={revealStep < 3}
                                >
                                    総合ランキングを表示
                                </button>
                            )}
                        </div>
                    )}

                    <div className="mt-5">
                        <h3 className="heading-chip text-xl font-bold text-primary">ランキング</h3>
                        <ul className="mt-2 space-y-2">
                            {gameState.leaderboard?.map((row, i) => (
                                <li key={row.name + i} className="bg-card-soft flex items-center justify-between rounded-lg px-3 py-2">
                                    <span className="font-semibold text-primary">
                                        {i + 1}. {row.name}
                                    </span>
                                    <span className="num font-bold text-accent">{row.totalScore}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {phase === "finished" && (
                        <div className="bg-card-soft mt-5 rounded-xl p-4 text-primary">
                            <p className="text-sm text-muted">最終結果</p>
                            <p className="text-xl font-bold">全問終了です。お疲れさまでした。</p>
                        </div>
                    )}

                    <div className="mt-5">
                        <h3 className="heading-chip text-xl font-bold text-primary">問題リスト</h3>
                        <ul className="mt-2 space-y-2">
                            {(questionList || []).map((row) => (
                                <li key={row.index} className="bg-card-soft flex items-center justify-between rounded-lg px-3 py-2">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="h-2.5 w-2.5 flex-none rounded-sm"
                                            style={{ background: categoryColor(row.index) }}
                                            aria-hidden="true"
                                        />
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

                    <div className="mt-6 border-t border-theme pt-4">
                        <p className="text-xs font-bold text-subtle">危険な操作</p>
                        <button className="btn-danger mt-2 w-full rounded-xl px-4 py-3 font-bold" onClick={onReset}>
                            進行を完全リセット
                        </button>
                    </div>
                </section>
            </div>

            {roundResult.length > 0 && (
                <section className="glass-card doc-card mx-auto mt-4 max-w-7xl p-4">
                    <h3 className="heading-chip text-xl font-bold text-primary">直近問題の集計</h3>
                    <div className="mt-3 overflow-auto">
                        <table className="num min-w-full text-left">
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
