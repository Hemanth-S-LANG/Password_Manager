import { useState, useEffect, useRef } from "react";
import {
  createMasterPassword, verifyMasterPassword,
  getSecurityQStatus, saveSecurityQuestions,
  resetMasterPassword,
} from "../api/auth";

// ── Constants ─────────────────────────────────────────────────────────────────
const LOCKOUT_DURATIONS = [1 * 60 * 1000, 5 * 60 * 1000, 30 * 60 * 1000];
const STORAGE_KEY = "kv_lockout";

const ALL_QUESTIONS = [
  { key: "school",         label: "What was the name of your first school?" },
  { key: "color",          label: "What is your favourite color?" },
  { key: "birthplace",     label: "What is your place of birth?" },
  { key: "vehicle",        label: "What is your vehicle number?" },
  { key: "mothers_maiden", label: "What is your mother's maiden name?" },
];
// We always use the first 3 questions
const QUESTIONS = ALL_QUESTIONS.slice(0, 3);

// ── Lockout helpers ───────────────────────────────────────────────────────────
function getLockoutState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}
function saveLockoutState(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ── Password strength ─────────────────────────────────────────────────────────
function getStrength(pwd) {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { label: "Weak",        color: "bg-red-500",    width: "w-1/5" };
  if (score <= 2) return { label: "Fair",        color: "bg-orange-400", width: "w-2/5" };
  if (score <= 3) return { label: "Good",        color: "bg-yellow-400", width: "w-3/5" };
  if (score <= 4) return { label: "Strong",      color: "bg-blue-400",   width: "w-4/5" };
  return           { label: "Very Strong",  color: "bg-green-500",  width: "w-full" };
}

// ── Views ─────────────────────────────────────────────────────────────────────
// "login" | "setup-questions" | "answer-questions" | "reset-password"

export default function LoginScreen({ isFirstTime, onUnlock, onStartOnboarding }) {
  const [view, setView]         = useState("login");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [showPwd, setShowPwd]   = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef(null);

  // Security question answers state (array of 3 strings)
  const [answers, setAnswers] = useState(["", "", ""]);
  const [newPwd, setNewPwd]   = useState("");

  const strength = getStrength(password);
  const isLocked = countdown > 0;

  useEffect(() => {
    const state = getLockoutState();
    const remaining = (state.lockoutUntil || 0) - Date.now();
    if (remaining > 0) startCountdown(Math.ceil(remaining / 1000));
  }, []);

  function startCountdown(seconds) {
    setCountdown(seconds);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current); setError("You may try again now."); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;
  const countdownStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  // ── Login submit ────────────────────────────────────────────────────────────
  async function handleLogin(e) {
    e.preventDefault();
    if (isLocked) return;
    setError("");

    if (isFirstTime) {
      if (password.length < 6) return setError("Password must be at least 6 characters");
      if (password !== confirm) return setError("Passwords do not match");
      setLoading(true);
      try {
        await createMasterPassword(password);
        onUnlock();
      } catch (err) {
        setError(err?.response?.data?.error || err?.message || "Failed to create master password");
      } finally { setLoading(false); }
      return;
    }

    const state = getLockoutState();
    if ((state.lockoutUntil || 0) > Date.now()) {
      startCountdown(Math.ceil((state.lockoutUntil - Date.now()) / 1000));
      return;
    }

    setLoading(true);
    try {
      await verifyMasterPassword(password);
      saveLockoutState({ failedAttempts: 0, lockoutUntil: 0, lockoutCount: 0 });
      clearInterval(timerRef.current);
      onUnlock();
    } catch {
      const newAttempts = (state.failedAttempts || 0) + 1;
      const attemptsLeft = 5 - (newAttempts % 5);
      if (newAttempts % 5 === 0) {
        const tierIndex = Math.min((state.lockoutCount || 0), LOCKOUT_DURATIONS.length - 1);
        const lockoutUntil = Date.now() + LOCKOUT_DURATIONS[tierIndex];
        saveLockoutState({ failedAttempts: newAttempts, lockoutUntil, lockoutCount: (state.lockoutCount || 0) + 1 });
        startCountdown(Math.ceil(LOCKOUT_DURATIONS[tierIndex] / 1000));
      } else {
        saveLockoutState({ ...state, failedAttempts: newAttempts });
        setError(`Incorrect password. ${attemptsLeft} attempt${attemptsLeft !== 1 ? "s" : ""} remaining before lockout.`);
      }
    } finally { setLoading(false); }
  }

  // ── Forgot password clicked ─────────────────────────────────────────────────
  async function handleForgot() {
    setError("");
    setLoading(true);
    try {
      const res = await getSecurityQStatus();
      if (res.data.hasSecurityQuestions) {
        setAnswers(["", "", ""]);
        setView("answer-questions");
      } else {
        setAnswers(["", "", ""]);
        setView("setup-questions");
      }
    } catch {
      setError("Could not reach server.");
    } finally { setLoading(false); }
  }

  // ── Save security questions (first time setup) ──────────────────────────────
  async function handleSetupQuestions(e) {
    e.preventDefault();
    setError("");
    if (answers.some((a) => !a.trim())) return setError("Please answer all 3 questions.");
    setLoading(true);
    try {
      await saveSecurityQuestions(QUESTIONS.map((q, i) => ({ key: q.key, answer: answers[i] })));
      setError("");
      alert("Security questions saved! You can now use them to recover your password.");
      setView("login");
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to save answers.");
    } finally { setLoading(false); }
  }

  // ── Reset password after answering questions ────────────────────────────────
  async function handleResetPassword(e) {
    e.preventDefault();
    setError("");
    if (answers.some((a) => !a.trim())) return setError("Please answer all 3 questions.");
    if (!newPwd || newPwd.length < 6) return setError("New password must be at least 6 characters.");
    setLoading(true);
    try {
      await resetMasterPassword(
        QUESTIONS.map((q, i) => ({ key: q.key, answer: answers[i] })),
        newPwd
      );
      saveLockoutState({ failedAttempts: 0, lockoutUntil: 0, lockoutCount: 0 });
      alert("Password reset successfully! Please log in with your new password.");
      setView("login");
      setPassword("");
      setNewPwd("");
    } catch (err) {
      setError(err?.response?.data?.error || "Answers incorrect or server error.");
    } finally { setLoading(false); }
  }

  // ── Card wrapper ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4 transition-colors">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 w-full max-w-md shadow-2xl">

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        </div>

        {/* ── VIEW: Login ── */}
        {view === "login" && (
          <>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-1">
              {isFirstTime ? "Create Master Password" : "Welcome Back"}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm text-center mb-6">
              {isFirstTime
                ? "Create a strong master password to encrypt your credentials."
                : "Enter your master password to unlock your vault"}
            </p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Master Password</label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter master password"
                    disabled={isLocked}
                    className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 pr-10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    required
                  />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-white">
                    {showPwd ? <EyeOff /> : <Eye />}
                  </button>
                </div>
                {isFirstTime && password && (
                  <div className="mt-2">
                    <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-300 ${strength.color} ${strength.width}`} />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Strength: {strength.label}</p>
                  </div>
                )}
              </div>

              {isFirstTime && (
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Confirm master password"
                    className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition-colors"
                    required
                  />
                </div>
              )}

              {isLocked ? (
                <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-700 rounded-lg px-4 py-3">
                  <span className="text-lg">🔒</span>
                  <p className="text-amber-700 dark:text-amber-400 text-sm font-medium">
                    Too many failed attempts. Try again in <span className="font-bold">{countdownStr}</span>
                  </p>
                </div>
              ) : (
                error && <p className="text-red-500 text-sm">{error}</p>
              )}

              <button type="submit" disabled={loading || isLocked}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors">
                {loading ? "Please wait..." : isFirstTime ? "Create & Continue" : "Unlock Vault"}
              </button>

              {!isFirstTime && (
                <button type="button" onClick={handleForgot} disabled={loading}
                  className="w-full text-indigo-400 hover:text-indigo-300 text-sm text-center mt-1 transition-colors disabled:opacity-50">
                  Forgot master password?
                </button>
              )}

              {/* First time prompt — only shown on lock screen, not during first-time setup */}
              {!isFirstTime && onStartOnboarding && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 text-center">
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                    New to SecureVault?
                  </p>
                  <button
                    type="button"
                    onClick={onStartOnboarding}
                    className="inline-flex items-center gap-1.5 text-xs text-indigo-500 hover:text-indigo-400 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Start setup wizard
                  </button>
                </div>
              )}
            </form>
          </>
        )}

        {/* ── VIEW: Setup security questions (first time) ── */}
        {view === "setup-questions" && (
          <>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-1">Set Up Recovery Questions</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm text-center mb-6">
              You haven't set up security questions yet. Answer these to enable password recovery.
            </p>
            <form onSubmit={handleSetupQuestions} className="space-y-4">
              {QUESTIONS.map((q, i) => (
                <div key={q.key}>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">{q.label}</label>
                  <input
                    type="text"
                    value={answers[i]}
                    onChange={(e) => { const a = [...answers]; a[i] = e.target.value; setAnswers(a); }}
                    placeholder="Your answer"
                    className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition-colors"
                    required
                  />
                </div>
              ))}
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors">
                {loading ? "Saving..." : "Save & Continue"}
              </button>
              <button type="button" onClick={() => { setView("login"); setError(""); }}
                className="w-full text-gray-400 hover:text-gray-300 text-sm text-center transition-colors">
                ← Back to login
              </button>
            </form>
          </>
        )}

        {/* ── VIEW: Answer questions → reset password ── */}
        {view === "answer-questions" && (
          <>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-1">Reset Master Password</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm text-center mb-6">
              Answer your security questions to set a new master password.
            </p>
            <form onSubmit={handleResetPassword} className="space-y-4">
              {QUESTIONS.map((q, i) => (
                <div key={q.key}>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">{q.label}</label>
                  <input
                    type="text"
                    value={answers[i]}
                    onChange={(e) => { const a = [...answers]; a[i] = e.target.value; setAnswers(a); }}
                    placeholder="Your answer"
                    className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition-colors"
                    required
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">New Master Password</label>
                <input
                  type="password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="Enter new master password"
                  className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition-colors"
                  required
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors">
                {loading ? "Verifying..." : "Reset Password"}
              </button>
              <button type="button" onClick={() => { setView("login"); setError(""); }}
                className="w-full text-gray-400 hover:text-gray-300 text-sm text-center transition-colors">
                ← Back to login
              </button>
            </form>
          </>
        )}

      </div>
    </div>
  );
}

function Eye() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}
function EyeOff() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}