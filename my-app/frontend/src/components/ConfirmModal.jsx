import { useEffect, useRef } from "react";

// ── ConfirmModal ──────────────────────────────────────────────────────────────
// Drop-in replacement for window.confirm().
// Usage in parent:
//
//   const [confirm, setConfirm] = useState(null);
//
//   // To show:
//   setConfirm({
//     title: "Delete credential?",
//     message: "This cannot be undone.",
//     confirmLabel: "Delete",         // optional, default "Confirm"
//     danger: true,                   // optional — red confirm button
//     onConfirm: () => { ... },
//   });
//
//   // In JSX:
//   {confirm && <ConfirmModal {...confirm} onClose={() => setConfirm(null)} />}

export default function ConfirmModal({
  title        = "Are you sure?",
  message      = "",
  confirmLabel = "Confirm",
  cancelLabel  = "Cancel",
  danger       = false,
  onConfirm,
  onClose,
}) {
  const confirmBtnRef = useRef(null);

  // Auto-focus the confirm button and trap focus inside modal
  useEffect(() => {
    confirmBtnRef.current?.focus();

    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function handleConfirm() {
    onConfirm?.();
    onClose();
  }

  // Click backdrop to cancel
  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-sm shadow-2xl animate-modal">

        {/* Icon + title */}
        <div className="p-6 pb-4">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
              ${danger
                ? "bg-red-100 dark:bg-red-900/30"
                : "bg-amber-100 dark:bg-amber-900/30"
              }`}>
              {danger ? (
                <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <h3 id="confirm-title"
                className="text-gray-900 dark:text-white font-semibold text-base leading-snug">
                {title}
              </h3>
              {message && (
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 leading-relaxed">
                  {message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium py-2.5 rounded-xl transition-colors text-sm"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            onClick={handleConfirm}
            className={`flex-1 font-medium py-2.5 rounded-xl transition-colors text-sm text-white
              ${danger
                ? "bg-red-600 hover:bg-red-700"
                : "bg-indigo-600 hover:bg-indigo-700"
              }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}