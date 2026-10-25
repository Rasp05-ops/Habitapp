import type { ReactNode } from "react";
import Icon from "./Icon";
import { useApp } from "../hooks/app";

const NAV = [
  { path: "/home", icon: "home", key: "nav.home" },
  { path: "/calendar", icon: "calendar", key: "nav.calendar" },
  { path: "/games", icon: "games", key: "nav.games" },
  { path: "/story", icon: "book", key: "nav.story" },
  { path: "/leaderboard", icon: "trophy", key: "nav.leaderboard" },
  { path: "/profile", icon: "user", key: "nav.profile" },
] as const;

export default function Shell({ route, go, children }: { route: string; go: (to: string) => void; children: ReactNode }) {
  const { t, user } = useApp();
  const active = (p: string) => route === p || route.startsWith(p + "/");
  const initial = (user.name ?? "?").trim().charAt(0).toUpperCase();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><Icon name="flame" size={22} fill /></span><span>{t("app.name")}</span></div>
        <nav aria-label="Main">
          {NAV.map((n) => (
            <a key={n.path} href={`#${n.path}`} className={`nav-item ${active(n.path) ? "active" : ""}`} aria-current={active(n.path) ? "page" : undefined}>
              <Icon name={n.icon} /><span>{t(n.key)}</span>
            </a>
          ))}
        </nav>
        <button className="side-user" onClick={() => go("/profile")}>
          <span className="avatar">{initial}</span>
          <span className="side-user-text"><b>{user.name}</b><small>@{user.username}</small></span>
        </button>
      </aside>

      <header className="topbar">
        <div className="brand"><span className="brand-mark"><Icon name="flame" size={18} fill /></span><span>{t("app.name")}</span></div>
        <button className="avatar" onClick={() => go("/profile")} aria-label={t("nav.profile")}>{initial}</button>
      </header>

      <main className="content" id="main">{children}</main>

      <nav className="tabbar" aria-label="Main">
        {NAV.map((n) => (
          <a key={n.path} href={`#${n.path}`} className={`tab ${active(n.path) ? "active" : ""}`} aria-current={active(n.path) ? "page" : undefined}>
            <Icon name={n.icon} size={22} /><span>{t(n.key)}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
