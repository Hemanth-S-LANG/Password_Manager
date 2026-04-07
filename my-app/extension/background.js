/**
 * background.js — Service Worker (Manifest V3)
 * Bridges content scripts and the backend API.
 */

const API_BASE = "http://localhost:5000/api";
const pendingSaves = {};

// ── Keyboard shortcut handler ─────────────────────────────────────────────────
chrome.commands.onCommand.addListener((command) => {
  if (command !== "autofill") return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]?.id) return;
    chrome.tabs.sendMessage(tabs[0].id, { type: "SHORTCUT_AUTOFILL" });
  });
}); // keyed by tabId

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "FETCH_CREDENTIALS_FOR_DOMAIN":
      fetchCredentialsForDomain(message.domain).then(sendResponse);
      break;
    case "SAVE_CREDENTIAL":
      saveCredentialWithDuplicateCheck(message.payload).then(sendResponse);
      break;
    case "FETCH_ALL_CREDENTIALS":
      fetchAllCredentials().then(sendResponse);
      break;
    case "VERIFY_MASTER":
      verifyMaster(message.password).then(sendResponse);
      break;
    case "GET_AUTH_STATUS":
      getAuthStatus().then(sendResponse);
      break;
    case "GET_LOCKOUT_STATUS":
      getLockoutStatus().then(sendResponse);
      break;

    case "DELETE_CREDENTIAL":
      deleteCredential(message.id).then(sendResponse);
      break;

    case "MARK_USED":                                   // NEW — called after autofill
      markCredentialUsed(message.id).then(sendResponse);
      break;

    case "SAVE_CREDENTIAL_CONFIRMED":
      saveCredential(message.payload).then(sendResponse);
      break;
    case "SET_PENDING_SAVE": {
      const tabId = sender.tab?.id;
      if (tabId) pendingSaves[tabId] = message.data;
      sendResponse({ ok: true });
      break;
    }
    case "GET_PENDING_SAVE": {
      const tabId = sender.tab?.id;
      const pending = tabId ? pendingSaves[tabId] : null;
      if (
        pending &&
        (pending.domain === message.domain ||
          message.domain.endsWith("." + pending.domain) ||
          pending.domain.endsWith("." + message.domain))
      ) {
        delete pendingSaves[tabId];
        sendResponse({ ok: true, data: pending });
      } else {
        if (tabId) delete pendingSaves[tabId];
        sendResponse({ ok: false });
      }
      break;
    }
    case "GET_LOGIN_LOG":
      getLoginLog().then(sendResponse);
      break;
    case "CLEAR_LOGIN_LOG":
      clearLoginLog().then(sendResponse);
      break;
    case "REFRESH_BADGE":
      updateBadge().then(() => sendResponse({ ok: true }));
      break;
    case "SET_ICON_STATE":
      setIconState(message.state);
      sendResponse({ ok: true });
      break;
    case "CHECK_BACKEND":
      checkBackendHealth().then(sendResponse);
      break;

    default:
      sendResponse({ error: "Unknown message type" });
  }
  return true;
});

async function fetchCredentialsForDomain(domain) {
  try {
    const res = await fetch(`${API_BASE}/credentials?website=${encodeURIComponent(domain)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true, data: await res.json() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function fetchAllCredentials() {
  try {
    const res = await fetch(`${API_BASE}/credentials`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true, data: await res.json() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function saveCredential(payload) {
  try {
    const res = await fetch(`${API_BASE}/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    updateBadge(); // refresh badge after new credential saved
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Check for duplicate password before saving
// Returns { ok, data, duplicate: { website, username } | null }
async function saveCredentialWithDuplicateCheck(payload) {
  try {
    // Fetch all existing credentials to check for password reuse
    const allRes = await fetch(`${API_BASE}/credentials`);
    if (allRes.ok) {
      const all = await allRes.json();
      const duplicate = all.find(
        (c) => c.password === payload.password && c.website !== payload.website
      );
      if (duplicate) {
        // Return duplicate info — content script will warn the user
        // but still allow them to save if they confirm
        return {
          ok: true,
          duplicate: { website: duplicate.website, username: duplicate.username },
          payload, // send back so content script can confirm-save
        };
      }
    }
    return await saveCredential(payload);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function deleteCredential(id) {
  try {
    const res = await fetch(`${API_BASE}/credentials/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    updateBadge(); // refresh badge after credential deleted
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ── Lockout config ────────────────────────────────────────────────────────────
// Every 5 wrong attempts triggers a lockout: 1st→1min, 2nd→5min, 3rd+→30min
const LOCKOUT_DURATIONS = [1 * 60 * 1000, 5 * 60 * 1000, 30 * 60 * 1000];

function getStorage(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}
function setStorage(data) {
  return new Promise((resolve) => chrome.storage.local.set(data, resolve));
}

async function verifyMaster(password) {
  const { failedAttempts = 0, lockoutUntil = 0, lockoutCount = 0 } =
    await getStorage(["failedAttempts", "lockoutUntil", "lockoutCount"]);

  // Block immediately if still locked
  if (lockoutUntil > Date.now()) {
    return { ok: false, locked: true, lockoutUntil };
  }

  try {
    const res = await fetch(`${API_BASE}/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();

    if (res.ok && data.success) {
      // Reset everything on success
      await setStorage({ failedAttempts: 0, lockoutUntil: 0, lockoutCount: 0 });
      await appendLoginLog({ timestamp: Date.now(), success: true });
      setIconState("unlocked");
      return { ok: true, data };
    }

    // Wrong password
    const newAttempts = failedAttempts + 1;
    const attemptsLeft = 5 - (newAttempts % 5);

    if (newAttempts % 5 === 0) {
      // Trigger lockout — pick duration tier based on how many lockouts have happened
      const tierIndex = Math.min(lockoutCount, LOCKOUT_DURATIONS.length - 1);
      const newLockoutUntil = Date.now() + LOCKOUT_DURATIONS[tierIndex];
      await setStorage({
        failedAttempts: newAttempts,
        lockoutUntil: newLockoutUntil,
        lockoutCount: lockoutCount + 1,
      });
      await appendLoginLog({ timestamp: Date.now(), success: false, locked: true, lockoutUntil: newLockoutUntil });
      setIconState("locked");
      return { ok: false, locked: true, lockoutUntil: newLockoutUntil };
    }

    await setStorage({ failedAttempts: newAttempts, lockoutUntil: 0, lockoutCount });
    await appendLoginLog({ timestamp: Date.now(), success: false, attemptsLeft });
    return { ok: false, attemptsLeft };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function getLockoutStatus() {
  const { failedAttempts = 0, lockoutUntil = 0 } =
    await getStorage(["failedAttempts", "lockoutUntil"]);
  if (lockoutUntil > Date.now()) {
    return { locked: true, lockoutUntil };
  }
  const attemptsUsed = failedAttempts % 5;
  return { locked: false, attemptsLeft: attemptsUsed === 0 ? 5 : 5 - attemptsUsed };
}

async function getAuthStatus() {
  try {
    const res = await fetch(`${API_BASE}/auth/status`);
    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    setIconState("offline");
    return { ok: false, error: err.message };
  }
}

// NEW — called when content.js or popup autofills a credential
async function markCredentialUsed(id) {
  try {
    const res = await fetch(`${API_BASE}/credentials/${id}/used`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true, data: await res.json() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE 1 — BADGE ALERTS
// Shows a red badge on the extension icon with a count of stale (>90d) + weak
// passwords so the user sees issues passively without opening the vault.
// ═══════════════════════════════════════════════════════════════════════════════

const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;

function isWeakPassword(pwd) {
  return !(
    pwd.length >= 8 &&
    /[A-Z]/.test(pwd) &&
    /[0-9]/.test(pwd) &&
    /[^A-Za-z0-9]/.test(pwd)
  );
}

async function updateBadge() {
  try {
    const res = await fetch(`${API_BASE}/credentials`);
    if (!res.ok) { clearBadge(); return; }
    const creds = await res.json();
    const now = Date.now();

    // Count unique credentials that are stale OR weak (avoid double-counting)
    const flagged = creds.filter((c) => {
      const stale = (now - new Date(c.createdAt)) > NINETY_DAYS;
      const weak  = isWeakPassword(c.password);
      return stale || weak;
    });

    const count = flagged.length;
    if (count === 0) {
      clearBadge();
    } else {
      chrome.action.setBadgeText({ text: count > 99 ? "99+" : String(count) });
      chrome.action.setBadgeBackgroundColor({ color: "#ef4444" }); // red-500
    }
  } catch {
    // Backend offline — clear badge, don't show stale number
    clearBadge();
  }
}

function clearBadge() {
  chrome.action.setBadgeText({ text: "" });
}

// Run badge update on extension startup
updateBadge();

// Also run badge update every 30 minutes via chrome.alarms
// (Service workers can be killed; alarms wake them back up)
chrome.alarms.create("badgeRefresh",   { periodInMinutes: 30 });
chrome.alarms.create("weeklyDigest",   { periodInMinutes: 7 * 24 * 60 }); // once a week

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "badgeRefresh") updateBadge();
  if (alarm.name === "weeklyDigest") sendWeeklyDigest();
});

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE 2 — LOGIN ATTEMPT LOG
// Stores the last 50 master password attempts in chrome.storage.local.
// Each entry: { timestamp, success, attemptsLeft?, locked? }
// Exposed via GET_LOGIN_LOG message so the React dashboard can read it.
// ═══════════════════════════════════════════════════════════════════════════════

const MAX_LOG_ENTRIES = 50;

async function appendLoginLog(entry) {
  const { loginLog = [] } = await getStorage(["loginLog"]);
  const updated = [entry, ...loginLog].slice(0, MAX_LOG_ENTRIES);
  await setStorage({ loginLog: updated });
}

async function getLoginLog() {
  const { loginLog = [] } = await getStorage(["loginLog"]);
  return { ok: true, data: loginLog };
}

async function clearLoginLog() {
  await setStorage({ loginLog: [] });
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE: EXTENSION ICON STATE
// Draws a 16×16 colored circle using ImageData and sets it via chrome.action.setIcon.
// States: "locked" (gray) | "unlocked" (green) | "offline" (red)
// ═══════════════════════════════════════════════════════════════════════════════

const ICON_COLORS = {
  locked:   { bg: [99,  102, 241, 255], fg: [255, 255, 255, 255] }, // indigo
  unlocked: { bg: [34,  197, 94,  255], fg: [255, 255, 255, 255] }, // green
  offline:  { bg: [239, 68,  68,  255], fg: [255, 255, 255, 255] }, // red
};

function drawIconImageData(state) {
  const size   = 16;
  const data   = new Uint8ClampedArray(size * size * 4);
  const colors = ICON_COLORS[state] || ICON_COLORS.locked;
  const cx = size / 2;
  const cy = size / 2;
  const r  = size / 2 - 1;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dist = Math.sqrt((x - cx + 0.5) ** 2 + (y - cy + 0.5) ** 2);
      if (dist <= r) {
        data[idx]     = colors.bg[0];
        data[idx + 1] = colors.bg[1];
        data[idx + 2] = colors.bg[2];
        data[idx + 3] = colors.bg[3];
      } else {
        // Transparent outside circle
        data[idx + 3] = 0;
      }
    }
  }
  return { imageData: { data: Array.from(data), width: size, height: size } };
}

function setIconState(state) {
  try {
    const { imageData } = drawIconImageData(state);
    // Convert plain object back to ImageData-compatible for chrome.action.setIcon
    const size = imageData.width;
    const raw  = new Uint8ClampedArray(imageData.data);

    // chrome.action.setIcon accepts { imageData: ImageData }
    // In service workers we use OffscreenCanvas if available, else path fallback
    if (typeof OffscreenCanvas !== "undefined") {
      const canvas = new OffscreenCanvas(size, size);
      const ctx    = canvas.getContext("2d");
      const id     = new ImageData(raw, size, size);
      ctx.putImageData(id, 0, 0);
      canvas.convertToBlob().then((blob) => {
        createImageBitmap(blob).then((bitmap) => {
          const c2   = new OffscreenCanvas(size, size);
          const ctx2 = c2.getContext("2d");
          ctx2.drawImage(bitmap, 0, 0);
          chrome.action.setIcon({ imageData: ctx2.getImageData(0, 0, size, size) });
        });
      });
    } else {
      // Fallback: use badge color to signal state when ImageData unavailable
      const badgeColors = { locked: "#6366f1", unlocked: "#22c55e", offline: "#ef4444" };
      chrome.action.setBadgeBackgroundColor({ color: badgeColors[state] || "#6366f1" });
    }
  } catch (e) {
    // Never crash the service worker over an icon update
    console.warn("[KeyVault] setIconState failed:", e.message);
  }
}

// Set icon to locked on startup
setIconState("locked");

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE: BACKEND HEALTH CHECK
// Used by popup to check if server is reachable before showing lock screen.
// ═══════════════════════════════════════════════════════════════════════════════

async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, {
      signal: AbortSignal.timeout(4000), // 4s timeout
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE: WEEKLY SECURITY DIGEST
// Fires once a week via chrome.alarms. Fetches vault stats from the backend
// and shows a native Chrome notification summarising password health.
// ═══════════════════════════════════════════════════════════════════════════════

async function sendWeeklyDigest() {
  try {
    const res = await fetch(`${API_BASE}/credentials/stats`);
    if (!res.ok) return;
    const stats = await res.json();
    if (!stats || stats.total === 0) return;

    const { total, weak, reused, securityScore } = stats;
    const issues = weak + reused;

    // Build notification message
    let message;
    let title;
    if (issues === 0) {
      title   = "🛡️ Your vault looks great!";
      message = `All ${total} passwords are strong and unique. Security score: ${securityScore}/100.`;
    } else {
      title   = `⚠️ ${issues} password${issues > 1 ? "s" : ""} need attention`;
      message = [
        weak   > 0 ? `${weak} weak`   : null,
        reused > 0 ? `${reused} reused` : null,
      ].filter(Boolean).join(", ") + `. Score: ${securityScore}/100. Open SecureVault to fix them.`;
    }

    chrome.notifications.create("weeklyDigest_" + Date.now(), {
      type:    "basic",
      iconUrl: "icons/icon48.png",
      title,
      message,
      priority: issues > 0 ? 2 : 0,
    });
  } catch {
    // Backend offline — skip silently
  }
}