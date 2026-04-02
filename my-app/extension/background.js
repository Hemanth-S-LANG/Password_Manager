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
    return { ok: true, data: await res.json() };
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
      return { ok: false, locked: true, lockoutUntil: newLockoutUntil };
    }

    await setStorage({ failedAttempts: newAttempts, lockoutUntil: 0, lockoutCount });
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
    return { ok: false, error: err.message };
  }
}
