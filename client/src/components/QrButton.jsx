import { useState } from "react";

// 各クライアントから QR コードを表示するための、画面右下の浮動ボタン＋モーダル。
// 表示する画像は client/public/qr.png に配置する（運営側で用意）。
// 画像が無い・読み込めない場合はプレースホルダ表示にフォールバックする。
const QR_SRC = "/qr.png";

export default function QrButton() {
    const [open, setOpen] = useState(false);
    const [failed, setFailed] = useState(false);

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="btn-main fixed top-4 right-4 z-40 rounded-full px-5 py-3 text-sm font-bold shadow-lg"
                aria-label="QRコードを表示"
            >
                QR
            </button>

            {open && (
                <div
                    className="bg-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
                    onClick={() => setOpen(false)}
                >
                    <div
                        className="glass-card doc-card w-full max-w-sm p-6 text-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <p className="heading-chip justify-center text-xs font-bold uppercase tracking-[0.18em] text-subtle">
                            QR CODE
                        </p>
                        {failed ? (
                            <div className="mt-4 flex aspect-square w-full items-center justify-center rounded-xl border-2 border-dashed border-theme bg-card-soft">
                                <p className="text-sm font-bold text-subtle">QRコードは準備中です</p>
                            </div>
                        ) : (
                            <img
                                src={QR_SRC}
                                alt="QRコード"
                                className="mx-auto mt-4 aspect-square w-full max-w-xs rounded-xl bg-white object-contain p-2"
                                onError={() => setFailed(true)}
                            />
                        )}
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="btn-outline mt-5 w-full rounded-xl px-4 py-3 font-bold"
                        >
                            閉じる
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
