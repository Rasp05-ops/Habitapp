import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { CheckInResult, Today, TodayHabit } from "../api/types";
import Celebrate from "../components/Celebrate";
import Icon from "../components/Icon";
import ProgressRing from "../components/ProgressRing";
import { ErrorBox, PageHead, Skeleton } from "../components/ui";
import { useApp } from "../hooks/app";
import { useAsync } from "../hooks/useAsync";
import { compressImage } from "../lib/image";

export default function Dashboard() {
  const { user, lang, t, err, toast } = useApp();
  const q = useAsync(api.today);
  const { data: today, setData } = q;
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Record<string, { text: string; tone: "bad" | "ok" }>>({});
  const [party, setParty] = useState<{ title: string; lines: string[] } | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const sync = useCallback(async () => { try { const d = await api.today(); if (alive.current) setData(d); } catch { /* keep what we have */ } }, [setData]);
  // Day rolled over while the app sat open in a background tab: refresh when it comes back.
  useEffect(() => {
    const on = () => { if (document.visibilityState === "visible") sync(); };
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, [sync]);

  const apply = (habitId: string, r: CheckInResult) => {
    setData((prev) => prev && ({ ...prev, progress: r.progress }));
    if (r.status === "retry") {
      setNotes((n) => ({ ...n, [habitId]: { text: t(r.message_key), tone: "bad" } }));
    } else {
      setNotes((n) => { const { [habitId]: _drop, ...rest } = n; return rest; });
      toast(t(r.message_key), r.status === "already_done" ? "info" : "ok");
    }
    if (r.bonuses.length) {
      setParty({
        title: r.bonuses.some((b) => b.type === "streak_milestone") ? `🔥 ${r.progress.streak.current} ${t("home.streak")}` : t("home.goalDone"),
        lines: r.bonuses.map((b) => b.type === "streak_milestone" ? `+${b.points} · ${b.streak_days} ${t("bonus.streak_milestone")}` : `+${b.points} · ${t("bonus.daily_target")}`),
      });
    }
  };

  const act = async (h: TodayHabit, fn: () => Promise<CheckInResult>) => {
    const id = h.habit.id;
    if (busy.has(id)) return;
    setBusy((s) => new Set(s).add(id));
    try { apply(id, await fn()); await sync(); }
    catch (e) { setNotes((n) => ({ ...n, [id]: { text: err(e), tone: "bad" } })); }
    finally { if (alive.current) setBusy((s) => { const c = new Set(s); c.delete(id); return c; }); }
  };

  const onPhoto = (h: TodayHabit, file: File) => act(h, async () => {
    let blob: Blob;
    try { blob = await compressImage(file); } catch { throw Object.assign(new Error("img"), { code: "UNSUPPORTED_IMAGE_TYPE" }); }
    return api.checkInPhoto(h.habit.id, blob);
  });

  if (q.error && !today) return <ErrorBox error={q.error} onRetry={q.reload} />;
  if (!today) return <div className="stack"><Skeleton h={220} /><Skeleton h={140} /><Skeleton h={140} /></div>;

  const { streak, points, next_unlock: nu, completed_count, daily_target, target_reached } = today.progress;
  const first = (user.name ?? "").split(" ")[0];
  const dateLabel = new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : "en-IN", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${today.date}T12:00:00`));
  const left = Math.max(0, daily_target - completed_count);

  return (
    <div className="stack">
      <PageHead title={`${t("home.hello")}, ${first} 👋`} sub={dateLabel} />

      <section className="hero-grid">
        <div className="card hero-card goal">
          <ProgressRing value={target_reached ? 1 : completed_count / daily_target} size={156} stroke={13}>
            <div className="ring-num"><b>{completed_count}</b><span>/ {daily_target}</span></div>
          </ProgressRing>
          <div className="goal-text">
            <small className="eyebrow">{t("home.goal")}</small>
            <h2>{target_reached ? t("home.goalDone") : `${left} ${t("home.goalLeft")}`}</h2>
            <p className="muted">{streak.completed_today ? `🔥 ${streak.current} ${t("home.streak")}` : t("home.today")}</p>
          </div>
        </div>

        <div className="card hero-card streak">
          <div className="flame" aria-hidden="true"><Icon name="flame" size={34} fill /></div>
          <div className="big-num">{streak.current}</div>
          <div className="muted">{t("home.streak")}</div>
          <div className="chips">
            <span className="chip"><Icon name="crown" size={14} /> {t("home.best")} {streak.best}</span>
            <span className="chip ice"><Icon name="snow" size={14} /> {streak.freezes_left} {t("home.freezes")}</span>
          </div>
        </div>

        <div className="card hero-card pts">
          <div className="pts-top"><Icon name="star" size={22} fill className="gold" /><span className="muted">{t("home.points")}</span></div>
          <div className="big-num">{points.lifetime.toLocaleString(lang === "hi" ? "hi-IN" : "en-IN")}</div>
          <div className="chips">
            <span className="chip">+{points.today} {t("home.pointsToday")}</span>
            <span className="chip">{points.weekly} {t("home.pointsWeek")}</span>
          </div>
          <div className="unlock">
            {nu ? (
              <>
                <div className="row-between"><small>{t("home.nextGame")}: <b>{nu.name[lang]}</b></small><small>{nu.lifetime_points}/{nu.required_points}</small></div>
                <div className="bar"><i style={{ width: `${Math.min(100, (nu.lifetime_points / nu.required_points) * 100)}%` }} /></div>
              </>
            ) : <small>🎮 {t("home.allUnlocked")}</small>}
          </div>
        </div>
      </section>

      <div className="section-title"><h2>{t("home.habits")}</h2></div>
      {today.habits.length === 0 && <div className="card center-card muted">{t("home.noHabits")}</div>}
      <section className="habit-grid">
        {today.habits.map((h) => {
          const id = h.habit.id, isBusy = busy.has(id), done = h.status !== "pending", note = notes[id];
          return (
            <article key={id} className={`card habit ${done ? "is-done" : ""} ${note?.tone === "bad" ? "shake" : ""}`}>
              <div className="habit-top">
                <span className="habit-icon" aria-hidden="true">{h.habit.icon}</span>
                <div className="habit-title">
                  <b>{h.habit.name[lang]}</b>
                  <small className="muted">{h.habit.verification === "photo" ? `📸 ${t("home.photoTag")}` : `👆 ${t("home.tapTag")}`}</small>
                </div>
                {done && <span className="pill ok"><Icon name="check" size={14} /> +{h.points_earned}</span>}
              </div>

              {done ? (
                <div className="habit-done"><Icon name="check" size={18} /> {t("home.done")}{h.status === "done_unverified" && <small className="muted"> · {t("checkin.done_unverified")}</small>}</div>
              ) : h.habit.verification === "tap" ? (
                <button className="btn primary block" disabled={isBusy} onClick={() => act(h, () => api.checkInTap(id))}>
                  {isBusy ? <span className="spinner sm" /> : <><Icon name="check" size={18} /> {t("home.tap")}</>}
                </button>
              ) : (
                <label className={`btn primary block file-btn ${isBusy ? "disabled" : ""}`}>
                  {isBusy ? <><span className="spinner sm" /> {t("home.checking")}</> : <><Icon name="camera" size={18} /> {t("home.photo")}</>}
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/*" capture="environment" hidden disabled={isBusy}
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPhoto(h, f); }} />
                </label>
              )}

              {!done && h.habit.verification === "photo" && h.retries_left != null && (
                <div className="tries" aria-label={`${h.retries_left} ${t("home.tries")}`}>
                  {Array.from({ length: 3 }, (_, i) => <i key={i} className={i < (h.retries_left ?? 0) ? "on" : ""} />)}
                  <small className="muted">{h.retries_left} {t("home.tries")}</small>
                </div>
              )}
              {note && <p className={`note ${note.tone}`} role="alert">{note.text}</p>}
            </article>
          );
        })}
      </section>

      {party && <Celebrate title={party.title} lines={party.lines} cta="OK" onClose={() => setParty(null)} />}
    </div>
  );
}
