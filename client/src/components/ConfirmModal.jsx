export default function ConfirmModal({ open, title, message, confirmLabel = "確認", cancelLabel = "キャンセル", onConfirm, onCancel }) {
    if (!open) return null;

    return (
        <div className="bg-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-card w-full max-w-md rounded-2xl p-6 shadow-2xl">
                <h3 className="text-xl font-extrabold text-primary">{title}</h3>
                <p className="mt-3 text-sm text-muted">{message}</p>
                <div className="mt-6 flex items-center justify-end gap-3">
                    <button className="btn-outline rounded-lg px-4 py-2 text-sm font-bold" onClick={onCancel}>
                        {cancelLabel}
                    </button>
                    <button className="btn-main rounded-lg px-4 py-2 text-sm font-bold" onClick={onConfirm}>
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
