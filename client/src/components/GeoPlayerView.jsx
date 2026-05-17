import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import marker2x from "leaflet/dist/images/marker-icon-2x.png";
import marker from "leaflet/dist/images/marker-icon.png";
import shadow from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
    iconRetinaUrl: marker2x,
    iconUrl: marker,
    shadowUrl: shadow
});

const markerIcon = L.icon({
    iconRetinaUrl: marker2x,
    iconUrl: marker,
    shadowUrl: shadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const playerPinIcon = L.divIcon({
    className: "",
    html: '<div style="width:18px;height:18px;background:var(--main-color);border:2px solid var(--text-color);border-radius:50%;box-shadow:0 0 6px rgba(32,35,42,0.35);"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9]
});

const JAPAN_CENTER = [36, 138];
const JAPAN_ZOOM = 5;

function MapClickLayer({ enabled, onPick }) {
    useMapEvents({
        click(e) {
            if (!enabled) return;
            onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
        }
    });
    return null;
}

function MapSizeFixer() {
    const map = useMap();

    useEffect(() => {
        const refresh = () => map.invalidateSize({ pan: false, debounceMoveend: true });

        refresh();
        const t1 = window.setTimeout(refresh, 120);
        const t2 = window.setTimeout(refresh, 300);

        const onResize = () => refresh();
        window.addEventListener("resize", onResize);

        return () => {
            window.clearTimeout(t1);
            window.clearTimeout(t2);
            window.removeEventListener("resize", onResize);
        };
    }, [map]);

    return null;
}

export default function GeoPlayerView({ phase, player, currentCategory, playerAnswer, pin, onPick, canAnswer, revealedAnswer, error, formatDistance }) {
    const scoreBucket = player?.scores || { trial: 0, japan: 0, world: 0 };
    const scoreLabels = { trial: "お試し", japan: "日本", world: "世界" };
    const activeKey = player?.currentCategory || currentCategory || "trial";
    const activeLabel = scoreLabels[activeKey] || "合計";
    const activeScore = player?.currentCategoryScore ?? scoreBucket[activeKey] ?? 0;
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
                            <MapContainer center={JAPAN_CENTER} zoom={JAPAN_ZOOM} className="h-[520px] w-full md:h-[640px] rounded-t-xl">
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
                                <MapSizeFixer />
                                <MapClickLayer enabled={canAnswer} onPick={onPick} />
                                {pin && <Marker position={[pin.lat, pin.lng]} icon={markerIcon} />}
                                {phase === "closed" && revealedAnswer && (
                                    <Marker position={[revealedAnswer.lat, revealedAnswer.lng]} icon={markerIcon} />
                                )}
                                {phase === "closed" && playerAnswer && (
                                    <Marker position={[playerAnswer.lat, playerAnswer.lng]} icon={playerPinIcon} />
                                )}
                            </MapContainer>

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
