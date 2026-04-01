import { useState } from "react";
import { getCategoryColor } from "../utils/categories";

// Formats date nicely
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// Returns age info for a password
function getPasswordAge(createdAt) {
  const days = Math.floor((Date.now() - new Date(createdAt)) / (1000 * 60 * 60 * 24));
  let label, color, urgent;
  if (days < 30) {
    label = `${days}d old`; color = "text-green-500 dark:text-green-400"; urgent = false;
  } else if (days < 60) {
    label = `${days}d old`; color = "text-yellow-500 dark:text-yellow-400"; urgent = false;
  } else if (days < 90) {
    label = `${days}d old`; color = "text-orange-500 dark:text-orange-400"; urgent = false;
  } else {
    const months = Math.floor(days / 30);
    label = months >= 12
      ? `${Math.floor(months / 12)}y ${months % 12}m old`
      : `${months}mo old`;
    color = "text-red-500 dark:text-red-400"; urgent = true;
  }
  return { days, label, color, urgent };
}

// Copy text to clipboard and show brief feedback
function useCopy() {
  const [copied, setCopied] = useState(null);
  const copy = async (text, key) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };
  return { copied, copy };
}

// Map of common app/bank names to their actual domains
const DOMAIN_MAP = {
  canara: "canarabank.com",
  "canara bank": "canarabank.com",
  sbi: "sbi.co.in",
  hdfc: "hdfcbank.com",
  icici: "icicibank.com",
  axis: "axisbank.com",
  kotak: "kotak.com",
  bookmyshow: "bookmyshow.com",
  "book my show": "bookmyshow.com",
  google: "google.com",
  gmail: "gmail.com",
  whatsapp: "whatsapp.com",
  instagram: "instagram.com",
  facebook: "facebook.com",
  twitter: "twitter.com",
  x: "x.com",
  youtube: "youtube.com",
  netflix: "netflix.com",
  amazon: "amazon.com",
  flipkart: "flipkart.com",
  swiggy: "swiggy.com",
  zomato: "zomato.com",
  paytm: "paytm.com",
  phonepe: "phonepe.com",
  gpay: "pay.google.com",
  "google pay": "pay.google.com",
  linkedin: "linkedin.com",
  github: "github.com",
  spotify: "spotify.com",
  hotstar: "hotstar.com",
  "disney+": "hotstar.com",
  jio: "jio.com",
  airtel: "airtel.in",
  bsnl: "bsnl.co.in",
  uber: "uber.com",
  ola: "olacabs.com",
  irctc: "irctc.co.in",
  makemytrip: "makemytrip.com",
  reddit: "reddit.com",
  snapchat: "snapchat.com",
  telegram: "telegram.org",
  zoom: "zoom.us",
  microsoft: "microsoft.com",
  outlook: "outlook.com",
  yahoo: "yahoo.com",
  apple: "apple.com",
  dropbox: "dropbox.com",
  notion: "notion.so",
  slack: "slack.com",
};

function getFaviconUrl(site) {
  if (!site) return "";
  const lower = site.trim().toLowerCase();

  // Check name map first
  if (DOMAIN_MAP[lower]) {
    return `https://www.google.com/s2/favicons?domain=${DOMAIN_MAP[lower]}&sz=64`;
  }

  // If it looks like a domain or URL, use it directly
  try {
    if (site.includes(".")) {
      const url = site.startsWith("http") ? site : "https://" + site;
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    }
  } catch {}

  // Last resort — try the raw string as a domain guess
  return `https://www.google.com/s2/favicons?domain=${lower}.com&sz=64`;
}

function SiteIcon({ website }) {
  const [failed, setFailed] = useState(false);

  if (!failed) {
    return (
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <img
          src={getFaviconUrl(website)}
          alt={website}
          className="w-6 h-6 object-contain"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className="w-10 h-10 bg-indigo-900/50 rounded-xl flex items-center justify-center flex-shrink-0">
      <span className="text-indigo-300 font-bold text-sm uppercase">
        {website?.charAt(0) || "?"}
      </span>
    </div>
  );
}

export default function CredentialCard({ credential, onDelete, onEdit, isReused = false }) {
  const [showPassword, setShowPassword] = useState(false);
  const { copied, copy } = useCopy();
  const color = getCategoryColor(credential.category);
  const age = getPasswordAge(credential.createdAt);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200 group">
      {/* Card header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <SiteIcon website={credential.website} />
          <div>
            <h3 className="text-gray-900 dark:text-white font-semibold text-base">{credential.website}</h3>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-0.5">
              Added: {formatDate(credential.createdAt)}
              <span className={`ml-2 font-medium ${age.color}`}>· {age.label}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(credential)}
            className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors" title="Edit">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button onClick={() => onDelete(credential._id)}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors" title="Delete">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* 90+ day warning */}
      {age.urgent && (
        <div className="mb-3 flex items-center gap-2 bg-red-50 dark:bg-red-900/20
          border border-red-200 dark:border-red-800/50 rounded-lg px-3 py-2">
          <span className="text-sm">🔄</span>
          <div className="flex-1">
            <p className="text-red-600 dark:text-red-400 text-xs font-medium">
              Password is {age.days} days old — time to update!
            </p>
            <p className="text-red-400 dark:text-red-500 text-xs opacity-75">
              Passwords older than 90 days are a security risk.
            </p>
          </div>
          <button onClick={() => onEdit(credential)}
            className="text-xs bg-red-500 hover:bg-red-600 text-white px-2.5 py-1
              rounded-md font-medium transition-colors flex-shrink-0">
            Update
          </button>
        </div>
      )}

      {/* Category badge + reuse warning */}
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${color.bg} ${color.text} ${color.border}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
          {credential.category || "Others"}
        </span>
        {isReused && (
          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border
            bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400
            border-amber-200 dark:border-amber-800/50" title="This password is reused across multiple sites">
            ⚠️ Reused password
          </span>
        )}
      </div>

      {/* Username row */}
      <div className="flex items-center gap-2 mb-2">
        <input readOnly value={credential.username}
          className="flex-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-700 dark:text-gray-300 text-sm focus:outline-none" />
        <button onClick={() => copy(credential.username, "user")}
          className="flex items-center gap-1 px-2 py-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0">
          {copied === "user" ? <><CheckIcon /><span className="text-xs text-green-500">Copied!</span></> : <CopyIcon />}
        </button>
      </div>

      {/* Password row */}
      <div className="flex items-center gap-2">
        <input readOnly type={showPassword ? "text" : "password"} value={credential.password}
          className="flex-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-700 dark:text-gray-300 text-sm focus:outline-none" />
        <button onClick={() => setShowPassword(!showPassword)}
          className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0">
          {showPassword ? <EyeOffIcon /> : <EyeIcon />}
        </button>
        <button onClick={() => copy(credential.password, "pwd")}
          className="flex items-center gap-1 px-2 py-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0">
          {copied === "pwd" ? <><CheckIcon /><span className="text-xs text-green-500">Copied!</span></> : <CopyIcon />}
        </button>
      </div>
    </div>
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
function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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
