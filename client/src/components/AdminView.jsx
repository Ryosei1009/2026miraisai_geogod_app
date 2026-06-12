import GeoAdminView from "./GeoAdminView";
import GoodAdminView from "./GoodAdminView";

export default function AdminView({ mode, onShowFinal, ...props }) {
    const View = mode === "good" ? GoodAdminView : GeoAdminView;
    return <View mode={mode} onShowFinal={onShowFinal} {...props} />;
}
