import { useState, useEffect, useCallback } from "react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(ts) {
  return new Date(ts).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "Just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return formatDateTime(ts);
}

// Detect if running inside a Chrome extension context
function isExtensionContext() {
  return typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage;
}

async function fetchLogFromExtension() {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: "GET_LOGIN_LOG" }, (res) => {
        if (chrome.runtime.lastError || !res?.ok) { resolve([]); return; }
        resolve(res.data || []);
      });
    } catch {
      resolve([]);
    }
  });
}

async function clearLogInExtension() {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: "CLEAR_LOGIN_LOG" }, (res) => {
        resolve(res?.ok ?? false);
      });
    } catch {
      resolve(false);
    }
  });
}

// ── Summary stats ─────────────────────────────────────────────────────────────

function ActivitySummary({ log }) {
  const total    = log.length;
  const success  = log.filter((e) => e.success).length;
  const failed   = log.filter((e) => !e.success).length;
  const lockouts = log.filter((e) => e.locked).length;
  const last24h  = log.filter((e) => Date.now() - e.timestamp < 86400000).length;

  const cards = [
    { icon: "🔓", label: "Successful logins",  value: success,  accent: "green"  },
    { icon: "❌", label: "Failed attempts",     value: failed,   accent: "red"    },
    { icon: "🔒", label: "Lockouts triggered",  value: lockouts, accent: "amber"  },
    { icon: "🕐", label: "Activity (last 24h)", value: last24h,  accent: "indigo" },
  ];

  const accents = {
    green:  "bg-green-50  dark:bg-green-900/20  border-green-200  dark:border-green-800/40  text-green-700  dark:text-green-400",
    red:    "bg-red-50    dark:bg-red-900/20    border-red-200    dark:border-red-800/40    text-red-700    dark:text-red-400",
    amber:  "bg-amber-50  dark:bg-amber-900/20  border-amber-200  dark:border-amber-800/40  text-amber-700  dark:text-amber-400",
    indigo: "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800/40 text-indigo-700 dark:text-indigo-400",
  };

  if (total === 0) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {cards.map((c) => (
        <div key={c.label} className={`rounded-xl border p-3 flex items-center gap-3 ${accents[c.accent]}`}>
          <span className="text-xl">{c.icon}</span>
          <div>
            <p className="text-xl font-bold leading-none">{c.value}</p>
            <p className="text-xs opacity-80 mt-0.5">{c.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Log entry row ─────────────────────────────────────────────────────────────

function LogEntry({ entry, index }) {
  const isSuccess = entry.success;
  const isLockout = entry.locked;

  let icon, label, sublabel, rowColor;

  if (isSuccess) {
    icon     = "✅";
    label    = "Vault unlocked successfully";
    sublabel = null;
    rowColor = "border-l-green-400 dark:border-l-green-600";
  } else if (isLockout) {
    icon     = "🔒";
    label    = "Account locked out";
    const until = entry.lockoutUntil
      ? `Locked until ${formatDateTime(entry.lockoutUntil)}`
      : null;
    sublabel = until;
    rowColor = "border-l-red-500 dark:border-l-red-600";
  } else {
    icon     = "⚠️";
    label    = "Incorrect master password";
    sublabel = entry.attemptsLeft != null
      ? `${entry.attemptsLeft} attempt${entry.attemptsLeft !== 1 ? "s" : ""} remaining before lockout`
      : null;
    rowColor = "border-l-amber-400 dark:border-l-amber-500";
  }

  return (
    <div className={`flex items-start gap-3 px-4 py-3 border-l-2 ${rowColor}
      ${index % 2 === 0 ? "bg-gray-50/50 dark:bg-gray-800/20" : ""}`}>
      <span className="text-base mt-0.5 flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
        {sublabel && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sublabel}</p>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{timeAgo(entry.timestamp)}</p>
        <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5 whitespace-nowrap">
          {formatDateTime(entry.timestamp)}
        </p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SecurityActivity() {
  const [log, setLog]           = useState([]);
  const [loading, setLoading]   = useState(true);
  const [clearing, setClearing] = useState(false);
  const [filter, setFilter]     = useState("all"); // "all" | "success" | "failed" | "lockout"

  const isExt = isExtensionContext();

  const loadLog = useCallback(async () => {
    setLoading(true);
    if (isExt) {
      const data = await fetchLogFromExtension();
      setLog(data);
    } else {
      // Dev fallback — show sample data when not in extension context
      setLog(SAMPLE_LOG);
    }
    setLoading(false);
  }, [isExt]);

  useEffect(() => { loadLog(); }, [loadLog]);

  async function handleClear() {
    if (!window.confirm("Clear all login activity logs? This cannot be undone.")) return;
    setClearing(true);
    if (isExt) await clearLogInExtension();
    setLog([]);
    setClearing(false);
  }

  const filtered = log.filter((e) => {
    if (filter === "success") return e.success;
    if (filter === "failed")  return !e.success && !e.locked;
    if (filter === "lockout") return e.locked;
    return true;
  });

  const filterBtns = [
    { id: "all",     label: "All" },
    { id: "success", label: "✅ Success" },
    { id: "failed",  label: "⚠️ Failed" },
    { id: "lockout", label: "🔒 Lockouts" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Security Activity</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {log.length === 0
              ? "No activity recorded yet — logs appear here every time the vault is unlocked or an attempt fails."
              : `Last ${log.length} login attempt${log.length !== 1 ? "s" : ""} recorded locally on this device.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadLog}
            className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors" title="Refresh">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          {log.length > 0 && (
            <button onClick={handleClear} disabled={clearing}
              className="text-xs px-3 py-1.5 text-red-500 hover:text-red-700 border border-red-200 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50">
              {clearing ? "Clearing..." : "Clear log"}
            </button>
          )}
        </div>
      </div>

      {/* ── Summary cards ── */}
      <ActivitySummary log={log} />

      {/* ── No data state ── */}
      {log.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl">
          <p className="text-5xl mb-3">🛡️</p>
          <p className="font-medium text-gray-700 dark:text-gray-300">No login activity yet</p>
          <p className="text-sm text-gray-500 mt-1 max-w-xs">
            Every time you unlock the vault or a failed attempt occurs, it will be recorded here.
          </p>
          {!isExt && (
            <p className="text-xs text-amber-500 mt-3 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800/40">
              ⚠️ Running outside extension — logs require the Chrome extension context
            </p>
          )}
        </div>
      )}

      {/* ── Filter + log list ── */}
      {log.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
          {/* Filter tabs */}
          <div className="flex items-center gap-1 p-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
            {filterBtns.map((btn) => (
              <button key={btn.id} onClick={() => setFilter(btn.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${filter === btn.id
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}>
                {btn.label}
                <span className="ml-1.5 text-gray-400">
                  ({btn.id === "all"     ? log.length
                  : btn.id === "success" ? log.filter((e) => e.success).length
                  : btn.id === "failed"  ? log.filter((e) => !e.success && !e.locked).length
                  : log.filter((e) => e.locked).length})
                </span>
              </button>
            ))}
          </div>

          {/* Log entries */}
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              No entries match this filter
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map((entry, i) => (
                <LogEntry key={`${entry.timestamp}-${i}`} entry={entry} index={i} />
              ))}
            </div>
          )}

          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30">
            <p className="text-xs text-gray-400 text-center">
              Logs are stored locally in the extension — max 50 entries, never sent to any server
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sample data for dev/preview ───────────────────────────────────────────────
const SAMPLE_LOG = [
  { timestamp: Date.now() - 1000 * 60 * 2,   success: true },
  { timestamp: Date.now() - 1000 * 60 * 15,  success: false, attemptsLeft: 4 },
  { timestamp: Date.now() - 1000 * 60 * 16,  success: false, attemptsLeft: 3 },
  { timestamp: Date.now() - 1000 * 60 * 60,  success: true },
  { timestamp: Date.now() - 1000 * 60 * 90,  success: false, locked: true, lockoutUntil: Date.now() - 1000 * 60 * 30 },
  { timestamp: Date.now() - 1000 * 3600 * 5, success: true },
  { timestamp: Date.now() - 1000 * 3600 * 24, success: false, attemptsLeft: 2 },
  { timestamp: Date.now() - 1000 * 3600 * 25, success: true },
];