import { useState } from "react";
import { api } from "../api/client";
import type { LeaderboardEntry } from "../api/types";
import Icon from "../components/Icon";
import { ErrorBox, PageHead, Skeleton, Switch } from "../components/ui";
import { useApp } from "../hooks/app";
import { useAsync } from "../hooks/useAsync";

const MEDAL = ["🥇", "🥈", "🥉"];

export default function Leaderboard() {
  const { user, setUser, lang, t, err, toast } = useApp();
  const q = useAsync(() => api.leaderboard(20), [user.leaderboard_opt_in]);
  const [busy, setBusy] = useState(false);

  const join = async (on: boolean) => {
    if (busy) return;
    setBusy(true);
    try { setUser(await api.updateMe({ leaderboard_opt_in: on })); } catch (e) { toast(err(e), "err"); } finally { setBusy(false); }
  };

  if (q.error && !q.data) return <ErrorBox error={q.error} onRetry={q.reload} />;
  if (!q.data) return <div className="stack"><Skeleton h={90} /><Skeleton h={260} /></div>;

  const { entries, me, opted_in, week_start, week_end } = q.data;
  const fmt = (d: string) => new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short" }).format(new Date(`${d}T12:00:00`));
  const top = entries.slice(0, 3);
  const podium = [top[1], top[0], top[2]];                       // 2nd · 1st · 3rd
  const row = (e: LeaderboardEntry) => (
    <li key={`${e.rank}-${e.display_name}-${e.is_me}`} className={`lb-row ${e.is_me ? "me" : ""}`}>
      <span className="lb-rank">{e.rank <= 3 ? MEDAL[e.rank - 1] : e.rank}</span>
      <span className="avatar sm">{e.display_name.charAt(0)}</span>
      <b>{e.display_name}{e.is_me && <small className="pill">{t("lb.you")}</small>}</b>
      <span className="lb-pts">{e.weekly_points} <small>{t("lb.pts")}</small></span>
    </li>
  );

  return (
    <div className="stack">
      <PageHead title={t("lb.title")} sub={`${fmt(week_start)} – ${fmt(week_end)} · ${t("lb.week")}`} />

      {!opted_in && (
        <div className="card join-card">
          <span className="join-ico"><Icon name="trophy" size={28} /></span>
          <div><b>{t("lb.join")}</b><p className="muted">{t("lb.joinSub")}</p></div>
          <Switch on={false} onChange={join} label={t("lb.join")} disabled={busy} />
        </div>
      )}

      {opted_in && entries.length === 0 && <div className="card center-card muted">{t("lb.empty")}</div>}

      {entries.length > 0 && (
        <>
          <section className="podium" aria-label={t("lb.title")}>
            {podium.map((e, i) => e && (
              <div key={e.rank + e.display_name} className={`pod pod-${[2, 1, 3][i]} ${e.is_me ? "me" : ""}`}>
                <span className="medal">{MEDAL[e.rank - 1] ?? e.rank}</span>
                <span className="avatar">{e.display_name.charAt(0)}</span>
                <b>{e.display_name}</b>
                <small>{e.weekly_points} {t("lb.pts")}</small>
              </div>
            ))}
          </section>
          <ol className="card lb-list">{entries.map(row)}</ol>
        </>
      )}

      {opted_in && me && !entries.some((e) => e.is_me) && (
        <div className="card"><small className="eyebrow">{t("lb.yourRank")}</small><ol className="lb-list flat">{row(me)}</ol></div>
      )}
      {opted_in && !me && <p className="muted center">{t("lb.noPoints")}</p>}
    </div>
  );
}
