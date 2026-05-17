import GeoAdminView from "./GeoAdminView";
import GoodAdminView from "./GoodAdminView";

export default function AdminView({ mode, ...props }) {
    if (mode === "good") {
        return <GoodAdminView mode={mode} {...props} />;
    }

    return <GeoAdminView mode={mode} {...props} />;
}
