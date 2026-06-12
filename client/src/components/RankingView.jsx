import { useEffect, useMemo, useRef } from "react";
import { GoogleMap, MarkerF, useJsApiLoader } from "@react-google-maps/api";

// プロジェクター投影用ランキング。ホール後方からも読めるよう
// 文字サイズを大きく取り、上位3名を表彰台で強調する。
const PODIUM = [
    { color: "var(--expo-red)", label: "1st" },
    { color: "var(--expo-blue)", label: "2nd" },
    { color: "var(--expo-yellow)", label: "3rd" }
];

const JAPAN_CENTER = { lat: 36, lng: 138 };

const mapOptions = {
    clickableIcons: false,
    fullscreenControl: false,
    mapTypeControl: false,
    streetViewControl: false,
    styles: [
        {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }]
        }
    ]
};

// 締切後の結果マップ：参加者全員のピン（青の小円）と正解ピン（標準の赤マーカー）を表示し、
// 問題が切り替わるたびに正解の位置へ自動でフォーカスする。
function ResultMap({ phase, currentQuestionIndex, currentCategory, revealedAnswer, allPins }) {
    const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;
    const mapRef = useRef(null);

    const { isLoaded, loadError } = useJsApiLoader({
        id: "google-map-script",
        googleMapsApiKey: mapsKey || "",
        language: "ja",
        region: "JP"
    });

    const participantPinIcon = useMemo(() => {
        if (!isLoaded || !window.google?.maps) return undefined;
        return {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: "#0068b7",
            fillOpacity: 0.9,
            strokeColor: "#ffffff",
            strokeWeight: 2
        };
    }, [isLoaded]);

    // 最新のフォーカス先。マップのロード完了が state 更新より
    // 遅れることがあるため、ref に保持して effect と onLoad の両方から参照する
    const focusRef = useRef(null);
    focusRef.current = revealedAnswer
        ? { answer: revealedAnswer, pins: allPins, fallbackZoom: currentCategory === "world" ? 4 : 6 }
        : null;

    const haversineKm = (a, b) => {
        const toRad = (deg) => (deg * Math.PI) / 180;
        const dLat = toRad(b.lat - a.lat);
        const dLng = toRad(b.lng - a.lng);
        const s =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
        return 6371 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
    };

    // 正解に近い順で80%の回答者がギリギリ収まる範囲にズームを毎回自動調整する。
    // 遠すぎる外れ値（下位20%）は無視して、見せ場が潰れないようにする。
    const focusAnswer = (map) => {
        const target = focusRef.current;
        if (!map || !target) return;
        const { answer, pins, fallbackZoom } = target;

        if (!pins?.length || !window.google?.maps) {
            map.panTo(answer);
            map.setZoom(fallbackZoom);
            return;
        }

        const nearest = [...pins]
            .sort((a, b) => haversineKm(a, answer) - haversineKm(b, answer))
            .slice(0, Math.max(1, Math.ceil(pins.length * 0.8)));

        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend(answer);
        for (const pin of nearest) {
            bounds.extend({ lat: pin.lat, lng: pin.lng });
        }
        map.fitBounds(bounds, 64);

        // 全員が正解至近だとfitBoundsが建物レベルまで寄りすぎるため上限を設ける
        const listener = map.addListener("idle", () => {
            if (map.getZoom() > 15) map.setZoom(15);
            window.google.maps.event.removeListener(listener);
        });
    };

    // 問題（ラウンド）が切り替わって締め切られるたびに、正解位置へフォーカス。
    // allPins は締切時に確定するため、依存は座標と問題番号と人数で十分
    // （ブロードキャストごとの配列再生成で再フォーカスしないようにする）
    useEffect(() => {
        focusAnswer(mapRef.current);
    }, [revealedAnswer?.lat, revealedAnswer?.lng, currentQuestionIndex, currentCategory, allPins.length]);

    const showPins = phase === "closed" || phase === "finished";

    if (!mapsKey || loadError) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-card-soft">
                <p className="text-muted">地図を表示できません。</p>
            </div>
        );
    }
    if (!isLoaded) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-card-soft">
                <p className="text-muted">地図読み込み中...</p>
            </div>
        );
    }

    return (
        <GoogleMap
            center={JAPAN_CENTER}
            zoom={5}
            mapContainerClassName="h-full w-full"
            options={mapOptions}
            onLoad={(map) => {
                mapRef.current = map;
                focusAnswer(map);
            }}
            onUnmount={() => {
                mapRef.current = null;
            }}
        >
            {showPins &&
                allPins.map((pin, index) => (
                    <MarkerF
                        key={`${pin.name}-${index}`}
                        position={{ lat: pin.lat, lng: pin.lng }}
                        icon={participantPinIcon}
                        title={pin.name}
                    />
                ))}
            {showPins && revealedAnswer && <MarkerF position={revealedAnswer} zIndex={1000} />}
        </GoogleMap>
    );
}

export default function RankingView({
    ranking,
    scoreMode,
    currentCategory,
    socketReady,
    phase,
    currentQuestionIndex,
    revealedAnswer,
    allPins = [],
    finalRankingVisible = false
}) {
    const categoryKey = currentCategory || "trial";
    const isCombined = scoreMode === "combined" && (categoryKey === "japan" || categoryKey === "world");
    const scoreLabelMap = { trial: "お試し", japan: "日本", world: "世界" };
    // 全問終了後に運営がボタンを押すと「総合（日本+世界の合算）」表示へ切り替わる
    const showFinal = finalRankingVisible;
    const scoreLabel = showFinal ? "総合（日本+世界）" : isCombined ? "日本+世界" : (scoreLabelMap[categoryKey] || "合計");

    const getScoreValue = (row) => {
        if (showFinal || isCombined) return row.combinedScore;
        if (categoryKey === "japan") return row.japanScore;
        if (categoryKey === "world") return row.worldScore;
        return row.trialScore;
    };

    // サーバーの並びは総得点順のため、表示中のスコアで並べ直す
    const sortedRanking = [...ranking].sort((a, b) => getScoreValue(b) - getScoreValue(a));
    const topThree = sortedRanking.slice(0, 3);
    const podiumOrder = [1, 0, 2];
    const rest = sortedRanking.slice(3);

    return (
        <main className="page-shell min-h-screen p-4 pt-6 md:p-8 md:pt-20">
            <div className="mx-auto max-w-[1500px]">
                <div className="flex flex-wrap items-end justify-between gap-4 border-b-4 border-[var(--expo-black)] pb-3">
                    <div>
                        <p className="heading-chip text-sm font-bold uppercase tracking-[0.22em] text-subtle">RESULT</p>
                        <h2 className="mt-1 text-4xl font-black text-primary md:text-5xl">ランキング</h2>
                    </div>
                    <div className="flex items-center gap-3 pb-2">
                        <span className="rounded-full border-2 border-theme px-5 py-1.5 text-lg font-bold text-primary md:text-xl">{scoreLabel}</span>
                        <span
                            className={`h-4 w-4 rounded-full ${socketReady ? "bg-[var(--expo-blue)]" : "bg-[var(--expo-red)]"}`}
                            title={socketReady ? "接続済み" : "接続中..."}
                            aria-label={socketReady ? "接続済み" : "接続中..."}
                        />
                    </div>
                </div>

                {!showFinal && (
                <div className="mt-4 overflow-hidden rounded-2xl border-2 border-theme bg-card">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-theme px-5 py-2">
                        <p className="heading-chip text-base font-bold text-primary">
                            結果マップ
                            {(phase === "closed" || phase === "finished") && Number.isFinite(currentQuestionIndex)
                                ? `　第${currentQuestionIndex + 1}問`
                                : ""}
                        </p>
                        {(phase === "closed" || phase === "finished") ? (
                            <div className="flex items-center gap-5 text-sm font-bold">
                                <span className="flex items-center gap-2 text-primary">
                                    <span className="h-4 w-4 rounded-full border-2 border-white bg-[var(--expo-blue)]" aria-hidden="true" />
                                    参加者の回答（{allPins.length}人）
                                </span>
                                <span className="flex items-center gap-2 text-primary">
                                    <span className="h-4 w-4 rounded-full bg-[var(--expo-red)]" aria-hidden="true" />
                                    正解
                                </span>
                            </div>
                        ) : (
                            <p className="text-sm text-muted">回答締め切り後に全員のピンが表示されます</p>
                        )}
                    </div>
                    <div className="h-[40vh] w-full">
                        <ResultMap
                            phase={phase}
                            currentQuestionIndex={currentQuestionIndex}
                            currentCategory={categoryKey}
                            revealedAnswer={revealedAnswer}
                            allPins={allPins}
                        />
                    </div>
                </div>
                )}

                {ranking.length === 0 ? (
                    <p className="mt-10 text-3xl text-muted">現在のランキングはありません。</p>
                ) : (
                    <>
                        <div className="mt-4 grid items-end gap-4 md:grid-cols-3">
                            {podiumOrder.map((rankIndex) => {
                                const row = topThree[rankIndex];
                                if (!row) return null;
                                const podium = PODIUM[rankIndex];
                                return (
                                    <div
                                        key={row.name + rankIndex}
                                        className={`bg-card rounded-2xl border-2 border-theme p-4 md:px-6 ${
                                            rankIndex === 0 ? "md:pb-14" : rankIndex === 1 ? "md:pb-7" : "md:pb-3"
                                        }`}
                                        style={{ borderTop: `10px solid ${podium.color}` }}
                                    >
                                        <div className="flex min-w-0 items-baseline gap-3">
                                            <span className="num text-3xl font-black md:text-4xl" style={{ color: podium.color }}>
                                                {rankIndex + 1}
                                            </span>
                                            <span className="truncate text-2xl font-black text-primary md:text-3xl">{row.name}</span>
                                        </div>
                                        <p className="num mt-1 text-5xl font-black text-primary md:text-6xl">
                                            {getScoreValue(row)}
                                            <span className="ml-2 text-xl font-bold text-subtle">pt</span>
                                        </p>
                                    </div>
                                );
                            })}
                        </div>

                        {rest.length > 0 && (
                            <ol className="mt-4 grid gap-x-12 md:grid-cols-2">
                                {rest.map((row, index) => (
                                    <li key={row.name + index} className="border-b-2 border-theme px-2 py-2">
                                        <div className="flex items-baseline justify-between gap-4">
                                            <div className="flex min-w-0 items-baseline gap-4">
                                                <span className="num w-10 flex-none text-right text-xl font-bold text-subtle md:text-2xl">
                                                    {index + 4}
                                                </span>
                                                <span className="truncate text-xl font-bold text-primary md:text-2xl">{row.name}</span>
                                            </div>
                                            <span className="num flex-none text-2xl font-black text-primary md:text-3xl">
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
