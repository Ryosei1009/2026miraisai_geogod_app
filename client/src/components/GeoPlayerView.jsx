import { useEffect, useMemo, useRef } from "react";
import { GoogleMap, MarkerF, useJsApiLoader } from "@react-google-maps/api";

const JAPAN_CENTER = { lat: 36, lng: 138 };
const JAPAN_ZOOM = 5;
const WORLD_CENTER = { lat: 20, lng: 140 };
const WORLD_ZOOM = 2;

// カテゴリごとの初期表示（問題が切り替わるたびにここへ戻す）
const defaultViewForCategory = (category) =>
    category === "world"
        ? { center: WORLD_CENTER, zoom: WORLD_ZOOM }
        : { center: JAPAN_CENTER, zoom: JAPAN_ZOOM };

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

export default function GeoPlayerView({ phase, player, currentCategory, currentQuestionIndex, playerAnswer, pin, onPick, canAnswer, revealedAnswer, answerRevealed = false, error, formatDistance }) {
    const mapRef = useRef(null);
    const scoreBucket = player?.scores || { trial: 0, japan: 0, world: 0 };
    const scoreLabels = { trial: "お試し", japan: "日本", world: "世界" };
    const activeKey = player?.currentCategory || currentCategory || "trial";
    const activeLabel = scoreLabels[activeKey] || "合計";
    const activeScore = player?.currentCategoryScore ?? scoreBucket[activeKey] ?? 0;
    const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;
    const isKeyMissing = !mapsKey;

    const { isLoaded, loadError } = useJsApiLoader({
        id: "google-map-script",
        googleMapsApiKey: mapsKey || "",
        language: "ja",
        region: "JP"
    });

    const correctPinIcon = useMemo(() => {
        if (!isLoaded || !window.google?.maps) return undefined;
        return {
            path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
            scale: 7,
            fillColor: "#22c55e",
            fillOpacity: 0.98,
            strokeColor: "#ffffff",
            strokeWeight: 2
        };
    }, [isLoaded]);

    const activeCategory = player?.currentCategory || currentCategory || "trial";

    // 別の問題（マップ）に進んだら、ユーザーが拡大・移動していても初期表示に戻す
    useEffect(() => {
        if (!mapRef.current) return;
        const { center, zoom } = defaultViewForCategory(activeCategory);
        mapRef.current.setZoom(zoom);
        mapRef.current.panTo(center);
    }, [currentQuestionIndex, activeCategory]);

    const handleMapClick = (event) => {
        if (!canAnswer) return;
        const lat = event.latLng?.lat();
        const lng = event.latLng?.lng();
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        onPick({ lat, lng });
    };

    const showMap = !isKeyMissing && !loadError && isLoaded;
    const showMapLoading = !isKeyMissing && !loadError && !isLoaded;
    const lastRound = player?.lastRound || {};
    const isClosed = phase === "closed" || phase === "finished";
    // 締切後は運営が「答えを表示」を押すまで距離・得点を伏せる
    const showResult = !isClosed || answerRevealed;

    return (
        <main className="page-shell h-screen-safe overflow-hidden">
            <div className="relative h-full w-full">

                {showMapLoading && (
                    <div className="flex h-full w-full items-center justify-center bg-card p-6 text-center">
                        <p className="text-muted">地図読み込み中...</p>
                    </div>
                )}

                {showMap && (
                    <GoogleMap
                        center={JAPAN_CENTER}
                        zoom={JAPAN_ZOOM}
                        mapContainerClassName="h-full w-full"
                        options={mapOptions}
                        onClick={handleMapClick}
                        onLoad={(map) => {
                            mapRef.current = map;
                        }}
                        onUnmount={() => {
                            mapRef.current = null;
                        }}
                    >
                        {pin && <MarkerF position={pin} />}
                        {isClosed && revealedAnswer && <MarkerF position={revealedAnswer} icon={correctPinIcon} />}
                        {isClosed && playerAnswer && <MarkerF position={playerAnswer} />}
                    </GoogleMap>
                )}

                {phase !== "waiting" && (
                    <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2">
                        <span
                            className={`rounded-full px-4 py-1.5 text-xs font-bold tracking-wider shadow-lg ${
                                phase === "active" ? "bg-main text-[var(--accent-fg)]" : "bg-card-soft border border-theme text-muted"
                            }`}
                        >
                            {phase === "active" ? "回答受付中" : "回答締切"}
                        </span>
                    </div>
                )}

                <div className="pointer-events-none absolute inset-0 flex flex-col justify-end p-2 md:p-6">
                    {phase !== "waiting" && (
                        <div className="pointer-events-auto w-full max-w-none space-y-2 md:max-w-sm">
                            {error && <p className="alert-error rounded-lg p-2 text-sm">{error}</p>}
                            <div className="glass-card doc-card bg-card/95 p-3 shadow-lg backdrop-blur md:p-4">
                                <div className="mt-1 flex md:mt-2">
                                    <div className="w-2/3">
                                        <p className="heading-chip text-[11px] uppercase tracking-widest text-muted">参加者</p>
                                        <h2 className="text-xl font-extrabold text-primary md:text-2xl">{player?.name || "-"}</h2>
                                    </div>
                                    <div className="w-1/3">
                                        <p className="text-[11px] uppercase tracking-widest text-muted">{activeLabel}スコア</p>
                                        <p className="num -mt-1 text-3xl font-extrabold text-accent md:text-4xl">{activeScore}</p>
                                    </div>
                                </div>
                                {showResult ? (
                                    <div className="num mt-3 grid grid-cols-2 gap-1 border-t border-theme pt-2 text-sm text-muted">
                                        <p>前問距離: {formatDistance(lastRound.distanceKm)}</p>
                                        <p>前問得点: {lastRound.gained ?? 0}</p>
                                    </div>
                                ) : (
                                    <div className="mt-3 border-t border-theme pt-2 text-sm font-bold text-muted">
                                        答え発表をお待ちください...
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {phase === "waiting" && (
                        <div className="pointer-events-auto mx-auto w-full max-w-xl p-2 md:pb-0">
                            <div className="glass-card doc-card bg-card/95 p-6 text-center shadow-lg backdrop-blur">
                                <p className="heading-chip justify-center text-xs font-bold uppercase tracking-[0.18em] text-subtle">PAVILION 01</p>
                                <h3 className="mt-2 text-3xl font-extrabold text-primary">開始待機中</h3>
                                <p className="mt-3 text-muted">運営がゲーム開始を押すまでお待ちください。</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}