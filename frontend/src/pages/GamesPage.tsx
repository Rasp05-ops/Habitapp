import { useEffect } from "react";
import { api } from "../api/client";
import type { Game } from "../api/types";
import Icon from "../components/Icon";
import { ErrorBox, PageHead, Skeleton } from "../components/ui";
import MemoryMatch from "../games/MemoryMatch";
import Sudoku from "../games/Sudoku";
import WordGuess from "../games/WordGuess";
import { useApp } from "../hooks/app";
import { useAsync } from "../hooks/useAsync";

const PLAYABLE: Record<string, () => JSX.Element> = { memory_match: MemoryMatch, word_guess: WordGuess, sudoku: Sudoku };

export default function GamesPage({ gameId, go }: { gameId: string | null; go: (to: string) => void }) {
  const { lang, t } = useApp();
  const q = useAsync(api.games);
  const games = q.data?.games ?? [];
  const current = gameId ? games.find((g) => g.id === gameId) : undefined;

  // Locked / unknown games can't be opened by typing the URL: send them back to the hub.
  useEffect(() => {
    if (q.data && gameId && (!current || !current.unlocked || !PLAYABLE[gameId])) go("/games");
  }, [q.data, gameId, current, go]);

  if (q.error && !q.data) return <ErrorBox error={q.error} onRetry={q.reload} />;
  if (!q.data) return <div className="stack"><Skeleton h={90} /><Skeleton h={150} /><Skeleton h={150} /></div>;

  if (current && current.unlocked && PLAYABLE[current.id]) {
    const Game = PLAYABLE[current.id];
    return (
      <div className="stack">
        <PageHead title={`${current.icon} ${current.name[lang]}`} right={<button className="btn ghost" onClick={() => go("/games")}><Icon name="back" size={18} /> {t("games.back")}</button>} />
        <Game />
      </div>
    );
  }

  const lp = q.data.lifetime_points;
  return (
    <div className="stack">
      <PageHead title={t("games.title")} sub={t("games.sub")} right={<span className="pill gold"><Icon name="star" size={14} fill /> {lp}</span>} />
      <section className="game-grid">
        {games.map((g: Game) => {
          const pct = Math.min(100, (lp / g.required_points) * 100);
          return (
            <article key={g.id} className={`card game-card ${g.unlocked ? "open" : "locked"}`}>
              <div className="game-icon" aria-hidden="true">{g.icon}</div>
              <h3>{g.name[lang]}</h3>
              <p className="muted">{t(`game.${g.id}.desc`)}</p>
              {g.unlocked ? (
                <button className="btn primary block" onClick={() => go(`/games/${g.id}`)}>{t("games.play")}</button>
              ) : (
                <div className="lock-box">
                  <div className="row-between"><span><Icon name="lock" size={16} /> {t("games.locked")}</span><small>{lp}/{g.required_points}</small></div>
                  <div className="bar"><i style={{ width: `${pct}%` }} /></div>
                  <small className="muted">{g.required_points - lp} {t("games.need")}</small>
                </div>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
