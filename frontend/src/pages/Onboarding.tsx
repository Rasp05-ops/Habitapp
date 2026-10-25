import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { CatalogHabit, User } from "../api/types";
import Icon from "../components/Icon";
import { Segmented, Spinner, Stepper, Switch } from "../components/ui";
import { useApp } from "../hooks/app";
import { LANG_KEY } from "./Login";
import { store } from "../lib/storage";

const deviceTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined; } catch { return undefined; } };

export default function Onboarding({ onDone }: { onDone: (u: User) => void }) {
  const { user, setUser, lang, t, err, toast } = useApp();
  const [step, setStep] = useState(1);
  const [name, setName] = useState(user.name ?? "");
  const [catalog, setCatalog] = useState<CatalogHabit[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [target, setTarget] = useState(user.daily_target);
  const [board, setBoard] = useState(user.leaderboard_opt_in);
  const [busy, setBusy] = useState(false);
  const [loadErr, setLoadErr] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [c, mine] = await Promise.all([api.catalog(), api.habits()]);
        setCatalog(c.habits);
        setPicked(mine.habits.map((h) => h.catalog_id));      // resume-safe if onboarding was interrupted
      } catch { setLoadErr(true); }
    })();
  }, []);

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 5 ? p : [...p, id]));
  const cleanName = name.replace(/\s+/g, " ").trim();
  const max = Math.max(1, picked.length);
  const goal = Math.min(target, max);

  const finish = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const patch = { name: cleanName, language: lang, daily_target: goal, leaderboard_opt_in: board };
      const tz = deviceTz();
      try { await api.updateMe({ ...patch, ...(tz ? { timezone: tz } : {}) }); }
      catch (e) { if (e instanceof ApiError && e.code === "VALIDATION_ERROR" && tz) await api.updateMe(patch); else throw e; }  // unknown tz name -> keep default

      const mine = (await api.habits()).habits;
      for (const h of mine) if (!picked.includes(h.catalog_id)) await api.removeHabit(h.id);
      for (const id of picked) if (!mine.some((h) => h.catalog_id === id)) await api.addHabit(id);
      const done = await api.updateMe({ onboarding_completed: true, daily_target: goal });
      store.set(LANG_KEY, done.language);
      onDone(done);
    } catch (e) { toast(err(e), "err"); } finally { setBusy(false); }
  };

  return (
    <div className="onboard">
      <div className="card onboard-card">
        <div className="steps" aria-label={`${t("ob.step")} ${step} ${t("ob.of")} 3`}>
          {[1, 2, 3].map((n) => <span key={n} className={n <= step ? "on" : ""} />)}
        </div>

        {step === 1 && (
          <section>
            <h1>{t("ob.welcome")}</h1>
            <label className="field"><span>{t("ob.name")}</span>
              <input value={name} maxLength={50} onChange={(e) => setName(e.target.value)} autoComplete="given-name" autoFocus />
            </label>
            <div className="field"><span>{t("ob.language")}</span>
              <Segmented value={lang} onChange={(l) => { setUser({ ...user, language: l }); store.set(LANG_KEY, l); }}
                options={[{ value: "en", label: "English" }, { value: "hi", label: "हिन्दी" }]} />
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <h1>{t("ob.pick")}</h1>
            <p className="muted">{t("ob.pickSub")} <b>{picked.length}/5</b></p>
            {loadErr ? <p className="form-err">{t("ui.offline")}</p> : !catalog ? <Spinner /> : (
              <div className="pick-grid">
                {catalog.map((h) => {
                  const on = picked.includes(h.id);
                  return (
                    <button key={h.id} type="button" className={`pick ${on ? "on" : ""}`} onClick={() => toggle(h.id)} aria-pressed={on} disabled={!on && picked.length >= 5}>
                      <span className="pick-icon">{h.icon}</span>
                      <b>{h.name[lang]}</b>
                      <small>{h.verification === "photo" ? `📸 ${t("home.photoTag")}` : `👆 ${t("home.tapTag")}`}</small>
                      {on && <span className="pick-check"><Icon name="check" size={16} /></span>}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {step === 3 && (
          <section>
            <h1>{t("ob.target")}</h1>
            <p className="muted">{t("ob.targetSub")}</p>
            <Stepper value={goal} min={1} max={max} onChange={setTarget} unit={t("ob.habitsPerDay")} />
            <div className="setting-row">
              <div><b>{t("ob.board")}</b><small className="muted">{t("ob.boardSub")}</small></div>
              <Switch on={board} onChange={setBoard} label={t("ob.board")} />
            </div>
          </section>
        )}

        <div className="row-between onboard-actions">
          {step > 1 ? <button className="btn ghost" onClick={() => setStep(step - 1)} disabled={busy}>{t("ob.back")}</button> : <span />}
          {step < 3 ? (
            <button className="btn primary" onClick={() => setStep(step + 1)} disabled={(step === 1 && cleanName.length === 0) || (step === 2 && picked.length === 0)}>{t("ob.next")}</button>
          ) : (
            <button className="btn primary" onClick={finish} disabled={busy || picked.length === 0}>{busy ? <span className="spinner sm" /> : t("ob.finish")}</button>
          )}
        </div>
      </div>
    </div>
  );
}
