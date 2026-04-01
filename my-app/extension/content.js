(function () {
  "use strict";

  if (window.__keyVaultInjected) return;
  window.__keyVaultInjected = true;

  const DOMAIN = window.location.hostname;

  // In-memory snapshot — updated as user types in password field
  let snapshot = { username: "", password: "", domain: DOMAIN };

  // On page load: ask background if there is a pending save for this domain
  // (set by a previous page before navigation happened)
  safeSendMessage({ type: "GET_PENDING_SAVE", domain: DOMAIN }, (res) => {
    if (res && res.ok && res.data) {
      setTimeout(() => showSaveBanner(res.data.username, res.data.password), 800);
    }
  });

  // ── Utilities ─────────────────────────────────────────────────────────────

  // Generate a strong random password: 16 chars, mixed case + numbers + symbols
  function generateStrongPassword() {
    const upper   = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const lower   = "abcdefghjkmnpqrstuvwxyz";
    const digits  = "23456789";
    const symbols = "@#$%&*!?";
    const all     = upper + lower + digits + symbols;
    let pwd = [
      upper  [Math.floor(Math.random() * upper.length)],
      lower  [Math.floor(Math.random() * lower.length)],
      digits [Math.floor(Math.random() * digits.length)],
      symbols[Math.floor(Math.random() * symbols.length)],
    ];
    for (let i = 4; i < 16; i++) {
      pwd.push(all[Math.floor(Math.random() * all.length)]);
    }
    // Shuffle
    for (let i = pwd.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
    }
    return pwd.join("");
  }

  // Detect if a password field is for signup (new password) vs login
  function isSignupPasswordField(pwField) {
    const ac = (pwField.getAttribute("autocomplete") || "").toLowerCase();
    if (ac === "new-password") return true;
    if (ac === "current-password") return false;

    const form = pwField.form || pwField.closest("form");
    if (form) {
      // If there are 2+ password fields in the form, it's a signup form
      const pwCount = form.querySelectorAll('input[type="password"]').length;
      if (pwCount >= 2) return true;

      const text = (form.textContent || "").toLowerCase();
      if (/sign.?up|register|create.?account|join|new.?account/.test(text)) return true;
    }

    const name = (pwField.name || pwField.id || "").toLowerCase();
    if (/new|create|register|signup/.test(name)) return true;

    // Check page URL / title
    const pageText = (document.title + " " + window.location.href).toLowerCase();
    if (/sign.?up|register|create.?account|join/.test(pageText)) return true;

    return false;
  }

  function isVisible(el) {
    if (!el) return false;
    const s = window.getComputedStyle(el);
    return s.display !== "none" && s.visibility !== "hidden" && el.offsetParent !== null;
  }

  function findLoginPair() {
    const pwFields = Array.from(
      document.querySelectorAll('input[type="password"]')
    ).filter(isVisible);
    for (const pw of pwFields) {
      const user = findUsernameField(pw);
      if (user) return { userField: user, pwField: pw };
    }
    return null;
  }

  function findUsernameField(pwField) {
    const containers = [
      pwField.form,
      pwField.closest("div,section,main"),
      document.body,
    ].filter(Boolean);

    const selectors = [
      'input[type="email"]',
      'input[autocomplete="username"]',
      'input[autocomplete="email"]',
      'input[name*="user" i]',
      'input[name*="email" i]',
      'input[name*="login" i]',
      'input[name*="phone" i]',
      'input[id*="user" i]',
      'input[id*="email" i]',
      'input[id*="login" i]',
      'input[type="text"]',
      'input[type="tel"]',
    ];

    for (const container of containers) {
      for (const sel of selectors) {
        const all = Array.from(container.querySelectorAll(sel)).filter(
          (el) => el !== pwField
        );
        const visible = all.find(isVisible);
        if (visible) return visible;
        // Multi-step: username hidden but already filled
        const withValue = all.find((el) => el.value && el.value.trim());
        if (withValue) return withValue;
      }
    }
    return null;
  }

  function setNativeValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype, "value"
    )?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function escHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function safeSendMessage(msg, cb) {
    try {
      chrome.runtime.sendMessage(msg, (res) => {
        if (chrome.runtime.lastError) {
          // Silently ignore — extension reloaded or context invalidated
          return;
        }
        if (cb) cb(res);
      });
    } catch (e) {
      // Extension context invalidated after page navigation — ignore
    }
  }

  // ── Keyboard shortcut: Ctrl+Shift+L ──────────────────────────────────────
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type !== "SHORTCUT_AUTOFILL") return;

    const pair = findLoginPair();
    if (!pair) {
      showToast("No login form detected on this page.");
      return;
    }

    safeSendMessage({ type: "FETCH_CREDENTIALS_FOR_DOMAIN", domain: DOMAIN }, (res) => {
      if (!res?.ok || !res.data?.length) {
        showToast("No saved credentials for this site.");
        return;
      }
      if (res.data.length === 1) {
        // Single credential — fill directly, no banner needed
        const c = res.data[0];
        setNativeValue(pair.userField, c.username);
        setNativeValue(pair.pwField,   c.password);
        showToast("✅ Credentials filled!");
      } else {
        // Multiple credentials — show picker
        autofillDone = false;
        showAutofillBanner(res.data, pair.userField, pair.pwField);
      }
    });
  });

  // ── Snapshot credentials as user types ───────────────────────────────────

  function watchPasswordField(pwField) {
    if (pwField.__kvWatching) return;
    pwField.__kvWatching = true;

    // Show password suggestion when user focuses an empty signup password field
    pwField.addEventListener("focus", () => {
      if (pwField.value.length === 0 && isSignupPasswordField(pwField)) {
        showPasswordSuggestion(pwField);
      }
    });

    // Show strength meter as user types
    pwField.addEventListener("input", () => {
      updateStrengthMeter(pwField);
    });

    // Hide meter when field loses focus and is empty
    pwField.addEventListener("blur", () => {
      if (!pwField.value) removeStrengthMeter(pwField);
    });

    const capture = () => {
      const pair = findLoginPair();
      if (!pair) return;
      const u = pair.userField?.value?.trim() || "";
      const p = pair.pwField?.value || "";
      if (u && p.length >= 1) {
        snapshot = { username: u, password: p, domain: DOMAIN };
      }
    };

    pwField.addEventListener("input", capture);
    pwField.addEventListener("blur",  capture);
    pwField.addEventListener("change", capture);
  }

  // ── Password strength meter ───────────────────────────────────────────────

  function getPasswordStrength(pwd) {
    if (!pwd) return null;
    let score = 0;
    const checks = {
      length8:   pwd.length >= 8,
      length12:  pwd.length >= 12,
      length16:  pwd.length >= 16,
      uppercase: /[A-Z]/.test(pwd),
      lowercase: /[a-z]/.test(pwd),
      digits:    /[0-9]/.test(pwd),
      symbols:   /[^A-Za-z0-9]/.test(pwd),
      noRepeat:  !/(.)(\1{2,})/.test(pwd), // no 3+ repeated chars
    };
    if (checks.length8)   score++;
    if (checks.length12)  score++;
    if (checks.length16)  score++;
    if (checks.uppercase) score++;
    if (checks.lowercase) score++;
    if (checks.digits)    score++;
    if (checks.symbols)   score++;
    if (checks.noRepeat)  score++;

    let level, color, bar, tips = [];
    if (score <= 2) {
      level = "Weak";      color = "#ef4444"; bar = "25%";
    } else if (score <= 4) {
      level = "Fair";      color = "#f97316"; bar = "50%";
    } else if (score <= 6) {
      level = "Good";      color = "#eab308"; bar = "75%";
    } else {
      level = "Strong";    color = "#22c55e"; bar = "100%";
    }

    if (!checks.length8)   tips.push("at least 8 characters");
    if (!checks.uppercase) tips.push("an uppercase letter");
    if (!checks.digits)    tips.push("a number");
    if (!checks.symbols)   tips.push("a special character (!@#$)");

    return { level, color, bar, score, tips, checks };
  }

  function updateStrengthMeter(pwField) {
    const pwd = pwField.value;

    // Don't show if user already dismissed it
    if (pwField.__kvMeterDismissed) return;

    // Remove meter if field is empty
    if (!pwd) { removeStrengthMeter(pwField); return; }

    const strength = getPasswordStrength(pwd);
    const meterId  = "kv-meter-" + getFieldId(pwField);

    // Auto-remove smoothly when password becomes Strong
    if (strength.level === "Strong") {
      const existing = document.getElementById(meterId);
      if (existing) {
        // Show "strong enough" message first, then fade out
        existing.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:18px;">✅</span>
            <div>
              <div style="font-weight:700;color:#22c55e;font-size:13px;">Password is strong enough!</div>
              <div style="color:#6b7280;font-size:11px;margin-top:2px;">All requirements met.</div>
            </div>
          </div>`;
        existing.style.border = "1px solid #22c55e";
        setTimeout(() => {
          existing.style.transition = "opacity .6s ease, transform .6s ease";
          existing.style.opacity = "0";
          existing.style.transform = "translateY(-6px)";
          setTimeout(() => existing.remove(), 600);
        }, 1500);
      } else {
        // Meter wasn't open yet — briefly show the strong message then fade
        const meter = document.createElement("div");
        meter.id = meterId;
        meter.style.cssText =
          "position:absolute;z-index:2147483646;background:#1e1b4b;" +
          "border:1px solid #22c55e;border-radius:8px;padding:10px 14px;" +
          "font-family:system-ui,sans-serif;font-size:12px;color:#e0e7ff;" +
          "box-shadow:0 4px 16px rgba(0,0,0,.5);min-width:200px;" +
          "transition:opacity .6s ease, transform .6s ease;";
        meter.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:18px;">✅</span>
            <div>
              <div style="font-weight:700;color:#22c55e;font-size:13px;">Password is strong enough!</div>
              <div style="color:#6b7280;font-size:11px;margin-top:2px;">All requirements met.</div>
            </div>
          </div>`;
        const rect = pwField.getBoundingClientRect();
        meter.style.top  = (rect.bottom + window.scrollY + 4) + "px";
        meter.style.left = (rect.left   + window.scrollX)     + "px";
        document.body.appendChild(meter);
        setTimeout(() => {
          meter.style.opacity = "0";
          meter.style.transform = "translateY(-6px)";
          setTimeout(() => meter.remove(), 600);
        }, 1500);
      }
      return;
    }

    let meter = document.getElementById(meterId);

    if (!meter) {
      meter = document.createElement("div");
      meter.id = meterId;
      meter.style.cssText =
        "position:absolute;z-index:2147483646;background:#1e1b4b;" +
        "border:1px solid #312e81;border-radius:8px;padding:8px 10px;" +
        "font-family:system-ui,sans-serif;font-size:12px;color:#e0e7ff;" +
        "box-shadow:0 4px 16px rgba(0,0,0,.5);min-width:200px;max-width:260px;" +
        "transition:opacity .3s ease;";
      document.body.appendChild(meter);
    }

    // Position below the password field
    const rect = pwField.getBoundingClientRect();
    meter.style.top  = (rect.bottom + window.scrollY + 4) + "px";
    meter.style.left = (rect.left   + window.scrollX)     + "px";

    // Build meter content
    meter.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
        <span style="font-size:11px;opacity:.7;">Password strength</span>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-weight:700;color:${strength.color};">${strength.level}</span>
          <button id="kv-meter-close-${getFieldId(pwField)}" style="background:none;border:none;
            color:#6b7280;cursor:pointer;font-size:14px;line-height:1;padding:0;
            pointer-events:all;">&#215;</button>
        </div>
      </div>
      <div style="background:#312e81;border-radius:4px;height:5px;overflow:hidden;margin-bottom:6px;">
        <div style="height:100%;width:${strength.bar};background:${strength.color};
          border-radius:4px;transition:width .3s,background .3s;"></div>
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;">
        ${[
          { label: "8+ chars",   ok: strength.checks.length8   },
          { label: "Uppercase",  ok: strength.checks.uppercase  },
          { label: "Number",     ok: strength.checks.digits     },
          { label: "Symbol",     ok: strength.checks.symbols    },
          { label: "12+ chars",  ok: strength.checks.length12   },
        ].map(c => `
          <span style="font-size:10px;padding:2px 6px;border-radius:4px;
            background:${c.ok ? "#14532d" : "#312e81"};
            color:${c.ok ? "#86efac" : "#6b7280"};">
            ${c.ok ? "✓" : "✗"} ${c.label}
          </span>`).join("")}
      </div>`;

    // Close button — smooth fade out
    meter.style.pointerEvents = "all";
    const closeBtn = document.getElementById("kv-meter-close-" + getFieldId(pwField));
    if (closeBtn) {
      closeBtn.onclick = () => {
        meter.style.transition = "opacity .3s ease, transform .3s ease";
        meter.style.opacity = "0";
        meter.style.transform = "translateY(-6px)";
        setTimeout(() => meter.remove(), 300);
        // Mark field so meter doesn't reappear for this session
        pwField.__kvMeterDismissed = true;
      };
    }
  }

  function removeStrengthMeter(pwField) {
    const meter = document.getElementById("kv-meter-" + getFieldId(pwField));
    if (meter) meter.remove();
  }

  function getFieldId(pwField) {
    // Stable ID for a field based on its position in the DOM
    if (!pwField.__kvId) {
      pwField.__kvId = Math.random().toString(36).slice(2);
    }
    return pwField.__kvId;
  }

  // ── Handle submit / login button ─────────────────────────────────────────

  function handlePotentialSubmit() {
    // Re-capture at submit time in case values changed
    const pair = findLoginPair();
    if (pair) {
      const u = pair.userField?.value?.trim() || snapshot.username;
      const p = pair.pwField?.value || snapshot.password;
      if (u && p) snapshot = { username: u, password: p, domain: DOMAIN };
    }

    if (!snapshot.username || !snapshot.password) return;

    // Tell background to store pending save — survives page navigation
    safeSendMessage({
      type: "SET_PENDING_SAVE",
      data: snapshot,
    });

    // Also try showing immediately (works if page stays, e.g. wrong password)
    setTimeout(() => {
      if (document.getElementById("kv-save-banner")) return;
      showSaveBanner(snapshot.username, snapshot.password);
    }, 500);
  }

  // Native form submit
  document.addEventListener("submit", () => handlePotentialSubmit(), true);

  // Button / link clicks (React/Vue apps don't always fire form submit)
  document.addEventListener("click", (e) => {
    const el = e.target.closest(
      "button, input[type=submit], input[type=button], [role=button]"
    );
    if (!el) return;
    const text = (
      el.textContent || el.value || el.getAttribute("aria-label") || ""
    ).toLowerCase();
    const testId = (el.getAttribute("data-testid") || "").toLowerCase();
    const isLogin =
      /sign.?in|log.?in|^login$|^log in$|continue|next|submit|verify|proceed/.test(text) ||
      /login|signin|submit|next|continue/.test(testId);
    if (isLogin) handlePotentialSubmit();
  }, true);

  // Enter key in password field
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target?.type === "password") {
      handlePotentialSubmit();
    }
  }, true);

  // ── Autofill on page load ─────────────────────────────────────────────────
  // Once dismissed or filled, never show again for this page load
  let autofillDone = false;

  function tryAutofill() {
    if (autofillDone) return;
    if (
      document.getElementById("kv-save-banner") ||
      document.getElementById("kv-fill-banner")
    ) return;

    const pair = findLoginPair();
    if (!pair) return;

    safeSendMessage(
      { type: "FETCH_CREDENTIALS_FOR_DOMAIN", domain: DOMAIN },
      (res) => {
        if (!res?.ok || !res.data?.length) return;
        if (autofillDone) return;
        const pair2 = findLoginPair();
        if (!pair2) return;
        showAutofillBanner(res.data, pair2.userField, pair2.pwField);
      }
    );
  }

  tryAutofill();
  [1000, 2500, 5000].forEach((d) => setTimeout(tryAutofill, d));

  // Watch for dynamically rendered login forms (SPAs, modals)
  let mutDebounce = null;
  new MutationObserver(() => {
    clearTimeout(mutDebounce);
    mutDebounce = setTimeout(() => {
      document.querySelectorAll('input[type="password"]').forEach(watchPasswordField);
      tryAutofill();
    }, 400);
  }).observe(document.body, { childList: true, subtree: true });

  // Watch existing password fields
  document.querySelectorAll('input[type="password"]').forEach(watchPasswordField);

  // ── Password suggestion banner ────────────────────────────────────────────

  function showPasswordSuggestion(pwField) {
    // Only show once per page load
    if (document.getElementById("kv-suggest-banner")) return;

    const suggested = generateStrongPassword();

    const banner = document.createElement("div");
    banner.id = "kv-suggest-banner";
    banner.innerHTML = `
      <div style="position:fixed;top:16px;right:16px;z-index:2147483647;
        background:#1e1b4b;color:#fff;border-radius:12px;padding:14px 18px;
        font-family:system-ui,sans-serif;font-size:14px;
        box-shadow:0 8px 32px rgba(0,0,0,.45);min-width:290px;max-width:350px;
        border:1px solid #4f46e5;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="font-size:18px;">🔐</span>
          <strong style="font-size:14px;">Strong password suggestion</strong>
          <button id="kv-sug-close" style="margin-left:auto;background:none;border:none;
            color:#a5b4fc;cursor:pointer;font-size:18px;line-height:1;">&#215;</button>
        </div>
        <div style="background:#0f0e1a;border:1px solid #312e81;border-radius:8px;
          padding:8px 12px;margin-bottom:10px;display:flex;align-items:center;gap:8px;">
          <span id="kv-sug-pwd" style="flex:1;font-family:monospace;font-size:13px;
            color:#a5b4fc;letter-spacing:.05em;word-break:break-all;">${suggested}</span>
          <button id="kv-sug-copy" title="Copy" style="background:none;border:none;
            color:#6366f1;cursor:pointer;font-size:14px;flex-shrink:0;">📋</button>
        </div>
        <div style="display:flex;gap:8px;">
          <button id="kv-sug-use" style="flex:1;background:#4f46e5;color:#fff;border:none;
            border-radius:8px;padding:8px;cursor:pointer;font-size:13px;font-weight:600;">
            Use this password
          </button>
          <button id="kv-sug-cancel" style="flex:1;background:#312e81;color:#c7d2fe;border:none;
            border-radius:8px;padding:8px;cursor:pointer;font-size:13px;">
            No thanks
          </button>
        </div>
      </div>`;

    document.body.appendChild(banner);

    const dismiss = () => banner.remove();

    banner.querySelector("#kv-sug-close").onclick  = dismiss;
    banner.querySelector("#kv-sug-cancel").onclick = dismiss;

    banner.querySelector("#kv-sug-copy").onclick = () => {
      navigator.clipboard.writeText(suggested);
      banner.querySelector("#kv-sug-copy").textContent = "✅";
      setTimeout(() => { banner.querySelector("#kv-sug-copy") && (banner.querySelector("#kv-sug-copy").textContent = "📋"); }, 1500);
    };

    banner.querySelector("#kv-sug-use").onclick = () => {
      // Fill the password into all password fields on the form (including confirm field)
      const form = pwField.form || pwField.closest("form") || document.body;
      const allPwFields = Array.from(form.querySelectorAll('input[type="password"]')).filter(isVisible);
      allPwFields.forEach((f) => setNativeValue(f, suggested));

      // Update snapshot so it gets saved
      const pair = findLoginPair();
      const username = pair?.userField?.value?.trim() || "";
      snapshot = { username, password: suggested, domain: DOMAIN };

      banner.remove();
      showToast("Strong password filled! It will be saved when you sign up.");
    };

    // Auto-dismiss after 20 seconds
    setTimeout(() => banner?.remove(), 20000);
  }

  // ── Duplicate password warning ────────────────────────────────────────────

  function showDuplicateWarning(duplicate, payload) {
    document.getElementById("kv-dup-banner")?.remove();

    const banner = document.createElement("div");
    banner.id = "kv-dup-banner";
    banner.innerHTML = `
      <div style="position:fixed;top:16px;right:16px;z-index:2147483647;
        background:#1e1b4b;color:#fff;border-radius:12px;padding:14px 18px;
        font-family:system-ui,sans-serif;font-size:14px;
        box-shadow:0 8px 32px rgba(0,0,0,.45);min-width:290px;max-width:350px;
        border:1px solid #f59e0b;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <span style="font-size:20px;">⚠️</span>
          <strong style="font-size:14px;color:#fbbf24;">Password reuse detected!</strong>
          <button id="kv-dup-close" style="margin-left:auto;background:none;border:none;
            color:#a5b4fc;cursor:pointer;font-size:18px;line-height:1;">&#215;</button>
        </div>
        <div style="background:#451a03;border:1px solid #92400e;border-radius:8px;
          padding:8px 10px;margin-bottom:10px;font-size:12px;color:#fcd34d;">
          You're using the same password on<br>
          <strong>${escHtml(duplicate.website)}</strong>
          (${escHtml(duplicate.username)}).<br>
          <span style="opacity:.8;">Reusing passwords is a security risk.</span>
        </div>
        <div style="font-size:12px;color:#6b7280;margin-bottom:10px;">
          Save anyway or go back and use a unique password.
        </div>
        <div style="display:flex;gap:8px;">
          <button id="kv-dup-save" style="flex:1;background:#d97706;color:#fff;border:none;
            border-radius:8px;padding:8px;cursor:pointer;font-size:12px;font-weight:600;">
            Save anyway
          </button>
          <button id="kv-dup-cancel" style="flex:1;background:#312e81;color:#c7d2fe;border:none;
            border-radius:8px;padding:8px;cursor:pointer;font-size:12px;">
            Cancel
          </button>
        </div>
      </div>`;

    document.body.appendChild(banner);

    banner.querySelector("#kv-dup-close").onclick  = () => banner.remove();
    banner.querySelector("#kv-dup-cancel").onclick = () => banner.remove();
    banner.querySelector("#kv-dup-save").onclick   = () => {
      banner.remove();
      safeSendMessage({ type: "SAVE_CREDENTIAL_CONFIRMED", payload }, (res) => {
        if (res?.ok) showToast("Password saved!");
        else showToast("Save failed — is the backend running?");
      });
    };

    setTimeout(() => banner?.remove(), 30000);
  }

  // ── Save banner ───────────────────────────────────────────────────────────

  function showSaveBanner(username, password) {
    document.getElementById("kv-save-banner")?.remove();

    const banner = document.createElement("div");
    banner.id = "kv-save-banner";
    banner.innerHTML = `
      <div style="position:fixed;top:16px;right:16px;z-index:2147483647;
        background:#1e1b4b;color:#fff;border-radius:12px;padding:14px 18px;
        font-family:system-ui,sans-serif;font-size:14px;
        box-shadow:0 8px 32px rgba(0,0,0,.45);min-width:280px;max-width:340px;
        border:1px solid #4f46e5;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="font-size:20px;">&#128273;</span>
          <strong style="font-size:15px;">Save password?</strong>
          <button id="kv-close" style="margin-left:auto;background:none;border:none;
            color:#a5b4fc;cursor:pointer;font-size:18px;line-height:1;">&#215;</button>
        </div>
        <div style="color:#c7d2fe;font-size:13px;margin-bottom:12px;">
          <span style="opacity:.7;">Site:</span> ${escHtml(DOMAIN)}<br>
          <span style="opacity:.7;">User:</span> ${escHtml(username)}
        </div>
        <div style="display:flex;gap:8px;">
          <button id="kv-save" style="flex:1;background:#4f46e5;color:#fff;border:none;
            border-radius:8px;padding:8px;cursor:pointer;font-size:13px;font-weight:600;">
            Save
          </button>
          <button id="kv-cancel" style="flex:1;background:#312e81;color:#c7d2fe;border:none;
            border-radius:8px;padding:8px;cursor:pointer;font-size:13px;">
            Not now
          </button>
        </div>
      </div>`;

    document.body.appendChild(banner);
    banner.querySelector("#kv-close").onclick = () => banner.remove();
    banner.querySelector("#kv-cancel").onclick = () => banner.remove();
    banner.querySelector("#kv-save").onclick = () => {
      banner.remove();
      safeSendMessage(
        {
          type: "SAVE_CREDENTIAL",
          payload: { website: DOMAIN, username, password, category: "Others" },
        },
        (res) => {
          if (res?.duplicate) {
            showDuplicateWarning(res.duplicate, res.payload);
          } else if (res?.ok) {
            showToast("Password saved!");
          } else {
            showToast("Save failed — is the backend running?");
          }
        }
      );
    };
    setTimeout(() => banner?.remove(), 25000);
  }

  // ── Autofill banner ───────────────────────────────────────────────────────

  function showAutofillBanner(credentials, userField, pwField) {
    document.getElementById("kv-fill-banner")?.remove();

    const isSingle = credentials.length === 1;
    const title = isSingle ? "Autofill password?" : `${credentials.length} accounts found`;
    const subtitle = isSingle ? "" :
      `<div style="color:#818cf8;font-size:11px;margin-bottom:10px;">Choose which account to fill</div>`;

    const banner = document.createElement("div");
    banner.id = "kv-fill-banner";
    banner.innerHTML = `
      <div style="position:fixed;top:16px;right:16px;z-index:2147483647;
        background:#1e1b4b;color:#fff;border-radius:12px;padding:14px 18px;
        font-family:system-ui,sans-serif;font-size:14px;
        box-shadow:0 8px 32px rgba(0,0,0,.45);min-width:290px;max-width:360px;
        border:1px solid #4f46e5;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <span style="font-size:18px;">&#128273;</span>
          <strong style="font-size:15px;">${title}</strong>
          <button id="kv-fill-close" style="margin-left:auto;background:none;border:none;
            color:#a5b4fc;cursor:pointer;font-size:18px;line-height:1;">&#215;</button>
        </div>
        ${subtitle}
        <div id="kv-cred-list" style="display:flex;flex-direction:column;gap:6px;
          margin-bottom:10px;max-height:220px;overflow-y:auto;"></div>
        <button id="kv-fill-cancel" style="width:100%;background:#312e81;color:#6b7280;
          border:none;border-radius:8px;padding:7px;cursor:pointer;font-size:12px;">
          Cancel
        </button>
      </div>`;

    document.body.appendChild(banner);

    const list = banner.querySelector("#kv-cred-list");

    credentials.forEach((c) => {
      const row = document.createElement("button");
      row.style.cssText =
        "background:#0f0e1a;border:1px solid #312e81;border-radius:10px;" +
        "padding:10px 12px;cursor:pointer;width:100%;text-align:left;" +
        "display:flex;align-items:center;gap:10px;transition:border-color .15s;";

      // Favicon
      const faviconUrl = `https://www.google.com/s2/favicons?domain=${c.website}&sz=32`;
      const avatarLetter = escHtml((c.username || c.website || "?").charAt(0).toUpperCase());

      row.innerHTML = `
        <div style="position:relative;flex-shrink:0;">
          <img src="${faviconUrl}" width="28" height="28"
            style="border-radius:6px;object-fit:contain;display:block;"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" />
          <div style="display:none;width:28px;height:28px;border-radius:6px;
            background:#312e81;color:#a5b4fc;font-size:13px;font-weight:700;
            align-items:center;justify-content:center;">${avatarLetter}</div>
        </div>
        <div style="flex:1;overflow:hidden;">
          <div style="color:#e0e7ff;font-size:13px;font-weight:600;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${escHtml(c.username)}
          </div>
          <div style="color:#6b7280;font-size:11px;margin-top:1px;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${escHtml(c.website)}
          </div>
        </div>
        <div style="background:#4f46e5;color:#fff;border-radius:6px;
          padding:4px 10px;font-size:11px;font-weight:600;flex-shrink:0;">
          Fill
        </div>`;

      row.onmouseenter = () => { row.style.borderColor = "#4f46e5"; };
      row.onmouseleave = () => { row.style.borderColor = "#312e81"; };

      row.onclick = () => {
        setNativeValue(userField, c.username);
        setNativeValue(pwField,   c.password);
        autofillDone = true;
        banner.remove();
        showToast(`✅ Filled: ${c.username}`);
      };

      list.appendChild(row);
    });

    const dismiss = () => { autofillDone = true; banner.remove(); };
    banner.querySelector("#kv-fill-close").onclick  = dismiss;
    banner.querySelector("#kv-fill-cancel").onclick = dismiss;
    setTimeout(() => { autofillDone = true; banner?.remove(); }, 20000);
  }

  // ── Toast ─────────────────────────────────────────────────────────────────

  function showToast(msg) {
    document.getElementById("kv-toast")?.remove();
    const t = document.createElement("div");
    t.id = "kv-toast";
    t.textContent = msg;
    t.style.cssText =
      "position:fixed;bottom:24px;right:16px;z-index:2147483647;" +
      "background:#1e1b4b;color:#e0e7ff;border-radius:10px;padding:10px 16px;" +
      "font-family:system-ui,sans-serif;font-size:13px;" +
      "box-shadow:0 4px 16px rgba(0,0,0,.4);border:1px solid #4f46e5;";
    document.body.appendChild(t);
    setTimeout(() => t?.remove(), 3500);
  }

})();
