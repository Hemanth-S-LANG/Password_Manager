/**
 * background.js — Service Worker (Manifest V3)
 * Bridges content scripts and the backend API.
 */

const API_BASE = "http://localhost:5000/api";
const pendingSaves = {}; // keyed by tabId

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "FETCH_CREDENTIALS_FOR_DOMAIN":
      fetchCredentialsForDomain(message.domain).then(sendResponse);
      break;
    case "SAVE_CREDENTIAL":
      saveCredential(message.payload).then(sendResponse);
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

async function verifyMaster(password) {
  try {
    const res = await fetch(`${API_BASE}/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    return { ok: res.ok, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
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
