import { useState } from "react";

function formatDateTime(dateStr) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function timeAgo(dateStr) {
  const diff  = Date.now() - new Date(dateStr);
  const days  = Math.floor(diff / 86400000);
  const hours = Math.floor(diff / 3600000);
  const mins  = Math.floor(diff / 60000);
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  < 30)  return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function PasswordHistoryModal({ credential, onClose, onRestore }) {
  const [revealed, setRevealed]   = useState(new Set());
  const [restoring, setRestoring] = useState(null);
  const [copied, setCopied]       = useState(null);

  const history = credential.passwordHistory || [];

  function toggleReveal(idx) {
    setRevealed((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  async function copyPassword(pwd, idx) {
    await navigator.clipboard.writeText(pwd);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  }

  async function handleRestore(entry, idx) {
    setRestoring(idx);
    try {
      await onRestore(credential, entry.password);
      onClose();
    } finally {
      setRestoring(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <div>
            <h2 className="text-gray-900 dark:text-white font-semibold text-base">Password History</h2>
            <p className="text-gray-500 text-xs mt-0.5">
              {credential.website} — {history.length} previous version{history.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Current password row */}
        <div className="px-6 py-3 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800/40 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Current password</p>
              <p className="text-sm text-gray-900 dark:text-white font-mono mt-0.5">
                {revealed.has("current") ? credential.password : "•".repeat(Math.min(credential.password.length, 16))}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => toggleReveal("current")}
                className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors">
                {revealed.has("current") ? <EyeOffIcon /> : <EyeIcon />}
              </button>
              <button onClick={() => copyPassword(credential.password, "current")}
                className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors">
                {copied === "current" ? <span className="text-xs text-green-500 font-medium px-1">✓</span> : <CopyIcon />}
              </button>
            </div>
          </div>
        </div>

        {/* History list */}
        <div className="overflow-y-auto flex-1">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <p className="text-4xl mb-3">📋</p>
              <p className="font-medium text-gray-700 dark:text-gray-300">No history yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Previous passwords will appear here each time you update this credential.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {history.map((entry, idx) => (
                <div key={idx}
                  className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Version label */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                          v{history.length - idx}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {timeAgo(entry.changedAt)}
                        </span>
                        <span className="text-xs text-gray-300 dark:text-gray-700">
                          {formatDateTime(entry.changedAt)}
                        </span>
                      </div>

                      {/* Password value */}
                      <p className="text-sm font-mono text-gray-700 dark:text-gray-300 break-all">
                        {revealed.has(idx)
                          ? entry.password
                          : "•".repeat(Math.min(entry.password.length, 20))}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => toggleReveal(idx)}
                        className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title={revealed.has(idx) ? "Hide" : "Show"}>
                        {revealed.has(idx) ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                      <button onClick={() => copyPassword(entry.password, idx)}
                        className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        title="Copy">
                        {copied === idx
                          ? <span className="text-xs text-green-500 font-medium px-1">✓</span>
                          : <CopyIcon />}
                      </button>
                      <button
                        onClick={() => handleRestore(entry, idx)}
                        disabled={restoring === idx}
                        className="text-xs px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 rounded-lg transition-colors disabled:opacity-50 font-medium"
                        title="Restore this password">
                        {restoring === idx ? "..." : "Restore"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer note */}
        <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 flex-shrink-0">
          <p className="text-xs text-gray-400 text-center">
            Up to 10 versions stored · Restore replaces the current password
          </p>
        </div>
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}