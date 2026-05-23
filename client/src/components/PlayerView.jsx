import GeoPlayerView from "./GeoPlayerView";
import GoodPlayerView from "./GoodPlayerView";

export default function PlayerView({ mode, ...props }) {
    const View = mode === "good" ? GoodPlayerView : GeoPlayerView;
    return <View {...props} />;
}
