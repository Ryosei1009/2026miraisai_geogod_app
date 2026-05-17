import GeoPlayerView from "./GeoPlayerView";
import GoodPlayerView from "./GoodPlayerView";

export default function PlayerView({ mode, ...props }) {
    if (mode === "good") {
        return <GoodPlayerView {...props} />;
    }

    return <GeoPlayerView {...props} />;
}
