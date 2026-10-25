import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { DailyStory } from "../api/types";
import { ErrorBox, PageHead, Skeleton } from "../components/ui";
import { useApp } from "../hooks/app";
import { useAsync } from "../hooks/useAsync";

type Player = { destroy: () => void };
type YouTube = { Player: new (el: HTMLElement, opts: { videoId: string; events: { onStateChange: (event: { data: number }) => void } }) => Player };
declare global { interface Window { YT?: YouTube; onYouTubeIframeAPIReady?: () => void; } }

function YouTubeVideo({ story, onEnded }: { story: DailyStory; onEnded: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!story.video_id || !host.current) return;
    const start = () => {
      if (host.current && window.YT) new window.YT.Player(host.current, { videoId: story.video_id, events: { onStateChange: (e) => { if (e.data === 0) onEnded(); } } });
    };
    if (window.YT) start();
    else {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      window.onYouTubeIframeAPIReady = start;
      document.head.appendChild(script);
    }
  }, [story.video_id, onEnded]);
  return <div className="story-video" ref={host} />;
}

export default function StoryPage() {
  const { t, err, toast } = useApp();
  const q = useAsync(api.todayStory);
  const [story, setStory] = useState<DailyStory | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const current = story ?? q.data;

  useEffect(() => { if (q.data) setStory(q.data); }, [q.data]);
  const markWatched = async () => {
    if (!current || current.watched || busy) return;
    setBusy(true);
    try { setStory(await api.markStoryWatched(current.id)); } catch (e) { toast(err(e), "err"); } finally { setBusy(false); }
  };
  const submit = async () => {
    if (!current || busy) return;
    setBusy(true);
    try { setStory(await api.submitStoryQuiz(current.id, answers)); toast(t("story.done"), "ok"); }
    catch (e) { toast(err(e), "err"); } finally { setBusy(false); }
  };

  if (q.error && !current) return <ErrorBox error={q.error} onRetry={q.reload} />;
  if (!current) return <div className="stack"><Skeleton h={220} /><Skeleton h={180} /></div>;

  return (
    <div className="stack narrow">
      <PageHead title={t("story.title")} sub={t("story.sub")} />
      <section className="card story-card">
        <h2>{current.title}</h2>
        <p className="muted">{current.summary}</p>
        {current.video_id ? <YouTubeVideo story={current} onEnded={markWatched} /> : <div className="story-empty">{t("story.noVideo")}</div>}
        {current.watched ? <p className="story-unlocked">✓ {t("story.quiz")}</p> : <p className="muted">{t("story.watch")}</p>}
      </section>
      {current.watched && (
        <section className="card story-quiz">
          <div className="row-between"><h2>{t("story.quiz")}</h2><span className="chip">+{current.quiz_points}</span></div>
          {current.questions.map((question) => (
            <fieldset key={question.id}>
              <legend>{question.prompt}</legend>
              {question.options.map((option, index) => (
                <label key={option} className={`story-option ${answers[question.id] === index ? "selected" : ""}`}>
                  <input type="radio" name={question.id} checked={answers[question.id] === index} onChange={() => setAnswers((a) => ({ ...a, [question.id]: index }))} />
                  {option}
                </label>
              ))}
            </fieldset>
          ))}
          <button className="btn primary block" disabled={busy || current.quiz_completed || Object.keys(answers).length !== current.questions.length} onClick={submit}>
            {current.quiz_completed ? t("story.done") : t("story.submit")}
          </button>
        </section>
      )}
    </div>
  );
}
