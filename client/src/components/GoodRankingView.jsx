import { useState } from "react";

// 表彰台/バーの顔写真。写真が無い・読み込めない場合は空の丸（プレースホルダー）にする。
function Avatar({ src, alt, sizeClass, color, show }) {
    const [failed, setFailed] = useState(false);
    const showImg = show && src && !failed;
    return (
        <div
            className={`flex-none overflow-hidden rounded-full border-4 bg-card ${sizeClass}`}
            style={{ borderColor: color }}
        >
            {showImg && (
                <img src={src} alt={alt} className="h-full w-full object-cover" onError={() => setFailed(true)} />
            )}
        </div>
    );
}

// ゴッドタレントのスクリーン投影用ビュー（?rank=1・運営のみ、ジオのランキング画面と同じ導線）。
// ・本番中: 現在の出演者と「投票受付中」を表示（票数は集計バイアスを避けるため見せない）
// ・締め切り後: その出演者の票数とGood率を大きく表示
// ・最終出演者の締切後（phase="ranking"）: 5位→4位→3位→2位・1位→全表示 と段階発表
const rateOf = (stat) =>
    stat && stat.participantCount > 0 ? (stat.goodCount / stat.participantCount) * 100 : 0;

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

        // 上位5位までを表示。1〜3位は表彰台（写真の丸＋％＋名前）、4〜5位は横長バー。
        const top5 = finalRanking.slice(0, 5);
        const podium = [
            { row: top5[1], p: 2 }, // 左
            { row: top5[0], p: 1 }, // 中央（最上位）
            { row: top5[2], p: 3 } // 右
        ];
        const bars = top5.slice(3); // 4位・5位

        return (
            <main className="page-shell min-h-screen p-4 pt-6 md:p-8 md:pt-12">
                <div className="mx-auto max-w-[1300px]">
                    {/* 表彰台：2位(左) / 1位(中央) / 3位(右) */}
                    <div className="grid grid-cols-3 items-end gap-3 mt-4 md:gap-33.75">
                        {podium.map(({ row, p }) => {
                            const color = rankColor(p);
                            const revealed = Boolean(row) && isRevealed(p);
                            const sizeClass =
                                p === 1 ? "h-40 w-40 md:h-100 md:w-100" : "h-28 w-28 md:h-84 md:w-84";
                            const lift = p === 1 ? "mb-6 md:mb-14" : p === 2 ? "mb-2 md:mb-6" : "";
                            return (
                                <div key={p} className={`flex flex-col items-center ${lift}`}>
                                    <span className="num text-5xl font-black md:text-7xl" style={{ color }}>
                                        {p}
                                    </span>
                                    <div className="mt-2">
                                        <Avatar
                                            src={revealed ? row.performer.photo : null}
                                            alt={revealed ? row.performer.name : ""}
                                            sizeClass={sizeClass}
                                            color={revealed ? color : "var(--border-color)"}
                                            show={revealed}
                                        />
                                    </div>
                                    {revealed ? (
                                        <p className="mt-6 text-center text-2xl font-black text-primary md:text-5xl">
                                            <span className="num" style={{ color }}>
                                                {Math.round(row.rate)}%
                                            </span>{" "}
                                            {row.performer.name}
                                        </p>
                                    ) : (
                                        <p className="mt-3 text-center text-3xl font-black text-subtle md:text-4xl">？</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* 4位・5位：横長バー */}
                    <div className="mx-auto max-w-5xl space-y-3 mt-14">
                        {bars.map((row, i) => {
                            const p = i + 4;
                            const color = rankColor(p);
                            const revealed = Boolean(row) && isRevealed(p);
                            return (
                                <div
                                    key={row?.performer.id ?? p}
                                    className={`${i===0 && 'mb-8'} bg-card flex items-center gap-8 rounded-4xl border-2 px-5 py-3 md:px-8`}
                                    style={{ borderColor: revealed ? color : "var(--border-color)" }}
                                >
                                    <span className="num w-10 flex-none text-4xl font-black md:text-6xl" style={{ color }}>
                                        {p}
                                    </span>
                                    <Avatar
                                        src={revealed ? row.performer.photo : null}
                                        alt={revealed ? row.performer.name : ""}
                                        sizeClass="h-14 w-14 md:h-28 md:w-28"
                                        color={revealed ? color : "var(--border-color)"}
                                        show={revealed}
                                    />
                                    {revealed ? (
                                        <>
                                            <span className="truncate text-2xl font-black text-primary md:text-5xl">
                                                {row.performer.name}
                                            </span>
                                            <span className="num ml-auto flex-none text-3xl font-black md:text-5xl" style={{ color }}>
                                                {Math.round(row.rate)}%
                                            </span>
                                        </>
                                    ) : (
                                        <span className="ml-2 text-2xl font-black text-subtle md:text-3xl">？</span>
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
