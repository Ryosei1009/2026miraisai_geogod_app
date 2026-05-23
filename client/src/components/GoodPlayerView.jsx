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
    const currentStat = stats[currentIndex] || null;
    const isWaiting = phase === "waiting";
    const isLive = phase === "live";
    const isReview = phase === "review";
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
        <main
            className={`page-shell relative min-h-screen overflow-hidden bg-[#01010b] px-4 py-10 transition-[background] duration-500 ${
                isPulsing
                    ? "bg-[radial-gradient(circle_at_center,_rgba(96,239,255,0.35),_transparent_55%)]"
                    : "bg-[radial-gradient(circle_at_top,_rgba(96,239,255,0.16),_transparent_50%),radial-gradient(circle_at_bottom,_rgba(0,255,135,0.12),_transparent_60%)]"
            }`}
        >
            <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center gap-6 text-center">
                {error && <p className="alert-error w-full rounded-lg p-2 text-sm">{error}</p>}

                {isWaiting && (
                    <div className="py-10 text-center">
                        <h1 className="mt-3 text-2xl font-extrabold text-white sm:text-3xl">ゴッドタレント</h1>
                        <p className="mt-2 text-sm text-slate-300">ゴッドタレント企画開始までお待ちください。</p>

                        <p className="mt-4 text-xs text-slate-400">接続状態: {socketReady ? "接続済み" : "接続中..."}</p>
                    </div>
                )}

                {isLive && currentPerformer && (
                    <div className="flex flex-col items-center gap-2">
                        <p className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
                            {currentPerformer.no} / {performers.length}
                        </p>
                        <h2 className="text-lg font-semibold text-white">{currentPerformer.name}</h2>
                    </div>
                )}

                {isReview && (
                    <div className="py-10 text-center">
                        {currentPerformer && (
                            <div className="mb-4 flex flex-col items-center gap-2">
                                <p className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
                                    {currentPerformer.no}
                                </p>
                                <h2 className="text-lg font-semibold text-white">{currentPerformer.name}</h2>
                            </div>
                        )}
                        <h2 className="text-2xl font-extrabold text-white">締め切り</h2>
                    </div>
                )}

                {isLive && (
                    <div className="flex flex-col items-center gap-4">
                        <button
                            className="w-64 h-64 max-w-md rounded-full bg-gradient-to-br from-emerald-300 via-emerald-200 to-cyan-200 px-10 py-8 text-4xl font-extrabold text-slate-900 shadow-[0_20px_50px_rgba(0,255,135,0.35),0_16px_40px_rgba(96,239,255,0.3)] transition duration-150 hover:-translate-y-1 hover:shadow-[0_26px_60px_rgba(0,255,135,0.45),0_20px_45px_rgba(96,239,255,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={handleGood}
                            disabled={goodDisabled}
                        >
                            Good!
                        </button>
                    </div>
                )}

            </div>
        </main>
    );
}
