export default function RankingView({ ranking, scoreMode, socketReady }) {
    const isCombined = scoreMode === "combined";

    return (
        <main className="page-shell min-h-screen p-3 md:p-6">
            <section className="glass-card mx-auto max-w-5xl p-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-4xl font-extrabold text-[var(--main-color)]">ランキング</h2>
                    <span className="text-sm text-muted">接続状態: {socketReady ? "接続済み" : "接続中..."}</span>
                </div>

                {ranking.length === 0 ? (
                    <p className="mt-6 text-muted">現在のランキングはありません。</p>
                ) : (
                    <div className="mt-6 overflow-auto">
                        <table className="min-w-full text-left">
                            <thead>
                                <tr className="border-b border-theme text-muted">
                                    <th className="px-2 py-2">順位</th>
                                    <th className="px-2 py-2">名前</th>
                                    <th className="px-2 py-2">お試し</th>
                                    {isCombined ? (
                                        <th className="px-2 py-2">日本+世界</th>
                                    ) : (
                                        <>
                                            <th className="px-2 py-2">日本</th>
                                            <th className="px-2 py-2">世界</th>
                                        </>
                                    )}
                                    <th className="px-2 py-2">合計</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ranking.map((row, index) => (
                                    <tr key={row.name + index} className="border-b border-theme text-primary">
                                        <td className="px-2 py-2">{index + 1}</td>
                                        <td className="px-2 py-2 font-semibold">{row.name}</td>
                                        <td className="px-2 py-2">{row.trialScore}</td>
                                        {isCombined ? (
                                            <td className="px-2 py-2">{row.combinedScore}</td>
                                        ) : (
                                            <>
                                                <td className="px-2 py-2">{row.japanScore}</td>
                                                <td className="px-2 py-2">{row.worldScore}</td>
                                            </>
                                        )}
                                        <td className="px-2 py-2 font-bold">{row.totalScore}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </main>
    );
}
