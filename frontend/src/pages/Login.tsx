import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Language, User } from "../api/types";
import Icon from "../components/Icon";
import KungFuPanda from "../components/KungFuPanda";
import { errText, t as tr } from "../i18n";
import { store } from "../lib/storage";

export const LANG_KEY = "habit_lang";
export const initialLang = (): Language => {
  const s = store.get(LANG_KEY);
  return s === "hi" || s === "en" ? s : navigator.language?.toLowerCase().startsWith("hi") ? "hi" : "en";
};

export default function Login({ onDone }: { onDone: (u: User, isNew: boolean) => void }) {
  const [lang, setLang] = useState<Language>(initialLang);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [welcome, setWelcome] = useState<User | null>(null);
  const t = (k: string) => tr(lang, k);

  useEffect(() => { document.documentElement.lang = lang; store.set(LANG_KEY, lang); }, [lang]);
  const run = async (fn: () => Promise<void>) => {
    if (busy) return;                      // blocks double-taps
    setErr(""); setBusy(true);
    try { await fn(); } catch (e) { setErr(errText(lang, e)); } finally { setBusy(false); }
  };

  const login = () => run(async () => {
    const normalized = username.trim();
    if (!/^[A-Za-z0-9_]{3,30}$/.test(normalized)) { setErr(t("login.badUsername")); return; }
    if (password.length < 8) { setErr(t("login.badPassword")); return; }
    const r = mode === "register" ? await api.register(normalized, password) : await api.login(normalized, password);
    setWelcome(r.user);
    setTimeout(() => onDone(r.user, r.is_new_user), 1500);
  });

  return (
    <div className="login">
      <div className="login-hero">
        <KungFuPanda />
        <div className="brand big"><span className="brand-mark"><Icon name="flame" size={26} fill /></span><span>{t("app.name")}</span></div>
        <h1>{t("login.tagline")}</h1>
        <p>{t("login.sub")}</p>
        <ul>
          <li><span>📸</span>{t("login.f1")}</li>
          <li><span>🔥</span>{t("login.f2")}</li>
          <li><span>🎮</span>{t("login.f3")}</li>
        </ul>
      </div>

      <div className="login-card card">
        <button className="lang-chip" onClick={() => setLang(lang === "en" ? "hi" : "en")} aria-label="Language">
          <Icon name="globe" size={16} /> {lang === "en" ? "हिन्दी" : "English"}
        </button>

        <form onSubmit={(e) => { e.preventDefault(); login(); }}>
            <label className="field">
              <span>{t("login.username")}</span>
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" placeholder="hero_user" autoFocus />
              <small className="muted">{t("login.username.hint")}</small>
            </label>
            <label className="field">
              <span>{t("login.password")}</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••" />
            </label>
            <button className="btn primary block" disabled={busy || !username.trim() || !password}>{busy ? <span className="spinner sm" /> : t(mode === "register" ? "login.register" : "login.continue")}</button>
            <button type="button" className="link" disabled={busy} onClick={() => { setMode(mode === "login" ? "register" : "login"); setErr(""); }}>
              {t(mode === "login" ? "login.createPrompt" : "login.loginPrompt")}
            </button>
          </form>
        {err && <p role="alert" className="form-err">{err}</p>}
      </div>
      {welcome && (
        <div className="login-welcome" role="status" aria-live="polite">
          <KungFuPanda variant="login" />
          <strong>{t("login.welcome")}</strong>
        </div>
      )}
    </div>
  );
}
