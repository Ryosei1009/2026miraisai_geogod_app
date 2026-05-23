import { useMemo } from "react";
import { GoogleMap, MarkerF, useJsApiLoader } from "@react-google-maps/api";

const JAPAN_CENTER = { lat: 36, lng: 138 };
const JAPAN_ZOOM = 5;

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

export default function GeoPlayerView({ phase, player, currentCategory, playerAnswer, pin, onPick, canAnswer, revealedAnswer, error, formatDistance }) {
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

    return (
        <main className="page-shell min-h-screen">
            <div className="relative h-screen w-full">

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
                    >
                        {pin && <MarkerF position={pin} />}
                        {phase === "closed" && revealedAnswer && <MarkerF position={revealedAnswer} icon={correctPinIcon} />}
                        {phase === "closed" && playerAnswer && <MarkerF position={playerAnswer} />}
                    </GoogleMap>
                )}

                <div className="pointer-events-none absolute inset-0 flex flex-col justify-end p-2 md:p-6">
                    {phase !== "waiting" && (
                        <div className="pointer-events-auto w-full max-w-none space-y-2 md:max-w-sm">
                            {error && <p className="alert-error rounded-lg p-2 text-sm">{error}</p>}
                            <div className="rounded-2xl border border-[var(--main-color)]/20 bg-[#050a30]/95 p-3 shadow-lg backdrop-blur md:p-4">
                                <div className="mt-1 md:mt-2 flex ">
                                    <div className="w-2/3">
                                        <p className="text-[11px] uppercase tracking-widest text-muted">参加者</p>
                                        <h2 className="text-xl font-extrabold text-primary md:text-2xl">{player?.name || "-"}</h2>
                                    </div>
                                    <div className="w-1/3">
                                        <p className="text-[11px] uppercase tracking-widest text-muted">現在の{activeLabel}スコア</p>
                                        <p className="text-3xl font-extrabold text-accent -mt-1 md:text-4xl">{activeScore}</p>
                                    </div>
                                </div>
                                <div className="mt-2 grid gap-1 text-muted mt-3 grid-cols-2 text-sm">
                                    <p>前問距離: {formatDistance(lastRound.distanceKm)}</p>
                                    <p>前問得点: {lastRound.gained ?? 0}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {phase === "waiting" && (
                        <div className="pointer-events-auto mx-auto w-full max-w-xl p-2 md:pb-0">
                            <div className="rounded-2xl border border-[var(--main-color)]/20 bg-[var(--card-bg)]/95 p-6 text-center shadow-lg backdrop-blur">
                                <h3 className="text-3xl font-extrabold text-primary">開始待機中</h3>
                                <p className="mt-3 text-muted">運営がゲーム開始を押すまでお待ちください。</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}