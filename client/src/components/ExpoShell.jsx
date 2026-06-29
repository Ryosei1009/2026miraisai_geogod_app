import QrButton from "./QrButton";

// 全画面共通の枠：虹の背骨（spine）と接続バナーを一元管理する。
// 接続バナーは未接続になった瞬間に表示する（遅延なし）。
// showQr=true のときだけ、各クライアント用の QR コード表示ボタンを出す
// （参加者・観客の画面のみ。運営/投影画面には出さない）。
export default function ExpoShell({ socketReady, showQr = false, children }) {
    return (
        <>
            <div className="expo-spine" aria-hidden="true" />
            {!socketReady && <div className="conn-banner">接続されていません。再接続中...</div>}
            {children}
            {showQr && <QrButton />}
        </>
    );
}
