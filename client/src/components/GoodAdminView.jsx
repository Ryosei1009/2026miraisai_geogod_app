export default function GoodAdminView({
    mode,
    onSwitchMode,
    phase,
    performers,
    currentIndex,
    stats,
    audienceCount,
    error,
    onStart,
    onBack,
    onNext,
    onJumpGood,
    onResetGood
}) {
    const phaseLabelMap = {
        waiting: "待機中",
        live: "本番中",
        review: "締め切り後"
    };
    const phaseLabel = phaseLabelMap[phase] || "待機中";

    const currentPerformer = performers[currentIndex] || null;
    const currentStat = stats[currentIndex] || null;
    const currentRate = currentStat && currentStat.participantCount > 0
        ? ((currentStat.goodCount / currentStat.participantCount) * 100).toFixed(1)
        : "0.0";

    const rankedStats = [...stats]
        .map((row) => {
            const rate = row.participantCount > 0 ? (row.goodCount / row.participantCount) * 100 : 0;
            return { ...row, rate };
        })
        .sort((a, b) => b.rate - a.rate);

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
                    <p className="mt-2 text-muted">状態: {phaseLabel}</p>
                    <p className="mt-1 text-muted">観客接続数: {audienceCount}人</p>

                    {currentPerformer && (
                        <div className="bg-card-soft mt-4 rounded-xl p-3">
                            <p className="text-sm text-muted">現在の出演</p>
                            <p className="text-lg font-bold text-primary">
                                {currentPerformer.no} {currentPerformer.name}
                            </p>
                            <div className="mt-2 flex items-center justify-between text-sm text-muted">
                                <span>Good {currentStat?.goodCount ?? 0}票</span>
                                <span>Good率 {currentRate}%</span>
                            </div>
                        </div>
                    )}

                    <div className="mt-5 space-y-2">
                        {phase === "waiting" && (
                            <button className="btn-main w-full rounded-lg px-4 py-3 font-bold" onClick={onStart}>
                                開始
                            </button>
                        )}

                        {phase === "live" && (
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    className="btn-dark rounded-lg px-4 py-3 font-bold disabled:opacity-50"
                                    onClick={onBack}
                                    disabled={currentIndex <= 0}
                                >
                                    戻る
                                </button>
                                <button
                                    className="btn-main rounded-lg px-4 py-3 font-bold disabled:opacity-50"
                                    onClick={onNext}
                                    disabled={currentIndex < 0}
                                >
                                    締め切り
                                </button>
                            </div>
                        )}

                        {phase === "review" && (
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    className="btn-dark rounded-lg px-4 py-3 font-bold"
                                    onClick={onBack}
                                >
                                    投票に戻る
                                </button>
                                <button
                                    className="btn-main rounded-lg px-4 py-3 font-bold"
                                    onClick={onNext}
                                >
                                    {currentIndex >= performers.length - 1 ? "待機へ" : "次の出演者"}
                                </button>
                            </div>
                        )}

                        <button className="btn-dark w-full rounded-lg px-4 py-3 font-bold" onClick={onResetGood}>
                            進行を完全リセット
                        </button>
                    </div>

                    {error && <p className="alert-error mt-4 rounded-lg p-2 text-sm">{error}</p>}
                </section>

                <section className="glass-card p-5 lg:col-span-8">
                    <h3 className="text-2xl font-bold text-[var(--main-color)]">出演者一覧</h3>
                    <ul className="mt-3 grid gap-2 md:grid-cols-2">
                        {performers.map((performer, index) => {
                            const isCurrent = phase === "live" && index === currentIndex;
                            return (
                                <li
                                    key={performer.id}
                                    className={`rounded-xl border border-theme px-4 py-3 ${isCurrent ? "bg-card-soft" : "bg-card"}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-muted">{performer.no}</p>
                                            <p className="text-lg font-bold text-primary">{performer.name}</p>
                                        </div>
                                        <button
                                            className="btn-outline rounded-lg px-3 py-1 text-xs font-bold disabled:opacity-60"
                                            onClick={() => onJumpGood(index)}
                                            disabled={index === currentIndex}
                                        >
                                            移動
                                        </button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>

                    <h3 className="mt-6 text-2xl font-bold text-[var(--main-color)]">暫定順位</h3>
                    <ul className="mt-3 space-y-2">
                        {rankedStats.map((row, index) => (
                            <li key={row.id} className="bg-card-soft flex items-center justify-between rounded-lg px-4 py-3">
                                <div>
                                    <p className="text-sm text-muted">#{index + 1} {row.no}</p>
                                    <p className="font-semibold text-primary">{row.name}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-muted">Good率</p>
                                    <p className="text-lg font-bold text-accent">{row.rate.toFixed(1)}%</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </main>
    );
}
