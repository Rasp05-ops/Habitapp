import { useState } from "react";
import { api } from "../api/client";
import type { CatalogHabit, Habit } from "../api/types";
import Icon from "../components/Icon";
import { ErrorBox, PageHead, Segmented, Skeleton, Stepper, Switch } from "../components/ui";
import { useApp } from "../hooks/app";
import { useAsync } from "../hooks/useAsync";
import { getTheme, setTheme, type Theme } from "../lib/theme";
import { store } from "../lib/storage";
import { LANG_KEY } from "./Login";

const deviceTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ""; } };

export default function Profile() {
  const { user, setUser, lang, t, err, toast, logout } = useApp();
  const q = useAsync(async () => { const [c, h] = await Promise.all([api.catalog(), api.habits()]); return { catalog: c.habits, habits: h.habits }; });
  const [name, setName] = useState(user.name ?? "");
  const [theme, setThemeState] = useState<Theme>(getTheme);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (patch: Parameters<typeof api.updateMe>[0], okMsg?: string) => {
    if (busy) return;
    setBusy(true);
    try { const u = await api.updateMe(patch); setUser(u); if (patch.language) store.set(LANG_KEY, patch.language); if (okMsg) toast(okMsg, "ok"); }
    catch (e) { toast(err(e), "err"); } finally { setBusy(false); }
  };
  const mutateHabits = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); await q.reload(); } catch (e) { toast(err(e), "err"); } finally { setBusy(false); setConfirm(null); }
  };

  if (q.error && !q.data) return <ErrorBox error={q.error} onRetry={q.reload} />;
  if (!q.data) return <div className="stack"><Skeleton h={120} /><Skeleton h={260} /></div>;

  const { catalog, habits } = q.data;
  const free = catalog.filter((c: CatalogHabit) => !habits.some((h) => h.catalog_id === c.id));
  const cleanName = name.replace(/\s+/g, " ").trim();
  const tz = deviceTz();

  return (
    <div className="stack narrow">
      <PageHead title={t("pf.title")} />

      <section className="card profile-head">
        <span className="avatar xl">{(user.name ?? "?").charAt(0).toUpperCase()}</span>
        <div className="grow">
          <label className="field compact"><span>{t("pf.name")}</span>
            <div className="inline-form">
              <input value={name} maxLength={50} onChange={(e) => setName(e.target.value)} />
              <button className="btn primary" disabled={busy || !cleanName || cleanName === user.name} onClick={() => save({ name: cleanName }, t("pf.saved"))}>{t("pf.save")}</button>
            </div>
          </label>
          <small className="muted">{t("pf.username")}: @{user.username}</small>
        </div>
      </section>

      <section className="card settings">
        <div className="setting-row"><b>{t("pf.language")}</b>
          <Segmented value={lang} onChange={(l) => save({ language: l })} options={[{ value: "en", label: "English" }, { value: "hi", label: "हिन्दी" }]} /></div>
        <div className="setting-row"><b>{t("pf.theme")}</b>
          <Segmented value={theme} onChange={(v) => { setTheme(v); setThemeState(v); }}
            options={[{ value: "auto", label: t("pf.theme.auto") }, { value: "dark", label: t("pf.theme.dark") }, { value: "light", label: t("pf.theme.light") }]} /></div>
        <div className="setting-row"><b>{t("pf.goal")}</b>
          <Stepper value={Math.min(user.daily_target, Math.max(1, habits.length))} min={1} max={Math.max(1, habits.length)} onChange={(v) => save({ daily_target: v })} /></div>
        <div className="setting-row"><b>{t("pf.board")}</b>
          <Switch on={user.leaderboard_opt_in} onChange={(v) => save({ leaderboard_opt_in: v })} label={t("pf.board")} disabled={busy} /></div>
        <div className="setting-row"><div><b>{t("pf.tz")}</b><small className="muted block">{user.timezone}</small></div>
          {tz && tz !== user.timezone && <button className="btn ghost" disabled={busy} onClick={() => save({ timezone: tz }, t("pf.saved"))}>{t("pf.tzUse")}</button>}</div>
      </section>

      <section className="card">
        <div className="section-title"><h2>{t("pf.habits")}</h2><small className="muted">{habits.length}/5</small></div>
        <ul className="habit-list">
          {habits.map((h: Habit) => (
            <li key={h.id}>
              <span className="habit-icon sm">{h.icon}</span><b className="grow">{h.name[lang]}</b>
              {confirm === h.id ? (
                <span className="confirm"><small>{t("pf.removeAsk")}</small>
                  <button className="btn danger sm" disabled={busy} onClick={() => mutateHabits(() => api.removeHabit(h.id))}>{t("pf.remove")}</button>
                  <button className="btn ghost sm" onClick={() => setConfirm(null)}>{t("pf.cancel")}</button></span>
              ) : (
                <button className="btn icon" onClick={() => setConfirm(h.id)} aria-label={`${t("pf.remove")} ${h.name[lang]}`}><Icon name="trash" size={18} /></button>
              )}
            </li>
          ))}
        </ul>
        {habits.length >= 5 ? <p className="muted">{t("pf.max")}</p> : free.length > 0 && (
          <>
            <small className="eyebrow">{t("pf.add")}</small>
            <div className="chip-row">
              {free.map((c) => <button key={c.id} className="chip-btn" disabled={busy} onClick={() => mutateHabits(() => api.addHabit(c.id))}><Icon name="plus" size={14} /> {c.icon} {c.name[lang]}</button>)}
            </div>
          </>
        )}
      </section>

      <button className="btn ghost block danger-text" onClick={logout}><Icon name="logout" size={18} /> {t("pf.logout")}</button>
    </div>
  );
}
