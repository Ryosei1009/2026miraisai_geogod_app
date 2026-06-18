import { useEffect, useState } from "react";

export default function GoodPlayerView({
    phase,
    performers,
    currentIndex,
    stats,
    audienceCount,
    hasVotedCurrent,
    onGood,
    canGood,
    error,
    socketReady
}) {
    const currentPerformer = performers[currentIndex] || null;
    const isWaiting = phase === "waiting";
    const isLive = phase === "live";
    const isReview = phase === "review";
    const isRanking = phase === "ranking";
    const goodDisabled = !canGood || (isLive && hasVotedCurrent);
    const [isPulsing, setIsPulsing] = useState(false);

    const handleGood = () => {
        if (goodDisabled) {
            return;
        }
        onGood();
        setIsPulsing(true);
    };

    useEffect(() => {
        if (!hasVotedCurrent) {
            setIsPulsing(false);
        }
    }, [hasVotedCurrent, currentPerformer?.no]);

    return (
        <main className="page-shell min-h-screen-safe relative flex overflow-hidden px-4 py-6">
            <div className="m-auto flex w-full max-w-2xl flex-col items-center justify-center gap-6 text-center">
                {error && <p className="alert-error w-full rounded-lg p-2 text-sm">{error}</p>}

                {isWaiting && (
                    <div className="glass-card doc-card w-full max-w-md p-8 text-center">
                        <p className="heading-chip justify-center text-xs font-bold uppercase tracking-[0.18em] text-subtle">PAVILION 02</p>
                        <h1 className="mt-3 text-2xl font-black text-primary sm:text-3xl">ゴッドタレント</h1>
                        <p className="mt-2 text-sm text-muted">企画開始までお待ちください。</p>
                        <p className="mt-4 text-xs text-subtle">接続状態: {socketReady ? "接続済み" : "接続中..."}</p>
                    </div>
                )}

                {(isLive || isReview) && currentPerformer && (
                    <div className="flex flex-col items-center gap-3">
                        <div className="flex items-center gap-1.5" aria-label={`出演 ${currentPerformer.no} / ${performers.length}`}>
                            {performers.map((p, i) => (
                                <span
                                    key={p.id ?? i}
                                    className={`progress-dot ${i < currentIndex ? "done" : i === currentIndex ? "current" : ""}`}
                                />
                            ))}
                        </div>
                        <p className="num text-xs font-semibold uppercase tracking-[0.2em] text-subtle">
                            {currentPerformer.no} / {performers.length}
                        </p>
                        <h2 className="text-2xl font-black text-primary">{currentPerformer.name}</h2>
                    </div>
                )}

                {isReview && (
                    <div className="glass-card doc-card w-full max-w-md p-6 text-center">
                        <h2 className="text-2xl font-extrabold text-primary">締め切り</h2>
                        <p className="mt-2 text-sm text-muted">集計中です。次の出演者までお待ちください。</p>
                    </div>
                )}

                {isRanking && (
                    <div className="glass-card doc-card w-full max-w-md p-8 text-center">
                        <p className="heading-chip justify-center text-xs font-bold uppercase tracking-[0.18em] text-subtle">RESULT</p>
                        <h2 className="mt-3 text-2xl font-black text-primary sm:text-3xl">ランキング発表中</h2>
                        <p className="mt-2 text-sm text-muted">スクリーンをご覧ください。</p>
                    </div>
                )}

                {isLive && (
                    <button
                        className={`good-ring h-64 w-64 max-w-full ${isPulsing ? "voted" : ""}`}
                        onClick={handleGood}
                        disabled={goodDisabled}
                        aria-label="Goodを送る"
                    >
                        <span className={`good-core ${hasVotedCurrent ? "voted" : ""}`}>
                            {hasVotedCurrent ? (
                                <>
                                    <span className="text-2xl font-black">投票済み</span>
                                    <span className="text-xs font-semibold opacity-80">ありがとうございました</span>
                                </>
                            ) : (
                                <span className="text-4xl font-black">Good!</span>
                            )}
                        </span>
                    </button>
                )}
            </div>
        </main>
    );
}
