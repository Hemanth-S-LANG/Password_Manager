import { useState, useEffect, useRef } from "react";
import { createMasterPassword, verifyMasterPassword } from "../api/auth";

const LOCKOUT_DURATIONS = [1 * 60 * 1000, 5 * 60 * 1000, 30 * 60 * 1000];
const STORAGE_KEY = "kv_lockout";

function getLockoutState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}
function saveLockoutState(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// Password strength calculator
function getStrength(pwd) {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return { label: "Weak", color: "bg-red-500", width: "w-1/5" };
  if (score <= 2) return { label: "Fair", color: "bg-orange-400", width: "w-2/5" };
  if (score <= 3) return { label: "Good", color: "bg-yellow-400", width: "w-3/5" };
  if (score <= 4) return { label: "Strong", color: "bg-blue-400", width: "w-4/5" };
  return { label: "Very Strong", color: "bg-green-500", width: "w-full" };
}

export default function LoginScreen({ isFirstTime, onUnlock }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [countdown, setCountdown] = useState(0); // seconds remaining in lockout
  const timerRef = useRef(null);

  const strength = getStrength(password);
  const isLocked = countdown > 0;

  // On mount, check if already locked out
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
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setError("You may try again now.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleSubmit(e) {
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
      } finally {
        setLoading(false);
      }
      return;
    }

    // Verify flow with lockout
    const state = getLockoutState();

    // Double-check lockout (in case timer just expired)
    if ((state.lockoutUntil || 0) > Date.now()) {
      const remaining = Math.ceil((state.lockoutUntil - Date.now()) / 1000);
      startCountdown(remaining);
      return;
    }

    setLoading(true);
    try {
      await verifyMasterPassword(password);
      // Success — clear lockout state
      saveLockoutState({ failedAttempts: 0, lockoutUntil: 0, lockoutCount: 0 });
      clearInterval(timerRef.current);
      onUnlock();
    } catch (err) {
      const newAttempts = (state.failedAttempts || 0) + 1;
      const attemptsLeft = 5 - (newAttempts % 5);

      if (newAttempts % 5 === 0) {
        const tierIndex = Math.min((state.lockoutCount || 0), LOCKOUT_DURATIONS.length - 1);
        const lockoutUntil = Date.now() + LOCKOUT_DURATIONS[tierIndex];
        saveLockoutState({
          failedAttempts: newAttempts,
          lockoutUntil,
          lockoutCount: (state.lockoutCount || 0) + 1,
        });
        startCountdown(Math.ceil(LOCKOUT_DURATIONS[tierIndex] / 1000));
      } else {
        saveLockoutState({ ...state, failedAttempts: newAttempts });
        setError(`Incorrect password. ${attemptsLeft} attempt${attemptsLeft !== 1 ? "s" : ""} remaining before lockout.`);
      }
    } finally {
      setLoading(false);
    }
  }

  // Format countdown as Xm Ys or Xs
  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;
  const countdownStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4 transition-colors">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-1">
          {isFirstTime ? "Create Master Password" : "Welcome Back"}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm text-center mb-6">
          {isFirstTime
            ? "Create a strong master password to encrypt all your credentials. Remember it well — it cannot be recovered!"
            : "Enter your master password to unlock your vault"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Master Password</label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter master password"
                disabled={isLocked}
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-indigo-500 pr-10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
                <p className="text-xs text-gray-500 mt-1">Password strength: {strength.label}</p>
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
                className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
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
        </form>
      </div>
    </div>
  );
}

// Inline icon components
function Eye() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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

// Inline icon components
function Eye() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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
