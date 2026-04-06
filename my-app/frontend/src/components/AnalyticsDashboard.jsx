import { useState, useEffect } from "react";
import { fetchStats } from "../api/credentials";
import SecurityActivity from "./SecurityActivity";

// ── Sparkline chart ───────────────────────────────────────────────────────────
// Pure SVG, no library needed. Groups credentials by month and draws a line.

function Sparkline({ credentials }) {
  const now       = new Date();
  const months    = 6; // last 6 months
  const labels    = [];
  const counts    = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(d.toLocaleString("default", { month: "short" }));
    counts.push(
      credentials.filter((c) => {
        const cd = new Date(c.createdAt);
        return cd.getFullYear() === d.getFullYear() && cd.getMonth() === d.getMonth();
      }).length
    );
  }

  const W = 180; const H = 48; const PAD = 6;
  const max = Math.max(...counts, 1);
  const pts = counts.map((v, i) => {
    const x = PAD + (i / (months - 1)) * (W - PAD * 2);
    const y = H - PAD - (v / max) * (H - PAD * 2);
    return [x, y];
  });

  const polyline = pts.map(([x, y]) => `${x},${y}`).join(" ");
  // Filled area path
  const area = [
    `M ${pts[0][0]},${H - PAD}`,
    ...pts.map(([x, y]) => `L ${x},${y}`),
    `L ${pts[pts.length - 1][0]},${H - PAD}`,
    "Z",
  ].join(" ");

  const total = counts.reduce((a, b) => a + b, 0);

  return (
    <div className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800/50 rounded-2xl p-4 flex items-center gap-4">
      <div>
        <p className="text-indigo-900 dark:text-white font-bold text-xl leading-none">{total}</p>
        <p className="text-indigo-600 dark:text-indigo-400 text-xs mt-1">Added last 6 months</p>
        <div className="flex gap-2 mt-2">
          {labels.map((l, i) => (
            <div key={l} className="flex flex-col items-center">
              <span className="text-indigo-700 dark:text-indigo-300 text-xs font-medium">{counts[i]}</span>
              <span className="text-indigo-400 dark:text-indigo-600 text-xs">{l}</span>
            </div>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="flex-1 h-12 min-w-0" preserveAspectRatio="none">
        <defs>
          <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#spark-grad)" />
        <polyline points={polyline} fill="none" stroke="#6366f1" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" />
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.5" fill="#6366f1" />
        ))}
      </svg>
    </div>
  );
}

// ── Audit action list ─────────────────────────────────────────────────────────
// Shows weak / reused / stale credentials as clickable rows.
// Clicking a row calls onEdit(credential) which opens the edit modal.

function isWeak(pwd) {
  return !(pwd.length >= 8 && /[A-Z]/.test(pwd) && /[0-9]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd));
}

function AuditActionList({ credentials, onEdit }) {
  const now = Date.now();

  const weak   = credentials.filter((c) => isWeak(c.password));
  const stale  = credentials.filter((c) => (now - new Date(c.createdAt)) > 90 * 86400000);

  // Reused: password appears more than once
  const pwdMap = {};
  credentials.forEach((c) => {
    if (!pwdMap[c.password]) pwdMap[c.password] = [];
    pwdMap[c.password].push(c);
  });
  const reused = credentials.filter((c) => pwdMap[c.password].length > 1);

  const total = new Set([...weak, ...stale, ...reused].map((c) => c._id)).size;

  if (total === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 flex items-center gap-4">
        <span className="text-4xl">🎉</span>
        <div>
          <p className="font-semibold text-gray-900 dark:text-white">All passwords look good!</p>
          <p className="text-sm text-gray-500 mt-0.5">No weak, reused, or stale passwords found.</p>
        </div>
      </div>
    );
  }

  const Section = ({ title, icon, items, badge, badgeColor, reason }) => {
    const [open, setOpen] = useState(true);
    if (items.length === 0) return null;
    const colors = {
      red:   "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-400",
      amber: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400",
      orange:"bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/40 text-orange-700 dark:text-orange-400",
    };
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
        {/* Section header */}
        <button onClick={() => setOpen((p) => !p)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
          <div className="flex items-center gap-3">
            <span className="text-xl">{icon}</span>
            <div className="text-left">
              <p className="font-semibold text-gray-900 dark:text-white text-sm">{title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{reason}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${colors[badgeColor]}`}>
              {items.length} to fix
            </span>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {/* Credential rows */}
        {open && (
          <div className="border-t border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((cred) => (
              <button key={cred._id} onClick={() => onEdit(cred)}
                className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors text-left group">
                <img
                  src={`https://www.google.com/s2/favicons?domain=${cred.website}.com&sz=32`}
                  alt="" className="w-6 h-6 rounded object-contain flex-shrink-0"
                  onError={(e) => { e.target.style.display = "none"; }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{cred.website}</p>
                  <p className="text-xs text-gray-400 truncate">{cred.username}</p>
                </div>
                <span className="text-xs text-indigo-500 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 flex items-center gap-1">
                  Fix
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Password Audit</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} credential{total !== 1 ? "s" : ""} need attention — click any row to fix it
          </p>
        </div>
        <span className="text-xs px-3 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 rounded-full font-semibold">
          {total} issues
        </span>
      </div>
      <Section title="Weak Passwords"   icon="⚠️" items={weak}   badgeColor="red"
        reason="Missing uppercase, number, or symbol — or under 8 characters" />
      <Section title="Reused Passwords" icon="🔄" items={reused} badgeColor="amber"
        reason="Same password used across multiple sites" />
      <Section title="Stale Passwords"  icon="📅" items={stale}  badgeColor="orange"
        reason="Password hasn't been changed in over 90 days" />
    </div>
  );
}


// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function timeAgo(dateStr) {
  if (!dateStr) return "Never used";
  const diff = Date.now() - new Date(dateStr);
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

// ── Score ring SVG ────────────────────────────────────────────────────────────

function ScoreRing({ score }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 75 ? "#22c55e" :
    score >= 50 ? "#f59e0b" :
    score >= 25 ? "#f97316" : "#ef4444";

  const label =
    score >= 75 ? "Excellent" :
    score >= 50 ? "Good" :
    score >= 25 ? "Fair" : "At Risk";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
          {/* Track */}
          <circle cx="64" cy="64" r={radius} fill="none"
            stroke="currentColor" strokeWidth="10"
            className="text-gray-200 dark:text-gray-800" />
          {/* Progress */}
          <circle cx="64" cy="64" r={radius} fill="none"
            stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1s ease" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-gray-900 dark:text-white">{score}</span>
          <span className="text-xs text-gray-500">/100</span>
        </div>
      </div>
      <span className="text-sm font-semibold" style={{ color }}>{label}</span>
    </div>
  );
}

// ── Score breakdown bar ───────────────────────────────────────────────────────

function ScoreBar({ label, score, max, color, description }) {
  const pct = Math.round((score / max) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-700 dark:text-gray-300 font-medium">{label}</span>
        <span className="text-gray-500 tabular-nums">{score}/{max} pts</span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, accent }) {
  const accents = {
    indigo:  "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800/40",
    green:   "bg-green-50  dark:bg-green-900/20  border-green-200  dark:border-green-800/40",
    red:     "bg-red-50    dark:bg-red-900/20    border-red-200    dark:border-red-800/40",
    amber:   "bg-amber-50  dark:bg-amber-900/20  border-amber-200  dark:border-amber-800/40",
    purple:  "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800/40",
  };
  return (
    <div className={`rounded-2xl border p-4 flex items-center gap-4 ${accents[accent]}`}>
      <span className="text-3xl">{icon}</span>
      <div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white leading-none">{value}</p>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Usage history table ───────────────────────────────────────────────────────

function UsageTable({ credentials }) {
  const [sortBy, setSortBy] = useState("lastUsed"); // "lastUsed" | "count" | "added"

  const sorted = [...credentials].sort((a, b) => {
    if (sortBy === "lastUsed") {
      return (new Date(b.lastUsedAt || 0)) - (new Date(a.lastUsedAt || 0));
    }
    if (sortBy === "count") return (b.autofillCount || 0) - (a.autofillCount || 0);
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const Col = ({ id, label }) => (
    <th
      onClick={() => setSortBy(id)}
      className={`text-left text-xs font-semibold uppercase tracking-wider px-4 py-3 cursor-pointer select-none
        ${sortBy === id
          ? "text-indigo-600 dark:text-indigo-400"
          : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"}`}
    >
      {label} {sortBy === id && "↓"}
    </th>
  );

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
        <h3 className="font-semibold text-gray-900 dark:text-white">Usage History</h3>
        <p className="text-xs text-gray-500 mt-0.5">Per-credential autofill tracking — click column headers to sort</p>
      </div>

      {credentials.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-2">📭</p>
          <p className="font-medium">No credentials yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/60">
              <tr>
                <Col id="added"    label="Site" />
                <Col id="added"    label="Added" />
                <Col id="lastUsed" label="Last Used" />
                <Col id="count"    label="Autofills" />
                <th className="text-left text-xs font-semibold uppercase tracking-wider px-4 py-3 text-gray-500">Modified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {sorted.map((c) => {
                const neverUsed = !c.lastUsedAt;
                const stale = c.lastUsedAt &&
                  (Date.now() - new Date(c.lastUsedAt)) > 30 * 86400000;

                return (
                  <tr key={c._id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    {/* Site */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${c.website}.com&sz=32`}
                          alt="" className="w-5 h-5 rounded object-contain flex-shrink-0"
                          onError={(e) => { e.target.style.display = "none"; }}
                        />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{c.website}</p>
                          <p className="text-xs text-gray-400">{c.username}</p>
                        </div>
                      </div>
                    </td>
                    {/* Added */}
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatDate(c.createdAt)}
                    </td>
                    {/* Last used */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {neverUsed ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400">
                          Never
                        </span>
                      ) : stale ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                          {timeAgo(c.lastUsedAt)}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                          {timeAgo(c.lastUsedAt)}
                        </span>
                      )}
                    </td>
                    {/* Autofill count */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
                          {c.autofillCount || 0}
                        </span>
                        {c.autofillCount > 0 && (
                          <div className="flex gap-0.5">
                            {Array.from({ length: Math.min(c.autofillCount, 5) }).map((_, i) => (
                              <div key={i} className="w-1 h-3 bg-indigo-400 dark:bg-indigo-500 rounded-full" />
                            ))}
                            {c.autofillCount > 5 && (
                              <span className="text-xs text-indigo-400 ml-1">+{c.autofillCount - 5}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    {/* Last modified */}
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                      {formatDate(c.updatedAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Duplicate sites list ──────────────────────────────────────────────────────

function DuplicatesList({ duplicateSites }) {
  if (!duplicateSites?.length) return null;
  return (
    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">⚠️</span>
        <h3 className="font-semibold text-amber-800 dark:text-amber-400">Reused Passwords</h3>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 font-semibold">
          {duplicateSites.length} group{duplicateSites.length > 1 ? "s" : ""}
        </span>
      </div>
      <p className="text-xs text-amber-700 dark:text-amber-500 mb-3">
        The same password is being used across these sites. Update each to a unique password.
      </p>
      <div className="space-y-2">
        {duplicateSites.map((group, i) => (
          <div key={i}
            className="bg-white dark:bg-gray-900 rounded-xl px-3 py-2 border border-amber-200 dark:border-amber-800/30 flex flex-wrap gap-2">
            {group.map((site) => (
              <span key={site}
                className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">
                {site}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Top autofilled ────────────────────────────────────────────────────────────

function TopAutofilled({ topAutofilled }) {
  if (!topAutofilled?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">🏆 Most Used</h3>
      <div className="space-y-3">
        {topAutofilled.map((item, i) => {
          const max = topAutofilled[0].autofillCount;
          const pct = Math.round((item.autofillCount / max) * 100);
          const medals = ["🥇", "🥈", "🥉"];
          return (
            <div key={item.website} className="flex items-center gap-3">
              <span className="text-lg w-6 text-center flex-shrink-0">{medals[i] || "🔑"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.website}</span>
                  <span className="text-xs text-gray-500 ml-2 tabular-nums flex-shrink-0">{item.autofillCount}×</span>
                </div>
                <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full transition-all duration-700"
                    style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AnalyticsDashboard({ credentials, onEdit }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "activity"

  useEffect(() => {
    loadStats();
  }, [credentials]); // Reload when credentials change

  async function loadStats() {
    setLoading(true);
    setError("");
    try {
      const { data } = await fetchStats();
      setStats(data);
    } catch {
      setError("Failed to load analytics. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Analysing your vault...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <p className="text-5xl mb-3">⚠️</p>
          <p className="text-red-500 font-medium">{error}</p>
          <button onClick={loadStats}
            className="mt-4 text-sm text-indigo-500 hover:underline">
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!stats || stats.total === 0) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <p className="text-5xl mb-3">📊</p>
          <p className="text-gray-500 font-medium">No data yet</p>
          <p className="text-gray-400 text-sm mt-1">Add some credentials to see your vault analytics</p>
        </div>
      </div>
    );
  }

  const { total, strong, weak, reused, securityScore, mostRecent,
          duplicateSites, topAutofilled, breakdown } = stats;

  const breakdownItems = [
    {
      label: "Password Strength",
      score: breakdown.strongScore,
      max: 40,
      color: "#6366f1",
      description: `${strong} of ${total} passwords meet the strength criteria (8+ chars, uppercase, number, symbol)`,
    },
    {
      label: "Password Uniqueness",
      score: breakdown.reusedScore,
      max: 30,
      color: "#22c55e",
      description: `${reused} password${reused !== 1 ? "s are" : " is"} reused across multiple sites`,
    },
    {
      label: "Password Age",
      score: breakdown.ageScore,
      max: 20,
      color: "#f59e0b",
      description: "Passwords older than 90 days reduce this score",
    },
    {
      label: "Recent Activity",
      score: breakdown.usageScore,
      max: 10,
      color: "#a855f7",
      description: "Credentials unused in 30+ days reduce this score",
    },
  ];

  const analyticsTabs = [
    { id: "overview", label: "📊 Overview" },
    { id: "activity", label: "🛡️ Security Activity" },
  ];

  return (
    <div className="space-y-6">

      {/* ── Sub-tab bar ── */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl p-1 w-fit">
        {analyticsTabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150
              ${activeTab === tab.id
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Security Activity tab ── */}
      {activeTab === "activity" && <SecurityActivity />}

      {/* ── Overview tab ── */}
      {activeTab === "overview" && (
      <div className="space-y-8">

      {/* ── Section: Sparkline ── */}
      <Sparkline credentials={credentials} />

      {/* ── Section: Overview ── */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Vault Overview</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon="🔐" label="Total Credentials" value={total} accent="indigo" />
          <StatCard icon="🛡️" label="Strong Passwords" value={strong}
            sub={`${Math.round((strong / total) * 100)}% of vault`} accent="green" />
          <StatCard icon="⚠️" label="Weak Passwords" value={weak}
            sub="Need improvement" accent="red" />
          <StatCard icon="🔄" label="Reused Passwords" value={reused}
            sub="Same password, multiple sites" accent="amber" />
        </div>
      </div>

      {/* ── Section: Security Score + Breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Score ring */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-5">Security Score</h3>
          <div className="flex items-center gap-8">
            <ScoreRing score={securityScore} />
            <div className="flex-1 text-sm text-gray-500 space-y-2">
              <p>Your vault security is rated based on:</p>
              <ul className="space-y-1 text-xs">
                <li>🔑 <span className="font-medium text-gray-700 dark:text-gray-300">40 pts</span> — strong passwords</li>
                <li>🔁 <span className="font-medium text-gray-700 dark:text-gray-300">30 pts</span> — no password reuse</li>
                <li>📅 <span className="font-medium text-gray-700 dark:text-gray-300">20 pts</span> — passwords under 90 days old</li>
                <li>⚡ <span className="font-medium text-gray-700 dark:text-gray-300">10 pts</span> — recently active credentials</li>
              </ul>
              {mostRecent && (
                <p className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800 text-xs">
                  🆕 Most recent: <span className="font-medium text-gray-700 dark:text-gray-300">{mostRecent.website}</span>
                  <span className="text-gray-400 ml-1">— {formatDate(mostRecent.createdAt)}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Score breakdown */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-5">Score Breakdown</h3>
          <div className="space-y-4">
            {breakdownItems.map((item) => (
              <ScoreBar key={item.label} {...item} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Section: Most used + Duplicates ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopAutofilled topAutofilled={topAutofilled} />
        <DuplicatesList duplicateSites={duplicateSites} />
      </div>

      {/* ── Section: Password audit action list ── */}
      <AuditActionList credentials={credentials} onEdit={onEdit} />

      {/* ── Section: Full usage history table ── */}
      <UsageTable credentials={credentials} />
    </div>
      )}
    </div>
  );
}