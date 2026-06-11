// 全画面共通の枠：虹の背骨（spine）と接続バナーを一元管理する。
// 接続バナーは未接続になった瞬間に表示する（遅延なし）。
export default function ExpoShell({ socketReady, children }) {
    return (
        <>
            <div className="expo-spine" aria-hidden="true" />
            {!socketReady && <div className="conn-banner">接続されていません。再接続中...</div>}
            {children}
        </>
    );
}
