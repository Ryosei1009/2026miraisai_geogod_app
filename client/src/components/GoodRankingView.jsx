// ゴッドタレントのスクリーン投影用ビュー（?rank=1・運営のみ、ジオのランキング画面と同じ導線）。
// ・本番中: 現在の出演者と「投票受付中」を表示（票数は集計バイアスを避けるため見せない）
// ・締め切り後: その出演者の票数とGood率を大きく表示
// ・全出演者の採点が終わって待機に戻ったタイミングで最終ランキングへ自動で切り替わる
const PODIUM = [
    { color: "var(--expo-red)", label: "1st" },
    { color: "var(--expo-blue)", label: "2nd" },
    { color: "var(--expo-yellow)", label: "3rd" }
];

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

export default function GoodRankingView({ performers, stats, currentIndex, phase, audienceCount, socketReady }) {
    const currentPerformer = performers[currentIndex] || null;
    const currentStat = stats[currentIndex] || null;
    const allLocked =
        performers.length > 0 && performers.every((_, index) => stats[index]?.locked);
    const showFinal = allLocked && phase === "waiting";

    // 最終ランキング：Good率の高い順（同率は票数で比較）
    const finalRanking = performers
        .map((performer, index) => {
            const stat = stats[index];
            return { performer, goodCount: stat?.goodCount ?? 0, rate: rateOf(stat) };
        })
        .sort((a, b) => b.rate - a.rate || b.goodCount - a.goodCount);
    const podiumOrder = [1, 0, 2];
    const topThree = finalRanking.slice(0, 3);
    const rest = finalRanking.slice(3);

    if (showFinal) {
        return (
            <main className="page-shell min-h-screen p-4 pt-6 md:p-8 md:pt-20">
                <div className="mx-auto max-w-[1500px]">
                    <Header title="最終ランキング" socketReady={socketReady} badge="Good率" />

                    <div className="mt-6 grid items-end gap-4 md:grid-cols-3">
                        {podiumOrder.map((rankIndex) => {
                            const row = topThree[rankIndex];
                            if (!row) return null;
                            const podium = PODIUM[rankIndex];
                            return (
                                <div
                                    key={row.performer.id}
                                    className={`bg-card rounded-2xl border-2 border-theme p-4 md:px-6 ${
                                        rankIndex === 0 ? "md:pb-10" : rankIndex === 1 ? "md:pb-6" : "md:pb-4"
                                    }`}
                                    style={{ borderTop: `10px solid ${podium.color}` }}
                                >
                                    <div className="flex min-w-0 items-baseline gap-3">
                                        <span className="num text-3xl font-black md:text-4xl" style={{ color: podium.color }}>
                                            {rankIndex + 1}
                                        </span>
                                        <span className="truncate text-2xl font-black text-primary md:text-3xl">
                                            {row.performer.name}
                                        </span>
                                    </div>
                                    <p className="num mt-1 text-5xl font-black text-primary md:text-6xl">
                                        {row.rate.toFixed(1)}
                                        <span className="ml-2 text-xl font-bold text-subtle">%</span>
                                    </p>
                                    <p className="num mt-1 text-lg font-bold text-muted">Good {row.goodCount}票</p>
                                </div>
                            );
                        })}
                    </div>

                    {rest.length > 0 && (
                        <ol className="mt-4 grid gap-x-12 md:grid-cols-2">
                            {rest.map((row, index) => (
                                <li key={row.performer.id} className="border-b-2 border-theme px-2 py-2">
                                    <div className="flex items-baseline justify-between gap-4">
                                        <div className="flex min-w-0 items-baseline gap-4">
                                            <span className="num w-10 flex-none text-right text-xl font-bold text-subtle md:text-2xl">
                                                {index + 4}
                                            </span>
                                            <span className="truncate text-xl font-bold text-primary md:text-2xl">
                                                {row.performer.name}
                                            </span>
                                        </div>
                                        <span className="num flex-none text-2xl font-black text-primary md:text-3xl">
                                            {row.rate.toFixed(1)}
                                            <span className="ml-1 text-base font-bold text-subtle">%</span>
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    )}
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
