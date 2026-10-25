import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import Icon from "../components/Icon";
import { ErrorBox, PageHead, Skeleton } from "../components/ui";
import { useApp } from "../hooks/app";
import { useAsync } from "../hooks/useAsync";
import { formatMonth } from "../i18n";

const shiftMonth = (m: string, by: number) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export default function CalendarPage() {
  const { lang, t } = useApp();
  const todayQ = useAsync(api.today);
  const [month, setMonth] = useState<string | null>(null);
  const todayStr = todayQ.data?.date;
  useEffect(() => { if (todayStr && !month) setMonth(todayStr.slice(0, 7)); }, [todayStr, month]);
  const calQ = useAsync(() => (month ? api.calendar(month) : Promise.resolve(null)), [month]);

  const cells = useMemo(() => {
    if (!month) return [];
    const [y, m] = month.split("-").map(Number);
    const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7;            // Monday first
    const count = new Date(y, m, 0).getDate();
    return [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)] as (string | null)[];
  }, [month]);

  if (todayQ.error && !todayQ.data) return <ErrorBox error={todayQ.error} onRetry={todayQ.reload} />;
  if (!month || !todayStr) return <div className="stack"><Skeleton h={80} /><Skeleton h={380} /></div>;

  const byDate = new Map((calQ.data?.days ?? []).map((d) => [d.date, d]));
  const days = calQ.data?.days ?? [];
  const goalDays = days.filter((d) => d.target_reached).length;
  const habitsDone = days.reduce((s, d) => s + d.completed_count, 0);
  const streak = todayQ.data!.progress.streak;
  const isCurrent = month >= todayStr.slice(0, 7);
  const wk = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : "en-IN", { weekday: "short" }).format(new Date(2024, 0, 1 + i)));

  return (
    <div className="stack">
      <PageHead title={t("cal.title")} />
      <section className="stat-row">
        <div className="card stat"><span className="stat-ico fire"><Icon name="flame" fill /></span><b>{streak.current}</b><small>{t("home.streak")}</small></div>
        <div className="card stat"><span className="stat-ico ok"><Icon name="check" /></span><b>{goalDays}</b><small>{t("cal.reached")}</small></div>
        <div className="card stat"><span className="stat-ico"><Icon name="calendar" /></span><b>{days.length}</b><small>{t("cal.active")}</small></div>
        <div className="card stat"><span className="stat-ico gold"><Icon name="star" fill /></span><b>{habitsDone}</b><small>{t("cal.habitsDone")}</small></div>
      </section>

      <section className="card cal">
        <div className="cal-head">
          <button className="btn icon" onClick={() => setMonth(shiftMonth(month, -1))} aria-label={t("cal.prev")}><Icon name="left" /></button>
          <h2>{formatMonth(month, lang)}</h2>
          <button className="btn icon" onClick={() => setMonth(shiftMonth(month, 1))} disabled={isCurrent} aria-label={t("cal.next")}><Icon name="right" /></button>
        </div>
        <div className="cal-grid" role="grid" aria-busy={calQ.loading}>
          {wk.map((w) => <div key={w} className="cal-wk" role="columnheader">{w}</div>)}
          {cells.map((d, i) => {
            if (!d) return <div key={`b${i}`} />;
            const rec = byDate.get(d), future = d > todayStr, isToday = d === todayStr;
            const level = rec?.target_reached ? "goal" : rec ? "some" : "none";
            return (
              <div key={d} role="gridcell" className={`cal-day ${level} ${future ? "future" : ""} ${isToday ? "today" : ""}`}
                aria-label={`${d}${rec ? `, ${rec.completed_count}` : ""}`} title={rec ? String(rec.completed_count) : undefined}>
                <span>{Number(d.slice(8))}</span>
                {rec?.target_reached && <Icon name="check" size={12} />}
                {rec && !rec.target_reached && <i>{rec.completed_count}</i>}
              </div>
            );
          })}
        </div>
        <div className="legend">
          <span><i className="dot none" />{t("cal.legend.none")}</span>
          <span><i className="dot some" />{t("cal.legend.some")}</span>
          <span><i className="dot goal" />{t("cal.legend.goal")}</span>
        </div>
        {calQ.error != null && <ErrorBox error={calQ.error} onRetry={calQ.reload} />}
      </section>
    </div>
  );
}
