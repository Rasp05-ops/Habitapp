import { useCallback, useEffect, useState } from "react";
import { api, ApiError, auth, AUTH_EXPIRED } from "./api/client";
import type { User } from "./api/types";
import Shell from "./components/Shell";
import { Spinner } from "./components/ui";
import { AppProvider } from "./hooks/app";
import { useRoute } from "./hooks/useRoute";
import { t as tr } from "./i18n";
import CalendarPage from "./pages/CalendarPage";
import Dashboard from "./pages/Dashboard";
import GamesPage from "./pages/GamesPage";
import Leaderboard from "./pages/Leaderboard";
import Login, { initialLang } from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Profile from "./pages/Profile";
import StoryPage from "./pages/StoryPage";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [boot, setBoot] = useState<"loading" | "ready" | "offline">(auth.token ? "loading" : "ready");
  const [route, go] = useRoute();

  const loadMe = useCallback(() => {
    setBoot("loading");
    api.me().then((u) => { setUser(u); setBoot("ready"); })
      .catch((e) => { if (e instanceof ApiError && e.code === "NETWORK_ERROR") setBoot("offline"); else { setUser(null); setBoot("ready"); } });
  }, []);

  useEffect(() => { if (auth.token) loadMe(); }, [loadMe]);
  useEffect(() => {                                   // token rejected mid-session -> straight back to login
    const on = () => { setUser(null); setBoot("ready"); };
    window.addEventListener(AUTH_EXPIRED, on);
    return () => window.removeEventListener(AUTH_EXPIRED, on);
  }, []);

  const logout = useCallback(() => { api.logout(); setUser(null); window.location.hash = ""; }, []);

  if (boot === "loading") return <div className="splash"><Spinner /></div>;
  if (boot === "offline") {
    const l = initialLang();
    return <div className="splash"><div className="card center-card"><p>{tr(l, "ui.offline")}</p><button className="btn primary" onClick={loadMe}>{tr(l, "ui.retry")}</button></div></div>;
  }
  if (!user) return <Login onDone={(u) => { setUser(u); window.location.hash = u.onboarding_completed ? "/home" : ""; }} />;

  return (
    <AppProvider user={user} setUser={setUser} logout={logout}>
      {!user.onboarding_completed ? (
        <Onboarding onDone={(u) => { setUser(u); go("/home"); }} />
      ) : (
        <Shell route={route} go={go}>
          <Routes route={route} go={go} />
        </Shell>
      )}
    </AppProvider>
  );
}

function Routes({ route, go }: { route: string; go: (to: string) => void }) {
  if (route.startsWith("/games")) return <GamesPage gameId={route.split("/")[2] ?? null} go={go} />;
  switch (route) {
    case "/calendar": return <CalendarPage />;
    case "/leaderboard": return <Leaderboard />;
    case "/profile": return <Profile />;
    case "/story": return <StoryPage />;
    default: return <Dashboard />;
  }
}
