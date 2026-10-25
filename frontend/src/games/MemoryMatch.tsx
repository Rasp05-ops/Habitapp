import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../hooks/app";
import { fmtTime, Segmented } from "../components/ui";
import { store } from "../lib/storage";
import { flip, newMemory, resolve, stars, type MemoryState } from "./logic/memory";
import { shuffle } from "./logic/rng";

const EMOJI = ["🍎", "🚀", "🎧", "🌵", "🐙", "⚽", "🎲", "🌈", "🍕", "🦊", "📚", "🎸"];
const LEVELS = { easy: 6, medium: 8, hard: 10 } as const;
type Level = keyof typeof LEVELS;
type Best = { moves: number; time: number };

const deal = (level: Level) => newMemory(shuffle(EMOJI).slice(0, LEVELS[level]));

export default function MemoryMatch() {
  const { t } = useApp();
  const [level, setLevel] = useState<Level>("medium");
  const [game, setGame] = useState<MemoryState>(() => deal("medium"));
  const [seconds, setSeconds] = useState(0);
  const [started, setStarted] = useState(false);
  const [best, setBest] = useState<Best | null>(() => store.getJSON<Best | null>("mm_best_medium", null));
  const [isNewBest, setIsNewBest] = useState(false);
  const timeRef = useRef(0);
  timeRef.current = seconds;

  const reset = useCallback((lv: Level) => {
    setLevel(lv); setGame(deal(lv)); setSeconds(0); setStarted(false); setIsNewBest(false);
    setBest(store.getJSON<Best | null>(`mm_best_${lv}`, null));
  }, []);

  // flip the mismatched pair back after a short peek
  useEffect(() => {
    if (!game.locked) return;
    const id = setTimeout(() => setGame((g) => resolve(g)), 850);
    return () => clearTimeout(id);
  }, [game.locked]);

  // clock runs from the first flip until the win
  useEffect(() => {
    if (!started || game.won) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [started, game.won]);

  // record the result exactly once per win
  useEffect(() => {
    if (!game.won) return;
    const prev = store.getJSON<Best | null>(`mm_best_${level}`, null);
    const cur = { moves: game.moves, time: timeRef.current };
    if (!prev || cur.moves < prev.moves || (cur.moves === prev.moves && cur.time < prev.time)) {
      store.setJSON(`mm_best_${level}`, cur); setBest(cur); setIsNewBest(true);
    }
  }, [game.won, game.moves, level]);

  const onFlip = (i: number) => { setStarted(true); setGame((g) => flip(g, i)); };
  const pairs = LEVELS[level];
  const cols = level === "hard" ? 5 : 4;

  return (
    <div className="game-wrap">
      <div className="game-bar">
        <Segmented value={level} onChange={reset} options={[{ value: "easy", label: t("games.easy") }, { value: "medium", label: t("games.medium") }, { value: "hard", label: t("games.hard") }]} />
        <div className="stats-inline">
          <span><small>{t("games.moves")}</small><b>{game.moves}</b></span>
          <span><small>{t("games.time")}</small><b>{fmtTime(seconds)}</b></span>
          {best && <span><small>{t("games.best")}</small><b>{best.moves}</b></span>}
        </div>
      </div>

      <div className="mm-board" style={{ ["--cols" as string]: cols }}>
        {game.cards.map((c, i) => {
          const up = c.matched || game.open.includes(i);
          return (
            <button key={c.id} className={`mm-card ${up ? "up" : ""} ${c.matched ? "matched" : ""}`} onClick={() => onFlip(i)}
              aria-label={up ? c.symbol : "?"} aria-pressed={up} disabled={c.matched}>
              <span className="mm-face back">✦</span>
              <span className="mm-face front">{c.symbol}</span>
            </button>
          );
        })}
      </div>

      {game.won && (
        <div className="card result" role="status">
          <div className="stars">{[1, 2, 3].map((n) => <span key={n} className={n <= stars(game.moves, pairs) ? "on" : ""}>★</span>)}</div>
          <h2>{t("games.win")}</h2>
          <p className="muted">{game.moves} {t("games.moves").toLowerCase()} · {fmtTime(seconds)}{isNewBest && " · 🏆"}</p>
          <button className="btn primary" onClick={() => reset(level)}>{t("games.again")}</button>
        </div>
      )}
      {!game.won && <button className="btn ghost" onClick={() => reset(level)}>{t("games.new")}</button>}
    </div>
  );
}
