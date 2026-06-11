// プロジェクター投影用ランキング。ホール後方からも読めるよう
// 文字サイズを大きく取り、上位3名を表彰台で強調する。
const PODIUM = [
    { color: "var(--expo-red)", label: "1st" },
    { color: "var(--expo-blue)", label: "2nd" },
    { color: "var(--expo-yellow)", label: "3rd" }
];

export default function RankingView({ ranking, scoreMode, currentCategory, socketReady }) {
    const categoryKey = currentCategory || "trial";
    const isCombined = scoreMode === "combined" && (categoryKey === "japan" || categoryKey === "world");
    const scoreLabelMap = { trial: "お試し", japan: "日本", world: "世界" };
    const scoreLabel = isCombined ? "日本+世界" : (scoreLabelMap[categoryKey] || "合計");
    const topThree = ranking.slice(0, 3);
    const podiumOrder = [1, 0, 2];
    const rest = ranking.slice(3);

    const getScoreValue = (row) => {
        if (isCombined) return row.combinedScore;
        if (categoryKey === "japan") return row.japanScore;
        if (categoryKey === "world") return row.worldScore;
        return row.trialScore;
    };

    return (
        <main className="page-shell min-h-screen p-4 pt-8 md:p-10 md:pt-12">
            <div className="mx-auto max-w-[1500px]">
                <div className="flex flex-wrap items-end justify-between gap-4 border-b-4 border-[var(--expo-black)] pb-4">
                    <div>
                        <p className="heading-chip text-sm font-bold uppercase tracking-[0.22em] text-subtle">RESULT</p>
                        <h2 className="mt-1 text-5xl font-black text-primary md:text-7xl">ランキング</h2>
                    </div>
                    <div className="flex items-center gap-3 pb-2">
                        <span className="rounded-full border-2 border-theme px-5 py-2 text-xl font-bold text-primary md:text-2xl">{scoreLabel}</span>
                        <span
                            className={`h-4 w-4 rounded-full ${socketReady ? "bg-[var(--expo-blue)]" : "bg-[var(--expo-red)]"}`}
                            title={socketReady ? "接続済み" : "接続中..."}
                            aria-label={socketReady ? "接続済み" : "接続中..."}
                        />
                    </div>
                </div>

                {ranking.length === 0 ? (
                    <p className="mt-10 text-3xl text-muted">現在のランキングはありません。</p>
                ) : (
                    <>
                        <div className="mt-8 grid items-end gap-5 md:grid-cols-3">
                            {podiumOrder.map((rankIndex) => {
                                const row = topThree[rankIndex];
                                if (!row) return null;
                                const podium = PODIUM[rankIndex];
                                return (
                                    <div
                                        key={row.name + rankIndex}
                                        className={`bg-card rounded-2xl border-2 border-theme p-6 md:p-8 ${
                                            rankIndex === 0 ? "md:pb-16" : rankIndex === 1 ? "md:pb-10" : "md:pb-6"
                                        }`}
                                        style={{ borderTop: `12px solid ${podium.color}` }}
                                    >
                                        <div className="flex items-baseline gap-3">
                                            <span className="num text-4xl font-black md:text-5xl" style={{ color: podium.color }}>
                                                {rankIndex + 1}
                                            </span>
                                            <span className="text-xl font-bold uppercase tracking-widest text-subtle">{podium.label}</span>
                                        </div>
                                        <p className="mt-4 break-all text-3xl font-black leading-tight text-primary md:text-4xl">
                                            {row.name}
                                        </p>
                                        <p className="num mt-2 text-6xl font-black text-primary md:text-7xl">
                                            {getScoreValue(row)}
                                            <span className="ml-2 text-2xl font-bold text-subtle">pt</span>
                                        </p>
                                    </div>
                                );
                            })}
                        </div>

                        {rest.length > 0 && (
                            <ol className="mt-10 grid gap-x-12 gap-y-1 md:grid-cols-2">
                                {rest.map((row, index) => (
                                    <li key={row.name + index} className="border-b-2 border-theme px-2 py-3">
                                        <div className="flex items-baseline justify-between gap-4">
                                            <div className="flex min-w-0 items-baseline gap-4">
                                                <span className="num w-12 flex-none text-right text-2xl font-bold text-subtle md:text-3xl">
                                                    {index + 4}
                                                </span>
                                                <span className="truncate text-2xl font-bold text-primary md:text-3xl">{row.name}</span>
                                            </div>
                                            <span className="num flex-none text-3xl font-black text-primary md:text-4xl">
                                                {getScoreValue(row)}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </>
                )}
            </div>
        </main>
    );
}
