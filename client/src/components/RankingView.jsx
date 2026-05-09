export default function RankingView({ ranking, scoreMode, currentCategory, socketReady }) {
    const categoryKey = currentCategory || "trial";
    const isCombined = scoreMode === "combined" && (categoryKey === "japan" || categoryKey === "world");
    const scoreLabelMap = { trial: "お試し", japan: "日本", world: "世界" };
    const scoreLabel = isCombined ? "日本+世界" : (scoreLabelMap[categoryKey] || "合計");
    const topThree = ranking.slice(0, 3);
    const podiumOrder = [1, 0, 2];
    const rest = ranking.slice(3);
    // const rest = [
    //     {name: "Alice", trialScore: 150, japanScore: 200, worldScore: 180, combinedScore: 380},
    //     {name: "Bob", trialScore: 120, japanScore: 220, worldScore: 160, combinedScore: 380},
    //     {name: "Charlie", trialScore: 130, japanScore: 210, worldScore: 170, combinedScore: 380},
    //     {name: "David", trialScore: 110, japanScore: 230, worldScore: 150, combinedScore: 380},
    //     {name: "Eve", trialScore: 140, japanScore: 190, worldScore: 160, combinedScore: 350},
    //     {name: "Frank", trialScore: 100, japanScore: 240, worldScore: 140, combinedScore: 380},
    //     {name: "Grace", trialScore: 160, japanScore: 180, worldScore: 170, combinedScore: 350},
    //     {name: "Heidi", trialScore: 170, japanScore: 170, worldScore: 160, combinedScore: 330},
    //     {name: "Ivan", trialScore: 180, japanScore: 160, worldScore: 150, combinedScore: 310},
    //     {name: "Judy", trialScore: 190, japanScore: 150, worldScore: 140, combinedScore: 290},
    //     {name: "Mallory", trialScore: 200, japanScore: 140, worldScore: 130, combinedScore: 270},
    //     {name: "Nina", trialScore: 210, japanScore: 130, worldScore: 120, combinedScore: 250},
    //     {name: "Oscar", trialScore: 220, japanScore: 120, worldScore: 110, combinedScore: 230},
    // ];

    return (
        <main className="page-shell min-h-screen p-3 md:p-6">
            <section className="glass-card mx-auto max-w-6xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-4xl font-extrabold text-accent">ランキング</h2>
                    <div className="flex items-center gap-3">
                        <span className="rounded-full border border-theme px-3 py-1 text-xs text-muted">{scoreLabel} モード</span>
                        <span className="text-sm text-muted">接続状態: {socketReady ? "接続済み" : "接続中..."}</span>
                    </div>
                </div>

                {ranking.length === 0 ? (
                    <p className="mt-6 text-muted">現在のランキングはありません。</p>
                ) : (
                    <>
                        <div className="mt-6 grid gap-4 md:grid-cols-3">
                            {podiumOrder.map((rankIndex) => {
                                const row = topThree[rankIndex];
                                if (!row) return null;
                                return (
                                    <div key={row.name + rankIndex} className={`bg-card-soft border border-theme rounded-2xl p-4 ${rankIndex === 0 ? "" : rankIndex === 1 ? "mt-8" : "mt-16"}`}>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted">#{rankIndex + 1}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <p className="mt-3 text-lg font-bold text-primary">{row.name}</p>
                                        <p className="mt-1 text-3xl font-extrabold text-accent">
                                            {isCombined
                                                ? row.combinedScore
                                                : categoryKey === "japan"
                                                    ? row.japanScore
                                                    : categoryKey === "world"
                                                        ? row.worldScore
                                                        : row.trialScore}
                                        </p>
                                    </div>
                                </div>
                                );
                            })}
                        </div>

                        <ol className="space-y-2 mt-8 mx-16">
                            {rest.map((row, index) => (
                                <li key={row.name + index} className="bg-card border border-theme rounded-xl px-4 py-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm text-muted">#{index + 4}</span>
                                            <span className="font-semibold text-primary">{row.name}</span>
                                        </div>
                                        <span className="text-lg font-bold text-accent">
                                            {isCombined
                                                ? row.combinedScore
                                                : categoryKey === "japan"
                                                    ? row.japanScore
                                                    : categoryKey === "world"
                                                        ? row.worldScore
                                                        : row.trialScore}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </>
                )}
            </section>
        </main>
    );
}
