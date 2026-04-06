import { useState, useRef } from "react";
import { createMasterPassword } from "../api/auth";

// ── Password strength ─────────────────────────────────────────────────────────

function getStrength(pwd) {
  let score = 0;
  if (pwd.length >= 8)          score++;
  if (pwd.length >= 12)         score++;
  if (/[A-Z]/.test(pwd))        score++;
  if (/[0-9]/.test(pwd))        score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { label: "Weak",       color: "bg-red-500",    width: "20%",  textColor: "text-red-500"    };
  if (score <= 2) return { label: "Fair",       color: "bg-orange-400", width: "40%",  textColor: "text-orange-400" };
  if (score <= 3) return { label: "Good",       color: "bg-yellow-400", width: "60%",  textColor: "text-yellow-500" };
  if (score <= 4) return { label: "Strong",     color: "bg-blue-400",   width: "80%",  textColor: "text-blue-400"   };
  return           { label: "Very Strong", color: "bg-green-500",  width: "100%", textColor: "text-green-500"  };
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepDots({ current, total }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`rounded-full transition-all duration-300
          ${i === current
            ? "w-6 h-2 bg-indigo-600"
            : i < current
              ? "w-2 h-2 bg-indigo-400"
              : "w-2 h-2 bg-gray-200 dark:bg-gray-700"
          }`}
        />
      ))}
    </div>
  );
}

// ── Step 1 — Create master password ──────────────────────────────────────────

function StepPassword({ onNext, onCancel }) {
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [showPwd, setShowPwd]     = useState(false);
  const [showCfm, setShowCfm]     = useState(false);
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);
  const strength = getStrength(password);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirm)  return setError("Passwords do not match.");
    setLoading(true);
    try {
      await createMasterPassword(password);
      onNext();
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to create password. Is the server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-900/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create your master password</h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1.5">
          This single password encrypts everything in your vault. Make it strong — you'll only need to remember this one.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Password input */}
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Master Password</label>
          <div className="relative">
            <input
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a strong password"
              autoFocus
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 pr-11 transition-colors"
              required
            />
            <button type="button" onClick={() => setShowPwd(!showPwd)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-white">
              {showPwd ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>

          {/* Strength meter */}
          {password && (
            <div className="mt-2 space-y-1">
              <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                  style={{ width: strength.width }} />
              </div>
              <div className="flex items-center justify-between">
                <p className={`text-xs font-medium ${strength.textColor}`}>{strength.label}</p>
                <p className="text-xs text-gray-400">{password.length} characters</p>
              </div>
            </div>
          )}
        </div>

        {/* Confirm input */}
        <div>
          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Confirm Password</label>
          <div className="relative">
            <input
              type={showCfm ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm your password"
              className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 pr-11 transition-colors"
              required
            />
            <button type="button" onClick={() => setShowCfm(!showCfm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-white">
              {showCfm ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          {/* Match indicator */}
          {confirm && (
            <p className={`text-xs mt-1 ${password === confirm ? "text-green-500" : "text-red-400"}`}>
              {password === confirm ? "✓ Passwords match" : "✗ Passwords do not match"}
            </p>
          )}
        </div>

        {/* Tips */}
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/40 rounded-xl p-3">
          <p className="text-xs font-medium text-indigo-700 dark:text-indigo-400 mb-1.5">Tips for a strong password:</p>
          <ul className="space-y-1">
            {[
              { check: password.length >= 12, text: "At least 12 characters" },
              { check: /[A-Z]/.test(password), text: "One uppercase letter" },
              { check: /[0-9]/.test(password), text: "One number" },
              { check: /[^A-Za-z0-9]/.test(password), text: "One special character (!@#$...)" },
            ].map(({ check, text }) => (
              <li key={text} className={`text-xs flex items-center gap-1.5 transition-colors
                ${check ? "text-green-600 dark:text-green-400" : "text-indigo-400 dark:text-indigo-500"}`}>
                <span>{check ? "✓" : "·"}</span>{text}
              </li>
            ))}
          </ul>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <div className="flex gap-3">
          {onCancel && (
            <button type="button" onClick={onCancel}
              className="px-4 py-3 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 rounded-xl transition-colors text-sm flex-shrink-0">
              ← Back
            </button>
          )}
          <button type="submit" disabled={loading || !password || !confirm}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors">
            {loading ? "Creating..." : "Create Password & Continue →"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Step 2 — How autofill works ───────────────────────────────────────────────

function StepAutofill({ onNext, onBack }) {
  const features = [
    {
      icon: "🔍",
      title: "Automatic detection",
      desc: "The extension detects login forms on any website you visit — no setup needed.",
    },
    {
      icon: "💾",
      title: "Save with one click",
      desc: 'When you log in, a "Save password?" banner appears. Click Save and it\'s encrypted instantly.',
    },
    {
      icon: "⚡",
      title: "Autofill in a flash",
      desc: "Next time you visit that site, your credentials fill automatically. Or press Ctrl+Shift+L.",
    },
    {
      icon: "🔐",
      title: "AES-256 encrypted",
      desc: "Every password is encrypted before storage. Even if the database is accessed, your passwords are safe.",
    },
  ];

  return (
    <div>
      <div className="text-center mb-6">
        <div className="w-14 h-14 bg-green-100 dark:bg-green-900/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">How autofill works</h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1.5">
          SecureVault works silently in the background. Here's what to expect.
        </p>
      </div>

      <div className="space-y-3 mb-6">
        {features.map(({ icon, title, desc }, i) => (
          <div key={title}
            className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl">
            <div className="w-9 h-9 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-center flex-shrink-0 text-lg">
              {icon}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{title}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Keyboard shortcut callout */}
      <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/40 rounded-xl p-3 mb-6 flex items-center gap-3">
        <span className="text-xl">⌨️</span>
        <div>
          <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">Keyboard shortcut</p>
          <p className="text-xs text-indigo-600 dark:text-indigo-500 mt-0.5">
            Press <kbd className="bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-700 rounded px-1 py-0.5 font-mono text-xs">Ctrl+Shift+L</kbd> on any login page to instantly autofill.
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack}
          className="px-4 py-3 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 rounded-xl transition-colors text-sm">
          ← Back
        </button>
        <button onClick={onNext}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors">
          Got it, continue →
        </button>
      </div>
    </div>
  );
}

// ── Step 3 — You're ready ─────────────────────────────────────────────────────

function StepReady({ onFinish }) {
  const highlights = [
    { icon: "🔐", text: "Your vault is encrypted with AES-256" },
    { icon: "⚡", text: "Autofill works on any website" },
    { icon: "🛡️", text: "5-minute auto-lock keeps you safe" },
    { icon: "📊", text: "Analytics track your password health" },
  ];

  return (
    <div className="text-center">
      {/* Celebration icon */}
      <div className="relative w-20 h-20 mx-auto mb-6">
        <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-lg">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        {/* Confetti dots */}
        {["top-0 -right-1 bg-yellow-400", "top-2 -left-2 bg-pink-400", "-bottom-1 right-2 bg-green-400", "bottom-1 -left-1 bg-blue-400"].map((cls) => (
          <div key={cls} className={`absolute w-3 h-3 rounded-full ${cls} animate-bounce`}
            style={{ animationDelay: `${Math.random() * 0.5}s` }} />
        ))}
      </div>

      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">You're all set!</h2>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
        Your SecureVault is ready. Start visiting websites and your credentials will be saved automatically.
      </p>

      {/* What you get */}
      <div className="grid grid-cols-2 gap-2 mb-8 text-left">
        {highlights.map(({ icon, text }) => (
          <div key={text}
            className="flex items-center gap-2 p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            <span className="text-base flex-shrink-0">{icon}</span>
            <span className="text-xs text-gray-600 dark:text-gray-400 leading-tight">{text}</span>
          </div>
        ))}
      </div>

      <button onClick={onFinish}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3.5 rounded-xl transition-colors text-base">
        Open My Vault 🚀
      </button>

      <p className="text-xs text-gray-400 mt-3">
        Tip: Pin the extension to your toolbar for quick access
      </p>
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export default function OnboardingWizard({ onFinish, onCancel }) {
  const [step, setStep] = useState(0); // 0 | 1 | 2

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4 transition-colors">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 w-full max-w-md shadow-2xl">

        {/* Brand */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <span className="font-bold text-gray-900 dark:text-white">SecureVault</span>
          <span className="text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-medium">Setup</span>
        </div>

        {/* Step dots */}
        <StepDots current={step} total={3} />

        {/* Steps */}
        {step === 0 && <StepPassword onNext={() => setStep(1)} onCancel={onCancel} />}
        {step === 1 && <StepAutofill onNext={() => setStep(2)} onBack={() => setStep(0)} />}
        {step === 2 && <StepReady onFinish={onFinish} />}

      </div>
    </div>
  );
}

// ── Icon helpers ──────────────────────────────────────────────────────────────

function EyeIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}