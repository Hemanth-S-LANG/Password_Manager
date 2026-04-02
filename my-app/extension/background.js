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
// After every 5 wrong attempts, cooldown escalates: 1 min → 5 min → 30 min (stays)
const LOCKOUT_TIERS = [1 * 60 * 1000, 5 * 60 * 1000, 30 * 60 * 1000]; // ms

async function getLockoutState() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["failedAttempts", "lockoutUntil", "lockoutTier"], resolve);
  });
}

async function setLockoutState(data) {
  return new Promise((resolve) => chrome.storage.local.set(data, resolve));
}

async function verifyMaster(password) {
  // Check lockout before even hitting the API
  const state = await getLockoutState();
  const now = Date.now();
  if (state.lockoutUntil && now < state.lockoutUntil) {
    return { ok: false, locked: true, lockoutUntil: state.lockoutUntil };
  }

  try {
    const res = await fetch(`${API_BASE}/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();

    if (res.ok && data.success) {
      // Success — reset lockout state
      await setLockoutState({ failedAttempts: 0, lockoutUntil: 0, lockoutTier: state.lockoutTier || 0 });
      return { ok: true, data };
    } else {
      // Failed attempt — increment counter
      const attempts = (state.failedAttempts || 0) + 1;
      let lockoutUntil = state.lockoutUntil || 0;
      let tier = state.lockoutTier || 0;

      if (attempts % 5 === 0) {
        // Escalate tier (cap at last tier)
        tier = Math.min(tier + (attempts === 5 ? 0 : 1), LOCKOUT_TIERS.length - 1);
        // First 5 attempts use tier 0, next 5 use tier 1, etc.
        const tierIndex = Math.min(Math.floor(attempts / 5) - 1, LOCKOUT_TIERS.length - 1);
        lockoutUntil = Date.now() + LOCKOUT_TIERS[tierIndex];
        tier = tierIndex + 1; // next tier for next lockout
        await setLockoutState({ failedAttempts: attempts, lockoutUntil, lockoutTier: tier });
        return { ok: false, data, locked: true, lockoutUntil };
      }

      await setLockoutState({ failedAttempts: attempts, lockoutUntil, lockoutTier: tier });
      const attemptsLeft = 5 - (attempts % 5);
      return { ok: false, data, attemptsLeft };
    }
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function getLockoutStatus() {
  const state = await getLockoutState();
  const now = Date.now();
  if (state.lockoutUntil && now < state.lockoutUntil) {
    return { locked: true, lockoutUntil: state.lockoutUntil };
  }
  const attemptsLeft = 5 - ((state.failedAttempts || 0) % 5);
  return { locked: false, attemptsLeft: attemptsLeft === 5 ? 5 : attemptsLeft };
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
