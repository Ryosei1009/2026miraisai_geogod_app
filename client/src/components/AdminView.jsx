import GeoAdminView from "./GeoAdminView";
import GoodAdminView from "./GoodAdminView";

export default function AdminView({ mode, ...props }) {
    const View = mode === "good" ? GoodAdminView : GeoAdminView;
    return <View mode={mode} {...props} />;
}
