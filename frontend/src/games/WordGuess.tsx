import { useCallback, useEffect, useState } from "react";
import { useApp } from "../hooks/app";
import Icon from "../components/Icon";
import { store } from "../lib/storage";
import { pick } from "./logic/rng";
import { ANSWERS } from "./logic/words";
import { isWellFormed, mergeKeys, scoreGuess, statusOf, MAX_TRIES, WORD_LEN, type Mark } from "./logic/wordle";

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
type Stats = { played: number; won: number; streak: number; best: number };
const STATS_KEY = "wg_stats";

export default function WordGuess() {
  const { t } = useApp();
  const [answer, setAnswer] = useState(() => pick(ANSWERS));
  const [guesses, setGuesses] = useState<string[]>([]);
  const [current, setCurrent] = useState("");
  const [keys, setKeys] = useState<Record<string, Mark>>({});
  const [msg, setMsg] = useState("");
  const [shake, setShake] = useState(false);
  const [stats, setStats] = useState<Stats>(() => store.getJSON<Stats>(STATS_KEY, { played: 0, won: 0, streak: 0, best: 0 }));
  const status = statusOf(guesses, answer);

  const press = useCallback((ch: string) => {
    if (status !== "playing") return;
    setMsg("");
    setCurrent((c) => (c.length < WORD_LEN ? c + ch : c));
  }, [status]);
  const back = useCallback(() => { if (status === "playing") { setMsg(""); setCurrent((c) => c.slice(0, -1)); } }, [status]);

  const submit = useCallback(() => {
    if (status !== "playing") return;
    if (current.length < WORD_LEN || !isWellFormed(current)) {
      setMsg(t("games.shortWord")); setShake(true); setTimeout(() => setShake(false), 450); return;
    }
    const marks = scoreGuess(current, answer);
    const next = [...guesses, current];
    setGuesses(next); setKeys((k) => mergeKeys(k, current, marks)); setCurrent("");
    const s = statusOf(next, answer);
    if (s !== "playing") {                                   // update lifetime stats exactly once per finished game
      const won = s === "won";
      const ns: Stats = { played: stats.played + 1, won: stats.won + (won ? 1 : 0), streak: won ? stats.streak + 1 : 0, best: Math.max(stats.best, won ? stats.streak + 1 : 0) };
      setStats(ns); store.setJSON(STATS_KEY, ns);
    }
  }, [status, current, answer, guesses, stats, t]);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Enter") { e.preventDefault(); submit(); }
      else if (e.key === "Backspace") back();
      else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toLowerCase());
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [submit, back, press]);

  const again = () => { setAnswer(pick(ANSWERS)); setGuesses([]); setCurrent(""); setKeys({}); setMsg(""); };

  return (
    <div className="game-wrap narrow">
      <div className="game-bar">
        <small className="muted">{t("games.wordsEnglish")}</small>
        <div className="stats-inline">
          <span><small>{t("games.played")}</small><b>{stats.played}</b></span>
          <span><small>{t("games.won")}</small><b>{stats.won}</b></span>
          <span><small>🔥</small><b>{stats.streak}</b></span>
        </div>
      </div>

      <div className="wg-msg" role="status">{msg || "\u00A0"}</div>
      <div className="wg-board" aria-label="Word grid">
        {Array.from({ length: MAX_TRIES }, (_, r) => {
          const done = r < guesses.length, active = r === guesses.length;
          const word = done ? guesses[r] : active ? current : "";
          const marks = done ? scoreGuess(guesses[r], answer) : null;
          return (
            <div key={r} className={`wg-row ${active && shake ? "shake" : ""}`}>
              {Array.from({ length: WORD_LEN }, (_, c) => (
                <div key={c} className={`wg-tile ${marks ? marks[c] : ""} ${word[c] ? "filled" : ""} ${done && r === guesses.length - 1 ? "reveal" : ""}`}
                  style={{ animationDelay: `${c * 110}ms` }}>{word[c]?.toUpperCase()}</div>
              ))}
            </div>
          );
        })}
      </div>

      {status !== "playing" && (
        <div className="card result" role="status">
          <h2>{status === "won" ? t("games.win") : t("games.lose")}</h2>
          <p className="muted">{t("games.answer")} <b className="mono">{answer.toUpperCase()}</b></p>
          <button className="btn primary" onClick={again}>{t("games.again")}</button>
        </div>
      )}

      <div className="wg-keys" aria-label="Keyboard">
        {ROWS.map((row, i) => (
          <div key={row} className="wg-krow">
            {i === 2 && <button className="wg-key wide" onClick={submit}>{t("games.enter")}</button>}
            {[...row].map((ch) => <button key={ch} className={`wg-key ${keys[ch] ?? ""}`} onClick={() => press(ch)}>{ch}</button>)}
            {i === 2 && <button className="wg-key wide" onClick={back} aria-label="Backspace"><Icon name="eraser" size={18} /></button>}
          </div>
        ))}
      </div>
    </div>
  );
}
