// ── i18n helper ───────────────────────────────────────────────────────────────
// Wraps chrome.i18n.getMessage with substitution support.
// Falls back to the key itself if the message isn't found (safe for dev).
function t(key, ...subs) {
  const msg = chrome.i18n.getMessage(key, subs);
  return msg || key;
}

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

  // First check if backend is reachable
  const health = await sendMsg({ type: "CHECK_BACKEND" });
  if (!health?.ok) {
    showOfflineScreen();
    return;
  }

  const res = await sendMsg({ type: "GET_AUTH_STATUS" });
  if (!res?.ok) { showOfflineScreen(); return; }
  if (!res.data.hasPassword) { showError(lockError, t("errNoPassword")); showLockScreen(); return; }

  const lockStatus = await sendMsg({ type: "GET_LOCKOUT_STATUS" });
  if (lockStatus?.locked) {
    showLockScreen();
    startLockoutCountdown(lockStatus.lockoutUntil);
  } else {
    showLockScreen();
    if (lockStatus && lockStatus.attemptsLeft < 5) {
      showError(lockError, t("errAttemptsLeft", String(lockStatus.attemptsLeft)));
    }
  }
})();

// ── Lock / Unlock ─────────────────────────────────────────────────────────────
function showLockScreen() {
  stopIdleLock(); // cancel any pending idle lock timer
  lockScreen.classList.remove("hidden");
  mainScreen.classList.add("hidden");
  document.getElementById("offline-screen").classList.add("hidden");
  masterInput.value = "";
  sendMsg({ type: "SET_ICON_STATE", state: "locked" });
  // Return focus to the password input
  setTimeout(() => masterInput.focus(), 50);
}

function showMainScreen() {
  lockScreen.classList.add("hidden");
  mainScreen.classList.remove("hidden");
  document.getElementById("offline-screen").classList.add("hidden");
  loadCredentials();
  // Move focus to search so keyboard users can start immediately
  setTimeout(() => searchInput.focus(), 50);
  // Start idle auto-lock timer
  startIdleLock();
}

function showOfflineScreen() {
  lockScreen.classList.add("hidden");
  mainScreen.classList.add("hidden");
  document.getElementById("offline-screen").classList.remove("hidden");
  sendMsg({ type: "SET_ICON_STATE", state: "offline" });
}

unlockBtn.addEventListener("click", handleUnlock);
masterInput.addEventListener("keydown", (e) => { if (e.key === "Enter") handleUnlock(); });

async function handleUnlock() {
  const password = masterInput.value.trim();
  if (!password) return;
  unlockBtn.textContent = t("verifying");
  unlockBtn.disabled = true;
  masterInput.disabled = true;

  const res = await sendMsg({ type: "VERIFY_MASTER", password });

  if (res?.ok && res.data?.success) {
    hideError(lockError);
    clearLockoutUI();
    showMainScreen();
    // Refresh badge immediately after unlock so stale count is up to date
    sendMsg({ type: "REFRESH_BADGE" });
    sendMsg({ type: "SET_ICON_STATE", state: "unlocked" });
  } else if (res?.locked) {
    startLockoutCountdown(res.lockoutUntil);
    unlockBtn.textContent = t("unlockVault");
  } else {
    unlockBtn.textContent = t("unlockVault");
    unlockBtn.disabled = false;
    masterInput.disabled = false;
    const left = res?.attemptsLeft;
    const msg = left != null ? t("errAttemptsLeft", String(left)) : t("errIncorrect");
    showError(lockError, msg);
    masterInput.select();
    masterInput.focus();
  }
}

// ── Lockout countdown UI ──────────────────────────────────────────────────────
let _countdownTimer = null;

function startLockoutCountdown(lockoutUntil) {
  masterInput.disabled = true;
  unlockBtn.disabled = true;
  clearInterval(_countdownTimer);
  lockError.classList.add("lockout");

  function tick() {
    const remaining = lockoutUntil - Date.now();
    if (remaining <= 0) {
      clearInterval(_countdownTimer);
      clearLockoutUI();
      lockError.classList.remove("lockout");
      showError(lockError, t("msgTryAgain"));
      masterInput.focus();
      return;
    }
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    showError(lockError, t("errLockout", timeStr));
  }

  tick();
  _countdownTimer = setInterval(tick, 1000);
}

function clearLockoutUI() {
  clearInterval(_countdownTimer);
  masterInput.disabled = false;
  masterInput.value = "";
  unlockBtn.disabled = false;
  unlockBtn.textContent = t("unlockVault");
  lockError.classList.remove("lockout");
  hideError(lockError);
}

lockBtn.addEventListener("click", () => {
  showLockScreen();
  sendMsg({ type: "SET_ICON_STATE", state: "locked" });
});

// ── Offline retry button ──────────────────────────────────────────────────────
document.getElementById("retry-btn")?.addEventListener("click", async () => {
  const btn = document.getElementById("retry-btn");
  btn.disabled = true;
  btn.textContent = "Checking...";

  const health = await sendMsg({ type: "CHECK_BACKEND" });
  if (!health?.ok) {
    btn.disabled = false;
    btn.textContent = "↺ Retry Connection";
    // Flash red to signal still offline
    btn.style.borderColor = "#ef4444";
    btn.style.color = "#f87171";
    setTimeout(() => {
      btn.style.borderColor = "";
      btn.style.color = "";
    }, 1200);
    return;
  }

  // Backend is back — re-run normal init flow
  const res = await sendMsg({ type: "GET_AUTH_STATUS" });
  if (!res?.ok || !res.data?.hasPassword) {
    btn.disabled = false;
    btn.textContent = "↺ Retry Connection";
    return;
  }
  const lockStatus = await sendMsg({ type: "GET_LOCKOUT_STATUS" });
  if (lockStatus?.locked) {
    showLockScreen();
    startLockoutCountdown(lockStatus.lockoutUntil);
  } else {
    showLockScreen();
  }
});

// ── Load credentials ──────────────────────────────────────────────────────────
async function loadCredentials() {
  const res = await sendMsg({ type: "FETCH_ALL_CREDENTIALS" });
  if (!res?.ok) { showError(mainError, t("loadFailed")); return; }
  allCredentials = res.data || [];

  // Update count badge with accessible label
  credCount.textContent = allCredentials.length;
  credCount.setAttribute("aria-label", `${allCredentials.length} credentials stored`);

  const siteCreds = getSiteCreds();
  if (siteCreds.length > 0 && currentDomain) {
    thisSiteBar.classList.remove("hidden");
    siteBarDomain.textContent = currentDomain;
    thisSiteBar.querySelector(".site-bar-label").textContent =
      `— ${siteCreds.length} credential${siteCreds.length > 1 ? "s" : ""} saved`;
    thisSiteBar.setAttribute("aria-label", `${siteCreds.length} credentials saved for ${currentDomain}`);
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
    document.querySelectorAll(".tab-btn").forEach((b) => {
      b.classList.remove("active");
      b.setAttribute("aria-selected", "false");
    });
    btn.classList.add("active");
    btn.setAttribute("aria-selected", "true");
    activeTab = btn.dataset.tab;
    renderList();
  });

  // Keyboard: arrow keys to switch tabs
  btn.addEventListener("keydown", (e) => {
    const tabs = [...document.querySelectorAll(".tab-btn")];
    const idx  = tabs.indexOf(btn);
    if (e.key === "ArrowRight" && idx < tabs.length - 1) { e.preventDefault(); tabs[idx + 1].focus(); tabs[idx + 1].click(); }
    if (e.key === "ArrowLeft"  && idx > 0)               { e.preventDefault(); tabs[idx - 1].focus(); tabs[idx - 1].click(); }
  });
});

// ── Search ────────────────────────────────────────────────────────────────────
searchInput.addEventListener("input", () => {
  searchClear.classList.toggle("hidden", !searchInput.value);
  searchClear.setAttribute("aria-hidden", !searchInput.value ? "true" : "false");
  renderList();
});
searchClear.addEventListener("click", () => {
  searchInput.value = "";
  searchClear.classList.add("hidden");
  searchClear.setAttribute("aria-hidden", "true");
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
    const sub = q ? t("emptySubSearch")
      : activeTab === "site" ? t("emptySubSite")
      : t("emptySubDefault");
    emptyState.querySelector(".empty-sub").textContent = sub;
    return;
  }

  emptyState.classList.add("hidden");
  creds.forEach((c, i) => {
    const li = document.createElement("li");
    li.setAttribute("role", "listitem");
    li.appendChild(buildCard(c));
    credList.appendChild(li);
  });
}

// ── Credential card ───────────────────────────────────────────────────────────
function buildCard(cred) {
  const card = document.createElement("div");
  card.className = "cred-card";
  card.setAttribute("tabindex", "0");
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `${cred.website}, ${cred.username}. Press Enter to view details.`);

  const faviconUrl = getFavicon(cred.website);
  const letter = escHtml((cred.website || "?").charAt(0).toUpperCase());

  card.innerHTML = `
    <img class="cred-favicon" src="${faviconUrl}" alt="${escHtml(cred.website)} logo"
      onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
    <div class="cred-favicon-fb" style="display:none;" aria-hidden="true">${letter}</div>
    <div class="cred-info">
      <div class="cred-site">${escHtml(cred.website)}</div>
      <div class="cred-user">${escHtml(cred.username)}</div>
    </div>
    <div class="cred-quick" role="group" aria-label="Quick actions for ${escHtml(cred.website)}">
      <button class="q-btn btn-copy-u" aria-label="${t("copyUsername")} for ${escHtml(cred.website)}">👤</button>
      <button class="q-btn btn-copy-p" aria-label="${t("copyPassword")} for ${escHtml(cred.website)}">🔑</button>
      <button class="q-btn danger btn-delete" aria-label="${t("deleteCredential")} for ${escHtml(cred.website)}">🗑</button>
    </div>`;

  // Click or Enter/Space to open detail
  card.addEventListener("click", (e) => {
    if (e.target.closest(".cred-quick")) return;
    openDetail(cred);
  });
  card.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && !e.target.closest(".cred-quick")) {
      e.preventDefault();
      openDetail(cred);
    }
  });

  card.querySelector(".btn-copy-u").onclick = (e) => {
    e.stopPropagation();
    copyToClipboard(cred.username, t("usernameCopied"));
  };
  card.querySelector(".btn-copy-p").onclick = (e) => {
    e.stopPropagation();
    copyToClipboard(cred.password, t("passwordCopied"));
  };
  card.querySelector(".btn-delete").onclick = (e) => {
    e.stopPropagation();
    deleteCredential(cred._id, card.closest("li") || card);
  };

  return card;
}

// ── Detail panel — with focus trap ───────────────────────────────────────────
let _lastFocusBeforeDetail = null;

function openDetail(cred) {
  _lastFocusBeforeDetail = document.activeElement;

  detailTitle.textContent = cred.website;
  detailPanel.setAttribute("aria-label", t("credentialDetails", cred.website));
  detailPanel.classList.remove("hidden");

  const faviconUrl = getFavicon(cred.website);
  const letter = escHtml((cred.website || "?").charAt(0).toUpperCase());

  detailBody.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
      <img src="${faviconUrl}" width="36" height="36" style="border-radius:8px;object-fit:contain;"
        alt="${escHtml(cred.website)} logo"
        onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
      <div style="display:none;width:36px;height:36px;border-radius:8px;background:#312e81;
        color:#a5b4fc;font-size:16px;font-weight:700;align-items:center;justify-content:center;"
        aria-hidden="true">${letter}</div>
      <div>
        <div style="font-size:15px;font-weight:700;color:#e0e7ff;">${escHtml(cred.website)}</div>
        <div style="font-size:11px;color:#4b5563;margin-top:2px;">${escHtml(cred.category || "Others")}</div>
      </div>
    </div>

    <div class="detail-field">
      <div class="detail-label" id="lbl-user">${t("detailUsernameLabel")}</div>
      <div class="detail-value-row" role="group" aria-labelledby="lbl-user">
        <span class="detail-value" aria-label="Username: ${escHtml(cred.username)}">${escHtml(cred.username)}</span>
        <button class="copy-btn" data-copy="${escHtml(cred.username)}" aria-label="${t("copyUsername")}">📋</button>
      </div>
    </div>

    <div class="detail-field">
      <div class="detail-label" id="lbl-pwd">${t("detailPasswordLabel")}</div>
      <div class="detail-value-row" role="group" aria-labelledby="lbl-pwd">
        <span class="detail-value" id="pwd-val" style="filter:blur(4px);transition:filter .2s;"
          aria-label="Password hidden">••••••••</span>
        <button class="copy-btn" id="toggle-pwd" aria-label="${t("showPassword")}" aria-pressed="false">👁</button>
        <button class="copy-btn" data-copy="${escHtml(cred.password)}" aria-label="${t("copyPassword")}">📋</button>
      </div>
    </div>

    ${cred.notes ? `
    <div class="detail-field">
      <div class="detail-label">Notes</div>
      <div style="background:#1e1b4b;border:1px solid #312e81;border-radius:8px;padding:8px 10px;">
        <p style="color:#c7d2fe;font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-word;margin:0;">${escHtml(cred.notes)}</p>
      </div>
    </div>` : ""}

    <div class="detail-actions">
      <button class="btn-fill-detail" id="detail-fill" aria-label="${t("autofill")} for ${escHtml(cred.website)}">⚡ ${t("autofill")}</button>
      <button class="btn-delete-detail" id="detail-delete" aria-label="${t("deleteCredential")} for ${escHtml(cred.website)}">🗑 ${t("delete")}</button>
    </div>`;

  // Toggle password visibility
  let pwdVisible = false;
  const pwdVal   = document.getElementById("pwd-val");
  const toggleBtn = document.getElementById("toggle-pwd");
  toggleBtn.onclick = () => {
    pwdVisible = !pwdVisible;
    pwdVal.style.filter = pwdVisible ? "none" : "blur(4px)";
    pwdVal.textContent  = pwdVisible ? cred.password : "••••••••";
    pwdVal.setAttribute("aria-label", pwdVisible ? `Password: ${cred.password}` : "Password hidden");
    toggleBtn.textContent = pwdVisible ? "🙈" : "👁";
    toggleBtn.setAttribute("aria-label", pwdVisible ? t("hidePassword") : t("showPassword"));
    toggleBtn.setAttribute("aria-pressed", String(pwdVisible));
  };

  detailBody.querySelectorAll(".copy-btn[data-copy]").forEach((btn) => {
    btn.onclick = () => copyToClipboard(btn.dataset.copy, t("copied"));
  });

  document.getElementById("detail-fill").onclick = () => autofillInTab(cred);
  document.getElementById("detail-delete").onclick = () => {
    deleteCredential(cred._id, null, () => closeDetail());
  };

  // Focus the back button when panel opens
  setTimeout(() => detailBack.focus(), 50);

  // Trap focus inside detail panel
  detailPanel.addEventListener("keydown", trapFocus);
}

function closeDetail() {
  detailPanel.classList.add("hidden");
  detailPanel.removeEventListener("keydown", trapFocus);
  // Return focus to where it was before opening
  if (_lastFocusBeforeDetail) _lastFocusBeforeDetail.focus();
}

detailBack.addEventListener("click", closeDetail);

// Close detail on Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !detailPanel.classList.contains("hidden")) {
    closeDetail();
  }
});

// Focus trap helper — keeps Tab/Shift+Tab inside the detail panel
function trapFocus(e) {
  if (e.key !== "Tab") return;
  const focusable = [...detailPanel.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )].filter((el) => !el.disabled && el.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last  = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault(); last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault(); first.focus();
  }
}

// ── Styled confirm modal (replaces native confirm()) ─────────────────────────
function showConfirmModal({ title, message, confirmLabel = "Delete", onConfirm }) {
  document.getElementById("kv-confirm-modal")?.remove();

  const modal = document.createElement("div");
  modal.id = "kv-confirm-modal";
  modal.style.cssText = [
    "position:fixed;inset:0;z-index:2147483647;",
    "display:flex;align-items:center;justify-content:center;padding:16px;",
    "background:rgba(0,0,0,0.65);backdrop-filter:blur(2px);",
  ].join("");

  modal.innerHTML = `
    <div style="background:#111827;border:1px solid #374151;border-radius:16px;
      width:100%;max-width:320px;box-shadow:0 24px 48px rgba(0,0,0,.6);
      font-family:system-ui,sans-serif;overflow:hidden;">
      <div style="padding:20px 20px 16px;display:flex;align-items:flex-start;gap:12px;">
        <div style="width:36px;height:36px;border-radius:10px;background:#450a0a;
          display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg width="18" height="18" fill="none" stroke="#f87171" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
          </svg>
        </div>
        <div style="flex:1;">
          <div style="color:#f9fafb;font-size:14px;font-weight:600;margin-bottom:4px;">${title}</div>
          ${message ? `<div style="color:#9ca3af;font-size:12px;line-height:1.5;">${message}</div>` : ""}
        </div>
      </div>
      <div style="display:flex;gap:8px;padding:0 20px 20px;">
        <button id="kv-modal-cancel" style="flex:1;background:#1f2937;color:#d1d5db;border:1px solid #374151;
          border-radius:10px;padding:9px;cursor:pointer;font-size:13px;font-weight:500;">
          Cancel
        </button>
        <button id="kv-modal-confirm" style="flex:1;background:#dc2626;color:#fff;border:none;
          border-radius:10px;padding:9px;cursor:pointer;font-size:13px;font-weight:600;">
          ${confirmLabel}
        </button>
      </div>
    </div>`;

  document.body.appendChild(modal);

  // Focus confirm button for keyboard accessibility
  setTimeout(() => modal.querySelector("#kv-modal-confirm")?.focus(), 50);

  function close() { modal.remove(); }
  modal.querySelector("#kv-modal-cancel").onclick  = close;
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", esc); }
  });
  modal.querySelector("#kv-modal-confirm").onclick = () => {
    close();
    onConfirm?.();
  };
}

// ── Delete ────────────────────────────────────────────────────────────────────
function deleteCredential(id, cardEl, onSuccess) {
  showConfirmModal({
    title: "Delete credential?",
    message: "This will be permanently removed from your vault.",
    confirmLabel: "Delete",
    onConfirm: async () => {
      const res = await sendMsg({ type: "DELETE_CREDENTIAL", id });
      if (res?.ok) {
        allCredentials = allCredentials.filter((c) => c._id !== id);
        credCount.textContent = allCredentials.length;
        credCount.setAttribute("aria-label", `${allCredentials.length} credentials stored`);
        if (cardEl) cardEl.remove();
        renderList();
        if (onSuccess) onSuccess();
        showToast(t("deleted"));
      } else {
        showToast(t("deleteFailed"));
      }
    },
  });
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
  showToast(`✅ ${t("autofillSuccess", cred.username)}`);
  // Track autofill usage for analytics
  if (cred._id) sendMsg({ type: "MARK_USED", id: cred._id });
  window.close();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function copyToClipboard(text, msg) {
  navigator.clipboard.writeText(text).then(() => showToast(msg));
}

function showToast(msg) {
  let toast = document.getElementById("kv-popup-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "kv-popup-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.setAttribute("aria-atomic", "true");
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = "1";
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = "0"; }, 2000);
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

// ── Keyboard navigation for credential list (↑ ↓ Enter) ──────────────────────
// Allows users to navigate cards without a mouse.
// ↑ / ↓  — move focus between cards
// Enter   — open detail panel for focused card
// /       — jump focus to search input from anywhere in the list

document.addEventListener("keydown", (e) => {
  // Skip if detail panel is open, or focus is inside an input/button already
  if (!detailPanel.classList.contains("hidden")) return;
  if (mainScreen.classList.contains("hidden")) return;

  const cards = [...credList.querySelectorAll(".cred-card")];
  if (!cards.length) return;

  const focused = document.activeElement;
  const currentIdx = cards.indexOf(focused);

  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (currentIdx === -1) {
      // Nothing focused yet — focus first card
      cards[0].focus();
    } else if (currentIdx < cards.length - 1) {
      cards[currentIdx + 1].focus();
    }
    return;
  }

  if (e.key === "ArrowUp") {
    e.preventDefault();
    if (currentIdx > 0) {
      cards[currentIdx - 1].focus();
    } else if (currentIdx === 0) {
      // At top — move focus back to search input
      searchInput.focus();
    }
    return;
  }

  // "/" — jump to search from anywhere in the list
  if (e.key === "/" && cards.includes(focused)) {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
    return;
  }
});

// After renderList, restore focus to the previously focused card index
// so navigation position is preserved after search/filter updates
const _origRenderList = renderList;
(function patchRenderList() {
  const origRender = window.renderList || renderList;
  // Store last focused card index before re-render
  credList.addEventListener("focusin", () => {
    const cards = [...credList.querySelectorAll(".cred-card")];
    const idx = cards.indexOf(document.activeElement);
    if (idx !== -1) credList._lastFocusedIdx = idx;
  });
})();

// ── Popup idle auto-lock ──────────────────────────────────────────────────────
// Locks the popup after 2 minutes of inactivity while the main screen is visible.
// Shows a visible countdown in the header during the last 30 seconds.
// Resets on any mouse move, click, or keypress inside the popup.

const POPUP_IDLE_MS      = 2 * 60 * 1000; // 2 minutes total
const POPUP_WARN_MS      = 30 * 1000;      // show countdown in last 30 seconds
let   _idleTimer         = null;
let   _warnTimer         = null;
let   _warnInterval      = null;
let   _idleActive        = false;

function startIdleLock() {
  _idleActive = true;
  resetIdleTimer();

  // Listen for any activity inside the popup
  ["mousemove", "mousedown", "keydown", "scroll", "touchstart"].forEach((ev) => {
    document.addEventListener(ev, resetIdleTimer, { passive: true });
  });
}

function stopIdleLock() {
  _idleActive = false;
  clearTimeout(_idleTimer);
  clearTimeout(_warnTimer);
  clearInterval(_warnInterval);
  hideIdleWarning();
  ["mousemove", "mousedown", "keydown", "scroll", "touchstart"].forEach((ev) => {
    document.removeEventListener(ev, resetIdleTimer);
  });
}

function resetIdleTimer() {
  if (!_idleActive) return;
  clearTimeout(_idleTimer);
  clearTimeout(_warnTimer);
  clearInterval(_warnInterval);
  hideIdleWarning();

  // After (POPUP_IDLE_MS - POPUP_WARN_MS) of idle, start the warning countdown
  _warnTimer = setTimeout(() => {
    showIdleWarning(Math.floor(POPUP_WARN_MS / 1000));
  }, POPUP_IDLE_MS - POPUP_WARN_MS);

  // After full POPUP_IDLE_MS, lock
  _idleTimer = setTimeout(() => {
    stopIdleLock();
    showLockScreen();
    showToast("Vault locked due to inactivity");
  }, POPUP_IDLE_MS);
}

function showIdleWarning(secondsLeft) {
  let el = document.getElementById("kv-idle-warn");
  if (!el) {
    el = document.createElement("div");
    el.id = "kv-idle-warn";
    el.style.cssText = [
      "position:fixed;bottom:12px;left:50%;transform:translateX(-50%);",
      "background:#1e1b4b;border:1px solid #f59e0b;border-radius:10px;",
      "padding:6px 14px;font-size:11px;color:#fbbf24;",
      "display:flex;align-items:center;gap:6px;z-index:9999;",
      "white-space:nowrap;pointer-events:none;",
    ].join("");
    el.innerHTML = '<span style="font-size:14px">⏱</span><span id="kv-idle-countdown"></span>';
    document.body.appendChild(el);
  }

  let secs = secondsLeft;
  const countEl = document.getElementById("kv-idle-countdown");
  if (countEl) countEl.textContent = `Locking in ${secs}s due to inactivity`;

  _warnInterval = setInterval(() => {
    secs--;
    if (countEl) countEl.textContent = `Locking in ${secs}s due to inactivity`;
    if (secs <= 0) clearInterval(_warnInterval);
  }, 1000);
}

function hideIdleWarning() {
  const el = document.getElementById("kv-idle-warn");
  if (el) el.remove();
}

// Idle lock is wired directly into showMainScreen and showLockScreen above.