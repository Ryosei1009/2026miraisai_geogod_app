export default function GoodPlayerView({
    phase,
    performers,
    currentIndex,
    stats,
    audienceCount,
    hasVotedCurrent,
    onGood,
    canGood,
    error
}) {
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

    const isWaiting = phase === "waiting";
    const isPractice = phase === "practice";
    const isLive = phase === "live";
    const isReview = phase === "review";
    const isResults = phase === "results";
    const goodDisabled = !canGood || (isLive && hasVotedCurrent);

    return (
        <main className="page-shell min-h-screen p-3 md:p-6">
            <section className="glass-card mx-auto max-w-3xl p-6 text-center">
                {error && <p className="alert-error mb-4 rounded-lg p-2 text-sm">{error}</p>}

                {isWaiting && (
                    <div className="py-10">
                        <h2 className="text-3xl font-extrabold text-primary">開始待機中</h2>
                        <p className="mt-3 text-muted">運営の開始操作をお待ちください。</p>
                    </div>
                )}

                {isPractice && (
                    <div className="py-4">
                        <p className="text-sm text-muted">練習タイム</p>
                        <h2 className="mt-2 text-3xl font-extrabold text-primary">Goodを押してみよう</h2>
                        <p className="mt-2 text-muted">本番前に操作を確認できます。</p>
                    </div>
                )}

                {isLive && currentPerformer && (
                    <div className="py-4">
                        <p className="text-sm text-muted">{currentPerformer.no} / {performers.length}</p>
                        <h2 className="mt-2 text-3xl font-extrabold text-primary">{currentPerformer.name}</h2>
                        <p className="mt-2 text-muted">Good率 {currentRate}%</p>
                    </div>
                )}

                {isReview && (
                    <div className="py-10">
                        <h2 className="text-3xl font-extrabold text-primary">集計中</h2>
                        <p className="mt-3 text-muted">結果発表までお待ちください。</p>
                    </div>
                )}

                {(isPractice || isLive) && (
                    <div className="mt-6 flex flex-col items-center gap-4">
                        <button
                            className="btn-main w-full max-w-xs rounded-full px-10 py-6 text-2xl font-extrabold disabled:opacity-60"
                            onClick={onGood}
                            disabled={goodDisabled}
                        >
                            Good!
                        </button>
                        {isLive && hasVotedCurrent && (
                            <p className="text-sm text-muted">Goodは送信済みです</p>
                        )}
                    </div>
                )}

                {isResults && (
                    <div className="py-4">
                        <h2 className="text-3xl font-extrabold text-primary">結果発表</h2>
                        <p className="mt-2 text-muted">観客数 {audienceCount}人</p>
                        <ol className="mt-6 space-y-3 text-left">
                            {rankedStats.map((row, index) => (
                                <li key={row.id} className="bg-card-soft flex items-center justify-between rounded-xl px-4 py-3">
                                    <div>
                                        <p className="text-sm text-muted">#{index + 1} {row.no}</p>
                                        <p className="text-lg font-bold text-primary">{row.name}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-muted">Good率</p>
                                        <p className="text-lg font-bold text-accent">{row.rate.toFixed(1)}%</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </div>
                )}
            </section>
        </main>
    );
}
