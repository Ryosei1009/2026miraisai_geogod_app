import { useMemo } from "react";
import { GoogleMap, MarkerF, useJsApiLoader } from "@react-google-maps/api";

const JAPAN_CENTER = { lat: 36, lng: 138 };
const JAPAN_ZOOM = 5;

const mapOptions = {
    fullscreenControl: false,
    mapTypeControl: false,
    streetViewControl: false
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

    const playerPinIcon = useMemo(() => {
        if (!isLoaded || !window.google?.maps) return undefined;
        return {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: "#2f8bfd",
            fillOpacity: 0.95,
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

    return (
        <main className="page-shell min-h-screen p-3 md:p-6">
            <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 lg:grid-cols-12">
                <section className="glass-card px-5 lg:col-span-4">
                    {error && <p className="alert-error mt-4 rounded-lg p-2 text-sm">{error}</p>}
                </section>

                <section className="glass-card overflow-hidden lg:col-span-8">
                    {phase === "waiting" && (
                        <div className="flex h-full min-h-[520px] items-center justify-center p-8 text-center">
                            <div>
                                <h3 className="text-3xl font-extrabold text-primary">開始待機中</h3>
                                <p className="mt-3 text-muted">運営がゲーム開始を押すまでお待ちください。</p>
                            </div>
                        </div>
                    )}

                    {(phase === "active" || phase === "closed" || phase === "finished") && (
                        <div className="relative">
                            {isKeyMissing && (
                                <div className="flex h-[520px] w-full items-center justify-center rounded-t-xl bg-card p-6 text-center md:h-[640px]">
                                    <div>
                                        <h3 className="text-2xl font-extrabold text-primary">Google Maps APIキーが未設定です</h3>
                                        <p className="mt-2 text-muted">.env に VITE_GOOGLE_MAPS_KEY を設定してください。</p>
                                    </div>
                                </div>
                            )}

                            {!isKeyMissing && loadError && (
                                <div className="flex h-[520px] w-full items-center justify-center rounded-t-xl bg-card p-6 text-center md:h-[640px]">
                                    <div>
                                        <h3 className="text-2xl font-extrabold text-primary">地図の読み込みに失敗しました</h3>
                                        <p className="mt-2 text-muted">APIキーやドメイン設定をご確認ください。</p>
                                    </div>
                                </div>
                            )}

                            {!isKeyMissing && !loadError && !isLoaded && (
                                <div className="flex h-[520px] w-full items-center justify-center rounded-t-xl bg-card p-6 text-center md:h-[640px]">
                                    <p className="text-muted">地図読み込み中...</p>
                                </div>
                            )}

                            {!isKeyMissing && !loadError && isLoaded && (
                                <GoogleMap
                                    center={JAPAN_CENTER}
                                    zoom={JAPAN_ZOOM}
                                    mapContainerClassName="h-[520px] w-full md:h-[640px] rounded-t-xl"
                                    options={mapOptions}
                                    onClick={handleMapClick}
                                >
                                    {pin && <MarkerF position={pin} />}
                                    {phase === "closed" && revealedAnswer && <MarkerF position={revealedAnswer} />}
                                    {phase === "closed" && playerAnswer && <MarkerF position={playerAnswer} icon={playerPinIcon} />}
                                </GoogleMap>
                            )}

                            <div className="bg-card rounded-b-xl p-3 border-b-4 border-[var(--main-color)]">
                                <h2 className="text-xl font-extrabold text-primary mb-2">参加者: {player?.name || "-"}</h2>
                                <p className="text-sm text-muted">現在の{activeLabel}スコア</p>
                                <p className="text-3xl font-extrabold text-accent -mt-1 mb-1">{activeScore}</p>
                                <div className="flex">
                                    <p className="text-sm text-muted w-1/2">前問距離: {formatDistance(player?.lastRound?.distanceKm)}</p>
                                    <p className="text-sm text-muted w-1/2">前問得点: {player?.lastRound?.gained ?? 0}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}