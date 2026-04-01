// ── DOM refs ──────────────────────────────────────────────────────────────────
const lockScreen    = document.getElementById("lock-screen");
const mainScreen    = document.getElementById("main-screen");
const masterInput   = document.getElementById("master-input");
const unlockBtn     = document.getElementById("unlock-btn");
const lockError     = document.getElementById("lock-error");
const lockBtn       = document.getElementById("lock-btn");
const searchInput   = document.getElementById("search-input");
const searchClear   = document.getElementById("search-clear");
const credList      = document.getElementById("cred-list");
const emptyState    = document.getElementById("empty-state");
const mainError     = document.getElementById("main-error");
const credCount     = document.getElementById("cred-count");
const thisSiteBar   = document.getElementById("this-site-bar");
const siteBarDomain = document.getElementById("site-bar-domain");
const detailPanel   = document.getElementById("detail-panel");
const detailBack    = document.getElementById("detail-back");
const detailTitle   = document.getElementById("detail-title");
const detailBody    = document.getElementById("detail-body");

let allCredentials = [];
let currentDomain  = "";
let activeTab      = "all"; // "all" | "site"

// ── Domain map for favicons ───────────────────────────────────────────────────
const DOMAIN_MAP = {
  canara:"canarabank.com","canara bank":"canarabank.com",sbi:"sbi.co.in",
  hdfc:"hdfcbank.com",icici:"icicibank.com",axis:"axisbank.com",kotak:"kotak.com",
  bookmyshow:"bookmyshow.com","book my show":"bookmyshow.com",
  google:"google.com",gmail:"gmail.com",whatsapp:"whatsapp.com",
  instagram:"instagram.com",facebook:"facebook.com",twitter:"twitter.com",
  x:"x.com",youtube:"youtube.com",netflix:"netflix.com",amazon:"amazon.com",
  flipkart:"flipkart.com",swiggy:"swiggy.com",zomato:"zomato.com",
  paytm:"paytm.com",phonepe:"phonepe.com","google pay":"pay.google.com",
  gpay:"pay.google.com",linkedin:"linkedin.com",github:"github.com",
  spotify:"spotify.com",hotstar:"hotstar.com",jio:"jio.com",
  airtel:"airtel.in",uber:"uber.com",ola:"olacabs.com",irctc:"irctc.co.in",
  makemytrip:"makemytrip.com",reddit:"reddit.com",snapchat:"snapchat.com",
  telegram:"telegram.org",zoom:"zoom.us",microsoft:"microsoft.com",
  outlook:"outlook.com",yahoo:"yahoo.com",slack:"slack.com",notion:"notion.so",
};

function getFavicon(site) {
  const lower = (site || "").trim().toLowerCase();
  const domain = DOMAIN_MAP[lower] ||
    (site.includes(".") ? (() => { try { return new URL(site.startsWith("http") ? site : "https://"+site).hostname; } catch { return lower+".com"; } })() : lower+".com");
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

// ── Init ──────────────────────────────────────────────────────────────────────
(async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url) {
    try { currentDomain = new URL(tab.url).hostname; } catch {}
  }

  const res = await sendMsg({ type: "GET_AUTH_STATUS" });
  if (!res?.ok) { showError(lockError, "Cannot reach backend. Is the server running?"); return; }
  if (!res.data.hasPassword) { showError(lockError, "No master password set. Open the dashboard first."); return; }
  showLockScreen();
})();

// ── Lock / Unlock ─────────────────────────────────────────────────────────────
function showLockScreen() {
  lockScreen.classList.remove("hidden");
  mainScreen.classList.add("hidden");
  masterInput.value = "";
  setTimeout(() => masterInput.focus(), 50);
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
  unlockBtn.textContent = "Unlock Vault";
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

// ── Load credentials ──────────────────────────────────────────────────────────
async function loadCredentials() {
  const res = await sendMsg({ type: "FETCH_ALL_CREDENTIALS" });
  if (!res?.ok) { showError(mainError, "Failed to load credentials."); return; }
  allCredentials = res.data || [];
  credCount.textContent = allCredentials.length;

  // Show "this site" bar if we have credentials for current domain
  const siteCreds = getSiteCreds();
  if (siteCreds.length > 0 && currentDomain) {
    thisSiteBar.classList.remove("hidden");
    siteBarDomain.textContent = currentDomain;
    thisSiteBar.querySelector(".site-bar-label").textContent =
      `— ${siteCreds.length} credential${siteCreds.length > 1 ? "s" : ""} saved`;
  }

  renderList();
}

function getSiteCreds() {
  if (!currentDomain) return [];
  return allCredentials.filter(
    (c) => c.website.toLowerCase().includes(currentDomain) ||
           currentDomain.includes(c.website.toLowerCase())
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeTab = btn.dataset.tab;
    renderList();
  });
});

// ── Search ────────────────────────────────────────────────────────────────────
searchInput.addEventListener("input", () => {
  searchClear.classList.toggle("hidden", !searchInput.value);
  renderList();
});
searchClear.addEventListener("click", () => {
  searchInput.value = "";
  searchClear.classList.add("hidden");
  renderList();
  searchInput.focus();
});

// ── Render ────────────────────────────────────────────────────────────────────
function renderList() {
  const q = searchInput.value.toLowerCase();
  let creds = activeTab === "site" ? getSiteCreds() : allCredentials;

  if (q) {
    creds = creds.filter(
      (c) => c.website.toLowerCase().includes(q) || c.username.toLowerCase().includes(q)
    );
  }

  credList.innerHTML = "";

  if (creds.length === 0) {
    emptyState.classList.remove("hidden");
    emptyState.querySelector(".empty-sub").textContent =
      q ? "Try a different search term" :
      activeTab === "site" ? `No credentials saved for ${currentDomain}` :
      "Click Save when you log into a website";
    return;
  }

  emptyState.classList.add("hidden");
  creds.forEach((c) => credList.appendChild(buildCard(c)));
}

// ── Credential card ───────────────────────────────────────────────────────────
function buildCard(cred) {
  const card = document.createElement("div");
  card.className = "cred-card";

  const faviconUrl = getFavicon(cred.website);
  const letter = escHtml((cred.website || "?").charAt(0).toUpperCase());

  card.innerHTML = `
    <img class="cred-favicon" src="${faviconUrl}" alt=""
      onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
    <div class="cred-favicon-fb" style="display:none;">${letter}</div>
    <div class="cred-info">
      <div class="cred-site">${escHtml(cred.website)}</div>
      <div class="cred-user">${escHtml(cred.username)}</div>
    </div>
    <div class="cred-quick">
      <button class="q-btn btn-copy-u" title="Copy username">👤</button>
      <button class="q-btn btn-copy-p" title="Copy password">🔑</button>
      <button class="q-btn danger btn-delete" title="Delete">🗑</button>
    </div>`;

  // Open detail on card click (not on action buttons)
  card.addEventListener("click", (e) => {
    if (e.target.closest(".cred-quick")) return;
    openDetail(cred);
  });

  card.querySelector(".btn-copy-u").onclick = (e) => {
    e.stopPropagation();
    copyToClipboard(cred.username, "Username copied!");
  };
  card.querySelector(".btn-copy-p").onclick = (e) => {
    e.stopPropagation();
    copyToClipboard(cred.password, "Password copied!");
  };
  card.querySelector(".btn-delete").onclick = (e) => {
    e.stopPropagation();
    deleteCredential(cred._id, card);
  };

  return card;
}

// ── Detail panel ──────────────────────────────────────────────────────────────
function openDetail(cred) {
  detailTitle.textContent = cred.website;
  detailPanel.classList.remove("hidden");

  const faviconUrl = getFavicon(cred.website);
  const letter = escHtml((cred.website || "?").charAt(0).toUpperCase());

  detailBody.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
      <img src="${faviconUrl}" width="36" height="36" style="border-radius:8px;object-fit:contain;"
        onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
      <div style="display:none;width:36px;height:36px;border-radius:8px;background:#312e81;
        color:#a5b4fc;font-size:16px;font-weight:700;align-items:center;justify-content:center;">
        ${letter}
      </div>
      <div>
        <div style="font-size:15px;font-weight:700;color:#e0e7ff;">${escHtml(cred.website)}</div>
        <div style="font-size:11px;color:#4b5563;margin-top:2px;">${escHtml(cred.category || "Others")}</div>
      </div>
    </div>

    <div class="detail-field">
      <div class="detail-label">Username / Email</div>
      <div class="detail-value-row">
        <span class="detail-value">${escHtml(cred.username)}</span>
        <button class="copy-btn" data-copy="${escHtml(cred.username)}" title="Copy">📋</button>
      </div>
    </div>

    <div class="detail-field">
      <div class="detail-label">Password</div>
      <div class="detail-value-row">
        <span class="detail-value" id="pwd-val" style="filter:blur(4px);transition:filter .2s;">
          ${escHtml(cred.password)}
        </span>
        <button class="copy-btn" id="toggle-pwd" title="Show/Hide">👁</button>
        <button class="copy-btn" data-copy="${escHtml(cred.password)}" title="Copy">📋</button>
      </div>
    </div>

    <div class="detail-actions">
      <button class="btn-fill-detail" id="detail-fill">⚡ Autofill on page</button>
      <button class="btn-delete-detail" id="detail-delete">🗑 Delete</button>
    </div>`;

  // Toggle password visibility
  let pwdVisible = false;
  document.getElementById("toggle-pwd").onclick = () => {
    pwdVisible = !pwdVisible;
    document.getElementById("pwd-val").style.filter = pwdVisible ? "none" : "blur(4px)";
    document.getElementById("toggle-pwd").textContent = pwdVisible ? "🙈" : "👁";
  };

  // Copy buttons
  detailBody.querySelectorAll(".copy-btn[data-copy]").forEach((btn) => {
    btn.onclick = () => copyToClipboard(btn.dataset.copy, "Copied!");
  });

  // Autofill
  document.getElementById("detail-fill").onclick = () => autofillInTab(cred);

  // Delete
  document.getElementById("detail-delete").onclick = () => {
    deleteCredential(cred._id, null, () => {
      detailPanel.classList.add("hidden");
    });
  };
}

detailBack.addEventListener("click", () => detailPanel.classList.add("hidden"));

// ── Delete ────────────────────────────────────────────────────────────────────
async function deleteCredential(id, cardEl, onSuccess) {
  if (!confirm("Delete this credential?")) return;
  const res = await sendMsg({ type: "DELETE_CREDENTIAL", id });
  if (res?.ok) {
    allCredentials = allCredentials.filter((c) => c._id !== id);
    credCount.textContent = allCredentials.length;
    if (cardEl) cardEl.remove();
    renderList();
    if (onSuccess) onSuccess();
    showToast("Deleted!");
  } else {
    showToast("Failed to delete.");
  }
}

// ── Autofill into active tab ──────────────────────────────────────────────────
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
  showToast(`✅ Filled: ${cred.username}`);
  window.close();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function copyToClipboard(text, msg) {
  navigator.clipboard.writeText(text).then(() => showToast(msg));
}

function showToast(msg) {
  let t = document.getElementById("kv-popup-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "kv-popup-toast";
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
