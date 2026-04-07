import { useState, useEffect, useRef } from "react";
import LoginScreen from "./components/LoginScreen";
import Dashboard from "./pages/Dashboard";
import OnboardingWizard from "./components/OnboardingWizard";
import { getAuthStatus } from "./api/auth";

const INACTIVITY_MS    = 5 * 60 * 1000; // 5 min inactivity lock
const HIDDEN_LOCK_MS   = 2 * 60 * 1000; // 2 min after tab hidden

export default function App() {
  const [status, setStatus]       = useState("loading");
  const timerRef                  = useRef(null);
  const hiddenTimerRef            = useRef(null);

  useEffect(() => { checkAuthStatus(); }, []);

  // ── Inactivity lock ──────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== "unlocked") return;
    function resetTimer() {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setStatus("locked"), INACTIVITY_MS);
    }
    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keydown",   resetTimer);
    window.addEventListener("click",     resetTimer);
    resetTimer();
    return () => {
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keydown",   resetTimer);
      window.removeEventListener("click",     resetTimer);
      clearTimeout(timerRef.current);
    };
  }, [status]);

  // ── Visibility lock — locks after 2 min when tab becomes hidden ──────────
  useEffect(() => {
    if (status !== "unlocked") return;

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        // Tab hidden — start 2-minute countdown
        hiddenTimerRef.current = setTimeout(() => {
          setStatus("locked");
        }, HIDDEN_LOCK_MS);
      } else {
        // Tab visible again — cancel the countdown
        clearTimeout(hiddenTimerRef.current);
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearTimeout(hiddenTimerRef.current);
    };
  }, [status]);

  async function checkAuthStatus() {
    try {
      const { data } = await getAuthStatus();
      setStatus(data.hasPassword ? "locked" : "first-time");
    } catch {
      setStatus("first-time");
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Backend says no master password exists yet → straight to wizard
  if (status === "first-time") {
    return <OnboardingWizard onFinish={() => setStatus("unlocked")} />;
  }

  // User manually clicked "First time?" on the lock screen
  if (status === "onboarding") {
    return (
      <OnboardingWizard
        onFinish={() => setStatus("unlocked")}
        onCancel={() => setStatus("locked")}
      />
    );
  }

  if (status === "locked") {
    return (
      <LoginScreen
        isFirstTime={false}
        onUnlock={() => setStatus("unlocked")}
        onStartOnboarding={() => setStatus("onboarding")}
      />
    );
  }

  return <Dashboard onLock={() => setStatus("locked")} />;
}