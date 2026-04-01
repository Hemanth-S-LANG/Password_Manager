const lockScreen    = document.getElementById("lock-screen");
const mainScreen    = document.getElementById("main-screen");
const masterInput   = document.getElementById("master-input");
const unlockBtn     = document.getElementById("unlock-btn");
const lockError     = document.getElementById("lock-error");
const lockBtn       = document.getElementById("lock-btn");
const searchInput   = document.getElementById("search-input");
const currentSiteSection = document.getElementById("current-site-section");
const currentSiteList    = document.getElementById("current-site-list");
const allCredsList  = document.getElementById("all-creds-list");
const emptyMsg      = document.getElementById("empty-msg");
const mainError     = document.getElementById("main-error");

let allCredentials = [];
let currentDomain  = "";

(async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url) {
    try { currentDomain = new URL(tab.url).hostname; } catch {}
  }
  const res = await sendMsg({ type: "GET_AUTH_STATUS" });
  if (!res?.ok) {
    showError(lockError, "Cannot reach backend. Is the server running?");
    return;
  }
  if (!res.data.hasPassword) {
    showError(lockError, "No master password set. Please open the dashboard first.");
    return;
  }
  showLockScreen();
})();

function showLockScreen() {
  lockScreen.classList.remove("hidden");
  mainScreen.classList.add("hidden");
  masterInput.value = "";
  masterInput.focus();
}

function showMainScreen() {
  lockScreen.classList.add("hidden");
  mainScreen.classList.remove("hidden");
  loadCredentials();
}

unlockBtn.addEventListener("click", handleUnlock);
masterInput.addEventListener("keydown", (e) => { if (e.key === "Enter") handleUnlock(); });

async function handleUnlock() {
  const password = masterInput.value.trim();
  if (!password) return;
  unlockBtn.textContent = "Verifying…";
  unlockBtn.disabled = true;
  const res = await sendMsg({ type: "VERIFY_MASTER", password });
  unlockBtn.textContent = "Unlock";
  unlockBtn.disabled = false;
  if (res?.ok && res.data?.success) {
    hideError(lockError);
    showMainScreen();
  } else {
    showError(lockError, "Incorrect master password.");
    masterInput.select();
  }
}

lockBtn.addEventListener("click", showLockScreen);

async function loadCredentials() {
  const res = await sendMsg({ type: "FETCH_ALL_CREDENTIALS" });
  if (!res?.ok) {
    showError(mainError, "Failed to load credentials.");
    return;
  }
  allCredentials = res.data || [];
  renderCredentials(allCredentials);
}

function renderCredentials(creds) {
  allCredsList.innerHTML = "";
  currentSiteList.innerHTML = "";

  const siteCreds = currentDomain
    ? creds.filter((c) => c.website.includes(currentDomain) || currentDomain.includes(c.website))
    : [];

  if (siteCreds.length > 0) {
    currentSiteSection.classList.remove("hidden");
    siteCreds.forEach((c) => currentSiteList.appendChild(buildCard(c, true)));
  } else {
    currentSiteSection.classList.add("hidden");
  }

  if (creds.length === 0) {
    emptyMsg.classList.remove("hidden");
  } else {
    emptyMsg.classList.add("hidden");
    creds.forEach((c) => allCredsList.appendChild(buildCard(c, false)));
  }
}

function buildCard(cred, isCurrentSite) {
  const card = document.createElement("div");
  card.className = "cred-card";
  card.innerHTML = `
    <div class="cred-info">
      <div class="cred-site">${escHtml(cred.website)}</div>
      <div class="cred-user">${escHtml(cred.username)}</div>
    </div>
    <div class="cred-actions">
      ${isCurrentSite ? `<button class="btn-sm btn-fill" title="Autofill">⚡ Fill</button>` : ""}
      <button class="btn-sm btn-copy-user" title="Copy username">👤</button>
      <button class="btn-sm btn-copy-pass" title="Copy password">🔑</button>
    </div>`;
  card.querySelector(".btn-copy-user").onclick = () => copyToClipboard(cred.username, "Username copied!");
  card.querySelector(".btn-copy-pass").onclick = () => copyToClipboard(cred.password, "Password copied!");
  if (isCurrentSite) card.querySelector(".btn-fill").onclick = () => autofillInTab(cred);
  return card;
}

async function autofillInTab(cred) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (username, password) => {
      function setVal(el, val) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        if (setter) setter.call(el, val); else el.value = val;
        el.dispatchEvent(new Event("input",  { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const pw = Array.from(document.querySelectorAll('input[type="password"]'))
        .find((el) => el.offsetParent !== null);
      if (!pw) return;
      const sels = ['input[type="email"]','input[autocomplete="username"]',
        'input[name*="user" i]','input[name*="email" i]','input[type="text"]'];
      let user = null;
      for (const s of sels) {
        user = Array.from(document.querySelectorAll(s)).find((el) => el !== pw && el.offsetParent !== null);
        if (user) break;
      }
      if (user) setVal(user, username);
      setVal(pw, password);
    },
    args: [cred.username, cred.password],
  });
  window.close();
}

searchInput.addEventListener("input", () => {
  const q = searchInput.value.toLowerCase();
  renderCredentials(allCredentials.filter(
    (c) => c.website.toLowerCase().includes(q) || c.username.toLowerCase().includes(q)
  ));
});

function copyToClipboard(text, msg) {
  navigator.clipboard.writeText(text).then(() => showToast(msg));
}

function showToast(msg) {
  let t = document.getElementById("kv-popup-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "kv-popup-toast";
    t.style.cssText = "position:fixed;bottom:12px;left:50%;transform:translateX(-50%);" +
      "background:#4f46e5;color:#fff;border-radius:8px;padding:6px 14px;" +
      "font-size:12px;z-index:9999;white-space:nowrap;";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = "1";
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = "0"; }, 2000);
}

function showError(el, msg) { el.textContent = msg; el.classList.remove("hidden"); }
function hideError(el) { el.classList.add("hidden"); }
function escHtml(str) {
  return String(str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
function sendMsg(msg) {
  return new Promise((resolve) => {
    try { chrome.runtime.sendMessage(msg, resolve); }
    catch (e) { resolve({ ok: false, error: e.message }); }
  });
}
