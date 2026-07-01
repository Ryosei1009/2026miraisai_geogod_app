import { useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, MarkerF, useJsApiLoader } from "@react-google-maps/api";

// 答え発表の写真。未設定・読み込み失敗時はプレースホルダにフォールバックする。
function AnswerPhoto({ src, alt }) {
    const [failed, setFailed] = useState(false);
    if (!src || failed) {
        return (
            <div className="flex h-[38vh] items-center justify-center rounded-2xl border-2 border-dashed border-theme bg-card-soft">
                <p className="text-2xl font-bold text-subtle">写真は準備中です</p>
            </div>
        );
    }
    return (
        <div className="h-[38vh] overflow-hidden rounded-2xl border-2 border-theme bg-card">
            <img
                src={src}
                alt={alt || "問題の写真"}
                className="h-full w-full object-cover"
                onError={() => setFailed(true)}
            />
        </div>
    );
}

// プロジェクター投影用ランキング。ホール後方からも読めるよう
// 文字サイズを大きく取り、上位3名を表彰台で強調する。
// 1st/2nd/3rd の見た目（rankIndex 0/1/2 に対応）
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

    // 各自の回答ピン（青丸）。従来 scale7 → 2.5倍の 17.5 に拡大。
    const participantPinIcon = useMemo(() => {
        if (!isLoaded || !window.google?.maps) return undefined;
        return {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 17.5,
            fillColor: "#0068b7",
            fillOpacity: 0.9,
            strokeColor: "#ffffff",
            strokeWeight: 3
        };
    }, [isLoaded]);

    // 正解ピン（赤）。各自ピンより大きく（約4倍相当）目立たせる。
    const answerPinIcon = useMemo(() => {
        if (!isLoaded || !window.google?.maps) return undefined;
        return {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 28,
            fillColor: "#e60012",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 4
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
            .slice(0, Math.max(1, Math.ceil(pins.length * 0.65)));

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
            {showPins && revealedAnswer && <MarkerF position={revealedAnswer} icon={answerPinIcon} zIndex={1000} />}
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
    revealedName = null,
    revealedPhoto = null,
    allPins = [],
    finalRankingVisible = false,
    announcement = null,
    revealStep = 0,
    answerRevealed = false,
    rankingRevealed = false,
    recentResults = []
}) {
    const categoryKey = currentCategory || "trial";
    const isCombined = scoreMode === "combined" && (categoryKey === "japan" || categoryKey === "world");

    // 発表場面（日本全問終了後 / 世界全問終了後 / 総合）では、
    // マップを隠して上位3名を 3位→2位→1位 と段階的に見せる。
    const isAnnouncement = Boolean(announcement);

    // 表示するスコアとラベルを決める。発表場面はその区分のスコアで並べる。
    const announcementLabel = { japan: "日本", world: "世界", combined: "総合（日本+世界）" };
    const scoreLabelMap = { trial: "お試し", japan: "日本", world: "世界" };
    const scoreLabel = isAnnouncement
        ? announcementLabel[announcement]
        : isCombined
            ? "日本+世界"
            : (scoreLabelMap[categoryKey] || "合計");

    const getScoreValue = (row) => {
        if (isAnnouncement) {
            if (announcement === "japan") return row.japanScore;
            if (announcement === "world") return row.worldScore;
            return row.combinedScore; // combined
        }
        if (isCombined) return row.combinedScore;
        if (categoryKey === "japan") return row.japanScore;
        if (categoryKey === "world") return row.worldScore;
        return row.trialScore;
    };

    // サーバーの並びは総得点順のため、表示中のスコアで並べ直して上位3名のみ使う
    const sortedRanking = [...ranking].sort((a, b) => getScoreValue(b) - getScoreValue(a));
    const topThree = sortedRanking.slice(0, 3);
    // 4〜8位（1位発表と同時に表彰台の下へ出す）
    const rest4to8 = sortedRanking.slice(3, 8);
    // その問題のランキング用：今回の得点・距離（recentResults は今回得点の高い順でサーバーから届く）
    const recentTop3 = recentResults.slice(0, 3);
    // 表彰台の並び：左=2位, 中央=1位, 右=3位（中央を高く見せる）
    const podiumOrder = [1, 0, 2];

    // 発表場面では revealStep に応じて段階公開。
    // 順番：3位(step1)→2位(step2)→4〜8位(step3)→1位(step4)。
    const isRevealed = (rankIndex) => {
        if (!isAnnouncement) return true;
        if (rankIndex === 2) return revealStep >= 1; // 3位
        if (rankIndex === 1) return revealStep >= 2; // 2位
        return revealStep >= 4; // 1位
    };
    // 4〜8位は step3 で公開（1位より先）
    const revealed4to8 = revealStep >= 3;

    const isClosed = phase === "closed" || phase === "finished";
    const fmtDistance = (km) => {
        if (km == null || !Number.isFinite(km)) return "—";
        return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
    };

    return (
        <main className="page-shell min-h-screen p-4 pt-6 md:p-8 md:pt-12">
            <div>
                {isAnnouncement ? (
                    ranking.length === 0 ? (
                        <p className="mt-12 text-4xl text-muted">現在のランキングはありません。</p>
                    ) : (
                      <>
                        <p className="heading-chips text-center text-2xl font-black text-primary md:text-7xl">
                            ランキング
                        </p>
                        <div className="mt-10 grid items-end gap-5 md:grid-cols-3">
                            {podiumOrder.map((rankIndex) => {
                                const row = topThree[rankIndex];
                                if (!row) return null;
                                const podium = PODIUM[rankIndex];
                                const revealed = isRevealed(rankIndex);
                                // 表彰台の高さ（中央=1位を最も高く）。発表場面では迫力を出すため大きめに。
                                const padBottom =
                                    rankIndex === 0 ? "md:pb-24" : rankIndex === 1 ? "md:pb-14" : "md:pb-6";

                                if (!revealed) {
                                    // 未公開：枠だけ残してシルエット表示（レイアウトを保つ）
                                    return (
                                        <div
                                            key={`hidden-${rankIndex}`}
                                            className={`bg-card-soft rounded-2xl border-2 border-dashed border-theme p-5 ${padBottom}`}
                                            style={{ borderTop: `12px solid ${podium.color}` }}
                                        >
                                            <div className="flex items-baseline gap-3">
                                                <span className="num text-6xl font-black md:text-7xl" style={{ color: podium.color }}>
                                                    {rankIndex + 1}
                                                </span>
                                                <span className="text-3xl font-bold text-subtle md:text-4xl">位</span>
                                            </div>
                                            <p className="mt-4 text-7xl font-black text-subtle md:text-8xl">？</p>
                                        </div>
                                    );
                                }

                                return (
                                    <div
                                        key={row.name + rankIndex}
                                        className={`bg-card rounded-2xl border-2 border-theme p-5 md:px-7 ${padBottom}`}
                                        style={{ borderTop: `12px solid ${podium.color}` }}
                                    >
                                        <div className="flex min-w-0 items-baseline gap-8">
                                            <span className="num text-6xl font-black md:text-7xl" style={{ color: podium.color }}>
                                                {rankIndex + 1}
                                            </span>
                                            <span className="truncate pb-2 text-4xl font-black leading-tight text-primary md:text-6xl">{row.name}</span>
                                        </div>
                                        <p className="num mt-3 text-7xl font-black text-primary md:text-8xl">
                                            {getScoreValue(row)}
                                            <span className="ml-3 text-3xl font-bold text-subtle">pt</span>
                                        </p>
                                    </div>
                                );
                            })}
                        </div>

                        {/* 4〜8位は発表中ずっと表示。step3 でシルエット（？）→実名・得点を公開（1位より先）。 */}
                        {rest4to8.length > 0 && (
                            <ol className="mt-8 flex flex-col gap-y-8 mx-auto max-w-5xl">
                                {rest4to8.map((row, index) => {
                                    return (
                                        <li
                                            key={row.name + index}
                                            className="flex items-baseline justify-between gap-4 border-b-2 border-theme pb-1 pt-2 px-6"
                                        >
                                            <div className="flex min-w-0 items-baseline gap-4">
                                                <span className="num w-12 flex-none text-right text-2xl font-bold text-subtle md:text-6xl">
                                                    {index + 4}
                                                </span>
                                                {revealed4to8 ? (
                                                    <span className="truncate pb-2 text-2xl font-black leading-tight text-primary md:text-6xl">{row.name}</span>
                                                ) : (
                                                    <span className="text-2xl font-black text-subtle md:text-6xl">？</span>
                                                )}
                                            </div>
                                            {revealed4to8 ? (
                                                <span className="num flex-none text-2xl font-black text-primary md:text-6xl">
                                                    {getScoreValue(row)}
                                                    <span className="ml-2 text-lg font-bold text-subtle">pt</span>
                                                </span>
                                            ) : (
                                                <span className="num flex-none text-2xl font-black text-subtle md:text-6xl">？</span>
                                            )}
                                        </li>
                                    );
                                })}
                            </ol>
                        )}
                      </>
                    )
                ) : rankingRevealed ? (
                    <>
                        {/* その問題のランキング：今回の得点による表彰台（上位3名）＋距離＋結果マップ */}
                        <p className="heading-chips text-center text-2xl font-black text-primary md:text-7xl">
                            この問題のランキング
                        </p>
                        {recentTop3.length === 0 ? (
                            <p className="mt-10 text-4xl text-muted">回答者がいませんでした。</p>
                        ) : (
                            <div className="mt-12 grid items-end gap-5 md:grid-cols-3">
                                {podiumOrder.map((rankIndex) => {
                                    const row = recentTop3[rankIndex];
                                    if (!row) return null;
                                    const podium = PODIUM[rankIndex];
                                    const padBottom =
                                        rankIndex === 0 ? "md:pb-16" : rankIndex === 1 ? "md:pb-10" : "md:pb-4";
                                    return (
                                        <div
                                            key={row.name + rankIndex}
                                            className={`bg-card rounded-2xl border-2 border-theme p-5 md:px-7 ${padBottom}`}
                                            style={{ borderTop: `12px solid ${podium.color}` }}
                                        >
                                            <div className="flex min-w-0 items-baseline gap-4">
                                                <span className="num text-5xl font-black md:text-6xl" style={{ color: podium.color }}>
                                                    {rankIndex + 1}
                                                </span>
                                                <span className="truncate pb-2 text-3xl font-black leading-tight text-primary md:text-5xl">{row.name}</span>
                                            </div>
                                            <p className="num mt-3 text-6xl font-black text-primary md:text-7xl">
                                                {row.gained}
                                                <span className="ml-3 text-2xl font-bold text-subtle">pt</span>
                                            </p>
                                            <p className="num mt-1 text-2xl font-bold text-subtle md:text-3xl">
                                                正解まで {fmtDistance(row.distanceKm)}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* 追加した結果マップ（正解＋全員の回答ピン） */}
                        <div className="overflow-hidden rounded-2xl border-2 border-theme bg-card mx-12 mt-12">
                            <div className="h-[50vh] w-full">
                                <ResultMap
                                    phase={phase}
                                    currentQuestionIndex={currentQuestionIndex}
                                    currentCategory={categoryKey}
                                    revealedAnswer={revealedAnswer}
                                    allPins={allPins}
                                />
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        {/* 答え発表：結果マップ＋名称＋写真（ランキングはまだ出さない） */}
                        <div className={`mt-4 flex gap-4 ${answerRevealed ? "md:grid-cols-2" : ""}`}>
                            <div className="w-3/5 overflow-hidden rounded-2xl border-2 border-theme bg-card">
                                <div className="h-[86vh] w-full">
                                    <ResultMap
                                        phase={phase}
                                        currentQuestionIndex={currentQuestionIndex}
                                        currentCategory={categoryKey}
                                        revealedAnswer={answerRevealed ? revealedAnswer : null}
                                        allPins={answerRevealed ? allPins : []}
                                    />
                                </div>
                            </div>
                            <div className={`w-2/5 flex flex-col justify-center`}>
                                <p className="mt-4 mb-12 text-center text-5xl font-black text-primary md:text-7xl">
                                    {revealedName}
                                </p>
                                {answerRevealed && <AnswerPhoto src={revealedPhoto} alt={revealedName} />}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}
