import { useState, useEffect, useRef } from "react";
import LoginScreen from "./components/LoginScreen";
import Dashboard from "./pages/Dashboard";
import { getAuthStatus } from "./api/auth";

const INACTIVITY_MS = 5 * 60 * 1000;

export default function App() {
  const [status, setStatus] = useState("loading");
  const timerRef = useRef(null);

  useEffect(() => { checkAuthStatus(); }, []);

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

  if (status === "first-time") return <LoginScreen isFirstTime={true}  onUnlock={() => setStatus("unlocked")} />;
  if (status === "locked")     return <LoginScreen isFirstTime={false} onUnlock={() => setStatus("unlocked")} />;
  return <Dashboard onLock={() => setStatus("locked")} />;
}
