// ゴッドタレントのスクリーン投影用ビュー（?rank=1・運営のみ、ジオのランキング画面と同じ導線）。
// ・本番中: 現在の出演者と「投票受付中」を表示（票数は集計バイアスを避けるため見せない）
// ・締め切り後: その出演者の票数とGood率を大きく表示
// ・最終出演者の締切後（phase="ranking"）: 5位→4位→3位→2位・1位→全表示 と段階発表
const rateOf = (stat) =>
    stat && stat.participantCount > 0 ? (stat.goodCount / stat.participantCount) * 100 : 0;

function Header({ title, socketReady, badge }) {
    return (
        <div className="flex flex-wrap items-end justify-between gap-4 border-b-4 border-[var(--expo-black)] pb-3">
            <div>
                <p className="heading-chip text-sm font-bold uppercase tracking-[0.22em] text-subtle">GOD TALENT</p>
                <h2 className="mt-1 text-4xl font-black text-primary md:text-5xl">{title}</h2>
            </div>
            <div className="flex items-center gap-3 pb-2">
                {badge && (
                    <span className="rounded-full border-2 border-theme px-5 py-1.5 text-lg font-bold text-primary md:text-xl">
                        {badge}
                    </span>
                )}
                <span
                    className={`h-4 w-4 rounded-full ${socketReady ? "bg-[var(--expo-blue)]" : "bg-[var(--expo-red)]"}`}
                    title={socketReady ? "接続済み" : "接続中..."}
                    aria-label={socketReady ? "接続済み" : "接続中..."}
                />
            </div>
        </div>
    );
}

// 順位の色：1位=赤 / 2位=青 / 3位=黄 / それ以下=黒
const rankColor = (p) =>
    p === 1 ? "var(--expo-red)" : p === 2 ? "var(--expo-blue)" : p === 3 ? "var(--expo-yellow)" : "var(--expo-black)";

export default function GoodRankingView({ performers, stats, currentIndex, phase, revealStep = 0, audienceCount, socketReady }) {
    const currentPerformer = performers[currentIndex] || null;
    const currentStat = stats[currentIndex] || null;

    // 最終ランキング：Good率の高い順（同率は票数で比較）。index0=1位
    const finalRanking = performers
        .map((performer, index) => {
            const stat = stats[index];
            return { performer, goodCount: stat?.goodCount ?? 0, rate: rateOf(stat) };
        })
        .sort((a, b) => b.rate - a.rate || b.goodCount - a.goodCount);

    // ランキング発表フェーズ：5位→4位→3位→(2位,1位)→全表示 の段階公開。
    // 順位 p (1=1位..n=最下位) の公開ステップ：下位から1ずつ、最後に上位2名を同時公開。
    if (phase === "ranking") {
        const n = finalRanking.length;
        const revealStepForRank = (p) => (p <= 2 ? n - 1 : n - p + 1);
        const isRevealed = (p) => revealStep >= revealStepForRank(p);
        const isRecap = revealStep >= n;

        return (
            <main className="page-shell min-h-screen p-4 pt-6 md:p-8 md:pt-16">
                <div className="mx-auto max-w-[1200px]">
                    <Header
                        title={isRecap ? "最終結果" : "ランキング発表"}
                        socketReady={socketReady}
                        badge="Good率"
                    />

                    <div className="mt-6 space-y-3">
                        {finalRanking.map((row, index) => {
                            const p = index + 1;
                            const revealed = isRevealed(p);
                            const isNew = !isRecap && revealStepForRank(p) === revealStep;
                            const color = rankColor(p);
                            return (
                                <div
                                    key={row.performer.id}
                                    className={`bg-card rounded-2xl border-2 px-5 py-4 transition md:px-8 ${isNew ? "shadow-xl" : ""}`}
                                    style={{
                                        borderColor: revealed ? color : "var(--border-color)",
                                        borderLeftWidth: "12px",
                                        borderLeftColor: revealed ? color : "var(--border-color)"
                                    }}
                                >
                                    {revealed ? (
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex min-w-0 items-baseline gap-4">
                                                <span className="num text-4xl font-black md:text-6xl" style={{ color }}>
                                                    {p}
                                                </span>
                                                <span className="truncate text-3xl font-black text-primary md:text-5xl">
                                                    {row.performer.name}
                                                </span>
                                            </div>
                                            <span className="num flex-none text-4xl font-black text-primary md:text-6xl">
                                                {row.rate.toFixed(1)}
                                                <span className="ml-1 text-xl font-bold text-subtle md:text-2xl">%</span>
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between gap-4 text-subtle">
                                            <span className="num text-4xl font-black md:text-6xl">第{p}位</span>
                                            <span className="text-3xl font-black md:text-4xl">？</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="page-shell min-h-screen p-4 pt-6 md:p-8 md:pt-20">
            <div className="mx-auto max-w-[1500px]">
                <Header
                    title="ゴッドタレント"
                    socketReady={socketReady}
                    badge={phase === "live" ? "投票受付中" : phase === "review" ? "結果発表" : "待機中"}
                />

                {phase === "waiting" && (
                    <div className="bg-card mt-6 rounded-2xl border-2 border-theme p-10 text-center">
                        <p className="text-3xl font-black text-primary md:text-4xl">企画開始までお待ちください</p>
                        <p className="num mt-3 text-xl text-muted">観客接続数: {audienceCount}人</p>
                    </div>
                )}

                {phase === "live" && currentPerformer && (
                    <div
                        className="bg-card mt-6 rounded-2xl border-2 border-theme p-10 text-center"
                        style={{ borderTop: "10px solid var(--expo-red)" }}
                    >
                        <p className="num text-xl font-bold tracking-widest text-subtle">
                            {currentPerformer.no}（{currentIndex + 1} / {performers.length}）
                        </p>
                        <p className="mt-2 text-5xl font-black text-primary md:text-6xl">{currentPerformer.name}</p>
                        <p className="mt-6 inline-flex items-center gap-3 text-2xl font-bold text-primary md:text-3xl">
                            <span className="h-4 w-4 animate-pulse rounded-full bg-[var(--expo-red)]" aria-hidden="true" />
                            投票受付中...
                        </p>
                    </div>
                )}

                {phase === "review" && currentPerformer && (
                    <div
                        className="bg-card mt-6 rounded-2xl border-2 border-theme p-8 text-center md:p-10"
                        style={{ borderTop: "10px solid var(--expo-blue)" }}
                    >
                        <p className="num text-xl font-bold tracking-widest text-subtle">
                            {currentPerformer.no}（{currentIndex + 1} / {performers.length}）
                        </p>
                        <p className="mt-2 text-4xl font-black text-primary md:text-5xl">{currentPerformer.name}</p>
                        <div className="mx-auto mt-6 grid max-w-3xl gap-4 md:grid-cols-2">
                            <div className="rounded-2xl bg-card-soft p-6">
                                <p className="text-lg font-bold text-muted">Good票</p>
                                <p className="num text-6xl font-black text-primary md:text-7xl">
                                    {currentStat?.goodCount ?? 0}
                                    <span className="ml-2 text-2xl font-bold text-subtle">票</span>
                                </p>
                            </div>
                            <div className="rounded-2xl bg-card-soft p-6">
                                <p className="text-lg font-bold text-muted">Good率</p>
                                <p className="num text-6xl font-black text-primary md:text-7xl">
                                    {rateOf(currentStat).toFixed(1)}
                                    <span className="ml-2 text-2xl font-bold text-subtle">%</span>
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* 他グループの結果は途中では見せない。順位は全出演者終了後の最終ランキングでのみ表示する */}
                {phase === "review" && (
                    <p className="mt-6 text-center text-lg font-bold text-muted">
                        進行状況: {performers.filter((_, i) => stats[i]?.locked).length} / {performers.length} 組 採点済み
                    </p>
                )}
            </div>
        </main>
    );
}
